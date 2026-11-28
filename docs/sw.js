// Service worker : garde l'application et le modèle en mémoire pour fonctionner sans connexion.
var CACHE = 'anatomie3d-1.3.0';
var FICHIERS = [
  './', 'index.html', 'style.css?v=4', 'app.js?v=6', 'vendor/three.min.js', 'vendor/OrbitControls.js', 'icone-180.png',
  'img/v-corps.jpg', 'img/v-tete.jpg', 'img/v-tronc.jpg', 'img/v-bras.jpg', 'img/v-jambe.jpg', 'img/v-squelette.jpg',
  'donnees/manifeste.json?v=1.3.0', 'donnees/fiches.json?v=1.3.0'
].concat(['os', 'muscles', 'articulations', 'nerfs', 'peau', 'insertions', 'cardio', 'visceres', 'lymphatique', 'encephale', 'sens', 'ao-os', 'ao-muscles', 'fibres-s'].map(function (n) {
  return 'donnees/' + n + '.bin?v=1.3.0';
}));

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (r) {
    return r || fetch(e.request).then(function (rep) {
      if (rep.ok && new URL(e.request.url).origin === location.origin) {
        var copie = rep.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copie); });
      }
      return rep;
    });
  }).catch(function () { return caches.match('index.html'); }));
});
