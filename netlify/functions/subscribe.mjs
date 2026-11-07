// Guarda en qué está suscrito cada teléfono (equipos, partidos y qué avisos quiere).
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: CORS });
  if (req.method !== 'POST') return new Response('POST', { status: 405, headers: CORS });
  let body;
  try { body = await req.json(); } catch { return new Response('JSON', { status: 400, headers: CORS }); }
  const sub = body && body.sub;
  if (!sub || !sub.endpoint || !/^https:\/\//.test(sub.endpoint)) return new Response('sub', { status: 400, headers: CORS });
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 200).map(x => ({
    t: x.t === 'game' ? 'game' : 'team', lg: String(x.lg || '').slice(0, 20), id: String(x.id || '').slice(0, 20), k: String(x.k || '').slice(0, 60),
    p: Object.fromEntries(Object.entries(x.p || {}).filter(([k]) => /^[a-z]{2,8}$/.test(k)).map(([k, v]) => [k, !!v]))
  }));
  const str = (v, n = 80) => String(v ?? '').slice(0, n);
  const num = v => (v === null || v === undefined || v === '' || !isFinite(Number(v))) ? null : Number(v);
  const parlays = (Array.isArray(body.parlays) ? body.parlays : []).slice(0, 30).map(P => ({
    id: str(P.id, 40), name: str(P.name, 60), pay: num(P.pay),
    legs: (Array.isArray(P.legs) ? P.legs : []).slice(0, 25).map(L => ({
      id: str(L.id, 40), key: str(L.key, 60), lg: str(L.lg, 20), t: str(L.t, 10), side: str(L.side, 6), line: num(L.line), ou: str(L.ou, 6),
      mk: str(L.mk, 12), ath: str(L.ath, 20), an: str(L.an, 60), m: str(L.m, 8), sel: str(L.sel, 8), ti: str(L.ti, 90), sh: str(L.sh, 50),
      rc: L.rc && typeof L.rc === 'object' ? { m: str(L.rc.m, 6), k: (Array.isArray(L.rc.k) ? L.rc.k : []).slice(0, 8).map(x => str(x, 30)) } : null
    }))
  }));
  const key = crypto.createHash('sha256').update(sub.endpoint).digest('hex').slice(0, 32);
  const store = getStore('subs');
  if (!items.length && !parlays.length) { await store.delete(key); return Response.json({ ok: true, items: 0 }, { headers: CORS }); }
  await store.setJSON(key, { sub, items, parlays, at: Date.now() });
  return Response.json({ ok: true, items: items.length, parlays: parlays.length }, { headers: CORS });
};

export const config = { path: '/subscribe' };
