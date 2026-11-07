// Cada minuto: revisa ESPN y manda avisos de lo que sigue cada quien y de sus parlays.
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

const LG = {"nfl":["football","nfl","football","NFL"],"ucl":["soccer","uefa.champions","soccer","Champions League"],"ligamx":["soccer","mex.1","soccer","Liga MX"],"f1":["racing","f1","racing","Fórmula 1"],"epl":["soccer","eng.1","soccer","Premier League"],"laliga":["soccer","esp.1","soccer","LaLiga"],"nba":["basketball","nba","basketball","NBA"],"mlb":["baseball","mlb","baseball","MLB"],"uel":["soccer","uefa.europa","soccer","Europa League"],"mls":["soccer","usa.1","soccer","MLS"],"concachamp":["soccer","concacaf.champions","soccer","Concacaf Champions Cup"],"seriea":["soccer","ita.1","soccer","Serie A"],"bundes":["soccer","ger.1","soccer","Bundesliga"],"ligue1":["soccer","fra.1","soccer","Ligue 1"],"lib":["soccer","conmebol.libertadores","soccer","Copa Libertadores"],"nhl":["hockey","nhl","hockey","NHL"],"atp":["tennis","atp","tennis","Tenis ATP"],"wta":["tennis","wta","tennis","Tenis WTA"],"pga":["golf","pga","golf","Golf PGA Tour"],"cfb":["football","college-football","football","NCAA Football"],"uecl":["soccer","uefa.europa.conf","soccer","Conference League"],"port":["soccer","por.1","soccer","Liga Portugal"],"ered":["soccer","ned.1","soccer","Eredivisie"],"champ":["soccer","eng.2","soccer","Championship"],"arg":["soccer","arg.1","soccer","Liga Argentina"],"bra":["soccer","bra.1","soccer","Brasileirão"],"tur":["soccer","tur.1","soccer","Süper Lig"],"sco":["soccer","sco.1","soccer","Premiership"],"ncaab":["basketball","mens-college-basketball","basketball","NCAA Basketball"],"wnba":["basketball","wnba","basketball","WNBA"]};
const B = 'https://site.api.espn.com/apis/site/v2/sports/';
const ymd = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' })); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
const get = async u => { try { const r = await fetch(u, { headers: { 'cache-control': 'no-cache' } }); return r.ok ? r.json() : null; } catch { return null; } };
const money = x => '$' + Math.round(x).toLocaleString('es-MX');
const fmt = v => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toString()) : String(v ?? '');
const ES = { 'Halftime': 'Medio tiempo', 'Final': 'Final', 'End of 1st Quarter': 'Fin del 1º', 'End of 2nd Quarter': 'Fin del 2º', 'End of 3rd Quarter': 'Fin del 3º' };
const tr = s => ES[s] || String(s || '').replace(/(\d)(st|nd|rd|th) Quarter/, '$1º cuarto').replace(/(\d)(st|nd|rd|th) Period/, '$1º periodo').replace(/^Q(\d)/, '$1º').replace(/(Top|Bot|Mid|End) (\d+)(st|nd|rd|th)/, (m, a, n) => ({ Top: 'Alta', Bot: 'Baja', Mid: 'Mitad', End: 'Fin' }[a]) + ' ' + n + 'ª');

