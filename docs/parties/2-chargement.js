
  // ---------- Chargement ----------
  function progression(frac, texte) {
    var w = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
    el('barre-prog').style.width = w; el('accueil-barre').style.width = w;
    if (texte) { el('texte-prog').textContent = texte; el('accueil-texte').textContent = texte; }
  }

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
  // Libère le jeu de données affiché (mémoire de l'iPad : on n'en garde jamais deux à la fois)
  function viderJeu() {
    jeu.gen++;
    for (var i = 0; i < meshes.length; i++) if (meshes[i]) meshes[i].geometry.dispose();
    if (groupe) scene.remove(groupe);
    meshes = []; paquetsPrets = {}; paquetsEnCours = {}; AO = { os: null, muscles: null, fs: null, off: {} };
    fiches = null; indexRecherche = []; M = null; boite = null; jeu.dossier = null;
    etat.selection = {}; etat.sel = null; etat.masques = {}; etat.isole = null; etat.transp = {}; etat.insertions = false;
  }
  function calculerBoite() {
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    M.pieces.forEach(function (p) {
      if (p.couche === 'peau' || p.couche === 'insertions') return;
      for (var i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p.c[i] - p.r); mx[i] = Math.max(mx[i], p.c[i] + p.r); }
    });
    return { min: { x: mn[0], y: mn[1], z: mn[2] }, max: { x: mx[0], y: mx[1], z: mx[2] } };
  }
  function chargerJeu(dossier, manifesteDeja) {
    sonde.pret = false;
    viderJeu();
    var gen = jeu.gen;
    DONNEES = 'donnees/' + dossier;
    var tailles = {}, recus = {};
    function maj() {
      var t = 0, r = 0;
      for (var k in tailles) { t += tailles[k]; r += recus[k] || 0; }
      progression(0.1 + (t ? r / t : 0) * 0.85);
    }
    el('accueil-prog').classList.remove('pret');
    progression(0.05, 'Chargement du modèle…');
    return (manifesteDeja ? Promise.resolve(manifesteDeja) : charger(DONNEES + 'manifeste.json?v=' + VERSION, 'json')).then(function (man) {
      M = lireJSON(man);
      if (!M || !M.pieces) throw new Error('manifeste illisible');
      groupe = new THREE.Group();
      groupe.scale.setScalar(M.echelle);
      groupe.position.set(M.centre[0], M.centre[1], M.centre[2]);
      groupe.updateMatrix();
      scene.add(groupe);
      M.pieces.forEach(function (p) { if (PAQUETS.indexOf(p.paquet) >= 0) tailles[p.paquet] = Math.max(tailles[p.paquet] || 0, p.o + p.ob[0] + p.ob[1] + p.ob[2] + p.ic * (p.u32 ? 4 : 2)); });
      var presents = PAQUETS.filter(function (n) { return tailles[n]; }); // une région peut ne pas avoir de peau, de nerfs…
      var details = Promise.all(['ao-os', 'ao-muscles', 'fibres-s'].map(function (n) {
        return charger(DONNEES + n + '.bin?v=' + VERSION, 'arraybuffer').catch(function () { return null; });
      })).then(function (b) { preparerAO({ os: b[0], muscles: b[1], fs: b[2] }); });
      return Promise.all([details].concat(presents.map(function (nom) {
        return charger(DONNEES + nom + '.bin?v=' + VERSION, 'arraybuffer', function (l) { recus[nom] = l; maj(); }).then(function (buf) {
          recus[nom] = tailles[nom]; maj();
          return { nom: nom, buf: buf };
        });
      }))).then(function (r) { return r.slice(1); });
    }).then(function (res) {
      if (gen !== jeu.gen) throw new Error('chargement remplacé');
      progression(0.95, 'Construction du modèle…');
      var parPaquet = {};
      res.forEach(function (r) { parPaquet[r.nom] = r.buf; });
      // construction en plusieurs passes pour laisser respirer l'affichage
      var liste = M.pieces.filter(function (p) { return parPaquet[p.paquet]; });
      PAQUETS.forEach(function (n) { paquetsPrets[n] = true; });
      var i = 0;
      return new Promise(function (ok) {
        (function lot() {
          var fin = Math.min(liste.length, i + 120);
          for (; i < fin; i++) construireMesh(liste[i], parPaquet[liste[i].paquet]);
          progression(0.95 + 0.05 * i / Math.max(1, liste.length));
          if (i < liste.length) setTimeout(lot, 0); else ok();
        })();
      });
    }).then(function () {
      jeu.dossier = dossier;
      boite = calculerBoite();
      majVisibilite();
      charger(DONNEES + 'fiches.json?v=' + VERSION, 'json').then(function (f) {
        if (gen === jeu.gen) { fiches = lireJSON(f); majEtiquette(); }
      }, function () {});
      construireIndexRecherche();
      el('accueil-prog').classList.add('pret');
      progression(1, 'Modèle prêt.');
      sonde.pret = true;
    });
  }
  // File d'attente : un seul jeu de données chargé à la fois
  var fileJeu = Promise.resolve();
  function assurerJeu(dossier, manifesteDeja) {
    fileJeu = fileJeu.catch(function () {}).then(function () {
      if (jeu.dossier === dossier && M) return;
      return chargerJeu(dossier, manifesteDeja);
    });
    return fileJeu;
  }

  var NOMS_PAQUETS = { insertions: 'des insertions', cardio: 'du cœur et des vaisseaux', visceres: 'des viscères', lymphatique: 'du système lymphatique', encephale: 'de l’encéphale', sens: 'de l’œil et de l’oreille' };
  function chargerPaquet(nom) {
    if (paquetsPrets[nom]) return Promise.resolve();
    if (paquetsEnCours[nom]) return paquetsEnCours[nom];
    var gen = jeu.gen;
    var aucune = !M.pieces.some(function (p) { return p.paquet === nom; });
    if (aucune) { paquetsPrets[nom] = true; return Promise.resolve(); } // ce jeu n'a aucune pièce de ce paquet
    bulle('Chargement ' + (NOMS_PAQUETS[nom] || '') + '…', 0);
    paquetsEnCours[nom] = charger(DONNEES + nom + '.bin?v=' + VERSION, 'arraybuffer').then(function (buf) {
      if (gen !== jeu.gen) return; // le jeu de données a changé entre-temps
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
