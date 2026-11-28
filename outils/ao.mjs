// Prototype de rendu réaliste : ombres de contact (occlusion ambiante) par sommet + axe des fibres musculaires.
// Lit un dossier de données (manifeste + paquets) et y écrit : ao-os.bin, ao-muscles.bin, fibres-s.bin.
// Usage : node ao.mjs [dossier…] | node ao.mjs --regions   (par défaut : ../docs/donnees/, le corps entier)
// À lancer APRÈS construire.mjs (les fichiers suivent l'ordre des pièces du manifeste).
import fs from 'fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

import { norm, cles } from './fibres-cles.mjs';

// Dossiers à traiter : ceux donnés en argument, « --regions » pour les quatre régions, sinon le corps entier.
const REGIONS = ['tete-cou', 'tronc', 'membre-superieur', 'membre-inferieur'];
const args = process.argv.slice(2);
let dossiers = args.filter(a => a !== '--regions');
if (args.indexOf('--regions') >= 0) dossiers = dossiers.concat(REGIONS.map(r => '../docs/donnees/' + r));
if (!dossiers.length) dossiers = ['../docs/donnees/'];
for (const d of dossiers) { console.log('■', d); traiter(d.replace(/\/?$/, '/')); }

function traiter(D) {
const OUT = D;
const M = JSON.parse(fs.readFileSync(D + 'manifeste.json', 'utf8'));
const bufs = {};
const lire = n => (bufs[n] = bufs[n] || fs.readFileSync(D + n + '.bin'));

function decoder(p) {
  const b = lire(p.paquet), ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  const pos = new Int16Array(ab, p.o, p.vc * 3), nrm = new Int8Array(ab, p.o + p.ob[0], p.vc * 3);
  const io = p.o + p.ob[0] + p.ob[1] + p.ob[2];
  const idx = p.u32 ? new Uint32Array(ab, io, p.ic) : new Uint16Array(ab, io, p.ic);
  const P = new Float32Array(p.vc * 3), N = new Float32Array(p.vc * 3);
  for (let i = 0; i < p.vc * 3; i++) { P[i] = pos[i] * M.echelle + M.centre[i % 3]; N[i] = nrm[i] / 127; }
  return { P, N, I: idx };
}

const os = M.pieces.filter(p => p.couche === 'os');
const mus = M.pieces.filter(p => p.couche === 'muscles');
const geo = new Map();
for (const p of os.concat(mus)) geo.set(p.id, decoder(p));

function bvhDe(liste) {
  let nv = 0, ni = 0; liste.forEach(p => { nv += p.vc; ni += p.ic; });
  const P = new Float32Array(nv * 3), I = new Uint32Array(ni); let ov = 0, oi = 0;
  for (const p of liste) { const g = geo.get(p.id); P.set(g.P, ov * 3); for (let k = 0; k < g.I.length; k++) I[oi + k] = g.I[k] + ov; ov += p.vc; oi += g.I.length; }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(P, 3)); bg.setIndex(new THREE.BufferAttribute(I, 1));
  return new MeshBVH(bg);
}

// directions de l'hémisphère (cosinus), fixes
const NR = 32, dirs = [];
for (let i = 0; i < NR; i++) { const u = (i + 0.5) / NR, phi = i * 2.39996; const r = Math.sqrt(u); dirs.push([r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - u)]); }

function calculerAO(liste, bvh, portee) {
  const ray = new THREE.Ray(), n = new THREE.Vector3(), t = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  const sorties = [];
  for (const p of liste) {
    const g = geo.get(p.id), ao = new Uint8Array(p.vc);
    for (let v = 0; v < p.vc; v++) {
      n.fromArray(g.N, v * 3).normalize();
      t.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0).cross(n).normalize(); b.crossVectors(n, t);
      let libre = 0;
      for (const [x, y, z] of dirs) {
        d.copy(t).multiplyScalar(x).addScaledVector(b, y).addScaledVector(n, z);
        ray.origin.fromArray(g.P, v * 3).addScaledVector(n, 0.04); ray.direction.copy(d);
        const h = bvh.raycastFirst(ray, THREE.DoubleSide, 0, portee);
        if (!h) libre++;
      }
      ao[v] = Math.round(255 * libre / NR);
    }
    sorties.push(ao);
  }
  return Buffer.concat(sorties.map(a => Buffer.from(a.buffer)));
}

