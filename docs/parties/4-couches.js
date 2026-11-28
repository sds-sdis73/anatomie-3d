
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
      b.onclick = function () { var R = REGIONS_ACC[etat.region] || REGIONS_ACC.corps; placer(new THREE.Vector3().fromArray(R.cible), v.dir, R.dist, false); fermerPanneaux(); };
      vc.appendChild(b);
    });
    var vr = el('vues-regions');
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
          var b2 = document.createElement('button'); b2.textContent = c[1];
          b2.onclick = function () { allerRegion(r, c[0]); };
          cs.appendChild(b2);
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
      classe(rangsDom[i].querySelector('.oeil'), 'on', presente(i, '') && (i !== 0 || true));
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
  function regler(r) {
    r = Math.max(0, Math.min(6, r));
    if (r === etat.regle && !Object.keys(etat.force).length) return;
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
  function basculerSysteme(s) {
    var allume;
    if (s === 'organes') { var tous = ORGANES.every(function (o) { return etat[o]; }); ORGANES.forEach(function (o) { etat[o] = !tous; }); allume = !tous; }
    else { etat[s] = !etat[s]; allume = etat[s]; }
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
    if (id === 'p-recherche') setTimeout(function () { el('champ-recherche').focus(); }, 250);
    if (id === 'p-reglages') el('b-quiz').textContent = etat.quiz ? 'Arrêter le quiz' : 'Lancer le quiz';
  }
  for (var bp = 0; bp < boutonsPanneau.length; bp++) {
    boutonsPanneau[bp].onclick = function () { ouvrirPanneau(this.getAttribute('data-panneau')); };
  }
