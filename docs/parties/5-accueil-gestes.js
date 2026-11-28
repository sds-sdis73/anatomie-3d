
  // ---------- Accueil et régions ----------
  // dossier : jeu de données détaillé de la région (s'il manque, on retombe sur le corps entier, cadré sur la région)
  var REGIONS_ACC = {
    corps: { nom: 'Corps entier', dossier: '', cible: [0, 76, 0], dir: [0, 0.05, 1], dist: 352 },
    'tete-cou': { nom: 'Tête et cou', dossier: 'tete-cou/', cible: [0, 156, 3], dir: [0.3, 0.08, 1], dist: 82 },
    tronc: { nom: 'Tronc', dossier: 'tronc/', cible: [0, 114, 0], dir: [0, 0.05, 1], dist: 168 },
    'membre-superieur': { nom: 'Membre supérieur', dossier: 'membre-superieur/', cible: [0, 108, 0], dir: [0, 0.05, 1], dist: 182 },
    'membre-inferieur': { nom: 'Membre inférieur', dossier: 'membre-inferieur/', cible: [0, 48, 2], dir: [0, 0.05, 1], dist: 205 },
    squelette: { nom: 'Squelette', dossier: '', cible: [0, 76, 0], dir: [0, 0.05, 1], dist: 352, regle: 5, ligaments: true, sous: 'os et articulations' }
  };
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
    return charger('donnees/' + R.dossier + 'manifeste.json?v=' + VERSION, 'json').then(function (man) {
      var m = lireJSON(man);
      if (!m || !m.pieces || !m.pieces.length) throw new Error('manifeste vide');
      manifestesRegion[R.dossier] = m;
      return R.dossier;
    }).catch(function () { regionsAbsentes[R.dossier] = true; return ''; });
  }
  function afficherChargement(titre) {
    el('chargement-titre').textContent = titre;
    el('chargement').classList.remove('cache');
  }
  // Entrer dans une région depuis l'accueil (ou un système : opt.systeme)
  function entrerRegion(cle, opt) {
    opt = opt || {};
    var S = opt.systeme ? SYS_ACC[opt.systeme] : null;
    var cadre = REGIONS_ACC[(S && S.region) || cle] || REGIONS_ACC.corps;
    var R = REGIONS_ACC[cle] || REGIONS_ACC.corps;
    fermerPanneaux(); fermerMenu();
    if (etat.dessin) finDessin();
    if (etat.quiz) finQuiz();
    etat.region = cle;
    document.body.classList.remove('sur-accueil');
    el('titre-region').textContent = R.nom;
    el('titre-sous').textContent = '· ' + (S ? S.sous : R.sous || 'appareil locomoteur');
    var attente = setTimeout(function () { afficherChargement(R.nom); }, 120);
    return trouverDossier(R).then(function (d) {
      return assurerJeu(d, manifestesRegion[d]).catch(function (e) {
        if (!d) throw e;
        regionsAbsentes[d] = true; // jeu de la région illisible : corps entier
        return assurerJeu('');
      });
    }).then(function () {
      clearTimeout(attente);
      el('chargement').classList.add('cache');
      reinitialiser(R, opt.systeme);
      placer(new THREE.Vector3().fromArray(cadre.cible), cadre.dir, cadre.dist, true);
      redimensionner();
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
    });
  }

  // ---------- Gestes sur le corps : toucher, toucher deux fois, appui long ----------
  var debut = null, appuiT = null, appuiFait = false, menuEtait = false, dernierTap = null;
  function posTouche(e) { var t = (e.changedTouches || e.touches) ? (e.changedTouches || e.touches)[0] : e; return { x: t.clientX, y: t.clientY }; }
  function annulerAppui() { if (appuiT) { clearTimeout(appuiT); appuiT = null; } }
  function debutGeste(x, y) {
    menuEtait = fermerMenu();
    debut = { x: x, y: y, t: Date.now() };
    appuiFait = false; annulerAppui();
    appuiT = setTimeout(function () { appuiT = null; appuiLong(x, y); }, 550);
  }
  function suiteGeste(x, y, seuil) {
    if (!debut) return;
    if (Math.abs(x - debut.x) > seuil || Math.abs(y - debut.y) > seuil) { annulerAppui(); if (appuiFait) fermerMenu(); }
  }
  function finGeste(x, y, seuil) {
    annulerAppui();
    if (!debut) return;
    var court = Math.abs(x - debut.x) < seuil && Math.abs(y - debut.y) < seuil && Date.now() - debut.t < 400;
    debut = null;
    if (appuiFait) { appuiFait = false; return; }
    if (court && !menuEtait) relache(x, y);
  }
  function appuiLong(x, y) {
    if (etat.dessin || etat.quiz || !debut) return;
    var h = viser(x, y, false); if (!h) return;
    var p = h.object.userData.p; if (p.couche === 'insertions') return;
    appuiFait = true;
    if (!etat.multi || !etat.selection[p.id]) choisir(p, h.point);
    ouvrirMenu(x, y, p);
  }
  function relache(x, y) {
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
    if (nom === 'masquer') { etat.masques[p.id] = true; if (etat.isole) delete etat.isole[p.id]; if (etat.selection[p.id]) choisir(null); else majVisibilite(); }
    else if (nom === 'transparent') { etat.transp[p.id] = true; if (etat.selection[p.id]) choisir(null); else { rafraichirMateriaux([p]); majVisibilite(); } }
    else if (nom === 'isoler') { choisir(p, point); isolerSelection(true); choisirOutil('nommer'); }
  }
  el('o-nommer').onclick = function () { fermerMenu(); if (etat.multi) basculerMulti(); if (etat.dessin) finDessin(); choisirOutil('nommer'); };
  el('o-transp').onclick = function () { actionOutil('transparent'); };
  el('o-isoler').onclick = function () { actionOutil('isoler'); };
  el('o-masquer').onclick = function () { actionOutil('masquer'); };
  el('o-toutvoir').onclick = function () { fermerMenu(); toutReafficher(); };

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