let t0 = Date.now();
const bvhOs = bvhDe(os);
fs.writeFileSync(OUT + 'ao-os.bin', calculerAO(os, bvhOs, 3.5));
console.log('os', Date.now() - t0, 'ms');
// muscles : un muscle n'est assombri que par les os et les muscles de son plan ou plus profonds
const aoMus = [];
for (const prof of [1, 2, 3]) {
  t0 = Date.now();
  const bvh = bvhDe(os.concat(mus.filter(p => p.prof <= prof)));
  const liste = mus.filter(p => p.prof === prof);
  const buf = calculerAO(liste, bvh, 4);
  let o = 0; for (const p of liste) { aoMus[p.id] = buf.subarray(o, o + p.vc); o += p.vc; }
  console.log('muscles plan', prof, Date.now() - t0, 'ms');
}
fs.writeFileSync(OUT + 'ao-muscles.bin', Buffer.concat(mus.map(p => Buffer.from(aoMus[p.id]))));

// axe des fibres : de l'origine vers la terminaison si connues, sinon axe principal (ACP)
const ins = M.pieces.filter(p => p.couche === 'insertions');
const fibres = {};
for (const p of mus) {
  const g = geo.get(p.id); const c = new THREE.Vector3(p.c[0], p.c[1], p.c[2]);
  const o = ins.filter(q => norm(q.muscle) === norm(p.en) && q.cote === p.cote && q.type === 'o');
  const e = ins.filter(q => norm(q.muscle) === norm(p.en) && q.cote === p.cote && q.type === 'e');
  let ax;
  if (o.length && e.length) {
    const moy = l => l.reduce((s, q) => s.add(new THREE.Vector3(q.c[0], q.c[1], q.c[2])), new THREE.Vector3()).divideScalar(l.length);
    ax = moy(e).sub(moy(o));
  }
  if (!ax || ax.length() < 1) {
    // ACP par itération de puissance
    let cxx = 0, cxy = 0, cxz = 0, cyy = 0, cyz = 0, czz = 0;
    for (let v = 0; v < p.vc; v++) { const x = g.P[v * 3] - c.x, y = g.P[v * 3 + 1] - c.y, z = g.P[v * 3 + 2] - c.z; cxx += x * x; cxy += x * y; cxz += x * z; cyy += y * y; cyz += y * z; czz += z * z; }
    ax = new THREE.Vector3(0.3, 1, 0.2);
    for (let k = 0; k < 30; k++) ax.set(cxx * ax.x + cxy * ax.y + cxz * ax.z, cxy * ax.x + cyy * ax.y + cyz * ax.z, cxz * ax.x + cyz * ax.y + czz * ax.z).normalize();
  }
  ax.normalize();
  fibres[p.id] = [+ax.x.toFixed(3), +ax.y.toFixed(3), +ax.z.toFixed(3)];
}
console.log('fibres', Object.keys(fibres).length);

