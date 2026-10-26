import test from 'node:test';
import assert from 'node:assert/strict';
import { createFocusClock } from '../src/focus-core.mjs';
import { createFocusFeatures } from '../src/focus.mjs';

test('clock panel renders, pauses and resumes; sprites cover reading, stretch, tea and both signs', () => {
  let now = 100000;
  const clock = createFocusClock(null, { now: () => now });
  const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }), useState: value => [value, () => {}], useEffect() {}, useSyncExternalStore: (_sub, get) => get() };
  const features = createFocusFeatures(React, { focus: clock }, { 'pet-focus-states': { url: '/sprites.png' } });
  assert.match(JSON.stringify(features.Panel()), /25:00/);
  const pose = () => features.Sprite({ state: clock.getSnapshot() });
  assert.match(pose().props['aria-label'], /看书/);
  clock.start(); now += 1200; clock.tick(); clock.pause();
  assert.match(JSON.stringify(features.Panel()), /继续专注/);
  clock.select('break'); clock.start(); assert.match(pose().props['aria-label'], /伸懒腰/);
  now += 6000; clock.tick(); assert.match(pose().props['aria-label'], /喝奶茶/);
  now += 300000; clock.tick(); assert.match(pose().props['aria-label'], /举牌/);
  assert.match(JSON.stringify(pose()), /继续专注/);
  clock.select('focus'); clock.configure({ focusMinutes: 1 }); clock.start(); now += 60000; clock.tick();
  assert.match(JSON.stringify(pose()), /休息一下/);
  assert.match(JSON.stringify(features.Reminder({ state: clock.getSnapshot() })), /开始休息/);
});
