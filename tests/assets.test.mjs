import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assetRoutes, apply } from '../lib/index.js';

test('all twenty-nine packaged image, animation, video and audio assets stream correctly with HEAD/cache and write restrictions', async t => {
  const routes = new Map(assetRoutes().map(r => [r.path, r.handler]));
  assert.equal(routes.size, 29);
  const server = createServer((req, res) => {
    const handler = routes.get(new URL(req.url, 'http://localhost').pathname);
    if (handler) void handler(req, res);
    else { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const path of routes.keys()) {
    const r = await fetch(base + path);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), path.endsWith('.mp4') ? 'video/mp4' : path.endsWith('.mp3') ? 'audio/mpeg' : path.endsWith('.m4a') ? 'audio/mp4' : path.endsWith('.gif') ? 'image/gif' : path.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
    const data = Buffer.from(await r.arrayBuffer());
    const hash = createHash('sha256').update(data).digest('hex');
    assert.equal(r.headers.get('etag'), '"' + hash + '"');
    const head = await fetch(base + path, { method: 'HEAD' });
    assert.equal(Number(head.headers.get('content-length')), data.length);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    assert.equal((await fetch(base + path, { headers: { 'if-none-match': 'W/"' + hash + '"' } })).status, 304);
    const versioned = await fetch(base + path + '?v=' + hash.slice(0, 12), { method: 'HEAD' });
    assert.match(versioned.headers.get('cache-control'), /immutable/);
    const write = await fetch(base + path, { method: 'POST' });
    assert.equal(write.status, 405);
    assert.equal(write.headers.get('allow'), 'GET, HEAD');
  }
  assert.equal((await fetch(base + '/naiwa-theme/assets/secret.txt')).status, 404);
  assert.equal((await fetch(base + '/naiwa-theme/assets/%2e%2e/package.json')).status, 404);
});

test('the host registers exact routes inside disposable effects', () => {
  const registrations = [];
  const disposers = [];
  apply({ inject(deps, cb) {
    if (deps.includes('credentials')) return;
    assert.deepEqual(deps, ['webServer']);
    cb({ effect(fn) { disposers.push(fn()); }, webServer: { register(route) { assert.equal(route.kind, 'exact'); registrations.push(route.path); return () => registrations.splice(registrations.indexOf(route.path), 1); } } });
  } });
  assert.equal(registrations.length, 29);
  for (const dispose of disposers) dispose();
  assert.equal(registrations.length, 0);
});

test('the published client uses DSH ModuleLoader and declares its runtime services', async () => {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  let bundle;
  const { runInNewContext } = await import('node:vm');
  runInNewContext(source, { window: { __ModuleLoader__: { load: value => { bundle = value; } } } });
  assert.equal(bundle.id, 'dsh-plugin-naiwa-theme');
  const plugin = bundle.factory(name => { assert.equal(name, 'react'); return {}; });
  assert.deepEqual(Array.from(plugin.inject), ['theme', 'slots', 'configForms']);
  assert.equal(typeof plugin.apply, 'function');
});


test('film and both audio clips support byte ranges, suffixes and safe invalid-range responses', async t => {
  const routes = new Map(assetRoutes().map(r => [r.path, r.handler]));
  const server = createServer((req, res) => { void routes.get(new URL(req.url, 'http://localhost').pathname)(req, res); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => { server.closeAllConnections(); server.close(); });
  for (const file of ['startup.mp4', 'pet-laugh.mp3', 'startup-piano.m4a']) {
  const original = readFileSync(new URL('../media/' + file, import.meta.url));
  const url = 'http://127.0.0.1:' + server.address().port + '/naiwa-theme/assets/' + file;
  for (const [range, start, end] of [['bytes=0-63', 0, 63], ['bytes=100-149', 100, 149], ['bytes=-32', original.length - 32, original.length - 1], [`bytes=${original.length - 20}-`, original.length - 20, original.length - 1]]) {
    const r = await fetch(url, { headers: { range } });
    assert.equal(r.status, 206);
    assert.equal(r.headers.get('content-range'), `bytes ${start}-${end}/${original.length}`);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), original.subarray(start, end + 1));
  }
  for (const range of ['bytes=9000000000-', 'bytes=10-1', 'bytes=-0', 'bytes=0-10,20-30', 'bytes=-', 'nonsense']) {
    const r = await fetch(url, { method: 'HEAD', headers: { range } });
    assert.equal(r.status, 416);
    assert.equal(r.headers.get('content-range'), `bytes */${original.length}`);
  }
  const full = await fetch(url, { method: 'HEAD', headers: { range: 'bytes=0-4', 'if-range': '"old-version"' } });
  assert.equal(full.status, 200);
  assert.equal(Number(full.headers.get('content-length')), original.length);
  }
});
