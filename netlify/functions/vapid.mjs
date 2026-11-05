// Llave pública para que los teléfonos se suscriban. La primera vez crea el par de llaves y lo guarda en Netlify Blobs.
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

export default async () => {
  const st = getStore('cfg');
  let k = await st.get('vapid', { type: 'json' });
  if (!k) { k = webpush.generateVAPIDKeys(); await st.setJSON('vapid', k); }
  return Response.json({ key: k.publicKey }, { headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=3600' } });
};

export const config = { path: '/vapid' };
