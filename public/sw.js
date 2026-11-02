// Service worker minimo: l'app si installa sul telefono e, senza rete, mostra una pagina di cortesia.
// Le pagine vanno sempre in rete (i dati dei pronostici devono essere aggiornati): niente cache dei dati.
const CACHE = "beachpick-v1";
const STATICI = ["/offline.html", "/icone/icona-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATICI)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).catch(() => caches.match("/offline.html")));
    return;
  }
  const u = new URL(r.url);
  if (u.origin === location.origin && (u.pathname.startsWith("/_next/static/") || u.pathname.startsWith("/icone/"))) {
    e.respondWith(
      caches.match(r).then(
        (c) =>
          c ||
          fetch(r).then((res) => {
            const copia = res.clone();
            caches.open(CACHE).then((cc) => cc.put(r, copia));
            return res;
          }),
      ),
    );
  }
});
