export const BALANCE_PATH = '/naiwa-theme/balance.json';

export function trustedBalanceRequest(req) {
  const host = String(req.headers.host || '').toLowerCase();
  const authority = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  if (!['127.0.0.1', 'localhost', '::1'].includes(authority)) return false;
  if (['cross-site'].includes(req.headers['sec-fetch-site']) || req.headers.forwarded || req.headers['x-forwarded-for']) return false;
  if (req.headers.origin) {
    try { const origin = new URL(req.headers.origin); if (!['http:', 'https:'].includes(origin.protocol) || origin.host.toLowerCase() !== host) return false; }
    catch { return false; }
  }
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
}

export function parseBalance(data) {
  const wallets = Array.isArray(data?.balance_infos) ? data.balance_infos : [];
  const wallet = wallets.find(w => w?.currency === 'CNY') || wallets.find(w => w?.currency === 'USD');
  const value = wallet?.total_balance;
  if (!['number', 'string'].includes(typeof value) || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value).trim()) || !Number.isFinite(Number(value))) return null;
  return { ok: true, available: data.is_available !== false, balance: Number(value), currency: wallet.currency, text: (wallet.currency === 'CNY' ? '¥' : '$') + Number(value).toFixed(2), at: Date.now() };
}

/** One deadline covers credential resolution, transport and response decoding. */
export function createBalanceReader({ resolveCredential, fetchImpl = globalThis.fetch, timeoutMs = 10000, cacheMs = 60000 } = {}) {
  if (typeof resolveCredential !== 'function' || typeof fetchImpl !== 'function') throw new TypeError('Credential resolver and fetch are required');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647 || !Number.isFinite(cacheMs) || cacheMs < 0) throw new RangeError('Invalid balance timing options');
  const lifecycle = new AbortController();
  let cache = null, inFlight = null;
  const read = () => {
    if (lifecycle.signal.aborted) return Promise.resolve({ ok: false, code: 'CANCELLED' });
    if (cache && Date.now() - cache.at < cacheMs) return Promise.resolve(cache);
    if (inFlight) return inFlight;
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), timeoutMs);
    const signal = AbortSignal.any([lifecycle.signal, deadline.signal]);
    let onAbort;
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
    });
    // Defer even a synchronous resolver exception until after inFlight is assigned.
    const operation = Promise.resolve().then(async () => {
      signal.throwIfAborted();
      const credential = await resolveCredential('DEEPSEEK_API_KEY');
      signal.throwIfAborted();
      const value = typeof credential === 'string' ? credential : credential?.value;
      const key = typeof value === 'string' ? value.trim() : '';
      if (!key) return { ok: false, code: 'NO_KEY' };
      const response = await fetchImpl('https://api.deepseek.com/user/balance', { headers: { authorization: 'Bearer ' + key }, signal });
      signal.throwIfAborted();
      if (!response.ok) return { ok: false, code: response.status === 401 ? 'AUTH' : 'UPSTREAM' };
      const result = parseBalance(await response.json());
      signal.throwIfAborted();
      if (result) cache = result;
      return result || { ok: false, code: 'UNAVAILABLE' };
    });
    const task = Promise.race([operation, aborted])
      .catch(() => ({ ok: false, code: lifecycle.signal.aborted ? 'CANCELLED' : deadline.signal.aborted ? 'TIMEOUT' : 'UNAVAILABLE' }))
      .finally(() => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        if (inFlight === task) inFlight = null;
      });
    inFlight = task;
    return task;
  };
  return { read, dispose() { cache = null; lifecycle.abort(); } };
}

export function registerBalance(ctx) {
  ctx.inject(['webServer', 'credentials'], scope => {
    const reader = createBalanceReader({ resolveCredential: id => scope.credentials.resolve(id) });
    scope.effect(() => () => reader.dispose(), 'naiwa: balance requests');
    scope.effect(() => scope.webServer.register({ kind: 'exact', path: BALANCE_PATH, async handler(req, res) {
      const send = (status, data) => { if (!res.destroyed) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(req.method === 'HEAD' ? undefined : JSON.stringify(data)); } };
      if (!trustedBalanceRequest(req)) return send(403, { ok: false, code: 'FORBIDDEN' });
      if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('allow', 'GET, HEAD'); return send(405, { ok: false, code: 'METHOD' }); }
      send(200, await reader.read());
    } }), 'naiwa: balance route');
  });
}
