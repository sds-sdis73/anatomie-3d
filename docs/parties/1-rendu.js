/* Anatomie 3D — application de visualisation pour le cabinet.
   Écrit pour Safari 12 (iPad mini 2, iOS 12) : pas de « ?. », pas de « ?? », pas d'Object.fromEntries,
   pas d'événements « pointer » pour nos propres gestes (on utilise touch + souris). */
(function () {
  'use strict';

  var VERSION = '1.3.0';
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
  var ORGANES = ['respiratoire', 'digestif', 'urinaire', 'genital', 'endocrinien'];
  var BASCULES = ['capsules', 'peauTransp'].concat(SYSTEMES);
  // Règle des couches, de la surface vers la profondeur
  var COUCHES = ['peau', 'fascias', 'ms', 'mm', 'mp', 'ligaments', 'os'];
  var NOMS_COUCHES = ['Peau', 'Fascias', 'Muscles superficiels', 'Muscles moyens', 'Muscles profonds', 'Ligaments', 'Os'];
  function yeuxParDefaut() { return { peau: true, fascias: false, ms: true, mm: true, mp: true, ligaments: false, os: true }; }

  // ---------- État ----------
  var etat = {
    regle: 2, yeux: yeuxParDefaut(), force: {}, seule: null, cote: '', capsules: false, nerfs: false, peauTransp: false,
    encephale: false, sens: false, cardio: false, respiratoire: false, digestif: false, urinaire: false, genital: false, endocrinien: false, lymphatique: false,
    masques: {}, isole: null, transp: {}, sel: null, selection: {}, multi: false, insertions: false, outil: 'nommer',
    dessin: false, modeDessin: 'corps', couleur: '#e03131', langue2: lirePref('langue2', ''), endoscope: false, quiz: null,
    coupe: null, region: 'corps'
  };
  function lirePref(k, d) { try { var v = localStorage.getItem('anatomie3d.' + k); return v === null ? d : v; } catch (e) { return d; } }
  function ecrirePref(k, v) { try { localStorage.setItem('anatomie3d.' + k, v); } catch (e) {} }
  function el(id) { return document.getElementById(id); }
  function classe(e, nom, on) { if (on) e.classList.add(nom); else e.classList.remove(nom); }
  function lireJSON(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return null; } }
  var M = null;              // manifeste du jeu de données chargé
  var meshes = [];           // par id
  var fiches = null;         // fiches descriptives (chargées en arrière-plan)
  var paquetsPrets = {}, paquetsEnCours = {};
  var groupe;                // groupe contenant tout le corps
  var jeu = { dossier: null, gen: 0 }; // jeu de données chargé ('' = corps entier, 'tronc/'…)
  var boite = null;          // boîte englobante du jeu chargé (pour la coupe)

  // ---------- Rendu ----------
  var canvas = el('scene');
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
        var f = el('fluidite'); if (f) f.textContent = 'Fluidité mesurée pendant le dernier geste : ' + derniereFluidite;
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
    if (document.body.classList.contains('sur-accueil')) { anim = null; return; } // rien à dessiner sous l'accueil
    if (anim) etapeAnimation();
    renderer.render(scene, camera);
    if (mesure) mesure.n++;
    placerEtiquette();
    if (anim) demanderRendu();
  }

  function redimensionner() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    UNI.ecran.value.set(w * pr, h * pr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    calque.width = w * pr; calque.height = h * pr;
    tailleEtiq = null;
    redessinerEcran();
    demanderRendu();
  }

  // ---------- Matériaux : rendu réaliste ----------
  // Éclairage studio précalculé (matcap), ombres de contact (attribut ao), fibres musculaires (attribut fs).
  var UNI = {
    matcap: { value: creerMatcap() },
    fibresOn: { value: lirePref('fibres', '1') === '1' ? 1 : 0 },
    endo: { value: 0 },
    ecran: { value: new THREE.Vector2(1024, 768) },
    coupe: { value: new THREE.Vector4(1, 0, 0, 1e6) } // plan de coupe : on écarte les points où dot(p, xyz) > w
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
  // Deux variantes du même shader : sans coupe (celle de la 1.2, inchangée) et avec coupe.
  // La variante avec coupe contient un « discard » : sur la puce de l'iPad mini 2, sa seule présence prive le GPU
  // de l'élimination des surfaces cachées ; on ne l'utilise donc que lorsqu'une coupe est posée.
  function construireFS(avecCoupe) {
    return [
      derivees ? '#extension GL_OES_standard_derivatives : enable' : '',
      'precision highp float;',
      'uniform sampler2D matcap; uniform float fibresOn, endo, opacite; uniform vec3 ajout; uniform vec2 ecran;',
      avecCoupe ? 'uniform vec4 coupe;' : '',
      'varying vec3 vN, vC, vP; varying float vAo, vT, vS;',
      'float h(float n) { return fract(sin(n * 0.1031 + 7.13) * 43758.5453); }',
      'float bruit(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h(i), h(i + 1.0), f); }',
      'void main() {',
      avecCoupe ? '  if (dot(vP, coupe.xyz) > coupe.w) discard;' : '',
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
      // face intérieure vue à travers la coupe : teinte unie de la tranche
      avecCoupe ? '  if (!gl_FrontFacing) col = vC * vec3(0.66, 0.6, 0.58) + ajout;' : '',
      '  if (endo > 0.5) {',
      '    vec2 d = gl_FragCoord.xy / ecran - 0.5; d.x *= ecran.x / ecran.y;',
      '    col *= mix(0.06, 1.45, smoothstep(0.45, 0.04, length(d)));',
      '  }',
      '  gl_FragColor = vec4(col, opacite);',
      '}'].join('\n');
  }
  var FS = construireFS(false), FS_COUPE = construireFS(true);
  function tissu(o) {
    o = o || {};
    var u = { matcap: UNI.matcap, fibresOn: UNI.fibresOn, endo: UNI.endo, ecran: UNI.ecran, coupe: UNI.coupe,
      opacite: { value: o.opacite || 1 }, ajout: { value: new THREE.Color(o.ajout || 0x000000) } };
    var m = new THREE.RawShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: u,
      transparent: !!o.transparent, depthWrite: o.depthWrite !== false, side: o.side || THREE.FrontSide });
    m.userData.cotePlein = !o.transparent && !o.side; // matériau opaque : montre sa tranche quand on coupe
    m.userData.side = m.side;
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
  var shaderCoupe = false;
  function basculerShaderCoupe(on) {
    if (on === shaderCoupe) return;
    shaderCoupe = on;
    for (var k in MAT) {
      var m = MAT[k];
      m.fragmentShader = on ? FS_COUPE : FS;
      m.side = on && m.userData.cotePlein ? THREE.DoubleSide : m.userData.side;
      m.needsUpdate = true;
    }
  }
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
