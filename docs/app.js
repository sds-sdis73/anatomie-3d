/* Anatomie 3D — application de visualisation pour le cabinet.
   Écrit pour Safari 12 (iPad mini 2, iOS 12) : pas de « ?. », pas de « ?? », pas d'Object.fromEntries,
   pas d'événements « pointer » pour nos propres gestes (on utilise touch + souris). */
(function () {
  'use strict';

  var VERSION = '1.3.0';
  // Version des DONNÉES des régions, distincte de celle de l'appli (même valeur dans sw.js) : une mise à jour de l'appli
  // n'efface pas les régions déjà gardées sur l'iPad. À changer seulement quand les fichiers des régions changent.
  var DONNEES_REGIONS = '1.3.0';
  var CACHE_REGIONS = 'anatomie3d-regions-' + DONNEES_REGIONS;
  function versionPour(dossier) { return dossier ? DONNEES_REGIONS : VERSION; }
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
    tailleEtiq = null; largCouches = -1;
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
      // près du plan de coupe, les creux mis à nu (canal vertébral, intérieur du crâne) gardaient l'ombre calculée pour le
      // corps fermé et paraissaient noirs : on relève cette ombre sur les 4 cm qui bordent la coupe
      avecCoupe ? '  occ = mix(occ, max(occ, 0.8), 1.0 - smoothstep(0.0, 4.0, coupe.w - dot(vP, coupe.xyz)));' : '',
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

  // ---------- Chargement ----------
  function progression(frac, texte) {
    var w = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
    el('barre-prog').style.width = w; el('accueil-barre').style.width = w;
    if (texte) { el('texte-prog').textContent = texte; el('accueil-texte').textContent = texte; }
  }

  // Téléchargement. « attendu » : taille minimale d'un fichier binaire d'après le manifeste ; une réponse plus courte
  // (page HTML servie à la place, fichier tronqué) est refusée au lieu de faire planter la construction.
  // « groupe » : liste où ranger la requête pour pouvoir l'abandonner.
  function erreur(texte, statut) { var e = new Error(texte); e.statut = statut || 0; return e; }
  function charger(url, type, progres, attendu, groupe) {
    return new Promise(function (ok, ko) {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.responseType = type;
      x.onprogress = function (e) { if (progres) progres(e.loaded, e.lengthComputable ? e.total : 0); };
      x.onload = function () {
        var rep = x.response;
        if (!(x.status === 200 || (x.status === 0 && rep))) return ko(erreur(url + ' : ' + x.status, x.status));
        if (type === 'json' && (rep === null || typeof rep !== 'object')) { rep = lireJSON(rep); if (!rep || typeof rep !== 'object') return ko(erreur('Fichier illisible : ' + url, -1)); }
        if (type === 'arraybuffer' && (!rep || (attendu && rep.byteLength < attendu))) return ko(erreur('Fichier incomplet ou illisible : ' + url, -1));
        ok(rep);
      };
      x.onerror = function () { ko(erreur('Réseau : ' + url, 0)); };
      x.onabort = function () { var e = erreur('abandon', 0); e.abandon = true; ko(e); };
      if (groupe) groupe.push(x);
      x.send();
    });
  }
  function tailleMin(nom) { // fin de la dernière pièce d'un paquet dans son fichier
    var t = 0;
    M.pieces.forEach(function (p) { if (p.paquet === nom) t = Math.max(t, p.o + p.ob[0] + p.ob[1] + p.ob[2] + p.ic * (p.u32 ? 4 : 2)); });
    return t;
  }
  var MSG_HORS_LIGNE = 'Ce contenu n’est pas disponible hors connexion.';

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
    if (PAQUETS.indexOf(p.paquet) >= 0 && p.couche !== 'insertions') etendreContenu(pos, p.vc);
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

  // Étendue réelle de ce qui est affiché à l'ouverture (sommets, en unités quantifiées puis en cm), pour le cadrage
  var contenu = null;
  function etendreContenu(pos, n) {
    if (!contenu) contenu = [[32767, 32767, 32767], [-32768, -32768, -32768]];
    for (var i = 0; i < n * 3; i += 3) for (var k = 0; k < 3; k++) {
      var q = pos[i + k]; if (q < contenu[0][k]) contenu[0][k] = q; if (q > contenu[1][k]) contenu[1][k] = q;
    }
  }
  function boiteContenu() {
    if (!contenu || !M) return null;
    return [0, 1].map(function (j) { return [0, 1, 2].map(function (k) { return Math.round((contenu[j][k] * M.echelle + M.centre[k]) * 10) / 10; }); });
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
  // Libère le jeu de données affiché (mémoire de l'iPad : on n'en garde jamais deux à la fois)
  function viderJeu() {
    // tout ce qui désigne des pièces de l'ancien jeu (numéros, positions) devient faux : on l'efface
    if (etat.quiz) finQuiz();
    if (etat.dessin) finDessin();
    effacerTout();
    fermerMenu();
    el('resultats').innerHTML = ''; el('champ-recherche').value = '';
    ficheEl.classList.add('cache');
    jeu.gen++;
    for (var i = 0; i < meshes.length; i++) if (meshes[i]) meshes[i].geometry.dispose();
    if (groupe) scene.remove(groupe);
    meshes = []; paquetsPrets = {}; paquetsEnCours = {}; AO = { os: null, muscles: null, fs: null, off: {} };
    fiches = null; indexRecherche = []; M = null; boite = null; jeu.dossier = null; contenu = null;
    etat.selection = {}; etat.sel = null; etat.masques = {}; etat.isole = null; etat.transp = {}; etat.insertions = false;
    majEtiquette();
  }
  function calculerBoite() {
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    M.pieces.forEach(function (p) {
      if (p.couche === 'peau' || p.couche === 'insertions') return;
      for (var i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p.c[i] - p.r); mx[i] = Math.max(mx[i], p.c[i] + p.r); }
    });
    return { min: { x: mn[0], y: mn[1], z: mn[2] }, max: { x: mx[0], y: mx[1], z: mx[2] } };
  }
  var jeuVoulu = null;     // jeu demandé par l'utilisateur (null : pas encore de choix ; undefined : région en cours de recherche)
  var jeuEnCours = null, requetesJeu = [];
  var V_JEU = VERSION;     // version des fichiers du jeu chargé
  // Le jeu en cours de chargement n'est plus celui qu'on attend : on l'abandonne entre deux étapes
  function jeuAbandonne(dossier) { return jeuVoulu !== null && jeuVoulu !== undefined && jeuVoulu !== dossier; }
  function abandonnerSiInutile() {
    if (jeuEnCours !== null && jeuAbandonne(jeuEnCours)) { var l = requetesJeu; requetesJeu = []; l.forEach(function (x) { try { x.abort(); } catch (e) {} }); }
  }
  function verifierJeu(dossier, gen) {
    if (gen !== jeu.gen || jeuAbandonne(dossier)) { var e = erreur('abandon', 0); e.abandon = true; throw e; }
  }
  function chargerJeu(dossier, manifesteDeja) {
    sonde.pret = false;
    viderJeu();
    var gen = jeu.gen;
    jeuEnCours = dossier; requetesJeu = [];
    DONNEES = 'donnees/' + dossier;
    V_JEU = versionPour(dossier);
    var tailles = {}, recus = {};
    function maj() {
      var t = 0, r = 0;
      for (var k in tailles) { t += tailles[k]; r += recus[k] || 0; }
      progression(0.1 + (t ? r / t : 0) * 0.85);
    }
    el('accueil-prog').classList.remove('pret');
    progression(0.05, 'Chargement du modèle…');
    return (manifesteDeja ? Promise.resolve(manifesteDeja) : charger(DONNEES + 'manifeste.json?v=' + V_JEU, 'json', null, 0, requetesJeu)).then(function (man) {
      verifierJeu(dossier, gen);
      M = lireJSON(man);
      if (!M || !M.pieces) throw erreur('manifeste illisible', -1);
      groupe = new THREE.Group();
      groupe.scale.setScalar(M.echelle);
      groupe.position.set(M.centre[0], M.centre[1], M.centre[2]);
      groupe.updateMatrix();
      scene.add(groupe);
      M.pieces.forEach(function (p) { if (PAQUETS.indexOf(p.paquet) >= 0) tailles[p.paquet] = Math.max(tailles[p.paquet] || 0, p.o + p.ob[0] + p.ob[1] + p.ob[2] + p.ic * (p.u32 ? 4 : 2)); });
      var presents = PAQUETS.filter(function (n) { return tailles[n]; }); // une région peut ne pas avoir de peau, de nerfs…
      var details = Promise.all(['ao-os', 'ao-muscles', 'fibres-s'].map(function (n) {
        return charger(DONNEES + n + '.bin?v=' + V_JEU, 'arraybuffer', null, 0, requetesJeu).catch(function () { return null; });
      })).then(function (b) { preparerAO({ os: b[0], muscles: b[1], fs: b[2] }); });
      return Promise.all([details].concat(presents.map(function (nom) {
        return charger(DONNEES + nom + '.bin?v=' + V_JEU, 'arraybuffer', function (l) { recus[nom] = l; maj(); }, tailles[nom], requetesJeu).then(function (buf) {
          recus[nom] = tailles[nom]; maj();
          return { nom: nom, buf: buf };
        });
      }))).then(function (r) { return r.slice(1); });
    }).then(function (res) {
      verifierJeu(dossier, gen);
      progression(0.95, 'Construction du modèle…');
      var parPaquet = {};
      res.forEach(function (r) { parPaquet[r.nom] = r.buf; });
      // construction en plusieurs passes pour laisser respirer l'affichage ; une erreur dans un lot est rattrapée
      var liste = M.pieces.filter(function (p) { return parPaquet[p.paquet]; });
      var i = 0;
      return new Promise(function (ok, ko) {
        (function lot() {
          try {
            verifierJeu(dossier, gen);
            var fin = Math.min(liste.length, i + 120);
            for (; i < fin; i++) construireMesh(liste[i], parPaquet[liste[i].paquet]);
            progression(0.95 + 0.05 * i / Math.max(1, liste.length));
          } catch (e) { ko(e); return; }
          if (i < liste.length) setTimeout(lot, 0); else ok();
        })();
      });
    }).then(function () {
      PAQUETS.forEach(function (n) { paquetsPrets[n] = true; });
      jeu.dossier = dossier; jeuEnCours = null; requetesJeu = [];
      boite = calculerBoite();
      majVuesRegions();
      majVisibilite();
      charger(DONNEES + 'fiches.json?v=' + V_JEU, 'json').then(function (f) {
        if (gen === jeu.gen) { fiches = lireJSON(f); majEtiquette(); }
      }, function () {});
      construireIndexRecherche();
      el('accueil-prog').classList.add('pret');
      progression(1, 'Modèle prêt.');
      sonde.journal.push(dossier);
      sonde.pret = true;
      if (dossier) garderRegion(dossier);
    }, function (e) {
      // jeu inutilisable : on le libère pour que le suivant parte d'un état propre
      if (gen === jeu.gen) { jeuEnCours = null; requetesJeu = []; viderJeu(); }
      throw e;
    });
  }
  // File d'attente : un seul jeu de données chargé à la fois ; un échec ne la bloque pas
  var fileJeu = Promise.resolve();
  function assurerJeu(dossier, manifesteDeja) {
    var suite = fileJeu.catch(function () {}).then(function () {
      if (jeu.dossier === dossier && M) return;
      return chargerJeu(dossier, manifesteDeja);
    });
    fileJeu = suite.catch(function () {});
    return suite;
  }

  // ---------- Régions gardées pour le hors connexion ----------
  // Une région ouverte en ligne est téléchargée entière, en arrière-plan, dans un cache à part.
  // Tout ou rien : si un enregistrement échoue (quota de Safari ≈ 50 Mo), on retire toute la région du cache.
  var gardes = {}; // dossier → 'en cours' | 'complète' | 'échec'
  function fichiersRegion(dossier) {
    var paq = {}, l = ['manifeste.json', 'fiches.json', 'ao-os.bin', 'ao-muscles.bin', 'fibres-s.bin'];
    M.pieces.forEach(function (p) { paq[p.paquet] = true; });
    return l.concat(Object.keys(paq).map(function (n) { return n + '.bin'; })).map(function (f) { return 'donnees/' + dossier + f + '?v=' + DONNEES_REGIONS; });
  }
  function garderRegion(dossier) {
    if (!window.caches || gardes[dossier] === 'en cours' || gardes[dossier] === 'complète') return;
    var urls = fichiersRegion(dossier), cache = null;
    gardes[dossier] = 'en cours';
    caches.open(CACHE_REGIONS).then(function (c) {
      cache = c;
      return Promise.all(urls.map(function (u) { return c.match(u); }));
    }).then(function (deja) {
      var manquants = urls.filter(function (u, i) { return !deja[i]; });
      // un fichier après l'autre : la mémoire de l'iPad mini 2 est comptée
      return manquants.reduce(function (suite, u) {
        return suite.then(function () {
          return fetch(u).then(function (rep) {
            if (!rep.ok) throw erreur('absent : ' + u, rep.status);
            return cache.put(u, rep).catch(function () { var e = erreur('mémoire pleine', -2); e.quota = true; throw e; });
          });
        });
      }, Promise.resolve());
    }).then(function () { gardes[dossier] = 'complète'; }, function (e) {
      gardes[dossier] = 'échec';
      if (cache) urls.forEach(function (u) { cache['delete'](u).catch(function () {}); });
      if (e && e.quota) bulle('Mémoire de l’iPad insuffisante : cette région restera disponible seulement en ligne.', 4500);
    });
  }

  var NOMS_PAQUETS = { insertions: 'des insertions', cardio: 'du cœur et des vaisseaux', visceres: 'des viscères', lymphatique: 'du système lymphatique', encephale: 'de l’encéphale', sens: 'de l’œil et de l’oreille' };
  function chargerPaquet(nom) {
    if (paquetsPrets[nom]) return Promise.resolve();
    if (paquetsEnCours[nom]) return paquetsEnCours[nom];
    var gen = jeu.gen;
    var aucune = !M.pieces.some(function (p) { return p.paquet === nom; });
    if (aucune) { paquetsPrets[nom] = true; return Promise.resolve(); } // ce jeu n'a aucune pièce de ce paquet
    bulle('Chargement ' + (NOMS_PAQUETS[nom] || '') + '…', 0);
    paquetsEnCours[nom] = charger(DONNEES + nom + '.bin?v=' + V_JEU, 'arraybuffer', null, tailleMin(nom)).then(function (buf) {
      if (gen !== jeu.gen) return; // le jeu de données a changé entre-temps
      var faits = [];
      try {
        M.pieces.forEach(function (p) { if (p.paquet === nom) { construireMesh(p, buf); meshes[p.id].visible = false; faits.push(p.id); } });
      } catch (e) { // fichier abîmé : on retire ce qui a été construit
        faits.forEach(function (id) { groupe.remove(meshes[id]); meshes[id].geometry.dispose(); meshes[id] = undefined; });
        throw e;
      }
      paquetsPrets[nom] = true;
      delete paquetsEnCours[nom];
      cacherBulle();
    }).catch(function (e) {
      if (gen === jeu.gen) delete paquetsEnCours[nom]; // un nouvel essai reste possible
      bulle(MSG_HORS_LIGNE, 3500);
      throw e;
    });
    return paquetsEnCours[nom];
  }
  function chargerInsertions() { return chargerPaquet('insertions'); }

  // ---------- Visibilité ----------
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

  // Rang d'une pièce sur la règle des couches (0 = peau … 6 = os ; -1 = système)
  function rangDe(p) {
    switch (p.couche) {
      case 'peau': return 0;
      case 'fascias': return 1;
      case 'muscles': return p.prof === 1 ? 4 : p.prof === 2 ? 3 : 2;
      case 'ligaments': case 'capsules': return 5;
      case 'os': return 6;
    }
    return -1;
  }
  // La couche i est-elle présente (pour une pièce de ce côté) ? L'autre côté que celui épluché garde ses muscles superficiels.
  function presente(i, cote) {
    var c = COUCHES[i];
    if (!etat.yeux[c]) return false;
    if (etat.force[c]) return true;
    var r = etat.regle;
    if (etat.cote && cote && cote !== etat.cote && r > 2) r = 2;
    return i >= r;
  }
  function peauCouvre() { return etat.regle === 0 && etat.yeux.peau && !etat.peauTransp; }
  function visibleSelonCouches(p) {
    var dedans = !peauCouvre();
    switch (p.couche) {
      case 'peau': return presente(0, p.cote);
      case 'muscles': case 'fascias': case 'ligaments': case 'os': return dedans && presente(rangDe(p), p.cote);
      case 'capsules': return etat.capsules && dedans && presente(5, p.cote);
      case 'insertions': return false;
    }
    return !!etat[p.couche] && dedans;
  }
  // Ancien « niveau » (4 = peau … 0 = squelette), gardé pour les vues mémorisées
  function niveauActuel() { var r = etat.regle; return r === 0 ? 4 : r <= 2 ? 3 : r === 3 ? 2 : r === 4 ? 1 : 0; }
  function regleDeNiveau(n) { return { 4: 0, 3: 2, 2: 3, 1: 4, 0: 5 }[n] !== undefined ? { 4: 0, 3: 2, 2: 3, 1: 4, 0: 5 }[n] : 2; }
  // Pièce entièrement au-delà du plan de coupe : inutile de la dessiner
  function coupee(p) {
    if (!etat.coupe) return false;
    var n = UNI.coupe.value;
    return p.c[0] * n.x + p.c[1] * n.y + p.c[2] * n.z - n.w > p.r;
  }

  function majVisibilite() {
    var sel = etat.sel;
    var modeIns = etat.insertions && sel && sel.couche === 'muscles';
    var clesIns = modeIns ? clesInsertion(sel.en) : null;
    for (var i = 0; i < meshes.length; i++) {
      var m = meshes[i]; if (!m) continue;
      var p = m.userData.p, v;
      if (p.couche === 'insertions') {
        v = !!(modeIns && clesIns[nomMuscle(p.muscle)] && (!sel.cote || p.cote === sel.cote));
        m.visible = v && !coupee(p); continue;
      }
      v = visibleSelonCouches(p);
      if (modeIns) {
        if (p.couche === 'muscles' || p.couche === 'fascias' || p.couche === 'peau') v = p.id === sel.id;
        if (p.couche === 'os') v = true;
      }
      if (etat.isole) v = !!etat.isole[p.id] || (modeIns && p.couche === 'os');
      if (etat.masques[p.id]) v = false;
      if (v && coupee(p)) v = false;
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
    if (!etat.coupe) return res.length ? res[0] : null;
    // la partie coupée ne se touche pas et ne se dessine pas
    var n = UNI.coupe.value;
    for (var k = 0; k < res.length; k++) {
      var q = res[k].point;
      if (q.x * n.x + q.y * n.y + q.z * n.z <= n.w + 0.05) return res[k];
    }
    return null;
  }

  function selectionnes() { var l = []; for (var k in etat.selection) l.push(etat.selection[k]); return l; }
  function rafraichirMateriaux(liste) { liste.forEach(function (q) { if (q && meshes[q.id]) meshes[q.id].material = materiauPour(q); }); }
  var ancre = new THREE.Vector3();  // point 3D où l'étiquette est accrochée
  function choisir(p, point) {
    var anciens = selectionnes();
    if (!p) { etat.selection = {}; etat.sel = null; }
    else if (etat.multi) {
      if (etat.selection[p.id]) delete etat.selection[p.id]; else etat.selection[p.id] = p;
      var l = selectionnes(); etat.sel = l.length ? (etat.selection[p.id] ? p : l[l.length - 1]) : null;
    } else { etat.selection = {}; etat.selection[p.id] = p; etat.sel = p; }
    if (p) { if (point) ancre.copy(point); else ancre.set(p.c[0], p.c[1], p.c[2]); }
    if (!etat.sel || etat.sel.couche !== 'muscles' || selectionnes().length > 1) etat.insertions = false;
    rafraichirMateriaux(anciens); rafraichirMateriaux(selectionnes());
    majEtiquette();
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

  // ---------- Étiquette accrochée ----------
  var etiq = el('etiquette'), fil = el('fil'), filTrait = el('fil-trait'), filPoint = el('fil-point');
  var tailleEtiq = null, largCouches = -1, vEtiq = new THREE.Vector3();
  function majEtiquette() {
    var p = etat.sel;
    if (!p) { etiq.classList.add('cache'); fil.classList.add('cache'); el('legende-ins').classList.add('cache'); return; }
    var l = selectionnes(), plusieurs = l.length > 1;
    var nom = el('etiq-nom'), nom2 = el('etiq-nom2');
    if (plusieurs) {
      el('etiq-type').textContent = 'Sélection multiple';
      nom.textContent = l.length + ' structures';
      var s0 = document.createElement('small');
      s0.textContent = l.slice(-4).map(function (q) { return q.fr + (q.cote ? ' (' + q.cote + ')' : ''); }).join(' · ') + (l.length > 4 ? ' …' : '');
      nom.appendChild(s0); nom2.textContent = '';
    } else {
      el('etiq-type').textContent = typeDe(p) + (p.cote ? ' · ' + libCote(p.cote) : '');
      nom.textContent = p.fr;
      nom2.textContent = nomSecondaire(p);
    }
    var bIso = el('b-isoler');
    bIso.textContent = etat.isole ? 'Tout montrer' : 'Isoler';
    classe(bIso, 'actif', !!etat.isole);
    var bIns = el('b-insertions');
    classe(bIns, 'cache', p.couche !== 'muscles' || plusieurs);
    classe(bIns, 'actif', etat.insertions);
    el('b-fiche').disabled = plusieurs || !(fiches && fiches[p.en]);
    classe(el('legende-ins'), 'cache', !etat.insertions);
    etiq.classList.remove('cache');
    tailleEtiq = null;
    placerEtiquette();
    majOutils();
  }
  // Place l'étiquette près de la structure et trace le trait vers le point touché (appelé à chaque image)
  function placerEtiquette() {
    if (!etat.sel || etiq.classList.contains('cache')) return;
    var W = window.innerWidth, H = window.innerHeight;
    if (!tailleEtiq) tailleEtiq = [etiq.offsetWidth, etiq.offsetHeight];
    var w = tailleEtiq[0], h = tailleEtiq[1];
    vEtiq.copy(ancre).project(camera);
    var devant = vEtiq.z < 1 && Math.abs(vEtiq.x) < 1.3 && Math.abs(vEtiq.y) < 1.3;
    var px = (vEtiq.x + 1) / 2 * W, py = (1 - vEtiq.y) / 2 * H;
    if (largCouches < 0) largCouches = el('couches').offsetWidth; // lu une fois par taille d'écran, pas à chaque image
    var larg = largCouches;
    var gauche = 12, droite = Math.max(gauche, W - (larg ? larg + 24 : 12) - w), haut = 74, bas = Math.max(haut, H - 92 - h);
    var aGauche = px - 70 - w >= gauche;
    var lx = aGauche ? px - 70 - w : px + 70, ly = py - h / 2 - 50;
    lx = Math.max(gauche, Math.min(droite, lx)); ly = Math.max(haut, Math.min(bas, ly));
    etiq.style.transform = 'translate3d(' + Math.round(lx) + 'px,' + Math.round(ly) + 'px,0)';
    var dedans = px > lx - 4 && px < lx + w + 4 && py > ly - 4 && py < ly + h + 4;
    if (!devant || dedans) { fil.classList.add('cache'); return; }
    var sx = aGauche ? lx + w : lx, sy = ly + 24, mx = sx + (px > sx ? 22 : -22);
    filTrait.setAttribute('points', sx + ',' + sy + ' ' + mx + ',' + sy + ' ' + px.toFixed(1) + ',' + py.toFixed(1));
    filPoint.setAttribute('cx', px.toFixed(1)); filPoint.setAttribute('cy', py.toFixed(1));
    fil.classList.remove('cache');
  }

  function majEtat() {
    var n = 0; for (var k in etat.masques) if (etat.masques[k]) n++;
    var nt = 0; for (var k2 in etat.transp) if (etat.transp[k2]) nt++;
    var e = el('etat'), t = el('etat-texte');
    var parts = [];
    if (etat.isole) parts.push(Object.keys(etat.isole).length > 1 ? 'Structures isolées' : 'Structure isolée');
    if (n) parts.push(n === 1 ? '1 masquée' : n + ' masquées');
    if (nt) parts.push(nt === 1 ? '1 transparente' : nt + ' transparentes');
    if (parts.length) { e.classList.remove('cache'); t.textContent = parts.join(' · '); } else e.classList.add('cache');
  }

  // ---------- Actions sur la sélection ----------
  function isolerSelection(forcer) {
    if (!etat.sel) return;
    if (etat.isole && !forcer) etat.isole = null;
    else {
      etat.isole = {};
      var l = selectionnes();
      l.forEach(function (q) { etat.isole[q.id] = true; });
      if (l.length === 1) volerVers(l[0]);
    }
    majEtiquette(); majVisibilite(); majOutils();
  }
  // plus aucune structure isolée (on vient de masquer la dernière) : on sort de l'isolement au lieu d'un écran vide
  function isoleVide() { if (etat.isole && !Object.keys(etat.isole).length) etat.isole = null; }
  function masquerSelection() {
    if (!etat.sel) return;
    selectionnes().forEach(function (p) { etat.masques[p.id] = true; if (etat.isole) delete etat.isole[p.id]; });
    isoleVide();
    choisir(null);
  }
  function transpSelection() {
    var l = selectionnes(); if (!l.length) return;
    var tous = l.every(function (q) { return etat.transp[q.id]; });
    l.forEach(function (q) { if (tous) delete etat.transp[q.id]; else etat.transp[q.id] = true; });
    if (!tous) { choisir(null); return; }
    rafraichirMateriaux(l); majEtiquette(); majVisibilite();
  }
  function toutReafficher() {
    var anciens = []; for (var k in etat.transp) anciens.push(M.pieces[k]);
    etat.isole = null; etat.masques = {}; etat.transp = {};
    rafraichirMateriaux(anciens); majEtiquette(); majVisibilite(); majOutils();
  }
  el('b-desel').onclick = function () { choisir(null); };
  el('b-isoler').onclick = function () { isolerSelection(false); };
  el('b-masquer').onclick = masquerSelection;
  el('b-insertions').onclick = function () {
    var p = etat.sel; if (!p || p.couche !== 'muscles') return;
    if (etat.insertions) { etat.insertions = false; meshes[p.id].material = materiauPour(p); majEtiquette(); majVisibilite(); return; }
    chargerInsertions().then(function () {
      if (etat.sel !== p) return;
      etat.insertions = true;
      meshes[p.id].material = materiauPour(p);
      majEtiquette(); majVisibilite();
      var cles = clesInsertion(p.en), trouve = 0;
      M.pieces.forEach(function (q) { if (q.paquet === 'insertions' && cles[nomMuscle(q.muscle)] && (!p.cote || q.cote === p.cote)) trouve++; });
      if (!trouve) bulle('Pas de zone d’insertion dessinée pour ce muscle.', 2600);
    }, function () {}); // l'échec est déjà annoncé par une bulle ; un nouvel essai reste possible
  };
  el('b-etat').onclick = toutReafficher;

  // ---------- Fiche ----------
  var ficheEl = el('fiche');
  function ouvrirFiche(p) {
    if (!p || !fiches || !fiches[p.en]) return;
    var f = fiches[p.en];
    el('fiche-titre').textContent = p.fr;
    var corps = el('fiche-corps');
    corps.innerHTML = '';
    var n2 = nomSecondaire(p) || p.la;
    if (n2) { var la = document.createElement('p'); la.style.fontStyle = 'italic'; la.style.color = '#9aa3ad'; la.textContent = n2; corps.appendChild(la); }
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
      var e;
      if (mt) { e = document.createElement('h3'); e.textContent = mt[1]; }
      else { e = document.createElement('p'); e.textContent = bloc.replace(/\n/g, ' '); }
      corps.appendChild(e);
    });
    var src = document.createElement('p');
    src.className = 'source';
    src.textContent = (f.muscle ? 'Encadré : rédaction propre à l’application. ' : '') + (f.texte ? 'Description : Z-Anatomy / Wikipédia (CC BY-SA)' + (f.source ? ' — ' + decodeURIComponent(f.source.replace(/^https?:\/\//, '')) : '') : '');
    corps.appendChild(src);
    corps.scrollTop = 0;
    ficheEl.classList.remove('cache');
  }
  el('b-fiche').onclick = function () { ouvrirFiche(etat.sel); };
  el('b-fiche-fermer').onclick = function () { ficheEl.classList.add('cache'); };

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
    if (instant) { anim = null; controls.target.copy(cible); camera.position.copy(pos); controls.update(); demanderRendu(); }
    else animerCamera(cible, pos);
  }
  function volerVers(p) {
    var c = new THREE.Vector3(p.c[0], p.c[1], p.c[2]);
    var dir = camera.position.clone().sub(controls.target).normalize();
    var dist = Math.max(p.r * 3.4, 22);
    animerCamera(c, c.clone().add(dir.multiplyScalar(dist)));
  }
  // Double toucher : centrer sur le point touché et rapprocher
  function doubleToucher(x, y) {
    if (etat.quiz || etat.dessin) return;
    var h = viser(x, y, false); if (!h) return;
    var p = h.object.userData.p;
    var dcur = camera.position.distanceTo(controls.target);
    var d = Math.max(controls.minDistance, Math.min(dcur * 0.55, Math.max(p.r * 3, 20)));
    var dir = camera.position.clone().sub(controls.target).normalize();
    var c = h.point.clone();
    animerCamera(c, c.clone().add(dir.multiplyScalar(d)), 550);
    if (p.couche !== 'insertions' && !etat.multi && etat.outil === 'nommer' && (!etat.sel || etat.sel.id !== p.id)) choisir(p, h.point);
    else if (etat.sel && etat.sel.id === p.id) ancre.copy(h.point);
  }

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
    var vc = el('vues-corps');
    VUES_CORPS.forEach(function (v) {
      var b = document.createElement('button'); b.textContent = v.nom;
      b.onclick = function () { fermerPanneaux(); cadrerRegion(false, v.dir); };
      vc.appendChild(b);
    });
    afficherMesVues();
  }
  // Une vue de région n'est proposée que si toutes ses pièces existent dans le jeu chargé (sinon la caméra viserait le vide)
  function pieceExiste(en, cote) {
    for (var i = 0; i < M.pieces.length; i++) { var p = M.pieces[i]; if (p.en === en && (!cote || p.cote === cote) && p.couche !== 'insertions') return true; }
    return false;
  }
  function vueDisponible(r) {
    return r.cible.every(function (it) { return it[1] === 'X' ? pieceExiste(it[0], 'D') && pieceExiste(it[0], 'G') : pieceExiste(it[0], it[1]); });
  }
  function majVuesRegions() {
    var vr = el('vues-regions');
    vr.innerHTML = '';
    if (!M) return;
    REGIONS.filter(vueDisponible).forEach(function (r) {
      if (!r.cotes) {
        var b = document.createElement('button'); b.textContent = r.nom;
        b.onclick = function () { allerRegion(r, ''); };
        vr.appendChild(b);
      } else {
        var d = document.createElement('div'); d.className = 'region';
        var n = document.createElement('div'); n.className = 'nom'; n.textContent = r.nom; d.appendChild(n);
        var cs = document.createElement('div'); cs.className = 'cotes';
        [['D', 'Droit'], ['G', 'Gauche']].forEach(function (c) {
          var b2 = document.createElement('button'); b2.textContent = c[1];
          b2.onclick = function () { allerRegion(r, c[0]); };
          cs.appendChild(b2);
        });
        d.appendChild(cs); vr.appendChild(d);
      }
    });
  }

  // Vues personnelles (mémorisées sur cet iPad)
  var CLE_VUES = 'anatomie3d.vues';
  function lireVues() { try { return JSON.parse(localStorage.getItem(CLE_VUES) || '[]'); } catch (e) { return []; } }
  function ecrireVues(l) { try { localStorage.setItem(CLE_VUES, JSON.stringify(l)); return true; } catch (e) { return false; } }
  function afficherMesVues() {
    var e = el('mes-vues'); e.innerHTML = '';
    var l = lireVues();
    if (!l.length) { var v = document.createElement('div'); v.className = 'vide'; v.textContent = 'Aucune vue mémorisée pour l’instant.'; e.appendChild(v); return; }
    l.forEach(function (vue, i) {
      var d = document.createElement('div'); d.className = 'vue';
      var a = document.createElement('button'); a.className = 'aller'; a.textContent = vue.nom;
      a.onclick = function () { fermerPanneaux(); appliquerVue(vue); };
      var s = document.createElement('button'); s.className = 'suppr'; s.textContent = '×'; s.title = 'Supprimer';
      s.onclick = function () { if (confirm('Supprimer la vue « ' + vue.nom + ' » ?')) { var l2 = lireVues(); l2.splice(i, 1); ecrireVues(l2); afficherMesVues(); } };
      d.appendChild(a); d.appendChild(s); e.appendChild(d);
    });
  }
  function copie(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }
  el('b-memoriser').onclick = function () {
    var l = lireVues();
    var nom = prompt('Nom de cette vue :', 'Vue ' + (l.length + 1));
    if (!nom) return;
    l.push({
      nom: nom, cam: camera.position.toArray(), cible: controls.target.toArray(), region: etat.region, jeu: jeu.dossier,
      niveau: niveauActuel(), regle: etat.regle, yeux: copie(etat.yeux), force: copie(etat.force), cote: etat.cote,
      bascules: BASCULES.filter(function (b) { return etat[b]; }), coupe: etat.coupe ? copie(etat.coupe) : null,
      masques: Object.keys(etat.masques), isole: etat.isole ? Object.keys(etat.isole) : null, transp: Object.keys(etat.transp)
    });
    if (ecrireVues(l)) { afficherMesVues(); bulle('Vue « ' + nom + ' » mémorisée.', 1800); }
    else bulle('Impossible d’enregistrer sur cet appareil.', 2500);
  };
  function appliquerVue(v) {
    var d = v.jeu || '';
    var avant = d === jeu.dossier ? Promise.resolve() : entrerRegion(v.region || 'corps');
    return avant.then(function () {
      var memeJeu = d === jeu.dossier; // sinon (région absente), les numéros de pièces ne correspondent plus
      choisir(null);
      if (typeof v.regle === 'number') { etat.regle = v.regle; etat.yeux = copie(v.yeux || yeuxParDefaut()); etat.force = copie(v.force || {}); }
      else { // vue enregistrée avec la version 1.2
        etat.regle = regleDeNiveau(v.niveau); etat.yeux = yeuxParDefaut(); etat.force = {};
        var b0 = v.bascules || [];
        etat.yeux.os = v.bascules ? b0.indexOf('os') >= 0 : true;
        etat.yeux.ligaments = b0.indexOf('ligaments') >= 0 || !!v.ligaments;
        etat.yeux.fascias = b0.indexOf('fascias') >= 0 || !!v.fascias;
      }
      etat.seule = null;
      etat.cote = v.cote || '';
      var anciensT = []; for (var k in etat.transp) anciensT.push(M.pieces[k]);
      BASCULES.forEach(function (b) { etat[b] = (v.bascules || []).indexOf(b) >= 0; });
      etat.transp = {}; etat.masques = {}; etat.isole = null;
      if (memeJeu) {
        (v.transp || []).forEach(function (id) { if (M.pieces[id]) etat.transp[id] = true; });
        (v.masques || []).forEach(function (id) { etat.masques[id] = true; });
        if (v.isole) { etat.isole = {}; v.isole.forEach(function (id) { etat.isole[id] = true; }); }
      }
      if (meshes[peauId()]) meshes[peauId()].material = materiauPour(M.pieces[peauId()]);
      rafraichirMateriaux(anciensT); rafraichirMateriaux(Object.keys(etat.transp).map(function (id) { return M.pieces[id]; }));
      etat.coupe = v.coupe ? copie(v.coupe) : null;
      synchroniserCommandes();
      chargerSystemesActifs();
      appliquerCoupe();
      animerCamera(new THREE.Vector3().fromArray(v.cible), new THREE.Vector3().fromArray(v.cam));
    });
  }
  function peauId() { for (var i = 0; i < M.pieces.length; i++) if (M.pieces[i].couche === 'peau') return M.pieces[i].id; return -1; }

  // ---------- Règle des couches ----------
  var HAUT_RANG = 34;
  var regleEl = el('regle'), rangsEl = regleEl.querySelector('.rangs');
  var rangsDom = regleEl.querySelectorAll('.rang');
  function synchroniserCommandes() {
    el('regle-curseur').style.top = (etat.regle * HAUT_RANG - 9) + 'px';
    el('regle-plein').style.height = ((6 - etat.regle) * HAUT_RANG) + 'px';
    for (var i = 0; i < rangsDom.length; i++) {
      var c = COUCHES[i];
      classe(rangsDom[i], 'ote', i < etat.regle && !etat.force[c]);
      classe(rangsDom[i], 'seule', !!(etat.seule && etat.seule.i === i));
      classe(rangsDom[i].querySelector('.oeil'), 'on', presente(i, ''));
    }
    var os = document.querySelectorAll('#systemes .oeil');
    for (var j = 0; j < os.length; j++) {
      var s = os[j].getAttribute('data-s');
      if (s === 'organes') {
        var n = ORGANES.filter(function (o) { return etat[o]; }).length;
        classe(os[j], 'on', n === ORGANES.length); classe(os[j], 'partiel', n > 0 && n < ORGANES.length);
      } else classe(os[j], 'on', !!etat[s]);
    }
    var cb = document.querySelectorAll('#cote-epluche button');
    for (var k = 0; k < cb.length; k++) classe(cb[k], 'actif', cb[k].getAttribute('data-cote') === etat.cote);
    var cl = document.querySelectorAll('#choix-langue button');
    for (var m = 0; m < cl.length; m++) classe(cl[m], 'actif', cl[m].getAttribute('data-l') === etat.langue2);
    el('t-endoscope').checked = etat.endoscope;
    el('t-peau-transp').checked = etat.peauTransp;
    el('t-capsules').checked = etat.capsules;
  }
  function apresChangementCouches() {
    if (etat.sel && meshes[etat.sel.id] && !visibleSelonCouches(etat.sel) && !etat.isole) choisir(null);
    synchroniserCommandes(); majEtiquette(); majVisibilite();
  }
  // Sortie du mode « seule couche » (appui long) : on retrouve les couches telles qu'elles étaient
  function quitterSeule() {
    if (!etat.seule) return;
    etat.yeux = etat.seule.yeux; etat.force = etat.seule.force; etat.seule = null;
  }
  function regler(r) {
    r = Math.max(0, Math.min(6, r));
    if (r === etat.regle && !Object.keys(etat.force).length && !etat.seule) return;
    quitterSeule();
    etat.regle = r; etat.force = {};
    if (etat.isole) etat.isole = null;
    apresChangementCouches();
  }
  function basculerOeil(c) {
    var i = COUCHES.indexOf(c);
    if (presente(i, '')) { etat.yeux[c] = false; delete etat.force[c]; }
    else { etat.yeux[c] = true; if (i < etat.regle) etat.force[c] = true; }
    apresChangementCouches();
  }
  // Appui long sur une couche : n'afficher qu'elle ; un second appui long rétablit tout
  function seuleCouche(i) {
    if (etat.seule) {
      etat.regle = etat.seule.regle; etat.yeux = etat.seule.yeux; etat.force = etat.seule.force; etat.seule = null;
      bulle('Toutes les couches sont rétablies.', 1600);
    } else {
      etat.seule = { i: i, regle: etat.regle, yeux: copie(etat.yeux), force: copie(etat.force) };
      etat.regle = i; etat.force = {};
      COUCHES.forEach(function (c, k) { etat.yeux[c] = k === i; });
      bulle('Seulement : ' + NOMS_COUCHES[i].toLowerCase() + '. Appui long pour tout rétablir.', 2200);
    }
    if (etat.isole) etat.isole = null;
    apresChangementCouches();
  }
  var yeuxDom = regleEl.querySelectorAll('.oeil');
  for (var yi = 0; yi < yeuxDom.length; yi++) yeuxDom[yi].onclick = function () { basculerOeil(this.getAttribute('data-c')); };

  // Glisser le doigt sur la règle : un seul geste enlève ou remet les couches
  var glisse = null;
  function rangSous(y) { var r = rangsEl.getBoundingClientRect(); return Math.max(0, Math.min(6, Math.floor((y - r.top) / HAUT_RANG))); }
  function estOeil(t) { return t && t.classList && t.classList.contains('oeil'); }
  function regleDebut(y) {
    if (glisse) clearTimeout(glisse.minuterie);
    glisse = { y0: y, i0: rangSous(y), bouge: false, long: false };
    var g = glisse;
    g.minuterie = setTimeout(function () { if (glisse === g && !g.bouge) { g.long = true; seuleCouche(g.i0); } }, 600);
  }
  function regleSuite(y) {
    if (!glisse || glisse.long) return;
    if (!glisse.bouge && Math.abs(y - glisse.y0) < 6) return;
    glisse.bouge = true; clearTimeout(glisse.minuterie);
    regler(rangSous(y));
  }
  function regleFin(annule) {
    if (!glisse) return;
    clearTimeout(glisse.minuterie);
    if (!annule && !glisse.bouge && !glisse.long) regler(glisse.i0);
    glisse = null;
  }
  regleEl.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1 || estOeil(e.target)) return;
    e.preventDefault(); regleDebut(e.touches[0].clientY);
  }, { passive: false });
  regleEl.addEventListener('touchmove', function (e) { if (glisse) { e.preventDefault(); regleSuite(e.touches[0].clientY); } }, { passive: false });
  regleEl.addEventListener('touchend', function () { regleFin(false); });
  regleEl.addEventListener('touchcancel', function () { regleFin(true); });

  // ---------- Systèmes, côté, réglages ----------
  function chargerSystemesActifs() {
    SYSTEMES.forEach(function (c) {
      if (etat[c] && PAQUET_DE[c] && !paquetsPrets[PAQUET_DE[c]]) chargerPaquet(PAQUET_DE[c]).then(majVisibilite, function () { etat[c] = false; synchroniserCommandes(); });
    });
  }
  function systemePresent(c) { return M.pieces.some(function (p) { return p.couche === c; }); }
  function basculerSysteme(s) {
    var allume;
    if (s === 'organes') {
      var dispo = ORGANES.filter(systemePresent);
      var tous = dispo.length && dispo.every(function (o) { return etat[o]; });
      dispo.forEach(function (o) { etat[o] = !tous; }); allume = !tous && dispo.length > 0;
      if (!dispo.length) { bulle('Non disponible dans cette région.', 2200); synchroniserCommandes(); return; }
    } else if (!etat[s] && !systemePresent(s)) { // ex. l'encéphale dans le tronc
      bulle('Non disponible dans cette région.', 2200); synchroniserCommandes(); return;
    } else { etat[s] = !etat[s]; allume = etat[s]; }
    if (allume && peauCouvre()) etat.regle = 2;
    chargerSystemesActifs();
    apresChangementCouches();
  }
  var yeuxSys = document.querySelectorAll('#systemes .oeil');
  for (var ys = 0; ys < yeuxSys.length; ys++) yeuxSys[ys].onclick = function () { basculerSysteme(this.getAttribute('data-s')); };
  el('b-organes').onclick = function () {
    var o = el('organes'), ouvert = o.classList.contains('cache');
    classe(o, 'cache', !ouvert); classe(el('organes-fleche'), 'ouvert', ouvert);
  };
  var cbs = document.querySelectorAll('#cote-epluche button');
  for (var cj = 0; cj < cbs.length; cj++) {
    cbs[cj].onclick = function () { etat.cote = this.getAttribute('data-cote'); apresChangementCouches(); };
  }
  el('t-peau-transp').onchange = function () {
    etat.peauTransp = this.checked;
    var id = peauId(); if (meshes[id]) meshes[id].material = materiauPour(M.pieces[id]);
    majVisibilite();
  };
  el('t-capsules').onchange = function () {
    etat.capsules = this.checked;
    if (etat.capsules && peauCouvre()) etat.regle = 2;
    apresChangementCouches();
  };
  var cls2 = document.querySelectorAll('#choix-langue button');
  for (var cl3 = 0; cl3 < cls2.length; cl3++) {
    cls2[cl3].onclick = function () { etat.langue2 = this.getAttribute('data-l'); ecrirePref('langue2', etat.langue2); synchroniserCommandes(); majEtiquette(); };
  }
  function appliquerLumiere() {
    UNI.endo.value = etat.endoscope ? 1 : 0;
    demanderRendu();
  }
  el('t-endoscope').onchange = function () { etat.endoscope = this.checked; appliquerLumiere(); };
  el('t-fibres').checked = UNI.fibresOn.value === 1;
  el('t-fibres').onchange = function () { UNI.fibresOn.value = this.checked ? 1 : 0; ecrirePref('fibres', this.checked ? '1' : '0'); demanderRendu(); };

  // ---------- Panneaux ----------
  var boutonsPanneau = document.querySelectorAll('[data-panneau]');
  function fermerPanneaux() {
    var ps = document.querySelectorAll('.panneau');
    for (var i = 0; i < ps.length; i++) ps[i].classList.remove('ouvert');
    for (var j = 0; j < boutonsPanneau.length; j++) boutonsPanneau[j].classList.remove('actif');
    document.body.classList.remove('panneau-ouvert');
    var ch = el('champ-recherche'); if (ch) ch.blur();
  }
  function ouvrirPanneau(id) {
    var p = el(id), ouvert = p.classList.contains('ouvert');
    fermerPanneaux(); fermerMenu();
    if (etat.dessin) finDessin();
    if (etat.quiz && id === 'p-recherche') finQuiz();
    if (ouvert) return;
    p.classList.add('ouvert'); document.body.classList.add('panneau-ouvert');
    var b = document.querySelector('[data-panneau="' + id + '"]'); if (b) b.classList.add('actif');
    // focus dans le même geste que le toucher : sinon iOS 12 n'ouvre pas le clavier
    if (id === 'p-recherche') el('champ-recherche').focus();
    if (id === 'p-reglages') el('b-quiz').textContent = etat.quiz ? 'Arrêter le quiz' : 'Lancer le quiz';
  }
  for (var bp = 0; bp < boutonsPanneau.length; bp++) {
    boutonsPanneau[bp].onclick = function () { ouvrirPanneau(this.getAttribute('data-panneau')); };
  }

  // ---------- Accueil et régions ----------
  // dossier : jeu de données détaillé de la région (s'il manque, on retombe sur le corps entier, cadré sur la région)
  // boite : étendue de la région en cm (celle du manifeste de région quand il existe, sinon celle-ci, qui sert au repli)
  var REGIONS_ACC = {
    corps: { nom: 'Corps entier', dossier: '', dir: [0, 0.05, 1], classique: true, boite: [[-33.5, 0.7, -13.1], [33.5, 170.7, 13.7]] },
    'tete-cou': { nom: 'Tête et cou', dossier: 'tete-cou/', dir: [0.3, 0.08, 1], boite: [[-20.2, 132.2, -12.2], [20.2, 170.9, 11.7]] },
    tronc: { nom: 'Tronc', dossier: 'tronc/', dir: [0, 0.05, 1], boite: [[-23.1, 68.4, -14.8], [23.1, 154, 13.2]] },
    'membre-superieur': { nom: 'Membre supérieur', dossier: 'membre-superieur/', dir: [0, 0.05, 1], boite: [[-34, 69.8, -11.7], [34, 144.6, 10]] },
    'membre-inferieur': { nom: 'Membre inférieur', dossier: 'membre-inferieur/', dir: [0, 0.05, 1], boite: [[-18.2, -0.1, -14.4], [18.2, 103.9, 14.6]] },
    squelette: { nom: 'Squelette', dossier: '', dir: [0, 0.05, 1], classique: true, boite: [[-33.5, 0.7, -13.1], [33.5, 170.7, 13.7]], regle: 5, ligaments: true, sous: 'os et articulations' }
  };
  // Boîte d'une région : ce que son jeu détaillé affiche à l'ouverture (la boîte du manifeste englobe aussi des organes
  // et vaisseaux masqués au départ, ce qui rapetissait la tête) ; en repli sur le corps entier, l'étendue connue de la région.
  function boiteRegion() {
    var R = REGIONS_ACC[etat.region] || REGIONS_ACC.corps;
    return (jeu.dossier && boiteContenu()) || (jeu.dossier && M && M.boite) || R.boite;
  }
  // ---------- Cadrage : faire tenir une boîte dans la zone libre de l'écran ----------
  // Zone libre : sous la barre du haut, au-dessus de la barre d'outils, à gauche de la règle des couches.
  function zoneLibre() {
    var W = window.innerWidth, H = window.innerHeight, m = 8;
    var haut = el('barre-haut').getBoundingClientRect().bottom;
    var bo = el('barre-outils').getBoundingClientRect(), co = el('couches').getBoundingClientRect();
    return { g: m, d: (co.width ? co.left : W) - m, h: haut + m, b: (bo.height ? bo.top : H) - m };
  }
  var vCadre = new THREE.Vector3();
  function rectProjete(b, cible, dir, dist) {
    camera.position.copy(cible).addScaledVector(dir, dist); camera.lookAt(cible); camera.updateMatrixWorld();
    var W = window.innerWidth, H = window.innerHeight, r = { g: 1e9, d: -1e9, h: 1e9, b: -1e9 };
    for (var i = 0; i < 8; i++) {
      vCadre.set(b[i & 1][0], b[(i >> 1) & 1][1], b[(i >> 2) & 1][2]).project(camera);
      var x = (vCadre.x + 1) / 2 * W, y = (1 - vCadre.y) / 2 * H;
      r.g = Math.min(r.g, x); r.d = Math.max(r.d, x); r.h = Math.min(r.h, y); r.b = Math.max(r.b, y);
    }
    return r;
  }
  // Centre verticalement dans la zone ; horizontalement, garde le centre de l'écran si la boîte y tient déjà.
  function cadrer(b, dirTab, instant) {
    var z = zoneLibre(), H = window.innerHeight;
    var dir = new THREE.Vector3(dirTab[0], dirTab[1], dirTab[2]).normalize();
    var C = new THREE.Vector3((b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2);
    var rayon = new THREE.Vector3(b[1][0] - b[0][0], b[1][1] - b[0][1], b[1][2] - b[0][2]).length() / 2;
    var pos0 = camera.position.clone(), cib0 = controls.target.clone();
    camera.aspect = window.innerWidth / H; camera.updateProjectionMatrix();
    var lo = rayon * 1.05, hi = 3000, r, k;
    for (k = 0; k < 40; k++) {
      var mid = (lo + hi) / 2; r = rectProjete(b, C, dir, mid);
      if (r.d - r.g <= z.d - z.g && r.b - r.h <= z.b - z.h) hi = mid; else lo = mid;
    }
    var dist = hi, cible = C.clone(), droite = new THREE.Vector3(), hautV = new THREE.Vector3(), avant = new THREE.Vector3();
    for (k = 0; k < 30; k++) {
      r = rectProjete(b, cible, dir, dist);
      var dx = (r.g < z.g || r.d > z.d) ? (z.g + z.d) / 2 - (r.g + r.d) / 2 : 0, dy = (z.h + z.b) / 2 - (r.h + r.b) / 2;
      var dedans = r.g >= z.g - 0.5 && r.d <= z.d + 0.5 && r.h >= z.h - 0.5 && r.b <= z.b + 0.5;
      if (dedans && Math.abs(dy) < 1) break;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { dist *= 1.03; continue; } // centrée mais trop grande (perspective)
      var u = 2 * dist * Math.tan(camera.fov * Math.PI / 360) / H; // cm par pixel à la distance de la cible
      camera.matrixWorld.extractBasis(droite, hautV, avant);
      cible.addScaledVector(droite, -dx * u).addScaledVector(hautV, dy * u);
    }
    camera.position.copy(pos0); camera.lookAt(cib0); camera.updateMatrixWorld();
    placer(cible, [dir.x, dir.y, dir.z], dist, instant);
  }
  // Corps entier et squelette gardent la vue d'ensemble habituelle (déjà entière à l'écran) ; les régions sont ajustées.
  function cadrerRegion(instant, dirTab) {
    var R = REGIONS_ACC[etat.region] || REGIONS_ACC.corps;
    if (R.classique) placer(new THREE.Vector3(0, 76, 0), dirTab || R.dir, 352, instant);
    else cadrer(boiteRegion(), dirTab || R.dir, instant);
  }
  var SYS_ACC = {
    muscles: { sous: 'appareil locomoteur' }, nerfs: { sous: 'système nerveux' }, cardio: { sous: 'cœur et vaisseaux' },
    respiratoire: { sous: 'appareil respiratoire', region: 'tronc' }, digestif: { sous: 'appareil digestif', region: 'tronc' },
    urinaire: { sous: 'appareil urinaire', region: 'tronc' }, endocrinien: { sous: 'glandes endocrines' },
    lymphatique: { sous: 'système lymphatique' }, sens: { sous: 'œil et oreille', region: 'tete-cou' }
  };
  var regionsAbsentes = {}, manifestesRegion = {};
  function trouverDossier(R) {
    if (!R.dossier || regionsAbsentes[R.dossier]) return Promise.resolve('');
    if (jeu.dossier === R.dossier) return Promise.resolve(R.dossier);
    return charger('donnees/' + R.dossier + 'manifeste.json?v=' + DONNEES_REGIONS, 'json').then(function (man) {
      var m = lireJSON(man);
      if (!m || !m.pieces || !m.pieces.length) throw erreur('manifeste vide', 404);
      manifestesRegion[R.dossier] = m;
      return R.dossier;
    }).catch(function (e) {
      // absente pour toute la séance seulement si le serveur dit qu'elle n'existe pas ; une coupure passagère se réessaiera
      if (e.statut === 404) regionsAbsentes[R.dossier] = true;
      return '';
    });
  }
  function annoncerRepli(R) {
    bulle(regionsAbsentes[R.dossier] ? 'Pas de modèle détaillé pour « ' + R.nom + ' » : affichage du corps entier.'
      : 'Modèle détaillé de « ' + R.nom + ' » injoignable pour le moment : affichage du corps entier.', 3500);
  }
  function afficherChargement(titre) {
    el('chargement-titre').textContent = titre;
    el('chargement').classList.remove('cache');
  }
  // Entrer dans une région depuis l'accueil (ou un système : opt.systeme)
  function entrerRegion(cle, opt) {
    opt = opt || {};
    var S = opt.systeme ? SYS_ACC[opt.systeme] : null;
    var R = REGIONS_ACC[cle] || REGIONS_ACC.corps;
    var cadre = S && S.region ? REGIONS_ACC[S.region] : null;
    fermerPanneaux(); fermerMenu();
    if (etat.dessin) finDessin();
    if (etat.quiz) finQuiz();
    etat.region = cle;
    document.body.classList.remove('sur-accueil');
    el('titre-region').textContent = R.nom;
    el('titre-sous').textContent = '· ' + (S ? S.sous : R.sous || 'appareil locomoteur');
    var attente = setTimeout(function () { afficherChargement(R.nom); }, 120);
    jeuVoulu = R.dossier ? undefined : ''; // région : on ne sait pas encore si son dossier existe
    if (jeuVoulu === '') abandonnerSiInutile();
    var repli = false;
    return trouverDossier(R).then(function (d) {
      jeuVoulu = d; repli = !!R.dossier && !d;
      abandonnerSiInutile(); // premier lancement : le corps entier en cours de chargement ne sert plus
      return assurerJeu(d, manifestesRegion[d]).catch(function (e) {
        if (!d) throw e;
        repli = true; jeuVoulu = ''; // fichier de la région illisible : corps entier
        return assurerJeu('');
      });
    }).then(function () {
      clearTimeout(attente);
      el('chargement').classList.add('cache');
      redimensionner();
      reinitialiser(R, opt.systeme);
      if (cadre) cadrer(cadre.boite, cadre.dir, true); else cadrerRegion(true);
      if (repli) annoncerRepli(R);
    }, function (e) {
      clearTimeout(attente);
      afficherChargement(R.nom);
      progression(0, 'Impossible de charger le modèle. Vérifiez la connexion puis rouvrez l’application. (' + e.message + ')');
      throw e;
    });
  }
  // Remet l'affichage à zéro pour la région choisie
  function reinitialiser(R, systeme) {
    choisir(null);
    if (etat.multi) basculerMulti();
    etat.outil = 'nommer';
    etat.regle = typeof R.regle === 'number' ? R.regle : 2; etat.cote = '';
    etat.yeux = yeuxParDefaut(); if (R.ligaments) etat.yeux.ligaments = true;
    etat.force = {}; etat.seule = null;
    BASCULES.forEach(function (b) { etat[b] = false; });
    var anciensT = []; for (var k in etat.transp) anciensT.push(M.pieces[k]);
    etat.masques = {}; etat.isole = null; etat.transp = {};
    rafraichirMateriaux(anciensT);
    etat.endoscope = false; appliquerLumiere();
    var id = peauId(); if (meshes[id]) meshes[id].material = materiauPour(M.pieces[id]);
    effacerTout();
    ficheEl.classList.add('cache');
    etat.coupe = null; el('p-coupe').classList.add('cache'); appliquerCoupe();
    if (systeme && systeme !== 'muscles') {
      etat[systeme] = true; etat.regle = 6;
      if (systeme === 'sens') etat.yeux.os = false;
    }
    synchroniserCommandes(); chargerSystemesActifs(); majOutils(); majVisibilite();
  }
  function allerAccueil() {
    fermerPanneaux(); fermerMenu();
    if (etat.dessin) finDessin();
    if (etat.quiz) finQuiz();
    ficheEl.classList.add('cache');
    document.body.classList.add('sur-accueil');
  }
  el('b-accueil').onclick = allerAccueil;
  var vignettes = document.querySelectorAll('#accueil .vignette');
  for (var vg = 0; vg < vignettes.length; vg++) vignettes[vg].onclick = function () { entrerRegion(this.getAttribute('data-region')); };
  var puces = document.querySelectorAll('#puces-sys button');
  for (var pc = 0; pc < puces.length; pc++) puces[pc].onclick = function () {
    var s = this.getAttribute('data-sys'), a = this.getAttribute('data-action');
    if (s) { entrerRegion('corps', { systeme: s }); return; }
    entrerRegion('corps').then(function () { if (a === 'vues') ouvrirPanneau('p-vues'); else if (a === 'quiz') debutQuiz(); });
  };

  // ---------- Recherche ----------
  var indexRecherche = [];
  function sansAccents(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function construireIndexRecherche() {
    var vus = {};
    indexRecherche = [];
    M.pieces.forEach(function (p) {
      if (p.couche === 'insertions') return;
      var cle = p.en + '|' + p.cote;
      if (vus[cle]) return; vus[cle] = true;
      indexRecherche.push({ p: p, txt: sansAccents(p.fr + ' ' + p.en.replace(/_/g, ' ') + ' ' + (p.la || '')) });
    });
    indexRecherche.sort(function (a, b) { return a.p.fr.localeCompare(b.p.fr, 'fr') || a.p.cote.localeCompare(b.p.cote); });
  }
  var ORDRE_COUCHES = { muscles: 0, os: 1, ligaments: 2, nerfs: 3, fascias: 4, capsules: 5, peau: 6 };
  var champ = el('champ-recherche');
  champ.addEventListener('input', function () {
    var q = sansAccents(champ.value.trim());
    var res = el('resultats'); res.innerHTML = '';
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
      n++;
      (function (p) {
        var b = document.createElement('button');
        b.textContent = p.fr;
        var s = document.createElement('small'); s.textContent = typeDe(p) + (p.cote ? ' · ' + libCote(p.cote) : '') + (nomSecondaire(p) ? ' · ' + nomSecondaire(p) : '');
        b.appendChild(s);
        b.onclick = function () { allerA(p); };
        res.appendChild(b);
      })(trouves[t].it.p);
    }
    if (!n) { var v = document.createElement('div'); v.className = 'vide'; v.textContent = 'Aucun résultat.'; res.appendChild(v); }
  });
  // Montrer une structure trouvée par la recherche (en rendant sa couche visible si besoin)
  function allerA(p) {
    quitterSeule();
    etat.isole = null; delete etat.masques[p.id];
    var r = rangDe(p);
    if (p.couche === 'muscles') {
      var c = COUCHES[r]; etat.yeux[c] = true;
      if (etat.regle === 0 || etat.regle > r) { etat.regle = r; etat.force = {}; }
      if (etat.cote && p.cote && p.cote !== etat.cote && r > 2) etat.cote = '';
    } else if (p.couche === 'peau') { etat.regle = 0; etat.yeux.peau = true; etat.force = {}; }
    else if (p.couche === 'os' || p.couche === 'ligaments') { etat.regle = 5; etat.force = {}; etat.yeux[p.couche] = true; }
    else if (p.couche === 'fascias') { etat.yeux.fascias = true; if (etat.regle !== 1) { etat.regle = 1; etat.force = {}; } }
    else {
      if (p.couche === 'capsules') { etat.capsules = true; etat.yeux.ligaments = true; }
      if (SYSTEMES.indexOf(p.couche) >= 0) etat[p.couche] = true;
      if (etat.regle === 0) { etat.regle = 5; etat.force = {}; }
      if (p.couche === 'capsules' && etat.regle > 5) etat.regle = 5;
    }
    if (p.couche === 'encephale' || p.couche === 'sens') etat.yeux.os = false;
    etat.seule = null;
    if (etat.transp[p.id]) { delete etat.transp[p.id]; }
    if (etat.coupe && coupee(p)) { etat.coupe = null; appliquerCoupe(); }
    synchroniserCommandes();
    fermerPanneaux();
    var pq = PAQUET_DE[p.couche];
    (pq ? chargerPaquet(pq) : Promise.resolve()).then(function () {
      if (etat.multi) basculerMulti();
      choisir(p);
      volerVers(p);
    }, function () {});
  }

  // ---------- Gestes sur le corps : toucher, toucher deux fois, appui long ----------
  var debut = null, appuiT = null, appuiFait = false, appuiCible = null, menuEtait = false, panneauEtait = false, dernierTap = null;
  function posTouche(e) { var t = (e.changedTouches || e.touches) ? (e.changedTouches || e.touches)[0] : e; return { x: t.clientX, y: t.clientY }; }
  function annulerAppui() { if (appuiT) { clearTimeout(appuiT); appuiT = null; } }
  // Un panneau ouvert au moment où le doigt se pose : ce toucher sert seulement à le fermer.
  // Écouté sur le document en phase de capture, donc avant qu'OrbitControls (« start ») ne referme le panneau.
  function noterPanneau(e) { if (e.target === canvas) panneauEtait = !!document.querySelector('.panneau.ouvert'); }
  document.addEventListener('touchstart', noterPanneau, { capture: true, passive: true });
  document.addEventListener(window.PointerEvent ? 'pointerdown' : 'mousedown', noterPanneau, true);
  function debutGeste(x, y) {
    menuEtait = fermerMenu();
    debut = { x: x, y: y, t: Date.now() };
    appuiFait = false; appuiCible = null; annulerAppui();
    appuiT = setTimeout(function () { appuiT = null; appuiLong(x, y); }, 550);
  }
  function suiteGeste(x, y, seuil) {
    if (!debut) return;
    if (Math.abs(x - debut.x) > seuil || Math.abs(y - debut.y) > seuil) {
      annulerAppui();
      if (appuiFait) { fermerMenu(); appuiFait = false; appuiCible = null; } // appui long suivi d'une rotation : rien n'est choisi
    }
  }
  function finGeste(x, y, seuil) {
    annulerAppui();
    if (!debut) return;
    var court = Math.abs(x - debut.x) < seuil && Math.abs(y - debut.y) < seuil && Date.now() - debut.t < 400;
    debut = null;
    if (appuiFait) { // appui long relâché sans bouger : la structure est choisie, le menu agit sur elle
      appuiFait = false;
      if (appuiCible && (!etat.multi || !etat.selection[appuiCible.p.id])) choisir(appuiCible.p, appuiCible.point);
      appuiCible = null;
      return;
    }
    if (court && !menuEtait) relache(x, y);
  }
  // geste interrompu par le système (appel, Centre de contrôle, alerte) : rien ne doit rester en cours
  function annulerGeste() { annulerAppui(); debut = null; pince = null; if (appuiFait) { fermerMenu(); appuiFait = false; appuiCible = null; } }
  function appuiLong(x, y) {
    if (etat.dessin || etat.quiz || !debut) return;
    var h = viser(x, y, false); if (!h) return;
    var p = h.object.userData.p; if (p.couche === 'insertions') return;
    appuiFait = true; appuiCible = { p: p, point: h.point.clone() };
    ouvrirMenu(x, y, p);
  }
  function relache(x, y) {
    if (panneauEtait) { panneauEtait = false; fermerPanneaux(); return; }
    var t = Date.now();
    if (dernierTap && t - dernierTap.t < 330 && Math.abs(x - dernierTap.x) < 30 && Math.abs(y - dernierTap.y) < 30) {
      dernierTap = null; doubleToucher(x, y); return;
    }
    dernierTap = { x: x, y: y, t: t };
    toucher(x, y);
  }
  canvas.addEventListener('touchstart', function (e) {
    if (etat.dessin) return;
    if (e.touches.length === 1) { var p = posTouche(e); debutGeste(p.x, p.y); } else { debut = null; annulerAppui(); }
  }, { passive: true });
  canvas.addEventListener('touchmove', function (e) {
    if (e.touches.length === 1) suiteGeste(e.touches[0].clientX, e.touches[0].clientY, 10);
  }, { passive: true });
  canvas.addEventListener('touchend', function (e) {
    if (etat.dessin || e.touches.length) return;
    var p = posTouche(e); finGeste(p.x, p.y, 10);
  });
  canvas.addEventListener('touchcancel', annulerGeste, { passive: true });
  // souris (ordinateur) : three.js bloque « mousedown », on écoute donc « pointer » quand il existe
  var EV_BAS = window.PointerEvent ? 'pointerdown' : 'mousedown', EV_HAUT = window.PointerEvent ? 'pointerup' : 'mouseup', EV_MVT = window.PointerEvent ? 'pointermove' : 'mousemove';
  function estSouris(e) { return !e.pointerType || e.pointerType === 'mouse'; }
  canvas.addEventListener(EV_BAS, function (e) { if (!etat.dessin && estSouris(e) && e.button === 0) debutGeste(e.clientX, e.clientY); });
  canvas.addEventListener(EV_MVT, function (e) { if (debut && estSouris(e)) suiteGeste(e.clientX, e.clientY, 5); });
  canvas.addEventListener(EV_HAUT, function (e) { if (!etat.dessin && estSouris(e)) finGeste(e.clientX, e.clientY, 5); });
  // règle des couches à la souris (ordinateur)
  var regleSouris = false;
  regleEl.addEventListener(EV_BAS, function (e) { if (!estSouris(e) || estOeil(e.target)) return; regleSouris = true; regleDebut(e.clientY); });
  window.addEventListener(EV_MVT, function (e) { if (regleSouris) regleSuite(e.clientY); });
  window.addEventListener(EV_HAUT, function () { if (regleSouris) { regleSouris = false; regleFin(false); } });

  function toucher(x, y) {
    if (document.querySelector('.panneau.ouvert')) { fermerPanneaux(); return; }
    var h = viser(x, y, false);
    if (etat.quiz) { reponseQuiz(h ? h.object.userData.p : null); return; }
    if (!h) { if (etat.sel && !etat.multi) choisir(null); return; }
    var p = h.object.userData.p;
    if (p.couche === 'insertions') { bulle((p.type === 'o' ? 'Origine' : 'Terminaison') + ' — ' + etat.sel.fr, 1800); return; }
    if (!etat.multi && etat.outil !== 'nommer') { appliquerOutil(etat.outil, p, h.point); return; }
    if (!etat.multi && etat.sel && etat.sel.id === p.id) { ancre.copy(h.point); demanderRendu(); return; }
    choisir(p, h.point);
  }

  // ---------- Barre d'outils ----------
  var AIDES_OUTILS = { masquer: 'Touchez les structures à masquer. « Nommer » pour revenir.', transparent: 'Touchez les structures à rendre transparentes. « Nommer » pour revenir.',
    isoler: 'Touchez la structure à isoler.' };
  function choisirOutil(nom) { etat.outil = nom; majOutils(); }
  function majOutils() {
    classe(el('o-nommer'), 'actif', etat.outil === 'nommer' && !etat.multi && !etat.dessin);
    classe(el('b-multi'), 'actif', etat.multi);
    classe(el('o-transp'), 'actif', etat.outil === 'transparent');
    classe(el('o-isoler'), 'actif', etat.outil === 'isoler' || !!etat.isole);
    classe(el('o-masquer'), 'actif', etat.outil === 'masquer');
    classe(el('b-dessin'), 'actif', etat.dessin);
    classe(el('b-coupe'), 'actif', !!etat.coupe || !el('p-coupe').classList.contains('cache'));
  }
  // Outil choisi : s'il y a une sélection, on agit dessus ; sinon on passe en mode « toucher pour… »
  function actionOutil(nom) {
    fermerMenu();
    if (etat.dessin) finDessin();
    if (nom === 'isoler' && etat.isole) { etat.isole = null; choisirOutil('nommer'); majEtiquette(); majVisibilite(); return; }
    if (selectionnes().length) {
      if (nom === 'masquer') masquerSelection(); else if (nom === 'isoler') isolerSelection(true); else transpSelection();
      choisirOutil('nommer'); return;
    }
    if (etat.multi) basculerMulti();
    choisirOutil(etat.outil === nom ? 'nommer' : nom);
    if (etat.outil !== 'nommer') bulle(AIDES_OUTILS[nom], 2400);
  }
  function appliquerOutil(nom, p, point) {
    if (nom === 'masquer') { etat.masques[p.id] = true; if (etat.isole) delete etat.isole[p.id]; isoleVide(); if (etat.selection[p.id]) choisir(null); else majVisibilite(); }
    else if (nom === 'transparent') { etat.transp[p.id] = true; if (etat.selection[p.id]) choisir(null); else { rafraichirMateriaux([p]); majVisibilite(); } }
    else if (nom === 'isoler') { choisir(p, point); isolerSelection(true); choisirOutil('nommer'); }
  }
  el('o-nommer').onclick = function () { fermerMenu(); if (etat.multi) basculerMulti(); if (etat.dessin) finDessin(); choisirOutil('nommer'); };
  el('o-transp').onclick = function () { actionOutil('transparent'); };
  el('o-isoler').onclick = function () { actionOutil('isoler'); };
  el('o-masquer').onclick = function () { actionOutil('masquer'); };
  // « Tout voir » : tout réafficher et faire tenir la région à l'écran, dans la direction de vue actuelle
  el('o-toutvoir').onclick = function () {
    fermerMenu(); toutReafficher();
    var d = camera.position.clone().sub(controls.target).normalize();
    cadrerRegion(false, [d.x, d.y, d.z]);
  };

  // ---------- Menu de l'appui long ----------
  var menu = el('menu-appui');
  function ouvrirMenu(x, y, p) {
    var l = selectionnes();
    el('menu-nom').textContent = l.length > 1 ? l.length + ' structures' : p.fr + (p.cote ? ' (' + libCote(p.cote) + ')' : '');
    menu.querySelector('[data-m="fiche"]').disabled = l.length > 1 || !(fiches && fiches[p.en]);
    menu.classList.remove('cache');
    document.body.classList.add('menu-ouvert');
    var w = menu.offsetWidth, h = menu.offsetHeight;
    var lx = Math.min(Math.max(12, x + 16), window.innerWidth - w - 12);
    var ly = Math.min(Math.max(70, y - h / 2), window.innerHeight - h - 12);
    menu.style.transform = 'translate3d(' + Math.round(lx) + 'px,' + Math.round(ly) + 'px,0)';
  }
  function fermerMenu() {
    if (menu.classList.contains('cache')) return false;
    menu.classList.add('cache'); document.body.classList.remove('menu-ouvert');
    return true;
  }
  var boutonsMenu = menu.querySelectorAll('button');
  for (var bm = 0; bm < boutonsMenu.length; bm++) boutonsMenu[bm].onclick = function () {
    var m = this.getAttribute('data-m');
    fermerMenu();
    if (m === 'masquer') masquerSelection();
    else if (m === 'isoler') isolerSelection(true);
    else if (m === 'transparent') transpSelection();
    else if (m === 'fiche') ouvrirFiche(etat.sel);
  };

  // ---------- Sélection multiple ----------
  function basculerMulti() {
    etat.multi = !etat.multi;
    if (etat.multi) { etat.outil = 'nommer'; bulle('Touchez plusieurs structures, puis utilisez Isoler, Masquer ou Transparent.', 2800); }
    else if (selectionnes().length > 1) choisir(etat.sel);
    majOutils();
  }
  el('b-multi').onclick = function () { fermerPanneaux(); fermerMenu(); if (etat.quiz) finQuiz(); if (etat.dessin) finDessin(); basculerMulti(); };

  // ---------- Quiz ----------
  function candidatsQuiz() {
    var w = window.innerWidth, h = window.innerHeight, v = new THREE.Vector3(), vus = {}, l = [];
    var droite = w - el('couches').offsetWidth - 30;
    for (var i = 0; i < meshes.length; i++) {
      var m = meshes[i]; if (!m || !m.visible) continue;
      var p = m.userData.p;
      if (p.couche === 'peau' || p.couche === 'insertions' || etat.transp[p.id] || p.r < 2.5) continue;
      v.set(p.c[0], p.c[1], p.c[2]).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 0.85 || v.y > 0.8 || v.y < -0.4) continue;
      var x = (v.x + 1) / 2 * w; if (x < 30 || x > droite) continue;
      var cle = p.fr + '|' + p.cote; if (vus[cle]) continue; vus[cle] = true;
      l.push(p);
    }
    return l;
  }
  // tire une structure réellement visible (non cachée derrière une autre) : rayon depuis l'écran vers son centre
  function cibleVisible(l, precedente) {
    var w = window.innerWidth, h = window.innerHeight, v = new THREE.Vector3();
    var liste = l.slice();
    for (var essai = 0; essai < 30 && liste.length; essai++) {
      var p = liste.splice(Math.floor(Math.random() * liste.length), 1)[0];
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
    clearTimeout(q.minuterie); q.minuterie = null; q.n++;
    marquer(null);
    var qEl = el('quiz-question'), cEl = el('quiz-choix');
    qEl.className = ''; cEl.innerHTML = '';
    var l = candidatsQuiz();
    var cible = l.length >= 4 ? cibleVisible(l, q.cible) : null;
    if (!cible) { qEl.textContent = 'Rapprochez-vous ou affichez plus de structures pour jouer.'; q.cible = null; return; }
    q.cible = cible; q.repondu = false;
    el('quiz-score').textContent = q.bons + ' / ' + q.total;
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
        el('quiz-score').textContent = q.bons + ' / ' + q.total;
        q.minuterie = setTimeout(questionSuivante, ok ? 1100 : 2200);
      };
      cEl.appendChild(b);
    });
  }
  function reponseQuiz(p) {
    var q = etat.quiz; if (!q || q.mode !== 'ou' || !q.cible || q.repondu) return;
    if (!p || p.couche === 'insertions') return;
    q.repondu = true; q.total++;
    var ok = p.fr === q.cible.fr && p.cote === q.cible.cote;
    var qEl = el('quiz-question');
    if (ok) { q.bons++; marquer(p, 'bon'); qEl.className = 'bon'; qEl.textContent = 'Bravo : ' + nomQuiz(p); }
    else { marquer(q.cible, 'cible'); qEl.className = 'faux'; qEl.textContent = 'Non, c’est : ' + nomQuiz(p) + ' — la bonne réponse est en orange.'; }
    el('quiz-score').textContent = q.bons + ' / ' + q.total;
    q.minuterie = setTimeout(questionSuivante, ok ? 1100 : 2600);
  }
  function debutQuiz() {
    fermerPanneaux(); fermerMenu(); if (etat.dessin) finDessin(); if (etat.multi) basculerMulti();
    choisir(null);
    etat.quiz = { mode: etat.quiz ? etat.quiz.mode : 'ou', bons: 0, total: 0, cible: null, marque: {}, n: 0, minuterie: null };
    el('barre-quiz').classList.remove('cache');
    document.body.classList.add('quiz');
    questionSuivante();
  }
  function finQuiz() {
    if (etat.quiz) clearTimeout(etat.quiz.minuterie); // sinon l'ancienne minuterie ferait sauter une question au quiz suivant
    marquer(null);
    etat.quiz = null;
    el('barre-quiz').classList.add('cache');
    document.body.classList.remove('quiz');
  }
  el('b-quiz').onclick = function () { fermerPanneaux(); if (etat.quiz) finQuiz(); else debutQuiz(); };
  el('b-quiz-fin').onclick = finQuiz;
  el('b-quiz-passer').onclick = function () { if (etat.quiz && etat.quiz.cible && !etat.quiz.repondu) etat.quiz.total++; questionSuivante(); };
  var modesQ = document.querySelectorAll('.quiz-modes button');
  for (var mq = 0; mq < modesQ.length; mq++) {
    modesQ[mq].onclick = function () {
      for (var k = 0; k < modesQ.length; k++) modesQ[k].className = '';
      this.className = 'actif';
      if (etat.quiz) { etat.quiz.mode = this.getAttribute('data-q'); questionSuivante(); }
    };
  }

  // ---------- Bulle d'information ----------
  var bulleEl = el('bulle'), bulleT = null;
  function bulle(txt, ms) {
    bulleEl.textContent = txt; bulleEl.classList.remove('cache');
    clearTimeout(bulleT);
    if (ms) bulleT = setTimeout(cacherBulle, ms);
  }
  function cacherBulle() { bulleEl.classList.add('cache'); }

  // ---------- Dessin ----------
  var calque = el('calque');
  var ctx = calque.getContext('2d');
  var traitsEcran = [];   // [{c, pts:[[x,y]...]}]
  var traitsCorps = [];   // objets THREE.Points
  var historique = [];    // 'e' ou 'c' pour annuler dans l'ordre
  var traitEnCours = null;

  var texturePoint = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(16, 16, 14, 0, Math.PI * 2); x.fill();
    return new THREE.CanvasTexture(c);
  })();

  function debutDessin() {
    etat.dessin = true;
    fermerPanneaux(); fermerMenu();
    el('p-coupe').classList.add('cache');
    el('barre-dessin').classList.remove('cache');
    document.body.classList.add('dessin');
    appliquerModeDessin();
    majOutils();
  }
  function finDessin() {
    etat.dessin = false;
    el('barre-dessin').classList.add('cache');
    document.body.classList.remove('dessin'); document.body.classList.remove('dessin-ecran');
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.enabled = true;
    majOutils();
  }
  function appliquerModeDessin() {
    var corps = etat.modeDessin === 'corps';
    classe(document.body, 'dessin-ecran', !corps);
    controls.enabled = true;
    controls.touches.ONE = -1;            // un doigt dessine, deux doigts tournent / zooment
    controls.mouseButtons.LEFT = -1;
    classe(el('b-mode-trait'), 'actif', corps);
    classe(el('b-mode-ecran'), 'actif', !corps);
  }
  el('b-dessin').onclick = function () { if (etat.quiz) finQuiz(); if (etat.dessin) finDessin(); else debutDessin(); };
  el('b-fin-dessin').onclick = finDessin;
  el('b-mode-trait').onclick = function () { etat.modeDessin = 'corps'; appliquerModeDessin(); };
  el('b-mode-ecran').onclick = function () {
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
  el('b-annuler').onclick = function () {
    var dernier = historique.pop();
    if (dernier === 'e') { traitsEcran.pop(); redessinerEcran(); }
    else if (dernier === 'c') { var o = traitsCorps.pop(); if (o) { scene.remove(o); o.geometry.dispose(); o.material.dispose(); demanderRendu(); } }
  };
  function effacerTout() {
    traitsEcran = []; redessinerEcran();
    traitsCorps.forEach(function (o) { scene.remove(o); o.geometry.dispose(); o.material.dispose(); });
    traitsCorps = []; historique = []; demanderRendu();
  }
  el('b-effacer').onclick = effacerTout;
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

  function gestesDessin(cible) {
    cible.addEventListener('touchstart', function (e) {
      if (!etat.dessin) return;
      if (e.touches.length > 1) {
        // deuxième doigt : on navigue, on retire le petit trait commencé par erreur
        if (traitEnCours && traitEnCours.obj && traitEnCours.n < 6) el('b-annuler').onclick();
        else if (traitEnCours && traitEnCours.pts && traitEnCours.pts.length < 4) el('b-annuler').onclick();
        traitEnCours = null; return;
      }
      e.preventDefault();
      var p = posTouche(e);
      if (etat.modeDessin === 'corps') corpsDebut(p.x, p.y); else ecranDebut(p.x, p.y);
    }, { passive: false });
    cible.addEventListener('touchmove', function (e) {
      if (!etat.dessin || e.touches.length > 1 || !traitEnCours) return;
      e.preventDefault();
      var t = e.touches[0];
      if (etat.modeDessin === 'corps') corpsSuite(t.clientX, t.clientY); else ecranSuite(t.clientX, t.clientY);
    }, { passive: false });
    cible.addEventListener('touchend', function () { traitEnCours = null; });
    var souris = false;
    cible.addEventListener(EV_BAS, function (e) {
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

  // ---------- Coupe ----------
  // Plan sagittal : on retire le côté gauche du patient (+X) ; frontal : l'avant (+Z) ; transversal : le haut (+Y). « Inverser » retire l'autre partie.
  var PLANS = { sagittal: [1, 0, 0, 'x'], frontal: [0, 0, 1, 'z'], transversal: [0, 1, 0, 'y'] };
  var RETIRE = { sagittal: ['côté gauche retiré', 'côté droit retiré'], frontal: ['avant retiré', 'arrière retiré'], transversal: ['haut retiré', 'bas retiré'] };
  function appliquerCoupe() {
    var c = etat.coupe;
    basculerShaderCoupe(!!c);
    if (c && boite) {
      var P = PLANS[c.plan], ax = P[3];
      var pos = boite.min[ax] + c.f * (boite.max[ax] - boite.min[ax]), s = c.inverse ? -1 : 1;
      UNI.coupe.value.set(P[0] * s, P[1] * s, P[2] * s, pos * s);
    }
    majPanneauCoupe(); majOutils(); majVisibilite();
  }
  function majPanneauCoupe() {
    var c = etat.coupe;
    var bs = document.querySelectorAll('.coupe-plans button');
    for (var i = 0; i < bs.length; i++) classe(bs[i], 'actif', !!c && bs[i].getAttribute('data-plan') === c.plan);
    el('coupe-pouce').style.left = ((c ? c.f : 0.5) * 100) + '%';
    classe(el('curseur-coupe'), 'inactif', !c);
    el('coupe-texte').textContent = c ? 'Plan ' + c.plan + ' : ' + RETIRE[c.plan][c.inverse ? 1 : 0] + '.' : 'Choisissez un plan de coupe.';
  }
  function poserCoupe(plan) {
    var ax = PLANS[plan][3], f = 0.5;
    // par le centre de la vue ; la coupe sagittale part de la ligne médiane (corps symétrique, et le cadrage peut décaler la vue)
    if (boite) f = ((plan === 'sagittal' ? 0 : controls.target[ax]) - boite.min[ax]) / Math.max(1, boite.max[ax] - boite.min[ax]);
    etat.coupe = { plan: plan, f: Math.max(0.02, Math.min(0.98, f)), inverse: etat.coupe && etat.coupe.plan === plan ? etat.coupe.inverse : false };
    appliquerCoupe();
  }
  el('b-coupe').onclick = function () {
    fermerMenu();
    var p = el('p-coupe'), ouvrir = p.classList.contains('cache');
    if (ouvrir) { if (etat.dessin) finDessin(); fermerPanneaux(); p.classList.remove('cache'); if (!etat.coupe) poserCoupe('sagittal'); }
    else p.classList.add('cache');
    majOutils();
  };
  var plansBtn = document.querySelectorAll('.coupe-plans button');
  for (var pb = 0; pb < plansBtn.length; pb++) plansBtn[pb].onclick = function () { poserCoupe(this.getAttribute('data-plan')); };
  el('b-coupe-inverser').onclick = function () { if (etat.coupe) { etat.coupe.inverse = !etat.coupe.inverse; appliquerCoupe(); } };
  el('b-coupe-off').onclick = function () { etat.coupe = null; el('p-coupe').classList.add('cache'); appliquerCoupe(); };
  // curseur de position du plan (gestes tactiles : un curseur natif serait bloqué par l'anti-rebond de la page)
  var curseurCoupe = el('curseur-coupe'), pisteCoupe = curseurCoupe.querySelector('.piste-coupe');
  function deplacerCoupe(x) {
    if (!etat.coupe) poserCoupe('sagittal');
    var r = pisteCoupe.getBoundingClientRect();
    etat.coupe.f = Math.max(0, Math.min(1, (x - r.left) / Math.max(1, r.width)));
    appliquerCoupe();
  }
  curseurCoupe.addEventListener('touchstart', function (e) { e.preventDefault(); deplacerCoupe(e.touches[0].clientX); }, { passive: false });
  curseurCoupe.addEventListener('touchmove', function (e) { e.preventDefault(); deplacerCoupe(e.touches[0].clientX); }, { passive: false });
  var coupeSouris = false;
  curseurCoupe.addEventListener(EV_BAS, function (e) { if (!estSouris(e)) return; coupeSouris = true; deplacerCoupe(e.clientX); });
  window.addEventListener(EV_MVT, function (e) { if (coupeSouris) deplacerCoupe(e.clientX); });
  window.addEventListener(EV_HAUT, function () { coupeSouris = false; });

  // ---------- Divers ----------
  // empêcher le zoom de la page et le rebond sur iOS
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) {
    var t = e.target;
    while (t && t !== document.body) {
      if (t.id === 'fiche-corps' || t.id === 'systemes' || (t.classList && t.classList.contains('panneau'))) return;
      t = t.parentNode;
    }
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('resize', redimensionner);
  window.addEventListener('orientationchange', function () { setTimeout(redimensionner, 300); });
  el('version').textContent = 'Version ' + VERSION;

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  // Sonde de lecture pour les tests automatiques (aucun effet sur l'usage normal)
  var sonde = window.__anatomie = {
    pret: false, journal: [], version: VERSION, etat: etat,
    planCoupe: function () { return etat.coupe ? UNI.coupe.value.toArray() : null; },
    regionGardee: function (d) { return gardes[d] || ''; },
    boiteRegion: function () { return boiteRegion(); }, camera: camera, controls: controls, renderer: renderer, scene: scene,
    manifeste: function () { return M; },
    jeu: function () { return { dossier: jeu.dossier, region: etat.region, pieces: M ? M.pieces.length : 0 }; },
    surAccueil: function () { return document.body.classList.contains('sur-accueil'); },
    visibles: function () { var n = 0; for (var i = 0; i < meshes.length; i++) if (meshes[i] && meshes[i].visible) n++; return n; },
    visiblesPar: function () { var r = {}; for (var i = 0; i < meshes.length; i++) { var m = meshes[i]; if (m && m.visible) { var c = m.userData.p.couche; r[c] = (r[c] || 0) + 1; } } return r; },
    viser: function (x, y) { var h = viser(x, y, false); return h ? { id: h.object.userData.p.id, en: h.object.userData.p.en, fr: h.object.userData.p.fr, couche: h.object.userData.p.couche, point: h.point.toArray() } : null; },
    etiquette: function () {
      var r = etiq.getBoundingClientRect();
      return { visible: !etiq.classList.contains('cache'), nom: el('etiq-nom').textContent, x: r.left, y: r.top, fil: !fil.classList.contains('cache') };
    },
    // opacité du pixel (x, y) du dessin 3D : 0 = rien n'y est dessiné
    pixel: function (x, y) {
      renderer.render(scene, camera);
      var b = new Uint8Array(4), g = renderer.getContext();
      g.readPixels(Math.round(x * pr), Math.round((window.innerHeight - y) * pr), 1, 1, g.RGBA, g.UNSIGNED_BYTE, b);
      return b[3];
    },
    // part des pixels dessinés presque noirs (taches sur les faces coupées)
    tachesCoupe: function () {
      renderer.render(scene, camera);
      var g = renderer.getContext(), w = canvas.width, h = canvas.height, b = new Uint8Array(w * h * 4), n = 0, noirs = 0;
      g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, b);
      for (var i = 0; i < b.length; i += 4) if (b[i + 3] > 200) { n++; if (Math.max(b[i], b[i + 1], b[i + 2]) < 28) noirs++; }
      return n ? Math.round(noirs / n * 10000) / 10000 : 0;
    },
    info: function () { renderer.render(scene, camera); return { appels: renderer.info.render.calls, triangles: renderer.info.render.triangles, pr: renderer.getPixelRatio(), w: canvas.width, h: canvas.height }; }
  };
  construireVues();
  synchroniserCommandes();
  majPanneauCoupe();
  redimensionner();
  // Le corps entier se charge pendant que l'accueil est affiché
  assurerJeu('').catch(function (e) {
    if (e.abandon) return; // une région a été choisie entre-temps
    progression(0, 'Impossible de charger le modèle. Vérifiez la connexion puis rouvrez l’application. (' + e.message + ')');
  });
})();
