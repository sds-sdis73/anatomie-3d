// Conversion des modèles Z-Anatomy (FBX) en paquets binaires allégés pour l'iPad.
// Usage : node construire.mjs
import fs from 'fs';
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';
import { lireFbx } from './lire-fbx.mjs';
import { couche as coucheMuscle } from './couches.mjs';
import { nomFr, fiche } from './fr.mjs';
import { ta2 } from './ta2.mjs';
import { DESC } from './descriptions-muscles.mjs';

await MeshoptSimplifier.ready;
const SRC = '../sources-za/repo/Resources/Models/FBX/';
const OUT = '../docs/donnees/';
fs.mkdirSync(OUT, { recursive: true });

// Classes de couleur (index d'attribut par sommet, couleurs définies dans l'appli)
const C = { os: 0, cartilage: 1, dent: 2, muscle: 3, tendon: 4, ligament: 5, capsule: 6, nerf: 7, peau: 8, fascia: 9, graisse: 11, origine: 12, terminaison: 13, moelle: 14,
  artere: 15, veine: 16, coeur: 17, respiratoire: 18, digestif: 19, foie: 20, urinaire: 21, genital: 22, endocrinien: 23, lymphatique: 24, encephale: 25, oeil: 26, oreille: 27 };
const NOUVEAUX = new Set(['cardio', 'respiratoire', 'digestif', 'urinaire', 'genital', 'endocrinien', 'lymphatique', 'encephale', 'sens']);

function classeMateriau(nom, systeme, chemin) {
  if (NOUVEAUX.has(systeme)) return classeSysteme(nom, systeme, chemin || '');
  if (/Bursa/.test(nom)) return -1;
  if (/^Origin/.test(nom)) return C.origine;
  if (/^End/.test(nom)) return C.terminaison;
  if (/Teeth/.test(nom)) return C.dent;
  if (/Cartilage/.test(nom)) return C.cartilage;
  if (/Bone|Suture/.test(nom)) return C.os;
  if (/Articular capsule/.test(nom)) return C.capsule;
  if (/Ligament/.test(nom)) return C.ligament;
  if (/Fascia/.test(nom)) return C.fascia;
  if (/Fat/.test(nom)) return C.graisse;
  if (/Nerve|Nucleus|White matter|Grey/.test(nom)) return C.nerf;
  if (/Skin/.test(nom)) return C.peau;
  if (/^Tendon(\.\d+)?$/.test(nom)) return C.tendon;
  if (systeme === 'muscles') return C.muscle;
  if (systeme === 'os') return C.os;
  if (systeme === 'nerfs') return C.nerf;
  if (systeme === 'peau') return C.peau;
  return C.ligament;
}

const nbMiroirs = {};
function classeSysteme(nom, systeme, chemin) {
  if (systeme === 'cardio') {
    if (/Heart|Cardiac|Arteries_of_heart/.test(chemin) && !/Vein/.test(nom)) return C.coeur;
    if (/Vein/.test(nom) || /Venous/.test(chemin)) return C.veine;
    return C.artere;
  }
  if (systeme === 'digestif' && /Liver|Gallbladder|bile/i.test(chemin + nom)) return C.foie;
  if (systeme === 'sens') return /Ear/.test(chemin) ? C.oreille : C.oeil;
  return C[systeme] !== undefined ? C[systeme] : C.ligament;
}
// Extraction : positions monde soudées + classe par sommet
function extraire(o, systeme, chemin) {
  o.updateWorldMatrix(true, false);
  const g = o.geometry;
  const pos = g.attributes.position;
  const mats = [].concat(o.material);
  const triCount = g.index ? g.index.count / 3 : pos.count / 3;
  const triClasse = new Int8Array(triCount).fill(classeMateriau(mats[0].name, systeme, chemin));
  for (const gr of g.groups) {
    const cl = classeMateriau((mats[gr.materialIndex] || mats[0]).name, systeme, chemin);
    for (let t = gr.start / 3; t < (gr.start + gr.count) / 3; t++) triClasse[t] = cl;
  }
  const v = new THREE.Vector3();
  const miroir = o.matrixWorld.determinant() < 0; // copie en miroir : on rétablit l'ordre des sommets
  if (miroir) nbMiroirs[systeme] = (nbMiroirs[systeme] || 0) + 1;
  const map = new Map(); const P = []; const K = []; const I = [];
  for (let t = 0; t < triCount; t++) {
    if (triClasse[t] < 0) continue;
    const tri = [];
    for (let k = 0; k < 3; k++) {
      const vi = g.index ? g.index.getX(t * 3 + k) : t * 3 + k;
      v.fromBufferAttribute(pos, vi).applyMatrix4(o.matrixWorld);
      const key = Math.round(v.x * 1000) + ',' + Math.round(v.y * 1000) + ',' + Math.round(v.z * 1000);
      let id = map.get(key);
      if (id === undefined) { id = P.length / 3; map.set(key, id); P.push(v.x, v.y, v.z); K.push(triClasse[t]); }
      tri.push(id);
    }
    if (miroir) tri.reverse();
    if (tri[0] !== tri[1] && tri[1] !== tri[2] && tri[0] !== tri[2]) I.push(...tri);
  }
  return { P: new Float32Array(P), K: Uint8Array.from(K), I: new Uint32Array(I) };
}

