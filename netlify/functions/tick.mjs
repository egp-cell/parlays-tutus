// Cada minuto revisa los marcadores de ESPN de lo que sigue cada quien y manda los avisos.
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

const LG = {"nfl":["football","nfl","football","NFL"],"ucl":["soccer","uefa.champions","soccer","Champions League"],"ligamx":["soccer","mex.1","soccer","Liga MX"],"f1":["racing","f1","racing","Fórmula 1"],"epl":["soccer","eng.1","soccer","Premier League"],"laliga":["soccer","esp.1","soccer","LaLiga"],"nba":["basketball","nba","basketball","NBA"],"mlb":["baseball","mlb","baseball","MLB"],"uel":["soccer","uefa.europa","soccer","Europa League"],"mls":["soccer","usa.1","soccer","MLS"],"concachamp":["soccer","concacaf.champions","soccer","Concacaf Champions Cup"],"seriea":["soccer","ita.1","soccer","Serie A"],"bundes":["soccer","ger.1","soccer","Bundesliga"],"ligue1":["soccer","fra.1","soccer","Ligue 1"],"lib":["soccer","conmebol.libertadores","soccer","Copa Libertadores"],"nhl":["hockey","nhl","hockey","NHL"],"atp":["tennis","atp","tennis","Tenis ATP"],"wta":["tennis","wta","tennis","Tenis WTA"],"pga":["golf","pga","golf","Golf PGA Tour"],"cfb":["football","college-football","football","NCAA Football"],"uecl":["soccer","uefa.europa.conf","soccer","Conference League"],"port":["soccer","por.1","soccer","Liga Portugal"],"ered":["soccer","ned.1","soccer","Eredivisie"],"champ":["soccer","eng.2","soccer","Championship"],"arg":["soccer","arg.1","soccer","Liga Argentina"],"bra":["soccer","bra.1","soccer","Brasileirão"],"tur":["soccer","tur.1","soccer","Süper Lig"],"sco":["soccer","sco.1","soccer","Premiership"],"ncaab":["basketball","mens-college-basketball","basketball","NCAA Basketball"],"wnba":["basketball","wnba","basketball","WNBA"]};
const B = 'https://site.api.espn.com/apis/site/v2/sports/';
const ymd = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' })); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
const get = async u => { try { const r = await fetch(u, { headers: { 'cache-control': 'no-cache' } }); return r.ok ? r.json() : null; } catch { return null; } };

