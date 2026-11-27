// Parcours complets dans un Chrome au format iPad (tactile), contexte WebGL 1 comme sur l'iPad mini 2.
import { ouvrirAppli, geste, toucher, attendre, Rapport } from './commun.mjs';
import { ui } from './interface.mjs';

const lire = page => page.evaluate(() => {
  const a = window.__anatomie, c = a.camera.position, t = a.controls.target;
  return { cam: [c.x, c.y, c.z], cible: [t.x, t.y, t.z], info: a.info(), scrollY: window.scrollY, scrollX: window.scrollX,
    haut: document.body.getBoundingClientRect().top, visibles: a.visiblesPar() };
});
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dir = s => { const d = [s.cam[0] - s.cible[0], s.cam[1] - s.cible[1], s.cam[2] - s.cible[2]], l = Math.hypot(...d); return d.map(x => x / l); };
// position à l'écran d'un point 3D
const projeter = (page, p) => page.evaluate(p => {
  const a = window.__anatomie, v = new THREE.Vector3(p[0], p[1], p[2]).project(a.camera);
  return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight];
}, p);

export default async function (nav, url) {
  const r = new Rapport('Parcours et gestes (format iPad, tactile)');
  const { page, erreurs } = await ouvrirAppli(nav, url);
  const W = 1024, H = 768, cx = 560, cy = 360;

  // ---- chargement
  const v = await page.evaluate(() => window.__anatomie.version);
  r.ok(true, 'application chargée (version ' + v + ')');
  let s0 = await lire(page);
  r.ok(s0.visibles.os > 100 && s0.visibles.muscles > 100, 'au démarrage : os et muscles affichés', JSON.stringify(s0.visibles));
  r.ok(!s0.visibles.peau, 'au démarrage : peau masquée');

  // ---- la page ne saute pas
  const avant = await lire(page);
  const cdp = await page.target().createCDPSession();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 0 }] });
  await attendre(120);
  const pendant = await lire(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + 30, y: cy, id: 0 }] });
  await attendre(120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach(); await attendre(300);
  const apres = await lire(page);
  const memeTaille = [pendant, apres].every(x => x.info.w === avant.info.w && x.info.h === avant.info.h && x.info.pr === avant.info.pr);
  r.ok(memeTaille, 'pas de changement de résolution quand un doigt se pose (pas de saut d’image)', JSON.stringify([avant.info, pendant.info, apres.info].map(i => i.w + 'x' + i.h + '@' + i.pr)));
  r.ok([pendant, apres].every(x => x.scrollY === 0 && x.scrollX === 0 && Math.abs(x.haut) < 1), 'la page ne défile pas et ne rebondit pas');

  // ---- un doigt : rotation
  s0 = await lire(page);
  await geste(page, [[[cx, cy], [cx + 220, cy]]]);
  let s1 = await lire(page);
  r.ok(dist(s0.cam, s1.cam) > 20 && dist(s0.cible, s1.cible) < 0.5, 'un doigt qui glisse fait tourner le corps autour de son centre');

  // ---- deux doigts parallèles : déplacement sans rotation
  s0 = await lire(page);
  await geste(page, [[[cx - 60, cy], [cx + 90, cy + 40]], [[cx + 60, cy], [cx + 210, cy + 40]]]);
  s1 = await lire(page);
  const d0 = dir(s0), d1 = dir(s1);
  const angle = Math.acos(Math.min(1, d0[0] * d1[0] + d0[1] * d1[1] + d0[2] * d1[2])) * 180 / Math.PI;
  r.ok(dist(s0.cible, s1.cible) > 5, 'deux doigts qui glissent déplacent le corps', 'déplacement de la cible : ' + dist(s0.cible, s1.cible).toFixed(1) + ' cm');
  r.ok(angle < 3, 'deux doigts qui glissent ne font pas tourner le corps', 'rotation parasite : ' + angle.toFixed(1) + '°');
  const zoom2 = Math.abs(dist(s0.cam, s0.cible) - dist(s1.cam, s1.cible));
  r.ok(zoom2 < 0.08 * dist(s0.cam, s0.cible), 'deux doigts parallèles ne zooment pas', 'variation de distance ' + zoom2.toFixed(1));

  // ---- pincement : zoom vers le point entre les doigts
  await ui.accueil(page);
  const px = 470, py = 300; // zone à gauche du centre
  const cibleZoom = await page.evaluate((x, y) => { const a = window.__anatomie; const h = a.viser(x, y); return h; }, px, py);
  const p3 = await page.evaluate((x, y) => {
    const a = window.__anatomie, rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), a.camera);
    const hits = rc.intersectObjects(a.scene.children, true).filter(h => h.object.visible && h.object.isMesh);
    return hits.length ? [hits[0].point.x, hits[0].point.y, hits[0].point.z] : null;
  }, px, py);
  s0 = await lire(page);
  await geste(page, [[[px - 30, py], [px - 150, py]], [[px + 30, py], [px + 150, py]]], { pas: 16 });
  s1 = await lire(page);
  r.ok(dist(s1.cam, s1.cible) < 0.75 * dist(s0.cam, s0.cible), 'écarter deux doigts rapproche la vue');
  if (p3) {
    const e = await projeter(page, p3);
    const ecart = Math.hypot(e[0] - px, e[1] - py);
    r.ok(ecart < 40, 'le zoom se fait vers l’endroit entre les doigts (' + (cibleZoom ? cibleZoom.fr : '?') + ')', 'le point visé a glissé de ' + Math.round(ecart) + ' px');
  } else r.ok(false, 'le zoom se fait vers l’endroit entre les doigts', 'aucune structure sous les doigts pour le test');

  // ---- toucher pour nommer
  await ui.accueil(page);
  const vise = await page.evaluate((x, y) => window.__anatomie.viser(x, y), cx, cy);
  await toucher(page, cx, cy);
  const nom = await ui.nomSelection(page);
  r.ok(vise && nom && nom.indexOf(vise.fr) === 0, 'toucher une structure affiche son nom', 'visé : ' + (vise && vise.fr) + ' / affiché : ' + nom);

  // ---- couches
  const parNiveau = {};
  for (const n of [4, 3, 2, 1, 0]) { await ui.niveau(page, n); parNiveau[n] = (await lire(page)).visibles; }
  r.ok(parNiveau[4].peau === 1 && !parNiveau[4].muscles, 'niveau peau : seule la peau est affichée', JSON.stringify(parNiveau[4]));
  r.ok(parNiveau[3].muscles > parNiveau[2].muscles && parNiveau[2].muscles > parNiveau[1].muscles && parNiveau[1].muscles > 0, 'éplucher retire les muscles plan par plan', [3, 2, 1].map(n => parNiveau[n].muscles).join(' > '));
  r.ok(!parNiveau[0].muscles && parNiveau[0].os > 100, 'niveau squelette : plus aucun muscle, os visibles');
  await ui.niveau(page, 3);

  // ---- recherche, fiche, insertions
  await ui.chercher(page, 'psoas');
  await ui.premierResultat(page);
  const nomPsoas = await ui.nomSelection(page);
  r.ok(/psoas/i.test(nomPsoas || ''), 'la recherche « psoas » sélectionne le grand psoas', nomPsoas);
  await ui.action(page, 'fiche');
  const fiche = await ui.texteFiche(page);
  r.ok(/Origine/.test(fiche) && /Innervation/.test(fiche) && /Action/.test(fiche), 'la fiche du muscle donne origine, innervation et action');
  await page.evaluate(() => { const b = document.getElementById('b-fiche-fermer'); if (b) b.click(); });
  await ui.action(page, 'insertions');
  await attendre(1200);
  const ins = (await lire(page)).visibles.insertions || 0;
  r.ok(ins > 0, 'les zones d’insertion du muscle s’affichent', ins + ' zone(s)');
  await ui.action(page, 'insertions');

  // ---- masquer, tout réafficher, isoler
  const nAvant = await page.evaluate(() => window.__anatomie.visibles());
  await ui.action(page, 'masquer');
  const nMasque = await page.evaluate(() => window.__anatomie.visibles());
  r.ok(nMasque === nAvant - 1, 'masquer retire exactement la structure choisie', nAvant + ' → ' + nMasque);
  await ui.toutReafficher(page);
  await ui.chercher(page, 'femur'); await ui.premierResultat(page);
  await ui.action(page, 'isoler');
  const nIso = await page.evaluate(() => window.__anatomie.visibles());
  r.ok(nIso === 1, 'isoler n’affiche plus que la structure choisie', nIso + ' visible(s)');
  await ui.toutReafficher(page);
  await ui.action(page, 'fermer');

  // ---- systèmes
  await ui.basculer(page, 'cardio');
  await attendre(2500);
  r.ok(((await lire(page)).visibles.cardio || 0) > 50, 'afficher « Cœur et vaisseaux » charge et montre les vaisseaux');
  await ui.basculer(page, 'cardio');

  // ---- dessin sur le corps
  await ui.accueil(page);
  await ui.dessin(page, true);
  await geste(page, [[[cx - 40, cy - 60], [cx + 40, cy + 20]]], { pas: 10 });
  const traits = await page.evaluate(() => window.__anatomie.scene.children.filter(o => o.isPoints && o.geometry.drawRange.count > 3).length);
  r.ok(traits >= 1, 'dessiner au doigt laisse un trait collé au corps');
  await ui.dessin(page, false);

  // ---- vues
  s0 = await lire(page);
  await ui.allerRegion(page, 'Genou', 'Droit');
  s1 = await lire(page);
  r.ok(dist(s1.cam, s1.cible) < 80 && s1.cible[1] < 70, 'la vue « Genou droit » rapproche la caméra du genou');
  await ui.memoriserVue(page);
  const nVues = await page.evaluate(() => JSON.parse(localStorage.getItem('anatomie3d.vues') || '[]').length);
  r.ok(nVues >= 1, 'mémoriser une vue l’enregistre sur l’appareil');

  // ---- quiz
  await ui.accueil(page);
  await ui.quiz(page);
  const q = await ui.questionQuiz(page);
  r.ok(/Touchez|orange/.test(q), 'le quiz pose une question', q);
  await ui.finQuiz(page);

  // ---- performance au démarrage (vue d'ensemble)
  await ui.accueil(page);
  const info = (await lire(page)).info;
  r.ok(info.appels <= 1000, info.appels + ' appels de dessin par image (budget 1000)');
  r.ok(info.triangles <= 650000, Math.round(info.triangles / 1000) + ' k triangles dessinés par image (budget 650 k)');

  r.ok(!erreurs.length, 'aucune erreur dans la console pendant tout le parcours', erreurs.slice(0, 5).join(' | '));
  await page.close();
  return r;
}
