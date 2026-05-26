// Control de Portafolio — service worker
// Strategy: cache-first for static assets, network-first for /api/* with fallback to cached response.

const STATIC_CACHE = "portafolio-static-v2";
const API_CACHE = "portafolio-api-v2";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Don't intercept non-GET
  if (event.request.method !== "GET") return;

  // API routes: network-first, fallback to cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(API_CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request).then(r => r || new Response(JSON.stringify({ error: "offline" }), {
          status: 503, headers: { "Content-Type": "application/json" }
        })))
    );
    return;
  }

  // Static assets / navigation: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.ok && (url.origin === self.location.origin)) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match("/index.html"));
    })
  );
});
