// Lee capturas de boletos con Gemini (Google AI Studio, plan gratis, sin facturación). La llave vive en la variable GEMINI_KEY de Netlify.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

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
  for (const m of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload)
      });
      if (!r.ok) { console.log(m, r.status, (await r.text()).slice(0, 300)); continue; }
      const j = await r.json();
      const txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      const clean = txt.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
      return Response.json({ data: JSON.parse(clean), model: m }, { headers: CORS });
    } catch (e) { console.log(m, 'err', e.message); }
  }
  return Response.json({ error: 'fail' }, { status: 502, headers: CORS });
};
export const config = { path: '/read' };
