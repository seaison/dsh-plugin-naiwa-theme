export const BALANCE_PATH = '/naiwa-theme/balance.json';

export function trustedBalanceRequest(req) {
  const host = String(req.headers.host || '').toLowerCase();
  const authority = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  if (!['127.0.0.1', 'localhost', '::1'].includes(authority)) return false;
  if (['cross-site'].includes(req.headers['sec-fetch-site']) || req.headers.forwarded || req.headers['x-forwarded-for']) return false;
  if (req.headers.origin) {
    try { const origin = new URL(req.headers.origin); if (!['http:', 'https:'].includes(origin.protocol) || origin.host.toLowerCase() !== host) return false; }
    catch { return false; }
  }
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
}

export function parseBalance(data) {
  const wallets = Array.isArray(data?.balance_infos) ? data.balance_infos : [];
  const wallet = wallets.find(w => w?.currency === 'CNY') || wallets.find(w => w?.currency === 'USD');
  const value = wallet?.total_balance;
  if (!['number', 'string'].includes(typeof value) || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value).trim()) || !Number.isFinite(Number(value))) return null;
  return { ok: true, available: data.is_available !== false, balance: Number(value), currency: wallet.currency, text: (wallet.currency === 'CNY' ? '¥' : '$') + Number(value).toFixed(2), at: Date.now() };
}

export function registerBalance(ctx) {
  ctx.inject(['webServer', 'credentials'], scope => {
    const lifecycle = new AbortController();
    let cache = null, inFlight = null;
    const read = () => {
      if (cache && Date.now() - cache.at < 60000) return Promise.resolve(cache);
      if (inFlight) return inFlight;
      inFlight = (async () => {
        try {
          const credential = await scope.credentials.resolve('DEEPSEEK_API_KEY');
          const key = typeof credential === 'string' ? credential : credential?.value;
          if (typeof key !== 'string' || !key.trim()) return { ok: false, code: 'NO_KEY' };
          const response = await fetch('https://api.deepseek.com/user/balance', { headers: { authorization: 'Bearer ' + key }, signal: AbortSignal.any([lifecycle.signal, AbortSignal.timeout(10000)]) });
          if (!response.ok) return { ok: false, code: response.status === 401 ? 'AUTH' : 'UPSTREAM' };
          const result = parseBalance(await response.json());
          if (result && !lifecycle.signal.aborted) cache = result;
          return result || { ok: false, code: 'UNAVAILABLE' };
        } catch { return { ok: false, code: 'UNAVAILABLE' }; }
        finally { inFlight = null; }
      })();
      return inFlight;
    };
    scope.effect(() => () => lifecycle.abort(), 'naiwa: balance requests');
    scope.effect(() => scope.webServer.register({ kind: 'exact', path: BALANCE_PATH, async handler(req, res) {
      const send = (status, data) => { if (!res.destroyed) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(req.method === 'HEAD' ? undefined : JSON.stringify(data)); } };
      if (!trustedBalanceRequest(req)) return send(403, { ok: false, code: 'FORBIDDEN' });
      if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('allow', 'GET, HEAD'); return send(405, { ok: false, code: 'METHOD' }); }
      send(200, await read());
    } }), 'naiwa: balance route');
  });
}
