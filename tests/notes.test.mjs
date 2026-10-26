import test from 'node:test';
import assert from 'node:assert/strict';
import { createNoteStore, placeStickyNote } from '../src/notes-core.mjs';
import { createNotes } from '../src/notes.mjs';

function memory(initial) {
  const values = new Map([['dsh.naiwa-museum.v1', 'theme-untouched']]);
  if (initial) values.set('dsh.naiwa-notes.v1', initial);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('note text and position survive reload independently of theme preferences', () => {
  const storage = memory(), store = createNoteStore(storage);
  const id = store.add({ x: 380, y: 140 });
  const text = '今日灵感\n慢慢来，奶蛙会陪你完成。\n<script>只作为便签文字</script>';
  store.update(id, { text, x: 600, y: 300 });
  const restored = createNoteStore(storage).getSnapshot().notes[0];
  assert.deepEqual(restored, { id, text, x: 600, y: 300, pinned: false, hidden: false });
  assert.equal(storage.values.get('dsh.naiwa-museum.v1'), 'theme-untouched');
});

test('pinning rejects moves while editing and unpinning restores movement', () => {
  const storage = memory(), store = createNoteStore(storage), id = store.add({ x: 400, y: 180 });
  store.update(id, { pinned: true });
  store.update(id, { x: 800, y: 500, text: '固定位置仍能编辑和复制。' });
  let note = createNoteStore(storage).getSnapshot().notes[0];
  assert.equal(note.x, 400); assert.equal(note.y, 180); assert.equal(note.pinned, true);
  assert.equal(note.text, '固定位置仍能编辑和复制。');
  store.update(id, { pinned: false }); store.update(id, { x: 800, y: 500 });
  note = store.getSnapshot().notes[0]; assert.equal(note.x, 800); assert.equal(note.y, 500);
});

test('closing archives the note and restoring brings back all saved content and pin state', () => {
  const storage = memory(), store = createNoteStore(storage), id = store.add();
  store.update(id, { text: '收起也不丢失', pinned: true });
  store.hide(id);
  const next = createNoteStore(storage);
  assert.equal(next.getSnapshot().notes[0].hidden, true);
  next.restoreHidden();
  assert.equal(next.getSnapshot().notes[0].hidden, false);
  assert.equal(next.getSnapshot().notes[0].pinned, true);
  assert.equal(next.getSnapshot().notes[0].text, '收起也不丢失');
});

test('notes remain inside resized windows even with saved positions beyond their edges', () => {
  for (const width of [320, 620, 1440]) for (const height of [360, 900]) for (const x of [-500, 0, 8000]) for (const y of [-500, 120, 8000]) {
    const note = placeStickyNote({ x, y }, { width, height });
    assert(note.x >= 12 && note.y >= 12);
    assert(note.x + note.width <= width - 12);
    assert(note.y + note.height <= height - 12);
  }
});

test('damaged storage is bounded, save failures preserve edits, and disposal stops later writes', () => {
  const data = [{ id: 'a', text: '蛙'.repeat(11000), x: Infinity, y: -800 }, { id: 'a', text: 'duplicate' }, { id: '../bad' }];
  const storage = memory(JSON.stringify(data)), store = createNoteStore(storage);
  assert.equal(store.getSnapshot().notes.length, 1);
  assert.equal(store.getSnapshot().notes[0].text.length, 10000);
  assert.equal(store.getSnapshot().notes[0].x, 350); assert.equal(store.getSnapshot().notes[0].y, 0);
  storage.setItem = () => { throw new Error('full'); };
  store.update('a', { text: '这段文字仍保留在当前界面' });
  assert.equal(store.getSnapshot().notes[0].text, '这段文字仍保留在当前界面');
  assert.match(store.getSnapshot().warning, /暂未保存/);
  const snapshot = store.getSnapshot(); store.dispose(); store.update('a', { text: 'late' }); store.add();
  assert.equal(store.getSnapshot(), snapshot);
});

test('new notes start at the upper right and cascade left and down without moving saved notes', t => {
  const previous = globalThis.window; globalThis.window = { innerWidth: 1440, innerHeight: 900 };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  const store = createNoteStore(memory()); store.add(); store.add();
  const notes = store.getSnapshot().notes;
  assert.equal(notes[0].x, 1132); assert.equal(notes[0].y, 112);
  assert.equal(notes[1].x, 1108); assert.equal(notes[1].y, 136);
  assert.equal(notes[0].x, 1132);
});

test('dragging then pinning commits the visible position even before pointer-up or the save delay', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const oldWindow = globalThis.window; globalThis.window = { innerWidth: 1440, innerHeight: 900 };
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; });
  const storage = memory(), store = createNoteStore(storage); store.add({ x: 400, y: 180 });
  let states = [], refs = [], stateIndex = 0, refIndex = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(value) { const i = stateIndex++; if (!(i in states)) states[i] = value; return [states[i], update => { states[i] = typeof update === 'function' ? update(states[i]) : update; }]; },
    useRef(value) { const i = refIndex++; return refs[i] ||= { current: value }; },
    useEffect() {}, useSyncExternalStore: (_subscribe, get) => get()
  };
  const Overlay = createNotes(React, { notes: store }, 'frog.svg', { placeStickyNote });
  const child = Overlay().children[0][0]; states = []; refs = [];
  let tree;
  const render = () => { stateIndex = 0; refIndex = 0; tree = child.type({ ...child.props, note: store.getSnapshot().notes[0] }); };
  render();
  const pointer = { button: 0, pointerId: 1, clientX: 100, clientY: 100, target: { closest: () => null }, currentTarget: { setPointerCapture() {} }, preventDefault() {} };
  tree.children[0].props.onPointerDown(pointer);
  tree.children[0].props.onPointerMove({ ...pointer, clientX: 300, clientY: 220 }); render();
  assert.equal(tree.props.style.left, 600); assert.equal(tree.props.style.top, 300);
  assert.equal(store.getSnapshot().notes[0].x, 400);
  tree.children[2].children[0].props.onClick(); render();
  assert.equal(tree.props.style.left, 600); assert.equal(tree.props.style.top, 300);
  let saved = createNoteStore(storage).getSnapshot().notes[0];
  assert.equal(saved.x, 600); assert.equal(saved.y, 300); assert.equal(saved.pinned, true);
  tree.children[2].children[0].props.onClick(); render();
  tree.children[0].props.onPointerDown(pointer);
  tree.children[0].props.onPointerMove({ ...pointer, clientX: 400, clientY: 200 }); render();
  t.mock.timers.tick(120);
  saved = createNoteStore(storage).getSnapshot().notes[0];
  assert.equal(saved.x, 900); assert.equal(saved.y, 400);
});
