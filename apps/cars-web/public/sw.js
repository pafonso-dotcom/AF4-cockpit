// AF4 Cockpit Service Worker — v4
// - Network-first pra navegação (HTML/index) — sempre carrega versão fresca
// - Cache-first pra assets (JS/CSS/imagens) — performance
// - APIs externas (Brapi, CoinGecko) — network only
// Sempre que mudar a UI, bump a versão CACHE pra invalidar tudo do cliente.

const CACHE = "af4-cockpit-v1782200000";
const PRECACHE = ["./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // External APIs — pass-through, sem cache
  if (url.origin !== location.origin) return;

  const isNavigation =
    e.request.mode === "navigate" ||
    (e.request.method === "GET" &&
      (e.request.headers.get("accept") || "").includes("text/html"));

  // Navegação: NETWORK-FIRST (HTML sempre fresco)
  if (isNavigation) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((hit) => hit || caches.match("./index.html"))
        )
    );
    return;
  }

  // Assets (JS/CSS/img/fonts): CACHE-FIRST com fallback rede
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => hit);
    })
  );
});
