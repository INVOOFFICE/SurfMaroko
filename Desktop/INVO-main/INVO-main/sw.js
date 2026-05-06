// ═══════════════════════════════════════════
//  sw.js  —  Service Worker INVO
//  Stratégies de cache pour mode hors-ligne
// ═══════════════════════════════════════════

/** Nom du cache statique — incrémenter (ex. invo-v3) pour invalider tout le précache. */
const CACHE_NAME = 'invo-v13';
/** Mettre à true uniquement en dev : logs fetch dans networkFirstNoCache */
const SW_DEBUG = false;

// ── Ressources locales à pré-cacher au install (shell complet, 1er chargement hors-ligne) ──
// Inclut les @import de css/style.css (sinon hors-ligne les feuilles partielles ne sont pas en cache).
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './paiement.html',
  './manifest.json',
  './icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './screenshots/screenshot-desktop.png',
  './screenshots/screenshot-mobile.png',
  './css/fonts-plus-jakarta.css',
  './css/style.css',
  './css/tokens.css',
  './css/components-core.css',
  './css/pages/layout-shell.css',
  './css/pages/auth.css',
  './css/pages/surfaces-doc.css',
  './css/pages/tables-widgets.css',
  './css/pages/app-chrome.css',
  './css/pages/help-search-skeleton.css',
  './css/pages/panels-charts-domain.css',
  './css/pages/pdf-preview.css',
  './css/pages/templates-mobile-static.css',
  './css/pages/responsive.css',
  './css/paiement-licence.css',
  './assets/fonts/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2',
  './assets/fonts/plus-jakarta-sans/files/plus-jakarta-sans-latin-500-normal.woff2',
  './assets/fonts/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2',
  './assets/fonts/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2',
  './assets/fonts/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2',
  './js/vendor/purify.min.js',
  './js/vendor/papaparse.min.js',
  './js/vendor/jspdf.umd.min.js',
  './js/vendor/html2canvas.min.js',
  './js/vendor/chart.umd.min.js',
  './js/vendor/xlsx.full.min.js',
  './js/vendor/flatpickr.min.js',
  './js/vendor/flatpickr.min.css',
  './js/vendor/flatpickr-fr.js',
  './js/csv-parse.js',
  './js/sanitize.js',
  './js/html-safe.js',
  './js/storage.js',
  './js/license-activation.js',
  './js/auth-templates.js',
  './js/auth.js',
  './js/ui.js',
  './js/pdf.js',
  './js/backup.js',
  './js/supabase-sync.js',
  './js/products.js',
  './js/imports.js',
  './js/clients.js',
  './js/invoices.js',
  './js/price-mode.js',
  './js/docs.js',
  './js/fournisseurs.js',
  './js/bons-commande.js',
  './js/app.js',
  './js/events.js',
  './js/page-templates.js',
  './sw-register.js',
];

// FETCH (same-origin) : Cache First = shell + assets statiques listés ci-dessus / dérivés (js, css, fonts, images).
// Network First = tout le reste (ex. futures routes JSON/API ou fichiers non reconnus comme statiques).

/** PWA store / marketing uniquement — échec = avertissement, pas de blocage d’installation. */
function isOptionalPrecacheUrl(url) {
  return String(url).includes('screenshots');
}

function precacheOne(cache, url) {
  return cache.add(url).then(
    () => ({ url, ok: true }),
    err => ({ url, ok: false, err }),
  );
}

function broadcastToClients(message) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
    for (const client of clientList) {
      try {
        client.postMessage(message);
      } catch (_) {}
    }
  });
}

// ════════════════════════════════════════
//  INSTALL — pré-cacher l’app shell
// ════════════════════════════════════════
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      const optionalUrls = PRECACHE_ASSETS.filter(isOptionalPrecacheUrl);
      const criticalUrls = PRECACHE_ASSETS.filter(u => !isOptionalPrecacheUrl(u));

      const criticalOut = await Promise.all(criticalUrls.map(u => precacheOne(cache, u)));
      const criticalFailed = criticalOut.filter(r => !r.ok);
      if (criticalFailed.length) {
        const urls = criticalFailed.map(f => f.url);
        console.error(
          '[SW] Precache critique incomplet — installation annulée (ancien service worker reste actif):',
          urls,
        );
        await caches.delete(CACHE_NAME);
        await broadcastToClients({ type: 'SW_PRECACHE_CRITICAL_FAILED', urls });
        const err = new Error(`SW precache critical failed: ${urls.join(', ')}`);
        err.failedUrls = urls;
        throw err;
      }

      const optionalOut = await Promise.all(optionalUrls.map(u => precacheOne(cache, u)));
      const optionalFailed = optionalOut.filter(r => !r.ok);
      if (optionalFailed.length) {
        const urls = optionalFailed.map(f => f.url);
        console.warn('[SW] Precache optionnel incomplet (captures PWA):', urls);
        await broadcastToClients({ type: 'SW_PRECACHE_OPTIONAL_FAILED', urls });
      }

      console.log('[SW] App shell pré-cachée — mode hors-ligne prêt');
      await self.skipWaiting();
    }),
  );
});

