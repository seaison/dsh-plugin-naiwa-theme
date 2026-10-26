/** Local wallpaper settings, a clickable wisdom card and the startup film. */
export function createExperience(React, assets, controller, core) {
  const h = React.createElement;
  const { useState, useEffect, useRef, useSyncExternalStore } = React;
  const useStore = () => useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const url = key => assets[key]?.url || '';

  function WallpaperControls() {
    const state = useStore(), input = useRef(null);
    const [message, setMessage] = useState('');
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const importing = state.importing, custom = state.customWallpaper;
    const imported = state.prefs.wallpaperSource === 'custom' && custom;
    const load = async e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
      setMessage('');
      try { const saved = await controller.importWallpaper(file); if (alive.current && saved) setMessage('已保存到本机，并设为聊天壁纸。'); }
      catch (error) { if (alive.current) setMessage(error.message || '图片导入失败，请重试。'); }
    };
    const remove = async () => {
      try { await controller.removeWallpaper(); if (alive.current) setMessage('已移除自定义图片，恢复馆藏壁纸。'); }
      catch (error) { if (alive.current) setMessage(error.message || '图片暂时无法移除，请重试。'); }
    };
    return h('section', { className: 'nw-adjustments nw-custom-wallpaper', 'aria-label': '导入自己的聊天壁纸' },
      h('div', { className: 'nw-adjust-heading' }, h('div', null, h('h3', null, '我的风景'), h('p', null, '把喜欢的图片，放在聊天背后。图片仅保存在这台设备。')), h('span', { className: 'nw-mini-tag' }, '本机收藏')),
      h('input', { ref: input, type: 'file', accept: 'image/png,image/jpeg,image/webp,image/avif,image/gif', onChange: load, hidden: true, 'aria-label': '选择聊天壁纸图片' }),
      custom ? h('div', { className: 'nw-custom-preview' }, h('img', { src: custom.url, alt: '我的聊天壁纸预览' }), h('div', null, h('strong', null, custom.name), h('small', null, `${custom.width} × ${custom.height}`), h('span', { className: 'nw-mini-tag' }, imported ? '正在使用' : '已收藏在本机'))) : h('div', { className: 'nw-upload-empty' }, h('span', { 'aria-hidden': true }, '＋'), h('p', null, '挑一张你喜欢的风景'), h('small', null, 'JPG / PNG / WebP / AVIF / GIF · 最大 20 MB')),
      h('div', { className: 'nw-inline-actions' }, h('button', { type: 'button', className: 'nw-button nw-primary', disabled: importing, onClick: () => input.current.click() }, importing ? '正在保存…' : custom ? '换一张图片' : '导入图片'), custom ? h('button', { type: 'button', className: 'nw-button', disabled: importing || Boolean(imported), onClick: controller.useCustomWallpaper }, imported ? '已设为聊天壁纸' : '使用这张图片') : null, custom ? h('button', { type: 'button', className: 'nw-text-button', disabled: importing, onClick: remove }, '移除图片') : null),
      message ? h('p', { className: 'nw-form-message', role: 'status' }, message) : null);
  }

  function StartupControls() {
    const { prefs } = useStore();
    return h('section', { className: 'nw-adjustments nw-startup-settings', 'aria-label': '启动动画设置' },
      h('div', { className: 'nw-adjust-heading' }, h('div', null, h('h3', null, '风经过的地方'), h('p', null, '让奶蛙陪你，在湖边停留一小会儿。')), h('button', { type: 'button', className: 'nw-button', onClick: controller.previewStartup }, '预览启动动画')),
      h('label', { className: 'nw-toggle-row' }, h('span', null, '启动时播放片头', h('small', null, '尾声模糊淡出，轻轻进入聊天界面。')), h('input', { type: 'checkbox', role: 'switch', checked: prefs.startupEnabled, onChange: e => controller.update({ startupEnabled: e.target.checked }) })),
      h('label', { className: 'nw-toggle-row' }, h('span', null, '钢琴启动音', h('small', null, '轻柔的钢琴随片头播放，在进入系统时渐弱。')), h('input', { type: 'checkbox', role: 'switch', checked: prefs.startupSound, onChange: e => controller.update({ startupSound: e.target.checked }) })),
      h('label', { className: 'nw-speed-control' }, h('span', null, '播放速度'), h('select', { value: prefs.startupRate, onChange: e => controller.update({ startupRate: Number(e.target.value) }) }, [[.5, '0.5 倍 · 约 10 秒'], [.6, '0.6 倍 · 约 8.4 秒'], [.75, '0.75 倍 · 约 6.7 秒'], [1, '原速 · 约 5 秒']].map(([rate, label]) => h('option', { value: rate, key: rate }, label)))));
  }

  function InspirationAnchor({ open }) {
    const { active } = useStore();
    const action = useRef(open); action.current = open;
    useEffect(() => {
      if (!active) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'nw-inspiration-anchor';
      button.setAttribute('aria-label', '奶蛙灵感池，听一句歪道理');
      const copy = document.createElement('span'), title = document.createElement('strong'), subtitle = document.createElement('small'), hint = document.createElement('span'), frog = document.createElement('img');
      title.textContent = '奶蛙灵感池'; subtitle.textContent = '点一下，听句歪道理'; hint.textContent = '↗'; hint.className = 'nw-inspiration-arrow';
      frog.src = url('pet-idle'); frog.alt = ''; frog.draggable = false;
      copy.append(title, subtitle); button.append(copy, frog, hint);
      button.addEventListener('click', () => action.current());
      const mount = () => {
        const region = document.querySelector('[class*="_sidebarCol"] [class*="_regionArea"]');
        if (region && button.parentElement !== region) region.prepend(button);
      };
      mount();
      const observer = new MutationObserver(() => { if (!button.isConnected) mount(); });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => { observer.disconnect(); button.remove(); };
    }, [active?.id]);
    return null;
  }

  function Wisdom({ index, next, close }) {
    const dialog = useRef(null);
    useEffect(() => {
      const previous = document.activeElement;
      dialog.current.querySelector('button')?.focus({ preventScroll: true });
      const keydown = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
        if (e.key !== 'Tab') return;
        const buttons = [...dialog.current.querySelectorAll('button')], first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      };
      document.addEventListener('keydown', keydown, true);
      return () => { document.removeEventListener('keydown', keydown, true); if (previous?.isConnected) previous.focus?.({ preventScroll: true }); };
    }, []);
    return h('div', { className: 'np-modal-mask', onPointerDown: e => { if (e.currentTarget === e.target) close(); } }, h('section', { ref: dialog, className: 'np-dialog nw-wisdom-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': '奶蛙灵感池' },
      h('header', { className: 'np-dialog-header' }, h('div', null, h('small', null, 'MILK FROG · LITTLE WISDOM'), h('h2', null, '奶蛙灵感池')), h('button', { type: 'button', className: 'nw-close-button', onClick: close, 'aria-label': '关闭灵感池' }, h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', 'aria-hidden': true }, h('path', { d: 'm6 6 12 12M18 6 6 18' })))),
      h('div', { className: 'nw-wisdom-scene' }, h('span', { className: 'nw-mini-tag' }, '奶蛙不完全研究所'), h('blockquote', { key: index, role: 'status' }, core.quotes[index]), h('p', null, '听懂了也没关系，奶蛙也没懂。'), h('div', { className: 'nw-wisdom-bottom' }, h('img', { src: url('pet-idle'), alt: '' }), h('span', null, '认真摸鱼，随缘顿悟。'), h('button', { type: 'button', className: 'nw-button nw-primary', onClick: next }, '再来一句')))));
  }

  function StartupFilm({ rate, pianoEnabled, done }) {
    const video = useRef(null), piano = useRef(null), pianoElement = useRef(null), musicAttempted = useRef(false), musicWanted = useRef(pianoEnabled), layer = useRef(null), exitTimer = useRef(null), loadTimer = useRef(null), guardTimer = useRef(null), exiting = useRef(false);
    const [phase, setPhase] = useState('playing'), [blocked, setBlocked] = useState(false), [progress, setProgress] = useState(0), [sound, setSound] = useState(false);
    const [started, setStarted] = useState(false), [duration, setDuration] = useState(null);
    const timing = core.startupTiming(duration, rate);
    const captionLines = [['small', '把忙碌暂时放下'], ['h1', '风经过的地方'], ['p', '奶蛙已经到了，你也慢慢来。']];
    const characterCount = captionLines.reduce((count, [, text]) => count + Array.from(text).length, 0);
    const characterFade = Math.min(.65, timing.captionReveal * .3);
    const characterStep = (timing.captionReveal - characterFade) / (characterCount + 3);
    let characterIndex = 0;
    const caption = captionLines.map(([tag, text]) => {
      const characters = Array.from(text).map((character, index) => h('span', { key: index, className: 'nw-caption-char', style: { '--nw-char-delay': characterIndex++ * characterStep + 's' } }, character));
      characterIndex += 2;
      return h(tag, { key: tag }, h('span', { className: 'nw-sr-only' }, text), h('span', { 'aria-hidden': true }, characters));
    });
    const doneRef = useRef(done); doneRef.current = done;
    const startPiano = () => {
      if (!piano.current || !musicWanted.current || musicAttempted.current || exiting.current) return;
      musicAttempted.current = true;
      void piano.current.play({ volume: .42, fadeIn: 1100 });
    };
    const leave = () => {
      if (exiting.current) return;
      exiting.current = true; clearTimeout(loadTimer.current); clearTimeout(guardTimer.current);
      piano.current?.fadeOut(1300);
      setPhase('leaving'); document.body.setAttribute('data-naiwa-startup', 'leaving');
      exitTimer.current = setTimeout(() => doneRef.current(), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 1300);
    };
    useEffect(() => {
      const root = document.body, previous = root.getAttribute('data-naiwa-startup'), focusBefore = document.activeElement;
      const panels = [...document.querySelectorAll('[class*="_sidebarCol"], [class*="_centerCol"]')].map(node => [node, node.inert]);
      for (const [node] of panels) node.inert = true;
      root.setAttribute('data-naiwa-startup', 'playing');
      layer.current.querySelector('button')?.focus({ preventScroll: true });
      const keydown = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); leave(); }
        if (e.key === 'Tab') {
          const buttons = [...layer.current.querySelectorAll('button')], first = buttons[0], last = buttons[buttons.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      window.addEventListener('keydown', keydown, true);
      try { piano.current = core.createAudioClip(url('startup-piano'), { element: pianoElement.current, onError: error => console.warn('[naiwa] Piano audio:', error?.name || error?.code, error?.message), onState: state => setSound(state === 'playing') }); } catch { /* Film remains usable if audio is unavailable. */ }
      loadTimer.current = setTimeout(leave, 10000);
      video.current.playbackRate = rate; video.current.defaultPlaybackRate = rate;
      void video.current.play().catch(() => setBlocked(true));
      return () => {
        clearTimeout(exitTimer.current); clearTimeout(loadTimer.current); clearTimeout(guardTimer.current);
        piano.current?.dispose(); piano.current = null;
        window.removeEventListener('keydown', keydown, true);
        for (const [node, inert] of panels) node.inert = inert;
        if (focusBefore?.isConnected) focusBefore.focus?.({ preventScroll: true });
        if (previous === null) root.removeAttribute('data-naiwa-startup'); else root.setAttribute('data-naiwa-startup', previous);
      };
    }, []);
    useEffect(() => {
      musicWanted.current = pianoEnabled;
      if (!pianoEnabled) { piano.current?.stop(); musicAttempted.current = false; setSound(false); }
      else if (video.current?.readyState >= 2 && !video.current.paused) startPiano();
    }, [pianoEnabled]);
    const playing = () => {
      clearTimeout(loadTimer.current); setBlocked(false); setStarted(true);
      startPiano();
      if (!guardTimer.current) guardTimer.current = setTimeout(leave, core.startupTiming(video.current.duration, rate).guard);
    };
    const tick = () => {
      const node = video.current, timing = core.startupTiming(node.duration, rate);
      if (Number.isFinite(node.duration) && node.duration > 0) setProgress(Math.min(1, node.currentTime / node.duration));
      if (node.currentTime >= timing.transitionAt) leave();
    };
    const togglePiano = () => {
      if (exiting.current) return;
      if (sound) { musicWanted.current = false; musicAttempted.current = false; piano.current?.stop(); setSound(false); controller.update({ startupSound: false }); }
      else { musicWanted.current = true; musicAttempted.current = false; controller.update({ startupSound: true }); startPiano(); }
    };
    return h('section', { ref: layer, className: 'nw-startup-film' + (started ? ' has-started' : '') + (phase === 'leaving' ? ' is-leaving' : ''), style: { '--nw-caption-travel': timing.captionTravel + 's', '--nw-caption-char-fade': characterFade + 's' }, role: 'dialog', 'aria-modal': true, 'aria-label': '奶蛙启动动画' },
      h('audio', { ref: pianoElement, src: url('startup-piano'), preload: 'auto', hidden: true, 'aria-hidden': true }),
      h('video', { ref: video, className: 'nw-startup-video', src: url('startup'), poster: url('startup-poster'), autoPlay: true, muted: true, playsInline: true, preload: 'auto', onLoadedMetadata: e => { video.current.playbackRate = rate; setDuration(e.currentTarget.duration); }, onPlaying: playing, onTimeUpdate: tick, onEnded: leave, onError: leave, 'aria-label': '风经过的地方，湖边的奶蛙' }),
      h('div', { className: 'nw-startup-shade', 'aria-hidden': true }),
      h('div', { className: 'nw-startup-top' }, h('span', null, 'MILK FROG · A LITTLE PAUSE'), h('button', { type: 'button', onClick: leave }, '跳过片头  ↗')),
      h('div', { className: 'nw-startup-caption-track' }, h('div', { className: 'nw-startup-caption' }, caption)),
      blocked ? h('button', { type: 'button', className: 'nw-startup-play', onClick: () => { void video.current.play().then(() => setBlocked(false)).catch(() => setBlocked(true)); } }, '播放片头') : null,
      h('div', { className: 'nw-startup-bottom' }, h('button', { type: 'button', onClick: togglePiano, 'aria-pressed': sound, disabled: phase === 'leaving' }, sound ? '钢琴声已开启' : '播放钢琴声'), h('span', null, `${rate}× · 给自己一点留白`), h('div', { className: 'nw-startup-progress', 'aria-hidden': true }, h('i', { style: { transform: `scaleX(${progress})` } }))));
  }

  function Experience() {
    const { prefs, introRequest } = useStore();
    const [quote, setQuote] = useState(-1), [wisdomOpen, setWisdomOpen] = useState(false);
    const [introVisible, setIntroVisible] = useState(() => prefs.startupEnabled && !window.__naiwaStartupShown && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const [introKey, setIntroKey] = useState(0);
    useEffect(() => { if (introVisible) window.__naiwaStartupShown = true; }, [introVisible]);
    useEffect(() => { if (introRequest) { setIntroKey(n => n + 1); setIntroVisible(true); } }, [introRequest]);
    const nextQuote = () => setQuote(old => core.pickQuote(old, core.quotes.length));
    const openWisdom = () => { nextQuote(); setWisdomOpen(true); };
    return h(React.Fragment, null, h(InspirationAnchor, { open: openWisdom }), wisdomOpen ? h(Wisdom, { index: quote, next: nextQuote, close: () => setWisdomOpen(false) }) : null, introVisible ? h(StartupFilm, { key: introKey, rate: prefs.startupRate, pianoEnabled: prefs.startupSound, done: () => setIntroVisible(false) }) : null);
  }
  return { Experience, WallpaperControls, StartupControls };
}
