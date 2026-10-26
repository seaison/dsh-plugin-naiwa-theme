import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlugin } from '../src/client.mjs';
import { ARTWORKS, tokensFor } from '../src/catalog.mjs';

const catalog = ARTWORKS.map(a => ({ ...a, tokens: tokensFor(a), url: '/naiwa-theme/assets/' + a.file }));
const plugin = createPlugin({}, catalog, 'test CSS');

test('pending reply colors follow every palette and keep readable base text', () => {
  const rgb = hex => hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255);
  const luminance = colors => colors.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
  for (const art of ARTWORKS) {
    const tokens = tokensFor(art), base = rgb(art.base);
    const components = tokens['--dsw-alias-label-deep-diving'].match(/[\d.]+/g).map(Number);
    const text = components.slice(0, 3).map((value, i) => value / 255 * components[3] + base[i] * (1 - components[3]));
    const light = [luminance(base), luminance(text)];
    assert((Math.max(...light) + .05) / (Math.min(...light) + .05) >= 4.5, art.id);
    assert.equal(tokens['--dsw-alias-label-deep-diving-shimmer'], art.accent);
  }
});

function fixture(initial = null) {
  const values = new Map();
  const attrs = new Map();
  let preference = 'dark';
  const themes = new Set(['dark', 'light']);
  const listeners = new Set();
  const nodes = new Set();
  const emit = () => { for (const fn of listeners) fn(); };
  const ctx = {
    theme: {
      getTheme: () => ({ preference }),
      register(a) { assert(!themes.has(a.id)); themes.add(a.id); emit(); return () => { themes.delete(a.id); if (preference === a.id) preference = 'system'; emit(); }; },
      setTheme(id) { assert(id === 'system' || themes.has(id)); preference = id; emit(); }
    },
    on(event, fn) { assert.equal(event, 'theme/change'); listeners.add(fn); return () => listeners.delete(fn); }
  };
  const body = {
    style: { getPropertyValue: k => values.get(k)?.[0] || '', getPropertyPriority: k => values.get(k)?.[1] || '', setProperty: (k, v, p = '') => values.set(k, [v, p]), removeProperty: k => values.delete(k) },
    getAttribute: k => attrs.get(k) ?? null, setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k)
  };
  const doc = { body, head: { appendChild: n => nodes.add(n) }, createElement: () => ({ setAttribute() {}, remove() { nodes.delete(this); } }) };
  let stored = initial;
  const storage = { getItem: () => stored, setItem: (key, value) => { stored = value; } };
  return { ctx, doc, storage, values, attrs, nodes, themes, listeners, saved: () => JSON.parse(stored) };
}

test('selection syncs native themes, wallpaper and saved preferences; external themes clear activation', () => {
  const f = fixture();
  const c = plugin.createController(f.ctx, f.doc, f.storage);
  assert.equal(f.ctx.theme.getTheme().preference, 'dark');
  assert.equal(f.attrs.size, 0);
  c.select('naiwa-lantern');
  assert.equal(f.attrs.get('data-naiwa-theme'), 'naiwa-lantern');
  assert.equal(f.saved().active, 'naiwa-lantern');
  assert.match(f.values.get('--naiwa-wallpaper')[0], /02-lantern/);
  c.update({ wallpaper: false, blur: 7 });
  assert.equal(f.values.get('--naiwa-wallpaper')[0], 'none');
  assert.match(f.values.get('--naiwa-wash')[0], /, 1\)$/);
  f.ctx.theme.setTheme('light');
  assert.equal(f.attrs.size, 0);
  assert.equal(f.values.size, 0);
  assert.equal(f.saved().active, null);
  c.dispose();
});

test('reload restores a saved native theme and adjustments; restore returns to previous preference', () => {
  const f = fixture(JSON.stringify({ active: 'naiwa-coast', reading: 70, blur: 4 }));
  const c = plugin.createController(f.ctx, f.doc, f.storage);
  assert.equal(f.ctx.theme.getTheme().preference, 'naiwa-coast');
  assert.equal(f.values.get('--naiwa-blur')[0], '4px');
  assert.equal(c.getSnapshot().prefs.reading, 70);
  c.restore();
  assert.equal(f.ctx.theme.getTheme().preference, 'dark');
  assert.equal(f.saved().active, null);
  c.dispose();
});

