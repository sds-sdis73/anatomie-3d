// Outils communs aux tests : serveur statique, navigateur, gestes tactiles, résultats.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DOCS = path.join(RACINE, 'docs');
export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.bin': 'application/octet-stream' };

// Serveur statique minimal pour docs/
export function demarrerServeur(dossier = DOCS) {
  return new Promise(ok => {
    const srv = http.createServer((req, res) => {
      const chemin = decodeURIComponent(req.url.split('?')[0]);
      let f = path.join(dossier, chemin);
      if (!f.startsWith(dossier)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end('absent'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => ok({ url: 'http://127.0.0.1:' + srv.address().port + '/', fermer: () => srv.close() }));
  });
}

export async function lancerNavigateur() {
  return puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
}

// Ouvre l'appli au format iPad mini (1024×768, écran tactile) et attend la fin du chargement.
export async function ouvrirAppli(nav, url, { tactile = true, largeur = 1024, hauteur = 768 } = {}) {
  const page = await nav.newPage();
  const erreurs = [];
  page.on('console', m => { if (m.type() === 'error') erreurs.push('console : ' + m.text()); });
  page.on('pageerror', e => erreurs.push('exception : ' + e.message));
  page.on('response', rep => { if (rep.status() >= 400) erreurs.push('HTTP ' + rep.status() + ' : ' + rep.url()); });
  page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Vue de test' : undefined));
  await page.setViewport({ width: largeur, height: hauteur, deviceScaleFactor: 2, hasTouch: tactile, isMobile: tactile });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__anatomie && window.__anatomie.pret, { timeout: 60000 });
  await attendre(400);
  return { page, erreurs };
}

export const attendre = ms => new Promise(r => setTimeout(r, ms));

// Gestes tactiles multi-doigts via le protocole de Chrome.
// trajets : un élément par doigt, [[x0, y0], [x1, y1]] = départ → arrivée.
export async function geste(page, trajets, { pas = 12, delai = 16 } = {}) {
  const cdp = await page.target().createCDPSession();
  const pts = t => trajets.map((tr, i) => ({ x: tr[0][0] + (tr[1][0] - tr[0][0]) * t, y: tr[0][1] + (tr[1][1] - tr[0][1]) * t, id: i }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(0) });
  for (let k = 1; k <= pas; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(k / pas) }); await attendre(delai); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await attendre(250);
}

export async function toucher(page, x, y) {
  const cdp = await page.target().createCDPSession();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
  await attendre(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await attendre(350);
}

// Collecteur de résultats
export class Rapport {
  constructor(nom) { this.nom = nom; this.lignes = []; }
  ok(cond, libelle, detail) { this.lignes.push({ ok: !!cond, libelle, detail: cond ? '' : (detail || '') }); return !!cond; }
  get echecs() { return this.lignes.filter(l => !l.ok); }
  afficher() {
    console.log('\n■ ' + this.nom);
    for (const l of this.lignes) console.log((l.ok ? '  ✓ ' : '  ✗ ') + l.libelle + (l.detail ? '\n      → ' + l.detail : ''));
  }
}