function alleger(m, ratio, minTri) {
  const tri = m.I.length / 3;
  const cible = Math.max(minTri, Math.round(tri * ratio));
  if (tri <= cible) return m;
  let [idx] = MeshoptSimplifier.simplify(m.I, m.P, 3, cible * 3, 0.02, ['LockBorder']);
  if (idx.length / 3 > cible * 1.6) [idx] = MeshoptSimplifier.simplify(m.I, m.P, 3, cible * 3, 0.05, []);
  if (idx.length / 3 > cible * 2.5) [idx] = MeshoptSimplifier.simplify(m.I, m.P, 3, cible * 3, 0.25, []);
  // compactage des sommets utilisés
  const remap = new Int32Array(m.P.length / 3).fill(-1); const P = [], K = [];
  const I = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) {
    const o = idx[i];
    if (remap[o] < 0) { remap[o] = P.length / 3; P.push(m.P[o * 3], m.P[o * 3 + 1], m.P[o * 3 + 2]); K.push(m.K[o]); }
    I[i] = remap[o];
  }
  return { P: new Float32Array(P), K: Uint8Array.from(K), I };
}

function normales(m) {
  const n = new Float32Array(m.P.length);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  for (let i = 0; i < m.I.length; i += 3) {
    const [i0, i1, i2] = [m.I[i], m.I[i + 1], m.I[i + 2]];
    a.fromArray(m.P, i0 * 3); b.fromArray(m.P, i1 * 3); c.fromArray(m.P, i2 * 3);
    ab.subVectors(b, a); ac.subVectors(c, a); ab.cross(ac);
    for (const j of [i0, i1, i2]) { n[j * 3] += ab.x; n[j * 3 + 1] += ab.y; n[j * 3 + 2] += ab.z; }
  }
  const o = new Int8Array(n.length);
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    o[i] = Math.round(n[i] / l * 127); o[i + 1] = Math.round(n[i + 1] / l * 127); o[i + 2] = Math.round(n[i + 2] / l * 127);
  }
  return o;
}

// ---------- Sélection des pièces ----------
const pieces = []; // {nom, systeme, couche, chemin, mesh}
function ajouter(fichier, systeme, filtre, opts = {}) {
  const root = lireFbx(SRC + fichier + '.fbx');
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry; const tri = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    if (tri <= 12) return;
    const chemin = []; let p = o.parent; while (p && p !== root) { chemin.unshift(p.name); p = p.parent; }
    const mat = [].concat(o.material).map(m => m.name).join('|');
    const info = { nom: o.name, chemin: chemin.join(' > '), mat, tri };
    if (/^[?_]*\?/.test(o.name) || (/^[a-z?]/i.test(o.name) && /[a-z)]j$/.test(o.name) && !['os'].includes(systeme))) return;
    const r = filtre(info);
    if (r) pieces.push({ ...info, systeme: r.systeme || systeme, couche: r.couche, mesh: o, fusion: r.fusion });
  });
}

