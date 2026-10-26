import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { placePetCloud, nextPetReaction } from '../src/pet-core.mjs';
import { createPetFeatures } from '../src/pet.mjs';

test('pet faces into the chat and mirrors the cloud placement without crossing window edges', () => {
  const viewport = { width: 1440, height: 900 };
  const rightPet = { left: 1200, top: 650, minX: 280, maxX: 1288 };
  const right = placePetCloud(rightPet, 140, viewport);
  assert.equal(right.mirrored, false); assert(right.left < 0);
  const leftPet = { ...rightPet, left: 300 };
  const left = placePetCloud(leftPet, 140, viewport);
  assert.equal(left.mirrored, true); assert(left.left > 0);
  for (const width of [320, 540, 1440]) for (const reaction of [false, true]) for (const x of [8, width - 148]) for (const y of [10, 165, 680]) {
    const pet = { left: x, top: y, minX: 8, maxX: width - 148 };
    const cloud = placePetCloud(pet, 140, { width, height: 900 }, reaction);
    assert(pet.left + cloud.left >= 12);
    assert(pet.left + cloud.left + cloud.width <= width - 12);
    assert(pet.top + cloud.top >= 24);
    assert(pet.top + cloud.top + cloud.height <= 876);
    assert(cloud.pointer >= 22 && cloud.pointer <= cloud.width - 22);
  }
});

test('every reaction is reachable and consecutive clicks never repeat the same one', () => {
  assert.equal(nextPetReaction(null, 0), null);
  assert.equal(nextPetReaction(0, 1), 0);
  const first = new Set(Array.from({ length: 10 }, (_, i) => nextPetReaction(null, 10, () => (i + .5) / 10)));
  assert.equal(first.size, 10);
  for (let previous = 0; previous < 10; previous++) {
    const choices = new Set(Array.from({ length: 9 }, (_, i) => nextPetReaction(previous, 10, () => (i + .5) / 9)));
    assert.equal(choices.size, 9); assert(!choices.has(previous));
  }
});

test('all ten supplied reaction originals retain their recorded bytes and GIF format', () => {
  const reactions = JSON.parse(readFileSync(new URL('../media/reactions.json', import.meta.url)));
  assert.equal(reactions.length, 10);
  for (const reaction of reactions) {
    const data = readFileSync(new URL('../media/' + reaction.file, import.meta.url));
    assert.match(data.subarray(0, 6).toString(), /^GIF8[79]a$/);
    assert.equal(createHash('sha256').update(data).digest('hex'), reaction.sha256);
  }
});

// Exercise the actual Pet event handlers with persistent React state and refs.
// Child visuals and browser effects are irrelevant to click/timer transitions.
function harness(t, sound = true) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previousWindow = globalThis.window;
  globalThis.window = { innerWidth: 1440, innerHeight: 900 };
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  const state = [], refs = []; let stateIndex, refIndex, tree;
  const prefs = { sound, volume: 35, petEnabled: true, bubble: true, showBalance: true, petSize: 140, holidays: '' };
  const React = {
    Fragment: Symbol('Fragment'),
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(value) { const index = stateIndex++; if (!(index in state)) state[index] = value; return [state[index], update => { state[index] = typeof update === 'function' ? update(state[index]) : update; }]; },
    useRef(value) { const index = refIndex++; return refs[index] ||= { current: value }; },
    useEffect() {}, useLayoutEffect() {},
    useSyncExternalStore: (_subscribe, get) => get()
  };
  const pending = []; let stopped = 0, played = 0, options;
  const clip = { play() { played++; return new Promise(resolve => pending.push(resolve)); }, stop() { stopped++; }, duration: () => 15.696 };
  const core = { placePetCloud, nextPetReaction, peakInfo: () => ({ peak: false, reason: '工作日谷地' }), createAudioClip: (_url, value) => { options = value; return clip; } };
  const assets = { 'pet-animation': { introMs: 3210 }, reactions: Array.from({ length: 10 }, (_, id) => ({ id: String(id), url: `/reaction-${id}.gif` })) };
  const { Pet } = createPetFeatures(React, assets, { getSnapshot: () => ({ prefs }), subscribe() {}, update() {} }, null, core);
  const render = () => { stateIndex = 0; refIndex = 0; tree = Pet(); };
  const find = (predicate, node = tree) => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) { for (const child of node) { const result = find(predicate, child); if (result) return result; } return null; }
    if (predicate(node)) return node;
    for (const child of node.children || []) { const result = find(predicate, child); if (result) return result; }
    return null;
  };
  const byClass = name => find(node => node.props.className?.split(' ').includes(name));
  const click = name => { byClass(name).props.onClick(); render(); };
  render();
  return { render, click, byClass, prefs, get played() { return played; }, get stopped() { return stopped; }, pending, ended: () => { options.onState('ended'); render(); } };
}

test('clicking a laughing pet immediately stops sound and animation, including pending playback', async t => {
  const pet = harness(t);
  pet.click('np-pet-button');
  assert.match(pet.byClass('np-pet-button').props['aria-label'], /正在捧腹大笑.*点击停止/);
  assert.equal(pet.played, 0); t.mock.timers.tick(499); assert.equal(pet.played, 0);
  t.mock.timers.tick(1);
  assert.equal(pet.played, 1);
  pet.click('np-pet-button');
  assert.equal(pet.stopped, 1);
  assert.doesNotMatch(pet.byClass('np-pet-button').props['aria-label'], /正在/);
  pet.pending.shift()(true); await Promise.resolve();
  // Start a new play; the old promise must not change the new playback timer.
  pet.click('np-pet-button'); t.mock.timers.tick(500); assert.equal(pet.played, 2);
  pet.pending.shift()(true); await Promise.resolve();
  t.mock.timers.tick(1000); pet.render();
  assert.match(pet.byClass('np-pet-button').props['aria-label'], /正在/);
  pet.ended();
  assert.doesNotMatch(pet.byClass('np-pet-button').props['aria-label'], /正在/);
  pet.click('np-pet-button'); t.mock.timers.tick(500); assert.equal(pet.played, 3);
  pet.click('np-pet-button'); assert.equal(pet.stopped, 2);
});