function team(x) { const t = x.team || {}; const sc = typeof x.score === 'object' ? Number(x.score?.value ?? x.score?.displayValue) : Number(x.score); return { id: String(t.id || ''), abbr: t.abbreviation || '', name: t.shortDisplayName || t.displayName || '', score: isFinite(sc) ? sc : 0 }; }
function games(lg, j) {
  const kind = LG[lg][2]; const out = [];
  for (const e of j?.events || []) {
    if (kind === 'tennis') {
      for (const gr of e.groupings || []) { if (/double/i.test(gr.grouping?.displayName || '')) continue;
        for (const c of gr.competitions || []) { const f = h => { const x = (c.competitors || []).find(q => q.homeAway === h) || {}; const ls = x.linescores || []; return { id: String(x.id || ''), name: x.athlete?.displayName || '', score: ls.filter(l => l.winner).length, sets: ls.map(l => l.value), win: !!x.winner }; };
          out.push({ key: lg + ':' + c.id, lg, kind, tour: e.name, state: c.status?.type?.state || 'pre', home: f('home'), away: f('away') }); } }
      continue;
    }
    if (kind === 'racing' || kind === 'golf') {
      const cs = e.competitions || []; const st = cs.some(c => c.status?.type?.state === 'in') ? 'in' : (e.status?.type?.state || 'pre');
      out.push({ key: lg + ':' + e.id, lg, kind, name: e.name, state: st, ses: cs.map(c => ({ ab: c.type?.abbreviation || '', st: c.status?.type?.state || 'pre', res: (c.competitors || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99)).map(x => x.athlete?.displayName || '') })),
        lead: kind === 'golf' ? ((cs[0]?.competitors || []).slice().sort((a, b) => (a.order || 999) - (b.order || 999))[0]?.athlete?.displayName || '') : '', rd: kind === 'golf' ? (cs[0]?.status?.period || 0) + '|' + (cs[0]?.status?.type?.detail || '') : '' });
      continue;
    }
    const c = (e.competitions || [])[0] || {}; const s = c.status || e.status || {}; const f = h => team((c.competitors || []).find(k => k.homeAway === h) || {});
    out.push({ key: lg + ':' + e.id, lg, kind, state: s.type?.state || 'pre', stn: s.type?.name || '', per: s.period || 0, clk: s.displayClock || '', det: (s.type?.shortDetail || ''), date: e.date,
      home: f('home'), away: f('away'), reds: (c.details || []).filter(d => d.redCard).length, goals: (c.details || []).filter(d => d.scoringPlay).map(d => ({ t: String(d.team?.id || ''), who: d.athletesInvolved?.[0]?.displayName || '', clk: d.clock?.displayValue || '' })) });
  }
  return out;
}
const GP = n => String(n || '').replace(/^.*?((Australian|Chinese|Japanese|Bahrain|Saudi Arabian|Miami|Canadian|Monaco|Barcelona|Spanish|Austrian|British|Belgian|Hungarian|Dutch|Italian|Azerbaijan|Singapore|United States|Mexico City|São Paulo|Las Vegas|Qatar|Abu Dhabi)[^]*)$/i, '$1');
// Qué pasó entre la revisión anterior y esta: lista de [preferencia, título, texto, tag]
function events(g, p) {
  const ev = []; if (!p) return ev; const A = (k, t, b, tag) => ev.push([k, t, b, g.key + ':' + tag]);
  if (g.kind === 'racing') { g.ses.forEach((s, i) => { const w = p.ses?.[i]?.st; if (!w || w === s.st) return; const grp = /^FP/.test(s.ab) ? 'prac' : /^(Qual|SQ)$/.test(s.ab) ? 'qual' : /^(SR|Sprint|SS)$/.test(s.ab) ? 'sprint' : s.ab === 'Race' ? 'race' : '';
      const nm = { FP1: 'Práctica 1', FP2: 'Práctica 2', FP3: 'Práctica 3', Qual: 'Clasificación', Race: 'Carrera', SQ: 'Clasif. sprint', SR: 'Sprint', Sprint: 'Sprint', SS: 'Sprint' }[s.ab] || s.ab;
      if (w === 'pre' && s.st === 'in') A(grp, 'Arrancó: ' + nm, GP(g.name), 's' + i);
      if (w !== 'post' && s.st === 'post' && s.res.length) { if (grp === 'race') A('result', '🏁 Ganó ' + s.res[0], '2º ' + (s.res[1] || '') + ' · 3º ' + (s.res[2] || ''), 'f' + i); else if (grp === 'qual') A('qual', 'Pole: ' + s.res[0], GP(g.name), 'f' + i); else if (grp === 'sprint') A('sprint', 'Sprint: ganó ' + s.res[0], GP(g.name), 'f' + i); } }); return ev; }
  if (g.kind === 'golf') { if (p.state === 'pre' && g.state === 'in') A('round', '⛳ Arrancó ' + g.name, 'Ronda 1', 's');
    if (g.rd !== p.rd && /Complete/i.test(g.rd)) A('rend', 'Terminó la ronda ' + g.rd.split('|')[0], g.name + ' · Va arriba ' + g.lead, 'r' + g.rd.split('|')[0]);
    if (g.state === 'in' && g.lead && p.lead && g.lead !== p.lead) A('leader', 'Nuevo líder: ' + g.lead, g.name, 'l' + g.lead);
    if (p.state !== 'post' && g.state === 'post') A('final', '🏆 ' + g.lead + ' gana ' + g.name, '', 'f'); return ev; }
  if (g.kind === 'tennis') { const ln = g.away.name.split(' ').pop() + ' ' + g.away.score + '–' + g.home.score + ' ' + g.home.name.split(' ').pop();
    if (p.state === 'pre' && g.state === 'in') A('start', '🎾 Empezó ' + g.away.name + ' vs ' + g.home.name, g.tour, 's');
    const who = g.home.score > p.h ? g.home : g.away.score > p.a ? g.away : null; if (who && g.state === 'in') A('set', 'Set para ' + who.name, ln + ' en sets', 'p' + g.home.score + '-' + g.away.score);
    if (p.state !== 'post' && g.state === 'post') { const w = g.home.win ? g.home : g.away; A('final', '🏆 Ganó ' + w.name, g.tour + ' · ' + ln, 'f'); } return ev; }
  const vs = g.away.name + ' vs ' + g.home.name, line = g.away.abbr + ' ' + g.away.score + ' – ' + g.home.score + ' ' + g.home.abbr;
  if (p.state === 'pre' && g.state === 'in') A('start', 'Empezó: ' + vs, LG[g.lg][3], 's');
  const dh = g.home.score - p.h, da = g.away.score - p.a, who = dh > 0 ? g.home : da > 0 ? g.away : null;
  if (who && g.state !== 'pre') { const d = Math.max(dh, da), tag = 'p' + g.home.score + '-' + g.away.score;
    if (g.kind === 'soccer') { const gl = g.goals.filter(x => x.t === who.id).pop(); A('goal', '⚽ ¡Gol de ' + who.name + '!', (gl && gl.who ? gl.who + ' ' + gl.clk + ' · ' : '') + line, tag); }
    else if (g.kind === 'hockey') A('goal', '🏒 ¡Gol de ' + who.name + '!', line + ' · ' + g.det, tag);
    else if (g.kind === 'football') A('score', d >= 6 ? '🏈 Touchdown de ' + who.name : d === 3 ? 'Gol de campo de ' + who.name : 'Anotación de ' + who.name, line + ' · ' + g.det, tag);
    else if (g.kind === 'baseball') A('score', '⚾ ' + (d > 1 ? d + ' carreras' : 'Carrera') + ' de ' + who.name, line + ' · ' + g.det, tag); }
  if (g.kind === 'soccer' && g.reds > (p.reds || 0)) A('red', '🟥 Tarjeta roja', line, 'rc' + g.reds);
  if (/HALFTIME/.test(g.stn) && !/HALFTIME/.test(p.stn || '')) A('half', 'Medio tiempo: ' + line, vs, 'ht');
  if (/END_PERIOD/.test(g.stn) && !/END_PERIOD/.test(p.stn || '')) A('period', 'Fin del ' + g.per + 'º ' + (g.kind === 'hockey' ? 'periodo' : 'cuarto'), line, 'pe' + g.per);
  if (g.state === 'in' && !p.close && g.per >= 4 && Number(String(g.clk).split(':')[0]) < 5 && Math.abs(g.home.score - g.away.score) <= (g.kind === 'basketball' ? 5 : 8) && (g.kind === 'basketball' || g.kind === 'football')) { A('close', '🔥 Final cerrado: ' + line, g.det + ' · ' + vs, 'cl'); g.close = 1; }
  if (p.close) g.close = 1;
  if (p.state !== 'post' && g.state === 'post') A('final', 'Final: ' + line, LG[g.lg][3], 'f');
  return ev;
}
const snap = g => ({ state: g.state, h: g.home?.score || 0, a: g.away?.score || 0, stn: g.stn || '', reds: g.reds || 0, ses: g.ses, lead: g.lead, rd: g.rd, close: g.close || 0 });