ajouter('SkeletalSystem100', 'os', i => {
  if (/Auditory_ossicles/.test(i.chemin)) return null;
  if (/^(Origin|End)/.test(i.mat)) return { systeme: 'insertions', couche: 'insertions' };
  if (!/Bone|Cartilage|Teeth|Suture/.test(i.mat) || /[a-z)][ji]$/.test(i.nom) || /Sinus_of|cells_of_ethmoid/.test(i.nom) || /(e\d+|muscle[eo])[lr]?$/.test(i.nom)) return null;
  return { couche: 'os' };
});
ajouter('MuscularSystem100', 'muscles', i => {
  if (/Bursa|Articular capsule/.test(i.mat) || /Bursae|Tendon_sheaths/.test(i.chemin)) return null;
  if (/Extra-ocular|Muscles_of_tongue|Laryngeal|Pharyngeal|soft_palate/.test(i.chemin)) return null;
  if (/^(Inguinal_ligament|Linea_alba)/.test(i.nom)) return { systeme: 'articulations', couche: 'ligaments' };
  if (/Fasci/.test(i.chemin) || /^(Fascia|Ligament)/.test(i.mat) || /fascia/i.test(i.nom)) return { couche: 'fascias' };
  return { couche: 'muscles' };
});
ajouter('Joints100', 'articulations', i => {
  if (/Laryngeal/.test(i.chemin)) return null;
  if (/^Articular capsule/.test(i.mat)) return { couche: 'capsules' };
  if (/^Fat/.test(i.mat)) return null;
  return { couche: 'ligaments' };
});
ajouter('NervousSystem100', 'nerfs', i => {
  if (/Spinal_cordg/.test(i.chemin)) return /^White_matter_of_spinal_cord/.test(i.nom) ? { couche: 'nerfs', systeme: 'nerfs' } : null;
  if (/Spinal_nervesg|Autonomic|Roots_of_nerves/.test(i.chemin)) return { couche: 'nerfs' };
  if (/Cranial_nervesg/.test(i.chemin) && /(Facial|Trigeminal|Accessory|Vagus|Hypoglossal|Mandibular|Maxillary|Ophthalmic|Greater_occipital|Lesser_occipital)/.test(i.nom)) return { couche: 'nerfs' };
  return null;
});
ajouter('CardioVascular41', 'cardio', i => ({ couche: 'cardio' }));
ajouter('VisceralSystem100', 'visceres', i => {
  if (/Thoracic_cavity|Peritoneal|Abdominopelvic/.test(i.chemin)) return null;
  const c = /Respiratory|Larynx/.test(i.chemin) ? 'respiratoire' : /Digestive/.test(i.chemin) ? 'digestif' : /Urinary/.test(i.chemin) ? 'urinaire'
    : /Genital/.test(i.chemin) ? 'genital' : /Endocrine/.test(i.chemin) ? 'endocrinien' : null;
  return c ? { systeme: c, couche: c } : null;
});
ajouter('LymphoidOrgans100', 'lymphatique', i => ({ couche: 'lymphatique' }));
ajouter('NervousSystem100', 'encephale', i => {
  if (/Braing/.test(i.chemin)) return { couche: 'encephale' };
  if (/Sense_organsg/.test(i.chemin)) return { systeme: 'sens', couche: 'sens' };
  return null;
});
ajouter('Regions of human body100', 'peau', i => (/Hairs/.test(i.chemin) ? null : { couche: 'peau', fusion: 'Peau' }));

