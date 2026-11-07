// Lee capturas de boletos con Gemini (Google AI Studio, plan gratis, sin facturación). La llave vive en la variable GEMINI_KEY de Netlify.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
const MODELS = ['gemini-3.8-flash', 'gemini-flash-lite-latest', 'gemini-flash-latest'];

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: CORS });
  if (req.method !== 'POST') return new Response('POST', { status: 405, headers: CORS });
  const key = process.env.GEMINI_KEY;
  if (!key) return Response.json({ error: 'nokey' }, { status: 503, headers: CORS });
  let body;
  try { body = await req.json(); } catch { return new Response('JSON', { status: 400, headers: CORS }); }
  const prompt = String(body.prompt || '').slice(0, 20000);
  const imgs = (Array.isArray(body.images) ? body.images : []).slice(0, 6)
    .filter(x => x && /^image\/(jpeg|png|webp)$/.test(x.type) && typeof x.data === 'string' && x.data.length < 2_500_000);
  if (!prompt || !imgs.length) return new Response('bad', { status: 400, headers: CORS });
  const payload = {
    contents: [{ parts: [{ text: prompt }, ...imgs.map(x => ({ inline_data: { mime_type: x.type, data: x.data } }))] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 }
  };
  const t0 = Date.now();
  const tries = [];
  for (const m of MODELS) tries.push([m, { thinkingConfig: { thinkingLevel: 'low' } }], [m, {}]);
  for (const [m, extra] of tries) {
    const left = 27000 - (Date.now() - t0); if (left < 3000) break;
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), Math.min(14000, left));
    try {
      const body2 = { ...payload, generationConfig: { ...payload.generationConfig, ...extra } };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body2), signal: ctl.signal
      });
      if (!r.ok) { console.log(m, JSON.stringify(extra), r.status, (await r.text()).slice(0, 200)); if (r.status === 400 && extra.thinkingConfig) continue; if (extra.thinkingConfig) tries.splice(tries.findIndex(t => t[0] === m && !t[1].thinkingConfig), 1); continue; }
      const j = await r.json();
      const txt = (j.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
      const clean = txt.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
      console.log(m, 'ok', Date.now() - t0, 'ms');
      return Response.json({ data: JSON.parse(clean), model: m }, { headers: CORS });
    } catch (e) { console.log(m, 'err', e.name, e.message, Date.now() - t0); } finally { clearTimeout(to); }
  }
  return Response.json({ error: 'fail' }, { status: 502, headers: CORS });
};
export const config = { path: '/read' };
