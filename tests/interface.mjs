// Correspondance entre les actions d'un utilisateur et les éléments de l'interface.
// C'EST LE SEUL FICHIER DE TEST À ADAPTER QUAND LA DISPOSITION CHANGE : les tests appellent ces fonctions.
import { attendre } from './commun.mjs';

const clic = async (page, sel) => { await page.waitForSelector(sel, { visible: true, timeout: 5000 }); await page.click(sel); await attendre(350); };
// Ancien « niveau » d'épluchage (4 = peau … 0 = squelette) → rang sur la règle des couches (0 = peau … 6 = os)
const RANG = { 4: 0, 3: 2, 2: 3, 1: 4, 0: 5 };
const COUCHES = ['peau', 'fascias', 'ms', 'mm', 'mp', 'ligaments', 'os'];
const REGLAGES = { endoscope: 't-endoscope', fibres: 't-fibres', capsules: 't-capsules', 'peau-transp': 't-peau-transp' };
const attendrePret = page => page.waitForFunction(() => window.__anatomie.pret && !window.__anatomie.surAccueil() && document.getElementById('chargement').classList.contains('cache'), { timeout: 60000 });

export const ui = {
  // ---- accueil
  async surAccueil(page) { return page.evaluate(() => window.__anatomie.surAccueil()); },
  async region(page, cle) { // 'corps' | 'tete-cou' | 'tronc' | 'membre-superieur' | 'membre-inferieur' | 'squelette'
    if (!(await this.surAccueil(page))) await clic(page, '#b-accueil');
    await clic(page, `#accueil .vignette[data-region="${cle}"]`);
    await attendrePret(page); await attendre(300);
  },
  async entrer(page) { if (await this.surAccueil(page)) await this.region(page, 'corps'); },
  async accueil(page) { await this.region(page, 'corps'); await attendre(300); },

  // ---- couches : 4 = peau, 3 = muscles superficiels, 2 = moyens, 1 = profonds, 0 = squelette
  async niveau(page, n) { await clic(page, `#regle .rang[data-i="${RANG[n]}"] .nom`); },
  async rangRegle(page, i) { return page.evaluate(i => { const r = document.querySelector(`#regle .rang[data-i="${i}"] .nom`).getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; }, i); },
  async oeil(page, couche) { await clic(page, `#regle .oeil[data-c="${couche}"]`); },
  couches: COUCHES,
  async ouvrirPanneau(page, nom) { // 'vues' | 'couches' | 'recherche' | 'infos' | 'reglages'
    if (nom === 'couches') return; // la règle des couches est toujours affichée
    const id = nom === 'infos' ? 'reglages' : nom;
    const ouvert = await page.evaluate(id => document.getElementById('p-' + id).classList.contains('ouvert'), id);
    if (!ouvert) await clic(page, `[data-panneau="p-${id}"]`);
  },
  async fermerPanneaux(page) { await page.evaluate(() => { const o = document.querySelector('.panneau.ouvert'); if (o) document.querySelector(`[data-panneau="${o.id}"]`).click(); }); await attendre(300); },
  async basculer(page, systeme) { // ex. 'cardio', 'nerfs', 'ligaments', 'endoscope'
    if (REGLAGES[systeme]) {
      await this.ouvrirPanneau(page, 'reglages');
      await page.evaluate(id => document.getElementById(id).click(), REGLAGES[systeme]);
      await attendre(300); await this.fermerPanneaux(page); return;
    }
    if (COUCHES.indexOf(systeme) >= 0) return this.oeil(page, systeme);
    await clic(page, `#systemes .oeil[data-s="${systeme}"]`);
  },
  async cote(page, c) { await clic(page, `#cote-epluche button[data-cote="${c}"]`); }, // 'D' | '' | 'G'
  async chercher(page, texte) {
    await this.ouvrirPanneau(page, 'recherche');
    await page.click('#champ-recherche', { clickCount: 3 });
    await page.type('#champ-recherche', texte, { delay: 15 });
    await attendre(300);
  },
  async premierResultat(page) { await clic(page, '#resultats button'); await attendre(900); },
  async allerRegion(page, nom, cote) { // cote : 'Droit' | 'Gauche' | undefined
    await this.ouvrirPanneau(page, 'vues');
    await page.evaluate((nom, cote) => {
      const b = [...document.querySelectorAll('#vues-regions button')].find(x => x.textContent === nom);
      if (b) return b.click();
      const d = [...document.querySelectorAll('#vues-regions .region')].find(x => x.querySelector('.nom').textContent === nom);
      [...d.querySelectorAll('.cotes button')].find(x => x.textContent === (cote || 'Droit')).click();
    }, nom, cote);
    await attendre(1000);
  },
  // ---- étiquette accrochée à la structure sélectionnée
  async nomSelection(page) { return page.evaluate(() => { const c = document.getElementById('etiquette'); return c && !c.classList.contains('cache') ? document.getElementById('etiq-nom').textContent : null; }); },
  async action(page, nom) { // 'isoler' | 'masquer' | 'transparent' | 'insertions' | 'fiche' | 'fermer'
    const ids = { isoler: '#b-isoler', masquer: '#b-masquer', transparent: '#o-transp', insertions: '#b-insertions', fiche: '#b-fiche', fermer: '#b-desel' };
    await clic(page, ids[nom]); await attendre(400);
  },
  async menuOuvert(page) { return page.evaluate(() => !document.getElementById('menu-appui').classList.contains('cache')); },
  async actionMenu(page, nom) { await clic(page, `#menu-appui [data-m="${nom}"]`); await attendre(300); }, // masquer | isoler | transparent | fiche
  async texteFiche(page) { return page.evaluate(() => { const f = document.getElementById('fiche'); return f && !f.classList.contains('cache') ? f.textContent : ''; }); },
  async toutReafficher(page) { await clic(page, '#o-toutvoir'); },
  async multi(page) { await clic(page, '#b-multi'); },
  async dessin(page, actif) { const on = await page.evaluate(() => window.__anatomie.etat.dessin); if (on !== actif) await clic(page, actif ? '#b-dessin' : '#b-fin-dessin'); },
  // ---- coupe
  async coupe(page, plan) { // plan : 'sagittal' | 'frontal' | 'transversal' | null (retirer)
    if (plan === null) { if (await page.evaluate(() => !document.getElementById('p-coupe').classList.contains('cache'))) await clic(page, '#b-coupe-off'); else await page.evaluate(() => document.getElementById('b-coupe-off').click()); return; }
    if (await page.evaluate(() => document.getElementById('p-coupe').classList.contains('cache'))) await clic(page, '#b-coupe');
    await clic(page, `.coupe-plans [data-plan="${plan}"]`);
  },
  async pisteCoupe(page) { return page.evaluate(() => { const r = document.querySelector('#curseur-coupe .piste-coupe').getBoundingClientRect(); return [r.left, r.right, r.top + r.height / 2]; }); },
  // ---- quiz (dans les réglages et sur l'accueil)
  async quiz(page) { await this.ouvrirPanneau(page, 'reglages'); await clic(page, '#b-quiz'); },
  async questionQuiz(page) { return page.evaluate(() => document.getElementById('quiz-question').textContent); },
  async finQuiz(page) { await clic(page, '#b-quiz-fin'); },
  async memoriserVue(page) { await this.ouvrirPanneau(page, 'vues'); await clic(page, '#b-memoriser'); await this.fermerPanneaux(page); },
};
