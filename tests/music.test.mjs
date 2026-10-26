import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameMusic } from '../src/music.mjs';

function fixture(kind) {
  const contexts = [], intervals = new Set(), states = [], tones = [];
  class Context {
    constructor() { this.currentTime = 0; this.state = 'suspended'; this.destination = {}; contexts.push(this); }
    createGain() { return { connect() {}, disconnect() {}, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(value) { this.value = value; } } }; }
    createOscillator() { const node = { frequency: { value: 0 }, connect() {}, disconnect() { this.disconnected = true; }, start(time) { this.started = time; }, stop(time) { this.stopped = time; } }; tones.push(node); return node; }
    resume() { if (this.blocked) return Promise.reject(new Error('autoplay')); this.state = 'running'; return this.pending || Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  const player = createGameMusic(kind, { AudioContext: Context, onState: state => states.push(state), setInterval: fn => { intervals.add(fn); return fn; }, clearInterval: fn => intervals.delete(fn) });
  return { player, contexts, tones, states, intervals, tick(seconds) { contexts[0].currentTime = seconds; for (const fn of intervals) fn(); } };
}

test('each game has a distinct repeating score, one player and audio-clock scheduling', async () => {
  const melodies = [];
  for (const kind of ['puzzle', 'merge']) {
    const f = fixture(kind);
    const first = f.player.play(); const second = f.player.play();
    assert.equal(first, second); assert.equal(await first, true);
    assert.equal(f.contexts.length, 1); assert.equal(f.intervals.size, 1);
    melodies.push(f.tones[0].frequency.value);
    for (let time = .1; time <= 110; time += .1) {
      f.tick(time);
      for (const node of f.tones) if (!node.disconnected && node.stopped <= time) node.onended?.();
    }
    assert(f.tones.length > 500);
    assert(f.tones.filter(node => !node.disconnected).length < 50);
    const before = f.tones.length;
    f.tick(200); // A delayed timer should not replay all the missed bars.
    assert(f.tones.length - before < 20);
    assert(f.tones.slice(before).every(node => node.started >= 200));
    f.player.dispose(); assert.equal(f.contexts[0].state, 'closed'); assert.equal(f.intervals.size, 0);
    assert(f.tones.every(node => node.disconnected));
    assert.equal(await f.player.play(), false);
  }
  assert.notEqual(melodies[0], melodies[1]);
});

test('pause stops all voices and scheduling, while resume reuses its context', async () => {
  const f = fixture('puzzle');
  await f.player.play({ volume: .22 });
  f.player.pause();
  assert.equal(f.contexts[0].state, 'suspended'); assert.equal(f.intervals.size, 0);
  assert(f.tones.every(node => node.disconnected));
  assert.equal(await f.player.play({ volume: .4 }), true);
  assert.equal(f.contexts.length, 1); assert.equal(f.intervals.size, 1);
  f.player.setVolume(5); f.player.setVolume(-1);
  f.player.dispose(); f.player.dispose();
  assert.deepEqual(f.states, ['playing', 'paused', 'playing']);
});

test('late resume completion cannot revive a paused or closed game', async () => {
  for (const action of ['pause', 'dispose']) {
    const f = fixture('merge'); await f.player.play(); f.player.pause();
    let resolve; f.contexts[0].pending = new Promise(done => { resolve = done; });
    const playing = f.player.play(); f.player[action](); resolve();
    assert.equal(await playing, false); assert.equal(f.intervals.size, 0);
    assert.notEqual(f.states.at(-1), 'playing'); f.player.dispose();
  }
});

test('autoplay failure can be retried by the play button', async () => {
  const f = fixture('puzzle'); await f.player.play(); f.player.pause(); f.contexts[0].blocked = true;
  assert.equal(await f.player.play(), false); assert.equal(f.states.at(-1), 'blocked');
  assert.equal(f.intervals.size, 0);
  f.contexts[0].blocked = false;
  assert.equal(await f.player.play(), true); assert.equal(f.intervals.size, 1); f.player.dispose();
});