test('muted laugh can also be stopped and finishes its single animation naturally', t => {
  const pet = harness(t, false);
  pet.click('np-pet-button'); pet.click('np-pet-button');
  assert.doesNotMatch(pet.byClass('np-pet-button').props['aria-label'], /正在/);
  pet.click('np-pet-button'); t.mock.timers.tick(3209); pet.render();
  assert.match(pet.byClass('np-pet-button').props['aria-label'], /正在/);
  t.mock.timers.tick(1); pet.render();
  assert.doesNotMatch(pet.byClass('np-pet-button').props['aria-label'], /正在/);
  assert.equal(pet.played, 0);
});

test('cloud requires a deliberate click, then goes from info to reaction to closed', t => {
  const pet = harness(t);
  const incidental = () => {
    for (const event of ['onPointerEnter', 'onPointerMove', 'onPointerDown', 'onFocus', 'onKeyDown']) pet.byClass('np-pet').props[event]?.({ key: 'Tab' });
    pet.render();
  };
  assert(!pet.byClass('np-cloud'));
  incidental(); assert(!pet.byClass('np-cloud'));
  pet.click('np-pet-button');
  t.mock.timers.tick(500);
  assert(pet.byClass('np-balance')); assert(pet.byClass('np-period'));
  assert(!pet.byClass('np-cloud-title')); assert(!pet.byClass('np-countdown'));
  pet.click('np-cloud');
  const first = pet.byClass('np-cloud-reaction').props.src;
  assert(!pet.byClass('np-balance'));
  assert.match(pet.byClass('np-cloud').props['aria-label'], /点击关闭气泡/);
  incidental(); assert.equal(pet.byClass('np-cloud-reaction').props.src, first);
  pet.click('np-cloud'); assert(!pet.byClass('np-cloud'));
  incidental(); assert(!pet.byClass('np-cloud'));
  assert.equal(pet.played, 1); assert.equal(pet.stopped, 0);
  // Another pet click stops the laugh and deliberately reopens information.
  pet.click('np-pet-button');
  assert.equal(pet.stopped, 1); assert(pet.byClass('np-balance'));
  pet.click('np-cloud'); assert.notEqual(pet.byClass('np-cloud-reaction').props.src, first);
  pet.click('np-cloud'); assert(!pet.byClass('np-cloud'));
  pet.click('np-pet-button');
  pet.prefs.showBalance = false; pet.render();
  assert(!pet.byClass('np-balance'));
  assert.doesNotMatch(pet.byClass('np-cloud').props['aria-label'], /余额/);
});

test('hover and focus cannot extend the six-second cloud timeout or reopen it', t => {
  const pet = harness(t);
  pet.click('np-pet-button');
  t.mock.timers.tick(3000);
  pet.byClass('np-pet').props.onPointerMove?.();
  pet.byClass('np-pet').props.onFocus?.(); pet.render();
  t.mock.timers.tick(2999); pet.render(); assert(pet.byClass('np-cloud'));
  t.mock.timers.tick(1); pet.render(); assert(!pet.byClass('np-cloud'));
  pet.byClass('np-pet').props.onPointerEnter?.(); pet.render(); assert(!pet.byClass('np-cloud'));
  pet.click('np-pet-button'); pet.click('np-cloud');
  t.mock.timers.tick(6000); pet.render(); assert(!pet.byClass('np-cloud'));
  pet.click('np-pet-button');
  assert(pet.byClass('np-balance')); assert(!pet.byClass('np-cloud-reaction'));
});

test('dragging and opening the context menu dismiss the cloud without triggering a new one', t => {
  const pet = harness(t);
  pet.click('np-pet-button'); t.mock.timers.tick(500);
  const capture = { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} };
  const event = { button: 0, pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 200, currentTarget: capture };
  pet.byClass('np-pet-button').props.onPointerDown(event); pet.render();
  pet.byClass('np-pet-button').props.onPointerMove({ ...event, clientX: 180 }); pet.render();
  assert(!pet.byClass('np-cloud'));
  pet.byClass('np-pet-button').props.onPointerUp({ ...event, clientX: 180 }); pet.render();
  pet.click('np-pet-button'); // The synthetic click at the end of a drag is ignored.
  assert(!pet.byClass('np-cloud')); assert.equal(pet.played, 1); assert.equal(pet.stopped, 0);
  pet.click('np-pet-button'); assert(pet.byClass('np-balance'));
  pet.byClass('np-pet-button').props.onContextMenu({ clientX: 100, clientY: 200, preventDefault() {}, stopPropagation() {} }); pet.render();
  assert(!pet.byClass('np-cloud')); assert(pet.byClass('np-context-menu'));
});

test('stopping during the half-second lead-in cancels the future sound and a fresh click gets a fresh delay', t => {
  const pet = harness(t);
  pet.click('np-pet-button'); t.mock.timers.tick(250);
  pet.click('np-pet-button');
  t.mock.timers.tick(2000); pet.render();
  assert.equal(pet.played, 0);
  assert.doesNotMatch(pet.byClass('np-pet-button').props['aria-label'], /正在/);
  pet.click('np-pet-button'); t.mock.timers.tick(499); assert.equal(pet.played, 0);
  t.mock.timers.tick(1); assert.equal(pet.played, 1);
  pet.click('np-pet-button'); assert.equal(pet.stopped, 1);
});
