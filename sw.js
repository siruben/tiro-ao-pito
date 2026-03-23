const CACHE = "tiro-ao-pito-v1";
const FICHEIROS = [
  "/tiro-ao-pito/",
  "/tiro-ao-pito/index.html",
  "/style.css",
  "/script.js",
  "/poster.png",
  "/pito.png",
  "/gordo.png",
  "/magro.png",
  "/careca.png",
  "/cabeludo.png",
  "/intro.mp3",
  "/feira.mp3",
  "/tiro.mp3"
];

// Instala e guarda ficheiros em cache
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FICHEIROS))
  );
});

// Serve da cache se offline
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});