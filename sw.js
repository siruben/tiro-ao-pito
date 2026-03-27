const CACHE = "tiro-ao-pito-v5";
const FICHEIROS = [
  "/tiro-ao-pito/",
  "/tiro-ao-pito/index.html",
  "/tiro-ao-pito/manifest.json",
  "/tiro-ao-pito/style.css",
  "/tiro-ao-pito/script.js",
  "/tiro-ao-pito/poster.png",
  "/tiro-ao-pito/criador.png",
  "/tiro-ao-pito/pito.png",
  "/tiro-ao-pito/gordo.png",
  "/tiro-ao-pito/magro.png",
  "/tiro-ao-pito/careca.png",
  "/tiro-ao-pito/cabeludo.png",
  "/tiro-ao-pito/intro.mp3",
  "/tiro-ao-pito/feira.mp3",
  "/tiro-ao-pito/tiro.mp3"
];

// Limpar caches antigos
self.addEventListener("install", e => {
  e.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return caches.open(CACHE).then(cache => cache.addAll(FICHEIROS));
    })
  );
});

// Serve da cache se offline
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});