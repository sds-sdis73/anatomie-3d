// Service worker : garde l'application et le modèle en mémoire pour fonctionner sans connexion.
var CACHE = 'anatomie3d-1.3.0';
// Version des DONNÉES des régions (même valeur que DONNEES_REGIONS dans app.js), distincte de celle de l'appli :
// une mise à jour de l'appli garde les régions déjà téléchargées sur l'iPad.
var DONNEES_REGIONS = '1.3.0';
var CACHE_REGIONS = 'anatomie3d-regions-' + DONNEES_REGIONS;
var FICHIERS = [
  './', 'index.html', 'style.css?v=4', 'app.js?v=6', 'vendor/three.min.js', 'vendor/OrbitControls.js', 'icone-180.png',
  'img/v-corps.jpg', 'img/v-tete.jpg', 'img/v-tronc.jpg', 'img/v-bras.jpg', 'img/v-jambe.jpg', 'img/v-squelette.jpg',
  'donnees/manifeste.json?v=1.3.0', 'donnees/fiches.json?v=1.3.0'
].concat(['os', 'muscles', 'articulations', 'nerfs', 'peau', 'insertions', 'cardio', 'visceres', 'lymphatique', 'encephale', 'sens', 'ao-os', 'ao-muscles', 'fibres-s'].map(function (n) {
  return 'donnees/' + n + '.bin?v=1.3.0';
}));
// Régions détaillées (docs/donnees/<region>/) : seulement les paquets présents dans chaque région.
// Elles ne sont PAS mises en cache à l'installation (≈ 52 Mo, trop pour l'iPad mini 2 d'un coup) :
// l'appli (app.js, garderRegion) range chaque région entière dans CACHE_REGIONS à sa première ouverture en ligne.
var A_LA_DEMANDE = [];
var REGIONS = {
  'tete-cou': ['os', 'muscles', 'articulations', 'nerfs', 'peau', 'insertions', 'cardio', 'visceres', 'lymphatique', 'encephale', 'sens'],
  'tronc': ['os', 'muscles', 'articulations', 'nerfs', 'peau', 'insertions', 'cardio', 'visceres', 'lymphatique'],
  'membre-superieur': ['os', 'muscles', 'articulations', 'nerfs', 'peau', 'insertions', 'cardio', 'lymphatique'],
  'membre-inferieur': ['os', 'muscles', 'articulations', 'nerfs', 'peau', 'insertions', 'cardio', 'lymphatique']
};
Object.keys(REGIONS).forEach(function (r) {
  A_LA_DEMANDE.push('donnees/' + r + '/manifeste.json?v=' + DONNEES_REGIONS, 'donnees/' + r + '/fiches.json?v=' + DONNEES_REGIONS);
  REGIONS[r].concat(['ao-os', 'ao-muscles', 'fibres-s']).forEach(function (n) { A_LA_DEMANDE.push('donnees/' + r + '/' + n + '.bin?v=' + DONNEES_REGIONS); });
});
// fichier d'une région (donnees/<region>/…) : gardé par l'appli dans le cache des régions, pas dans celui de l'appli
function estRegion(chemin) { return /\/donnees\/[^\/]+\//.test(chemin); }

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});
// On ne supprime que les caches d'appli périmés et les caches de régions d'une autre version de données.
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE && k !== CACHE_REGIONS; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var navigation = e.request.mode === 'navigate';
  e.respondWith(caches.match(e.request).then(function (r) {
    return r || fetch(e.request).then(function (rep) {
      var u = new URL(e.request.url);
      if (rep.ok && u.origin === location.origin && !estRegion(u.pathname)) {
        var copie = rep.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copie).catch(function () {}); }).catch(function () {});
      }
      return rep;
    });
  }).catch(function () {
    // hors connexion : la page d'accueil pour une navigation seulement ; une donnée absente est refusée
    // (lui servir index.html à la place faisait planter la construction du modèle)
    if (navigation) return caches.match('index.html').then(function (p) { return p || Response.error(); });
    return Response.error();
  }));
});
