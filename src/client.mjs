/** Browser plugin factory; the build wraps this in DSH's shared React ModuleLoader. */
export function createPlugin(React, catalog, css, extras = {}) {
  const h = React.createElement;
  const KEY = 'dsh.naiwa-museum.v1';
  const DEFAULTS = { active: null, wallpaper: true, shade: 8, blur: 0, reading: 72, wallpaperSource: 'collection', startupEnabled: true, startupRate: .6, startupSound: true, petEnabled: true, bubble: true, sound: true, showBalance: true, petSize: 140, volume: 35, gameMusic: true, gameVolume: 22, petPosition: null, holidays: '' };
  const lookup = new Map(catalog.map(a => [a.id, a]));
  const clamp = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

  function normalize(raw) {
    const p = raw && typeof raw === 'object' ? raw : {};
    return {
      active: lookup.has(p.active) ? p.active : null,
      wallpaperSource: p.wallpaperSource === 'custom' ? 'custom' : 'collection',
      startupEnabled: typeof p.startupEnabled === 'boolean' ? p.startupEnabled : true,
      startupRate: [.5, .6, .75, 1].includes(p.startupRate) ? p.startupRate : .6,
      startupSound: typeof p.startupSound === 'boolean' ? p.startupSound : true,
      wallpaper: typeof p.wallpaper === 'boolean' ? p.wallpaper : true,
      shade: clamp(p.shade, 8, 0, 60),
      blur: clamp(p.blur, 0, 0, 16),
      reading: clamp(p.reading, 72, 45, 96),
      petEnabled: typeof p.petEnabled === 'boolean' ? p.petEnabled : true,
      bubble: typeof p.bubble === 'boolean' ? p.bubble : true,
      sound: typeof p.sound === 'boolean' ? p.sound : true,
      showBalance: typeof p.showBalance === 'boolean' ? p.showBalance : true,
      petSize: clamp(p.petSize, 140, 96, 200), volume: clamp(p.volume, 35, 0, 100),
      gameMusic: typeof p.gameMusic === 'boolean' ? p.gameMusic : true,
      gameVolume: clamp(p.gameVolume, 22, 0, 100),
      petPosition: p.petPosition && Number.isFinite(p.petPosition.x) && Number.isFinite(p.petPosition.y) ? { x: Math.max(0, Math.min(1, p.petPosition.x)), y: Math.max(0, Math.min(1, p.petPosition.y)) } : null,
      holidays: typeof p.holidays === 'string' ? p.holidays.replace(/[^0-9,，\s-]/g, '').slice(0, 2000) : ''
    };
  }

  function createController(ctx, doc, storage, services = {}) {
    let prefs;
    let warning = '';
    try { prefs = normalize(JSON.parse(storage?.getItem(KEY) || 'null')); }
    catch { prefs = { ...DEFAULTS }; }
    const media = services.media || extras.createMediaStore?.();
    const inspectImage = services.inspectWallpaper || extras.inspectWallpaper;
    const urls = services.urls || URL;
    const notesStore = extras.createNoteStore?.(storage);
    const focusStore = extras.createFocusClock?.(storage);
    let customWallpaper = null, customUrl = '', importing = false, mediaEpoch = 0, introRequest = 0;
    const listeners = new Set();
    const root = doc.body;
    const owned = new Map();
    const previousAttribute = root.getAttribute('data-naiwa-theme');
    let applied = false;
    let disposed = false;
    let bootTarget = prefs.active;
    let bootPending = Boolean(bootTarget);
    let offBoot = () => {};
    let generation = 0;
    let form;
    try { form = ctx.configForms?.get('ui-theme'); } catch {}
    let lastForm = form?.getSnapshot();
    let lastNativePreference = lastForm?.value?.preference;
    let previousTheme = ctx.theme.getTheme().preference;
    let snapshot = { prefs, active: null, warning };
    const style = doc.createElement('style');
    style.setAttribute('data-naiwa-styles', '');
    style.textContent = css;
    doc.head.appendChild(style);

    const emit = () => {
      snapshot = { prefs: { ...prefs }, active: lookup.get(ctx.theme.getTheme().preference) || null, warning, customWallpaper: customWallpaper ? { ...customWallpaper, url: customUrl } : null, importing, introRequest };
      for (const fn of listeners) fn();
    };
    const save = () => {
      try { storage?.setItem(KEY, JSON.stringify(prefs)); }
      catch { warning = '浏览器暂时无法保存偏好，本次切换仍然有效。'; }
    };
    function setVar(name, value) {
      if (!owned.has(name)) owned.set(name, [root.style.getPropertyValue(name), root.style.getPropertyPriority(name)]);
      root.style.setProperty(name, value);
    }
    function clearPresentation() {
      if (!applied) return;
      if (previousAttribute === null) root.removeAttribute('data-naiwa-theme');
      else root.setAttribute('data-naiwa-theme', previousAttribute);
      for (const [name, [value, priority]] of owned) {
        if (value) root.style.setProperty(name, value, priority);
        else root.style.removeProperty(name);
      }
      owned.clear();
      applied = false;
    }
    function paint() {
      const a = lookup.get(ctx.theme.getTheme().preference);
      if (!a) { clearPresentation(); return; }
      applied = true;
      root.setAttribute('data-naiwa-theme', a.id);
      const n = parseInt(a.base.slice(1), 16);
      setVar('--naiwa-wallpaper', prefs.wallpaper ? `url("${prefs.wallpaperSource === 'custom' && customUrl ? customUrl : a.url}")` : 'none');
      setVar('--naiwa-wallpaper-position', prefs.wallpaperSource === 'custom' && customUrl ? 'center' : '67% center');
      setVar('--naiwa-blur', `${prefs.blur}px`);
      setVar('--naiwa-brightness', String(1 - prefs.shade / 100));
      setVar('--naiwa-wash', `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${prefs.wallpaper ? prefs.reading / 100 : 1})`);
    }
    function adoptWallpaper(record) {
      if (customUrl) urls.revokeObjectURL(customUrl);
      customUrl = record ? urls.createObjectURL(record.blob) : '';
      customWallpaper = record ? { name: record.name, width: record.width, height: record.height } : null;
    }
    async function importWallpaper(file) {
      if (disposed || importing) return false;
      if (!media || !inspectImage) throw new Error('当前环境暂不支持图片导入。');
      if (!file || !/^image\/(png|jpeg|webp|avif|gif)$/.test(file.type) || !file.size || file.size > 20 * 1024 * 1024) throw new Error('请选择 20 MB 以内的 JPG、PNG、WebP、AVIF 或 GIF 图片。');
      const epoch = ++mediaEpoch; importing = true; emit();
      try {
        const dimensions = await inspectImage(file);
        const record = { blob: file, name: String(file.name || '我的壁纸').slice(0, 160), ...dimensions };
        await media.put(record);
        if (disposed || epoch !== mediaEpoch) return false;
        adoptWallpaper(record);
        if (!lookup.has(ctx.theme.getTheme().preference)) selectTheme(catalog[0].id);
        prefs = normalize({ ...prefs, wallpaperSource: 'custom', wallpaper: true });
        warning = ''; save(); paint(); return true;
      } finally { importing = false; if (!disposed) emit(); }
    }
    async function removeWallpaper() {
      if (disposed || importing || !media) return;
      ++mediaEpoch;
      await media.remove();
      if (disposed) return;
      adoptWallpaper(null); prefs = { ...prefs, wallpaperSource: 'collection' }; save(); paint(); emit();
    }
    const registrations = [];
    try {
      for (const a of catalog) registrations.push(ctx.theme.register({ id: a.id, colorScheme: a.scheme, tokens: a.tokens }));
    } catch (error) {
      for (const dispose of registrations.reverse()) dispose();
      style.remove();
      throw error;
    }
    const off = ctx.on('theme/change', () => {
      if (disposed) return;
      const current = ctx.theme.getTheme().preference;
      const incoming = form?.getSnapshot();
      if (!lookup.has(current) && prefs.active && incoming && incoming !== lastForm && incoming.value?.preference === lastNativePreference) {
        const target = prefs.active, epoch = generation;
        queueMicrotask(() => { if (!disposed && generation === epoch && prefs.active === target) ctx.theme.setTheme(target); });
        return;
      }
      if (!lookup.has(current)) previousTheme = current;
      // The native settings fetch adopts its built-in preference after plugin startup.
      // Keep the saved selection until that initial adoption has settled.
      if (bootPending) { paint(); emit(); return; }
      generation++;
      prefs = { ...prefs, active: lookup.has(current) ? current : null };
      save(); paint(); emit();
    });
    const finishBoot = () => {
      if (disposed) return;
      lastForm = form?.getSnapshot();
      lastNativePreference = lastForm?.value?.preference;
      if (!bootPending || form && !['ready', 'unavailable'].includes(lastForm.status)) return;
      bootPending = false;
      const target = bootTarget, epoch = generation;
      if (form) queueMicrotask(() => { if (!disposed && epoch === generation && prefs.active === target) ctx.theme.setTheme(target); });
      else ctx.theme.setTheme(target);
    };
    if (form) offBoot = form.subscribe(finishBoot);
    finishBoot();
    paint(); emit();
    if (media) {
      const epoch = mediaEpoch;
      void media.read().then(record => {
        if (disposed || epoch !== mediaEpoch) return;
        if (record?.blob && /^image\/(png|jpeg|webp|avif|gif)$/.test(record.blob.type) && record.width > 0 && record.height > 0) adoptWallpaper(record);
        else if (prefs.wallpaperSource === 'custom') { prefs = { ...prefs, wallpaperSource: 'collection' }; save(); }
        paint(); emit();
      }).catch(() => { if (!disposed && prefs.wallpaperSource === 'custom') { warning = '本地图片暂未读取，先显示馆藏壁纸。'; emit(); } });
    }

    function selectTheme(id) {
      if (disposed || !lookup.has(id)) return;
      generation++; bootPending = false; bootTarget = null;
      prefs = { ...prefs, wallpaperSource: 'collection' }; save();
      ctx.theme.setTheme(id); paint(); emit();
    }
    return {
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      getSnapshot() { return snapshot; },
      notes: notesStore,
      focus: focusStore,
      select: selectTheme,
      importWallpaper, removeWallpaper,
      useCustomWallpaper() {
        if (disposed || !customUrl) return;
        if (!lookup.has(ctx.theme.getTheme().preference)) selectTheme(catalog[0].id);
        prefs = { ...prefs, wallpaperSource: 'custom', wallpaper: true }; save(); paint(); emit();
      },
      previewStartup() { if (!disposed) { introRequest++; emit(); } },
      random() { const choices = catalog.filter(a => a.id !== ctx.theme.getTheme().preference); selectTheme(choices[Math.floor(Math.random() * choices.length)].id); },
      update(patch) { if (disposed) return; prefs = normalize({ ...prefs, ...patch }); save(); paint(); emit(); },
      restore() {
        if (disposed) return;
        generation++; bootPending = false; bootTarget = null;
        prefs = { ...prefs, active: null }; save();
        try { ctx.theme.setTheme(lookup.has(previousTheme) ? 'system' : previousTheme); }
        catch { ctx.theme.setTheme('system'); }
      },
      reset() {
        if (disposed) return;
        prefs = { ...prefs, wallpaper: true, shade: 8, blur: 0, reading: 72 }; save(); paint(); emit();
      },
      dispose() {
        if (disposed) return;
        disposed = true; mediaEpoch++;
        if (customUrl) urls.revokeObjectURL(customUrl);
        media?.close?.();
        notesStore?.dispose();
        focusStore?.dispose();
        off(); offBoot(); clearPresentation(); style.remove();
        for (const dispose of registrations.reverse()) dispose();
        listeners.clear();
      }
    };
  }

  function FrogIcon() {
    return h('img', { src: extras.museumIcon, alt: '', 'aria-hidden': true, draggable: false, className: 'nw-frog' });
  }

  function Range({ label, help, name, min, max, value, unit, onChange }) {
    const id = React.useId();
    return h('div', { className: 'nw-control' },
      h('div', { className: 'nw-control-heading' }, h('label', { htmlFor: id }, label), h('output', { htmlFor: id }, value + unit)),
      h('input', { id, type: 'range', name, min, max, step: 1, value, onChange: e => onChange(Number(e.target.value)) }),
      h('p', null, help));
  }

  function MuseumPanel({ controller, close, children, sections = [] }) {
    const state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    const { prefs, active } = state;
    const [failed, setFailed] = React.useState({});
    const [section, setSection] = React.useState('wallpaper');
    const instance = React.useId();
    const pages = [{ id: 'wallpaper', label: '壁纸与配色', caption: '名画 · 自己的图片' }, ...sections];
    const current = pages.find(page => page.id === section) || pages[0];
    const choose = id => { setSection(id); };
    return h('section', { className: 'nw-museum nw-settings', 'aria-label': '奶蛙美术馆', style: { '--nw-settings-pages': pages.length } },
      h('header', { className: 'nw-header' },
        h('div', { className: 'nw-brand' }, h(FrogIcon), h('span', null, '奶蛙美术馆', h('small', null, 'THE MILK FROG COLLECTION'))),
        h('span', { className: 'nw-edition' }, `主题馆藏 / ${String(catalog.length).padStart(2, '0')} 幅`)),
      h('nav', { className: 'nw-settings-nav', role: 'tablist', 'aria-label': '奶蛙设置分类' }, pages.map((page, index) => h('button', { key: page.id, id: `${instance}-tab-${page.id}`, type: 'button', role: 'tab', 'aria-selected': current.id === page.id, 'aria-controls': `${instance}-panel`, tabIndex: current.id === page.id ? 0 : -1, onClick: () => choose(page.id), onKeyDown: e => {
        let next;
        if (e.key === 'ArrowRight') next = (index + 1) % pages.length;
        else if (e.key === 'ArrowLeft') next = (index + pages.length - 1) % pages.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = pages.length - 1;
        else return;
        e.preventDefault(); choose(pages[next].id); e.currentTarget.parentElement.children[next].focus();
      } }, h('strong', null, page.label), h('small', null, page.caption)))),
      h('div', { key: current.id, id: `${instance}-panel`, className: 'nw-settings-content', role: 'tabpanel', 'aria-labelledby': `${instance}-tab-${current.id}`, tabIndex: 0 }, current.id !== 'wallpaper' ? current.content : h(React.Fragment, null,
      h('div', { className: 'nw-section-heading' }, h('div', null, h('h3', null, '选一幅画，换一种心情'), h('p', null, '选择即生效，配色与聊天壁纸一起切换。')), h('button', { className: 'nw-button', type: 'button', onClick: controller.random }, '随机一幅')),
      h('div', { className: 'nw-gallery', role: 'group', 'aria-label': '选择名画主题' },
        catalog.map((a, i) => h('button', {
          key: a.id, type: 'button', className: 'nw-art' + (active?.id === a.id && prefs.wallpaperSource !== 'custom' ? ' is-active' : ''),
          'aria-pressed': active?.id === a.id && prefs.wallpaperSource !== 'custom', 'aria-label': `使用${a.title}主题`, onClick: () => controller.select(a.id)
        },
        h('div', { className: 'nw-image' }, failed[a.id] ? h('span', { className: 'nw-image-failed' }, '壁纸暂未加载，配色仍可使用') : h('img', { src: a.url, alt: a.title, loading: 'lazy', decoding: 'async', onError: () => setFailed(old => ({ ...old, [a.id]: true })) }), h('span', { className: 'nw-number' }, '0' + (i + 1)), active?.id === a.id && prefs.wallpaperSource !== 'custom' ? h('span', { className: 'nw-selected' }, '✓ 正在使用') : null),
        h('div', { className: 'nw-art-body' }, h('div', { className: 'nw-art-line' }, h('h3', null, a.title), h('span', { className: 'nw-swatches', 'aria-hidden': true }, a.colors.map(color => h('i', { key: color, style: { backgroundColor: color } })))), h('p', { className: 'nw-art-subtitle' }, a.subtitle), h('small', { className: 'nw-artist' }, a.artist))))),
      children,
      h('div', { className: 'nw-adjustments' },
        h('div', { className: 'nw-adjust-heading' }, h('div', null, h('h3', null, '让风景刚刚好'), h('p', null, '更清晰地看画，或更专注地阅读。')), h('button', { type: 'button', className: 'nw-text-button', onClick: controller.reset }, '重置调节')),
        h('label', { className: 'nw-toggle-row' }, h('span', null, '显示聊天壁纸', h('small', null, '关闭后保留主题配色。')), h('input', { type: 'checkbox', role: 'switch', checked: prefs.wallpaper, onChange: e => controller.update({ wallpaper: e.target.checked }) })),
        h('fieldset', { className: 'nw-ranges', disabled: !prefs.wallpaper },
          h('legend', { className: 'nw-sr-only' }, '壁纸调节'),
          h(Range, { label: '阅读遮罩', help: '调高后文字更清楚，画面更柔和。', name: 'reading', min: 45, max: 96, value: prefs.reading, unit: '%', onChange: reading => controller.update({ reading }) }),
          h(Range, { label: '壁纸压暗', help: '收起一些亮度，留下画里的氛围。', name: 'shade', min: 0, max: 60, value: prefs.shade, unit: '%', onChange: shade => controller.update({ shade }) }),
          h(Range, { label: '背景模糊', help: '0 保留笔触，调高后更适合专注。', name: 'blur', min: 0, max: 16, value: prefs.blur, unit: ' px', onChange: blur => controller.update({ blur }) }))))),
      h('footer', { className: 'nw-footer' }, h('span', { 'aria-live': 'polite' }, state.warning || (prefs.wallpaperSource === 'custom' && state.customWallpaper ? `我的壁纸 · ${state.customWallpaper.name}` : active ? `当前馆藏 · ${active.title} · 更改自动保存` : '点击一幅画，开启奶蛙主题。')), h('div', null, h('button', { type: 'button', className: 'nw-button', disabled: !active, onClick: controller.restore }, '恢复原来主题'), close ? h('button', { type: 'button', className: 'nw-button nw-primary', onClick: close }, '完成') : null)));
  }

  function apply(ctx) {
    let controller;
    let features, experience, focusFeatures, NotesOverlay;
    ctx.effect(() => {
      let storage;
      try { storage = window.localStorage; } catch { /* preference persistence is optional */ }
      controller = createController(ctx, document, storage);
      if (controller.notes && extras.createNotes) NotesOverlay = extras.createNotes(React, controller, extras.museumIcon, extras.core);
      if (extras.createExperience) experience = extras.createExperience(React, extras.assets, controller, extras.core);
      if (controller.focus && extras.createFocusFeatures) focusFeatures = extras.createFocusFeatures(React, controller, extras.assets);
      if (extras.createFeatures) features = extras.createFeatures(React, extras.assets, controller, MuseumPanel, extras.core, experience, focusFeatures);
      return () => controller.dispose();
    }, 'naiwa-museum: themes, wallpaper and preferences');
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section', id: 'naiwa-museum', order: 42, label: () => '奶蛙美术馆'
    }, props => features ? h(features.Settings, { close: props.close }) : h(MuseumPanel, { controller, close: props.close })));
    if (experience) ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'naiwa-experience', order: 90 }, () => h(experience.Experience)));
    if (NotesOverlay) ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'naiwa-notes', order: 100 }, () => h(NotesOverlay)));
    if (focusFeatures) ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'naiwa-focus', order: 95 }, () => h(focusFeatures.Overlay)));
    if (features) ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'naiwa-playroom', order: 80 }, () => h(features.Pet)));
  }

  return { apply, inject: ['theme', 'slots', 'configForms'], createController, normalize };
}