test('malformed storage is bounded and unavailable storage does not prevent switching', () => {
  const f = fixture('{broken JSON');
  f.storage.setItem = () => { throw new Error('storage blocked'); };
  const c = plugin.createController(f.ctx, f.doc, f.storage);
  c.select('naiwa-fuji');
  c.update({ blur: Infinity, shade: -99, reading: 1234 });
  assert.equal(c.getSnapshot().prefs.blur, 0);
  assert.equal(c.getSnapshot().prefs.shade, 0);
  assert.equal(c.getSnapshot().prefs.reading, 96);
  assert.match(c.getSnapshot().warning, /无法保存/);
  assert.equal(f.attrs.get('data-naiwa-theme'), 'naiwa-fuji');
  c.dispose();
});

test('delayed and repeated native settings adoption cannot erase a saved theme', async () => {
  const f = fixture(JSON.stringify({ active: 'naiwa-lantern', reading: 68 }));
  let formState = { status: 'loading', value: undefined };
  const subscribers = new Set();
  f.ctx.configForms = { get: () => ({ getSnapshot: () => formState, subscribe: fn => { subscribers.add(fn); return () => subscribers.delete(fn); } }) };
  const c = plugin.createController(f.ctx, f.doc, f.storage);
  f.ctx.theme.setTheme('light');
  assert.equal(f.saved().active, 'naiwa-lantern');
  formState = { status: 'ready', value: { preference: 'light' } };
  for (const fn of subscribers) fn();
  await Promise.resolve();
  assert.equal(f.ctx.theme.getTheme().preference, 'naiwa-lantern');
  assert.equal(c.getSnapshot().prefs.reading, 68);
  assert.equal(subscribers.size, 1);
  formState = { status: 'ready', value: { preference: 'light' } };
  f.ctx.theme.setTheme('light');
  for (const fn of subscribers) fn();
  await Promise.resolve();
  assert.equal(f.ctx.theme.getTheme().preference, 'naiwa-lantern');
  f.ctx.theme.setTheme('light');
  assert.equal(f.saved().active, null);
  c.dispose();
  assert.equal(subscribers.size, 0);
});

test('random wallpaper excludes the active theme and pet settings remain bounded', () => {
  const f = fixture();
  const c = plugin.createController(f.ctx, f.doc, f.storage);
  c.select('naiwa-pine'); c.random();
  assert.notEqual(f.ctx.theme.getTheme().preference, 'naiwa-pine');
  assert.equal(c.getSnapshot().prefs.startupSound, true);
  assert.equal(c.getSnapshot().prefs.gameMusic, true);
  assert.equal(c.getSnapshot().prefs.gameVolume, 22);
  c.update({ petSize: 999, volume: -5, gameMusic: false, gameVolume: 200, petPosition: { x: 5, y: -2 }, startupSound: false });
  assert.equal(c.getSnapshot().prefs.petSize, 200);
  assert.equal(c.getSnapshot().prefs.volume, 0);
  assert.deepEqual(c.getSnapshot().prefs.petPosition, { x: 1, y: 0 });
  assert.equal(f.saved().startupSound, false);
  assert.equal(f.saved().gameMusic, false);
  assert.equal(f.saved().gameVolume, 100);
  c.dispose();
});

test('unload restores owned styles and removes themes, listeners and stylesheets without erasing saved selection', () => {
  const f = fixture();
  f.doc.body.style.setProperty('--naiwa-blur', '3px', 'important');
  const c = plugin.createController(f.ctx, f.doc, f.storage);
  c.select('naiwa-pine');
  c.dispose(); c.dispose();
  assert.deepEqual(f.values.get('--naiwa-blur'), ['3px', 'important']);
  assert.equal(f.attrs.size, 0);
  assert.equal(f.nodes.size, 0);
  assert.equal(f.listeners.size, 0);
  assert.deepEqual([...f.themes], ['dark', 'light']);
  assert.equal(f.saved().active, 'naiwa-pine');
});