// ---------- Côtés ----------
const noms = new Set(pieces.map(p => p.nom));
for (const p of pieces) {
  const m = p.nom.match(/^(.*[a-z\)\.'*0-9])([lr])$/);
  p.cote = '';
  p.base = p.nom;
  if (m && (noms.has(m[1] + (m[2] === 'l' ? 'r' : 'l')) || p.systeme === 'insertions')) { p.base = m[1]; p.cote = m[2] === 'l' ? 'G' : 'D'; }
}

// ---------- Allègement ----------
const RATIO = { os: 0.2, muscles: 0.1, fascias: 0.25, ligaments: 0.18, capsules: 0.1, nerfs: 0.05, peau: 0.3, insertions: 0.1,
  cardio: 0.07, respiratoire: 0.18, digestif: 0.15, urinaire: 0.3, genital: 0.3, endocrinien: 0.3, lymphatique: 0.2, encephale: 0.35, sens: 0.12 };
const MIN = { os: 60, muscles: 50, fascias: 30, ligaments: 24, capsules: 30, nerfs: 16, peau: 30, insertions: 12,
  cardio: 16, respiratoire: 40, digestif: 40, urinaire: 40, genital: 40, endocrinien: 30, lymphatique: 20, encephale: 30, sens: 30 };

const fusionnes = new Map();
const resultat = [];
for (const p of pieces) {
  let m = extraire(p.mesh, p.systeme, p.chemin);
  if (!m.I.length) continue;
  if (p.fusion) {
    if (!fusionnes.has(p.fusion)) fusionnes.set(p.fusion, { p, parts: [] });
    fusionnes.get(p.fusion).parts.push(m);
    continue;
  }
  resultat.push({ p, m: alleger(m, RATIO[p.couche], MIN[p.couche]) });
}
// Pièces fusionnées (peau) : soudure des régions entre elles AVANT l'allègement, pour éviter les fentes
for (const [nom, f] of fusionnes) {
  const map = new Map(); const P = [], K = [], I = [];
  for (const m of f.parts) {
    const loc = new Int32Array(m.P.length / 3);
    for (let v = 0; v < loc.length; v++) {
      const key = Math.round(m.P[v * 3] * 200) + ',' + Math.round(m.P[v * 3 + 1] * 200) + ',' + Math.round(m.P[v * 3 + 2] * 200);
      let id = map.get(key);
      if (id === undefined) { id = P.length / 3; map.set(key, id); P.push(m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]); K.push(m.K[v]); }
      loc[v] = id;
    }
    for (let i = 0; i < m.I.length; i += 3) {
      const a = loc[m.I[i]], b = loc[m.I[i + 1]], c = loc[m.I[i + 2]];
      if (a !== b && b !== c && a !== c) I.push(a, b, c);
    }
  }
  const brut = { P: new Float32Array(P), K: Uint8Array.from(K), I: new Uint32Array(I) };
  resultat.push({ p: { ...f.p, nom, base: nom, cote: '' }, m: alleger(brut, RATIO[f.p.couche], MIN[f.p.couche]) });
}

// Boîte englobante globale pour la quantification
const bmin = [1e9, 1e9, 1e9], bmax = [-1e9, -1e9, -1e9];
for (const { m } of resultat) for (let i = 0; i < m.P.length; i++) { const a = i % 3; if (m.P[i] < bmin[a]) bmin[a] = m.P[i]; if (m.P[i] > bmax[a]) bmax[a] = m.P[i]; }

// Quantification uniforme (même échelle sur les 3 axes, pour garder des normales justes)
const centre = [0, 1, 2].map(a => (bmin[a] + bmax[a]) / 2);
const demi = Math.max(...[0, 1, 2].map(a => (bmax[a] - bmin[a]) / 2)) * 1.001;
// ---------- Écriture des paquets ----------
const paquets = {};
const manifeste = { centre: null, echelle: null, pieces: [] };
let id = 0;
const sansNom = new Set();
for (const { p, m } of resultat) {
  const paquet = p.couche === 'insertions' ? 'insertions' : p.couche === 'peau' ? 'peau' : p.systeme === 'muscles' ? 'muscles'
    : /respiratoire|digestif|urinaire|genital|endocrinien/.test(p.systeme) ? 'visceres' : p.systeme;
  if (!paquets[paquet]) paquets[paquet] = { blocs: [], taille: 0 };
  const pk = paquets[paquet];
  let vc = m.P.length / 3;
  const grand = vc > 65535;
  const q = new Int16Array(vc * 3);
  for (let i = 0; i < m.P.length; i++) { const a = i % 3; q[i] = Math.round((m.P[i] - centre[a]) / demi * 32767); }
  const n = normales(m);
  const idx = grand ? Uint32Array.from(m.I) : Uint16Array.from(m.I);
  const pad = b => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
  const bp = pad(Buffer.from(q.buffer)), bn = pad(Buffer.from(n.buffer)), bk = pad(Buffer.from(m.K.buffer, m.K.byteOffset, m.K.byteLength)), bi = pad(Buffer.from(idx.buffer));
  const o = pk.taille;
  pk.blocs.push(bp, bn, bk, bi); pk.taille += bp.length + bn.length + bk.length + bi.length;
  // centre / rayon
  let cx = 0, cy = 0, cz = 0; for (let i = 0; i < m.P.length; i += 3) { cx += m.P[i]; cy += m.P[i + 1]; cz += m.P[i + 2]; }
  cx /= vc; cy /= vc; cz /= vc; let r = 0; for (let i = 0; i < m.P.length; i += 3) r = Math.max(r, Math.hypot(m.P[i] - cx, m.P[i + 1] - cy, m.P[i + 2] - cz));
  const piece = {
    id: id++, en: p.base, cote: p.cote, sys: p.systeme, couche: p.couche, chemin: p.chemin.replace(/g( >|$)/g, '$1'),
    paquet, vc, ic: m.I.length, u32: grand ? 1 : 0, o, ob: [bp.length, bn.length, bk.length],
    c: [+cx.toFixed(1), +cy.toFixed(1), +cz.toFixed(1)], r: +r.toFixed(1),
  };
  if (p.couche === 'muscles') piece.prof = coucheMuscle(p.base);
  if (p.couche !== 'insertions') { piece.fr = nomFr(p.base) || p.base.replace(/[()]/g, '').replace(/_/g, ' '); if (!nomFr(p.base)) sansNom.add(p.base); const t = ta2(p.base); if (t && t.la) piece.la = t.la; }
  else {
    const mm = p.nom.match(/^(.*?)([oe])(\d*)([lr]?)$/);
    piece.muscle = mm ? mm[1] : p.base; piece.type = mm ? mm[2] : '?';
    piece.cote = mm && mm[4] ? (mm[4] === 'l' ? 'G' : 'D') : '';
  }
  manifeste.pieces.push(piece);
}
manifeste.centre = centre.map(x => +x.toFixed(4)); manifeste.echelle = demi / 32767;
for (const [nom, pk] of Object.entries(paquets)) fs.writeFileSync(OUT + nom + '.bin', Buffer.concat(pk.blocs));
fs.writeFileSync(OUT + 'manifeste.json', JSON.stringify(manifeste));
const fichesOut = {};
for (const p of manifeste.pieces) if (p.couche !== 'insertions' && !fichesOut[p.en]) { const f = fiche(p.en); if (f) fichesOut[p.en] = f; }
const sansDesc = [];
for (const p of manifeste.pieces) if (p.couche === 'muscles') {
  const d = DESC[p.en];
  if (!d) { sansDesc.push(p.en); continue; }
  if (!fichesOut[p.en]) fichesOut[p.en] = { texte: '', source: '' };
  fichesOut[p.en].muscle = { o: d[0], t: d[1], i: d[2], a: d[3] };
}
console.log('muscles sans fiche courte :', [...new Set(sansDesc)].join(', ') || 'aucun');
fs.writeFileSync(OUT + 'fiches.json', JSON.stringify(fichesOut));
console.log('fiches', Object.keys(fichesOut).length, 'sans nom français', sansNom.size, [...sansNom].join(', '));

// Résumé
const parCouche = {};
for (const p of manifeste.pieces) { parCouche[p.couche] = parCouche[p.couche] || [0, 0]; parCouche[p.couche][0]++; parCouche[p.couche][1] += p.ic / 3; }
console.log(parCouche);
for (const nom of Object.keys(paquets)) console.log(nom, (fs.statSync(OUT + nom + '.bin').size / 1e6).toFixed(2), 'Mo');
console.log('pièces en miroir corrigées', nbMiroirs);
console.log('boîte', bmin.map(x => x.toFixed(1)), bmax.map(x => x.toFixed(1)));
