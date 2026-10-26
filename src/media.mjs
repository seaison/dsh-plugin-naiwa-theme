/** One private, browser-local wallpaper. No upload endpoint or file paths. */
export function createLocalMediaStore(factory = typeof indexedDB === 'undefined' ? null : indexedDB) {
  let pending, database, closed = false;
  const open = () => {
    if (closed) return Promise.reject(new Error('壁纸存储已关闭。'));
    if (!factory) return Promise.reject(new Error('当前环境不支持本地图片存储。'));
    return pending ||= new Promise((resolve, reject) => {
      const request = factory.open('dsh.naiwa.media.v1', 1);
      const timer = setTimeout(() => reject(new Error('本地壁纸存储暂时不可用，请关闭旧窗口后重试。')), 8000);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('wallpapers')) request.result.createObjectStore('wallpapers'); };
      request.onerror = () => { clearTimeout(timer); pending = null; reject(request.error || new Error('无法打开本地壁纸存储。')); };
      request.onsuccess = () => {
        clearTimeout(timer); database = request.result;
        if (closed) { database.close(); reject(new Error('壁纸存储已关闭。')); return; }
        database.onversionchange = () => { database.close(); database = null; pending = null; };
        resolve(database);
      };
    });
  };
  const run = async (mode, action) => {
    const db = await open();
    if (closed) throw new Error('壁纸存储已关闭。');
    return new Promise((resolve, reject) => {
      const tx = db.transaction('wallpapers', mode);
      const request = action(tx.objectStore('wallpapers'));
      let result;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(tx.error || request.error || new Error('图片无法保存，可能是本地存储空间不足。'));
    });
  };
  return {
    read: () => run('readonly', store => store.get('custom')),
    put: record => run('readwrite', store => store.put(record, 'custom')),
    remove: () => run('readwrite', store => store.delete('custom')),
    close() { closed = true; database?.close(); }
  };
}

export async function inspectWallpaper(file) {
  if (!file || !/^image\/(png|jpeg|webp|avif|gif)$/.test(file.type) || !file.size || file.size > 20 * 1024 * 1024) throw new Error('请选择 20 MB 以内的 JPG、PNG、WebP、AVIF 或 GIF 图片。');
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => { image.src = ''; reject(new Error('图片读取超时，请换一张图片。')); }, 12000);
      image.onload = () => {
        clearTimeout(timer);
        if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 50000000) reject(new Error('图片尺寸过大，请使用 5000 万像素以内的图片。'));
        else resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => { clearTimeout(timer); reject(new Error('这张图片无法读取，请尝试其他格式。')); };
      image.src = objectUrl;
    });
  } finally { URL.revokeObjectURL(objectUrl); }
}
