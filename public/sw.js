// Control de Portafolio — service worker
// Strategy:
//   - Navigation/HTML: NETWORK-FIRST (always get latest app shell -> latest JS bundle)
//   - Hashed assets (/assets/*): cache-first (safe, content-hashed by Vite)
//   - /api/*: network-first with cache fallback
//   - Other same-origin GET: stale-while-revalidate

const VERSION = "v4";
const STATIC_CACHE = `portafolio-static-${VERSION}`;
const API_CACHE = `portafolio-api-${VERSION}`;

self.addEventListener("install", (event) => {
  // Activate immediately, don't wait for old SW to be released
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  // API: network-first, fallback to cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(API_CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request).then(r => r || new Response(
          JSON.stringify({ error: "offline" }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )))
    );
    return;
  }

  // Navigation / HTML documents: NETWORK-FIRST so updates always land.
  const isNavigation = event.request.mode === "navigate" ||
    (event.request.headers.get("accept") || "").includes("text/html");
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match("/index.html")))
    );
    return;
  }

  // Hashed static assets & everything else: stale-while-revalidate.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
