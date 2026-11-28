// Captures de contrôle des jeux de données régionaux, rendues avec prototype/index.html.
// Usage : node captures-regions.mjs   → conception/regions/<region>-<vue>.png
// À regarder à l'œil : pièces manquantes, découpe propre au bord de la région, fibres musculaires.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = path.join(RACINE, 'conception', 'regions');
fs.mkdirSync(SORTIE, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const f = path.join(RACINE, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const base = 'http://127.0.0.1:' + srv.address().port + '/prototype/index.html';

// [fichier, dossier de données ('' = corps entier), paramètres du prototype]
const VUES = [
  ['tete-cou-face', 'tete-cou', 'cible=0,150,2&dir=0,0.05,1&dist=95'],
  ['tete-cou-profil', 'tete-cou', 'cible=0,150,0&dir=-1,0.1,0.15&dist=95'],
  ['tete-cou-profond', 'tete-cou', 'cible=0,150,0&dir=-0.6,0.1,0.8&dist=95&niveau=1'],
  ['tete-cou-peau-systemes', 'tete-cou', 'cible=0,148,0&dir=-0.5,0.1,0.85&dist=110&extra=peau,nerfs,cardio'],
  ['tronc-face', 'tronc', 'cible=0,115,0&dir=0,0.05,1&dist=175'],
  ['tronc-dos', 'tronc', 'cible=0,115,0&dir=0.15,0.1,-1&dist=175'],
  ['tronc-squelette', 'tronc', 'cible=0,115,0&dir=0.3,0.05,1&dist=175&niveau=0'],
  ['tronc-peau-systemes', 'tronc', 'cible=0,115,0&dir=0.5,0.05,0.85&dist=185&extra=peau,nerfs,cardio'],
  ['membre-superieur-face', 'membre-superieur', 'cible=0,112,0&dir=0,0.05,1&dist=190'],
  ['membre-superieur-dos', 'membre-superieur', 'cible=0,112,0&dir=0,0.1,-1&dist=190'],
  ['membre-superieur-peau-systemes', 'membre-superieur', 'cible=-20,112,0&dir=-0.4,0.05,0.9&dist=120&extra=peau,nerfs,cardio'],
  ['membre-superieur-main', 'membre-superieur', 'cible=-27,80,4&dir=-0.3,0.1,1&dist=38'],
  ['corps-entier-main', '', 'cible=-27,80,4&dir=-0.3,0.1,1&dist=38'],
  ['membre-inferieur-face', 'membre-inferieur', 'cible=0,58,0&dir=0,0.05,1&dist=250'],
  ['membre-inferieur-dos', 'membre-inferieur', 'cible=0,58,0&dir=0,0.1,-1&dist=250'],
  ['membre-inferieur-peau-systemes', 'membre-inferieur', 'cible=0,70,0&dir=0.5,0.05,0.85&dist=230&extra=peau,nerfs,cardio'],
  ['membre-inferieur-genou', 'membre-inferieur', 'cible=-8,45,1&dir=-0.4,0.1,1&dist=45'],
  ['corps-entier-genou', '', 'cible=-8,45,1&dir=-0.4,0.1,1&dist=45'],
];

const nav = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await nav.newPage();
await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
const erreurs = [];
page.on('pageerror', e => { erreurs.push(e.message); console.log('erreur de page :', e.message); });
page.on('console', m => { if (m.type() === 'error') console.log('console :', m.text()); });
for (const [nom, dossier, params] of VUES) {
  const d = dossier ? '&donnees=../docs/donnees/' + dossier + '/' : '';
  await page.goto(base + '?fond=clair&' + params + d, { waitUntil: 'load' });
  await page.waitForFunction(() => document.title === 'pret', { timeout: 60000 });
  await page.screenshot({ path: path.join(SORTIE, nom + '.png') });
  console.log('capture', nom);
}
await nav.close(); srv.close();
console.log(erreurs.length ? 'erreurs : ' + erreurs.join(' / ') : 'aucune erreur de page');
