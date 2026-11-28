// Cohérence des données et du cache hors connexion.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { DOCS, Rapport } from './commun.mjs';

const r = new Rapport('Données, versions et hors connexion');
const D = path.join(DOCS, 'donnees');

// Jeux de données : le corps entier à la racine, et chaque région éventuelle dans son sous-dossier
const jeux = [{ nom: 'corps entier', dir: D }];
for (const f of fs.existsSync(D) ? fs.readdirSync(D) : []) {
  const sd = path.join(D, f);
  if (fs.statSync(sd).isDirectory() && fs.existsSync(path.join(sd, 'manifeste.json'))) jeux.push({ nom: 'région ' + f, dir: sd });
}

const DEMARRAGE = ['os', 'muscles', 'articulations', 'nerfs', 'peau'];
for (const jeu of jeux) {
  const M = JSON.parse(fs.readFileSync(path.join(jeu.dir, 'manifeste.json'), 'utf8'));
  const tailles = {};
  let bornes = [], indices = [], ids = new Set(), doublons = 0, sansNom = [], anglais = [];
  for (const p of M.pieces) {
    if (ids.has(p.id)) doublons++; ids.add(p.id);
    const f = path.join(jeu.dir, p.paquet + '.bin');
    if (!(p.paquet in tailles)) tailles[p.paquet] = fs.existsSync(f) ? fs.readFileSync(f) : null;
    const b = tailles[p.paquet];
    if (!b) { bornes.push(p.paquet + '.bin absent'); continue; }
    const fin = p.o + p.ob[0] + p.ob[1] + p.ob[2] + p.ic * (p.u32 ? 4 : 2);
    if (fin > b.length) { bornes.push(p.en); continue; }
    const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    const io = p.o + p.ob[0] + p.ob[1] + p.ob[2];
    const idx = p.u32 ? new Uint32Array(ab, io, p.ic) : new Uint16Array(ab, io, p.ic);
    for (let i = 0; i < idx.length; i++) if (idx[i] >= p.vc) { indices.push(p.en); break; }
    if (p.couche !== 'insertions') {
      if (!p.fr || !p.fr.trim()) sansNom.push(p.en);
      else if (/_/.test(p.fr) || /\b(of|the|and|bone|nerve|head|part|branch)\b/i.test(p.fr)) anglais.push(p.fr);
    }
  }
  r.ok(!doublons, jeu.nom + ' : identifiants de pièces uniques', doublons + ' doublons');
  r.ok(!bornes.length, jeu.nom + ' : chaque pièce tient dans son fichier', bornes.slice(0, 5).join(', '));
  r.ok(!indices.length, jeu.nom + ' : indices de triangles valides', indices.slice(0, 5).join(', '));
  r.ok(!sansNom.length, jeu.nom + ' : chaque structure a un nom français', sansNom.slice(0, 5).join(', '));
  r.ok(!anglais.length, jeu.nom + ' : pas de nom resté en anglais', anglais.slice(0, 8).join(' | '));

  // ombres de contact et fibres : une valeur par sommet, dans l'ordre du manifeste
  const nO = M.pieces.filter(p => p.couche === 'os').reduce((s, p) => s + p.vc, 0);
  const nM = M.pieces.filter(p => p.couche === 'muscles').reduce((s, p) => s + p.vc, 0);
  const taille = f => (fs.existsSync(path.join(jeu.dir, f)) ? fs.statSync(path.join(jeu.dir, f)).size : -1);
  r.ok(taille('ao-os.bin') === nO, jeu.nom + ' : ombres des os à jour (' + nO + ' sommets)', 'taille ' + taille('ao-os.bin') + ' — relancer outils/ao.mjs');
  r.ok(taille('ao-muscles.bin') === nM, jeu.nom + ' : ombres des muscles à jour', 'taille ' + taille('ao-muscles.bin') + ' — relancer outils/ao.mjs');
  r.ok(taille('fibres-s.bin') === nM * 4, jeu.nom + ' : fibres musculaires à jour', 'taille ' + taille('fibres-s.bin') + ' — relancer outils/ao.mjs');

  // budget iPad mini 2 (A7, 1 Go)
  const tri = M.pieces.filter(p => DEMARRAGE.indexOf(p.paquet) >= 0 || p.paquet === 'muscles').reduce((s, p) => s + p.ic / 3, 0);
  r.ok(tri <= 620000, jeu.nom + ' : ' + Math.round(tri / 1000) + ' k triangles chargés au démarrage (budget 620 k)');
  const octets = DEMARRAGE.reduce((s, n) => s + Math.max(0, taille(n + '.bin')), 0) + taille('manifeste.json');
  r.ok(octets <= 9e6, jeu.nom + ' : ' + (octets / 1e6).toFixed(1) + ' Mo téléchargés au démarrage (budget 9 Mo)');
}

