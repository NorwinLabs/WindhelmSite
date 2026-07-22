// Service Worker for Windhelm Site
// HTML: network-first (so updates ship immediately)
// Static same-origin assets: cache-first (they carry ?v= cache busters)

const CACHE_NAME = "windhelm-v2.1";

// Core assets to cache on install
const PRECACHE_ASSETS = [
  "/",
  "/styles.min.css?v=1.3",
  "/script.min.js?v=1.3",
  "/media/Logo.webp",
  "/media/favicon.png",
  "/media/islandbg.webp",
  "/media/BGVideo-poster.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.log("SW: precache error", err))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests; let the browser handle the rest
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate" || url.pathname.endsWith(".html")) {
    event.respondWith(networkFirst(request));
  } else if (
    /\.(css|js|png|jpg|jpeg|gif|webp|svg|woff2?|ico)$/i.test(
      url.pathname
    )
  ) {
    event.respondWith(cacheFirst(request));
  }
  // Skip caching videos (mp4, webm) - they use range requests (HTTP 206)
  // Let them go straight to network for proper streaming support
});

// Network-first: fresh HTML when online, cached copy offline
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    return (
      cached ||
      new Response("Offline", {
        status: 503,
        statusText: "Service Unavailable",
      })
    );
  }
}

// Cache-first: static assets are versioned via ?v= query strings
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    // Only cache full responses (200), not partial content (206) or other status codes
    if (response.ok && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response("Offline", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}
