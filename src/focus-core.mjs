/** A persisted deadline clock: background throttling never changes its duration. */
export function createFocusClock(storage, options = {}) {
  const key = 'dsh.naiwa-focus.v1', now = options.now || Date.now, listeners = new Set();
  const day = time => new Date(time + 28800000).toISOString().slice(0, 10);
  const minutes = (value, fallback, max) => Number.isFinite(value) ? Math.max(1, Math.min(max, Math.round(value))) : fallback;
  let state = { phase: 'focus', running: false, deadline: 0, remaining: 1500000, focusMinutes: 25, breakMinutes: 5, completed: 0, date: day(now()), notice: null }, warning = '', snapshot, disposed = false;
  try {
    const saved = JSON.parse(storage?.getItem(key) || 'null');
    if (saved && typeof saved === 'object') {
      const phase = saved.phase === 'break' ? 'break' : 'focus';
      const focusMinutes = minutes(saved.focusMinutes, 25, 180), breakMinutes = minutes(saved.breakMinutes, 5, 60), duration = (phase === 'focus' ? focusMinutes : breakMinutes) * 60000;
      state = { phase, focusMinutes, breakMinutes, running: saved.running === true && Number.isFinite(saved.deadline) && saved.deadline > 0 && saved.deadline <= now() + duration + 1000, deadline: Number.isFinite(saved.deadline) ? saved.deadline : 0, remaining: Number.isFinite(saved.remaining) ? Math.max(0, Math.min(duration, saved.remaining)) : duration, completed: Number.isFinite(saved.completed) ? Math.max(0, Math.min(999, Math.floor(saved.completed))) : 0, date: saved.date === day(now()) ? saved.date : day(now()), notice: saved.notice && ['focus', 'break'].includes(saved.notice.finished) && Number.isFinite(saved.notice.id) ? { id: saved.notice.id, finished: saved.notice.finished } : null };
      if (saved.date !== day(now())) state.completed = 0;
    }
  } catch { warning = '计时存档暂时无法读取。'; }
  const duration = () => (state.phase === 'focus' ? state.focusMinutes : state.breakMinutes) * 60000;
  const emit = () => { snapshot = { ...state, duration: duration(), warning }; for (const fn of listeners) fn(); };
  const save = () => { try { storage?.setItem(key, JSON.stringify(state)); warning = ''; } catch { warning = '计时仍在进行，本机存档暂未保存。'; } emit(); };
  const tick = () => {
    if (disposed) return;
    let changed = false;
    if (state.date !== day(now())) { state = { ...state, date: day(now()), completed: 0 }; changed = true; }
    if (!state.running) { if (changed) save(); return; }
    const remaining = Math.max(0, Math.ceil((state.deadline - now()) / 1000) * 1000);
    if (!remaining) {
      const finished = state.phase, completed = state.completed + (finished === 'focus' && day(state.deadline) === day(now()) ? 1 : 0);
      state = { ...state, phase: finished === 'focus' ? 'break' : 'focus', running: false, deadline: 0, completed, notice: { id: Math.max(now(), (state.notice?.id || 0) + 1), finished } };
      state.remaining = duration(); save();
    } else if (remaining !== state.remaining || changed) { state = { ...state, remaining }; emit(); }
  };
  emit(); tick();
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => snapshot, tick,
    start() { if (disposed) return; tick(); if (state.running) return; state = { ...state, notice: null, running: true, remaining: state.remaining || duration(), deadline: now() + (state.remaining || duration()) }; save(); },
    pause() { if (disposed) return; tick(); if (!state.running) return; state = { ...state, running: false, deadline: 0, remaining: Math.max(0, state.deadline - now()) }; save(); },
    reset() { if (disposed) return; state = { ...state, running: false, deadline: 0, notice: null, remaining: duration() }; save(); },
    select(phase) { if (disposed || !['focus', 'break'].includes(phase)) return; state = { ...state, phase, running: false, deadline: 0, notice: null }; state.remaining = duration(); save(); },
    configure(patch) { if (disposed || state.running) return; state = { ...state, focusMinutes: minutes(patch.focusMinutes, state.focusMinutes, 180), breakMinutes: minutes(patch.breakMinutes, state.breakMinutes, 60), notice: null }; state.remaining = duration(); save(); },
    dismiss() { if (disposed) return; state = { ...state, notice: null }; save(); },
    dispose() { disposed = true; listeners.clear(); }
  };
}
