/** Draggable milk-frog sticky notes; pinning never prevents editing or copying. */
export function createNotes(React, controller, museumIcon, core) {
  const h = React.createElement, { useState, useEffect, useRef, useSyncExternalStore } = React;
  const store = controller.notes;
  function Icon({ name }) {
    const paths = { pin: 'm9 3 6 0-1 5 4 4v2H6v-2l4-4-1-5ZM12 14v7', copy: 'M9 9h11v12H9zM5 16H3V3h12v3', close: 'm6 6 12 12M18 6 6 18' };
    return h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: paths[name] }));
  }
  function HangingClip() {
    return h('span', { className: 'nw-note-hanging', 'aria-hidden': true },
      h('svg', { className: 'nw-note-rope', viewBox: '0 0 280 46', preserveAspectRatio: 'none', fill: 'none' },
        h('path', { d: 'M-8 9 Q140 43 288 7', stroke: '#b9a589', strokeWidth: 2.5 }),
        h('path', { d: 'M-8 9 Q140 43 288 7', stroke: '#eee3d0', strokeWidth: 1, strokeDasharray: '2 2' })),
      h('svg', { className: 'nw-note-wood-clip', viewBox: '0 0 28 62', fill: 'none' },
        h('path', { d: 'M8 3 17 2 20 53 11 55Z', fill: '#d9c0a0', stroke: '#b29a7c', strokeWidth: .7 }),
        h('path', { d: 'M12 5 20 4 18 56 9 57Z', fill: '#e8d3b7', stroke: '#c0a589', strokeWidth: .7 }),
        h('path', { d: 'm15 9-1 14m-1 17-1 12m5-42-1 12', stroke: '#bda17e', strokeOpacity: .5, strokeWidth: .7 }),
        h('path', { d: 'm8 30 12-1m-12 3 12-1', stroke: '#83796c', strokeWidth: 1.2 }),
        h('circle', { cx: 14, cy: 31, r: 3.5, fill: '#aa9b87', stroke: '#776e62', strokeWidth: 1 }),
        h('circle', { cx: 14, cy: 31, r: 1.7, fill: '#d9c4a7' })));
  }
  function Note({ note, number, viewport, warning }) {
    const [moving, setMoving] = useState(null), [copied, setCopied] = useState(false), [copyError, setCopyError] = useState('');
    const drag = useRef(null), copyTimer = useRef(null), moveSaveTimer = useRef(null), alive = useRef(true);
    const position = core.placeStickyNote(moving || note, viewport);
    useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(copyTimer.current); clearTimeout(moveSaveTimer.current); }; }, []);
    const down = e => {
      if (e.button !== 0 || note.pinned || e.target.closest('button')) return;
      e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, left: position.x, top: position.y, next: position };
    };
    const move = e => {
      const start = drag.current; if (!start || note.pinned) return;
      start.next = core.placeStickyNote({ x: start.left + e.clientX - start.x, y: start.top + e.clientY - start.y }, viewport);
      setMoving(start.next);
      clearTimeout(moveSaveTimer.current);
      moveSaveTimer.current = setTimeout(() => store.update(note.id, { x: start.next.x, y: start.next.y }), 120);
    };
    const up = e => {
      const start = drag.current; drag.current = null; clearTimeout(moveSaveTimer.current);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (start) store.update(note.id, { x: start.next.x, y: start.next.y });
      setMoving(null);
    };
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(note.text);
        if (!alive.current) return;
        setCopyError(''); setCopied(true); clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 2000);
      } catch { if (alive.current) { setCopied(false); setCopyError('未能复制，请选中文字后复制。'); } }
    };
    return h('section', { className: 'nw-sticky-note' + (note.pinned ? ' is-pinned' : '') + (moving ? ' is-moving' : ''), 'aria-label': `奶蛙便利贴 ${number}`, style: { left: position.x, top: position.y, width: position.width, height: position.height, '--nw-note-tilt': [-1.6, 1.3, -.8][(number - 1) % 3] + 'deg' } },
      h('header', { className: 'nw-note-handle', tabIndex: note.pinned ? -1 : 0, 'aria-label': `移动便利贴 ${number}，方向键移动，Shift 微调`, onPointerDown: down, onPointerMove: move, onPointerUp: up, onLostPointerCapture: up, onPointerCancel: () => { clearTimeout(moveSaveTimer.current); drag.current = null; setMoving(null); }, onKeyDown: e => {
        if (note.pinned || e.target !== e.currentTarget || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault(); e.stopPropagation();
        const amount = e.shiftKey ? 1 : 10;
        const next = core.placeStickyNote({ x: position.x + (e.key === 'ArrowLeft' ? -amount : e.key === 'ArrowRight' ? amount : 0), y: position.y + (e.key === 'ArrowUp' ? -amount : e.key === 'ArrowDown' ? amount : 0) }, viewport);
        store.update(note.id, next);
      } }, h(HangingClip), h('span', { className: 'nw-note-brand' }, h('img', { src: museumIcon, alt: '', draggable: false }), h('strong', null, '奶蛙便利贴'), h('small', null, String(number).padStart(2, '0'))), h('button', { type: 'button', className: 'nw-note-close nw-close-button', 'aria-label': `收起便利贴 ${number}`, title: '收起后可在设置中恢复', onClick: () => { if (moving) store.update(note.id, { x: moving.x, y: moving.y }); store.hide(note.id); } }, h(Icon, { name: 'close' }))),
      h('textarea', { className: 'nw-note-input', 'aria-label': `奶蛙便利贴 ${number} 内容`, placeholder: '先记下来，奶蛙帮你看着。', value: note.text, maxLength: 10000, onChange: e => { setCopied(false); store.update(note.id, { text: e.target.value }); }, spellCheck: false }),
      h('footer', { className: 'nw-note-footer' }, h('button', { type: 'button', className: 'nw-note-pin', 'aria-label': `${note.pinned ? '取消固定' : '固定'}便利贴 ${number} 位置`, 'aria-pressed': note.pinned, title: note.pinned ? '点击取消固定，仍可编辑文字' : '固定后不再随拖动移动', onClick: () => { clearTimeout(moveSaveTimer.current); drag.current = null; store.update(note.id, { ...(moving ? { x: moving.x, y: moving.y } : {}), pinned: !note.pinned }); setMoving(null); } }, h(Icon, { name: 'pin' }), note.pinned ? '已固定' : '固定位置'), h('button', { type: 'button', disabled: !note.text.length, 'aria-label': `复制便利贴 ${number}`, onClick: copy }, h(Icon, { name: 'copy' }), copied ? '已复制' : '复制便签')),
      warning || copyError ? h('small', { className: 'nw-note-status', role: 'status' }, copyError || warning) : null);
  }
  return function NotesOverlay() {
    const { notes, warning } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
    useEffect(() => { const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight }); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
    return h('div', { className: 'nw-sticky-layer' }, notes.map((note, index) => note.hidden ? null : h(Note, { key: note.id, note, number: index + 1, viewport, warning })));
  };
}
