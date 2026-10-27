/** Pet, context menu and local mini-games. Uses the host's shared React. */
export function createPetFeatures(React, assets, controller, MuseumPanel, core, experience, focusFeatures) {
  const h = React.createElement;
  const { useState, useEffect, useRef, useSyncExternalStore } = React;
  const LAUGH_AUDIO_DELAY_MS = 500;
  const duration = milliseconds => {
    const seconds = Math.max(0, Math.floor((Number.isFinite(milliseconds) ? milliseconds : 0) / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  };
  const gallery = [
    { id: 'puzzle-white-ballet', title: '白丝芭蕾蛙', caption: '优雅，是奶蛙的基本功。' },
    { id: 'puzzle-black-runway', title: '黑丝红毯蛙', caption: '全场最圆，也全场最靓。' },
    { id: 'puzzle-twin-divas', title: '黑白双蛙', caption: '名画摆拍，谁也不服谁。' }
  ];
  const url = name => assets[name]?.url || '';
  const useStateStore = () => useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const idleClock = { running: false, remaining: 0, duration: 0, notice: null };

  function MenuIcon({ name }) {
    const paths = {
      wallpaper: 'm4 7 3-3 3 3 M7 4v11a4 4 0 0 0 4 4h2 M20 17l-3 3-3-3 M17 20V9a4 4 0 0 0-4-4h-2',
      notes: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5',
      close: 'm6 6 12 12M18 6 6 18',
      focus: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
      puzzle: 'M9 4H5a1 1 0 0 0-1 1v4c4-2 4 4 0 2v8a1 1 0 0 0 1 1h5c-2-4 4-4 2 0h7a1 1 0 0 0 1-1v-6c-4 2-4-4 0-2V5a1 1 0 0 0-1-1h-6c2 4-4 4-2 0Z',
      merge: 'M8 12a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM16 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM17 16v5M14.5 18.5h5',
      settings: 'M4 7h5M13 7h7M4 17h9M17 17h3M9 4v6M13 14v6'
    };
    return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: paths[name] }));
  }
  function Toggle({ label, help, checked, onChange }) {
    return h('label', { className: 'nw-toggle-row' }, h('span', null, label, h('small', null, help)), h('input', { type: 'checkbox', role: 'switch', checked, onChange: e => onChange(e.target.checked) }));
  }
  function Slider({ label, value, min, max, unit = '', onChange }) {
    const id = React.useId();
    return h('label', { className: 'np-slider', htmlFor: id }, h('span', null, label, h('output', null, value + unit)), h('input', { id, type: 'range', min, max, step: 1, value, onChange: e => onChange(Number(e.target.value)) }));
  }
  function Controls() {
    const { prefs } = useStateStore();
    return h('section', { className: 'nw-adjustments np-preferences', 'aria-label': '桌宠设置' },
      h('div', { className: 'nw-adjust-heading' }, h('div', null, h('h3', null, '奶蛙陪伴'), h('p', null, '左键逗笑，右键打开奶蛙的小世界。'))),
      h(Toggle, { label: '显示聊天区桌宠', help: '直接按住奶蛙拖动，松开即可放置。', checked: prefs.petEnabled, onChange: petEnabled => controller.update({ petEnabled }) }),
      h(Toggle, { label: '显示云朵气泡', help: '点击奶蛙看信息，点气泡看表情，再点收起；闲置 6 秒消失。', checked: prefs.bubble, onChange: bubble => controller.update({ bubble }) }),
      h(Toggle, { label: '点击发出笑声', help: '点击奶蛙开始大笑，再点一下同时停止声音和动作。', checked: prefs.sound, onChange: sound => controller.update({ sound }) }),
      h(Toggle, { label: '显示 DeepSeek API 余额', help: '使用 DSH 已保存的官方 API Key，每分钟更新。', checked: prefs.showBalance, onChange: showBalance => controller.update({ showBalance }) }),
      h('div', { className: 'np-settings-sliders' },
        h(Slider, { label: '奶蛙大小', min: 96, max: 200, value: prefs.petSize, unit: ' px', onChange: petSize => controller.update({ petSize }) }),
        h(Slider, { label: '笑声音量', min: 0, max: 100, value: prefs.volume, unit: '%', onChange: volume => controller.update({ volume }) })),
      h('div', { className: 'np-setting-actions' }, h('button', { className: 'nw-button', type: 'button', onClick: () => controller.update({ petPosition: null }) }, '重置桌宠位置')),
      h('details', { className: 'np-schedule' }, h('summary', null, '峰谷时段规则'), h('p', null, '北京时间周一至周五 09:00–12:00、14:00–18:00 为高峰，其余时段、周末和法定节假日为谷地。内置 2026 年节假日日历。'),
        h('label', null, '补充节假日（逗号分隔，YYYY-MM-DD）', h('input', { type: 'text', value: prefs.holidays, placeholder: '2027-01-01,2027-02-06', onChange: e => controller.update({ holidays: e.target.value }) })),
        h('a', { href: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/', target: '_blank', rel: 'noreferrer' }, '查看 DeepSeek 当前官方规则')));
  }
  function NoteControls({ close }) {
    const { notes, warning } = useSyncExternalStore(controller.notes.subscribe, controller.notes.getSnapshot, controller.notes.getSnapshot);
    const hidden = notes.filter(note => note.hidden).length;
    return h('section', { className: 'nw-adjustments nw-notes-settings', 'aria-label': '便利贴设置' },
      h('div', { className: 'nw-adjust-heading' }, h('div', null, h('h3', null, '留住一小片灵感'), h('p', null, '内容与位置自动保存在本机，下次打开仍在。')), h('span', { className: 'nw-mini-tag' }, `${notes.length - hidden} 张在桌面`)),
      h('div', { className: 'nw-notes-guide' }, h(MenuIcon, { name: 'notes' }), h('div', null, h('strong', null, '写下来，慢慢完成'), h('p', null, '拖动顶部移动便签；底部「固定位置」防止误拖，「复制便签」复制全部文字。右上角可收起，文字会保留。'))),
      h('div', { className: 'nw-inline-actions' }, h('button', { className: 'nw-button nw-primary', type: 'button', disabled: notes.length >= 100, onClick: () => { controller.notes.add(); close?.(); } }, '＋ 新增奶蛙便利贴'), h('button', { className: 'nw-button', type: 'button', disabled: !hidden, onClick: () => { controller.notes.restoreHidden(); close?.(); } }, `显示收起的便签${hidden ? `（${hidden}）` : ''}`)),
      warning ? h('p', { className: 'nw-form-message', role: 'status' }, warning) : null);
  }
  function Settings({ close }) {
    const sections = [
      { id: 'pet', label: '桌宠与气泡', caption: '陪伴 · 余额 · 声音', content: h(Controls) },
      ...(focusFeatures ? [{ id: 'focus', label: '奶蛙摸鱼钟', caption: '专注 · 休息 · 提醒', content: h(focusFeatures.Panel) }] : []),
      ...(experience ? [{ id: 'startup', label: '启动动画', caption: '片头 · 钢琴 · 速度', content: h(experience.StartupControls) }] : []),
      ...(controller.notes ? [{ id: 'notes', label: '奶蛙便利贴', caption: '新增 · 恢复 · 使用方法', content: h(NoteControls, { close }) }] : [])
    ];
    return h(MuseumPanel, { controller, close, sections }, experience ? h(experience.WallpaperControls) : null);
  }

  function GameMusic({ kind }) {
    const { prefs } = useStateStore();
    const [status, setStatus] = useState('paused');
    const player = useRef(null), current = useRef(prefs); current.current = prefs;
    const volumeId = React.useId();
    useEffect(() => {
      const music = core.createGameMusic(kind, { onState: setStatus }); player.current = music;
      const sync = () => {
        if (current.current.gameMusic && !document.hidden) void music.play({ volume: current.current.gameVolume / 100 });
        else music.pause();
      };
      sync(); document.addEventListener('visibilitychange', sync);
      return () => { document.removeEventListener('visibilitychange', sync); player.current = null; music.dispose(); };
    }, [kind]);
    useEffect(() => {
      const music = player.current; if (!music) return;
      music.setVolume(prefs.gameVolume / 100);
      if (prefs.gameMusic && !document.hidden) void music.play({ volume: prefs.gameVolume / 100 });
      else music.pause();
    }, [prefs.gameMusic, prefs.gameVolume]);
    const toggle = () => {
      if (prefs.gameMusic && status === 'playing') { player.current?.pause(); controller.update({ gameMusic: false }); }
      else { controller.update({ gameMusic: true }); void player.current?.play({ volume: prefs.gameVolume / 100 }); }
    };
    return h('div', { className: 'np-game-music', 'aria-label': '小游戏背景音乐' },
      h('button', { type: 'button', className: 'np-music-toggle', 'aria-label': status === 'playing' ? '暂停背景音乐' : '播放背景音乐', 'aria-pressed': status === 'playing', onClick: toggle },
        h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: status === 'playing' ? 'M8 5v14M16 5v14' : 'm8 5 11 7-11 7Z' }))),
      h('div', { className: 'np-music-track' }, h('strong', null, kind === 'puzzle' ? '画廊慢时光' : '池塘跳跳舞'), h('small', { role: 'status' }, status === 'playing' ? 'BGM · 正在播放' : status === 'blocked' ? '点击播放音乐' : status === 'error' ? '音乐暂不可用' : 'BGM · 已暂停')),
      h('label', { className: 'np-music-volume', htmlFor: volumeId }, h('span', null, '音乐音量'), h('input', { id: volumeId, type: 'range', min: 0, max: 100, step: 1, value: prefs.gameVolume, onChange: e => controller.update({ gameVolume: Number(e.target.value) }) }), h('output', { htmlFor: volumeId }, prefs.gameVolume + '%')));
  }

  function PetSprite({ laughing, cycle, audioElement }) {
    const canvas = useRef(null), sheet = useRef(null);
    const [ready, setReady] = useState(false);
    const animation = assets['pet-animation'];
    useEffect(() => {
      if (!animation) return;
      let disposed = false;
      const image = new Image();
      image.onload = () => {
        if (disposed) return;
        try {
          const atlas = document.createElement('canvas'); atlas.width = image.naturalWidth; atlas.height = image.naturalHeight;
          const context = atlas.getContext('2d', { willReadFrequently: true });
          if (!context) return;
          context.drawImage(image, 0, 0);
          const bitmap = context.getImageData(0, 0, atlas.width, atlas.height);
          core.keySpriteBackground(bitmap.data, atlas.width, atlas.height, animation.cellWidth, animation.cellHeight, animation.columns, animation.frames);
          context.putImageData(bitmap, 0, 0); sheet.current = atlas; setReady(true);
        } catch (error) { console.warn('[naiwa] Pet animation unavailable:', error?.message); }
      };
      image.src = animation.url;
      return () => { disposed = true; image.onload = null; sheet.current = null; };
    }, []);
    useEffect(() => {
      if (!ready || !sheet.current) return;
      const node = canvas.current, context = node.getContext('2d');
      if (!context) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      const start = performance.now(); let frameId, last = -1, lastElapsed = 0;
      const draw = index => {
        if (index === last) return; last = index;
        context.clearRect(0, 0, node.width, node.height);
        context.drawImage(sheet.current, index % animation.columns * animation.cellWidth, Math.floor(index / animation.columns) * animation.cellHeight, animation.cellWidth, animation.cellHeight, 0, 0, node.width, node.height);
        node.setAttribute('data-frame', String(index));
      };
      const tick = time => {
        const clip = audioElement.current;
        const elapsed = Math.max(lastElapsed, clip && !clip.paused ? clip.currentTime * 1000 + LAUGH_AUDIO_DELAY_MS : time - start);
        lastElapsed = elapsed;
        draw(core.spriteFrameAt(animation, elapsed)); frameId = requestAnimationFrame(tick);
      };
      const play = () => {
        cancelAnimationFrame(frameId);
        if (!laughing) draw(0);
        else if (reduced.matches) draw(animation.stillFrame);
        else frameId = requestAnimationFrame(tick);
      };
      play(); reduced.addEventListener('change', play);
      return () => { cancelAnimationFrame(frameId); reduced.removeEventListener('change', play); };
    }, [ready, laughing, cycle]);
    return h(React.Fragment, null,
      h('canvas', { ref: canvas, width: animation?.cellWidth || 224, height: animation?.cellHeight || 224, className: 'np-pet-sprite', hidden: !ready, 'aria-hidden': true, 'data-naiwa-animation': 'user-gif' }),
      !ready ? h('img', { className: 'np-pet-sprite', src: url(laughing ? 'pet-laugh' : 'pet-idle'), alt: '', draggable: false }) : null);
  }

  function Puzzle() {
    const [art, setArt] = useState(gallery[0]);
    const [size, setSize] = useState(3);
    const [pieces, setPieces] = useState(() => core.createJigsaw(3));
    const [active, setActive] = useState(null);
    const [moves, setMoves] = useState(0);
    const [peek, setPeek] = useState(false);
    const [started, setStarted] = useState(Date.now());
    const [elapsed, setElapsed] = useState(0);
    const table = useRef(null), drag = useRef(null);
    const clipPrefix = 'nw-jigsaw-' + React.useId().replace(/[^a-z0-9]/gi, '');
    const placed = pieces.filter(p => p.placed).length;
    const solved = placed === pieces.length;
    useEffect(() => { if (solved) return; const timer = setInterval(() => setElapsed(Date.now() - started), 1000); return () => clearInterval(timer); }, [solved, started]);
    const restart = (n = size) => { drag.current = null; setPieces(core.createJigsaw(n)); setActive(null); setMoves(0); setPeek(false); setStarted(Date.now()); setElapsed(0); };
    const point = e => { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(table.current.getScreenCTM().inverse()); return { x: p.x, y: p.y }; };
    const down = (e, p) => {
      if (e.button !== 0 || p.placed || peek || solved) return;
      e.preventDefault(); e.stopPropagation(); e.currentTarget.focus({ preventScroll: true }); table.current.setPointerCapture(e.pointerId);
      const at = point(e); drag.current = { id: p.id, dx: at.x - p.x, dy: at.y - p.y, x: p.x, y: p.y };
      setActive(p.id); setPieces(old => [...old.filter(q => q.id !== p.id), p]);
    };
    const move = e => {
      const d = drag.current; if (!d) return;
      const at = point(e); d.x = at.x - d.dx; d.y = at.y - d.dy;
      setPieces(old => old.map(p => p.id === d.id ? { ...p, x: d.x, y: d.y, rotation: 0 } : p));
    };
    const up = e => {
      const d = drag.current; if (!d) return;
      const at = point(e), x = at.x - d.dx, y = at.y - d.dy;
      drag.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      setPieces(old => old.map(p => p.id === d.id ? core.placeJigsawPiece(p, x, y) : p));
      setMoves(n => n + 1);
    };
    const keyboard = (e, p) => {
      if (p.placed || peek) return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation(); setActive(p.id);
      const step = e.shiftKey ? 2 : 12;
      if (e.key === ' ' || e.key === 'Enter') {
        setPieces(old => old.map(q => q.id === p.id ? core.placeJigsawPiece(q, q.x, q.y) : q)); setMoves(n => n + 1);
      } else setPieces(old => old.map(q => q.id === p.id ? { ...q, rotation: 0, x: Math.max(q.cell * .22, Math.min(960 - q.cell * 1.22, q.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0))), y: Math.max(q.cell * .22, Math.min(680 - q.cell * 1.22, q.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0))) } : q));
    };
    const ordered = [...pieces.filter(p => p.placed), ...pieces.filter(p => !p.placed)];
    return h('div', { className: 'np-puzzle' },
      h('p', { className: 'np-lead' }, '从散落的小拼片里找线索，拖到中间画框。靠近正确位置会自动吸附，已经拼好的片块会固定。'),
      h('div', { className: 'np-art-picker', role: 'group', 'aria-label': '选择奶蛙美图' }, gallery.map(a => h('button', { type: 'button', key: a.id, 'aria-pressed': a.id === art.id, onClick: () => { setArt(a); restart(); } }, h('img', { src: url(a.id), alt: a.title }), h('span', null, a.title)))),
      h('div', { className: 'np-puzzle-toolbar' }, h('label', null, '难度 ', h('select', { value: size, onChange: e => { const n = Number(e.target.value); setSize(n); restart(n); } }, [3, 4, 5].map(n => h('option', { key: n, value: n }, `${n} × ${n}`)))), h('span', null, `${moves} 次移动 · ${duration(elapsed)}`), h('button', { className: 'nw-button', type: 'button', onClick: () => setPeek(!peek), 'aria-pressed': peek }, peek ? '继续拼图' : '看看原图'), h('button', { className: 'nw-button', type: 'button', onClick: () => restart() }, '重新散开')),
      h('svg', { ref: table, viewBox: '0 0 960 680', className: 'np-jigsaw-table', onPointerMove: move, onPointerUp: up, onPointerCancel: e => { const d = drag.current; drag.current = null; if (d) setPieces(old => old.map(q => q.id === d.id ? core.placeJigsawPiece(q, d.x, d.y) : q)); }, 'aria-label': `${art.title} ${size}乘${size}散片拼图` },
        h('defs', null, pieces.map(p => h('pattern', { id: `${clipPrefix}-${p.id}`, key: p.id, patternUnits: 'userSpaceOnUse', x: -p.col * p.cell, y: -p.row * p.cell, width: 420, height: 420 }, h('image', { href: url(art.id), width: 420, height: 420, preserveAspectRatio: 'none', pointerEvents: 'none' })))),
        h('rect', { x: 270, y: 110, width: 420, height: 420, rx: 3, className: 'np-jigsaw-frame' }),
        placed === 0 && !peek ? h('text', { x: 480, y: 320, textAnchor: 'middle', className: 'np-jigsaw-hint' }, '把小拼片拖进这里') : null,
        ordered.map(p => h('g', {
          key: p.id, role: 'button', tabIndex: p.placed || peek ? -1 : 0, 'aria-label': `拼图片块 ${p.id + 1}${p.placed ? '，已归位' : '，可拖动'}`, 'aria-disabled': p.placed || peek,
          className: 'np-jigsaw-piece' + (p.placed ? ' is-placed' : '') + (active === p.id && !p.placed ? ' is-active' : ''),
          transform: `translate(${p.x} ${p.y}) rotate(${p.rotation} ${p.cell / 2} ${p.cell / 2})`,
          onPointerDown: e => down(e, p),
          onFocus: () => setActive(p.id), onKeyDown: e => keyboard(e, p)
        }, h('path', { d: core.jigsawPath(p), fill: `url(#${clipPrefix}-${p.id})`, className: 'np-jigsaw-edge', style: { pointerEvents: 'all' } }))),
        peek ? h('image', { href: url(art.id), x: 270, y: 110, width: 420, height: 420, className: 'np-jigsaw-preview' }) : null),
      h('div', { className: 'np-puzzle-status', role: 'status' }, solved ? `拼好了！${art.title} · ${moves} 次移动 · ${duration(elapsed)}` : `${art.caption} 已归位 ${placed}/${pieces.length} 块`));
  }

  function MergeGame() {
    const canvas = useRef(null);
    const game = useRef(null);
    const aim = useRef(180);
    const [version, setVersion] = useState(0);
    const [stats, setStats] = useState({ score: 0, next: 0, over: false, won: false, maxLevel: 0 });
    const [best, setBest] = useState(() => { try { return Number(localStorage.getItem('dsh.naiwa.merge.best')) || 0; } catch { return 0; } });
    const bestRef = useRef(best);
    useEffect(() => {
      const engine = core.createMergeGame(); game.current = engine;
      const node = canvas.current, ctx = node.getContext('2d');
      if (!ctx) return;
      const scale = Math.min(2, window.devicePixelRatio || 1);
      node.width = 360 * scale; node.height = 500 * scale;
      ctx.scale(scale, scale);
      const idle = new Image(), laugh = new Image(); idle.src = url('pet-idle'); laugh.src = url('pet-laugh');
      const palette = ['#ead67a', '#cde291', '#a9d9c0', '#9dcde1', '#b7b8e5', '#d4a9da', '#e8a9b6', '#efb78a', '#ecd077', '#eac554', '#f2b842'];
      let frame, previous = 0, accumulator = 0, lastStats = '';
      const drawFrog = (x, y, radius, level, faded = false, angle = 0) => {
        ctx.save(); ctx.globalAlpha = faded ? 0.6 : 1;
        const gradient = ctx.createRadialGradient(x - radius / 3, y - radius / 3, radius * 0.1, x, y, radius);
        gradient.addColorStop(0, '#fff5c2'); gradient.addColorStop(1, palette[level]);
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius - 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#6b65204d'; ctx.lineWidth = 1.3; ctx.stroke();
        const sprite = level === 10 ? laugh : idle;
        if (sprite.complete && sprite.naturalWidth) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius - 1, 0, Math.PI * 2); ctx.clip(); ctx.translate(x, y); ctx.rotate(angle); ctx.translate(-x, -y); ctx.filter = `hue-rotate(${level * 8}deg)`; if (level === 10) ctx.drawImage(sprite, 250, 70, 780, 950, x - radius, y - radius, radius * 2, radius * 2.1); else ctx.drawImage(sprite, 255, 45, 735, 870, x - radius, y - radius, radius * 2, radius * 2.1); ctx.restore(); }
        else { ctx.fillStyle = '#4e7044'; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(x + side * radius * 0.25, y - radius * 0.15, radius * 0.15, 0, Math.PI * 2); ctx.fill(); } }
        if (radius > 23) { ctx.font = `600 ${Math.min(14, radius * 0.3)}px system-ui`; ctx.fillStyle = '#49482a'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff9e8'; ctx.beginPath(); ctx.arc(x, y + radius * .76, Math.min(10, radius * .23), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#647446'; ctx.fillText(String(level + 1), x, y + radius * .84); }
        ctx.restore();
      };
      const render = time => {
        const dt = previous ? Math.min(0.05, (time - previous) / 1000) : 0; previous = time;
        if (!document.hidden) { accumulator += dt; while (accumulator >= 1 / 90) { engine.step(1 / 90); accumulator -= 1 / 90; } }
        const s = engine.state;
        ctx.clearRect(0, 0, 360, 500);
        const sky = ctx.createLinearGradient(0, 0, 0, 500); sky.addColorStop(0, '#fff9e9'); sky.addColorStop(.7, '#f4f6dd'); sky.addColorStop(1, '#dbeccf');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 500);
        ctx.save(); ctx.globalAlpha = .42; ctx.fillStyle = '#c4d9aa';
        for (const [x, y, w] of [[22, 479, 28], [327, 487, 34], [58, 493, 15]]) {
          ctx.beginPath(); ctx.ellipse(x, y, w, w * .32, -.16, .2, Math.PI * 1.9); ctx.lineTo(x, y); ctx.fill();
        }
        ctx.strokeStyle = '#83b4a16b'; ctx.lineWidth = 1;
        for (let y = 457; y < 500; y += 15) { ctx.beginPath(); ctx.ellipse(180, y, 156 - (y % 22), 4, 0, .1, Math.PI * .9); ctx.stroke(); }
        ctx.restore();
        ctx.save(); ctx.globalAlpha = .16; ctx.fillStyle = '#a5b877';
        for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(24 + i * 39, 105 + (i % 3) * 116, 1.5, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
        ctx.strokeStyle = s.danger > 0 ? '#bf524a' : '#b7b298'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(8, 74); ctx.lineTo(352, 74); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#8a8168'; ctx.font = '10px system-ui'; ctx.textAlign = 'left'; ctx.fillText('不要让奶蛙越过这条线太久', 12, 91);
        if (!s.over) {
          const x = Math.max(engine.radii[s.next], Math.min(360 - engine.radii[s.next], aim.current));
          ctx.strokeStyle = '#777a5c40'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(x, 35); ctx.lineTo(x, 490); ctx.stroke(); ctx.setLineDash([]);
          drawFrog(x, 29, engine.radii[s.next], s.next, true);
        }
        for (const b of s.items) drawFrog(b.x, b.y, b.r, b.level, false, b.angle || 0);
        if (s.items.length === 0) { ctx.fillStyle = '#827a61'; ctx.textAlign = 'center'; ctx.font = '14px system-ui'; ctx.fillText('点一下，接住第一只小奶蛙', 180, 290); }
        const current = `${s.score}:${s.next}:${s.over}:${s.won}:${s.maxLevel}`;
        if (current !== lastStats) { lastStats = current; setStats({ score: s.score, next: s.next, over: s.over, won: s.won, maxLevel: s.maxLevel }); }
        if (s.score > bestRef.current) { bestRef.current = s.score; setBest(s.score); try { localStorage.setItem('dsh.naiwa.merge.best', String(s.score)); } catch {} }
        frame = requestAnimationFrame(render);
      };
      frame = requestAnimationFrame(render);
      return () => { cancelAnimationFrame(frame); game.current = null; };
    }, [version]);
    const setAim = e => { const rect = canvas.current.getBoundingClientRect(); aim.current = Math.max(14, Math.min(346, (e.clientX - rect.left) / rect.width * 360)); };
    const drop = () => game.current?.drop(aim.current);
    return h('div', { className: 'np-merge' },
      h('div', { className: 'np-merge-welcome' }, h('div', null, h('span', null, '奶蛙池塘 · 今日营业'), h('h3', null, '碰一碰，一起长大'), h('p', null, '让相同的奶蛙相遇，接住一只大大的快乐。')), h('img', { src: url('pet-laugh'), alt: '' })),
      h('div', { className: 'np-scoreboard' }, h('div', null, h('small', null, '本局得分'), h('strong', null, stats.score)), h('div', null, h('small', null, '最高纪录'), h('strong', null, best)), h('div', { className: 'np-next-frog' }, h('span', { className: 'np-next-portrait' }, h('img', { src: url('pet-idle'), alt: '', style: { filter: `hue-rotate(${stats.next * 8}deg)` } })), h('span', null, h('small', null, '下一只'), h('strong', null, `Lv.${stats.next + 1}`)))),
      h('div', { className: 'np-merge-stage' },
        h('canvas', { ref: canvas, tabIndex: 0, 'aria-label': '合成大奶蛙游戏，左右方向键瞄准，空格投下奶蛙', onPointerMove: setAim, onPointerDown: e => { e.preventDefault(); setAim(e); canvas.current.focus(); drop(); }, onKeyDown: e => { if (['ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); if (e.key === 'ArrowLeft') aim.current -= 15; else if (e.key === 'ArrowRight') aim.current += 15; else drop(); aim.current = Math.max(14, Math.min(346, aim.current)); } } }),
        stats.over ? h('div', { className: 'np-game-over', role: 'status' }, h('img', { src: url('pet-laugh'), alt: '捧腹大笑的奶蛙' }), h('h3', null, '奶蛙挤满啦'), h('p', null, `本局 ${stats.score} 分`), h('button', { className: 'nw-button nw-primary', type: 'button', onClick: () => setVersion(v => v + 1) }, '再合一局')) : null),
      h('div', { className: 'np-growth-road', 'aria-label': '奶蛙成长图鉴' }, h('span', null, '成长图鉴'), h('div', null, Array.from({ length: 11 }, (_, i) => h('span', { key: i, className: i <= stats.maxLevel ? 'is-unlocked' : '', title: `第 ${i + 1} 级${i <= stats.maxLevel ? '，已解锁' : ''}` }, h('img', { src: url(i === 10 ? 'pet-laugh' : 'pet-idle'), alt: '', style: { filter: `hue-rotate(${i * 8}deg)` } }), h('small', null, i + 1))))),
      h('div', { className: 'np-game-footer' }, h('span', { role: 'status' }, stats.won ? '合成大奶蛙成功！还可以继续挑战。' : `最高等级 Lv.${stats.maxLevel + 1} · 点击或空格投下`), h('button', { className: 'nw-button', type: 'button', disabled: stats.over, onClick: drop }, '投下一只'), h('button', { className: 'nw-button', type: 'button', onClick: () => setVersion(v => v + 1) }, '重新开始')));
  }

  function Pet() {
    const { prefs } = useStateStore();
    const focusState = useSyncExternalStore(controller.focus?.subscribe || (() => () => {}), controller.focus?.getSnapshot || (() => idleClock), controller.focus?.getSnapshot || (() => idleClock));
    const [laughing, setLaughing] = useState(false);
    const [laughCycle, setLaughCycle] = useState(0);
    const [menu, setMenu] = useState(null);
    const [menuPos, setMenuPos] = useState({ left: 0, top: 0 });
    const [bubbleVisible, setBubbleVisible] = useState(false);
    const [reaction, setReaction] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [modal, setModal] = useState(null);
    const [now, setNow] = useState(Date.now());
    const [balance, setBalance] = useState({ code: 'LOADING' });
    const [balanceBusy, setBalanceBusy] = useState(false);
    const [pos, setPos] = useState({ left: -500, top: -500 });
    const root = useRef(null), dialog = useRef(null), menuRef = useRef(null), laughTimer = useRef(null), audio = useRef(null), audioElement = useRef(null), laughRequest = useRef(0), bubbleTimer = useRef(null), drag = useRef(null), longPress = useRef(null), skipClick = useRef(false), fetchState = useRef({ busy: false });
    const latest = useRef(prefs); latest.current = prefs;
    const lastReaction = useRef(null), laughingNow = useRef(false);
    const audioDelayTimer = useRef(null);
    const reactions = assets.reactions || [];
    const readBalance = useRef(null);
    const finishLaugh = () => { laughingNow.current = false; setLaughing(false); };
    const stopLaugh = () => { laughRequest.current++; clearTimeout(audioDelayTimer.current); clearTimeout(laughTimer.current); audio.current?.stop(); finishLaugh(); };
    const hideBubble = () => { clearTimeout(bubbleTimer.current); setBubbleVisible(false); setReaction(null); };
    const armBubbleTimer = () => { clearTimeout(bubbleTimer.current); bubbleTimer.current = setTimeout(hideBubble, 6000); };
    const showBubbleInfo = () => {
      if (!prefs.bubble || !prefs.petEnabled) return;
      setReaction(null); setBubbleVisible(true); armBubbleTimer();
    };
    useEffect(() => { if (focusState.running || focusState.notice) { stopLaugh(); if (focusState.notice) hideBubble(); } }, [focusState.running, focusState.notice?.id]);
    const clickBubble = () => {
      if (reaction !== null || !reactions.length) { hideBubble(); return; }
      const next = core.nextPetReaction(lastReaction.current, reactions.length);
      lastReaction.current = next; setReaction(next); armBubbleTimer();
    };
    useEffect(() => { hideBubble(); return () => clearTimeout(bubbleTimer.current); }, [prefs.bubble, prefs.petEnabled]);
    useEffect(() => {
      const lifecycle = new AbortController();
      for (const name of ['pet-idle', 'pet-laugh']) { const image = new Image(); image.src = url(name); image.decode?.().catch(() => {}); }
      readBalance.current = async () => {
        if (fetchState.current.busy || !latest.current.showBalance || document.hidden) return;
        fetchState.current.busy = true; setBalanceBusy(true);
        try {
          const r = await fetch('/naiwa-theme/balance.json', { cache: 'no-store', signal: AbortSignal.any([lifecycle.signal, AbortSignal.timeout(12000)]) });
          const data = r.ok ? await r.json() : { code: r.status === 403 ? 'FORBIDDEN' : 'UNAVAILABLE' };
          if (!lifecycle.signal.aborted) setBalance(data);
        } catch { if (!lifecycle.signal.aborted) setBalance(old => old.ok ? { ...old, stale: true } : { code: 'UNAVAILABLE' }); }
        finally { fetchState.current.busy = false; if (!lifecycle.signal.aborted) setBalanceBusy(false); }
      };
      readBalance.current();
      const ticker = setInterval(() => setNow(Date.now()), 1000);
      const refresh = setInterval(() => { if (latest.current.petEnabled) readBalance.current?.(); }, 60000);
      const visibility = () => { if (!document.hidden) { setNow(Date.now()); readBalance.current?.(); } };
      document.addEventListener('visibilitychange', visibility);
      return () => { lifecycle.abort(); clearInterval(ticker); clearInterval(refresh); document.removeEventListener('visibilitychange', visibility); clearTimeout(audioDelayTimer.current); clearTimeout(laughTimer.current); clearTimeout(longPress.current); laughRequest.current++; audio.current?.dispose(); audio.current = null; };
    }, []);
    useEffect(() => {
      audio.current?.setVolume(prefs.volume / 100);
      if (!prefs.sound || !prefs.petEnabled || prefs.volume === 0) stopLaugh();
    }, [prefs.sound, prefs.petEnabled, prefs.volume]);
    useEffect(() => { if (prefs.showBalance) readBalance.current?.(); }, [prefs.showBalance]);
    useEffect(() => {
      const place = () => {
        const center = document.querySelector('[class*="_centerCol"]');
        const rect = center?.getBoundingClientRect() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, right: window.innerWidth };
        const size = latest.current.petSize;
        const minX = Math.min(Math.max(rect.left + 8, 8), window.innerWidth - size - 8), maxX = Math.max(minX, Math.min(rect.right - size - 12, window.innerWidth - size - 8));
        const minY = Math.min(165, Math.max(10, window.innerHeight - size - 10)), maxY = Math.max(minY, window.innerHeight - size - 12);
        const composer = document.querySelector('[data-composer-card]')?.getBoundingClientRect();
        const p = latest.current.petPosition;
        const left = p ? minX + p.x * (maxX - minX) : maxX;
        const top = p ? minY + p.y * (maxY - minY) : Math.min(maxY, Math.max(minY, (composer?.top || window.innerHeight - 100) - size - 12));
        setPos({ left, top, minX, maxX, minY, maxY });
      };
      place(); window.addEventListener('resize', place);
      const center = document.querySelector('[class*="_centerCol"]');
      const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
      if (center) observer?.observe(center);
      return () => { window.removeEventListener('resize', place); observer?.disconnect(); };
    }, [prefs.petSize, prefs.petPosition]);
    useEffect(() => {
      if (!modal) return;
      const previous = document.activeElement;
      const frame = requestAnimationFrame(() => dialog.current?.querySelector('button')?.focus());
      const keydown = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); setModal(null); return; }
        if (e.key !== 'Tab') return;
        const items = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select,textarea,a[href],[tabindex="0"]')].filter(el => el.getClientRects().length);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      };
      document.addEventListener('keydown', keydown, true);
      return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', keydown, true); previous?.focus?.(); };
    }, [modal]);
    React.useLayoutEffect(() => {
      if (!menu || !menuRef.current) return;
      const box = menuRef.current.getBoundingClientRect();
      const pet = root.current.getBoundingClientRect();
      setMenuPos(core.placePetMenu(menu, pet, { width: window.innerWidth, height: window.innerHeight }, box));
      menuRef.current.querySelector('button')?.focus({ preventScroll: true });
    }, [menu]);
    useEffect(() => {
      if (!menu) return;
      const dismiss = e => { if (!menuRef.current?.contains(e.target)) setMenu(null); };
      const closeMenu = () => setMenu(null);
      const keyboard = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMenu(null); root.current?.querySelector('.np-pet-button')?.focus(); return; }
        if (e.key === 'Tab') { setMenu(null); return; }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault(); e.stopPropagation();
        const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
        let index = items.indexOf(document.activeElement);
        if (e.key === 'Home') index = 0;
        else if (e.key === 'End') index = items.length - 1;
        else index = (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[index]?.focus();
      };
      document.addEventListener('pointerdown', dismiss); document.addEventListener('contextmenu', dismiss);
      document.addEventListener('keydown', keyboard, true); document.addEventListener('scroll', closeMenu, true);
      window.addEventListener('resize', closeMenu); window.addEventListener('blur', closeMenu);
      return () => {
        document.removeEventListener('pointerdown', dismiss); document.removeEventListener('contextmenu', dismiss);
        document.removeEventListener('keydown', keyboard, true); document.removeEventListener('scroll', closeMenu, true);
        window.removeEventListener('resize', closeMenu); window.removeEventListener('blur', closeMenu);
      };
    }, [menu]);
    const showMenu = (x, y) => {
      hideBubble(); clearTimeout(longPress.current); drag.current = null; setDragging(false);
      setMenuPos({ left: x, top: y }); setMenu({ x, y });
    };
    const petDown = e => {
      if (e.button !== 0) return;
      skipClick.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, left: pos.left, top: pos.top, nextLeft: pos.left, nextTop: pos.top, moved: false };
      if (e.pointerType === 'touch') longPress.current = setTimeout(() => { skipClick.current = true; showMenu(e.clientX, e.clientY); }, 550);
    };
    const petMove = e => {
      const d = drag.current; if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
      if (!d.moved) hideBubble();
      clearTimeout(longPress.current); d.moved = true; skipClick.current = true; setDragging(true); setMenu(null);
      d.nextLeft = Math.max(pos.minX, Math.min(pos.maxX, d.left + e.clientX - d.x));
      d.nextTop = Math.max(pos.minY, Math.min(pos.maxY, d.top + e.clientY - d.y));
      setPos(old => ({ ...old, left: d.nextLeft, top: d.nextTop }));
    };
    const petUp = e => {
      clearTimeout(longPress.current); const d = drag.current; drag.current = null; setDragging(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (!d?.moved) return;
      skipClick.current = true;
      controller.update({ petPosition: { x: pos.maxX > pos.minX ? (d.nextLeft - pos.minX) / (pos.maxX - pos.minX) : 1, y: pos.maxY > pos.minY ? (d.nextTop - pos.minY) / (pos.maxY - pos.minY) : .5 } });
    };
    const playLaugh = () => {
      if (!prefs.sound || prefs.volume === 0) return;
      const request = ++laughRequest.current;
      clearTimeout(audioDelayTimer.current);
      audioDelayTimer.current = setTimeout(() => {
        if (request !== laughRequest.current || !laughingNow.current || !latest.current.petEnabled || !latest.current.sound || latest.current.volume === 0) return;
        try {
          const clip = audio.current || (audio.current = core.createAudioClip(url('pet-laugh-audio'), { element: audioElement.current, onError: error => console.warn('[naiwa] Laugh audio:', error?.name || error?.code, error?.message), onState: state => { if (state === 'ended') { clearTimeout(laughTimer.current); finishLaugh(); } } }));
          void clip.play({ volume: latest.current.volume / 100 }).then(ok => {
            if (request !== laughRequest.current) return;
            clearTimeout(laughTimer.current);
            const seconds = clip.duration();
            laughTimer.current = setTimeout(stopLaugh, ok ? (Number.isFinite(seconds) ? seconds * 1000 + 500 : 17000) : Math.max(0, (assets['pet-animation']?.introMs || 2100) - LAUGH_AUDIO_DELAY_MS));
          });
        } catch (error) { console.warn('[naiwa] Laugh player unavailable:', error?.name, error?.message); }
      }, LAUGH_AUDIO_DELAY_MS);
    };
    const laugh = () => {
      if (skipClick.current) { skipClick.current = false; return; }
      if (focusState.notice && focusFeatures) { setModal('focus'); return; }
      setMenu(null); showBubbleInfo();
      if (laughingNow.current) { stopLaugh(); return; }
      laughingNow.current = true; setLaughing(true); setLaughCycle(n => n + 1);
      clearTimeout(laughTimer.current); laughTimer.current = setTimeout(stopLaugh, prefs.sound && prefs.volume > 0 ? 17000 + LAUGH_AUDIO_DELAY_MS : assets['pet-animation']?.introMs || 2100); playLaugh();
    };
    const open = name => { setMenu(null); setModal(name); };
    const peak = core.peakInfo(now, prefs.holidays.split(/[,，\s]+/).filter(Boolean));
    const balanceText = balance.ok ? balance.text + (balance.stale ? ' · 上次结果' : '') : ({ NO_KEY: '未配置 API Key', AUTH: 'API Key 不可用', LOADING: '余额读取中…', TIMEOUT: '余额读取超时，请稍后重试', FORBIDDEN: '当前连接不支持查询' }[balance.code] || '余额暂不可用');
    const titles = { puzzle: '奶蛙美图 · 拼图', merge: '合成大奶蛙', focus: '奶蛙摸鱼钟', settings: '奶蛙设置' };
    const selectedReaction = reactions[reaction];
    const cloud = core.placePetCloud(pos, prefs.petSize, { width: window.innerWidth, height: window.innerHeight }, Boolean(selectedReaction));
    const cloudLabel = selectedReaction ? `奶蛙表情 ${selectedReaction.id}，点击关闭气泡` : `${prefs.showBalance ? `API 余额：${balanceText}；` : ''}${peak.peak ? '高峰时段' : '谷地时段'}，${peak.reason}。点击看奶蛙表情`;
    return h(React.Fragment, null,
      h('audio', { ref: audioElement, src: url('pet-laugh-audio'), preload: 'auto', hidden: true, 'aria-hidden': true }),
      prefs.petEnabled ? h('div', { ref: root, className: 'np-pet' + (cloud.mirrored ? ' is-left' : '') + (laughing ? ' is-laughing' : '') + (dragging ? ' is-dragging' : ''), style: { left: pos.left, top: pos.top, width: prefs.petSize, height: prefs.petSize }, 'data-naiwa-pet': '' },
        focusState.notice && focusFeatures && !menu && !modal ? h('div', { className: 'nf-pet-reminder', style: { left: cloud.left, top: cloud.top, width: cloud.width } }, h(focusFeatures.Reminder, { state: focusState })) : null,
        prefs.bubble && bubbleVisible && !menu && !focusState.notice ? h('button', { type: 'button', className: 'np-cloud' + (selectedReaction ? ' is-reaction' : ''), style: { left: cloud.left, top: cloud.top, width: cloud.width, height: cloud.height, '--np-tail-x': cloud.pointer + 'px' }, 'aria-label': cloudLabel, title: selectedReaction ? '点击关闭气泡' : '点击看奶蛙表情', onClick: clickBubble },
          h('span', { className: 'np-cloud-lobes', 'aria-hidden': true }),
          selectedReaction ? h('img', { key: selectedReaction.id, className: 'np-cloud-reaction', src: selectedReaction.url, alt: `奶蛙表情 ${selectedReaction.id}`, draggable: false }) : h(React.Fragment, null,
            prefs.showBalance ? h('span', { className: 'np-balance', 'aria-busy': balanceBusy }, h('span', null, 'API 余额'), h('strong', { className: balance.ok ? '' : 'is-unavailable' }, balanceBusy && !balance.ok ? '更新中…' : balanceText)) : null,
            h('span', { className: 'np-period', 'data-peak': peak.peak }, h('span', null, peak.peak ? '● 高峰时段' : '● 谷地时段'), h('small', null, peak.reason)))) : null,
        h('button', { type: 'button', className: 'np-pet-button', 'aria-label': focusState.notice ? '举牌提醒的奶蛙，点击打开摸鱼钟' : laughing ? '正在捧腹大笑的奶蛙，点击停止' : '奶蛙桌宠，左键大笑，按住拖动，右键菜单', 'aria-haspopup': 'menu', 'aria-expanded': Boolean(menu), onClick: laugh,
          onContextMenu: e => { e.preventDefault(); e.stopPropagation(); skipClick.current = true; showMenu(e.clientX, e.clientY); },
          onKeyDown: e => { if (e.key === 'ContextMenu' || e.shiftKey && e.key === 'F10') { e.preventDefault(); e.stopPropagation(); showMenu(pos.left + prefs.petSize / 2, pos.top + prefs.petSize / 2); } },
          onPointerDown: petDown, onPointerMove: petMove, onPointerUp: petUp,
          onPointerCancel: () => { clearTimeout(longPress.current); drag.current = null; setDragging(false); skipClick.current = true; }
        }, !laughing && focusFeatures && (focusState.running || focusState.notice || focusState.remaining < focusState.duration) ? h(focusFeatures.Sprite, { state: focusState, badge: true }) : h(PetSprite, { laughing, cycle: laughCycle, audioElement }))) : null,
      menu && prefs.petEnabled ? h('div', { ref: menuRef, className: 'np-context-menu', role: 'menu', 'aria-label': '奶蛙的小世界', style: { left: menuPos.left, top: menuPos.top }, onContextMenu: e => e.preventDefault() },
        h('div', { className: 'np-menu-brand' }, h('span', { className: 'np-menu-mascot' }, h('img', { src: url('pet-idle'), alt: '' })), h('span', null, h('strong', null, '奶蛙小世界'), h('small', null, '给忙碌放个小假'))),
        h('div', { className: 'np-menu-items' }, [
          ['wallpaper', '随机壁纸', '换一幅今日风景', () => { controller.random(); setMenu(null); }],
          ['notes', '奶蛙便利贴', '留住一小片灵感', () => { controller.notes?.add(); setMenu(null); }],
          ...(focusFeatures ? [['focus', '奶蛙摸鱼钟', '认真一会儿，快乐歇一会儿', () => open('focus')]] : []),
          ['puzzle', '奶蛙美图', '一片一片，拼回优雅', () => open('puzzle')],
          ['merge', '合成大奶蛙', '碰一碰，一起长大', () => open('merge')],
          ['settings', '设置', '把小世界调成喜欢的样子', () => open('settings')]
        ].map(([name, title, caption, action]) => h('button', { role: 'menuitem', type: 'button', key: name, className: 'np-menu-item np-menu-' + name, onClick: action }, h('span', { className: 'np-menu-icon' }, h(MenuIcon, { name })), h('span', { className: 'np-menu-copy' }, h('strong', null, title), h('small', null, caption)), h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }, h('path', { d: 'm9 6 6 6-6 6' })))))) : null,
      modal ? h('div', { className: 'np-modal-mask', onPointerDown: e => { if (e.target === e.currentTarget) setModal(null); } }, h('section', { ref: dialog, role: 'dialog', 'aria-modal': true, 'aria-label': titles[modal], className: 'np-dialog np-dialog-' + modal },
        h('header', { className: 'np-dialog-header' }, h('div', null, h('small', null, 'MILK FROG · PLAYROOM'), h('h2', null, titles[modal])), h('button', { type: 'button', className: 'nw-close-button', 'aria-label': '关闭奶蛙窗口', onClick: () => setModal(null) }, h(MenuIcon, { name: 'close' }))),
        ['puzzle', 'merge'].includes(modal) ? h(GameMusic, { key: modal, kind: modal }) : null,
        h('div', { className: 'np-dialog-body' }, modal === 'puzzle' ? h(Puzzle) : modal === 'merge' ? h(MergeGame) : modal === 'focus' && focusFeatures ? h(focusFeatures.Panel) : h(Settings, { close: () => setModal(null) })))) : null);
  }
  return { Pet, Settings, Controls };
}
