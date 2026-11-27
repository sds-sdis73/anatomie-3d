// Correspondance entre les actions d'un utilisateur et les éléments de l'interface.
// C'EST LE SEUL FICHIER DE TEST À ADAPTER QUAND LA DISPOSITION CHANGE : les tests appellent ces fonctions.
import { attendre } from './commun.mjs';

const clic = async (page, sel) => { await page.waitForSelector(sel, { visible: true, timeout: 5000 }); await page.click(sel); await attendre(350); };

export const ui = {
  // Couches : 4 = peau, 3 = muscles superficiels, 2 = moyens, 1 = profonds, 0 = squelette
  async niveau(page, n) { await clic(page, `#crans [data-n="${n}"]`); },
  async ouvrirPanneau(page, nom) { // 'vues' | 'couches' | 'recherche' | 'infos'
    await clic(page, `[data-panneau="p-${nom}"]`);
  },
  async fermerPanneaux(page) { await page.evaluate(() => { const o = document.querySelector('.panneau.ouvert'); if (o) document.querySelector(`[data-panneau="${o.id}"]`).click(); }); await attendre(300); },
  async basculer(page, systeme) { // ex. 'cardio', 'nerfs', 'ligaments', 'endoscope'
    await this.ouvrirPanneau(page, 'couches');
    await page.evaluate(id => document.getElementById(id).click(), 't-' + systeme);
    await attendre(300);
    await this.fermerPanneaux(page);
  },
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
  // carte de la structure sélectionnée
  async nomSelection(page) { return page.evaluate(() => { const c = document.getElementById('carte'); return c && !c.classList.contains('cache') ? document.getElementById('carte-nom').textContent : null; }); },
  async action(page, nom) { // 'isoler' | 'masquer' | 'transparent' | 'insertions' | 'fiche' | 'fermer'
    const ids = { isoler: '#b-isoler', masquer: '#b-masquer', transparent: '#b-transp', insertions: '#b-insertions', fiche: '#b-fiche', fermer: '#b-desel' };
    await clic(page, ids[nom]); await attendre(400);
  },
  async texteFiche(page) { return page.evaluate(() => { const f = document.getElementById('fiche'); return f && !f.classList.contains('cache') ? f.textContent : ''; }); },
  async toutReafficher(page) { await clic(page, '#b-etat'); },
  async multi(page) { await clic(page, '#b-multi'); },
  async dessin(page, actif) { const on = await page.evaluate(() => window.__anatomie.etat.dessin); if (on !== actif) await clic(page, '#b-dessin'); },
  async quiz(page) { await clic(page, '#b-quiz'); },
  async questionQuiz(page) { return page.evaluate(() => document.getElementById('quiz-question').textContent); },
  async finQuiz(page) { await clic(page, '#b-quiz-fin'); },
  async memoriserVue(page) { await this.ouvrirPanneau(page, 'vues'); await clic(page, '#b-memoriser'); await this.fermerPanneaux(page); },
  async accueil(page) { await clic(page, '#b-reinit'); await attendre(900); },
};
