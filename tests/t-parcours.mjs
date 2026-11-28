// Parcours complets dans un Chrome au format iPad (tactile), contexte WebGL 1 comme sur l'iPad mini 2.
import fs from 'fs';
import path from 'path';
import { ouvrirAppli, geste, toucher, appuiLong, doubleToucher, attendre, Rapport, DOCS } from './commun.mjs';
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

  // =================== Nouveautés 1.3 ===================
  // ---- étiquette accrochée
  await ui.accueil(page);
  const vEt = await page.evaluate((x, y) => window.__anatomie.viser(x, y), cx, cy);
  await toucher(page, cx, cy);
  const et = await page.evaluate(() => window.__anatomie.etiquette());
  r.ok(vEt && et.visible && et.nom === vEt.fr, 'l’étiquette accrochée affiche le nom de la structure touchée', JSON.stringify(et));
  r.ok(et.fil, 'l’étiquette est reliée par un trait au point touché');
  await ui.action(page, 'fermer');
  r.ok(!(await page.evaluate(() => window.__anatomie.etiquette().visible)), 'la croix ferme l’étiquette');

  // ---- double toucher : centrer et rapprocher
  s0 = await lire(page);
  const vDbl = await page.evaluate((x, y) => window.__anatomie.viser(x, y), cx, cy);
  await doubleToucher(page, cx, cy);
  s1 = await lire(page);
  r.ok(vDbl && dist(s1.cible, vDbl.point) < 1 && dist(s1.cam, s1.cible) < 0.7 * dist(s0.cam, s0.cible),
    'toucher deux fois centre la vue sur la structure et la rapproche',
    'cible à ' + (vDbl ? dist(s1.cible, vDbl.point).toFixed(1) : '?') + ' cm du point, distance ' + Math.round(dist(s0.cam, s0.cible)) + ' → ' + Math.round(dist(s1.cam, s1.cible)));

  // ---- appui long sur une structure : petit menu
  await ui.accueil(page);
  const vAl = await page.evaluate((x, y) => window.__anatomie.viser(x, y), cx, cy);
  const camAl = (await lire(page)).cam;
  const nAl = await page.evaluate(() => window.__anatomie.visibles());
  await appuiLong(page, cx, cy);
  r.ok(await ui.menuOuvert(page), 'un appui long sur une structure ouvre le petit menu');
  r.ok(dist((await lire(page)).cam, camAl) < 0.01, 'l’appui long ne fait pas bouger le corps');
  await ui.actionMenu(page, 'masquer');
  const nAl2 = await page.evaluate(() => window.__anatomie.visibles());
  const masqueAl = await page.evaluate(id => !!window.__anatomie.etat.masques[id], vAl && vAl.id);
  r.ok(nAl2 === nAl - 1 && masqueAl, 'le menu « Masquer » retire la structure appuyée (' + (vAl && vAl.fr) + ')', nAl + ' → ' + nAl2);
  await appuiLong(page, cx, cy);
  await ui.actionMenu(page, 'isoler');
  r.ok(await page.evaluate(() => window.__anatomie.visibles()) === 1, 'le menu « Isoler » n’affiche plus que la structure appuyée');
  await ui.toutReafficher(page);
  r.ok(await page.evaluate(() => !window.__anatomie.etat.isole && !Object.keys(window.__anatomie.etat.masques).length), '« Tout voir » réaffiche tout');

  // ---- règle des couches : un seul geste de glisser
  await ui.accueil(page);
  const depart = (await lire(page)).visibles;
  const [xr, y2] = await ui.rangRegle(page, 2), [, y6] = await ui.rangRegle(page, 6), [, y0] = await ui.rangRegle(page, 0), [, y3] = await ui.rangRegle(page, 3);
  await geste(page, [[[xr, y2], [xr, y6]]], { pas: 14, delai: 25 });
  const bas = (await lire(page)).visibles;
  r.ok(!bas.muscles && bas.os > 100, 'glisser le doigt vers le bas de la règle enlève les couches jusqu’à l’os', JSON.stringify(bas));
  await geste(page, [[[xr, y6], [xr, y0]]], { pas: 14, delai: 25 });
  const hautR = (await lire(page)).visibles;
  r.ok(hautR.peau === 1 && !hautR.muscles, 'glisser vers le haut les remet jusqu’à la peau', JSON.stringify(hautR));
  await geste(page, [[[xr, y0], [xr, y3]]], { pas: 10, delai: 25 });
  const milieu = (await lire(page)).visibles;
  r.ok(await page.evaluate(() => window.__anatomie.etat.regle) === 3 && milieu.muscles > 0 && milieu.muscles < depart.muscles,
    'arrêter le doigt sur « Muscles moyens » garde les plans moyen et profond', JSON.stringify(milieu));

  // ---- œil d'une couche
  await ui.accueil(page);
  await ui.oeil(page, 'ligaments');
  const lig = (await lire(page)).visibles.ligaments || 0;
  await ui.oeil(page, 'ligaments');
  const lig2 = (await lire(page)).visibles.ligaments || 0;
  r.ok(lig > 50 && !lig2, 'l’œil des ligaments les montre puis les cache', lig + ' puis ' + lig2);
  await ui.oeil(page, 'ms');
  const sansSup = (await lire(page)).visibles;
  r.ok(sansSup.muscles > 0 && sansSup.muscles < depart.muscles, 'l’œil des muscles superficiels les cache seuls', JSON.stringify(sansSup));
  await ui.oeil(page, 'ms');

  // ---- appui long sur une couche : n'afficher qu'elle, puis tout rétablir
  await ui.accueil(page);
  const [xo, yo] = await ui.rangRegle(page, 6);
  await appuiLong(page, xo, yo);
  const seule = (await lire(page)).visibles;
  r.ok(seule.os > 100 && Object.keys(seule).length === 1, 'appui long sur « Os » : seuls les os restent', JSON.stringify(seule));
  await appuiLong(page, xo, yo);
  const retab = (await lire(page)).visibles;
  r.ok(retab.muscles === depart.muscles && retab.os === depart.os, 'un second appui long rétablit toutes les couches', JSON.stringify(retab));

  // ---- côté épluché
  await ui.niveau(page, 0);
  await ui.cote(page, 'D');
  const coteD = await page.evaluate(() => { let d = 0, g = 0; window.__anatomie.scene.traverse(o => { if (o.isMesh && o.visible && o.userData.p && o.userData.p.couche === 'muscles') { if (o.userData.p.cote === 'D') d++; if (o.userData.p.cote === 'G') g++; } }); return [d, g]; });
  r.ok(coteD[0] === 0 && coteD[1] > 50, '« Droit » : seul le côté droit est épluché, le gauche garde ses muscles', 'muscles droits ' + coteD[0] + ', gauches ' + coteD[1]);
  await ui.cote(page, '');

  // ---- coupe
  await ui.accueil(page);
  const pt = await page.evaluate(() => { // un point de l'écran qui touche le côté gauche du patient (+X)
    const a = window.__anatomie;
    for (let y = 250; y < 600; y += 20) for (let x = 540; x < 760; x += 8) { const h = a.viser(x, y); if (h && h.point[0] > 6) return [x, y, h.fr]; }
    return null;
  });
  const nCoupe0 = await page.evaluate(() => window.__anatomie.visibles());
  const pix0 = pt ? await page.evaluate((x, y) => window.__anatomie.pixel(x, y), pt[0], pt[1]) : 0;
  await ui.coupe(page, 'sagittal');
  const apresCoupe = await page.evaluate(p => { const a = window.__anatomie, h = p ? a.viser(p[0], p[1]) : null; return { h, pix: p ? a.pixel(p[0], p[1]) : -1, n: a.visibles(), plan: a.etat.coupe && a.etat.coupe.plan }; }, pt);
  r.ok(!!pt && pix0 > 0, 'avant la coupe, le côté gauche du patient est dessiné (' + (pt && pt[2]) + ')');
  r.ok(apresCoupe.plan === 'sagittal' && apresCoupe.pix === 0, 'coupe sagittale : rien n’est dessiné au-delà du plan', 'opacité du pixel : ' + apresCoupe.pix);
  r.ok(!apresCoupe.h || apresCoupe.h.point[0] <= 0.1, 'coupe sagittale : la partie coupée ne se touche plus', JSON.stringify(apresCoupe.h));
  r.ok(apresCoupe.n < nCoupe0, 'les structures entièrement coupées ne sont plus dessinées', nCoupe0 + ' → ' + apresCoupe.n);
  const [gC, dC, yC] = await ui.pisteCoupe(page);
  const fAvant = await page.evaluate(() => window.__anatomie.etat.coupe.f);
  await geste(page, [[[gC + (dC - gC) * fAvant, yC], [gC + (dC - gC) * 0.95, yC]]], { pas: 8 });
  const fApres = await page.evaluate(() => window.__anatomie.etat.coupe.f);
  r.ok(fApres > 0.9 && (await page.evaluate(() => window.__anatomie.visibles())) > apresCoupe.n, 'le curseur déplace le plan de coupe', fAvant.toFixed(2) + ' → ' + fApres.toFixed(2));
  await ui.coupe(page, 'transversal');
  r.ok(await page.evaluate(() => window.__anatomie.etat.coupe.plan) === 'transversal', 'le plan transversal se choisit');
  await ui.coupe(page, null);
  r.ok(await page.evaluate(() => !window.__anatomie.etat.coupe) && (await page.evaluate(() => window.__anatomie.visibles())) === nCoupe0, '« Sans coupe » rend tout le corps');

  // ---- sélection multiple et transparence
  await ui.accueil(page);
  const deux = await page.evaluate(() => { const a = window.__anatomie, l = []; for (let x = 430; x < 640 && l.length < 2; x += 12) { const h = a.viser(x, 330); if (h && !l.some(q => q[2] === h.id)) l.push([x, 330, h.id]); } return l; });
  await ui.multi(page);
  for (const q of deux) await toucher(page, q[0], q[1]);
  const nomMulti = await ui.nomSelection(page);
  r.ok(deux.length === 2 && /^2 structures/.test(nomMulti || ''), '« Plusieurs » : deux structures touchées sont sélectionnées ensemble', nomMulti);
  await ui.action(page, 'transparent');
  const nbTransp = await page.evaluate(() => Object.keys(window.__anatomie.etat.transp).length);
  r.ok(nbTransp === 2, '« Transparent » rend transparentes les structures sélectionnées', nbTransp + ' transparente(s)');
  await ui.multi(page);
  await ui.toutReafficher(page);
  r.ok(await page.evaluate(() => !Object.keys(window.__anatomie.etat.transp).length), '« Tout voir » rend les structures opaques');

  // ---- réglages : nom secondaire, endoscope, fibres
  await ui.ouvrirPanneau(page, 'reglages');
  await page.evaluate(() => document.querySelector('#choix-langue [data-l="la"]').click());
  await ui.fermerPanneaux(page);
  await ui.chercher(page, 'femur'); await ui.premierResultat(page);
  const latin = await page.evaluate(() => document.getElementById('etiq-nom2').textContent);
  r.ok(/femor|femur/i.test(latin), 'le nom secondaire latin s’affiche sous le nom', latin);
  await ui.ouvrirPanneau(page, 'reglages');
  await page.evaluate(() => document.querySelector('#choix-langue [data-l=""]').click());
  await ui.fermerPanneaux(page);
  await ui.basculer(page, 'endoscope');
  const endo = await page.evaluate(() => window.__anatomie.etat.endoscope);
  await ui.basculer(page, 'endoscope');
  r.ok(endo && !(await page.evaluate(() => window.__anatomie.etat.endoscope)), 'la lumière d’endoscope s’allume et s’éteint depuis les réglages');
  await ui.basculer(page, 'fibres');
  const fib = await page.evaluate(() => localStorage.getItem('anatomie3d.fibres'));
  await ui.basculer(page, 'fibres');
  r.ok(fib === '0' && (await page.evaluate(() => localStorage.getItem('anatomie3d.fibres'))) === '1', 'les fibres musculaires se désactivent puis se réactivent depuis les réglages');

  // ---- quiz depuis l'accueil
  await page.evaluate(() => document.getElementById('b-accueil').click()); await attendre(300);
  await page.evaluate(() => document.querySelector('#puces-sys [data-action="quiz"]').click());
  await page.waitForFunction(() => !!window.__anatomie.etat.quiz, { timeout: 5000 }).catch(() => {});
  r.ok(await page.evaluate(() => !!window.__anatomie.etat.quiz && !window.__anatomie.surAccueil()), 'le quiz se lance depuis l’écran d’accueil', await ui.questionQuiz(page));
  await ui.finQuiz(page);

  // ---- performance au démarrage (vue d'ensemble)
  await ui.accueil(page);
  const info = (await lire(page)).info;
  r.ok(info.appels <= 1000, info.appels + ' appels de dessin par image (budget 1000)');
  r.ok(info.triangles <= 650000, Math.round(info.triangles / 1000) + ' k triangles dessinés par image (budget 650 k)');

  r.ok(!erreurs.length, 'aucune erreur dans la console pendant tout le parcours', erreurs.slice(0, 5).join(' | '));
  await page.close();

  // ---- écran d'accueil et régions (page séparée : le dossier « tronc » est volontairement rendu absent)
  let refusTronc = 0;
  const { page: pa, erreurs: errA } = await ouvrirAppli(nav, url, { accueil: true, avantChargement: async pg => {
    await pg.setBypassServiceWorker(true); await pg.setRequestInterception(true);
    pg.on('request', q => { if (/donnees\/tronc\//.test(q.url())) { refusTronc++; q.respond({ status: 404, body: 'absent' }); } else q.continue(); });
  } });
  r.ok(await ui.surAccueil(pa), 'l’application s’ouvre sur l’écran d’accueil');
  const vign = await pa.evaluate(() => [...document.querySelectorAll('#accueil .vignette')].map(b => b.textContent));
  r.ok(vign.length === 6 && /Corps entier/.test(vign[0]) && /Squelette/.test(vign[5]), 'l’accueil propose six vignettes (corps entier, quatre régions, squelette)', vign.join(' | '));
  await ui.region(pa, 'tronc');
  const tr = await pa.evaluate(() => { const a = window.__anatomie, t = a.controls.target; return { jeu: a.jeu(), titre: document.getElementById('titre-region').textContent, y: t.y, d: a.camera.position.distanceTo(t) }; });
  r.ok(tr.jeu.dossier === '' && tr.jeu.region === 'tronc', 'sans dossier « donnees/tronc/ », le tronc retombe sur le corps entier', JSON.stringify(tr.jeu));
  r.ok(tr.titre === 'Tronc' && tr.y > 95 && tr.y < 135 && tr.d < 220, 'la caméra est cadrée sur le tronc', JSON.stringify(tr));
  // Chrome répète chaque 404 dans la console sans l'adresse : autant de ces lignes que de 404 voulus sur « tronc », et rien d'autre
  const http404Tronc = refusTronc + errA.filter(e => /^HTTP 404 : .*donnees\/tronc\//.test(e)).length;
  const console404 = errA.filter(e => /^console : Failed to load resource: .*404/.test(e)).length;
  const autres = errA.filter(e => !/^HTTP 404 : .*donnees\/tronc\//.test(e) && !/^console : Failed to load resource: .*404/.test(e));
  r.ok(http404Tronc >= 1 && console404 <= http404Tronc && !autres.length, 'seule l’absence du dossier de région est signalée', autres.slice(0, 3).join(' | ') || (http404Tronc + ' / ' + console404));
  await ui.region(pa, 'squelette');
  const sq = (await lire(pa)).visibles;
  r.ok(!sq.muscles && sq.os > 100 && sq.ligaments > 50, '« Squelette » : os et ligaments, sans muscles', JSON.stringify(sq));
  await ui.region(pa, 'membre-inferieur');
  const mi = await pa.evaluate(() => ({ jeu: window.__anatomie.jeu(), y: window.__anatomie.controls.target.y }));
  const dossierMI = fs.existsSync(path.join(DOCS, 'donnees', 'membre-inferieur', 'manifeste.json'));
  r.ok(dossierMI ? mi.jeu.dossier === 'membre-inferieur/' : mi.jeu.dossier === '',
    'membre inférieur : ' + (dossierMI ? 'le jeu détaillé de la région est chargé' : 'repli sur le corps entier (pas encore de jeu détaillé)'), JSON.stringify(mi.jeu));
  r.ok(mi.y < 70, 'la caméra est cadrée sur les membres inférieurs', 'cible à y = ' + mi.y.toFixed(0));
  await ui.region(pa, 'corps');
  r.ok(!(await ui.surAccueil(pa)) && (await lire(pa)).visibles.muscles > 100, 'revenir à l’accueil puis choisir « Corps entier » réaffiche le corps');
  await pa.close();

  // ---- chaque région détaillée réellement chargée (quand son dossier existe)
  const { page: pr, erreurs: errR } = await ouvrirAppli(nav, url, { accueil: true });
  for (const reg of ['tete-cou', 'tronc', 'membre-superieur', 'membre-inferieur']) {
    if (!fs.existsSync(path.join(DOCS, 'donnees', reg, 'manifeste.json'))) continue;
    await ui.region(pr, reg);
    const etatR = await pr.evaluate(() => ({ jeu: window.__anatomie.jeu() }));
    const vis = (await lire(pr)).visibles, info = (await lire(pr)).info;
    r.ok(etatR.jeu.dossier === reg + '/' && etatR.jeu.pieces > 300, reg + ' : jeu détaillé chargé (' + etatR.jeu.pieces + ' pièces)', JSON.stringify(etatR.jeu));
    r.ok(vis.os > 10 && vis.muscles > 10, reg + ' : os et muscles affichés', JSON.stringify(vis));
    r.ok(info.triangles <= 650000 && info.appels <= 1000, reg + ' : ' + Math.round(info.triangles / 1000) + ' k triangles, ' + info.appels + ' appels de dessin (budgets 650 k / 1000)');
    // toucher le centre de l'écran nomme une structure de la région
    const vise = await pr.evaluate(() => { for (let dx = 0; dx <= 160; dx += 40) for (const s of [1, -1]) { const h = window.__anatomie.viser(560 + s * dx, 384); if (h) return { x: 560 + s * dx, h }; } return null; });
    if (vise) { await toucher(pr, vise.x, 384); const nomR = await ui.nomSelection(pr); r.ok(nomR && nomR.indexOf(vise.h.fr) === 0, reg + ' : toucher une structure affiche son nom', (nomR || '') + ' / ' + vise.h.fr); }
    else r.ok(false, reg + ' : une structure est visible au centre de l’écran');
  }
  r.ok(!errR.length, 'régions détaillées : aucune erreur pendant leur chargement', errR.slice(0, 4).join(' | '));
  await pr.close();
  return r;
}
