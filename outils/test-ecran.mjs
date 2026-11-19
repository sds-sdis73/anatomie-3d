import puppeteer from 'puppeteer-core';
const navigateur = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await navigateur.newPage();
await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1, hasTouch: false });
const erreurs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) erreurs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => erreurs.push('pageerror: ' + e.message));
const t0 = Date.now();
await page.goto('http://localhost:8765/?t=' + Date.now(), { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('chargement').style.display === 'none' || /Impossible/.test(document.getElementById('texte-prog').textContent), { timeout: 60000 });
console.log('chargé en', Date.now() - t0, 'ms');
await new Promise(r => setTimeout(r, 800));
const actions = process.argv.slice(2);
let n = 0;
for (const a of actions) {
  if (a.startsWith('clic:')) { await page.click(a.slice(5)); await new Promise(r => setTimeout(r, 900)); }
  else if (a.startsWith('xy:')) { const [x, y] = a.slice(3).split(',').map(Number); await page.mouse.click(x, y); await new Promise(r => setTimeout(r, 700)); }
  else if (a.startsWith('eval:')) { console.log('eval →', await page.evaluate(a.slice(5))); await new Promise(r => setTimeout(r, 900)); }
  else if (a.startsWith('type:')) { const [sel, ...t] = a.slice(5).split('|'); await page.type(sel, t.join('|'), { delay: 20 }); await new Promise(r => setTimeout(r, 600)); }
  else if (a.startsWith('drag:')) { const pts = a.slice(5).split(';').map(q => q.split(',').map(Number)); await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down(); for (const q of pts.slice(1)) await page.mouse.move(q[0], q[1], { steps: 12 }); await page.mouse.up(); await new Promise(r => setTimeout(r, 500)); }
  else if (a.startsWith('shot:')) { await page.screenshot({ path: '/private/tmp/claude-501/-Users-toutoune/68c0657a-a497-4668-b217-4407c452d422/scratchpad/' + a.slice(5) + '.png' }); n++; }
}
console.log(erreurs.length ? erreurs.join('\n') : 'aucune erreur console');
await navigateur.close();