// ════════════════════════════════════════
//  ACTIVATE — purger les caches obsolètes, prise de contrôle immédiate
// ════════════════════════════════════════
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Suppression ancien cache:', name);
            return caches.delete(name);
          }
          return Promise.resolve();
        }),
      );
      await self.clients.claim();
    })(),
  );
});

// ════════════════════════════════════════
//  FETCH — stratégies par type de ressource
// ════════════════════════════════════════
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  if (url.protocol === 'chrome-extension:') return;

  if (url.origin === self.location.origin) {
    if (isAppShellRequest(event.request, url)) {
      event.respondWith(cacheFirst(event.request, CACHE_NAME));
    } else {
      event.respondWith(networkFirstNoCache(event.request));
    }
    return;
  }

  // Aucune ressource tierce attendue (CSP + app locale)
});

// ════════════════════════════════════════
//  STRATÉGIES DE CACHE
// ════════════════════════════════════════

function appDirectoryHref() {
  return new URL('./', self.location).href;
}

function indexHtmlAbsoluteUrl() {
  return new URL('index.html', appDirectoryHref()).href;
}

async function matchCachedSameOrigin(request, cacheName) {
  const cache = await caches.open(cacheName);
  let r = await cache.match(request, { ignoreSearch: true });
  if (r) return r;
  r = await caches.match(request);
  if (r) return r;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return null;

  const nav =
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    (request.headers.get('accept') || '').includes('text/html');
  if (!nav) return null;

  const indexUrl = indexHtmlAbsoluteUrl();
  const dirUrl = appDirectoryHref();
  const candidates = [indexUrl, dirUrl, `${dirUrl}index.html`];
  for (const u of candidates) {
    r = await cache.match(u);
    if (r) return r;
  }
  return null;
}

async function cacheFirst(request, cacheName) {
  let cached = await matchCachedSameOrigin(request, cacheName);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] Ressource non disponible hors-ligne:', request.url);
    return offlineFallback(request);
  }
}

async function networkFirstNoCache(request) {
  try {
    return await fetch(request);
  } catch (err) {
    if (SW_DEBUG) {
      console.warn('[SW] networkFirstNoCache échec:', request.url, err?.message);
    }
    return offlineFallback(request);
  }
}

async function offlineFallback(request) {
  const url = new URL(request.url);

  if (request.headers.get('accept')?.includes('text/html')) {
    const cache = await caches.open(CACHE_NAME);
    const indexUrl = indexHtmlAbsoluteUrl();
    let r = await cache.match(request, { ignoreSearch: true });
    if (!r) {
      r =
        (await cache.match(indexUrl)) ||
        (await cache.match(appDirectoryHref())) ||
        (await caches.match(indexUrl)) ||
        (await caches.match('./index.html'));
    }
    return r || new Response('', { status: 503, statusText: 'Service Unavailable' });
  }

  if (url.pathname.endsWith('.js')) {
    return new Response('/* INVO SW: script indisponible hors-ligne */', {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }

  if (url.pathname.endsWith('.css')) {
    return new Response('/* INVO SW: CSS indisponible hors-ligne */', {
      headers: { 'Content-Type': 'text/css; charset=utf-8' },
    });
  }

  return new Response('', { status: 503, statusText: 'Service Unavailable' });
}

function isAppShellRequest(request, url) {
  const pathname = url.pathname || '';

  if (request.mode === 'navigate' || request.destination === 'document') return true;

  if (pathname === '/' || pathname.endsWith('/index.html')) return true;
  if (pathname.endsWith('privacy.html')) return true;
  if (pathname.endsWith('manifest.json')) return true;
  if (pathname.endsWith('.js') || pathname.endsWith('.css') || pathname.endsWith('.svg')) return true;
  if (pathname.endsWith('.png') || pathname.endsWith('.ico')) return true;
  if (pathname.endsWith('.woff2')) return true;
  if (
    pathname.includes('/js/') ||
    pathname.includes('/css/') ||
    pathname.includes('/icons/') ||
    pathname.includes('/screenshots/')
  )
    return true;
  if (pathname.includes('/assets/')) return true;

  return false;
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
