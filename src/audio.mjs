/** One local audio clip, with cancellable playback and a short exit fade. */
export function createAudioClip(src, options = {}) {
  const node = options.element || new (options.Audio || globalThis.Audio)(src);
  const frame = options.requestFrame || globalThis.requestAnimationFrame;
  const cancel = options.cancelFrame || globalThis.cancelAnimationFrame;
  const now = options.now || (() => performance.now());
  const bounded = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  let disposed = false, revision = 0, fading = null, frameId = null, volume = 1;
  node.preload = 'auto';
  const clearFade = () => { if (frameId !== null) cancel(frameId); frameId = null; fading = null; };
  const stop = () => { revision++; clearFade(); node.pause(); try { node.currentTime = 0; } catch {} };
  const state = value => { if (!disposed) options.onState?.(value); };
  node.onended = () => { clearFade(); state('ended'); };
  node.onerror = () => { revision++; clearFade(); node.pause(); options.onError?.(node.error); state('error'); };
  return {
    async play({ volume: level = volume, offset = 0, fadeIn = 0 } = {}) {
      if (disposed) return false;
      const request = ++revision; clearFade(); volume = bounded(level); node.volume = fadeIn > 0 ? 0 : volume;
      try {
        node.currentTime = Math.max(0, Number.isFinite(offset) ? offset : 0);
        await node.play();
        if (disposed || request !== revision) return false;
        if (fadeIn > 0) {
          const start = now(); fading = { gain: 0 };
          const tick = () => {
            if (disposed || request !== revision || !fading) return;
            const progress = Math.min(1, Math.max(0, (now() - start) / fadeIn));
            fading.gain = progress * progress * (3 - 2 * progress);
            node.volume = volume * fading.gain;
            if (progress < 1) frameId = frame(tick);
            else { frameId = null; fading = null; }
          };
          frameId = frame(tick);
        }
        state('playing'); return true;
      } catch (error) {
        if (!disposed && request === revision) options.onError?.(error);
        if (!disposed && request === revision) state('blocked');
        return false;
      }
    },
    stop,
    setVolume(value) { volume = bounded(value); if (!disposed) node.volume = volume * (fading?.gain ?? 1); },
    fadeOut(milliseconds = 1300) {
      if (disposed) return;
      // Invalidate a pending play promise before beginning the exit transition.
      const startGain = fading?.gain ?? 1;
      revision++; clearFade();
      if (!(milliseconds > 0) || node.paused) { stop(); return; }
      const start = now(); fading = { gain: startGain };
      const tick = () => {
        if (disposed || !fading) return;
        const progress = Math.min(1, Math.max(0, (now() - start) / milliseconds));
        fading.gain = startGain * (1 - progress * progress * (3 - 2 * progress));
        node.volume = volume * fading.gain;
        if (fading.gain > 0) frameId = frame(tick);
        else { frameId = null; fading = null; node.pause(); }
      };
      frameId = frame(tick);
    },
    duration() { return node.duration; },
    dispose() { if (disposed) return; disposed = true; stop(); node.onended = null; node.onerror = null; node.removeAttribute('src'); node.load(); }
  };
}
