// Prueba rápida de fuentes de fotos desde GitHub Actions (solo imprime resultados)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Accept': 'application/json, text/plain, */*', 'Accept-Language': 'en-US,en;q=0.9' };
const tests = [
  ['fotmob suggest', 'https://www.fotmob.com/api/search/suggest?lang=en&term=Franco%20Armani'],
  ['fotmob data suggest', 'https://www.fotmob.com/api/data/search/suggest?lang=en&term=Franco%20Armani'],
  ['sofascore search', 'https://api.sofascore.com/api/v1/search/all?q=Franco%20Armani&page=0'],
  ['sofascore app search', 'https://api.sofascore.app/api/v1/search/all?q=Franco%20Armani&page=0'],
  ['transfermarkt quick', 'https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=Franco+Armani'],
  ['tm api', 'https://tmapi-alpha.transfermarkt.technology/search?query=Franco%20Armani'],
];
for (const [n, u] of tests) {
  try { const r = await fetch(u, { headers: H }); const t = await r.text(); console.log('=== ' + n + ' ' + r.status + ' ' + (r.headers.get('content-type') || '')); console.log(t.slice(0, 600).replace(/\s+/g, ' ')); }
  catch (e) { console.log('=== ' + n + ' ERR ' + e.message); }
}
for (const u of ['https://api.sofascore.app/api/v1/player/63564/image', 'https://images.fotmob.com/image_resources/playerimages/30981.png', 'https://img.a.transfermarkt.technology/portrait/big/28003-1710080339.jpg']) {
  try { const r = await fetch(u, { headers: H }); console.log('IMG ' + r.status + ' ' + r.headers.get('content-type') + ' ' + u); } catch (e) { console.log('IMG ERR ' + u); }
}