export default async () => {
  const pub = process.env.VAPID_PUBLIC, priv = process.env.VAPID_PRIVATE;
  if (!pub || !priv) return new Response('Faltan llaves VAPID', { status: 500 });
  webpush.setVapidDetails('mailto:avisos@tutus-score.app', pub, priv);
  const subsStore = getStore('subs'), stateStore = getStore('state');
  const { blobs } = await subsStore.list();
  const subs = (await Promise.all(blobs.map(async b => ({ key: b.key, v: await subsStore.get(b.key, { type: 'json' }) })))).filter(x => x.v);
  if (!subs.length) return new Response('sin suscriptores');
  const lgs = [...new Set(subs.flatMap(s => s.v.items.map(i => i.lg)).filter(l => LG[l]))];
  const day = ymd(); const all = [];
  await Promise.all(lgs.map(async lg => { const [sp, lgp] = LG[lg]; const j = await get(B + sp + '/' + lgp + '/scoreboard' + (LG[lg][2] === 'tennis' ? '' : '?dates=' + day)); if (j) all.push(...games(lg, j)); }));
  const prev = (await stateStore.get('prev', { type: 'json' })) || {}; const next = {};
  let sent = 0;
  for (const g of all) {
    const p = prev[g.key]; const evs = events(g, p); next[g.key] = snap(g);
    if (!evs.length) continue;
    for (const s of subs) {
      const fol = s.v.items.filter(i => i.lg === g.lg && (i.t === 'game' ? i.k === g.key : (i.id && (i.id === g.home?.id || i.id === g.away?.id))));
      if (!fol.length) continue;
      const P = {}; fol.forEach(i => Object.entries(i.p || {}).forEach(([k, v]) => { if (v) P[k] = true; }));
      for (const [k, title, body, tag] of evs) { if (!P[k]) continue;
        try { await webpush.sendNotification(s.v.sub, JSON.stringify({ title, body, tag, k: g.key }), { TTL: 600, urgency: 'high' }); sent++; }
        catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { await subsStore.delete(s.key); s.v.items = []; } } }
    }
  }
  // Guarda solo lo de hoy (con lo anterior de juegos que siguen en la lista)
  await stateStore.setJSON('prev', next);
  return new Response('ok · ' + all.length + ' juegos · ' + sent + ' avisos');
};

export const config = { schedule: '* * * * *' };
