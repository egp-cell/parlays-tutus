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
  const key = crypto.createHash('sha256').update(sub.endpoint).digest('hex').slice(0, 32);
  const store = getStore('subs');
  if (!items.length) { await store.delete(key); return Response.json({ ok: true, items: 0 }, { headers: CORS }); }
  await store.setJSON(key, { sub, items, at: Date.now() });
  return Response.json({ ok: true, items: items.length }, { headers: CORS });
};

export const config = { path: '/subscribe' };
