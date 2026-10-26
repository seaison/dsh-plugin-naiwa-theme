/** Focus-clock panel, activity sprites and quiet, in-app reminders. */
export function createFocusFeatures(React, controller, assets) {
  const h = React.createElement, { useState, useEffect, useSyncExternalStore } = React, clock = controller.focus;
  const useClock = () => useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getSnapshot);
  const time = remaining => { const seconds = Math.max(0, Math.ceil(remaining / 1000)); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; };
  function Sprite({ state, badge = false }) {
    const pose = state.notice ? 'sign' : state.phase === 'break' ? (Math.max(0, state.duration - state.remaining) % 60000 < 6000 ? 'stretch' : 'tea') : 'reading';
    const positions = { reading: '0% 0%', stretch: '100% 0%', tea: '0% 100%', sign: '100% 100%' };
    const descriptions = { reading: '安静看书的奶蛙', stretch: '伸懒腰的奶蛙', tea: '喝奶茶的奶蛙', sign: '举牌提醒的奶蛙' };
    return h('span', { className: `nf-character is-${pose}` + (!state.running ? ' is-paused' : ''), role: 'img', 'aria-label': descriptions[pose], style: { backgroundImage: `url("${assets['pet-focus-states']?.url || ''}")`, backgroundPosition: positions[pose] } },
      pose === 'sign' ? h('span', { className: 'nf-sign-text' }, state.notice.finished === 'focus' ? '休息一下' : '继续专注') : null,
      badge && !state.notice ? h('span', { className: 'nf-pet-time' }, `${state.running ? '' : 'Ⅱ '}${state.phase === 'focus' ? '专注' : '休息'} ${time(state.remaining)}`) : null);
  }
  function Reminder({ state }) {
    if (!state.notice) return null;
    return h('div', { className: 'nf-reminder', role: 'status' },
      h('strong', null, state.notice.finished === 'focus' ? '这一段专注，完成啦。' : '休息好了，慢慢继续。'),
      h('p', null, state.notice.finished === 'focus' ? '站起来伸个懒腰，奶茶时间到了。' : '奶蛙已经翻开书，等你一起。'),
      h('div', null, h('button', { type: 'button', className: 'nw-button nw-primary', onClick: () => clock.start() }, state.phase === 'break' ? '开始休息' : '开始专注'), h('button', { type: 'button', className: 'nw-text-button', onClick: () => clock.dismiss() }, '稍后再说')));
  }
  function Panel() {
    const state = useClock();
    const [focusDraft, setFocusDraft] = useState(String(state.focusMinutes)), [breakDraft, setBreakDraft] = useState(String(state.breakMinutes));
    useEffect(() => { setFocusDraft(String(state.focusMinutes)); setBreakDraft(String(state.breakMinutes)); }, [state.focusMinutes, state.breakMinutes]);
    const progress = Math.max(0, Math.min(100, (1 - state.remaining / state.duration) * 100));
    const startLabel = `${state.remaining < state.duration ? '继续' : '开始'}${state.phase === 'focus' ? '专注' : '休息'}`;
    const changed = Number(focusDraft) !== state.focusMinutes || Number(breakDraft) !== state.breakMinutes;
    const valid = Number(focusDraft) >= 1 && Number(focusDraft) <= 180 && Number(breakDraft) >= 1 && Number(breakDraft) <= 60;
    return h('section', { className: 'nf-panel', 'aria-label': '奶蛙摸鱼钟' },
      h('div', { className: 'nf-heading' }, h('div', null, h('small', null, 'MILK FROG · SLOW & STEADY'), h('h3', null, '认真一会儿，摸鱼一会儿。')), h('span', null, `今日专注 ${state.completed} 次`)),
      h('div', { className: 'nf-mode', role: 'group', 'aria-label': '计时模式' }, ['focus', 'break'].map(phase => h('button', { type: 'button', key: phase, 'aria-pressed': state.phase === phase, onClick: () => clock.select(phase) }, phase === 'focus' ? '安静专注' : '快乐休息'))),
      h('div', { className: 'nf-scene' }, h('div', { className: 'nf-dial' }, h('svg', { viewBox: '0 0 180 180', 'aria-hidden': true }, h('circle', { cx: 90, cy: 90, r: 82, className: 'nf-ring-track' }), h('circle', { cx: 90, cy: 90, r: 82, className: 'nf-ring-progress', pathLength: 100, strokeDasharray: 100, strokeDashoffset: 100 - progress })), h('div', null, h('small', null, state.notice ? '到点啦' : state.running ? state.phase === 'focus' ? '奶蛙陪你看书' : '奶蛙陪你歇一会儿' : '准备好就开始'), h('output', { 'aria-label': '剩余时间' }, time(state.remaining)), h('span', null, state.phase === 'focus' ? '专注时间' : '休息时间'))), h(Sprite, { state })),
      state.notice ? h(Reminder, { state }) : null,
      h('div', { className: 'nf-actions' }, h('button', { type: 'button', className: 'nw-button nw-primary', onClick: () => state.running ? clock.pause() : clock.start() }, state.running ? '暂停一下' : startLabel), h('button', { type: 'button', className: 'nw-button', onClick: () => clock.reset() }, '重置本段')),
      h('fieldset', { className: 'nf-durations', disabled: state.running }, h('legend', null, '自己的节奏'), h('label', null, '专注', h('input', { type: 'number', min: 1, max: 180, value: focusDraft, onChange: e => setFocusDraft(e.target.value), 'aria-label': '专注分钟数' }), '分钟'), h('label', null, '休息', h('input', { type: 'number', min: 1, max: 60, value: breakDraft, onChange: e => setBreakDraft(e.target.value), 'aria-label': '休息分钟数' }), '分钟'), h('button', { type: 'button', className: 'nw-button', disabled: !changed || !valid, onClick: () => clock.configure({ focusMinutes: Number(focusDraft), breakMinutes: Number(breakDraft) }) }, '应用时长')),
      h('p', { className: 'nf-help' }, state.warning || (state.running ? '关掉这个窗口，奶蛙仍会陪你计时。暂停后可调整时长。' : '专注时看书，休息先伸懒腰再喝奶茶；到点举牌，下一段由你开始。')));
  }
  function Overlay() {
    const state = useClock(), { prefs } = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    useEffect(() => { const id = setInterval(clock.tick, 500); document.addEventListener('visibilitychange', clock.tick); return () => { clearInterval(id); document.removeEventListener('visibilitychange', clock.tick); }; }, []);
    return !prefs.petEnabled && state.notice ? h('div', { className: 'nf-fallback-reminder' }, h(Sprite, { state }), h(Reminder, { state })) : null;
  }
  return { Sprite, Reminder, Panel, Overlay };
}
