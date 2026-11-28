
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
  var tailleEtiq = null, vEtiq = new THREE.Vector3();
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
    var larg = el('couches').offsetWidth;
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
  function masquerSelection() {
    if (!etat.sel) return;
    selectionnes().forEach(function (p) { etat.masques[p.id] = true; if (etat.isole) delete etat.isole[p.id]; });
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
    });
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
