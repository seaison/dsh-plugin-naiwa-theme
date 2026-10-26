import test from 'node:test';
import assert from 'node:assert/strict';
import { peakInfo, createMergeGame, createJigsaw, jigsawPath, placeJigsawPiece, placePetMenu } from '../src/game-core.mjs';

test('pricing clock follows Beijing boundaries, weekends and holidays', () => {
  const info = text => peakInfo(Date.parse(text));
  assert.equal(info('2026-10-26T08:59:59+08:00').peak, false);
  assert.equal(info('2026-10-26T09:00:00+08:00').peak, true);
  assert.equal(info('2026-10-26T12:00:00+08:00').peak, false);
  assert.equal(info('2026-10-26T14:00:00+08:00').peak, true);
  assert.equal(info('2026-10-26T18:00:00+08:00').peak, false);
  assert.equal(info('2026-10-25T10:00:00+08:00').peak, false);
  assert.equal(info('2026-10-01T10:00:00+08:00').peak, false);
  assert.equal(info('2026-10-10T10:00:00+08:00').peak, false);
  assert.equal(new Date(info('2026-10-26T10:00:00+08:00').next).toISOString(), '2026-10-26T04:00:00.000Z');
  assert.equal(new Date(info('2026-10-30T18:00:00+08:00').next).toISOString(), '2026-11-02T01:00:00.000Z');
  assert.equal(peakInfo(Date.parse('2027-02-08T10:00:00+08:00'), ['2027-02-08']).peak, false);
});

test('equal frogs merge once per step, score correctly and retain the next-level body', () => {
  const game = createMergeGame(() => 0);
  game.state.items = [game.spawn(1, 150, 450), game.spawn(1, 174, 450), game.spawn(1, 192, 450)];
  game.step(1 / 90);
  assert.equal(game.state.items.length, 2);
  assert.equal(game.state.items.filter(b => b.level === 2).length, 1);
  assert.equal(game.state.score, 40);
  assert.equal(game.state.maxLevel, 2);
});

test('drop cooldown, wall bounds, win state and restart are enforced', () => {
  const game = createMergeGame(() => 0);
  assert(game.drop(-999)); assert(!game.drop(180));
  for (let i = 0; i < 100; i++) game.step(1 / 90);
  assert(game.drop(999));
  for (let i = 0; i < 400; i++) game.step(1 / 90);
  for (const b of game.state.items) { assert(b.x >= b.r - 0.01); assert(b.x <= 360 - b.r + 0.01); assert(b.y <= 500 - b.r + 0.01); }
  game.state.items = [game.spawn(9, 120, 360), game.spawn(9, 235, 360)];
  game.step(1 / 90);
  assert.equal(game.state.won, true);
  assert.equal(game.state.items[0].level, 10);
  game.reset(); assert.equal(game.state.score, 0); assert.equal(game.state.items.length, 0); assert.equal(game.state.won, false);
});

test('a settled stack above the limit ends the game and stops subsequent drops', () => {
  const game = createMergeGame(() => 0);
  // A dense, supported vertical stack reaches the danger zone.
  game.state.time = 10;
  game.state.items = Array.from({ length: 7 }, (_, i) => game.spawn(5 + i % 2, 180, 500 - 48 - i * 88));
  for (const b of game.state.items) b.born = 0;
  for (let i = 0; i < 900 && !game.state.over; i++) game.step(1 / 90);
  assert(game.state.over);
  assert(!game.drop(180));
});


test('jigsaw pieces start scattered, have matching tabs and can all snap into one image', () => {
  for (const size of [3, 4, 5]) {
    const pieces = createJigsaw(size, () => .37);
    assert.equal(pieces.length, size * size);
    assert(pieces.every(p => !p.placed));
    assert(new Set(pieces.map(p => `${p.x},${p.y}`)).size === pieces.length);
    for (const p of pieces) {
      assert(jigsawPath(p).startsWith('M 0 0'));
      assert(jigsawPath(p).endsWith(' Z'));
      if (p.row) assert.equal(p.edges[0], -pieces[p.id - size].edges[2]);
      else assert.equal(p.edges[0], 0);
      if (p.col) assert.equal(p.edges[3], -pieces[p.id - 1].edges[1]);
      else assert.equal(p.edges[3], 0);
      if (p.row === size - 1) assert.equal(p.edges[2], 0);
      if (p.col === size - 1) assert.equal(p.edges[1], 0);
      const placed = placeJigsawPiece(p, 270 + p.col * p.cell + 5, 110 + p.row * p.cell - 4);
      assert.equal(placed.placed, true);
      assert.equal(placed.x, 270 + p.col * p.cell);
      assert.equal(placed.y, 110 + p.row * p.cell);
      assert.equal(placed.rotation, 0);
      assert.equal(placeJigsawPiece(placed, 30, 30), placed);
    }
    const wrong = placeJigsawPiece(pieces[0], 850, 590);
    assert.equal(wrong.placed, false);
    assert(wrong.x + wrong.cell <= 960 && wrong.y + wrong.cell <= 680);
  }
});

test('unequal fast falling frogs collide and remain supported instead of passing through', () => {
  const game = createMergeGame(() => 0);
  const bottom = game.spawn(5, 180, 452), top = game.spawn(2, 183, 280);
  top.vy = 1400; game.state.items = [bottom, top];
  for (let i = 0; i < 400; i++) game.step(1 / 30);
  assert.equal(game.state.items.length, 2);
  assert(top.y < bottom.y - 50);
  assert(Math.hypot(top.x - bottom.x, top.y - bottom.y) >= top.r + bottom.r - .1);
  assert(Math.abs(top.vy) < 1);
  assert.equal(game.state.score, 0);
});

test('mixed-size pile resolves contacts and walls without persistent overlaps', () => {
  const game = createMergeGame(() => 0);
  game.state.items = [game.spawn(3, 85, 460), game.spawn(4, 160, 461), game.spawn(5, 240, 452), game.spawn(0, 90, 350), game.spawn(1, 180, 300), game.spawn(2, 230, 280)];
  for (let i = 0; i < 1200; i++) game.step(1 / 60);
  for (const a of game.state.items) {
    assert(a.x >= a.r && a.x <= 360 - a.r && a.y <= 500 - a.r);
    for (const b of game.state.items) if (a.id !== b.id) assert(Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r - .1);
  }
});


test('context menu flips near window edges and avoids covering the pet', () => {
  const box = { width: 248, height: 310 }, viewport = { width: 1280, height: 800 };
  for (const pet of [
    { left: 1120, top: 630, right: 1260, bottom: 770 },
    { left: 190, top: 170, right: 330, bottom: 310 },
    { left: 620, top: 400, right: 760, bottom: 540 }
  ]) {
    const anchor = { x: (pet.left + pet.right) / 2, y: (pet.top + pet.bottom) / 2 };
    const p = placePetMenu(anchor, pet, viewport, box);
    assert(p.left >= 12 && p.top >= 12);
    assert(p.left + box.width <= 1268 && p.top + box.height <= 788);
    assert(p.left + box.width <= pet.left || p.left >= pet.right || p.top + box.height <= pet.top || p.top >= pet.bottom);
  }
});
