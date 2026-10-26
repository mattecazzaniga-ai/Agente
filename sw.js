// Service worker: mette in cache tutti i file del gioco, così funziona offline.
// Quando cambi un file, aumenta VERSIONE: al prossimo avvio la cache viene rinnovata.
const VERSIONE = "dinastia-v3";

const FILE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "icons/icon.svg",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "js/main.js",
  "js/ai.js",
  "js/albero.js",
  "js/azioni.js",
  "js/data.js",
  "js/dinastia.js",
  "js/economy.js",
  "js/engine.js",
  "js/events.js",
  "js/family.js",
  "js/generator.js",
  "js/rng.js",
  "js/state.js",
  "js/util.js",
  "js/vista.js",
  "js/ui/componenti.js",
  "js/ui/famiglia.js",
  "js/ui/generatore.js",
  "js/ui/impostazioni.js",
  "js/ui/soldi.js",
  "js/ui/vita.js",
  "data/generator.json",
  "data/jobs.json",
  "data/names.json",
  "data/regions.json",
  "data/schools.json",
  "data/traits.json",
  "data/events/index.json",
  "data/events/amicizie.json",
  "data/events/famiglia.json",
  "data/events/lavoro.json",
  "data/events/salute.json",
  "data/events/scuola.json",
  "data/events/soldi.json",
  "data/events/universita.json",
  "data/events/amore.json",
  "data/events/figli.json",
  "data/events/azienda.json",
  "data/events/adulti.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k !== VERSIONE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Prima la rete (così gli aggiornamenti arrivano subito), poi la cache se si è offline.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copia = r.clone();
          caches.open(VERSIONE).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
