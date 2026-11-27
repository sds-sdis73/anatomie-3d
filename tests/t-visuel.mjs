// Comparaison d'images : quelques vues fixes comparées à des captures de référence validées.
// Les références sont dans tests/references/ ; « npm run references » les régénère (à faire valider).
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { ouvrirAppli, attendre, Rapport, RACINE } from './commun.mjs';

const REF = path.join(RACINE, 'tests', 'references');
const SORTIE = path.join(RACINE, 'tests', 'resultats');
const VUES = {
  'corps-face': { cible: [0, 76, 0], dir: [0, 0.05, 1], dist: 352 },
  'torse': { cible: [0, 118, 2], dir: [0, 0.05, 1], dist: 135 },
  'epaule-droite': { cible: [-17, 134, 0], dir: [-0.55, 0.15, 0.85], dist: 58 },
  'dos': { cible: [0, 110, -4], dir: [0.15, 0.1, -1], dist: 120 },
};
const SEUIL = 0.015; // part de pixels différents tolérée

export default async function (nav, url, { majReferences = false } = {}) {
  const r = new Rapport('Comparaison visuelle avec les références');
  fs.mkdirSync(SORTIE, { recursive: true });
  const { page } = await ouvrirAppli(nav, url, { tactile: false });
  for (const [nom, v] of Object.entries(VUES)) {
    await page.evaluate(v => {
      const a = window.__anatomie, d = new THREE.Vector3().fromArray(v.dir).normalize();
      a.controls.target.fromArray(v.cible); a.camera.position.fromArray(v.cible).addScaledVector(d, v.dist); a.controls.update();
      a.renderer.render(a.scene, a.camera);
    }, v);
    await attendre(500);
    const tampon = Buffer.from(await page.screenshot({ type: 'png' }));
    const ref = path.join(REF, nom + '.png');
    if (majReferences || !fs.existsSync(ref)) { fs.writeFileSync(ref, tampon); r.ok(true, nom + ' : référence enregistrée (à valider à l’œil)'); continue; }
    const a = PNG.sync.read(fs.readFileSync(ref)), b = PNG.sync.read(tampon);
    if (a.width !== b.width || a.height !== b.height) { r.ok(false, nom + ' : même taille que la référence'); continue; }
    const diff = new PNG({ width: a.width, height: a.height });
    const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.15 });
    const part = n / (a.width * a.height);
    if (part > SEUIL) { fs.writeFileSync(path.join(SORTIE, nom + '-actuel.png'), tampon); fs.writeFileSync(path.join(SORTIE, nom + '-diff.png'), PNG.sync.write(diff)); }
    r.ok(part <= SEUIL, nom + ' : ' + (part * 100).toFixed(2) + ' % de pixels différents (seuil ' + SEUIL * 100 + ' %)', 'voir tests/resultats/' + nom + '-diff.png');
  }
  await page.close();
  return r;
}
