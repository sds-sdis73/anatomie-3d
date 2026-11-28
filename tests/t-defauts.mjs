// Défauts relevés à la relecture de l'intégration 1.3 : chaque contrôle reproduit un défaut (il échouait avant sa correction).
import { demarrerServeur, ouvrirAppli, geste, toucher, appuiLong, attendre, Rapport, CHROME } from './commun.mjs';
import { ui } from './interface.mjs';

const visibles = page => page.evaluate(() => window.__anatomie.visiblesPar());
const bulleTexte = page => page.evaluate(() => { const b = document.getElementById('bulle'); return b.classList.contains('cache') ? '' : b.textContent; });
const cx = 560, cy = 360;
// Une section qui plante ne doit pas empêcher les suivantes
async function section(r, nom, f) {
  try { await f(); } catch (e) { r.ok(false, nom + ' : le contrôle s’est interrompu', e.message.split('\n')[0]); }
}
// une seule session par page : le protocole de Chrome suit le doigt posé d'un appel à l'autre
const sessions = new WeakMap();
async function cdpTouch(page, type, pts) {
  if (!sessions.has(page)) sessions.set(page, await page.target().createCDPSession());
  await sessions.get(page).send('Input.dispatchTouchEvent', { type, touchPoints: pts });
}

export default async function (nav, url) {
  const r = new Rapport('Défauts corrigés après la relecture 1.3');

  // ---------- 1. Service worker et fichiers illisibles ----------
  await section(r, '1', async () => {
    const { page } = await ouvrirAppli(nav, url);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 10000 });
    // une requête de données qui échoue ne doit pas recevoir la page d'accueil à la place
    const rep = await page.evaluate(() => fetch('http://127.0.0.1:1/donnees/absent.bin').then(x => 'reçu ' + x.status + ' ' + (x.headers.get('content-type') || ''), () => 'refusé'));
    r.ok(rep === 'refusé', 'service worker : une donnée injoignable est refusée (pas de page d’accueil à la place)', rep);
    await page.close();
  });
  await section(r, '1b', async () => {
    let html = true;
    const { page } = await ouvrirAppli(nav, url, { avantChargement: async pg => {
      await pg.setBypassServiceWorker(true); await pg.setRequestInterception(true);
      pg.on('request', q => { if (html && /donnees\/insertions\.bin/.test(q.url())) q.respond({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html><html><body>Anatomie</body></html>' }); else q.continue(); });
    } });
    await ui.chercher(page, 'psoas'); await ui.premierResultat(page);
    await page.evaluate(() => document.getElementById('b-insertions').click()); await attendre(1500);
    const b = await bulleTexte(page);
    r.ok(/hors connexion|pas disponible/i.test(b) && !/Chargement/.test(b), 'paquet illisible : message clair au lieu d’un chargement sans fin', b);
    html = false;
    await page.evaluate(() => document.getElementById('b-insertions').click()); await attendre(2000);
    r.ok(((await visibles(page)).insertions || 0) > 0, 'paquet illisible : un nouvel essai réussit quand le fichier redevient lisible');
    await page.close();
  });
  await section(r, '1c', async () => {
    let casse = true;
    const { page } = await ouvrirAppli(nav, url, { accueil: true, avantChargement: async pg => {
      await pg.setBypassServiceWorker(true); await pg.setRequestInterception(true);
      // nerfs.bin : ses pièces sont construites dans un lot différé (setTimeout), là où une erreur n'était pas rattrapée
      pg.on('request', q => { if (casse && /donnees\/tronc\/nerfs\.bin/.test(q.url())) q.respond({ status: 200, contentType: 'text/html', body: '<html>hors ligne</html>' }); else q.continue(); });
    } });
    await page.evaluate(() => document.querySelector('.vignette[data-region="tronc"]').click());
    await attendre(600); // le chargement de la région a commencé (sinon on lirait l'état du corps entier encore affiché)
    const fini = await page.waitForFunction(() => window.__anatomie.pret && document.getElementById('chargement').classList.contains('cache'), { timeout: 15000 }).then(() => true, () => false);
    const j = await page.evaluate(() => window.__anatomie.jeu());
    r.ok(fini && j.dossier === '', 'région au fichier illisible : on retombe sur le corps entier au lieu de rester figé', JSON.stringify(j));
    casse = false;
    await ui.region(page, 'membre-superieur');
    r.ok((await page.evaluate(() => window.__anatomie.jeu().dossier)) === 'membre-superieur/', 'après cet échec, une autre région se charge (file non bloquée)');
    await page.close();
  });

  // ---------- 2. Régions gardées hors connexion (cache séparé, tout ou rien) ----------
  await section(r, '2', async () => {
    const srv = await demarrerServeur(); // serveur à part, pour pouvoir le couper
    const { page } = await ouvrirAppli(nav, srv.url, { accueil: true });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 10000 });
    await ui.region(page, 'tronc');
    const garde = await page.waitForFunction(() => window.__anatomie.regionGardee && window.__anatomie.regionGardee('tronc/') === 'complète', { timeout: 30000 }).then(() => true, () => false);
    const etatCache = await page.evaluate(async () => { const n = await caches.keys(); const out = {}; for (const k of n) out[k] = (await (await caches.open(k)).keys()).filter(q => /donnees\/tronc\//.test(q.url)).length; return out; });
    const nomCache = Object.keys(etatCache).find(k => /region/.test(k));
    r.ok(garde && nomCache && etatCache[nomCache] >= 10, 'une région ouverte en ligne est gardée entière dans un cache à part', JSON.stringify(etatCache));
    r.ok(Object.keys(etatCache).filter(k => k !== nomCache).every(k => !etatCache[k]), 'les fichiers de région ne sont pas dans le cache de l’application', JSON.stringify(etatCache));
    srv.fermer(); await attendre(300);
    await ui.region(page, 'corps');
    await ui.region(page, 'tronc');
    r.ok((await page.evaluate(() => window.__anatomie.jeu().dossier)) === 'tronc/' && ((await visibles(page)).muscles || 0) > 10, 'serveur coupé : la région gardée s’ouvre hors connexion');
    await page.close();
  });
  await section(r, '2b', async () => {
    const srv = await demarrerServeur();
    const { page } = await ouvrirAppli(nav, srv.url, { accueil: true, avantChargement: async pg => {
      await pg.evaluateOnNewDocument(() => { // simule le quota de stockage d'iOS : l'enregistrement d'un gros fichier de région échoue
        const put = Cache.prototype.put;
        Cache.prototype.put = function (req, rep) { const u = typeof req === 'string' ? req : req.url; if (/donnees\/tronc\/muscles\.bin/.test(u)) return Promise.reject(new DOMException('quota', 'QuotaExceededError')); return put.call(this, req, rep); };
      });
    } });
    await ui.region(page, 'tronc');
    const msg = await page.waitForFunction(() => /Mémoire de l’iPad insuffisante|Mémoire de l'iPad insuffisante/.test(document.getElementById('bulle').textContent), { timeout: 30000 }).then(() => true, () => false);
    await attendre(500);
    const reste = await page.evaluate(async () => { let n = 0; for (const k of await caches.keys()) n += (await (await caches.open(k)).keys()).filter(q => /donnees\/tronc\//.test(q.url)).length; return n; });
    r.ok(msg, 'mémoire insuffisante : la bulle prévient que la région restera en ligne seulement');
    r.ok(reste === 0, 'mémoire insuffisante : rien de la région ne reste en cache (tout ou rien)', reste + ' fichier(s) restant(s)');
    await page.close(); srv.fermer();
  });

  // ---------- page commune pour les défauts d'interface ----------
  const { page, erreurs } = await ouvrirAppli(nav, url);

  // ---------- 3. Changer de jeu vide la recherche ----------
  await section(r, '3', async () => {
    await ui.chercher(page, 'psoas');
    await ui.fermerPanneaux(page);
    await ui.region(page, 'tronc');
    const rech = await page.evaluate(() => ({ n: document.querySelectorAll('#resultats button').length, v: document.getElementById('champ-recherche').value }));
    r.ok(!rech.n && !rech.v, 'changer de région vide la recherche (pas de résultat de l’ancien jeu)', JSON.stringify(rech));
  });

  // ---------- 4. Vues › Régions selon le jeu ----------
  await section(r, '4', async () => {
    await ui.region(page, 'membre-superieur');
    const noms = await page.evaluate(() => [...document.querySelectorAll('#vues-regions > button, #vues-regions .region .nom')].map(e => e.textContent));
    r.ok(noms.indexOf('Genou') < 0 && noms.indexOf('Cheville et pied') < 0 && noms.indexOf('Coude') >= 0, 'membre supérieur : les vues du genou ou de la cheville ne sont pas proposées', noms.join(', '));
    await ui.region(page, 'corps');
    const noms2 = await page.evaluate(() => [...document.querySelectorAll('#vues-regions > button, #vues-regions .region .nom')].map(e => e.textContent));
    r.ok(noms2.indexOf('Genou') >= 0 && noms2.length === 14, 'corps entier : toutes les vues de régions reviennent', noms2.length + ' vues');
  });

  // ---------- 5. Mode « seule couche » annulé par la règle et la recherche ----------
  await section(r, '5', async () => {
    await ui.region(page, 'corps');
    const [xo, yo] = await ui.rangRegle(page, 6);
    await appuiLong(page, xo, yo);
    await ui.niveau(page, 3);
    const v = await visibles(page);
    r.ok(v.muscles > 100 && !(await page.evaluate(() => window.__anatomie.etat.seule)), 'toucher la règle après « seule couche » rétablit les couches', JSON.stringify(v));
    await appuiLong(page, xo, yo);
    await ui.chercher(page, 'psoas'); await ui.premierResultat(page);
    const v2 = await visibles(page);
    r.ok(v2.muscles > 50 && (v2.os || 0) > 50 && !(await page.evaluate(() => window.__anatomie.etat.seule)), 'une recherche après « seule couche » rétablit les autres couches', JSON.stringify(v2));
  });

  // ---------- 6. Masquer la seule structure isolée ----------
  await section(r, '6', async () => {
    await ui.region(page, 'corps');
    await toucher(page, cx, cy);
    await ui.action(page, 'isoler');
    await page.evaluate(() => document.getElementById('b-masquer').click()); await attendre(300);
    const n = await page.evaluate(() => window.__anatomie.visibles());
    r.ok(n > 100 && !(await page.evaluate(() => window.__anatomie.etat.isole)), 'masquer la seule structure isolée ne laisse pas l’écran vide', n + ' visibles');
  });

  // ---------- 7. touchcancel ----------
  await section(r, '7', async () => {
    await ui.region(page, 'corps');
    await cdpTouch(page, 'touchStart', [{ x: cx, y: cy, id: 0 }]);
    await attendre(150);
    await cdpTouch(page, 'touchCancel', []);
    await attendre(900);
    r.ok(!(await ui.menuOuvert(page)), 'un toucher annulé par le système n’ouvre pas le menu d’appui long');
  });

  // ---------- 10. Toucher le corps pour fermer un panneau ----------
  await section(r, '10', async () => {
    await ui.region(page, 'corps');
    await ui.ouvrirPanneau(page, 'vues');
    await toucher(page, cx, cy);
    const e = await page.evaluate(() => ({ panneau: !!document.querySelector('.panneau.ouvert'), sel: !!window.__anatomie.etat.sel }));
    r.ok(!e.panneau && !e.sel, 'toucher le corps quand un panneau est ouvert ferme seulement le panneau', JSON.stringify(e));
  });

  // ---------- 11. Minuteries du quiz ----------
  await section(r, '11', async () => {
    await ui.region(page, 'corps');
    await ui.quiz(page);
    await toucher(page, cx, cy); // réponse : une question suivante est programmée
    await page.evaluate(() => { document.getElementById('b-quiz-fin').click(); });
    await ui.quiz(page);
    const n0 = await page.evaluate(() => window.__anatomie.etat.quiz && window.__anatomie.etat.quiz.n);
    await attendre(3000);
    const n1 = await page.evaluate(() => window.__anatomie.etat.quiz && window.__anatomie.etat.quiz.n);
    r.ok(n0 === 1 && n1 === 1, 'un quiz relancé ne saute pas de question à cause de l’ancien', n0 + ' → ' + n1);
    await ui.finQuiz(page);
  });

  // ---------- 12. Appui long puis rotation ----------
  await section(r, '12', async () => {
    await ui.region(page, 'corps');
    await cdpTouch(page, 'touchStart', [{ x: cx, y: cy, id: 0 }]);
    await attendre(800);
    for (let k = 1; k <= 8; k++) { await cdpTouch(page, 'touchMove', [{ x: cx + k * 12, y: cy, id: 0 }]); await attendre(16); }
    await cdpTouch(page, 'touchEnd', []);
    await attendre(400);
    const e = await page.evaluate(() => ({ sel: !!window.__anatomie.etat.sel, menu: !document.getElementById('menu-appui').classList.contains('cache') }));
    r.ok(!e.sel && !e.menu, 'appui long puis rotation : ni sélection ni menu ne restent', JSON.stringify(e));
  });

  // ---------- 13. Système absent du jeu ----------
  await section(r, '13', async () => {
    await ui.region(page, 'tronc');
    await page.evaluate(() => document.querySelector('#systemes .oeil[data-s="encephale"]').click()); await attendre(300);
    const e = await page.evaluate(() => ({ on: window.__anatomie.etat.encephale, oeil: document.querySelector('#systemes .oeil[data-s="encephale"]').classList.contains('on'), b: document.getElementById('bulle').textContent }));
    r.ok(!e.on && !e.oeil && /Non disponible dans cette région/.test(e.b), 'tronc : l’encéphale absent est signalé et son œil reste éteint', JSON.stringify(e));
  });

  // ---------- 14. Pas de zoom de la page au double toucher ----------
  await section(r, '14', async () => {
    const ta = await page.evaluate(() => [getComputedStyle(document.getElementById('o-toutvoir')).touchAction, getComputedStyle(document.querySelector('#regle .rang')).touchAction]);
    r.ok(ta[0] === 'manipulation' && ta[1] === 'manipulation', 'boutons et rangs de la règle : touch-action manipulation (seule valeur comprise par iOS 12)', ta.join(', '));
    const b = await page.evaluate(() => { const r2 = document.getElementById('o-toutvoir').getBoundingClientRect(); return [r2.left + r2.width / 2, r2.top + r2.height / 2]; });
    for (let k = 0; k < 2; k++) { await cdpTouch(page, 'touchStart', [{ x: b[0], y: b[1], id: 0 }]); await attendre(40); await cdpTouch(page, 'touchEnd', []); await attendre(80); }
    await attendre(500);
    r.ok(await page.evaluate(() => (window.visualViewport ? window.visualViewport.scale : 1) === 1), 'un double toucher sur un bouton ne zoome pas la page');
  });

  // ---------- 15. Clavier de la recherche ----------
  await section(r, '15', async () => {
    await ui.fermerPanneaux(page);
    const actif = await page.evaluate(() => { document.querySelector('[data-panneau="p-recherche"]').click(); return document.activeElement && document.activeElement.id; });
    r.ok(actif === 'champ-recherche', 'ouvrir la recherche donne le focus au champ dans le même geste (clavier iOS 12)', actif);
    await ui.fermerPanneaux(page);
  });

  // ---------- 16. Coupe : faces coupées sans taches noires ----------
  await section(r, '16', async () => {
    await ui.region(page, 'tronc');
    await ui.niveau(page, 0);
    await ui.coupe(page, 'sagittal');
    await page.evaluate(() => { const a = window.__anatomie, d = new THREE.Vector3(1, 0.1, 0.25).normalize(); a.controls.target.set(0, 118, -6); a.camera.position.set(0, 118, -6).addScaledVector(d, 70); a.controls.update(); });
    await attendre(400);
    const taches = await page.evaluate(() => window.__anatomie.tachesCoupe ? window.__anatomie.tachesCoupe() : -1);
    r.ok(taches >= 0 && taches < 0.002, 'coupe sagittale du rachis : pas de taches noires sur les faces coupées', 'part de pixels noirs dans les tranches : ' + taches);
    await ui.coupe(page, null);
  });

  // ---------- 17. Cadrage des régions dans la zone libre ----------
  await section(r, '17', async () => {
    for (const reg of ['tete-cou', 'tronc', 'membre-superieur', 'membre-inferieur']) {
      await ui.region(page, reg);
      const res = await page.evaluate(() => {
        const a = window.__anatomie, b = a.boiteRegion ? a.boiteRegion() : null; if (!b) return { err: 'pas de boîte' };
        const haut = document.getElementById('barre-haut').getBoundingClientRect().bottom, bas = document.getElementById('barre-outils').getBoundingClientRect().top, droite = document.getElementById('couches').getBoundingClientRect().left;
        let mx = [1e9, 1e9], Mx = [-1e9, -1e9];
        for (const x of [b[0][0], b[1][0]]) for (const y of [b[0][1], b[1][1]]) for (const z of [b[0][2], b[1][2]]) {
          const v = new THREE.Vector3(x, y, z).project(a.camera); const px = (v.x + 1) / 2 * innerWidth, py = (1 - v.y) / 2 * innerHeight;
          mx = [Math.min(mx[0], px), Math.min(mx[1], py)]; Mx = [Math.max(Mx[0], px), Math.max(Mx[1], py)];
        }
        return { ok: mx[0] >= -2 && Mx[0] <= droite + 2 && mx[1] >= haut - 2 && Mx[1] <= bas + 2, coins: [mx, Mx].map(p => p.map(Math.round)), zone: [0, Math.round(haut), Math.round(droite), Math.round(bas)] };
      });
      r.ok(res.ok, reg + ' : la boîte de la région tient dans la zone libre', JSON.stringify(res));
    }
    await ui.region(page, 'membre-inferieur');
    await geste(page, [[[cx, cy], [cx + 200, cy + 60]]]);
    await ui.toutReafficher(page);
    await attendre(900);
    const ok = await page.evaluate(() => { const a = window.__anatomie, b = a.boiteRegion ? a.boiteRegion() : null; if (!b) return false; const v = new THREE.Vector3((b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2).project(a.camera); return Math.abs(v.x) < 0.5 && Math.abs(v.y) < 0.5; });
    r.ok(ok, '« Tout voir » recadre la région après une rotation');
  });
  r.ok(!erreurs.length, 'défauts d’interface : aucune erreur dans la console', erreurs.slice(0, 4).join(' | '));
  await page.close();

  // ---------- 8 et 9. Premier lancement et erreur passagère ----------
  await section(r, '8', async () => {
    const pg = await nav.newPage();
    await pg.setViewport({ width: 1024, height: 768, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await pg.setBypassServiceWorker(true); await pg.setRequestInterception(true);
    pg.on('request', q => { if (/donnees\/os\.bin/.test(q.url())) setTimeout(() => q.continue(), 3000); else q.continue(); });
    await pg.goto(url, { waitUntil: 'load' });
    await pg.waitForFunction(() => !!window.__anatomie, { timeout: 10000 });
    await pg.evaluate(() => document.querySelector('.vignette[data-region="tronc"]').click());
    await pg.waitForFunction(() => window.__anatomie.pret && window.__anatomie.jeu().dossier === 'tronc/', { timeout: 30000 });
    const journal = await pg.evaluate(() => window.__anatomie.journal || null);
    r.ok(journal && journal.join(',') === 'tronc/', 'premier lancement : choisir une région pendant le chargement abandonne le corps entier', JSON.stringify(journal));
    await pg.close();
  });
  await section(r, '9', async () => {
    let coupe = true;
    const { page: pg } = await ouvrirAppli(nav, url, { accueil: true, avantChargement: async p => {
      await p.setBypassServiceWorker(true); await p.setRequestInterception(true);
      p.on('request', q => { if (coupe && /donnees\/tronc\//.test(q.url())) q.abort('failed'); else q.continue(); });
    } });
    await ui.region(pg, 'tronc');
    const b = await bulleTexte(pg);
    r.ok((await pg.evaluate(() => window.__anatomie.jeu().dossier)) === '' && /corps entier/i.test(b), 'région injoignable : repli sur le corps entier annoncé par une bulle', b);
    coupe = false;
    await ui.region(pg, 'tronc');
    r.ok((await pg.evaluate(() => window.__anatomie.jeu().dossier)) === 'tronc/', 'après une erreur passagère, la région se charge au nouvel essai');
    await pg.close();
  });
  return r;
}
