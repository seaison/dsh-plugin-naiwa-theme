import test from 'node:test';
import assert from 'node:assert/strict';
import { FROG_QUOTES, pickFrogQuote, startupTiming } from '../src/experience-core.mjs';
import { inspectWallpaper } from '../src/media.mjs';

test('wisdom choices do not immediately repeat and every quote remains reachable', () => {
  assert.equal(new Set(FROG_QUOTES).size, 36);
  for (let previous = -1; previous < FROG_QUOTES.length; previous++) {
    const seen = new Set();
    for (let i = 0; i < 360; i++) {
      const next = pickFrogQuote(previous, FROG_QUOTES.length, () => i / 360);
      assert(next >= 0 && next < FROG_QUOTES.length && next !== previous); seen.add(next);
    }
    assert.equal(seen.size, previous === -1 ? 36 : 35);
  }
});

test('0.6x film lasts 8.4 seconds with a 1.3-second exit, and invalid timing is bounded', () => {
  const t = startupTiming(5.042, .6);
  assert(Math.abs(t.total - 8.4033) < .001);
  assert(Math.abs((5.042 - t.transitionAt) / t.rate - 1.3) < .001);
  assert.equal(startupTiming(Infinity, 0).rate, .6);
  assert(startupTiming(200, .5).guard <= 35000);
});

test('wallpaper input rejects unsupported, empty and oversized files before decoding', async () => {
  for (const file of [null, new Blob(['<svg/>'], { type: 'image/svg+xml' }), new Blob([], { type: 'image/png' }), { type: 'image/png', size: 21 * 1024 * 1024 }]) await assert.rejects(inspectWallpaper(file), /20 MB/);
});

test('startup characters finish revealing before motion and exit at every supported speed', () => {
  for (const rate of [.5, .6, .75, 1]) {
    const timing = startupTiming(5.042, rate), beforeExit = timing.total - timing.transition;
    assert(timing.captionTravel > 0 && timing.captionTravel < beforeExit);
    assert(timing.captionReveal > 0 && timing.captionReveal < timing.captionTravel);
    assert(beforeExit - timing.captionTravel > 1);
  }
  const normal = startupTiming(5.042, .6);
  assert(normal.captionTravel > 4.5 && normal.captionTravel < 5);
  assert(startupTiming(5.042, 1).captionTravel < normal.captionTravel);
});
