/** Local, independent note storage. Closing a note archives it for later use. */
export function createNoteStore(storage) {
  const key = 'dsh.naiwa-notes.v1', listeners = new Set();
  let notes = [], warning = '', disposed = false, snapshot;
  const normalize = value => {
    const seen = new Set();
    return (Array.isArray(value) ? value : []).slice(0, 100).flatMap(note => {
      if (!note || typeof note.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(note.id) || seen.has(note.id)) return [];
      seen.add(note.id);
      return [{ id: note.id, text: typeof note.text === 'string' ? note.text.slice(0, 10000) : '', x: Number.isFinite(note.x) ? Math.max(0, Math.min(10000, note.x)) : 350, y: Number.isFinite(note.y) ? Math.max(0, Math.min(10000, note.y)) : 130, pinned: note.pinned === true, hidden: note.hidden === true }];
    });
  };
  try { notes = normalize(JSON.parse(storage?.getItem(key) || '[]')); } catch { warning = '便签存档暂时无法读取。'; }
  const emit = () => { snapshot = { notes, warning }; for (const listener of listeners) listener(); };
  const save = () => {
    try { storage?.setItem(key, JSON.stringify(notes)); warning = ''; }
    catch { warning = '本次便签暂未保存到本机，请先复制保留。'; }
    emit();
  };
  emit();
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot() { return snapshot; },
    add(position = {}) {
      if (disposed) return null;
      if (notes.length >= 100) { warning = '已保留 100 张便签，请先使用现有便签。'; emit(); return null; }
      const id = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      const offset = notes.filter(note => !note.hidden).length % 6 * 24;
      const viewportWidth = globalThis.window?.innerWidth || 1440;
      notes = normalize([...notes, { id, text: '', x: position.x ?? Math.max(12, viewportWidth - 280 - 28 - offset), y: (position.y ?? 112) + offset }]);
      save(); return id;
    },
    update(id, patch) {
      if (disposed) return;
      notes = normalize(notes.map(note => note.id !== id ? note : { ...note, text: patch.text ?? note.text, pinned: typeof patch.pinned === 'boolean' ? patch.pinned : note.pinned, x: note.pinned ? note.x : patch.x ?? note.x, y: note.pinned ? note.y : patch.y ?? note.y }));
      save();
    },
    hide(id) { if (!disposed) { notes = notes.map(note => note.id === id ? { ...note, hidden: true } : note); save(); } },
    restoreHidden() { if (!disposed) { notes = notes.map(note => ({ ...note, hidden: false })); save(); } },
    dispose() { disposed = true; listeners.clear(); }
  };
}

export function placeStickyNote(note, viewport) {
  const width = Math.min(280, Math.max(1, viewport.width - 24));
  const height = Math.min(338, Math.max(1, viewport.height - 124));
  const minY = Math.min(112, Math.max(12, viewport.height - height - 12));
  return { x: Math.max(12, Math.min(viewport.width - width - 12, note.x)), y: Math.max(minY, Math.min(viewport.height - height - 12, note.y)), width, height };
}
