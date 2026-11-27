/* Anatomie 3D — application de visualisation pour le cabinet.
   Écrit pour Safari 12 (iPad mini 2, iOS 12) : pas de « ?. », pas de « ?? », pas d'Object.fromEntries,
   pas d'événements « pointer » pour nos propres gestes (on utilise touch + souris). */
(function () {
  'use strict';

  var VERSION = '1.2.1';
  var DONNEES = 'donnees/';
  var PAQUETS = ['os', 'muscles', 'articulations', 'nerfs', 'peau'];

  // Couleurs par classe de tissu (index stocké par sommet)
  var PALETTE = [];
  PALETTE[0] = [214, 209, 199]; // os
  PALETTE[1] = [196, 210, 220]; // cartilage
  PALETTE[2] = [236, 232, 222]; // dent
  PALETTE[3] = [198, 100, 84];  // muscle
  PALETTE[4] = [228, 226, 221]; // tendon
  PALETTE[5] = [210, 212, 208]; // ligament
  PALETTE[6] = [185, 200, 214]; // capsule
  PALETTE[7] = [242, 201, 76];  // nerf
  PALETTE[8] = [224, 180, 152]; // peau
  PALETTE[9] = [217, 219, 234]; // fascia
  PALETTE[10] = [200, 200, 200];
  PALETTE[11] = [240, 216, 144]; // graisse
  PALETTE[12] = [232, 89, 12];  // origine
  PALETTE[13] = [18, 184, 134]; // terminaison
  PALETTE[14] = [245, 230, 168]; // moelle
  PALETTE[15] = [198, 40, 40];  // artère
  PALETTE[16] = [53, 84, 165];  // veine
  PALETTE[17] = [170, 52, 48];  // cœur
  PALETTE[18] = [226, 150, 150]; // respiratoire
  PALETTE[19] = [214, 128, 108]; // digestif
  PALETTE[20] = [128, 46, 40];  // foie, vésicule
  PALETTE[21] = [196, 120, 80]; // urinaire
  PALETTE[22] = [214, 146, 156]; // génital
  PALETTE[23] = [200, 150, 70]; // endocrinien
  PALETTE[24] = [134, 184, 90]; // lymphatique
  PALETTE[25] = [226, 196, 186]; // encéphale
  PALETTE[26] = [236, 236, 236]; // œil
  PALETTE[27] = [214, 180, 150]; // oreille

  // Systèmes chargés à la demande : couche → paquet
  var PAQUET_DE = { cardio: 'cardio', respiratoire: 'visceres', digestif: 'visceres', urinaire: 'visceres', genital: 'visceres',
    endocrinien: 'visceres', lymphatique: 'lymphatique', encephale: 'encephale', sens: 'sens', insertions: 'insertions' };
  var SYSTEMES = ['nerfs', 'encephale', 'sens', 'cardio', 'respiratoire', 'digestif', 'urinaire', 'genital', 'endocrinien', 'lymphatique'];
  var BASCULES = ['os', 'ligaments', 'capsules', 'fascias', 'peauTransp'].concat(SYSTEMES);

  // ---------- État ----------
  var etat = {
    niveau: 3, cote: '', os: true, ligaments: false, capsules: false, fascias: false, nerfs: false, peauTransp: false,
    encephale: false, sens: false, cardio: false, respiratoire: false, digestif: false, urinaire: false, genital: false, endocrinien: false, lymphatique: false,
    masques: {}, isole: null, transp: {}, sel: null, selection: {}, multi: false, insertions: false,
    dessin: false, modeDessin: 'corps', couleur: '#e03131', langue2: lirePref('langue2', ''), endoscope: false, quiz: null
  };
  function lirePref(k, d) { try { var v = localStorage.getItem('anatomie3d.' + k); return v === null ? d : v; } catch (e) { return d; } }
  function ecrirePref(k, v) { try { localStorage.setItem('anatomie3d.' + k, v); } catch (e) {} }
  var M = null;              // manifeste
  var meshes = [];           // par id
  var fiches = null;         // fiches descriptives (chargées en arrière-plan)
  var paquetsPrets = {}, paquetsEnCours = {};
  var groupe;                // groupe contenant tout le corps

  // ---------- Rendu ----------
  var canvas = document.getElementById('scene');
  var pr = Math.min(window.devicePixelRatio || 1, 1.5);
  var attrGL = { antialias: pr < 1.5, alpha: true, powerPreference: 'high-performance' };
  var gl = canvas.getContext('webgl', attrGL) || canvas.getContext('experimental-webgl', attrGL);
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, context: gl, antialias: attrGL.antialias, alpha: true });
  var derivees = !!renderer.extensions.get('OES_standard_derivatives');
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x000000, 0);
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 2, 3000);
  scene.add(camera);
  var ciel = new THREE.HemisphereLight(0xffffff, 0x3a4250, 0.55);
  scene.add(ciel);
  // lumière d'endoscope : faisceau étroit partant de la caméra
  var lampe = new THREE.DirectionalLight(0xffffff, 0.72);
  lampe.position.set(0.35, 0.55, 1);
  camera.add(lampe);
  lampe.target.position.set(0, 0, -1);
  camera.add(lampe.target);
  var contre = new THREE.DirectionalLight(0xffffff, 0.18);
  contre.position.set(-0.6, -0.2, -1);
  camera.add(contre);

  var controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.rotateSpeed = 0.85;
  controls.zoomSpeed = 1.1;
  controls.panSpeed = 0.9;
  controls.screenSpacePanning = true;
  controls.minDistance = 6;
  controls.maxDistance = 520;
  controls.enableKeys = false;
  // Zoom vers le point visé (molette ou pincement) : on remplace le zoom de three.js r128, qui vise toujours le centre.
  controls.enableZoom = false;
  // three.js r128 n'accepte à deux doigts que DOLLY_PAN ou DOLLY_ROTATE (TOUCH.PAN y est ignoré sans erreur).
  // Avec enableZoom = false, DOLLY_PAN ne fait que déplacer ; le zoom vers les doigts est géré plus bas.
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  var plan = new THREE.Plane(), pointZoom = new THREE.Vector3(), dirVue = new THREE.Vector3();
  function pointSous(x, y) {
    var h = viser(x, y, false);
    if (h) return h.point.clone();
    // rien sous le doigt : plan passant par le centre de rotation, face à la caméra
    camera.getWorldDirection(dirVue);
    plan.setFromNormalAndCoplanarPoint(dirVue, controls.target);
    return raycaster.ray.intersectPlane(plan, pointZoom) ? pointZoom.clone() : controls.target.clone();
  }
  function zoomerVers(p, facteur) {
    var dist = camera.position.distanceTo(controls.target) * facteur;
    if (dist < controls.minDistance || dist > controls.maxDistance) {
      facteur = Math.min(Math.max(dist, controls.minDistance), controls.maxDistance) / camera.position.distanceTo(controls.target);
    }
    camera.position.sub(p).multiplyScalar(facteur).add(p);
    controls.target.sub(p).multiplyScalar(facteur).add(p);
    anim = null;
    controls.update();
    effacerEcranSiBesoin();
  }
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var d = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    zoomerVers(pointSous(e.clientX, e.clientY), Math.exp(Math.max(-300, Math.min(300, d)) * 0.0018));
  }, { passive: false });
  var pince = null;
  function ecartDoigts(e) { var a = e.touches[0], b = e.touches[1]; return Math.sqrt(Math.pow(a.clientX - b.clientX, 2) + Math.pow(a.clientY - b.clientY, 2)); }
  canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      var mx = (e.touches[0].clientX + e.touches[1].clientX) / 2, my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      var p0 = pointSous(mx, my);
      camera.getWorldDirection(dirVue);
      pince = { d: ecartDoigts(e), plan: new THREE.Plane().setFromNormalAndCoplanarPoint(dirVue.clone(), p0), p: p0 };
    } else pince = null;
  }, { passive: true });
  canvas.addEventListener('touchmove', function (e) {
    if (!pince || e.touches.length !== 2) return;
    var d = ecartDoigts(e);
    if (d > 0 && pince.d > 0) {
      // point fixe = ce qui se trouve sous le milieu des doigts, à la profondeur visée au départ
      var mx = (e.touches[0].clientX + e.touches[1].clientX) / 2, my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      ndc.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var p = raycaster.ray.intersectPlane(pince.plan, pointZoom) ? pointZoom.clone() : pince.p;
      zoomerVers(p, pince.d / d);
    }
    pince.d = d;
  }, { passive: true });
  canvas.addEventListener('touchend', function (e) { if (e.touches.length < 2) pince = null; }, { passive: true });
  controls.addEventListener('change', demanderRendu);
  // Résolution fixe : la changer pendant les gestes faisait sauter l'image sur l'iPad.
  var mesure = null, derniereFluidite = '';
  controls.addEventListener('start', function () {
    anim = null; effacerEcranSiBesoin(); fermerPanneaux();
    mesure = { t0: performance.now(), n: 0 };
  });
  controls.addEventListener('end', function () {
    if (mesure) {
      var duree = performance.now() - mesure.t0;
      if (duree > 400 && mesure.n > 3) {
        derniereFluidite = Math.round(mesure.n * 1000 / duree) + ' images/s';
        var el = document.getElementById('fluidite'); if (el) el.textContent = 'Fluidité mesurée pendant le dernier geste : ' + derniereFluidite;
      }
      mesure = null;
    }
    demanderRendu();
  });

  var renduDemande = false;
  function demanderRendu() {
    if (!renduDemande) { renduDemande = true; requestAnimationFrame(rendre); }
  }
  function rendre() {
    renduDemande = false;
    if (anim) etapeAnimation();
    renderer.render(scene, camera);
    if (mesure) mesure.n++;
    if (anim) demanderRendu();
  }

  function redimensionner() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    UNI.ecran.value.set(w * pr, h * pr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    calque.width = w * pr; calque.height = h * pr;
    redessinerEcran();
    demanderRendu();
  }

  // ---------- Matériaux : rendu réaliste ----------
  // Éclairage studio précalculé (matcap), ombres de contact (attribut ao), fibres musculaires (attribut fs).
  var UNI = {
    matcap: { value: creerMatcap() },
    fibresOn: { value: lirePref('fibres', '1') === '1' ? 1 : 0 },
    endo: { value: 0 },
    ecran: { value: new THREE.Vector2(1024, 768) }
  };
  function creerMatcap() {
    var T = 256, d = new Uint8Array(T * T * 4);
    function nrm(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
    var L1 = nrm([-0.4, 0.55, 0.75]), L2 = nrm([0.65, 0.05, 0.45]), H = nrm([L1[0], L1[1], L1[2] + 1]);
    for (var y = 0; y < T; y++) for (var x = 0; x < T; x++) {
      var nx = (x + 0.5) / T * 2 - 1, ny = (y + 0.5) / T * 2 - 1, r2 = nx * nx + ny * ny, i = (y * T + x) * 4;
      if (r2 > 1) { nx /= Math.sqrt(r2); ny /= Math.sqrt(r2); r2 = 1; }
      var nz = Math.sqrt(Math.max(0, 1 - r2));
      var d1 = Math.max(0, nx * L1[0] + ny * L1[1] + nz * L1[2]), d2 = Math.max(0, nx * L2[0] + ny * L2[1] + nz * L2[2]);
      var dif = 0.16 + 0.78 * Math.pow(d1, 1.1) + 0.24 * d2 + 0.14 * (0.5 + 0.5 * ny) + 0.22 * Math.pow(1 - nz, 2.2);
      var hd = Math.max(0, nx * H[0] + ny * H[1] + nz * H[2]);
      var sp = Math.pow(hd, 48) + 0.25 * Math.pow(hd, 8);
      d[i] = Math.min(255, dif / 1.4 * 255); d[i + 1] = Math.min(255, dif / 1.4 * 250); d[i + 2] = Math.min(255, dif / 1.4 * 242);
      d[i + 3] = Math.min(255, sp * 255);
    }
    var t = new THREE.DataTexture(d, T, T, THREE.RGBAFormat);
    t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    return t;
  }
  var VS = [
    'precision highp float;',
    'uniform mat4 modelMatrix, modelViewMatrix, projectionMatrix; uniform mat3 normalMatrix;',
    'attribute vec3 position, normal, color; attribute float ao, tissu, fs;',
    'varying vec3 vN, vC, vP; varying float vAo, vT, vS;',
    'void main() {',
    '  vP = (modelMatrix * vec4(position, 1.0)).xyz;',
    '  vN = normalize(normalMatrix * normal); vC = color; vAo = ao; vT = tissu; vS = fs;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'].join('\n');
  var FS = [
    derivees ? '#extension GL_OES_standard_derivatives : enable' : '',
    'precision highp float;',
    'uniform sampler2D matcap; uniform float fibresOn, endo, opacite; uniform vec3 ajout; uniform vec2 ecran;',
    'varying vec3 vN, vC, vP; varying float vAo, vT, vS;',
    'float h(float n) { return fract(sin(n * 0.1031 + 7.13) * 43758.5453); }',
    'float bruit(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h(i), h(i + 1.0), f); }',
    'void main() {',
    '  vec3 n = normalize(vN);',
    '  vec4 m = texture2D(matcap, vec2(n.x * 0.49 + 0.5, n.y * 0.49 + 0.5));',
    '  vec3 alb = vC; float brille = 0.10;',
    derivees ? [
    '  if (vT > 0.5 && fibresOn > 0.5) {',
    '    float u = vS;',
    '    float fiable = smoothstep(0.3, 0.6, fwidth(u) / max(length(fwidth(vP)), 1e-5));',
    '    float fx = u * 2.4; float cell = floor(fx);',
    '    float bord = abs(fract(fx) - 0.5) * 2.0;',
    '    float fadeG = clamp(1.6 - fwidth(fx) * 3.0, 0.0, 1.0) * fiable;',
    '    float sillon = smoothstep(0.84, 1.0, bord) * (0.5 + 0.5 * h(cell * 3.7));',
    '    float fu = u * 16.0 + h(cell) * 9.0;',
    '    float fadeF = clamp(1.5 - fwidth(fu) * 2.2, 0.0, 1.0) * fiable;',
    '    float fib = 0.6 * bruit(fu) + 0.4 * bruit(fu * 2.3 + 5.0);',
    '    float ton = mix(1.0, 0.93 + 0.12 * h(cell), fadeG) * mix(1.0, 0.88 + 0.22 * fib, fadeF);',
    '    alb *= ton * (1.0 - 0.32 * sillon * fadeG);',
    '    brille = 0.07 + 0.09 * fib * fadeF;',
    '  }'].join('\n') : '',
    '  float occ = mix(0.15, 1.0, pow(clamp(vAo, 0.0, 1.0), 1.5));',
    '  vec3 col = alb * m.rgb * 1.4 * occ + vec3(m.a) * brille * occ + ajout;',
    '  if (endo > 0.5) {',
    '    vec2 d = gl_FragCoord.xy / ecran - 0.5; d.x *= ecran.x / ecran.y;',
    '    col *= mix(0.06, 1.45, smoothstep(0.45, 0.04, length(d)));',
    '  }',
    '  gl_FragColor = vec4(col, opacite);',
    '}'].join('\n');
  function tissu(o) {
    o = o || {};
    var u = { matcap: UNI.matcap, fibresOn: UNI.fibresOn, endo: UNI.endo, ecran: UNI.ecran,
      opacite: { value: o.opacite || 1 }, ajout: { value: new THREE.Color(o.ajout || 0x000000) } };
    var m = new THREE.RawShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: u,
      transparent: !!o.transparent, depthWrite: o.depthWrite !== false, side: o.side || THREE.FrontSide });
    if (o.decalage) { m.polygonOffset = true; m.polygonOffsetFactor = o.decalage[0]; m.polygonOffsetUnits = o.decalage[1]; }
    return m;
  }
  var MAT = {
    base: tissu(),
    peau: tissu(),
    peauTransp: tissu({ transparent: true, opacite: 0.28, depthWrite: false }),
    fascia: tissu({ transparent: true, opacite: 0.55, depthWrite: false, side: THREE.DoubleSide, decalage: [-1, -6] }),
    capsule: tissu({ transparent: true, opacite: 0.62, depthWrite: false }),
    sel: tissu({ ajout: 0x0e2c58 }),
    selTransp: tissu({ ajout: 0x10295a, transparent: true, opacite: 0.35, depthWrite: false }),
    ins: tissu({ decalage: [-2, -4] }),
    transp: tissu({ transparent: true, opacite: 0.22, depthWrite: false }),
    bon: tissu({ ajout: 0x1f6b2e }),
    cible: tissu({ ajout: 0xd06000 })
  };
  function materiauPour(p) {
    if (etat.quiz && etat.quiz.marque && etat.quiz.marque[p.id]) return MAT[etat.quiz.marque[p.id]];
    if (etat.selection[p.id]) return (etat.insertions || etat.transp[p.id]) ? MAT.selTransp : MAT.sel;
    if (etat.transp[p.id]) return MAT.transp;
    if (p.couche === 'peau') return etat.peauTransp ? MAT.peauTransp : MAT.peau;
    if (p.couche === 'fascias') return MAT.fascia;
    if (p.couche === 'capsules') return MAT.capsule;
    if (p.couche === 'insertions') return MAT.ins;
    return MAT.base;
  }

  // ---------- Chargement ----------
  var barre = document.getElementById('barre-prog');
  var texteProg = document.getElementById('texte-prog');

  function charger(url, type, progres) {
    return new Promise(function (ok, ko) {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.responseType = type;
      x.onprogress = function (e) { if (progres) progres(e.loaded, e.lengthComputable ? e.total : 0); };
      x.onload = function () { if (x.status === 200 || (x.status === 0 && x.response)) ok(x.response); else ko(new Error(url + ' : ' + x.status)); };
      x.onerror = function () { ko(new Error('Réseau : ' + url)); };
      x.send();
    });
  }

  function construireMesh(p, buf) {
    var o = p.o;
    var pos = new Int16Array(buf, o, p.vc * 3);
    var nrm = new Int8Array(buf, o + p.ob[0], p.vc * 3);
    var cls = new Uint8Array(buf, o + p.ob[0] + p.ob[1], p.vc);
    var io = o + p.ob[0] + p.ob[1] + p.ob[2];
    var idx = p.u32 ? new Uint32Array(buf, io, p.ic) : new Uint16Array(buf, io, p.ic);
    // légère variation de teinte par muscle pour distinguer les voisins
    var nuance = 1;
    if (p.couche === 'muscles') nuance = 0.9 + ((p.id * 2654435761) % 1000) / 1000 * 0.2;
    var col = new Uint8Array(p.vc * 3);
    for (var v = 0; v < p.vc; v++) {
      var k = cls[v], c = PALETTE[k] || PALETTE[10];
      var f = (k === 3) ? nuance : 1;
      col[v * 3] = Math.min(255, c[0] * f); col[v * 3 + 1] = Math.min(255, c[1] * f); col[v * 3 + 2] = Math.min(255, c[2] * f);
    }
    var tis = new Uint8Array(p.vc);
    for (var w = 0; w < p.vc; w++) tis[w] = cls[w] === 3 ? 255 : 0;
    var aoTab = AO.os && p.couche === 'os' ? AO.os.subarray(AO.off[p.id], AO.off[p.id] + p.vc)
      : AO.muscles && p.couche === 'muscles' ? AO.muscles.subarray(AO.off[p.id], AO.off[p.id] + p.vc) : null;
    var fsTab = AO.fs && p.couche === 'muscles' ? AO.fs.subarray(AO.off[p.id], AO.off[p.id] + p.vc) : null;
    var g = new THREE.BufferGeometry();
    g.setAttribute('ao', new THREE.BufferAttribute(aoTab ? new Uint8Array(aoTab) : remplir(new Uint8Array(p.vc), 255), 1, true));
    g.setAttribute('tissu', new THREE.BufferAttribute(tis, 1, true));
    g.setAttribute('fs', new THREE.BufferAttribute(fsTab ? new Float32Array(fsTab) : new Float32Array(p.vc), 1));
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    var m = new THREE.Mesh(g, materiauPour(p));
    m.userData.p = p;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    if (p.couche === 'fascias' || p.couche === 'capsules') m.renderOrder = 2;
    if (p.couche === 'peau') m.renderOrder = 3;
    if (p.couche === 'insertions') m.renderOrder = 1;
    groupe.add(m);
    meshes[p.id] = m;
  }

  function remplir(t, v) { for (var i = 0; i < t.length; i++) t[i] = v; return t; }
  // ombres de contact (os, muscles) et coordonnée des fibres (muscles), dans l'ordre du manifeste
  var AO = { os: null, muscles: null, fs: null, off: {} };
  function preparerAO(bufs) {
    var oO = 0, oM = 0;
    M.pieces.forEach(function (p) {
      if (p.couche === 'os') { AO.off[p.id] = oO; oO += p.vc; }
      else if (p.couche === 'muscles') { AO.off[p.id] = oM; oM += p.vc; }
    });
    if (bufs.os && bufs.os.byteLength === oO) AO.os = new Uint8Array(bufs.os);
    if (bufs.muscles && bufs.muscles.byteLength === oM) AO.muscles = new Uint8Array(bufs.muscles);
    if (bufs.fs && bufs.fs.byteLength === oM * 4) AO.fs = new Float32Array(bufs.fs);
  }
  function demarrer() {
    var tailles = {}, recus = {};
    function maj() {
      var t = 0, r = 0;
      for (var k in tailles) { t += tailles[k]; r += recus[k] || 0; }
      var frac = t ? r / t : 0;
      barre.style.width = Math.round(10 + frac * 85) + '%';
    }
    texteProg.textContent = 'Chargement du corps…';
    charger(DONNEES + 'manifeste.json?v=' + VERSION, 'json').then(function (man) {
      M = typeof man === 'string' ? JSON.parse(man) : man;
      groupe = new THREE.Group();
      groupe.scale.setScalar(M.echelle);
      groupe.position.set(M.centre[0], M.centre[1], M.centre[2]);
      groupe.updateMatrix();
      scene.add(groupe);
      // tailles estimées pour la barre de progression
      M.pieces.forEach(function (p) { if (PAQUETS.indexOf(p.paquet) >= 0) tailles[p.paquet] = Math.max(tailles[p.paquet] || 0, p.o + p.ob[0] + p.ob[1] + p.ob[2] + p.ic * (p.u32 ? 4 : 2)); });
      var details = Promise.all(['ao-os', 'ao-muscles', 'fibres-s'].map(function (n) {
        return charger(DONNEES + n + '.bin?v=' + VERSION, 'arraybuffer').catch(function () { return null; });
      })).then(function (b) { preparerAO({ os: b[0], muscles: b[1], fs: b[2] }); });
      return Promise.all([details].concat(PAQUETS.map(function (nom) {
        return charger(DONNEES + nom + '.bin?v=' + VERSION, 'arraybuffer', function (l) { recus[nom] = l; maj(); }).then(function (buf) {
          recus[nom] = tailles[nom]; maj();
          return { nom: nom, buf: buf };
        });
      }))).then(function (r) { return r.slice(1); });
    }).then(function (res) {
      texteProg.textContent = 'Construction du modèle…';
      var parPaquet = {};
      res.forEach(function (r) { parPaquet[r.nom] = r.buf; });
      // construction en plusieurs passes pour laisser respirer l'affichage
      var liste = M.pieces.filter(function (p) { return PAQUETS.indexOf(p.paquet) >= 0; });
      PAQUETS.forEach(function (n) { paquetsPrets[n] = true; });
      var i = 0;
      return new Promise(function (ok) {
        (function lot() {
          var fin = Math.min(liste.length, i + 120);
          for (; i < fin; i++) construireMesh(liste[i], parPaquet[liste[i].paquet]);
          barre.style.width = Math.round(95 + 5 * i / liste.length) + '%';
          if (i < liste.length) setTimeout(lot, 0); else ok();
        })();
      });
    }).then(function () {
      majVisibilite();
      vueInitiale(false);
      redimensionner();
      document.getElementById('chargement').className = 'fini';
      setTimeout(function () { document.getElementById('chargement').style.display = 'none'; }, 500);
      charger(DONNEES + 'fiches.json?v=' + VERSION, 'json').then(function (f) { fiches = typeof f === 'string' ? JSON.parse(f) : f; majCarte(); });
      construireIndexRecherche();
      sonde.pret = true;
    }).catch(function (e) {
      texteProg.textContent = 'Impossible de charger le modèle. Vérifiez la connexion puis rouvrez l’application. (' + e.message + ')';
    });
  }

  var NOMS_PAQUETS = { insertions: 'des insertions', cardio: 'du cœur et des vaisseaux', visceres: 'des viscères', lymphatique: 'du système lymphatique', encephale: 'de l’encéphale', sens: 'de l’œil et de l’oreille' };
  function chargerPaquet(nom) {
    if (paquetsPrets[nom]) return Promise.resolve();
    if (paquetsEnCours[nom]) return paquetsEnCours[nom];
    bulle('Chargement ' + (NOMS_PAQUETS[nom] || '') + '…', 0);
    paquetsEnCours[nom] = charger(DONNEES + nom + '.bin?v=' + VERSION, 'arraybuffer').then(function (buf) {
      M.pieces.forEach(function (p) { if (p.paquet === nom) { construireMesh(p, buf); meshes[p.id].visible = false; } });
      paquetsPrets[nom] = true;
      delete paquetsEnCours[nom];
      cacherBulle();
    }, function (e) {
      delete paquetsEnCours[nom];
      bulle('Chargement impossible (connexion ?)', 3000);
      throw e;
    });
    return paquetsEnCours[nom];
  }
  function chargerInsertions() { return chargerPaquet('insertions'); }

  // ---------- Visibilité ----------
  function niveauPour(p) {
    var n = etat.niveau;
    if (etat.cote && p.cote && p.cote !== etat.cote && n < 3) return 3;
    return n;
  }
  function nomMuscle(s) { return s.toLowerCase().replace(/[()]/g, '').replace(/_muscles?r?$/, '').replace(/_muscles?_/g, '_'); }
  // Clés d'insertion d'un muscle : son nom, le muscle entier (pour un chef ou une partie) et le groupe éventuel
  var GROUPES_INS = [
    [/gastrocnemius|^soleus|calcaneal_tendon/, ['triceps_surae']],
    [/rectus_femoris|^vastus_/, ['quadriceps_femoris', 'patellar_ligament']],
    [/^psoas_major|^iliacus/, ['iliopsoas']],
    [/^iliocostalis|^longissimus|^spinalis/, ['erector_spinae']],
    [/pubo-analis|pubococcygeus|iliococcygeus/, ['levator_ani']],
    [/flexor_carpi|palmaris_longus|pronator_teres|flexor_digitorum_superficialis/, ['common_flexor_tendon']],
    [/extensor_carpi_radialis_brevis|^extensor_digitorum$|extensor_digiti_minimi|extensor_carpi_ulnaris/, ['common_extensor_tendon']],
    [/^tendon_of_extensor_digitorum_longus/, ['extensor_digitorum_longus']],
    [/^iliotibial_tract/, ['tensor_fasciae_latae']],
    [/^adductor_minimus/, ['adductor_magnus']]
  ];
  function clesInsertion(en) {
    var k = nomMuscle(en), cles = {};
    cles[k] = true;
    var m = k.match(/^(?:.*?_)?(?:head|part|belly)_of_(.+)$/);
    if (m) cles[m[1]] = true;
    GROUPES_INS.forEach(function (g) { if (g[0].test(k)) g[1].forEach(function (c) { cles[c] = true; }); });
    return cles;
  }

  function majVisibilite() {
    var tr = etat.peauTransp;
    var sel = etat.sel;
    var modeIns = etat.insertions && sel && sel.couche === 'muscles';
    var clesIns = modeIns ? clesInsertion(sel.en) : null;
    for (var i = 0; i < meshes.length; i++) {
      var m = meshes[i]; if (!m) continue;
      var p = m.userData.p, v;
      if (p.couche === 'insertions') {
        v = !!(modeIns && clesIns[nomMuscle(p.muscle)] && (!sel.cote || p.cote === sel.cote));
        m.visible = v; continue;
      }
      var n = niveauPour(p);
      var dedans = n < 4 || tr;
      switch (p.couche) {
        case 'peau': v = etat.niveau === 4; break;
        case 'muscles': v = n === 4 ? tr : (n >= 1 && p.prof <= n); break;
        case 'os': v = etat.os && dedans; break;
        case 'ligaments': v = etat.ligaments && dedans; break;
        case 'capsules': v = etat.capsules && dedans; break;
        case 'fascias': v = etat.fascias && dedans; break;
        case 'nerfs': v = etat.nerfs && dedans; break;
        default: v = !!etat[p.couche] && dedans;
      }
      if (modeIns) {
        if (p.couche === 'muscles' || p.couche === 'fascias' || p.couche === 'peau') v = p.id === sel.id;
        if (p.couche === 'os') v = true;
      }
      if (etat.isole) v = !!etat.isole[p.id] || (modeIns && p.couche === 'os');
      if (etat.masques[p.id]) v = false;
      m.visible = v;
    }
    majEtat();
    demanderRendu();
  }

  // ---------- Sélection ----------
  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();

  function viser(x, y, pourDessin) {
    ndc.x = (x / window.innerWidth) * 2 - 1;
    ndc.y = -(y / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    var cibles = [];
    for (var i = 0; i < meshes.length; i++) {
      var m = meshes[i];
      if (!m || !m.visible) continue;
      var p = m.userData.p;
      if (p.couche === 'peau' && etat.peauTransp && !pourDessin) continue;
      if (p.couche === 'insertions' && pourDessin) continue;
      if (etat.transp[p.id] && !pourDessin) continue;
      cibles.push(m);
    }
    var res = raycaster.intersectObjects(cibles, false);
    return res.length ? res[0] : null;
  }

  function selectionnes() { var l = []; for (var k in etat.selection) l.push(etat.selection[k]); return l; }
  function rafraichirMateriaux(liste) { liste.forEach(function (q) { if (q && meshes[q.id]) meshes[q.id].material = materiauPour(q); }); }
  function choisir(p) {
    var anciens = selectionnes();
    if (!p) { etat.selection = {}; etat.sel = null; }
    else if (etat.multi) {
      if (etat.selection[p.id]) delete etat.selection[p.id]; else etat.selection[p.id] = p;
      var l = selectionnes(); etat.sel = l.length ? (etat.selection[p.id] ? p : l[l.length - 1]) : null;
    } else { etat.selection = {}; etat.selection[p.id] = p; etat.sel = p; }
    if (!etat.sel || etat.sel.couche !== 'muscles' || selectionnes().length > 1) etat.insertions = false;
    rafraichirMateriaux(anciens); rafraichirMateriaux(selectionnes());
    majCarte();
    majVisibilite();
  }

  var TYPES = { os: 'Os', muscles: 'Muscle', ligaments: 'Ligament', capsules: 'Capsule articulaire', fascias: 'Fascia', nerfs: 'Nerf', peau: 'Peau', insertions: 'Insertion',
    encephale: 'Encéphale', sens: 'Organe des sens', respiratoire: 'Appareil respiratoire', digestif: 'Appareil digestif', urinaire: 'Appareil urinaire',
    genital: 'Appareil génital', endocrinien: 'Glande endocrine', lymphatique: 'Système lymphatique' };
  function nomSecondaire(p) {
    if (etat.langue2 === 'la') return p.la || '';
    if (etat.langue2 === 'en') return p.en.replace(/[()]/g, '').replace(/_/g, ' ');
    return '';
  }
  function typeDe(p) {
    var en = p.en;
    if (p.couche === 'os') {
      if (/cartilage/i.test(en)) return 'Cartilage';
      if (/incisor|canine|molar/i.test(en)) return 'Dent';
      if (/Vertebra|Atlas|Axis/.test(en)) return 'Os — vertèbre';
      return 'Os';
    }
    if (p.couche === 'muscles') return /Tendon|tendon|aponeurosis|tract$/.test(en) ? 'Tendon / aponévrose' : 'Muscle — ' + ['', 'plan profond', 'plan moyen', 'plan superficiel'][p.prof || 1];
    if (p.couche === 'ligaments') {
      if (/disc|Nucleus/i.test(en)) return 'Disque';
      if (/meniscus$/i.test(en)) return 'Ménisque';
      if (/labrum/i.test(en)) return 'Labrum';
      if (/membrane/i.test(en)) return 'Membrane';
      return 'Ligament';
    }
    if (p.couche === 'nerfs') return /spinal_cord/i.test(en) ? 'Système nerveux central' : 'Nerf';
    if (p.couche === 'cardio') return /Heart|ventricle|atrium|valve|Cusp/i.test(en) ? 'Cœur' : /vein|Vena|sinus/i.test(en) ? 'Veine' : 'Artère';
    return TYPES[p.couche] || '';
  }
  function libCote(c) { return c === 'D' ? 'côté droit' : c === 'G' ? 'côté gauche' : ''; }

  var carte = document.getElementById('carte');
  function majCarte() {
    var p = etat.sel;
    if (!p) { carte.className = 'cache'; document.getElementById('legende-ins').className = 'cache'; return; }
    carte.className = '';
    var l = selectionnes(), plusieurs = l.length > 1;
    var nom = document.getElementById('carte-nom'), nom2 = document.getElementById('carte-nom2');
    if (plusieurs) {
      document.getElementById('carte-type').textContent = 'Sélection multiple';
      nom.textContent = l.length + ' structures';
      var s0 = document.createElement('small');
      s0.textContent = l.slice(-4).map(function (q) { return q.fr + (q.cote ? ' (' + q.cote + ')' : ''); }).join(' · ') + (l.length > 4 ? ' …' : '');
      nom.appendChild(s0); nom2.textContent = '';
    } else {
      document.getElementById('carte-type').textContent = typeDe(p);
      nom.textContent = p.fr;
      if (p.cote) { var s = document.createElement('small'); s.textContent = libCote(p.cote); nom.appendChild(s); }
      nom2.textContent = nomSecondaire(p);
    }
    var tousTransp = l.every(function (q) { return etat.transp[q.id]; });
    var bT = document.getElementById('b-transp');
    bT.textContent = tousTransp ? 'Opaque' : 'Transparent';
    bT.className = tousTransp ? 'actif' : '';
    var bIso = document.getElementById('b-isoler');
    bIso.textContent = etat.isole ? 'Tout montrer' : 'Isoler';
    bIso.className = etat.isole ? 'actif' : '';
    var bIns = document.getElementById('b-insertions');
    bIns.disabled = p.couche !== 'muscles' || plusieurs;
    bIns.className = etat.insertions ? 'actif' : '';
    var bF = document.getElementById('b-fiche');
    bF.disabled = plusieurs || !(fiches && fiches[p.en]);
    document.getElementById('legende-ins').className = etat.insertions ? '' : 'cache';
  }

  function majEtat() {
    var n = 0; for (var k in etat.masques) if (etat.masques[k]) n++;
    var nt = 0; for (var k2 in etat.transp) if (etat.transp[k2]) nt++;
    var el = document.getElementById('etat'), t = document.getElementById('etat-texte');
    var parts = [];
    if (etat.isole) parts.push(Object.keys(etat.isole).length > 1 ? 'Structures isolées' : 'Structure isolée');
    if (n) parts.push(n === 1 ? '1 masquée' : n + ' masquées');
    if (nt) parts.push(nt === 1 ? '1 transparente' : nt + ' transparentes');
    if (parts.length) { el.className = ''; t.textContent = parts.join(' · '); } else el.className = 'cache';
  }

  document.getElementById('b-desel').onclick = function () { choisir(null); };
  document.getElementById('b-isoler').onclick = function () {
    if (!etat.sel) return;
    if (etat.isole) etat.isole = null;
    else {
      etat.isole = {};
      var l = selectionnes();
      l.forEach(function (q) { etat.isole[q.id] = true; });
      if (l.length === 1) volerVers(l[0]);
    }
    majCarte(); majVisibilite();
  };
  document.getElementById('b-masquer').onclick = function () {
    if (!etat.sel) return;
    selectionnes().forEach(function (p) { etat.masques[p.id] = true; if (etat.isole) delete etat.isole[p.id]; });
    choisir(null);
  };
  document.getElementById('b-transp').onclick = function () {
    var l = selectionnes(); if (!l.length) return;
    var tous = l.every(function (q) { return etat.transp[q.id]; });
    l.forEach(function (q) { if (tous) delete etat.transp[q.id]; else etat.transp[q.id] = true; });
    if (!tous) { choisir(null); return; }
    rafraichirMateriaux(l); majCarte(); majVisibilite();
  };
  document.getElementById('b-insertions').onclick = function () {
    var p = etat.sel; if (!p || p.couche !== 'muscles') return;
    if (etat.insertions) { etat.insertions = false; meshes[p.id].material = materiauPour(p); majCarte(); majVisibilite(); return; }
    chargerInsertions().then(function () {
      etat.insertions = true;
      meshes[p.id].material = materiauPour(p);
      majCarte(); majVisibilite();
      var cles = clesInsertion(p.en), trouve = 0;
      M.pieces.forEach(function (q) { if (q.paquet === 'insertions' && cles[nomMuscle(q.muscle)] && (!p.cote || q.cote === p.cote)) trouve++; });
      if (!trouve) bulle('Pas de zone d’insertion dessinée pour ce muscle.', 2600);
    });
  };
  document.getElementById('b-etat').onclick = function () {
    var anciens = []; for (var k in etat.transp) anciens.push(M.pieces[k]);
    etat.isole = null; etat.masques = {}; etat.transp = {};
    rafraichirMateriaux(anciens); majCarte(); majVisibilite();
  };

  // ---------- Fiche ----------
  var ficheEl = document.getElementById('fiche');
  document.getElementById('b-fiche').onclick = function () {
    var p = etat.sel; if (!p || !fiches || !fiches[p.en]) return;
    var f = fiches[p.en];
    document.getElementById('fiche-titre').textContent = p.fr;
    var corps = document.getElementById('fiche-corps');
    corps.innerHTML = '';
    var n2 = nomSecondaire(p) || p.la;
    if (n2) { var la = document.createElement('p'); la.style.fontStyle = 'italic'; la.style.color = '#9aa6b2'; la.textContent = n2; corps.appendChild(la); }
    if (f.muscle) {
      var enc = document.createElement('div'); enc.className = 'encadre';
      [['Origine', f.muscle.o], ['Terminaison', f.muscle.t], ['Innervation', f.muscle.i], ['Action', f.muscle.a]].forEach(function (r) {
        var h = document.createElement('h3'); h.textContent = r[0]; enc.appendChild(h);
        var t = document.createElement('p'); t.textContent = r[1]; enc.appendChild(t);
      });
      corps.appendChild(enc);
    }
    (f.texte || '').split(/\n{2,}/).forEach(function (bloc) {
      bloc = bloc.trim(); if (!bloc) return;
      var mt = bloc.match(/^==+\s*(.+?)\s*==+$/);
      var el;
      if (mt) { el = document.createElement('h3'); el.textContent = mt[1]; }
      else { el = document.createElement('p'); el.textContent = bloc.replace(/\n/g, ' '); }
      corps.appendChild(el);
    });
    var src = document.createElement('p');
    src.className = 'source';
    src.textContent = (f.muscle ? 'Encadré : rédaction propre à l’application. ' : '') + (f.texte ? 'Description : Z-Anatomy / Wikipédia (CC BY-SA)' + (f.source ? ' — ' + decodeURIComponent(f.source.replace(/^https?:\/\//, '')) : '') : '');
    corps.appendChild(src);
    corps.scrollTop = 0;
    ficheEl.className = '';
  };
  document.getElementById('b-fiche-fermer').onclick = function () { ficheEl.className = 'cache'; };

  // ---------- Caméra ----------
  var anim = null;
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function animerCamera(cible, position, duree) {
    anim = {
      t0: performance.now(), d: duree || 650,
      c0: controls.target.clone(), c1: cible.clone(),
      p0: camera.position.clone(), p1: position.clone()
    };
    demanderRendu();
  }
  function etapeAnimation() {
    var t = Math.min(1, (performance.now() - anim.t0) / anim.d), e = ease(t);
    controls.target.lerpVectors(anim.c0, anim.c1, e);
    camera.position.lerpVectors(anim.p0, anim.p1, e);
    camera.lookAt(controls.target);
    if (t >= 1) anim = null;
  }
  function placer(cible, dir, dist, instant) {
    var d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    var pos = cible.clone().add(d.multiplyScalar(dist));
    if (instant) { controls.target.copy(cible); camera.position.copy(pos); controls.update(); demanderRendu(); }
    else animerCamera(cible, pos);
  }
  function volerVers(p) {
    var c = new THREE.Vector3(p.c[0], p.c[1], p.c[2]);
    var dir = camera.position.clone().sub(controls.target).normalize();
    var dist = Math.max(p.r * 3.4, 22);
    animerCamera(c, c.clone().add(dir.multiplyScalar(dist)));
  }
  function vueInitiale(anime) { placer(new THREE.Vector3(0, 76, 0), [0, 0.05, 1], 352, !anime); }

  // ---------- Vues ----------
  function centreDe(liste) {
    var s = new THREE.Vector3(), n = 0;
    liste.forEach(function (it) {
      M.pieces.forEach(function (p) {
        if (p.en === it[0] && (!it[1] || p.cote === it[1]) && p.couche !== 'insertions') { s.x += p.c[0]; s.y += p.c[1]; s.z += p.c[2]; n++; }
      });
    });
    return n ? s.divideScalar(n) : new THREE.Vector3(0, 92, 0);
  }
  var VUES_CORPS = [
    { nom: 'Face', dir: [0, 0.05, 1] }, { nom: 'Dos', dir: [0, 0.05, -1] },
    { nom: 'Profil droit', dir: [-1, 0.05, 0] }, { nom: 'Profil gauche', dir: [1, 0.05, 0] }
  ];
  // cible : liste [nom, côté] ; côté « X » remplacé par D ou G ; dir donnée pour le côté droit
  var REGIONS = [
    { nom: 'Tête et cou', cible: [['Mandible'], ['Vertebra_C4']], dir: [0.35, 0.1, 1], dist: 62 },
    { nom: 'ATM (mâchoire)', cible: [['Articular_disc_of_temporomandibular_joint', 'X']], dir: [-1, 0.05, 0.3], dist: 30, cotes: true },
    { nom: 'Cervicales', cible: [['Vertebra_C4']], dir: [0, 0.15, -1], dist: 46 },
    { nom: 'Épaule', cible: [['Scapula', 'X'], ['Clavicle', 'X']], dir: [-0.55, 0.25, 0.8], dist: 58, cotes: true },
    { nom: 'Coude', cible: [['Humerus', 'X'], ['Ulna', 'X']], dir: [-0.3, 0.1, 1], dist: 46, cotes: true },
    { nom: 'Poignet et main', cible: [['Capitate_bone', 'X']], dir: [-0.15, 0.15, 1], dist: 34, cotes: true },
    { nom: 'Thorax', cible: [['Body_of_sternum']], dir: [0, 0.1, 1], dist: 95 },
    { nom: 'Rachis dorsal', cible: [['Vertebra_T7']], dir: [0, 0.1, -1], dist: 85 },
    { nom: 'Lombaires', cible: [['Vertebra_L3']], dir: [0, 0.1, -1], dist: 60 },
    { nom: 'Bassin et sacrum', cible: [['Sacrum']], dir: [0, 0.18, -1], dist: 68 },
    { nom: 'Abdomen', cible: [['Vertebra_L3']], dir: [0, 0.05, 1], dist: 82 },
    { nom: 'Hanche', cible: [['Hip_bone', 'X']], dir: [-0.8, 0.05, 0.6], dist: 62, cotes: true },
    { nom: 'Genou', cible: [['Patella', 'X']], dir: [-0.35, 0.1, 1], dist: 46, cotes: true },
    { nom: 'Cheville et pied', cible: [['Talus', 'X']], dir: [-0.7, 0.35, 0.6], dist: 44, cotes: true }
  ];
  function allerRegion(r, cote) {
    var cible = centreDe(r.cible.map(function (it) { return [it[0], it[1] === 'X' ? cote : it[1]]; }));
    var dir = r.dir.slice();
    if (cote === 'G') dir[0] = -dir[0];
    placer(cible, dir, r.dist, false);
    fermerPanneaux();
  }
  function construireVues() {
    var vc = document.getElementById('vues-corps');
    VUES_CORPS.forEach(function (v) {
      var b = document.createElement('button'); b.textContent = v.nom;
      b.onclick = function () { placer(new THREE.Vector3(0, 76, 0), v.dir, 352, false); fermerPanneaux(); };
      vc.appendChild(b);
    });
    var vr = document.getElementById('vues-regions');
    REGIONS.forEach(function (r) {
      if (!r.cotes) {
        var b = document.createElement('button'); b.textContent = r.nom;
        b.onclick = function () { allerRegion(r, ''); };
        vr.appendChild(b);
      } else {
        var d = document.createElement('div'); d.className = 'region';
        var n = document.createElement('div'); n.className = 'nom'; n.textContent = r.nom; d.appendChild(n);
        var cs = document.createElement('div'); cs.className = 'cotes';
        [['D', 'Droit'], ['G', 'Gauche']].forEach(function (c) {
          var b = document.createElement('button'); b.textContent = c[1];
          b.onclick = function () { allerRegion(r, c[0]); };
          cs.appendChild(b);
        });
        d.appendChild(cs); vr.appendChild(d);
      }
    });
    afficherMesVues();
  }

  // Vues personnelles (mémorisées sur cet iPad)
  var CLE_VUES = 'anatomie3d.vues';
  function lireVues() { try { return JSON.parse(localStorage.getItem(CLE_VUES) || '[]'); } catch (e) { return []; } }
  function ecrireVues(l) { try { localStorage.setItem(CLE_VUES, JSON.stringify(l)); return true; } catch (e) { return false; } }
  function afficherMesVues() {
    var el = document.getElementById('mes-vues'); el.innerHTML = '';
    var l = lireVues();
    if (!l.length) { var v = document.createElement('div'); v.className = 'vide'; v.textContent = 'Aucune vue mémorisée pour l’instant.'; el.appendChild(v); return; }
    l.forEach(function (vue, i) {
      var d = document.createElement('div'); d.className = 'vue';
      var a = document.createElement('button'); a.className = 'aller'; a.textContent = vue.nom;
      a.onclick = function () { appliquerVue(vue); fermerPanneaux(); };
      var s = document.createElement('button'); s.className = 'suppr'; s.textContent = '×'; s.title = 'Supprimer';
      s.onclick = function () { if (confirm('Supprimer la vue « ' + vue.nom + ' » ?')) { var l2 = lireVues(); l2.splice(i, 1); ecrireVues(l2); afficherMesVues(); } };
      d.appendChild(a); d.appendChild(s); el.appendChild(d);
    });
  }
  document.getElementById('b-memoriser').onclick = function () {
    var l = lireVues();
    var nom = prompt('Nom de cette vue :', 'Vue ' + (l.length + 1));
    if (!nom) return;
    l.push({
      nom: nom, cam: camera.position.toArray(), cible: controls.target.toArray(),
      niveau: etat.niveau, cote: etat.cote, bascules: BASCULES.filter(function (b) { return etat[b]; }),
      masques: Object.keys(etat.masques), isole: etat.isole ? Object.keys(etat.isole) : null, transp: Object.keys(etat.transp)
    });
    if (ecrireVues(l)) { afficherMesVues(); bulle('Vue « ' + nom + ' » mémorisée.', 1800); }
    else bulle('Impossible d’enregistrer sur cet appareil.', 2500);
  };
  function appliquerVue(v) {
    choisir(null);
    etat.niveau = v.niveau; etat.cote = v.cote || '';
    var anciensT = []; for (var k in etat.transp) anciensT.push(M.pieces[k]);
    if (v.bascules) BASCULES.forEach(function (b) { etat[b] = v.bascules.indexOf(b) >= 0; });
    else { etat.os = true; ['ligaments', 'capsules', 'fascias', 'nerfs', 'peauTransp'].forEach(function (b) { etat[b] = !!v[b]; }); }
    etat.transp = {}; (v.transp || []).forEach(function (id) { etat.transp[id] = true; });
    etat.masques = {}; (v.masques || []).forEach(function (id) { etat.masques[id] = true; });
    etat.isole = null; if (v.isole) { etat.isole = {}; v.isole.forEach(function (id) { etat.isole[id] = true; }); }
    synchroniserCommandes();
    if (meshes[peauId()]) meshes[peauId()].material = materiauPour(M.pieces[peauId()]);
    rafraichirMateriaux(anciensT); rafraichirMateriaux((v.transp || []).map(function (id) { return M.pieces[id]; }));
    chargerSystemesActifs();
    majVisibilite();
    animerCamera(new THREE.Vector3().fromArray(v.cible), new THREE.Vector3().fromArray(v.cam));
  }
  function peauId() { for (var i = 0; i < M.pieces.length; i++) if (M.pieces[i].couche === 'peau') return M.pieces[i].id; return -1; }

  // ---------- Couches (commandes) ----------
  var crans = document.querySelectorAll('#crans button');
  function synchroniserCommandes() {
    for (var i = 0; i < crans.length; i++) crans[i].className = (+crans[i].getAttribute('data-n') === etat.niveau) ? 'actif' : '';
    var cb = document.querySelectorAll('#cote-epluche button');
    for (var j = 0; j < cb.length; j++) cb[j].className = cb[j].getAttribute('data-cote') === etat.cote ? 'actif' : '';
    BASCULES.forEach(function (b) { document.getElementById(idBascule(b)).checked = !!etat[b]; });
    var cl = document.querySelectorAll('#choix-langue button');
    for (var k = 0; k < cl.length; k++) cl[k].className = cl[k].getAttribute('data-l') === etat.langue2 ? 'actif' : '';
    document.getElementById('t-endoscope').checked = etat.endoscope;
  }
  function idBascule(b) { return b === 'peauTransp' ? 't-peau-transp' : 't-' + b; }
  function chargerSystemesActifs() {
    SYSTEMES.forEach(function (c) {
      if (etat[c] && PAQUET_DE[c] && !paquetsPrets[PAQUET_DE[c]]) chargerPaquet(PAQUET_DE[c]).then(majVisibilite, function () { etat[c] = false; synchroniserCommandes(); });
    });
  }
  for (var ci = 0; ci < crans.length; ci++) {
    crans[ci].onclick = function () {
      etat.niveau = +this.getAttribute('data-n');
      if (etat.isole) etat.isole = null;
      if (etat.sel && meshes[etat.sel.id] && !estVisibleSelonCouches(etat.sel)) choisir(null);
      synchroniserCommandes(); majCarte(); majVisibilite();
    };
  }
  function estVisibleSelonCouches(p) {
    var n = niveauPour(p);
    if (p.couche === 'muscles') return n >= 1 && n < 4 && p.prof <= n;
    if (p.couche === 'peau') return etat.niveau === 4;
    return n < 4 || etat.peauTransp;
  }
  var cbs = document.querySelectorAll('#cote-epluche button');
  for (var cj = 0; cj < cbs.length; cj++) {
    cbs[cj].onclick = function () { etat.cote = this.getAttribute('data-cote'); synchroniserCommandes(); majVisibilite(); };
  }
  BASCULES.forEach(function (b) {
    document.getElementById(idBascule(b)).onchange = function () {
      etat[b] = this.checked;
      if (b === 'peauTransp') { var id = peauId(); if (meshes[id]) meshes[id].material = materiauPour(M.pieces[id]); }
      if (etat[b] && etat.niveau === 4 && b !== 'peauTransp' && b !== 'os') { etat.niveau = 3; synchroniserCommandes(); }
      chargerSystemesActifs();
      majVisibilite();
    };
  });
  var cls2 = document.querySelectorAll('#choix-langue button');
  for (var cl3 = 0; cl3 < cls2.length; cl3++) {
    cls2[cl3].onclick = function () { etat.langue2 = this.getAttribute('data-l'); ecrirePref('langue2', etat.langue2); synchroniserCommandes(); majCarte(); };
  }
  function appliquerLumiere() {
    UNI.endo.value = etat.endoscope ? 1 : 0;
    demanderRendu();
  }
  document.getElementById('t-endoscope').onchange = function () { etat.endoscope = this.checked; appliquerLumiere(); };
  document.getElementById('t-fibres').checked = UNI.fibresOn.value === 1;
  document.getElementById('t-fibres').onchange = function () { UNI.fibresOn.value = this.checked ? 1 : 0; ecrirePref('fibres', this.checked ? '1' : '0'); demanderRendu(); };

  // ---------- Panneaux ----------
  var boutonsPanneau = document.querySelectorAll('[data-panneau]');
  function fermerPanneaux() {
    var ps = document.querySelectorAll('.panneau');
    for (var i = 0; i < ps.length; i++) ps[i].className = 'panneau';
    for (var j = 0; j < boutonsPanneau.length; j++) boutonsPanneau[j].className = boutonsPanneau[j].className.replace(' actif', '');
    document.body.className = document.body.className.replace(' panneau-ouvert', '');
    var ch = document.getElementById('champ-recherche'); if (ch) ch.blur();
  }
  for (var bp = 0; bp < boutonsPanneau.length; bp++) {
    boutonsPanneau[bp].onclick = function () {
      var id = this.getAttribute('data-panneau');
      var el = document.getElementById(id);
      var ouvert = el.className.indexOf('ouvert') >= 0;
      fermerPanneaux();
      if (etat.dessin) finDessin();
      if (etat.quiz && id !== 'p-vues' && id !== 'p-couches') finQuiz();
      if (!ouvert) {
        el.className = 'panneau ouvert'; this.className += ' actif'; document.body.className += ' panneau-ouvert';
        if (id === 'p-recherche') setTimeout(function () { document.getElementById('champ-recherche').focus(); }, 250);
      }
    };
  }

  document.getElementById('b-reinit').onclick = function () {
    fermerPanneaux(); if (etat.dessin) finDessin();
    choisir(null);
    if (etat.quiz) finQuiz();
    if (etat.multi) basculerMulti();
    etat.niveau = 3; etat.cote = '';
    BASCULES.forEach(function (b) { etat[b] = b === 'os'; });
    var anciensT = []; for (var k in etat.transp) anciensT.push(M.pieces[k]);
    etat.masques = {}; etat.isole = null; etat.transp = {};
    rafraichirMateriaux(anciensT);
    etat.endoscope = false; appliquerLumiere();
    var id = peauId(); if (meshes[id]) meshes[id].material = materiauPour(M.pieces[id]);
    effacerTout();
    ficheEl.className = 'cache';
    synchroniserCommandes(); majVisibilite(); vueInitiale(true);
  };

  // ---------- Recherche ----------
  var indexRecherche = [];
  function sansAccents(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function construireIndexRecherche() {
    var vus = {};
    M.pieces.forEach(function (p) {
      if (p.couche === 'insertions') return;
      var cle = p.en + '|' + p.cote;
      if (vus[cle]) return; vus[cle] = true;
      indexRecherche.push({ p: p, txt: sansAccents(p.fr + ' ' + p.en.replace(/_/g, ' ') + ' ' + (p.la || '')) });
    });
    indexRecherche.sort(function (a, b) { return a.p.fr.localeCompare(b.p.fr, 'fr') || a.p.cote.localeCompare(b.p.cote); });
  }
  var ORDRE_COUCHES = { muscles: 0, os: 1, ligaments: 2, nerfs: 3, fascias: 4, capsules: 5, peau: 6 };
  var champ = document.getElementById('champ-recherche');
  champ.addEventListener('input', function () {
    var q = sansAccents(champ.value.trim());
    var res = document.getElementById('resultats'); res.innerHTML = '';
    if (q.length < 2) return;
    var mots = q.split(/\s+/);
    var trouves = [];
    for (var i = 0; i < indexRecherche.length; i++) {
      var it = indexRecherche[i], ok = true;
      for (var j = 0; j < mots.length; j++) if (it.txt.indexOf(mots[j]) < 0) { ok = false; break; }
      if (!ok) continue;
      var fr = sansAccents(it.p.fr);
      var score = fr.indexOf(q) === 0 ? 0 : (' ' + fr).indexOf(' ' + mots[0]) >= 0 ? 1 : 2;
      trouves.push({ it: it, s: score * 10 + (it.p.couche in ORDRE_COUCHES ? ORDRE_COUCHES[it.p.couche] : 5), i: i });
    }
    trouves.sort(function (a, b) { return a.s - b.s || a.i - b.i; });
    var n = 0;
    for (var t = 0; t < trouves.length && n < 50; t++) {
      var it = trouves[t].it;
      n++;
      (function (p) {
        var b = document.createElement('button');
        b.textContent = p.fr;
        var s = document.createElement('small'); s.textContent = typeDe(p) + (p.cote ? ' · ' + libCote(p.cote) : '') + (nomSecondaire(p) ? ' · ' + nomSecondaire(p) : '');
        b.appendChild(s);
        b.onclick = function () { allerA(p); };
        res.appendChild(b);
      })(it.p);
    }
    if (!n) { var v = document.createElement('div'); v.className = 'vide'; v.textContent = 'Aucun résultat.'; res.appendChild(v); }
  });
  function allerA(p) {
    // rendre la structure visible si besoin
    etat.isole = null; delete etat.masques[p.id];
    if (p.couche === 'muscles') { if (etat.niveau === 4 || etat.niveau < p.prof) etat.niveau = p.prof; if (etat.cote && p.cote && p.cote !== etat.cote && p.prof < 3) etat.cote = ''; }
    else if (p.couche !== 'peau' && etat.niveau === 4) etat.niveau = 0;
    if (p.couche === 'os' && etat.niveau > 0) etat.niveau = 0;
    if (p.couche === 'ligaments') { etat.ligaments = true; if (etat.niveau > 0) etat.niveau = 0; }
    if (p.couche === 'capsules') etat.capsules = true;
    if (p.couche === 'fascias') etat.fascias = true;
    if (p.couche === 'nerfs') etat.nerfs = true;
    if (p.couche === 'os') etat.os = true;
    if (SYSTEMES.indexOf(p.couche) >= 0) { etat[p.couche] = true; if (etat.niveau === 4) etat.niveau = 0; }
    if (p.couche === 'encephale' || p.couche === 'sens') etat.os = false;
    if (etat.transp[p.id]) { delete etat.transp[p.id]; }
    synchroniserCommandes();
    fermerPanneaux();
    var pq = PAQUET_DE[p.couche];
    (pq ? chargerPaquet(pq) : Promise.resolve()).then(function () {
      if (etat.multi) basculerMulti();
      choisir(p);
      volerVers(p);
    });
  }

  // ---------- Gestes : toucher pour nommer ----------
  var debut = null;
  function posTouche(e) { var t = (e.changedTouches || e.touches) ? (e.changedTouches || e.touches)[0] : e; return { x: t.clientX, y: t.clientY }; }
  canvas.addEventListener('touchstart', function (e) {
    if (etat.dessin) return;
    if (e.touches.length === 1) { var p = posTouche(e); debut = { x: p.x, y: p.y, t: Date.now() }; } else debut = null;
  }, { passive: true });
  canvas.addEventListener('touchend', function (e) {
    if (etat.dessin || !debut || e.touches.length) return;
    var p = posTouche(e);
    if (Math.abs(p.x - debut.x) < 10 && Math.abs(p.y - debut.y) < 10 && Date.now() - debut.t < 400) toucher(p.x, p.y);
    debut = null;
  });
  // souris (ordinateur) : three.js bloque « mousedown », on écoute donc « pointer » quand il existe
  var EV_BAS = window.PointerEvent ? 'pointerdown' : 'mousedown', EV_HAUT = window.PointerEvent ? 'pointerup' : 'mouseup', EV_MVT = window.PointerEvent ? 'pointermove' : 'mousemove';
  function estSouris(e) { return !e.pointerType || e.pointerType === 'mouse'; }
  canvas.addEventListener(EV_BAS, function (e) { if (!etat.dessin && estSouris(e)) debut = { x: e.clientX, y: e.clientY, t: Date.now() }; });
  canvas.addEventListener(EV_HAUT, function (e) {
    if (etat.dessin || !debut || !estSouris(e)) return;
    if (Math.abs(e.clientX - debut.x) < 5 && Math.abs(e.clientY - debut.y) < 5 && Date.now() - debut.t < 400) toucher(e.clientX, e.clientY);
    debut = null;
  });
  function toucher(x, y) {
    if (document.querySelector('.panneau.ouvert')) { fermerPanneaux(); return; }
    var h = viser(x, y, false);
    if (etat.quiz) { reponseQuiz(h ? h.object.userData.p : null); return; }
    if (!h) { if (etat.sel && !etat.multi) choisir(null); return; }
    var p = h.object.userData.p;
    if (p.couche === 'insertions') { bulle((p.type === 'o' ? 'Origine' : 'Terminaison') + ' — ' + etat.sel.fr, 1800); return; }
    if (!etat.multi && etat.sel && etat.sel.id === p.id) return;
    choisir(p);
  }

  // ---------- Sélection multiple ----------
  function basculerMulti() {
    etat.multi = !etat.multi;
    document.getElementById('b-multi').className = 'outil' + (etat.multi ? ' actif' : '');
    if (etat.multi) bulle('Touchez plusieurs structures, puis utilisez Isoler, Masquer ou Transparent.', 2800);
    else if (selectionnes().length > 1) choisir(etat.sel);
  }
  document.getElementById('b-multi').onclick = function () { fermerPanneaux(); if (etat.quiz) finQuiz(); basculerMulti(); };

  // ---------- Quiz ----------
  function candidatsQuiz() {
    var w = window.innerWidth, h = window.innerHeight, v = new THREE.Vector3(), vus = {}, l = [];
    for (var i = 0; i < meshes.length; i++) {
      var m = meshes[i]; if (!m || !m.visible) continue;
      var p = m.userData.p;
      if (p.couche === 'peau' || p.couche === 'insertions' || etat.transp[p.id] || p.r < 2.5) continue;
      v.set(p.c[0], p.c[1], p.c[2]).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 0.85 || v.y > 0.8 || v.y < -0.4) continue;
      var x = (v.x + 1) / 2 * w; if (x < 90) continue;
      var cle = p.fr + '|' + p.cote; if (vus[cle]) continue; vus[cle] = true;
      l.push(p);
    }
    return l;
  }
  // tire une structure réellement visible (non cachée derrière une autre) : rayon depuis l'écran vers son centre
  function cibleVisible(l, precedente) {
    var w = window.innerWidth, h = window.innerHeight, v = new THREE.Vector3();
    var copie = l.slice();
    for (var essai = 0; essai < 30 && copie.length; essai++) {
      var p = copie.splice(Math.floor(Math.random() * copie.length), 1)[0];
      if (precedente && p.id === precedente.id) continue;
      v.set(p.c[0], p.c[1], p.c[2]).project(camera);
      var hit = viser((v.x + 1) / 2 * w, (1 - v.y) / 2 * h, false);
      if (hit && hit.object.userData.p.fr === p.fr && hit.object.userData.p.cote === p.cote) return hit.object.userData.p;
    }
    return null;
  }
  function nomQuiz(p) { return p.fr + (p.cote ? ' (' + libCote(p.cote) + ')' : ''); }
  function marquer(p, mat) {
    var q = etat.quiz; if (!q) return;
    var anciens = []; for (var k in q.marque) anciens.push(M.pieces[k]);
    q.marque = {}; if (p) q.marque[p.id] = mat;
    rafraichirMateriaux(anciens); if (p) rafraichirMateriaux([p]); demanderRendu();
  }
  function questionSuivante() {
    var q = etat.quiz; if (!q) return;
    marquer(null);
    var qEl = document.getElementById('quiz-question'), cEl = document.getElementById('quiz-choix');
    qEl.className = ''; cEl.innerHTML = '';
    var l = candidatsQuiz();
    var cible = l.length >= 4 ? cibleVisible(l, q.cible) : null;
    if (!cible) { qEl.textContent = 'Rapprochez-vous ou affichez plus de structures pour jouer.'; q.cible = null; return; }
    q.cible = cible; q.repondu = false;
    document.getElementById('quiz-score').textContent = q.bons + ' / ' + q.total;
    if (q.mode === 'ou') { qEl.textContent = 'Touchez : ' + nomQuiz(cible); return; }
    marquer(cible, 'cible');
    qEl.textContent = 'Quelle est la structure en orange ?';
    var choix = [cible];
    var autres = l.filter(function (p) { return p.fr !== cible.fr; });
    while (choix.length < 4 && autres.length) choix.push(autres.splice(Math.floor(Math.random() * autres.length), 1)[0]);
    choix.sort(function () { return Math.random() - 0.5; });
    choix.forEach(function (p) {
      var b = document.createElement('button'); b.textContent = nomQuiz(p);
      b.onclick = function () {
        if (q.repondu) return; q.repondu = true; q.total++;
        var ok = p.fr === cible.fr && p.cote === cible.cote;
        if (ok) q.bons++;
        b.className = ok ? 'bon' : 'faux';
        var bs = cEl.querySelectorAll('button');
        for (var i = 0; i < bs.length; i++) if (bs[i].textContent === nomQuiz(cible)) bs[i].className = 'bon';
        qEl.className = ok ? 'bon' : 'faux'; qEl.textContent = ok ? 'Bonne réponse !' : 'C’était : ' + nomQuiz(cible);
        document.getElementById('quiz-score').textContent = q.bons + ' / ' + q.total;
        setTimeout(questionSuivante, ok ? 1100 : 2200);
      };
      cEl.appendChild(b);
    });
  }
  function reponseQuiz(p) {
    var q = etat.quiz; if (!q || q.mode !== 'ou' || !q.cible || q.repondu) return;
    if (!p || p.couche === 'insertions') return;
    q.repondu = true; q.total++;
    var ok = p.fr === q.cible.fr && p.cote === q.cible.cote;
    var qEl = document.getElementById('quiz-question');
    if (ok) { q.bons++; marquer(p, 'bon'); qEl.className = 'bon'; qEl.textContent = 'Bravo : ' + nomQuiz(p); }
    else { marquer(q.cible, 'cible'); qEl.className = 'faux'; qEl.textContent = 'Non, c’est : ' + nomQuiz(p) + ' — la bonne réponse est en orange.'; }
    document.getElementById('quiz-score').textContent = q.bons + ' / ' + q.total;
    setTimeout(questionSuivante, ok ? 1100 : 2600);
  }
  function debutQuiz() {
    fermerPanneaux(); if (etat.dessin) finDessin(); if (etat.multi) basculerMulti();
    choisir(null);
    etat.quiz = { mode: etat.quiz ? etat.quiz.mode : 'ou', bons: 0, total: 0, cible: null, marque: {} };
    document.getElementById('b-quiz').className = 'outil actif';
    document.getElementById('barre-quiz').className = '';
    document.body.className += ' quiz';
    questionSuivante();
  }
  function finQuiz() {
    marquer(null);
    etat.quiz = null;
    document.getElementById('b-quiz').className = 'outil';
    document.getElementById('barre-quiz').className = 'cache';
    document.body.className = document.body.className.replace(' quiz', '');
  }
  document.getElementById('b-quiz').onclick = function () { if (etat.quiz) finQuiz(); else debutQuiz(); };
  document.getElementById('b-quiz-fin').onclick = finQuiz;
  document.getElementById('b-quiz-passer').onclick = function () { if (etat.quiz && etat.quiz.cible && !etat.quiz.repondu) etat.quiz.total++; questionSuivante(); };
  var modesQ = document.querySelectorAll('.quiz-modes button');
  for (var mq = 0; mq < modesQ.length; mq++) {
    modesQ[mq].onclick = function () {
      for (var k = 0; k < modesQ.length; k++) modesQ[k].className = '';
      this.className = 'actif';
      if (etat.quiz) { etat.quiz.mode = this.getAttribute('data-q'); questionSuivante(); }
    };
  }

  // ---------- Bulle d'information ----------
  var bulleEl = document.getElementById('bulle'), bulleT = null;
  function bulle(txt, ms) {
    bulleEl.textContent = txt; bulleEl.className = '';
    clearTimeout(bulleT);
    if (ms) bulleT = setTimeout(cacherBulle, ms);
  }
  function cacherBulle() { bulleEl.className = 'cache'; }

  // ---------- Dessin ----------
  var calque = document.getElementById('calque');
  var ctx = calque.getContext('2d');
  var traitsEcran = [];   // [{c, pts:[[x,y]...]}]
  var traitsCorps = [];   // objets THREE.Points
  var historique = [];    // 'e' ou 'c' pour annuler dans l'ordre
  var traitEnCours = null;

  var texturePoint = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(16, 16, 14, 0, Math.PI * 2); x.fill();
    var t = new THREE.CanvasTexture(c); return t;
  })();

  function debutDessin() {
    etat.dessin = true;
    fermerPanneaux();
    document.getElementById('b-dessin').className = 'outil actif';
    document.getElementById('barre-dessin').className = '';
    document.body.className += ' dessin';
    appliquerModeDessin();
  }
  function finDessin() {
    etat.dessin = false;
    document.getElementById('b-dessin').className = 'outil';
    document.getElementById('barre-dessin').className = 'cache';
    document.body.className = document.body.className.replace(' dessin-ecran', '').replace(' dessin', '');
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.enabled = true;
  }
  function appliquerModeDessin() {
    var corps = etat.modeDessin === 'corps';
    document.body.className = document.body.className.replace(' dessin-ecran', '') + (corps ? '' : ' dessin-ecran');
    controls.enabled = true;
    controls.touches.ONE = -1;            // un doigt dessine, deux doigts tournent / zooment
    controls.mouseButtons.LEFT = -1;
    document.getElementById('b-mode-trait').className = 'mode' + (corps ? ' actif' : '');
    document.getElementById('b-mode-ecran').className = 'mode' + (corps ? '' : ' actif');
  }
  document.getElementById('b-dessin').onclick = function () { if (etat.quiz) finQuiz(); if (etat.dessin) finDessin(); else debutDessin(); };
  document.getElementById('b-fin-dessin').onclick = finDessin;
  document.getElementById('b-mode-trait').onclick = function () { etat.modeDessin = 'corps'; appliquerModeDessin(); };
  document.getElementById('b-mode-ecran').onclick = function () {
    etat.modeDessin = 'ecran'; appliquerModeDessin();
    bulle('Les traits « sur l’écran » s’effacent dès qu’on tourne le corps.', 2600);
  };
  var couleursBtn = document.querySelectorAll('#barre-dessin .couleur');
  for (var cb2 = 0; cb2 < couleursBtn.length; cb2++) {
    couleursBtn[cb2].onclick = function () {
      for (var k = 0; k < couleursBtn.length; k++) couleursBtn[k].className = 'couleur';
      this.className = 'couleur actif'; etat.couleur = this.getAttribute('data-c');
    };
  }
  document.getElementById('b-annuler').onclick = function () {
    var dernier = historique.pop();
    if (dernier === 'e') { traitsEcran.pop(); redessinerEcran(); }
    else if (dernier === 'c') { var o = traitsCorps.pop(); if (o) { scene.remove(o); o.geometry.dispose(); o.material.dispose(); demanderRendu(); } }
  };
  function effacerTout() {
    traitsEcran = []; redessinerEcran();
    traitsCorps.forEach(function (o) { scene.remove(o); o.geometry.dispose(); o.material.dispose(); });
    traitsCorps = []; historique = []; demanderRendu();
  }
  document.getElementById('b-effacer').onclick = effacerTout;
  function effacerEcranSiBesoin() {
    if (traitsEcran.length && !etat.dessin) { traitsEcran = []; historique = historique.filter(function (h) { return h !== 'e'; }); redessinerEcran(); }
  }

  // --- dessin sur l'écran (calque 2D)
  function redessinerEcran() {
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.clearRect(0, 0, calque.width, calque.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 5;
    traitsEcran.forEach(function (t) {
      ctx.strokeStyle = t.c; ctx.beginPath();
      t.pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      if (t.pts.length === 1) ctx.lineTo(t.pts[0][0] + 0.1, t.pts[0][1]);
      ctx.stroke();
    });
  }
  function ecranDebut(x, y) { traitEnCours = { c: etat.couleur, pts: [[x, y]] }; traitsEcran.push(traitEnCours); historique.push('e'); redessinerEcran(); }
  function ecranSuite(x, y) { if (!traitEnCours) return; traitEnCours.pts.push([x, y]); redessinerEcran(); }

  // --- dessin collé au corps (points 3D)
  var MAX_PTS = 4000;
  var dernierPoint = null, dernierEcran = null;
  var vtmp = new THREE.Vector3(), ntmp = new THREE.Vector3(), mtmp = new THREE.Matrix3();
  function corpsDebut(x, y) {
    var geo = new THREE.BufferGeometry();
    var arr = new Float32Array(MAX_PTS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.setDrawRange(0, 0);
    var mat = new THREE.PointsMaterial({ color: etat.couleur, size: 9 * pr, sizeAttenuation: false, map: texturePoint, alphaTest: 0.5, transparent: false });
    var pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 5;
    scene.add(pts);
    traitsCorps.push(pts); historique.push('c');
    traitEnCours = { obj: pts, n: 0 };
    dernierPoint = null; dernierEcran = null;
    corpsSuite(x, y);
  }
  function ajouterPoint(v) {
    var t = traitEnCours; if (!t || t.n >= MAX_PTS) return;
    var a = t.obj.geometry.attributes.position;
    a.array[t.n * 3] = v.x; a.array[t.n * 3 + 1] = v.y; a.array[t.n * 3 + 2] = v.z;
    t.n++;
  }
  function corpsSuite(x, y) {
    if (!traitEnCours) return;
    if (dernierEcran && Math.abs(x - dernierEcran[0]) + Math.abs(y - dernierEcran[1]) < 3) return;
    dernierEcran = [x, y];
    var h = viser(x, y, true);
    if (!h) { dernierPoint = null; return; }
    mtmp.getNormalMatrix(h.object.matrixWorld);
    ntmp.copy(h.face.normal).applyMatrix3(mtmp).normalize();
    var v = h.point.clone().add(ntmp.multiplyScalar(0.35));
    if (dernierPoint) {
      var d = dernierPoint.distanceTo(v);
      var pas = 0.25;
      if (d < 12) for (var s = pas; s < d; s += pas) ajouterPoint(vtmp.copy(dernierPoint).lerp(v, s / d));
    }
    ajouterPoint(v);
    dernierPoint = v;
    var g = traitEnCours.obj.geometry;
    g.attributes.position.needsUpdate = true;
    g.setDrawRange(0, traitEnCours.n);
    demanderRendu();
  }

  function gestesDessin(el) {
    el.addEventListener('touchstart', function (e) {
      if (!etat.dessin) return;
      if (e.touches.length > 1) {
        // deuxième doigt : on navigue, on retire le petit trait commencé par erreur
        if (traitEnCours && traitEnCours.obj && traitEnCours.n < 6) document.getElementById('b-annuler').onclick();
        else if (traitEnCours && traitEnCours.pts && traitEnCours.pts.length < 4) document.getElementById('b-annuler').onclick();
        traitEnCours = null; return;
      }
      e.preventDefault();
      var p = posTouche(e);
      if (etat.modeDessin === 'corps') corpsDebut(p.x, p.y); else ecranDebut(p.x, p.y);
    }, { passive: false });
    el.addEventListener('touchmove', function (e) {
      if (!etat.dessin || e.touches.length > 1 || !traitEnCours) return;
      e.preventDefault();
      var t = e.touches[0];
      if (etat.modeDessin === 'corps') corpsSuite(t.clientX, t.clientY); else ecranSuite(t.clientX, t.clientY);
    }, { passive: false });
    el.addEventListener('touchend', function () { traitEnCours = null; });
    var souris = false;
    el.addEventListener(EV_BAS, function (e) {
      if (!etat.dessin || e.button !== 0 || !estSouris(e)) return; souris = true;
      if (etat.modeDessin === 'corps') corpsDebut(e.clientX, e.clientY); else ecranDebut(e.clientX, e.clientY);
    });
    window.addEventListener(EV_MVT, function (e) {
      if (!souris || !etat.dessin) return;
      if (etat.modeDessin === 'corps') corpsSuite(e.clientX, e.clientY); else ecranSuite(e.clientX, e.clientY);
    });
    window.addEventListener(EV_HAUT, function () { souris = false; traitEnCours = null; });
  }
  gestesDessin(canvas);
  gestesDessin(calque);

  // ---------- Divers ----------
  // empêcher le zoom de la page et le rebond sur iOS
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) {
    var t = e.target;
    while (t && t !== document.body) {
      if (t.id === 'fiche-corps' || (t.className && typeof t.className === 'string' && t.className.indexOf('panneau') >= 0)) return;
      t = t.parentNode;
    }
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('resize', redimensionner);
  window.addEventListener('orientationchange', function () { setTimeout(redimensionner, 300); });
  document.getElementById('version').textContent = 'Version ' + VERSION;

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  // Sonde de lecture pour les tests automatiques (aucun effet sur l'usage normal)
  var sonde = window.__anatomie = {
    pret: false, version: VERSION, etat: etat, camera: camera, controls: controls, renderer: renderer, scene: scene,
    manifeste: function () { return M; },
    visibles: function () { var n = 0; for (var i = 0; i < meshes.length; i++) if (meshes[i] && meshes[i].visible) n++; return n; },
    visiblesPar: function () { var r = {}; for (var i = 0; i < meshes.length; i++) { var m = meshes[i]; if (m && m.visible) { var c = m.userData.p.couche; r[c] = (r[c] || 0) + 1; } } return r; },
    viser: function (x, y) { var h = viser(x, y, false); return h ? { id: h.object.userData.p.id, en: h.object.userData.p.en, fr: h.object.userData.p.fr, couche: h.object.userData.p.couche } : null; },
    info: function () { renderer.render(scene, camera); return { appels: renderer.info.render.calls, triangles: renderer.info.render.triangles, pr: renderer.getPixelRatio(), w: canvas.width, h: canvas.height }; }
  };
  construireVues();
  synchroniserCommandes();
  redimensionner();
  demarrer();
})();