// ---------- Champ de direction des fibres, sommet par sommet ----------
// t = dO / (dO + dE) : 0 sur l'origine, 1 sur la terminaison. Les fibres suivent la pente de t le long de la surface.
const insGeo = new Map();
function ptsInsertion(q) {
  if (!insGeo.has(q.id)) insGeo.set(q.id, decoder(q).P);
  return insGeo.get(q.id);
}
function distMin(P, v, nuage) {
  let best = 1e9; const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
  for (let i = 0; i < nuage.length; i += 3) { const dx = nuage[i] - x, dy = nuage[i + 1] - y, dz = nuage[i + 2] - z; const d = dx * dx + dy * dy + dz * dz; if (d < best) best = d; }
  return Math.sqrt(best);
}
const sortiesF = []; let avecChamp = 0;
for (const p of mus) {
  const g = geo.get(p.id), out = new Int8Array(p.vc * 3);
  const c = cles(p.en);
  const lo = ins.filter(q => c.has(norm(q.muscle)) && q.cote === p.cote && q.type === 'o');
  const le = ins.filter(q => c.has(norm(q.muscle)) && q.cote === p.cote && q.type === 'e');
  const ax = fibres[p.id];
  let champ = null;
  if (lo.length && le.length) {
    const concat = l => { const arrs = l.map(ptsInsertion); const n = arrs.reduce((s, a) => s + a.length, 0); const r = new Float32Array(n); let o = 0; arrs.forEach(a => { r.set(a, o); o += a.length; }); return r; };
    // sous-échantillonnage des nuages pour la vitesse
    const pas = a => { if (a.length / 3 <= 400) return a; const k = Math.ceil(a.length / 3 / 400); const r = []; for (let i = 0; i < a.length / 3; i += k) r.push(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]); return new Float32Array(r); };
    const O = pas(concat(lo)), E = pas(concat(le));
    const t = new Float32Array(p.vc);
    for (let v = 0; v < p.vc; v++) { const a = distMin(g.P, v, O), b = distMin(g.P, v, E); t[v] = a / (a + b + 1e-6); }
    // gradient par face, accumulé aux sommets
    champ = new Float32Array(p.vc * 3);
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3(), gr = new THREE.Vector3(), tmp = new THREE.Vector3();
    for (let f = 0; f < g.I.length; f += 3) {
      const i0 = g.I[f], i1 = g.I[f + 1], i2 = g.I[f + 2];
      A.fromArray(g.P, i0 * 3); B.fromArray(g.P, i1 * 3); C.fromArray(g.P, i2 * 3);
      e1.subVectors(B, A); e2.subVectors(C, A); n.crossVectors(e1, e2); const aire2 = n.length(); if (aire2 < 1e-9) continue; n.divideScalar(aire2);
      // gradient d'une fonction linéaire sur le triangle
      gr.set(0, 0, 0);
      tmp.crossVectors(n, new THREE.Vector3().subVectors(C, B)).multiplyScalar(t[i0]); gr.add(tmp);
      tmp.crossVectors(n, new THREE.Vector3().subVectors(A, C)).multiplyScalar(t[i1]); gr.add(tmp);
      tmp.crossVectors(n, new THREE.Vector3().subVectors(B, A)).multiplyScalar(t[i2]); gr.add(tmp);
      for (const i of [i0, i1, i2]) { champ[i * 3] += gr.x; champ[i * 3 + 1] += gr.y; champ[i * 3 + 2] += gr.z; }
    }
    avecChamp++;
  }
  const d = new THREE.Vector3();
  for (let v = 0; v < p.vc; v++) {
    if (champ) d.fromArray(champ, v * 3); else d.set(0, 0, 0);
    if (d.length() < 1e-6) d.set(ax[0], ax[1], ax[2]);
    d.normalize();
    out[v * 3] = Math.round(d.x * 127); out[v * 3 + 1] = Math.round(d.y * 127); out[v * 3 + 2] = Math.round(d.z * 127);
  }
  sortiesF.push(Buffer.from(out.buffer));
}
console.log('champ de fibres calculé pour', avecChamp, 'muscles sur', mus.length);

