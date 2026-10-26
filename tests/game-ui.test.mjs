import test from 'node:test';
import assert from 'node:assert/strict';
import { createPetFeatures } from '../src/pet.mjs';
import { createJigsaw, jigsawPath, placeJigsawPiece } from '../src/game-core.mjs';
import { placePetCloud, nextPetReaction } from '../src/pet-core.mjs';

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const child of node) { const found = find(child, predicate); if (found) return found; } return null; }
  if (predicate(node)) return node;
  return find(node.children, predicate);
}
const byClass = (tree, name) => find(tree, node => node.props?.className?.split(' ').includes(name));

test('the puzzle opens, switches pictures, places a dragged piece and cleans up its BGM', t => {
  const old = { window: globalThis.window, DOMPoint: globalThis.DOMPoint, document: globalThis.document };
  globalThis.window = { innerWidth: 1440, innerHeight: 900 };
  globalThis.DOMPoint = class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform() { return this; } };
  t.after(() => { for (const [name, value] of Object.entries(old)) { if (value === undefined) delete globalThis[name]; else globalThis[name] = value; } });
  let active;
  const React = {
    Fragment: Symbol('Fragment'), createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) { const i = active.si++; if (!(i in active.states)) active.states[i] = typeof initial === 'function' ? initial() : initial; const state = active; return [state.states[i], value => { state.states[i] = typeof value === 'function' ? value(state.states[i]) : value; }]; },
    useRef(value) { return active.refs[active.ri++] ||= { current: value }; },
    useId: () => 'jigsaw-test',
    useEffect(fn, deps) {
      if (!active.effectsEnabled) return;
      const i = active.ei++, instance = active, previous = instance.effects[i];
      if (previous && deps.every((value, j) => value === previous.deps[j])) return;
      instance.pending.push(() => { previous?.cleanup?.(); instance.effects[i] = { deps, cleanup: fn() }; });
    },
    useLayoutEffect() {}, useSyncExternalStore: (_subscribe, get) => get()
  };
  const component = (fn, effectsEnabled = false) => {
    const instance = { states: [], refs: [], effects: [], pending: [], si: 0, ri: 0, ei: 0, effectsEnabled };
    const render = () => { active = instance; instance.si = 0; instance.ri = 0; instance.ei = 0; const tree = fn(); for (const effect of instance.pending.splice(0)) effect(); return tree; };
    render.dispose = () => { for (const effect of instance.effects) effect?.cleanup?.(); };
    return render;
  };
  const prefs = { sound: false, volume: 0, petEnabled: true, bubble: true, showBalance: false, petSize: 140, holidays: '', gameMusic: true, gameVolume: 22 };
  const core = { placePetCloud, nextPetReaction, peakInfo: () => ({}), createJigsaw: n => createJigsaw(n, () => .5), jigsawPath, placeJigsawPiece };
  const assets = Object.fromEntries(['puzzle-white-ballet', 'puzzle-black-runway', 'puzzle-twin-divas'].map(id => [id, { url: '/' + id + '.png' }]));
  const { Pet } = createPetFeatures(React, assets, { subscribe() {}, getSnapshot: () => ({ prefs }), update: patch => Object.assign(prefs, patch) }, null, core);
  const renderPet = component(Pet);
  let pet = renderPet();
  byClass(pet, 'np-pet-button').props.onContextMenu({ clientX: 1000, clientY: 500, preventDefault() {}, stopPropagation() {} });
  pet = renderPet(); byClass(pet, 'np-menu-puzzle').props.onClick(); pet = renderPet();
  assert(byClass(pet, 'np-dialog-puzzle'));
  const Puzzle = byClass(pet, 'np-dialog-body').children[0].type;
  const render = component(Puzzle);
  let tree = render(); // Regression: this threw ReferenceError: duration is not defined.
  assert.match(JSON.stringify(tree), /0 次移动 · 00:00/);
  assert.equal(find(tree, node => node.type === 'svg').props['aria-label'], '白丝芭蕾蛙 3乘3散片拼图');
  const picker = byClass(tree, 'np-art-picker'); picker.children[0][1].props.onClick(); tree = render();
  assert.match(find(tree, node => node.type === 'svg').props['aria-label'], /黑丝红毯蛙/);
  const table = byClass(tree, 'np-jigsaw-table');
  table.props.ref.current = { getScreenCTM: () => ({ inverse() {} }), setPointerCapture() {} };
  const piece = core.createJigsaw(3)[0];
  const event = { button: 0, pointerId: 1, clientX: piece.x + 5, clientY: piece.y + 5, preventDefault() {}, stopPropagation() {}, currentTarget: { focus() {}, hasPointerCapture: () => true, releasePointerCapture() {} } };
  find(tree, node => node.props['aria-label'] === '拼图片块 1，可拖动').props.onPointerDown(event); tree = render();
  byClass(tree, 'np-jigsaw-table').props.onPointerMove({ ...event, clientX: 275, clientY: 115 }); tree = render();
  byClass(tree, 'np-jigsaw-table').props.onPointerUp({ ...event, clientX: 275, clientY: 115 }); tree = render();
  assert(find(tree, node => node.props['aria-label'] === '拼图片块 1，已归位'));
  assert.match(JSON.stringify(tree), /已归位 1\/9 块/);
  find(tree, node => node.type === 'select').props.onChange({ target: { value: '5' } }); tree = render();
  assert.match(JSON.stringify(tree), /已归位 0\/25 块/);
  assert.match(JSON.stringify(tree), /0 次移动 · 00:00/);
  const handlers = new Map(), calls = [];
  globalThis.document = { hidden: false, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  core.createGameMusic = (kind, options) => {
    assert.equal(kind, 'puzzle');
    return { play: ({ volume }) => { calls.push(['play', volume]); options.onState('playing'); return Promise.resolve(true); }, pause: () => { calls.push(['pause']); options.onState('paused'); }, setVolume() {}, dispose: () => calls.push(['dispose']) };
  };
  const musicNode = find(pet, node => node.type?.name === 'GameMusic');
  const renderMusic = component(() => musicNode.type(musicNode.props), true);
  renderMusic(); let music = renderMusic();
  assert.match(JSON.stringify(music), /BGM · 正在播放/);
  byClass(music, 'np-music-toggle').props.onClick(); music = renderMusic();
  assert.equal(prefs.gameMusic, false); assert.match(JSON.stringify(music), /BGM · 已暂停/);
  byClass(music, 'np-music-toggle').props.onClick(); renderMusic();
  assert.equal(prefs.gameMusic, true);
  document.hidden = true; handlers.get('visibilitychange')();
  assert.equal(calls.at(-1)[0], 'pause');
  document.hidden = false; handlers.get('visibilitychange')();
  assert.deepEqual(calls.at(-1), ['play', .22]);
  renderMusic.dispose(); assert.equal(calls.at(-1)[0], 'dispose'); assert.equal(handlers.size, 0);
});
