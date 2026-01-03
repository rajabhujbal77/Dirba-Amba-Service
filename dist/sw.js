// Service Worker for Mango Express PWA
// Caches static assets and enables offline functionality

const CACHE_NAME = 'mango-express-v1';
const STATIC_CACHE_NAME = 'mango-static-v1';
const DYNAMIC_CACHE_NAME = 'mango-dynamic-v1';

// Static assets to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.webp',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[ServiceWorker] Static assets cached');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[ServiceWorker] Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activating...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== STATIC_CACHE_NAME && name !== DYNAMIC_CACHE_NAME)
                        .map((name) => {
                            console.log('[ServiceWorker] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[ServiceWorker] Activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip development mode requests (Vite HMR, source files, etc.)
    if (
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.pathname.endsWith('.tsx') ||
        url.pathname.endsWith('.ts') ||
        url.pathname.endsWith('.jsx') ||
        url.pathname.includes('/@') ||
        url.pathname.includes('/node_modules/') ||
        url.pathname.includes('?') // Skip requests with query params (Vite cache busting)
    ) {
        return;
    }

    // Skip API requests (Supabase) - always go to network
    if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) {
        return;
    }

    // For navigation requests, use network-first strategy
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone and cache the response
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE_NAME)
                        .then((cache) => cache.put(request, responseClone));
                    return response;
                })
                .catch(() => {
                    // If offline, try to serve from cache
                    return caches.match(request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Fall back to cached index.html for SPA routing
                            return caches.match('/index.html');
                        });
                })
        );
        return;
    }

    // For static assets (JS, CSS, images), use cache-first strategy
    if (
        url.pathname.startsWith('/assets/') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.webp') ||
        url.pathname.endsWith('.woff2')
    ) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // Return cached version immediately
                        return cachedResponse;
                    }
                    // Not in cache, fetch from network and cache it
                    return fetch(request)
                        .then((response) => {
                            if (!response || response.status !== 200) {
                                return response;
                            }
                            const responseClone = response.clone();
                            caches.open(DYNAMIC_CACHE_NAME)
                                .then((cache) => cache.put(request, responseClone));
                            return response;
                        });
                })
        );
        return;
    }

    // For everything else, use network-first
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (!response || response.status !== 200) {
                    return response;
                }
                const responseClone = response.clone();
                caches.open(DYNAMIC_CACHE_NAME)
                    .then((cache) => cache.put(request, responseClone));
                return response;
            })
            .catch(() => caches.match(request))
    );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