// ---------- Coordonnée « en travers des fibres » (s), stable, par sommet ----------
// Les fibres sont les lignes où s est constant. En éventail : angle autour du point de convergence ; sinon : distance latérale à l'axe.
const sortiesS = []; let nEventail = 0;
for (const p of mus) {
  const g = geo.get(p.id), s = new Float32Array(p.vc);
  const c = new THREE.Vector3(p.c[0], p.c[1], p.c[2]);
  const k = cles(p.en);
  const lo = ins.filter(q => k.has(norm(q.muscle)) && q.cote === p.cote && q.type === 'o');
  const le = ins.filter(q => k.has(norm(q.muscle)) && q.cote === p.cote && q.type === 'e');
  const A = new THREE.Vector3().fromArray(fibres[p.id]).normalize();
  // axe origine → terminaison quand les insertions sont connues (y compris pour un chef de muscle)
  if (lo.length && le.length) {
    const moy = l => { const r = new THREE.Vector3(); let n = 0; l.forEach(q => { const a = ptsInsertion(q); for (let i = 0; i < a.length; i += 3) { r.x += a[i]; r.y += a[i + 1]; r.z += a[i + 2]; n++; } }); return r.divideScalar(n); };
    const d = moy(le).sub(moy(lo));
    if (d.length() > 1) A.copy(d.normalize());
  }
  // normale moyenne, rendue perpendiculaire à l'axe
  const Nm = new THREE.Vector3();
  for (let v = 0; v < p.vc; v++) Nm.x += g.N[v * 3], Nm.y += g.N[v * 3 + 1], Nm.z += g.N[v * 3 + 2];
  Nm.addScaledVector(A, -Nm.dot(A));
  if (Nm.length() < 1e-3) Nm.set(A.y, -A.x, 0);
  Nm.normalize();
  const Tm = new THREE.Vector3().crossVectors(Nm, A).normalize();
  let apex = null, oppose = null;
  // Les étiquettes origine / terminaison de la source ne sont pas fiables : on regroupe toutes les attaches en deux amas.
  const attaches = lo.concat(le);
  if (attaches.length) {
    // un élément par zone d'attache (une voix par zone, quelle que soit sa taille)
    const zones = attaches.map(q => { const a = ptsInsertion(q); const l = []; for (let i = 0; i < a.length; i += 3) l.push(new THREE.Vector3(a[i], a[i + 1], a[i + 2])); return { c: new THREE.Vector3(q.c[0], q.c[1], q.c[2]), pts: l }; });
    const m0 = zones.reduce((a, z) => a.add(z.c), new THREE.Vector3()).divideScalar(zones.length);
    let c1 = zones.reduce((a, z) => (z.c.distanceToSquared(m0) > a.distanceToSquared(m0) ? z.c : a), zones[0].c).clone();
    let c2 = zones.reduce((a, z) => (z.c.distanceToSquared(c1) > a.distanceToSquared(c1) ? z.c : a), zones[0].c).clone();
    let z1 = [], z2 = [];
    for (let it = 0; it < 12; it++) {
      z1 = []; z2 = [];
      zones.forEach(z => (z.c.distanceToSquared(c1) <= z.c.distanceToSquared(c2) ? z1 : z2).push(z));
      if (!z1.length || !z2.length) break;
      c1 = z1.reduce((a, z) => a.add(z.c), new THREE.Vector3()).divideScalar(z1.length);
      c2 = z2.reduce((a, z) => a.add(z.c), new THREE.Vector3()).divideScalar(z2.length);
    }
    const g1 = [].concat(...z1.map(z => z.pts)), g2 = [].concat(...z2.map(z => z.pts));
    if (g1.length && g2.length) {
      c1 = g1.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(g1.length);
      c2 = g2.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(g2.length);
    }
    if (g1.length && g2.length && c1.distanceTo(c2) > 3) {
      const etal = (g, m) => { let r = 0; g.forEach(q => { const d = q.clone().sub(m); d.addScaledVector(Nm, -d.dot(Nm)); r += d.lengthSq(); }); return Math.sqrt(r / g.length); };
      const r1 = etal(g1, c1), r2 = etal(g2, c2);
      A.copy(c2.clone().sub(c1).normalize());
      Nm.addScaledVector(A, -Nm.dot(A)); if (Nm.length() > 1e-3) Nm.normalize();
      Tm.crossVectors(Nm, A).normalize();
      if (r1 < 0.5 * r2) { apex = c1; oppose = c2; } else if (r2 < 0.5 * r1) { apex = c2; oppose = c1; }
      if (process.env.DEBUG && p.en.indexOf(process.env.DEBUG) >= 0 && p.cote === "D") console.log("DEBUG", p.en, "g1", g1.length, c1.toArray().map(x => x.toFixed(1)), "r1", r1.toFixed(1), "g2", g2.length, c2.toArray().map(x => x.toFixed(1)), "r2", r2.toFixed(1), "apex", !!apex);
    }
  }
  if (apex) {
    nEventail++;
    const Ap = oppose.clone().sub(apex); Ap.addScaledVector(Nm, -Ap.dot(Nm)).normalize();
    const Tp = new THREE.Vector3().crossVectors(Nm, Ap).normalize();
    let R = 0; const q = new THREE.Vector3();
    for (let v = 0; v < p.vc; v++) { q.fromArray(g.P, v * 3).sub(apex); R += q.length(); }
    R /= p.vc;
    for (let v = 0; v < p.vc; v++) { q.fromArray(g.P, v * 3).sub(apex); s[v] = Math.atan2(q.dot(Tp), Math.max(1e-3, q.dot(Ap))) * R; }
  } else {
    const q = new THREE.Vector3();
    for (let v = 0; v < p.vc; v++) { q.fromArray(g.P, v * 3).sub(c); s[v] = q.dot(Tm); }
  }
  sortiesS.push(Buffer.from(s.buffer));
}
fs.writeFileSync(OUT + 'fibres-s.bin', Buffer.concat(sortiesS));
console.log('coordonnée des fibres :', nEventail, 'muscles en éventail sur', mus.length);
}
