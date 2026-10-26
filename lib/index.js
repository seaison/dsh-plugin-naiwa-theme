import { createReadStream, readFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { registerBalance } from './balance.mjs';

export const name = 'dsh-plugin-naiwa-theme';
export const ASSET_BASE = '/naiwa-theme/assets/';

/** Only allowlisted packaged files; custom wallpapers stay in browser storage. */
export function assetRoutes() {
  const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'));
  return manifest.map(asset => {
    if (!/^[a-z0-9-]+\.(png|jpg|gif|mp4|mp3|m4a)$/.test(asset.file) || !['wallpapers', 'assets', 'media'].includes(asset.folder || 'wallpapers') || !/^[a-f0-9]{64}$/.test(asset.sha256) || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0) throw new Error('Invalid milk-frog asset manifest');
    const root = new URL('../' + (asset.folder || 'wallpapers') + '/', import.meta.url);
    const type = asset.file.endsWith('.mp4') ? 'video/mp4' : asset.file.endsWith('.mp3') ? 'audio/mpeg' : asset.file.endsWith('.m4a') ? 'audio/mp4' : asset.file.endsWith('.gif') ? 'image/gif' : asset.file.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    return {
      path: ASSET_BASE + asset.file,
      async handler(req, res) {
        const etag = `"${asset.sha256}"`;
        const version = new URL(req.url, 'http://localhost').searchParams.get('v');
        const headers = { 'content-type': type, 'x-content-type-options': 'nosniff', etag, 'accept-ranges': 'bytes', 'cache-control': version === asset.sha256.slice(0, 12) ? 'public, max-age=31536000, immutable' : 'no-cache' };
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { ...headers, allow: 'GET, HEAD' }); res.end(); return; }
        if (req.headers['if-none-match']?.split(/\s*,\s*/).some(v => v === etag || v === 'W/' + etag || v === '*')) { res.writeHead(304, headers); res.end(); return; }
        let start = 0, end = asset.bytes - 1, status = 200;
        if (req.headers.range && (!req.headers['if-range'] || req.headers['if-range'] === etag)) {
          const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
          if (range && (range[1] || range[2])) {
            if (!range[1]) { const length = Number(range[2]); start = length > 0 ? Math.max(0, asset.bytes - length) : asset.bytes; }
            else { start = Number(range[1]); if (range[2]) end = Math.min(end, Number(range[2])); }
          } else start = asset.bytes;
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= asset.bytes || end < start) {
            res.writeHead(416, { ...headers, 'content-range': `bytes */${asset.bytes}` }); res.end(); return;
          }
          status = 206; headers['content-range'] = `bytes ${start}-${end}/${asset.bytes}`;
        }
        res.writeHead(status, { ...headers, 'content-length': end - start + 1 });
        if (req.method === 'HEAD') { res.end(); return; }
        try { await pipeline(createReadStream(new URL(asset.file, root), { start, end }), res); }
        catch (error) { if (!res.destroyed) res.destroy(error); }
      }
    };
  });
}

export function apply(ctx) {
  ctx.inject(['webServer'], scope => {
    for (const route of assetRoutes()) scope.effect(() => scope.webServer.register({ kind: 'exact', ...route }), `naiwa-museum: ${route.path}`);
  });
  registerBalance(ctx);
}