// fiches des muscles
const F = JSON.parse(fs.readFileSync(path.join(D, 'fiches.json'), 'utf8'));
const M0 = JSON.parse(fs.readFileSync(path.join(D, 'manifeste.json'), 'utf8'));
const sansFiche = [...new Set(M0.pieces.filter(p => p.couche === 'muscles' && !(F[p.en] && F[p.en].muscle)).map(p => p.en))];
r.ok(!sansFiche.length, 'chaque muscle a sa fiche (origine, terminaison, innervation, action)', sansFiche.slice(0, 5).join(', '));
for (const jeu of jeux.slice(1)) {
  const FR = fs.existsSync(path.join(jeu.dir, 'fiches.json')) ? JSON.parse(fs.readFileSync(path.join(jeu.dir, 'fiches.json'), 'utf8')) : {};
  const MR = JSON.parse(fs.readFileSync(path.join(jeu.dir, 'manifeste.json'), 'utf8'));
  const sf = [...new Set(MR.pieces.filter(p => p.couche === 'muscles' && !(FR[p.en] && FR[p.en].muscle)).map(p => p.en))];
  r.ok(!sf.length, jeu.nom + ' : chaque muscle a sa fiche', sf.slice(0, 5).join(', '));
}

// versions cohérentes entre app.js, index.html et sw.js
const app = fs.readFileSync(path.join(DOCS, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(DOCS, 'sw.js'), 'utf8');
const V = (app.match(/var VERSION = '([\d.]+)'/) || [])[1];
r.ok(!!V, 'numéro de version trouvé dans app.js (' + V + ')');
r.ok(sw.indexOf("'anatomie3d-" + V + "'") >= 0, 'sw.js : nom du cache = version ' + V, 'le cache doit changer à chaque version, sinon l’iPad garde l’ancienne');
const vHtml = [...html.matchAll(/(style\.css|app\.js)\?v=(\d+)/g)].map(m => m[1] + '?v=' + m[2]);
for (const ref of vHtml) r.ok(sw.indexOf("'" + ref + "'") >= 0, 'sw.js met en cache ' + ref + ' (même numéro que index.html)');
const dansSw = [...sw.matchAll(/'donnees\/([^'?]+)\?v=([\d.]+)'/g)];
const binsSw = (sw.match(/\[([^\]]*'os'[^\]]*)\]/) || [, ''])[1].match(/'([^']+)'/g) || [];
for (const b of binsSw.map(x => x.replace(/'/g, ''))) r.ok(fs.existsSync(path.join(D, b + '.bin')), 'sw.js : donnees/' + b + '.bin existe');
for (const m of dansSw) r.ok(m[2] === V && fs.existsSync(path.join(D, m[1])), 'sw.js : donnees/' + m[1] + ' existe, version ' + V);
const tousBins = fs.readdirSync(D).filter(f => f.endsWith('.bin')).map(f => f.replace('.bin', ''));
const oublies = tousBins.filter(b => binsSw.map(x => x.replace(/'/g, '')).indexOf(b) < 0);
r.ok(!oublies.length, 'tous les fichiers de données sont mis en cache pour le hors connexion', 'oubliés : ' + oublies.join(', '));

// Liste réelle du service worker (exécuté hors navigateur) : chaque jeu de données, régions comprises, est complet
const bac = { self: { addEventListener() {} }, caches: {}, location: {} };
vm.runInNewContext(sw, bac);
const liste = Array.isArray(bac.FICHIERS) ? bac.FICHIERS : [];
r.ok(liste.length > 0, 'sw.js : liste des fichiers lisible (' + liste.length + ' fichiers)');
const donneesSw = liste.filter(f => /^donnees\//.test(f));
const absents = donneesSw.filter(f => !fs.existsSync(path.join(DOCS, f.split('?')[0])));
r.ok(!absents.length, 'sw.js : chaque fichier de données mis en cache existe', absents.slice(0, 5).join(', '));
const malVersionnes = donneesSw.filter(f => f.split('?v=')[1] !== V);
r.ok(!malVersionnes.length, 'sw.js : chaque fichier de données porte la version ' + V, malVersionnes.slice(0, 5).join(', '));
for (const jeu of jeux) {
  const rel = path.relative(DOCS, jeu.dir).split(path.sep).join('/');
  const manquants = fs.readdirSync(jeu.dir).filter(f => /\.(bin|json)$/.test(f)).filter(f => donneesSw.indexOf(rel + '/' + f + '?v=' + V) < 0);
  r.ok(!manquants.length, jeu.nom + ' : tous ses fichiers sont mis en cache pour le hors connexion', 'oubliés : ' + manquants.join(', '));
}

export default r;
