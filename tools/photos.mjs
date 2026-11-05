// Robot de fotos de Tutus Score.
// Junta a todos los futbolistas de las ligas de la app (plantillas de ESPN) y busca su foto profesional
// recortada en TheSportsDB (gratis). Guarda todo en photos.json para que la app las muestre al instante.
// TheSportsDB gratis permite ~30 consultas por minuto, por eso avanza poco a poco y guarda su progreso.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const LEAGUES = ['mex.1','uefa.champions','uefa.europa','uefa.europa.conf','eng.1','esp.1','ita.1','ger.1','fra.1','ned.1','por.1','eng.2','tur.1','sco.1','usa.1','conmebol.libertadores','concacaf.champions','arg.1','bra.1'];
const SHARD = Number(process.env.SHARD || 0), SHARDS = Number(process.env.SHARDS || 1);
const FILE = SHARDS > 1 ? `photos-${SHARD}.json` : 'photos.json';
const START = Date.now();
const MAXMS = 5.3 * 3600e3;          // GitHub corta a las 6 h; se detiene antes y guarda
const GAP = 2200;                    // pausa entre consultas a TheSportsDB (~27 por minuto)
const RETRY_DAYS = 21;               // reintenta jugadores sin foto cada 3 semanas
const TSDB = 'https://www.thesportsdb.com/api/v1/json/123/';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const today = Math.floor(Date.now() / 864e5);

let db = { v: 1, p: {}, t: {} };
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
db.p = db.p || {}; db.t = db.t || {}; db.f = db.f || {};
// Lo que ya encontraron los otros robots (o la corrida anterior) no se vuelve a buscar
const known = {};
for (const f of fs.readdirSync('.').filter(f => /^photos(-\d+)?\.json$/.test(f) && f !== FILE)) {
  try { const o = JSON.parse(fs.readFileSync(f, 'utf8')); Object.entries(o.p || {}).forEach(([k, v]) => { if (v) known[k] = v; }); } catch {}
}
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

async function getJSON(u, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'tutus-score-photos' } });
      if (r.status === 429) { await sleep(65000); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch { await sleep(5000); }
  }
  return null;
}
// Segunda fuente gratis: FotMob (fotos uniformes de casi todos los futbolistas profesionales)
async function fotmob(name, team) {
  const j = await getJSON('https://www.fotmob.com/api/search/suggest?lang=en&term=' + encodeURIComponent(name), 2);
  if (!j) return null;
  const opts = [];
  const add = (id, nm, tm) => { if (id) opts.push({ id: String(id), name: nm || '', team: tm || '' }); };
  (Array.isArray(j) ? j : [j]).forEach(g => {
    (g.suggestions || []).forEach(x => { if (x.type === 'player') add(x.id, x.name, x.teamName); });
    (g.squadMemberSuggest || []).forEach(b => (b.options || []).forEach(o => add(o.payload?.id || String(o.text || '').split('|')[1], String(o.text || '').split('|')[0], o.payload?.teamName)));
  });
  if (!opts.length) return '';
  const tw = norm(team).split(' ').filter(w => w.length > 2), nw = norm(name).split(' ');
  const last = nw[nw.length - 1];
  const pick = opts.find(o => tw.some(t => norm(o.team).includes(t)) && norm(o.name).includes(last)) || (opts.length === 1 && norm(opts[0].name).includes(last) ? opts[0] : null);
  return pick ? 'f' + pick.id : '';
}
// Guarda solo el nombre del archivo para que photos.json pese poco
const enc = u => {
  if (!u) return '';
  let m = u.match(/\/player\/cutout\/([^/]+)\.png$/); if (m) return 'c' + m[1];
  m = u.match(/\/player\/thumb\/([^/]+)\.(jpg|png)$/); if (m) return (m[2] === 'png' ? 'p' : 't') + m[1];
  return 'u' + u;
};
const save = () => fs.writeFileSync(FILE, JSON.stringify(db));
function commit(msg) {
  save();
  try { execSync(`git add ${FILE} && git commit -q -m "${msg}"`, { stdio: 'inherit' }); } catch { console.log('Sin cambios que subir'); return; }
  for (let i = 0; i < 6; i++) { try { execSync('git pull --rebase -q && git push -q', { stdio: 'inherit' }); return; } catch { execSync(`sleep ${5 + i * 7}`); } }
}

