const CACHE = "tiro-ao-pito-v15";
// caminhos relativos ao sw.js: funcionam no GitHub Pages e dentro da app Android
const FICHEIROS = [
  "./",
  "index.html",
  "manifest.json",
  "style.css",
  "balanco.js",
  "script.js",
  "poster.jpg",
  "criador.png",
  "pito.png",
  "gordo.png",
  "magro.png",
  "careca.png",
  "cabeludo.png",
  "icon-192.png",
  "icon-512.png",
  "intro.mp3",
  "feira.mp3"
];
// ficheiros opcionais: se ainda não existirem, não impedem a instalação
const OPCIONAIS = ["gameover1.mp3", "gameover2.mp3"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(FICHEIROS).then(() =>
        Promise.all(OPCIONAIS.map(f => cache.add(f).catch(() => {})))
      )
    )
  );
  self.skipWaiting();
});

// Limpar caches antigos
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Serve da cache se offline
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
