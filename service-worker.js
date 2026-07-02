const CACHE_NAME = 'ide-pwa-v1';

// Precaching core static assets and essential external libraries
const STATIC_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  
  // CDN Scripts & Stylesheets
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;700&family=JetBrains+Mono&display=swap',
  
  // Pyodide Core Files (guarantees Python works completely offline instantly)
  'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js',
  'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.asm.js',
  'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.asm.wasm',
  'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/python_stdlib.zip',
  'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide-lock.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = event.request.url;

  // Skip unsupported schemes like chrome-extension, data, blob, etc.
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return;
  }

  // Identify CDN and external dependencies (which are versioned/immutable)
  const isCDN = url.includes('cdnjs.cloudflare.com') ||
                url.includes('cdn.jsdelivr.net') ||
                url.includes('fonts.googleapis.com') ||
                url.includes('fonts.gstatic.com');

  if (isCDN) {
    // Cache First for immutable external assets
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((err) => {
            console.warn('Network request failed for CDN resource:', url, err);
          });
        });
      })
    );
  } else {
    // Stale While Revalidate for same-origin resources
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((err) => {
            // Silently fail network update if offline
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