function localMedia() {
  let record;
  const revoked = [];
  let serial = 0;
  return {
    media: { read: async () => record, put: async value => { record = value; }, remove: async () => { record = undefined; }, close() {} },
    inspectWallpaper: async () => ({ width: 1672, height: 941 }),
    urls: { createObjectURL: () => 'blob:test-' + ++serial, revokeObjectURL: value => revoked.push(value) },
    revoked, getRecord: () => record
  };
}

test('custom wallpaper survives controller reload, switches with the gallery and can be removed', async () => {
  const f = fixture(), local = localMedia();
  const c = plugin.createController(f.ctx, f.doc, f.storage, local);
  c.select('naiwa-lantern');
  await c.importWallpaper(new File(['image bytes'], '我的风景.png', { type: 'image/png' }));
  assert.equal(f.saved().wallpaperSource, 'custom');
  assert.equal(c.getSnapshot().customWallpaper.name, '我的风景.png');
  assert.match(f.values.get('--naiwa-wallpaper')[0], /blob:test-1/);
  c.dispose(); assert.deepEqual(local.revoked, ['blob:test-1']);
  const restored = fixture(JSON.stringify(f.saved()));
  const next = plugin.createController(restored.ctx, restored.doc, restored.storage, local);
  await Promise.resolve(); await Promise.resolve();
  assert.match(restored.values.get('--naiwa-wallpaper')[0], /blob:test-2/);
  next.select('naiwa-lily');
  assert.equal(next.getSnapshot().prefs.wallpaperSource, 'collection');
  assert.match(restored.values.get('--naiwa-wallpaper')[0], /08-water-lily/);
  next.useCustomWallpaper();
  assert.equal(next.getSnapshot().prefs.wallpaperSource, 'custom');
  await next.removeWallpaper();
  assert.equal(next.getSnapshot().customWallpaper, null);
  assert.equal(local.getRecord(), undefined);
  assert.match(restored.values.get('--naiwa-wallpaper')[0], /08-water-lily/);
  next.dispose();
});

test('a failed import preserves the current wallpaper and clears busy state', async () => {
  const f = fixture(), local = localMedia();
  local.media.put = async () => { throw new Error('storage full'); };
  const c = plugin.createController(f.ctx, f.doc, f.storage, local);
  c.select('naiwa-coast');
  await assert.rejects(c.importWallpaper(new File(['image'], 'photo.png', { type: 'image/png' })), /storage full/);
  assert.equal(c.getSnapshot().importing, false);
  assert.equal(c.getSnapshot().customWallpaper, null);
  assert.equal(f.saved().wallpaperSource, 'collection');
  assert.match(f.values.get('--naiwa-wallpaper')[0], /03-skagen/);
  assert.equal(local.revoked.length, 0);
  c.dispose();
});

test('late local-media reads cannot overwrite a new import or recreate URLs after disposal', async () => {
  const f = fixture(), local = localMedia(); let completeRead;
  local.media.read = () => new Promise(resolve => { completeRead = resolve; });
  const c = plugin.createController(f.ctx, f.doc, f.storage, local);
  await c.importWallpaper(new File(['new'], 'new.png', { type: 'image/png' }));
  completeRead({ blob: new Blob(['old'], { type: 'image/png' }), name: 'old.png', width: 20, height: 20 });
  await Promise.resolve();
  assert.equal(c.getSnapshot().customWallpaper.name, 'new.png');
  c.dispose();
  const g = fixture(); let readAfterDispose;
  local.media.read = () => new Promise(resolve => { readAfterDispose = resolve; });
  const disposed = plugin.createController(g.ctx, g.doc, g.storage, local);
  disposed.dispose();
  readAfterDispose(local.getRecord()); await Promise.resolve();
  assert.equal(disposed.getSnapshot().customWallpaper, null);
});
