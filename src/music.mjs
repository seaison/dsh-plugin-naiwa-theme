/** Two original, offline game scores, scheduled on the audio clock. */
export function createGameMusic(kind, options = {}) {
  const scores = {
    puzzle: { bpm: 76, chords: [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 62]], melody: [
      [76, null, 79, 76, 74, null, 71, null], [72, null, 76, 79, 76, null, 72, null],
      [69, null, 72, 76, 74, 72, 69, null], [71, null, 74, 79, 76, null, 74, null],
      [79, null, 83, 81, 79, null, 76, null], [76, 74, 72, null, 71, null, 69, null],
      [72, null, 76, 77, 76, 72, 69, null], [71, 74, 79, null, 74, null, 72, null]
    ] },
    merge: { bpm: 108, chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]], melody: [
      [74, 78, 81, null, 78, 76, 74, null], [71, 74, 78, 81, 78, null, 74, null],
      [79, null, 78, 74, 71, 74, 78, null], [76, 73, 76, 81, 78, null, 76, null],
      [81, 83, 81, 78, 76, 78, 74, null], [78, null, 81, 78, 74, 71, 74, null],
      [79, 78, 74, null, 71, 74, 78, null], [76, 78, 81, null, 78, 76, 74, null]
    ] }
  };
  const score = scores[kind] || scores.puzzle;
  const every = options.setInterval || globalThis.setInterval, clear = options.clearInterval || globalThis.clearInterval;
  const voices = new Set();
  let context, master, timer = null, pending = null, disposed = false, running = false, revision = 0, volume = .22, step = 0, nextTime = 0;
  const report = state => { if (!disposed) options.onState?.(state); };
  const bounded = value => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const setVolume = value => {
    volume = bounded(value);
    if (master) master.gain.setTargetAtTime(volume * .8, context.currentTime, .04);
  };
  const voice = (note, time, length, level, bass = false) => {
    const envelope = context.createGain(), tone = context.createOscillator(), overtone = context.createOscillator(), mix = context.createGain();
    tone.type = 'sine'; overtone.type = 'triangle';
    tone.frequency.value = 440 * 2 ** ((note - 69) / 12);
    overtone.frequency.value = tone.frequency.value * (bass ? 1 : 2);
    mix.gain.value = bass ? .16 : kind === 'merge' ? .12 : .08;
    tone.connect(envelope); overtone.connect(mix); mix.connect(envelope); envelope.connect(master);
    envelope.gain.setValueAtTime(.0001, time);
    envelope.gain.exponentialRampToValueAtTime(level, time + .008);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + length);
    const release = () => {
      tone.onended = null;
      for (const node of [tone, overtone, mix, envelope]) node.disconnect();
      voices.delete(stop);
    };
    const stop = () => { tone.onended = null; try { tone.stop(); overtone.stop(); } catch {} release(); };
    voices.add(stop); tone.onended = release;
    for (const oscillator of [tone, overtone]) { oscillator.start(time); oscillator.stop(time + length + .02); }
  };
  const tick = () => {
    if (!running || disposed || context.state === 'suspended') return;
    const eighth = 60 / score.bpm / 2;
    // Restart the schedule after a delayed background tick; never pile up old notes.
    if (nextTime < context.currentTime - .1) nextTime = context.currentTime + .03;
    while (nextTime < context.currentTime + .14) {
      const bar = Math.floor(step / 8), beat = step % 8, chord = score.chords[bar % score.chords.length];
      const melody = score.melody[bar % score.melody.length][beat];
      if (melody !== null) voice(melody, nextTime, kind === 'merge' ? .42 : .95, kind === 'merge' ? .14 : .11);
      if (beat === 0 || beat === 4) voice(chord[0] - (beat === 4 ? 0 : 12), nextTime, eighth * 2.5, .13, true);
      if (kind === 'puzzle' && beat % 2 === 0) voice(chord[1 + beat / 2 % 3], nextTime + .02, eighth * 2.3, .055);
      if (kind === 'merge' && beat % 2 === 1) for (const note of chord.slice(1)) voice(note + 12, nextTime, .2, .045);
      step = (step + 1) % (score.melody.length * 8); nextTime += eighth;
    }
  };
  const pause = () => {
    revision++; pending = null; running = false;
    if (timer !== null) clear(timer); timer = null;
    for (const stop of [...voices]) stop();
    if (context && context.state !== 'closed') void context.suspend().catch(() => {});
    report('paused');
  };
  return {
    play({ volume: level = volume } = {}) {
      if (disposed) return Promise.resolve(false);
      setVolume(level);
      if (running) return Promise.resolve(true);
      if (pending) return pending;
      const ticket = ++revision;
      try {
        if (!context) {
          const AudioContext = options.AudioContext || globalThis.AudioContext || globalThis.webkitAudioContext;
          context = new AudioContext(); master = context.createGain(); master.gain.value = volume * .8; master.connect(context.destination);
        }
        const task = Promise.resolve(context.resume()).then(() => {
          if (disposed || ticket !== revision) return false;
          if (context.state !== 'running') { report('blocked'); return false; }
          running = true; nextTime = context.currentTime + .04; tick(); timer = every(tick, 40); report('playing'); return true;
        }).catch(() => { if (!disposed && ticket === revision) report('blocked'); return false; }).finally(() => { if (pending === task) pending = null; });
        pending = task; return task;
      } catch { report('error'); return Promise.resolve(false); }
    },
    pause, setVolume,
    dispose() { if (disposed) return; disposed = true; pause(); if (context && context.state !== 'closed') void context.close().catch(() => {}); }
  };
}
