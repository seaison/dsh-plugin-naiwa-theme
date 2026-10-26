import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioClip } from '../src/audio.mjs';

function fixture() {
  const nodes = [], states = [], frames = new Map(); let clock = 0, serial = 0;
  class Audio {
    constructor(src) { this.src = src; this.duration = 15.696; this.paused = true; this.currentTime = 0; nodes.push(this); }
    play() { this.paused = false; return this.pending || (this.failure ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve()); }
    pause() { this.paused = true; }
    removeAttribute(name) { delete this[name]; }
    load() { this.released = true; }
  }
  const clip = createAudioClip('/local.mp3', { Audio, onState: state => states.push(state), requestFrame: fn => { frames.set(++serial, fn); return serial; }, cancelFrame: id => frames.delete(id), now: () => clock });
  return { clip, node: nodes[0], nodes, states, frames, tick(time) { clock = time; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); } };
}

test('repeated laughter restarts a single clip, obeys live volume and releases media on disposal', async () => {
  const f = fixture();
  assert.equal(await f.clip.play({ volume: .35 }), true);
  f.node.currentTime = 8;
  assert.equal(await f.clip.play({ volume: .6 }), true);
  assert.equal(f.nodes.length, 1); assert.equal(f.node.currentTime, 0); assert.equal(f.node.volume, .6);
  f.clip.setVolume(2); assert.equal(f.node.volume, 1);
  f.clip.stop(); assert.equal(f.node.paused, true); assert.equal(f.node.currentTime, 0);
  f.clip.dispose(); f.clip.dispose();
  assert.equal(f.node.released, true); assert.equal(f.node.onended, null); assert.equal(f.node.src, undefined);
  assert.equal(await f.clip.play(), false);
});

test('autoplay rejection is recoverable with a later user gesture', async () => {
  const f = fixture(); f.node.failure = true;
  assert.equal(await f.clip.play(), false); assert.deepEqual(f.states, ['blocked']);
  f.node.failure = false;
  assert.equal(await f.clip.play({ offset: 3 }), true); assert.equal(f.node.currentTime, 3);
  f.node.onended(); assert.deepEqual(f.states, ['blocked', 'playing', 'ended']);
});

test('late playback completion cannot update a stopped or disposed player', async () => {
  for (const action of ['stop', 'dispose', 'fadeOut']) {
    const f = fixture(); let complete;
    f.node.pending = new Promise(resolve => { complete = resolve; });
    const playing = f.clip.play(); f.clip[action](); complete();
    assert.equal(await playing, false); assert.deepEqual(f.states, []);
    f.clip.dispose(); assert.equal(f.frames.size, 0);
  }
});

test('startup piano fades through the transition, supports a volume change, and pauses at silence', async () => {
  const f = fixture(); await f.clip.play({ volume: .42 }); f.clip.fadeOut(1300);
  f.tick(650); assert.equal(f.node.volume, .21); assert.equal(f.node.paused, false);
  f.clip.setVolume(.2); assert.equal(f.node.volume, .1);
  f.tick(1300); assert.equal(f.node.volume, 0); assert.equal(f.node.paused, true); assert.equal(f.frames.size, 0);
  await f.clip.play({ volume: .42 }); assert.equal(f.node.volume, .42);
  f.clip.fadeOut(0); assert.equal(f.node.paused, true);
  f.clip.dispose();
});

test('a mounted audio element can be reused without constructing detached media', async () => {
  const f = fixture();
  const clip = createAudioClip('/local.mp3', { element: f.node });
  assert.equal(await clip.play({ volume: .35 }), true);
  assert.equal(f.node.volume, .35); assert.equal(f.nodes.length, 1);
  clip.dispose(); assert.equal(f.node.paused, true); assert.equal(f.node.released, true);
});

test('piano fades in from silence and a mid-attack exit never jumps to full volume', async () => {
  const f = fixture(); await f.clip.play({ volume: .42, fadeIn: 1100 });
  assert.equal(f.node.currentTime, 0); assert.equal(f.node.volume, 0);
  f.tick(550); assert.equal(f.node.volume, .21);
  f.clip.fadeOut(1300); assert.equal(f.node.volume, .21);
  f.tick(1200); assert.equal(f.node.volume, .105);
  f.tick(1850); assert.equal(f.node.volume, 0); assert.equal(f.node.paused, true); assert.equal(f.frames.size, 0);
  f.clip.dispose();
});
