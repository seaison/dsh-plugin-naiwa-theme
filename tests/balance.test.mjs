import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTick } from 'node:timers/promises';
import { trustedBalanceRequest, parseBalance, createBalanceReader, registerBalance, BALANCE_PATH } from '../lib/balance.mjs';

test('balance endpoint rejects cross-site, rebinding, proxies and non-local peers', () => {
  const req = (headers = {}, address = '127.0.0.1') => ({ headers: { host: '127.0.0.1:3478', ...headers }, socket: { remoteAddress: address } });
  assert(trustedBalanceRequest(req()));
  assert(trustedBalanceRequest(req({ origin: 'http://127.0.0.1:3478' })));
  assert(!trustedBalanceRequest(req({ host: 'evil.example:3478' })));
  assert(!trustedBalanceRequest(req({ origin: 'https://evil.example' })));
  assert(!trustedBalanceRequest(req({ 'sec-fetch-site': 'cross-site' })));
  assert(!trustedBalanceRequest(req({ 'x-forwarded-for': '127.0.0.1' })));
  assert(!trustedBalanceRequest(req({}, '192.168.1.7')));
});

test('real zero balances are distinct from invalid values and CNY is selected explicitly', () => {
  const payload = value => ({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: value }] });
  for (const value of [null, false, '', 'NaN', 'Infinity', {}, []]) assert.equal(parseBalance(payload(value)), null);
  assert.equal(parseBalance(payload('0.00')).text, '¥0.00');
  assert.equal(parseBalance({ balance_infos: [{ currency: 'USD', total_balance: '3.50' }, { currency: 'CNY', total_balance: '25.40' }] }).text, '¥25.40');
  assert.equal(parseBalance({ is_available: false, balance_infos: [{ currency: 'USD', total_balance: '-1' }] }).available, false);
});

const payload = value => ({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: String(value) }] });
const response = value => ({ ok: true, status: 200, json: async () => payload(value) });
const credential = () => ({ value: 'fixture-key' });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test('both credential shapes remove outer spaces and newlines before creating a real request header', async t => {
  for (const value of [' \nfixture-key\r\n ', { value: '\r\n fixture-key \n' }]) {
    let calls = 0;
    const reader = createBalanceReader({ resolveCredential: () => value, fetchImpl: async (url, options) => {
      calls++;
      const request = new Request(url, options);
      assert.equal(request.url, 'https://api.deepseek.com/user/balance');
      assert.equal(request.headers.get('authorization'), 'Bearer fixture-key');
      return response('25.40');
    } });
    t.after(() => reader.dispose());
    const result = await reader.read();
    assert.equal(result.text, '¥25.40');
    assert.equal(calls, 1);
    assert(!JSON.stringify(result).includes('fixture-key'));
  }
});

test('empty credentials never reach the upstream API', async t => {
  for (const value of [undefined, null, {}, { value: '\n  \r\n' }, ' \n ']) {
    const reader = createBalanceReader({ resolveCredential: () => value, fetchImpl: () => assert.fail('Missing credential must not fetch') });
    t.after(() => reader.dispose());
    assert.deepEqual(await reader.read(), { ok: false, code: 'NO_KEY' });
  }
});

test('synchronous and asynchronous credential failures release the request so a repaired service can retry', async t => {
  for (const synchronous of [true, false]) {
    let lookups = 0, calls = 0;
    const reader = createBalanceReader({ resolveCredential: () => {
      if (++lookups === 1) {
        const error = new Error('private fixture diagnostic');
        if (synchronous) throw error;
        return Promise.reject(error);
      }
      return credential();
    }, fetchImpl: async () => { calls++; return response('25.40'); } });
    t.after(() => reader.dispose());
    assert.deepEqual(await reader.read(), { ok: false, code: 'UNAVAILABLE' });
    assert.equal((await reader.read()).text, '¥25.40');
    assert.equal(lookups, 2);
    assert.equal(calls, 1);
  }
});

test('concurrent reads share the pending request and successful reads retain the one-minute cache', async t => {
  const gate = deferred();
  let calls = 0, lookups = 0;
  const reader = createBalanceReader({ resolveCredential: () => { lookups++; return credential(); }, fetchImpl: async () => {
    calls++; await gate.promise; return response('25.40');
  } });
  t.after(() => reader.dispose());
  const first = reader.read(), second = reader.read();
  assert.equal(first, second);
  await nextTick();
  assert.equal(calls, 1);
  gate.resolve();
  for (const result of await Promise.all([first, second, reader.read()])) assert.equal(result.text, '¥25.40');
  assert.equal((await reader.read()).text, '¥25.40');
  assert.equal(calls, 1);
  assert.equal(lookups, 1);
});

