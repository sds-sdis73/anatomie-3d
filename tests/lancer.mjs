// Lance toute la batterie de tests. Code de sortie 1 si un seul contrôle échoue.
//   node lancer.mjs                     tout (compatibilité, données, parcours, images)
//   node lancer.mjs --rapide            sans navigateur (compatibilité + données), quelques secondes
//   node lancer.mjs --maj-references    régénère les images de référence
//   node lancer.mjs --en-ligne <url>    parcours complet sur la version publiée
import { demarrerServeur, lancerNavigateur } from './commun.mjs';

const args = process.argv.slice(2);
const rapide = args.includes('--rapide');
const seulDefauts = args.includes('--defauts'); // seulement les défauts corrigés après la relecture 1.3 (cycle court)
const majReferences = args.includes('--maj-references');
const iLigne = args.indexOf('--en-ligne');
const enLigne = iLigne >= 0 ? (args[iLigne + 1] || 'https://sds-sdis73.github.io/anatomie-3d/') : null;

const rapports = [];
const t0 = Date.now();
if (!enLigne) {
  rapports.push((await import('./t-compat.mjs')).default);
  rapports.push((await import('./t-donnees.mjs')).default);
}
if (!rapide) {
  const srv = enLigne ? { url: enLigne + (enLigne.indexOf('?') < 0 ? '?test=' + Date.now() : ''), fermer() {} } : await demarrerServeur();
  const nav = await lancerNavigateur();
  try {
    if (!seulDefauts) rapports.push(await (await import('./t-parcours.mjs')).default(nav, srv.url));
    if (!enLigne) rapports.push(await (await import('./t-defauts.mjs')).default(nav, srv.url));
    if (!enLigne && !seulDefauts) rapports.push(await (await import('./t-visuel.mjs')).default(nav, srv.url, { majReferences }));
  } catch (e) {
    const { Rapport } = await import('./commun.mjs');
    const r = new Rapport('Erreur imprévue'); r.ok(false, 'le test s’est interrompu', e.stack.split('\n').slice(0, 3).join(' / ')); rapports.push(r);
  } finally { await nav.close(); srv.fermer(); }
}

rapports.forEach(r => r.afficher());
const total = rapports.reduce((s, r) => s + r.lignes.length, 0), echecs = rapports.reduce((s, r) => s + r.echecs.length, 0);
console.log('\n' + (echecs ? '✗ ' + echecs + ' contrôle(s) en échec' : '✓ tout est vert') + ' — ' + total + ' contrôles en ' + Math.round((Date.now() - t0) / 1000) + ' s');
process.exit(echecs ? 1 : 0);
