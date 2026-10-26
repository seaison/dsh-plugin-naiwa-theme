import test from 'node:test';
import assert from 'node:assert/strict';
import { createFocusClock } from '../src/focus-core.mjs';

function fixture() {
  let clock = Date.parse('2026-10-26T02:00:00Z'), value;
  const storage = { getItem: () => value, setItem: (_key, next) => { value = next; } };
  const options = { now: () => clock };
  return { storage, options, advance(ms) { clock += ms; }, create: () => createFocusClock(storage, options) };
}

test('focus deadlines survive reload and only complete once after a delayed background tick', () => {
  const f = fixture(), clock = f.create();
  clock.configure({ focusMinutes: 1, breakMinutes: 1 }); clock.start();
  f.advance(20000); clock.tick(); assert.equal(clock.getSnapshot().remaining, 40000);
  const reloaded = f.create(); assert.equal(reloaded.getSnapshot().remaining, 40000);
  f.advance(120000); reloaded.tick();
  let state = reloaded.getSnapshot();
  assert.equal(state.running, false); assert.equal(state.phase, 'break'); assert.equal(state.completed, 1);
  assert.equal(state.notice.finished, 'focus'); assert.equal(state.remaining, 60000);
  reloaded.tick(); assert.equal(reloaded.getSnapshot().completed, 1);
  reloaded.start(); assert.equal(reloaded.getSnapshot().notice, null);
  f.advance(60000); reloaded.tick(); state = reloaded.getSnapshot();
  assert.equal(state.phase, 'focus'); assert.equal(state.notice.finished, 'break'); assert.equal(state.completed, 1);
});

test('pause preserves exact remaining time, reset and manual switching never count a completed focus', () => {
  const f = fixture(), clock = f.create(); clock.start();
  f.advance(1250); clock.pause(); const remaining = clock.getSnapshot().remaining;
  assert.equal(remaining, 1498750);
  f.advance(3600000); clock.tick(); assert.equal(clock.getSnapshot().remaining, remaining);
  clock.start(); f.advance(5000); clock.pause(); assert.equal(clock.getSnapshot().remaining, remaining - 5000);
  clock.reset(); assert.equal(clock.getSnapshot().remaining, 1500000);
  clock.select('break'); assert.equal(clock.getSnapshot().remaining, 300000); assert.equal(clock.getSnapshot().completed, 0);
});

test('configuration is bounded, running durations stay stable, and dismissal retains the next segment', () => {
  const f = fixture(), clock = f.create();
  clock.configure({ focusMinutes: 0, breakMinutes: 1000 });
  assert.equal(clock.getSnapshot().focusMinutes, 1); assert.equal(clock.getSnapshot().breakMinutes, 60);
  clock.start(); clock.configure({ focusMinutes: 90 }); assert.equal(clock.getSnapshot().focusMinutes, 1);
  f.advance(60000); clock.tick(); clock.dismiss();
  assert.equal(clock.getSnapshot().notice, null); assert.equal(clock.getSnapshot().phase, 'break');
  assert.equal(clock.getSnapshot().remaining, 3600000);
});

test('daily counts use Beijing dates and an old suspended deadline is not counted today', () => {
  const f = fixture(), clock = f.create(); clock.configure({ focusMinutes: 1 }); clock.start();
  f.advance(60000); clock.tick(); assert.equal(clock.getSnapshot().completed, 1);
  clock.start(); f.advance(86400000); clock.tick();
  assert.equal(clock.getSnapshot().completed, 0);
  assert.equal(clock.getSnapshot().date, '2026-10-27');
});

test('storage failures preserve the live timer and disposed clocks stop later updates', () => {
  const f = fixture(), clock = f.create(); f.storage.setItem = () => { throw new Error('full'); };
  clock.start(); assert.equal(clock.getSnapshot().running, true); assert.match(clock.getSnapshot().warning, /暂未保存/);
  const state = clock.getSnapshot(); clock.dispose(); f.advance(2000000); clock.tick(); clock.reset(); clock.start();
  assert.equal(clock.getSnapshot(), state);
});