/* ---------- partidos ---------- */
function team(x) { const t = x.team || {}; const sc = typeof x.score === 'object' ? Number(x.score?.value ?? x.score?.displayValue) : Number(x.score); return { id: String(t.id || ''), abbr: t.abbreviation || '', name: t.shortDisplayName || t.displayName || '', score: isFinite(sc) ? sc : 0, ls: (x.linescores || []).map(l => Number(l.value ?? l.displayValue) || 0), win: !!x.winner }; }
function cornersByHalf(j){const c=j&&j.header&&j.header.competitions&&j.header.competitions[0];const com=j&&j.commentary;if(!c||!Array.isArray(com))return null;const nm={};(c.competitors||[]).forEach(t=>{const tt=t.team||{};[tt.displayName,tt.shortDisplayName,tt.name,tt.abbreviation].filter(Boolean).forEach(n=>nm[String(n).toLowerCase()]=t.homeAway)});
  const o={h1:{home:0,away:0},h2:{home:0,away:0}};let any=false;com.forEach(x=>{const t=String(x.text||'');const m=t.match(/^Corner,\s*([^.]+)\./);if(!m)return;any=true;const side=nm[m[1].trim().toLowerCase()];if(!side)return;const d=String((x.time&&x.time.displayValue)||'');const mn=parseInt(d)||0;const h=(mn<=45||/^45'\+/.test(d))?'h1':'h2';o[h][side]++});return any||com.length?o:null}
function xCore(L,g,kind,fin){const hs=g.home.score,as=g.away.score,tot=hs+as,sc=as+'-'+hs;const W=(ok,dead)=>fin?(ok?'won':'lost'):dead?'lost':(ok?'winning':'losing');
  const hl=g.home.ls||[],al=g.away.ls||[];const sum=(x,a,b)=>x.slice(a,b).reduce((p,c)=>p+(Number(c)||0),0);
  const resOk=s=>s==='h'?hs>as:s==='a'?as>hs:hs===as;
  switch(L.m){
    case 'c1':{if(!g.cor)return {wait:true};const v=g.cor.h1.home+g.cor.h1.away;const done=fin||g.cor.h2.home+g.cor.h2.away>0||g.period>=2||/half|medio|2nd|2º/i.test(g.detail||g.det||'');return {ou:v,done,unit:'corners'}}
    case 'tc':{const ts=g.tstats;if(!ts)return {wait:true};return {ou:(ts[L.side]||{}).wonCorners||0,done:fin,unit:'corners'}}
    case 'rt':{const r=resOk(L.sel),t=L.ou==='over'?tot>L.line:tot<L.line;const dead=L.ou==='under'&&tot>L.line;return {st:W(r&&t,dead),msg:`Va ${sc} · ${tot} ${kind==='soccer'?'goles':'en total'}`,v:sc}}
    case 'rb':{const [rs,bt]=String(L.sel).split('|');const r=resOk(rs),b=hs>0&&as>0;const t=bt==='y'?b:!b;const dead=bt==='n'&&b;return {st:W(r&&t,dead),msg:`Va ${sc}`,v:sc}}
    case 'dnb':{const d=L.sel==='h'?hs-as:as-hs;return {st:fin?(d>0?'won':d<0?'lost':'push'):(d>0?'winning':d<0?'losing':'even'),msg:d===0?(fin?'Empate · se anula':'Empatados · se anularía'):`Va ${sc}`,v:sc}}
    case 'wtn':{const me=L.sel==='h'?hs:as,op=L.sel==='h'?as:hs;return {st:W(me>op&&op===0,op>0),msg:op>0?'Ya le anotaron':`Va ${sc}`,v:sc}}
    case 'cs':{const op=L.sel==='h'?as:hs;return {st:W(op===0,op>0),msg:op>0?'Ya le anotaron':'Portería en cero',v:sc}}
    case 'exs':{const [h,a]=String(L.sel).split('-').map(Number);const ok=hs===h&&as===a;return {st:W(ok,hs>h||as>a),msg:hs>h||as>a?'Ya no se puede dar':`Va ${sc}`,v:sc}}
    case 'oe':{const ok=(tot%2===1)===(L.sel==='o');return {st:W(ok,false),msg:`${tot} en total`,v:String(tot)}}
    case 'nrfi':{const a=al[0],h=hl[0];const r=(Number(a)||0)+(Number(h)||0);const done=fin||hl.length>1||al.length>1||(h!=null&&g.period>1);const ok=L.sel==='y'?r>0:r===0;
      if(L.sel==='y'&&r>0)return {st:'won',msg:'Hubo carrera en la 1ª',v:String(r)};if(L.sel==='n'&&r>0)return {st:'lost',msg:'Hubo carrera en la 1ª',v:String(r)};
      return {st:done?(ok?'won':'lost'):(ok?'winning':'losing'),msg:done?'Sin carreras en la 1ª':'1ª entrada en juego',v:String(r)}}
    case 'reg':{const N=3;const done=fin||hl.length>N||al.length>N;const h=sum(hl,0,N),a=sum(al,0,N);const ok=L.sel==='h'?h>a:L.sel==='a'?a>h:h===a;return {st:done?(ok?'won':'lost'):(ok?'winning':'losing'),msg:`Tiempo regular: ${a}-${h}`,v:`${a}-${h}`}}
    case 'h2':case 'h2t':{const N=(typeof H1N!=='undefined'?H1N:{soccer:1,basketball:2,football:2,hockey:1,baseball:5})[kind]||1;const started=hl.length>N||al.length>N||(kind==='soccer'&&(g.period>=2||/2nd|second|2º|segundo/i.test(g.detail||g.det||'')));const h=started?sum(hl,N):0,a=started?sum(al,N):0;
      if(L.m==='h2t')return {ou:h+a,done:fin,pre:!started};const ok=L.sel==='h'?h>a:L.sel==='a'?a>h:h===a;return {st:fin?(ok?'won':'lost'):!started?'pending':(ok?'winning':'losing'),msg:started?`2ª mitad: ${a}-${h}`:'Empieza en la 2ª mitad',v:`${a}-${h}`}}
    case 'q1':case 'q1t':{const done=fin||hl.length>1||al.length>1;const h=Number(hl[0])||0,a=Number(al[0])||0;if(L.m==='q1t')return {ou:h+a,done};const ok=L.sel==='h'?h>a:L.sel==='a'?a>h:h===a;return {st:done?(ok?'won':'lost'):(ok?'winning':'losing'),msg:`1er ${kind==='hockey'?'periodo':'cuarto'}: ${a}-${h}`,v:`${a}-${h}`}}
  }return null}
function fromComp(lg, id, c, e) { const s = c.status || e?.status || {}; const f = h => team((c.competitors || []).find(k => k.homeAway === h) || {});
  return { key: lg + ':' + id, lg, kind: LG[lg][2], state: s.type?.state || 'pre', stn: s.type?.name || '', per: s.period || 0, clk: s.displayClock || '', det: tr(s.type?.shortDetail || ''), home: f('home'), away: f('away'),
    reds: (c.details || []).filter(d => d.redCard).length, goals: (c.details || []).filter(d => d.scoringPlay).map(d => ({ t: String(d.team?.id || ''), who: d.athletesInvolved?.[0]?.displayName || '', clk: d.clock?.displayValue || '' })),
    redsD: (c.details || []).filter(d => d.redCard).map(d => ({ t: String(d.team?.id || ''), who: d.athletesInvolved?.[0]?.displayName || '', clk: d.clock?.displayValue || '' })) }; }
function games(lg, j) {
  const kind = LG[lg][2]; const out = [];
  for (const e of j?.events || []) {
    if (kind === 'tennis') {
      for (const gr of e.groupings || []) { if (/double/i.test(gr.grouping?.displayName || '')) continue;
        for (const c of gr.competitions || []) { const f = h => { const x = (c.competitors || []).find(q => q.homeAway === h) || {}; const ls = x.linescores || []; return { id: String(x.id || ''), name: x.athlete?.displayName || '', abbr: (x.athlete?.displayName || '').split(' ').pop(), score: ls.filter(l => l.winner).length, sets: ls.map(l => Number(l.value) || 0), win: !!x.winner }; };
          out.push({ key: lg + ':' + c.id, lg, kind, tour: e.name, state: c.status?.type?.state || 'pre', per: c.status?.period || 0, home: f('home'), away: f('away') }); } }
      continue;
    }
    if (kind === 'racing' || kind === 'golf') {
      const cs = e.competitions || []; const st = cs.some(c => c.status?.type?.state === 'in') ? 'in' : (e.status?.type?.state || 'pre');
      out.push({ key: lg + ':' + e.id, lg, kind, name: e.name, state: st, ses: cs.map(c => ({ ab: c.type?.abbreviation || '', st: c.status?.type?.state || 'pre', res: (c.competitors || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99)).map(x => x.athlete?.displayName || '') })),
        lead: kind === 'golf' ? ((cs[0]?.competitors || []).slice().sort((a, b) => (a.order || 999) - (b.order || 999))[0]?.athlete?.displayName || '') : '', rd: kind === 'golf' ? (cs[0]?.status?.period || 0) + '|' + (cs[0]?.status?.type?.detail || '') : '' });
      continue;
    }
    out.push(fromComp(lg, e.id, (e.competitions || [])[0] || {}, e));
  }
  return out;
}
const GPN = [[/Australia/i, 'Australia'], [/Chin/i, 'China'], [/Japan/i, 'Japón'], [/Bahrain/i, 'Baréin'], [/Saudi/i, 'Arabia Saudita'], [/Miami/i, 'Miami'], [/Canad/i, 'Canadá'], [/Monaco/i, 'Mónaco'], [/Barcelona/i, 'Barcelona'], [/Spanish|Spain|Madrid/i, 'España'], [/Austria/i, 'Austria'], [/British/i, 'Gran Bretaña'], [/Belgi/i, 'Bélgica'], [/Hungar/i, 'Hungría'], [/Dutch|Netherlands/i, 'Países Bajos'], [/Ital/i, 'Italia'], [/Azerbaijan/i, 'Azerbaiyán'], [/Singapore/i, 'Singapur'], [/United States/i, 'Estados Unidos'], [/Mexic/i, 'Ciudad de México'], [/S[ãa]o Paulo|Brazil/i, 'São Paulo'], [/Las Vegas/i, 'Las Vegas'], [/Qatar/i, 'Catar'], [/Abu Dhabi/i, 'Abu Dabi']];
const GP = n => { const x = GPN.find(([a]) => a.test(n || '')); return x ? 'GP de ' + x[1] : String(n || ''); };
const SES = { FP1: 'Práctica 1', FP2: 'Práctica 2', FP3: 'Práctica 3', Qual: 'Clasificación', Race: 'Carrera', SQ: 'Clasificación sprint', SR: 'Sprint', Sprint: 'Sprint', SS: 'Sprint' };

/* ---------- avisos de lo que sigues: título corto = qué pasó; texto = marcador y contexto ---------- */
function events(g, p) {
  const ev = []; if (!p) return ev; const A = (k, t, b, tag) => ev.push([k, t, b, g.key + ':' + tag]);
  if (g.kind === 'racing') { g.ses.forEach((s, i) => { const w = p.ses?.[i]?.st; if (!w || w === s.st) return; const grp = /^FP/.test(s.ab) ? 'prac' : /^(Qual|SQ)$/.test(s.ab) ? 'qual' : /^(SR|Sprint|SS)$/.test(s.ab) ? 'sprint' : s.ab === 'Race' ? 'race' : ''; const nm = SES[s.ab] || s.ab;
      if (w === 'pre' && s.st === 'in') A(grp, '🏎️ Arrancó: ' + nm, GP(g.name), 's' + i);
      if (w !== 'post' && s.st === 'post' && s.res.length) { if (grp === 'race') A('result', '🏁 ' + s.res[0] + ' gana el ' + GP(g.name), '🥈 ' + (s.res[1] || '') + '   🥉 ' + (s.res[2] || ''), 'f' + i); else if (grp === 'qual') A('qual', '⏱️ Pole para ' + s.res[0], GP(g.name) + ' · sale primero', 'f' + i); else if (grp === 'sprint') A('sprint', '🏁 ' + s.res[0] + ' gana el sprint', GP(g.name), 'f' + i); } }); return ev; }
  if (g.kind === 'golf') { if (p.state === 'pre' && g.state === 'in') A('round', '⛳ Arrancó ' + g.name, 'Ronda 1', 's');
    if (g.rd !== p.rd && /Complete/i.test(g.rd)) A('rend', '⛳ Terminó la ronda ' + g.rd.split('|')[0], 'Va arriba ' + g.lead + ' · ' + g.name, 'r' + g.rd.split('|')[0]);
    if (g.state === 'in' && g.lead && p.lead && g.lead !== p.lead) A('leader', '⛳ Nuevo líder: ' + g.lead, g.name, 'l' + g.lead);
    if (p.state !== 'post' && g.state === 'post') A('final', '🏆 ' + g.lead + ' gana', g.name, 'f'); return ev; }
  if (g.kind === 'tennis') { const sc = g.away.abbr + ' ' + g.away.score + '–' + g.home.score + ' ' + g.home.abbr;
    if (p.state === 'pre' && g.state === 'in') A('start', '🎾 Empezó', g.away.name + ' vs ' + g.home.name + ' · ' + g.tour, 's');
    const who = g.home.score > p.h ? g.home : g.away.score > p.a ? g.away : null; if (who && g.state === 'in') { const i = g.home.score + g.away.score - 1; A('set', '🎾 Set para ' + who.abbr, 'Sets: ' + sc + (g.away.sets[i] != null ? '  (' + g.away.sets[i] + '-' + g.home.sets[i] + ')' : ''), 'p' + g.home.score + '-' + g.away.score); }
    if (p.state !== 'post' && g.state === 'post') { const w = g.home.win ? g.home : g.away; A('final', '🏆 Ganó ' + w.name, sc + ' en sets · ' + g.tour, 'f'); } return ev; }
  const score = g.away.abbr + ' ' + g.away.score + ' - ' + g.home.score + ' ' + g.home.abbr, vs = g.away.name + ' vs ' + g.home.name;
  if (p.state === 'pre' && g.state === 'in') A('start', '▶️ Arrancó ' + vs, LG[g.lg][3], 's');
  const dh = g.home.score - p.h, da = g.away.score - p.a, who = dh > 0 ? g.home : da > 0 ? g.away : null;
  if (who && g.state !== 'pre') { const d = Math.max(dh, da), tag = 'p' + g.home.score + '-' + g.away.score;
    if (g.kind === 'soccer') { const gl = g.goals.filter(x => x.t === who.id).pop(); A('goal', '⚽ ¡Gol de ' + who.name + '!', (gl && gl.who ? gl.who + ' ' + gl.clk + '\n' : '') + score, tag); }
    else if (g.kind === 'hockey') A('goal', '🏒 ¡Gol de ' + who.name + '!', score + ' · ' + g.det, tag);
    else if (g.kind === 'football') A('score', d >= 6 ? '🏈 Touchdown de ' + who.name : d === 3 ? '🏈 Gol de campo de ' + who.name : '🏈 Anotación de ' + who.name, score + ' · ' + g.det, tag);
    else if (g.kind === 'baseball') A('score', '⚾ ' + (d > 1 ? d + ' carreras' : 'Carrera') + ' de ' + who.name, score + ' · ' + g.det, tag); }
  if (g.kind === 'soccer' && g.reds > (p.reds || 0)) { const rc = g.redsD[g.redsD.length - 1]; const tm = rc && (rc.t === g.home.id ? g.home : rc.t === g.away.id ? g.away : null); A('red', '🟥 Roja' + (tm ? ' para ' + tm.name : ''), (rc && rc.who ? rc.who + ' ' + rc.clk + '\n' : '') + score, 'rc' + g.reds); }
  if (/HALFTIME/.test(g.stn) && !/HALFTIME/.test(p.stn || '')) A('half', '⏸️ Medio tiempo', score, 'ht');
  if (/END_PERIOD/.test(g.stn) && !/END_PERIOD/.test(p.stn || '')) A('period', '⏸️ Fin del ' + g.per + 'º ' + (g.kind === 'hockey' ? 'periodo' : 'cuarto'), score, 'pe' + g.per);
  if (g.state === 'in' && !p.close && g.per >= 4 && Number(String(g.clk).split(':')[0]) < 5 && Math.abs(g.home.score - g.away.score) <= (g.kind === 'basketball' ? 5 : 8) && (g.kind === 'basketball' || g.kind === 'football')) { A('close', '🔥 Final de infarto', score + ' · ' + g.det, 'cl'); g.close = 1; }
  if (p.close) g.close = 1;
  if (p.state !== 'post' && g.state === 'post') { const w = g.home.score > g.away.score ? g.home : g.away.score > g.home.score ? g.away : null; A('final', '🏁 Final' + (w ? ': ganó ' + w.name : ': empate'), score + ' · ' + LG[g.lg][3], 'f'); }
  return ev;
}
const snap = g => ({ state: g.state, h: g.home?.score || 0, a: g.away?.score || 0, stn: g.stn || '', reds: g.reds || 0, ses: g.ses, lead: g.lead, rd: g.rd, close: g.close || 0 });

/* ---------- parlays: evaluación y pronóstico al ritmo actual ---------- */
const parseStat = v => { if (v == null) return null; const m = String(v).match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
function playerStats(j) { const map = {}; const ens = id => map[id] || (map[id] = { s: {}, dnp: false });
  ((j.boxscore && j.boxscore.players) || []).forEach(tp => (tp.statistics || []).forEach(cat => { const cn = (cat.name || cat.type || '').toLowerCase(); const labels = cat.labels || cat.names || [];
    (cat.athletes || []).forEach(a => { if (!a.athlete) return; const p = ens(String(a.athlete.id)); if (a.didNotPlay) p.dnp = true; labels.forEach((lab, i) => { const v = parseStat((a.stats || [])[i]); if (v == null) return; const L = String(lab).toUpperCase(); if (cn) p.s[cn + '.' + L] = v; if (p.s[L] == null) p.s[L] = v; }); }); }));
  (j.rosters || []).forEach(r => (r.roster || []).forEach(e => { if (!e.athlete) return; const p = ens(String(e.athlete.id)); (e.stats || []).forEach(st => { const v = Number(st.value); if (isFinite(v)) p.s[st.name] = v; }); }));
  return map; }
function teamStats(j, g) { const ts = {}; ((j.boxscore && j.boxscore.teams) || []).forEach(t => { const id = String(t.team?.id); const side = id === g.home.id ? 'home' : id === g.away.id ? 'away' : null; if (!side) return; const o = {}; (t.statistics || []).forEach(x => { const v = Number(x.value ?? x.displayValue); if (isFinite(v)) o[x.name] = v; }); ts[side] = o; }); return ts; }
function propVal(rc, s) { if (!rc || !s) return null; const pick = ks => { for (const k of ks) if (s[k] != null) return s[k]; return null; };
  if (rc.m === 'pick') return pick(rc.k); if (rc.m === 'sum') { let t = 0, any = false; rc.k.forEach(k => { if (s[k] != null) { t += s[k]; any = true; } }); return any ? t : null; }
  if (rc.m === 'dbl' || rc.m === 'tpl') { const v = ['PTS', 'REB', 'AST', 'STL', 'BLK'].map(k => s[k]).filter(x => x != null); if (!v.length) return null; return v.filter(x => x >= 10).length >= (rc.m === 'dbl' ? 2 : 3) ? 1 : 0; }
  if (rc.m === 'outs') { const v = s['pitching.IP']; if (v == null) return null; const w = Math.floor(v); return w * 3 + Math.round((v - w) * 10); } return null; }
function frac(g) { if (g.state === 'post') return 1; if (g.state !== 'in') return 0; const per = g.per || 1; const c = String(g.clk || ''); const m = c.match(/(\d+):(\d+)/); const mm = m ? Number(m[1]) + Number(m[2]) / 60 : /^\d+(\.\d+)?$/.test(c) ? Number(c) / 60 : null;
  if (g.kind === 'basketball') { const P = g.lg === 'wnba' ? 10 : g.lg === 'ncaab' ? 20 : 12, N = g.lg === 'ncaab' ? 2 : 4; return per > N ? 1 : Math.min(1, ((per - 1) * P + (P - (mm ?? P))) / (N * P)); }
  if (g.kind === 'football') return per > 4 ? 1 : Math.min(1, ((per - 1) * 15 + (15 - (mm ?? 15))) / 60);
  if (g.kind === 'hockey') return per > 3 ? 1 : Math.min(1, ((per - 1) * 20 + (20 - (mm ?? 20))) / 60);
  if (g.kind === 'soccer') { const x = c.match(/(\d+)'/); return x ? Math.min(1, Number(x[1]) / 90) : /HALFTIME/.test(g.stn) ? 0.5 : null; }
  if (g.kind === 'baseball') return Math.min(1, (per - 0.5) / 9); return null; }
// Devuelve {st: pending|live|ok|bad|won|lost|push, v, msg, near, pace}
function evalLeg(L, g, x) {
  if (!g) return { st: 'pending', msg: '' }; if (g.state === 'pre') return { st: 'pending', msg: 'Por empezar' };
  const fin = g.state === 'post', me = L.side === 'home' ? g.home : g.away, op = L.side === 'home' ? g.away : g.home;
  const side = d => fin ? (d > 0 ? 'won' : d < 0 ? 'lost' : 'push') : (d > 0 ? 'ok' : d < 0 ? 'bad' : 'live');
  if (L.t === 'ml') { if (L.side === 'draw') { const d = g.home.score === g.away.score; return { st: fin ? (d ? 'won' : 'lost') : (d ? 'ok' : 'bad'), msg: g.away.score + '-' + g.home.score }; }
    if (g.kind === 'tennis') { const d = me.score - op.score; return { st: fin ? (me.win ? 'won' : 'lost') : side(d), msg: me.score + '-' + op.score + ' en sets' }; }
    const d = me.score - op.score; return { st: fin ? (d > 0 ? 'won' : g.kind === 'soccer' || d < 0 ? 'lost' : 'push') : side(d), msg: d > 0 ? (fin ? 'Ganó por ' : 'Gana por ') + d : d < 0 ? (fin ? 'Perdió por ' : 'Pierde por ') + (-d) : 'Empatados' }; }
  if (L.t === 'spread') { const d = Math.round((me.score + L.line - op.score) * 10) / 10; return { st: side(d), msg: d > 0 ? 'Cubre por ' + d : d < 0 ? 'Le faltan ' + (-d) : 'Justo en la línea' }; }
  let v = null, unit = '';
  if (L.t === 'total') v = g.home.score + g.away.score;
  else if (L.t === 'prop') { const p = x.stats && x.stats[L.ath]; if (fin && x.stats && (!p || p.dnp)) return { st: 'push', msg: 'No jugó · se anula' }; v = p ? propVal(L.rc, p.s) : null; if (v == null) v = 0; }
  else if (L.t === 'x') {
    const hs = g.home.score, as = g.away.score;
    if (L.m === 'dc') { const ok = L.sel === 'hX' ? hs >= as : L.sel === 'aX' ? as >= hs : hs !== as; return { st: fin ? (ok ? 'won' : 'lost') : (ok ? 'ok' : 'bad'), msg: as + '-' + hs }; }
    if (L.m === 'btts') { const both = hs > 0 && as > 0; if (L.sel === 'y') return { st: both ? 'won' : fin ? 'lost' : 'live', msg: both ? 'Ya anotaron los dos' : 'Falta que anoten' }; return { st: both ? 'lost' : fin ? 'won' : 'ok', msg: both ? 'Anotaron los dos' : 'Aguanta' }; }
    if (L.m === 'tt') v = L.side === 'home' ? hs : as;
    else if (L.m === 'corn' || L.m === 'card') { if (!x.ts) return { st: 'live', msg: 'Esperando estadísticas' }; const f = L.m === 'corn' ? t => t.wonCorners || 0 : t => (t.yellowCards || 0) + (t.redCards || 0); v = f(x.ts.home || {}) + f(x.ts.away || {}); unit = L.m === 'corn' ? 'corners' : 'tarjetas'; }
    else { const xc = xCore(L, { ...g, period: g.per, detail: g.det, cor: x.c, tstats: x.ts }, g.kind, fin); if (!xc) return { st: fin ? 'unknown' : 'live', msg: '' }; if (xc.wait) return { st: 'live', msg: 'Esperando estadísticas' };
      if (xc.ou != null) { if (xc.pre) return { st: 'pending', msg: '' }; v = xc.ou; }
      else return { st: { winning: 'ok', losing: 'bad', even: 'live' }[xc.st] || xc.st, msg: fin ? xc.msg.replace(/^Va /, 'Quedó ') : xc.msg }; }
  } else return { st: 'live', msg: '' };
  const yn = L.t === 'prop' && L.line === 0.5 && ['td', 'g', 'hr', 'ga', 'yc', 'dbl', 'tpl'].includes(L.mk);
  const r = { v, msg: '' };
  if (L.ou === 'over') { if (v > L.line) { r.st = 'won'; r.msg = yn ? 'Ya se dio' : 'Ya cobró con ' + fmt(v); } else if (fin) { r.st = v < L.line ? 'lost' : 'push'; r.msg = 'Se quedó en ' + fmt(v); } else { r.st = 'live'; const need = Math.floor(L.line) + 1 - v; r.need = need; r.msg = yn ? 'Todavía no' : 'Lleva ' + fmt(v) + ', le ' + (need === 1 ? 'falta 1' : 'faltan ' + fmt(need)); } }
  else { if (v > L.line) { r.st = 'lost'; r.msg = 'Se pasó: ' + fmt(v); } else if (fin) { r.st = v < L.line ? 'won' : 'push'; r.msg = 'Cobró con ' + fmt(v); } else { r.st = 'live'; r.msg = 'Lleva ' + fmt(v) + ' de ' + L.line; } }
  if (r.st === 'live' && !yn) { const fr = frac(g); if (fr && fr >= 0.2 && fr < 0.97) { const pj = v / fr; r.pace = (L.ou === 'over' ? pj > L.line : pj < L.line) ? 'ok' : 'bad'; r.proj = pj; r.st = r.pace; r.msg += ' · va para ' + fmt(pj < 10 ? Math.round(pj * 10) / 10 : Math.round(pj)); } }
  return r;
}

export default async () => {
  const subsStore = getStore('subs'), stateStore = getStore('state');
  const keys = await getStore('cfg').get('vapid', { type: 'json' });
  if (!keys) return new Response('sin llaves todavía');
  webpush.setVapidDetails('mailto:avisos@tutus-score.app', keys.publicKey, keys.privateKey);
  const { blobs } = await subsStore.list();
  const subs = (await Promise.all(blobs.map(async b => ({ key: b.key, v: await subsStore.get(b.key, { type: 'json' }) })))).filter(x => x.v);
  if (!subs.length) return new Response('sin suscriptores');
  const send = async (s, title, body, tag, k) => { if (!s.v.sub) return; try { await webpush.sendNotification(s.v.sub, JSON.stringify({ title, body, tag, k }), { TTL: 900, urgency: 'high' }); sent++; } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { await subsStore.delete(s.key); s.v.sub = null; } } };
  let sent = 0;

  // 1) Lo que sigues
  const lgs = [...new Set(subs.flatMap(s => (s.v.items || []).map(i => i.lg)).filter(l => LG[l]))];
  const day = ymd(); const all = [];
  await Promise.all(lgs.map(async lg => { const [sp, lgp] = LG[lg]; const j = await get(B + sp + '/' + lgp + '/scoreboard' + (LG[lg][2] === 'tennis' ? '' : '?dates=' + day)); if (j) all.push(...games(lg, j)); }));
  const prev = (await stateStore.get('prev', { type: 'json' })) || {}; const next = {};
  for (const g of all) {
    const evs = events(g, prev[g.key]); next[g.key] = snap(g); if (!evs.length) continue;
    for (const s of subs) {
      const fol = (s.v.items || []).filter(i => i.lg === g.lg && (i.t === 'game' ? i.k === g.key : (i.id && (i.id === g.home?.id || i.id === g.away?.id)))); if (!fol.length) continue;
      const P = {}; fol.forEach(i => Object.entries(i.p || {}).forEach(([k, v]) => { if (v) P[k] = true; }));
      for (const [k, title, body, tag] of evs) if (P[k]) await send(s, title, body, tag, g.key);
    }
  }
  await stateStore.setJSON('prev', next);

  // 2) Parlays: cobró / se cayó / a uno de cobrar / resumen con pronóstico / resultado final
  const pk = new Set(); subs.forEach(s => (s.v.parlays || []).forEach(P => P.legs.forEach(L => { if (LG[L.lg] && !['racing', 'golf'].includes(LG[L.lg][2])) pk.add(L.key); })));
  if (pk.size) {
    const G = {}, X = {};
    const tennisLgs = [...new Set([...pk].map(k => k.split(':')[0]).filter(l => LG[l][2] === 'tennis'))];
    await Promise.all(tennisLgs.map(async lg => { const j = await get(B + 'tennis/' + lg + '/scoreboard'); if (j) games(lg, j).forEach(g => { G[g.key] = g; X[g.key] = {}; }); }));
    await Promise.all([...pk].filter(k => LG[k.split(':')[0]][2] !== 'tennis').map(async k => { const [lg, id] = k.split(':'); const [sp, lgp] = LG[lg]; const j = await get(B + sp + '/' + lgp + '/summary?event=' + id);
      const c = j?.header?.competitions?.[0]; if (!c) return; const g = fromComp(lg, id, c); G[k] = g; X[k] = { stats: playerStats(j), ts: teamStats(j, g), c: g.kind === 'soccer' ? cornersByHalf(j) : null }; }));
    const pst = (await stateStore.get('parlays', { type: 'json' })) || {}; const pnext = {}; const now = Date.now();
    for (const s of subs) for (const P of (s.v.parlays || [])) {
      const id = s.key + '|' + P.id; const old = pst[id] || { legs: {}, sumAt: 0 }; const st = { legs: {}, sumAt: old.sumAt, done: old.done, sumSig: old.sumSig, liveAt: old.liveAt };
      const rs = P.legs.map(L => { const g = G[L.key]; const r = (LG[L.lg] && ['racing', 'golf'].includes(LG[L.lg][2])) ? { st: 'unknown' } : evalLeg(L, g, X[L.key] || {}); const o = old.legs[L.id] || {}; st.legs[L.id] = { st: r.st, near: o.near || (r.need === 1 ? 1 : 0), ht: g && /HALFTIME/.test(g.stn) ? 1 : 0 }; return { L, r, o, g }; });
      pnext[id] = st; if (old.done) continue; const first = !pst[id];
      const won = rs.filter(x => ['won', 'push'].includes(x.r.st));
      const nm = P.name || 'Tu parlay', sh = x => x.L.sh || (x.L.t === 'prop' && x.L.an ? x.L.an.split(' ').slice(-1)[0] + ' ' + (x.L.ou === 'over' ? '+' : '-') + x.L.line + ' ' + (x.L.mk || '') : x.L.ti), val = x => typeof x.r.v === 'number' ? fmt(x.r.v) : '';
      if (first) continue; // la primera vez solo guardamos cómo va
      // Una selección perdida = parlay caído: un solo aviso
      const newLost = rs.filter(x => x.r.st === 'lost' && x.o.st !== 'lost');
      if (newLost.length) { const x = newLost[0]; await send(s, '🔴 Se cayó ' + nm, 'Por ' + sh(x) + (val(x) ? ' (quedó en ' + val(x) + ')' : ''), P.id + ':end', ''); st.done = 1; continue; }
      if (won.length === rs.length && rs.every(x => x.o.st)) { await send(s, '🎉 ¡Pegó ' + nm + '!', P.pay ? 'Cobras ' + money(P.pay) : rs.length + ' de ' + rs.length + ' selecciones', P.id + ':end', ''); st.done = 1; continue; }
      for (const x of rs) {
        if (['won', 'push'].includes(x.r.st) && !['won', 'push'].includes(x.o.st)) { const left = rs.length - won.length;
          await send(s, (x.r.st === 'push' ? '↩️ ' : '✅ ') + sh(x), (x.r.st === 'push' ? 'Se anuló' : 'Cobró' + (val(x) ? ' con ' + val(x) : '')) + ' · ' + (left ? (left === 1 ? 'te falta 1' : 'te faltan ' + left) : nm), P.id + ':' + x.L.id, x.L.key); }
        else if (x.r.need === 1 && !x.o.near && x.L.ou === 'over') await send(s, '🔥 A una: ' + sh(x), 'Lleva ' + val(x) + ' · ' + nm, P.id + ':' + x.L.id + ':n', x.L.key);
      }
      // Resumen corto: al medio tiempo de un partido del parlay, o cada 30 min si cambió el pronóstico
      const live = rs.filter(x => ['live', 'ok', 'bad'].includes(x.r.st));
      if (live.length && !old.liveAt) { st.liveAt = now; st.sumSig = rs.filter(x => ['won', 'push', 'ok'].includes(x.r.st)).length + '/' + rs.filter(x => x.r.st === 'bad').length; }
      else if (live.length) {
        const ok = rs.filter(x => ['won', 'push', 'ok'].includes(x.r.st)).length, badL = rs.filter(x => x.r.st === 'bad');
        const sig = ok + '/' + badL.length; const ht = rs.some(x => st.legs[x.L.id].ht && !(x.o.ht));
        if (ht || (now - Math.max(old.sumAt || 0, old.liveAt || 0) > 30 * 60e3 && sig !== old.sumSig)) {
          const pj = x => fmt(x.r.proj < 10 ? Math.round(x.r.proj * 10) / 10 : Math.round(x.r.proj));
          const needTxt = L => L.ou === 'over' ? 'necesita ' + (Math.floor(L.line) + 1) : 'máximo ' + (Math.ceil(L.line) - 1);
          // Una línea por selección con círculo de color: 🟢 va bien · 🟡 abajo del ritmo · ✅ ya cobró · ⚪ no ha empezado
          const dot = x => ['won', 'push'].includes(x.r.st) ? '✅' : x.r.st === 'ok' ? '🟢' : x.r.st === 'bad' ? '🟡' : x.r.st === 'live' ? '🟢' : '⚪';
          // "Wembanyama 20/28.5 pts": lo que lleva / la línea
          const shv = x => typeof x.r.v === 'number' && x.L.line != null ? sh(x).replace(/[+-](\d+(?:\.\d+)?)/, fmt(x.r.v) + '/$1') + (x.L.ou === 'under' ? ' (menos)' : '') : sh(x);
          const lines = rs.map(x => dot(x) + ' ' + shv(x) + (x.r.st === 'bad' && x.r.proj != null ? ' · va para ' + pj(x) : ''));
          const body = lines.slice(0, 4).join('\n') + (lines.length > 4 ? '\n+' + (lines.length - 4) + ' más' : '');
          await send(s, '📊 ' + nm + ': ' + ok + ' de ' + rs.length + (ok === 1 ? ' va bien' : ' van bien'), body, P.id + ':sum', '');
          st.sumAt = now; st.sumSig = sig;
        }
      }
    }
    await stateStore.setJSON('parlays', pnext);
  }
  return new Response('ok · ' + all.length + ' juegos · ' + pk.size + ' de parlays · ' + sent + ' avisos');
};

export const config = { schedule: '* * * * *' };