test('the total deadline bounds a stuck credential resolver and blocks a late lookup from fetching or replacing a retry', { timeout: 1500 }, async t => {
  const late = deferred();
  let lookups = 0, calls = 0;
  const reader = createBalanceReader({ timeoutMs: 25, resolveCredential: () => ++lookups === 1 ? late.promise : credential(), fetchImpl: async () => {
    calls++; return response('7.00');
  } });
  t.after(() => reader.dispose());
  assert.deepEqual(await reader.read(), { ok: false, code: 'TIMEOUT' });
  assert.equal(calls, 0);
  assert.equal((await reader.read()).text, '¥7.00');
  late.resolve(credential());
  await nextTick();
  assert.equal(calls, 1);
  assert.equal((await reader.read()).text, '¥7.00');
});

test('the deadline releases a transport that ignores abort and discards its late response', { timeout: 1500 }, async t => {
  const late = deferred();
  let calls = 0, decoded = false, firstSignal;
  const reader = createBalanceReader({ timeoutMs: 25, resolveCredential: credential, fetchImpl: async (_url, { signal }) => {
    if (++calls > 1) return response('7.00');
    firstSignal = signal;
    return late.promise;
  } });
  t.after(() => reader.dispose());
  assert.deepEqual(await reader.read(), { ok: false, code: 'TIMEOUT' });
  assert.equal(firstSignal.aborted, true);
  assert.equal((await reader.read()).text, '¥7.00');
  late.resolve({ ok: true, json: async () => { decoded = true; return payload('99.00'); } });
  await nextTick();
  assert.equal(decoded, false);
  assert.equal((await reader.read()).text, '¥7.00');
  assert.equal(calls, 2);
});

test('response JSON shares the same deadline and cannot overwrite the new cache after timing out', { timeout: 1500 }, async t => {
  const late = deferred();
  let calls = 0;
  const reader = createBalanceReader({ timeoutMs: 25, resolveCredential: credential, fetchImpl: async () => ++calls === 1
    ? { ok: true, status: 200, json: () => late.promise } : response('7.00') });
  t.after(() => reader.dispose());
  assert.deepEqual(await reader.read(), { ok: false, code: 'TIMEOUT' });
  assert.equal((await reader.read()).text, '¥7.00');
  late.resolve(payload('99.00'));
  await nextTick();
  assert.equal((await reader.read()).text, '¥7.00');
  assert.equal(calls, 2);
});

test('disposal settles a stuck read immediately and refuses further or late upstream requests', { timeout: 1500 }, async () => {
  const late = deferred();
  const reader = createBalanceReader({ resolveCredential: () => late.promise, fetchImpl: () => assert.fail('Disposed reader must not fetch') });
  const pending = reader.read();
  await nextTick();
  reader.dispose();
  assert.deepEqual(await pending, { ok: false, code: 'CANCELLED' });
  assert.deepEqual(await reader.read(), { ok: false, code: 'CANCELLED' });
  late.resolve(credential());
  await nextTick();
});

test('upstream authentication, service and decoding failures stay private and are not cached', async t => {
  for (const [failure, code] of [
    [{ ok: false, status: 401 }, 'AUTH'],
    [{ ok: false, status: 429 }, 'UPSTREAM'],
    [{ ok: true, json: () => { throw new Error('private response fixture'); } }, 'UNAVAILABLE'],
    [{ ok: true, json: async () => ({ balance_infos: [] }) }, 'UNAVAILABLE']
  ]) {
    let calls = 0;
    const reader = createBalanceReader({ resolveCredential: credential, fetchImpl: async () => ++calls === 1 ? failure : response('25.40') });
    t.after(() => reader.dispose());
    assert.deepEqual(await reader.read(), { ok: false, code });
    assert.equal((await reader.read()).text, '¥25.40');
    assert.equal(calls, 2);
  }
});

test('the host route uses the repaired reader and retains HEAD, access, method and disposal behavior', async t => {
  const disposers = [];
  let route, calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(new Headers(options.headers).get('authorization'), 'Bearer fixture-key');
    calls++; return response('25.40');
  });
  registerBalance({ inject(deps, run) {
    assert.deepEqual(deps, ['webServer', 'credentials']);
    run({ credentials: { resolve: id => { assert.equal(id, 'DEEPSEEK_API_KEY'); return { value: '\n fixture-key \r\n' }; } },
      webServer: { register(value) { route = value; return () => { route = null; }; } },
      effect(runEffect) { disposers.push(runEffect()); }
    });
  } });
  t.after(() => { for (const dispose of disposers.reverse()) dispose(); });
  assert.equal(route.path, BALANCE_PATH);
  const request = async (method = 'GET', extraHeaders = {}) => {
    const result = { headers: {} };
    await route.handler({ method, headers: { host: '127.0.0.1:3478', ...extraHeaders }, socket: { remoteAddress: '127.0.0.1' } }, {
      writeHead(status, headers) { result.status = status; Object.assign(result.headers, headers); },
      setHeader(key, value) { result.headers[key] = value; }, end(body) { result.body = body === undefined ? null : JSON.parse(body); }
    });
    return result;
  };
  const get = await request();
  assert.equal(get.body.text, '¥25.40');
  assert.equal(get.headers['cache-control'], 'no-store');
  assert.equal((await request('HEAD')).body, null);
  const post = await request('POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
  assert.equal((await request('GET', { origin: 'https://evil.example' })).status, 403);
  assert.equal(calls, 1);
});
