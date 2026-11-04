/* LEL farm app service worker.
   - App shell (page, manifest, icons) and Chart.js: cache-first, so the app opens with no signal.
   - ArcGIS data queries: network-first (8 s), falling back to the last saved copy. A fallback response carries
     X-LEL-Cache: 1 and X-LEL-Cached-At so the page can say "showing saved data from <date>".
   Bump CACHE_VERSION whenever the page or this file changes, so phones pick up the new version. */
const CACHE_VERSION = 'lel-farm-v5';
const SHELL_CACHE = CACHE_VERSION + '-shell';
const DATA_CACHE = CACHE_VERSION + '-data';
const DATA_HOST = 'services6.arcgis.com';
const NETWORK_TIMEOUT_MS = 8000;

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // the page itself is cached on first load (it is the navigation request); icons and manifest up front
      return cache.addAll(['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']).catch(function(){});
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf(CACHE_VERSION) !== 0; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function withTimeout(promise, ms) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
    promise.then(function (r) { clearTimeout(t); resolve(r); }, function (e) { clearTimeout(t); reject(e); });
  });
}

function networkFirstData(request) {
  return withTimeout(fetch(request), NETWORK_TIMEOUT_MS).then(function (response) {
    if (response && response.ok) {
      // Stamp our own save time: ArcGIS's Date header isn't readable cross-origin.
      var copy = response.clone();
      copy.blob().then(function (body) {
        var h = new Headers(copy.headers);
        h.set('X-LEL-Saved-At', new Date().toISOString());
        return caches.open(DATA_CACHE).then(function (c) { return c.put(request, new Response(body, { status: 200, headers: h })); });
      }).catch(function () {});
    }
    return response;
  }).catch(function () {
    return caches.open(DATA_CACHE).then(function (c) { return c.match(request); }).then(function (cached) {
      if (!cached) return Response.error();
      var headers = new Headers(cached.headers);
      headers.set('X-LEL-Cache', '1');
      headers.set('X-LEL-Cached-At', cached.headers.get('X-LEL-Saved-At') || '');
      return cached.blob().then(function (body) { return new Response(body, { status: 200, headers: headers }); });
    });
  });
}

function cacheFirst(request) {
  return caches.match(request).then(function (hit) {
    if (hit) return hit;
    return fetch(request).then(function (response) {
      if (response && (response.ok || response.type === 'opaque')) {
        var copy = response.clone();
        caches.open(SHELL_CACHE).then(function (c) { c.put(request, copy); });
      }
      return response;
    });
  });
}

function staleWhileRevalidatePage(request) {
  return caches.open(SHELL_CACHE).then(function (c) {
    return c.match(request, { ignoreSearch: true }).then(function (hit) {
      var fresh = fetch(request).then(function (response) {
        if (response && response.ok) c.put(request, response.clone());
        return response;
      }).catch(function () { return hit; });
      return hit || fresh;
    });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin && url.pathname.endsWith('/sw.js')) return;   // never serve the worker itself from cache
  if (url.hostname === DATA_HOST) { event.respondWith(networkFirstData(req)); return; }
  if (req.mode === 'navigate') { event.respondWith(staleWhileRevalidatePage(req)); return; }
  if (url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net') { event.respondWith(cacheFirst(req)); }
});