// 1. Todos los jugadores de todas las ligas, desde ESPN
const players = new Map();
for (const lg of LEAGUES) {
  const st = await getJSON(`https://site.api.espn.com/apis/v2/sports/soccer/${lg}/standings`);
  const teams = new Map();
  const walk = o => { if (!o) return; (o.standings?.entries || []).forEach(e => e.team && teams.set(String(e.team.id), e.team.displayName)); (o.children || []).forEach(walk); };
  walk(st);
  // Todos los equipos de la competencia (incluye copas sin tabla, como Libertadores o Concachampions)
  const tl = await getJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/teams?limit=500`);
  (tl?.sports?.[0]?.leagues?.[0]?.teams || []).forEach(x => x.team && teams.set(String(x.team.id), x.team.displayName));
  for (const [tid, tname] of teams) {
    const r = await getJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/teams/${tid}/roster`);
    let ath = []; (r?.athletes || []).forEach(a => { if (a.items) ath = ath.concat(a.items); else ath.push(a); });
    ath.forEach(a => { const id = String(a.id || ''); if (id && !players.has(id)) players.set(id, { name: a.displayName || a.fullName || '', team: tname }); });
    await sleep(120);
  }
  console.log(`${lg}: ${teams.size} equipos · ${players.size} jugadores en total`);
}

// 2. Los que faltan
const todo = [...players].filter(([id, p]) => hash(p.team) % SHARDS === SHARD && !known[id] && (!(id in db.p) || (db.p[id] === '' && today - (db.t[id] || 0) >= RETRY_DAYS)));
console.log(`Robot ${SHARD + 1} de ${SHARDS} · pendientes: ${todo.length} de ${players.size}`);
const byTeam = new Map();
todo.forEach(([id, p]) => { if (!byTeam.has(p.team)) byTeam.set(p.team, []); byTeam.get(p.team).push([id, p]); });

let done = 0, lastCommit = Date.now();
outer: for (const [team, list] of byTeam) {
  if (Date.now() - START > MAXMS) break;
  // Primero la plantilla del equipo de un jalón (la versión gratis trae hasta 10)
  const squad = new Map();
  const tj = await getJSON(TSDB + 'searchteams.php?t=' + encodeURIComponent(team)); await sleep(GAP);
  const tm = (tj?.teams || []).find(x => x.strSport === 'Soccer');
  if (tm) {
    const sj = await getJSON(TSDB + 'lookup_all_players.php?id=' + tm.idTeam); await sleep(GAP);
    (sj?.player || []).forEach(pl => { const u = pl.strCutout || pl.strThumb; if (u) squad.set(norm(pl.strPlayer), u); });
  }
  const tw = norm(team).split(' ').filter(w => w.length > 2);
  for (const [id, p] of list) {
    if (Date.now() - START > MAXMS) break outer;
    let u = squad.get(norm(p.name)) || null;
    if (!u) {
      const w = p.name.split(' ');
      const vs = [...new Set([p.name, norm(p.name), w.length > 2 ? w[0] + ' ' + w[w.length - 1] : ''].filter(Boolean))];
      for (const qn of vs) {
        const j = await getJSON(TSDB + 'searchplayers.php?p=' + encodeURIComponent(qn)); await sleep(GAP);
        const ps = (j?.player || []).filter(x => x.strSport === 'Soccer');
        const pl = ps.find(x => tw.some(t => norm(x.strTeam).includes(t))) || (qn === p.name ? ps[0] : null);
        if (pl && (pl.strCutout || pl.strThumb)) { u = pl.strCutout || pl.strThumb; break; }
      }
    }
    let code = enc(u);
    if (!code) { const f = await fotmob(p.name, p.team); await sleep(1100); if (f) code = f; db.f[id] = today; }
    db.p[id] = code; db.t[id] = today; done++;
    if (Date.now() - lastCommit > 20 * 60e3) { commit(`Fotos ${SHARD + 1}/${SHARDS}: +${done}`); lastCommit = Date.now(); }
  }
}
// 3. Los que ya se buscaron en TheSportsDB sin suerte: probar FotMob (más rápido, ~1 por segundo)
let fm = 0;
for (const [id, p] of players) {
  if (Date.now() - START > MAXMS) break;
  if (hash(p.team) % SHARDS !== SHARD || known[id] || db.p[id] !== '' || db.f[id]) continue;
  const f = await fotmob(p.name, p.team); await sleep(1100);
  if (f === null) continue;
  db.f[id] = today; if (f) { db.p[id] = f; fm++; }
  if (Date.now() - lastCommit > 20 * 60e3) { commit(`Fotos ${SHARD + 1}/${SHARDS}: +${done} (+${fm} FotMob)`); lastCommit = Date.now(); }
}
commit(`Fotos ${SHARD + 1}/${SHARDS}: +${done} (+${fm} FotMob)`);
const found = Object.values(db.p).filter(Boolean).length;
console.log(`Listo: ${done} revisados en esta corrida · ${found} con foto de ${Object.keys(db.p).length}`);
