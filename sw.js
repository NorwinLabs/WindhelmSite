// Service Worker for Windhelm Site
// Cache static assets and implement efficient loading strategies

const CACHE_NAME = "windhelm-v1.3";
const STATIC_CACHE = "windhelm-static-v1.3";
const DYNAMIC_CACHE = "windhelm-dynamic-v1.3";

// Assets to cache immediately
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.min.css",
  "/script.min.js",
  "/media/Logo.png",
  "/media/favicon.png",
  "/media/islandbg.png",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap",
];

// Assets to cache on demand
const CACHE_ON_DEMAND = ["/media/", "https://fonts.gstatic.com/"];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("Service Worker: Caching static assets");
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) =>
        console.log("Service Worker: Error caching static assets", err)
      )
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log("Service Worker: Deleting old cache", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip Chrome extension requests
  if (url.protocol === "chrome-extension:") {
    return;
  }

  // Handle different types of requests
  if (isStaticAsset(request.url)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isImageRequest(request.url)) {
    event.respondWith(handleImageRequest(request));
  } else if (isFontRequest(request.url)) {
    event.respondWith(handleFontRequest(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

// Check if request is for a static asset
function isStaticAsset(url) {
  return STATIC_ASSETS.some((asset) => url.includes(asset));
}

// Check if request is for an image
function isImageRequest(url) {
  return (
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) || url.includes("/images/")
  );
}

// Check if request is for a font
function isFontRequest(url) {
  return (
    url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")
  );
}

// Handle static assets - cache first strategy
async function handleStaticAsset(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const cache = await caches.open(STATIC_CACHE);
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("Service Worker: Error handling static asset", error);
    return new Response("Offline", { status: 503 });
  }
}

// Handle images - cache first with fallback
async function handleImageRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const cache = await caches.open(DYNAMIC_CACHE);
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Only cache images smaller than 5MB
      const contentLength = networkResponse.headers.get("content-length");
      if (!contentLength || parseInt(contentLength) < 5 * 1024 * 1024) {
        cache.put(request, networkResponse.clone());
      }
    }

    return networkResponse;
  } catch (error) {
    console.log("Service Worker: Error loading image", error);

    // Return a placeholder image or cached fallback
    const fallbackImage = await caches.match("/images/default-image.jpg");
    return fallbackImage || new Response("Image unavailable", { status: 503 });
  }
}

// Handle fonts - cache first strategy
async function handleFontRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const cache = await caches.open(STATIC_CACHE);
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("Service Worker: Error loading font", error);
    return new Response("Font unavailable", { status: 503 });
  }
}

// Handle dynamic requests - network first with cache fallback
async function handleDynamicRequest(request) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);

    // Try network first
    try {
      const networkResponse = await fetch(request, {
        timeout: 3000, // 3 second timeout
      });

      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    } catch (networkError) {
      // Network failed, try cache
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      throw networkError;
    }
  } catch (error) {
    console.log("Service Worker: Error handling dynamic request", error);

    // Return offline page if available
    const offlinePage = await caches.match("/offline.html");
    return (
      offlinePage ||
      new Response("Offline", {
        status: 503,
        statusText: "Service Unavailable",
      })
    );
  }
}

// Background sync for form submissions
self.addEventListener("sync", (event) => {
  if (event.tag === "contact-form") {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  try {
    // Get pending form submissions from IndexedDB
    const pendingSubmissions = await getPendingSubmissions();

    for (const submission of pendingSubmissions) {
      try {
        const response = await fetch(submission.url, {
          method: "POST",
          body: submission.data,
        });

        if (response.ok) {
          await removePendingSubmission(submission.id);

          // Notify the client of successful submission
          const clients = await self.clients.matchAll();
          clients.forEach((client) => {
            client.postMessage({
              type: "FORM_SUBMITTED",
              success: true,
              id: submission.id,
            });
          });
        }
      } catch (error) {
        console.log("Background sync failed for submission:", error);
      }
    }
  } catch (error) {
    console.log("Background sync error:", error);
  }
}

// IndexedDB helpers for offline form submissions
async function getPendingSubmissions() {
  // Implementation would use IndexedDB to store pending submissions
  return [];
}

async function removePendingSubmission(id) {
  // Implementation would remove submission from IndexedDB
  return true;
}

// Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: "/images/favicon.png",
    badge: "/images/favicon.png",
    data: data.url,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.notification.data) {
    event.waitUntil(clients.openWindow(event.notification.data));
  }
});

console.log("Service Worker: Loaded and ready");
