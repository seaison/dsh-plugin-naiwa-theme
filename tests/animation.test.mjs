import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keySpriteBackground, spriteFrameAt } from '../src/animation-core.mjs';

test('the canvas matte clears the border and keeps isolated white teeth and the yellow body', () => {
  const width = 7, height = 7, pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  const at = (x, y) => (y * width + x) * 4;
  for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) pixels.set([240, 190, 60, 255], at(x, y));
  pixels.set([255, 255, 255, 255], at(3, 3));
  keySpriteBackground(pixels, width, height, 7, 7, 1, 1);
  assert.equal(pixels[at(0, 0) + 3], 0); assert.equal(pixels[at(1, 3) + 3], 0);
  assert.deepEqual([...pixels.slice(at(2, 3), at(2, 3) + 4)], [240, 190, 60, 255]);
  assert.equal(pixels[at(3, 3) + 3], 255);
});

test('matte flood fills each frame independently and leaves unused atlas cells untouched', () => {
  const pixels = new Uint8ClampedArray(9 * 3 * 4).fill(255);
  pixels.set([210, 170, 50, 255], (1 * 9 + 1) * 4);
  pixels.set([210, 170, 50, 255], (1 * 9 + 4) * 4);
  keySpriteBackground(pixels, 9, 3, 3, 3, 3, 2);
  assert.equal(pixels[(1 * 9 + 1) * 4 + 3], 255);
  assert.equal(pixels[(1 * 9 + 4) * 4 + 3], 255);
  assert.equal(pixels[(0 * 9 + 3) * 4 + 3], 0);
  assert.equal(pixels[(0 * 9 + 6) * 4 + 3], 255);
});

test('the light outer edge is softened without changing solid yellow pixels', () => {
  const pixels = new Uint8ClampedArray(5 * 5 * 4).fill(255);
  pixels.set([252, 240, 218, 255], (2 * 5 + 2) * 4);
  keySpriteBackground(pixels, 5, 5, 5, 5, 1, 1);
  const index = (2 * 5 + 2) * 4;
  assert(pixels[index + 3] > 0 && pixels[index + 3] < 255);
  assert(pixels[index + 2] < 218);
});

test('the user GIF keeps all 80 timings, starts at the lead-in and loops only the laugh', () => {
  const animation = JSON.parse(readFileSync(new URL('../media/pet-laugh-animation.json', import.meta.url)));
  assert.equal(animation.frames, 80); assert.equal(animation.durations.length, 80);
  assert.equal(animation.durations.reduce((a, b) => a + b, 0), 5340);
  assert.equal(spriteFrameAt(animation, 0), 32);
  assert.equal(spriteFrameAt(animation, animation.durations[32]), 33);
  assert.equal(spriteFrameAt(animation, animation.introMs - 1), 79);
  assert.equal(spriteFrameAt(animation, animation.introMs), 40);
  const loopMs = animation.durations.slice(40).reduce((a, b) => a + b, 0);
  assert.equal(spriteFrameAt(animation, animation.introMs + loopMs), 40);
  for (let ms = animation.introMs; ms < 16000; ms += 37) assert(spriteFrameAt(animation, ms) >= 40);
});
