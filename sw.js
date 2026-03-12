const CACHE_NAME = 'routine-tracker-v3';
const ASSETS = [
    './',
    './index.html',
    './auth.html',
    './style.css',
    './auth.css',
    './app.js',
    './supabase.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
];

// Install — cache all assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — network-first for Supabase, cache-first for everything else
self.addEventListener('fetch', (e) => {
    // Only handle GET requests
    if (e.request.method !== 'GET') return;

    const url = new URL(e.request.url);

    // Always go to network for Supabase auth/API requests
    if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
        e.respondWith(fetch(e.request));
        return;
    }

    e.respondWith(
        caches.match(e.request).then((cached) => {
            return cached || fetch(e.request).then((response) => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                }
                return response;
            });
        }).catch(() => {
            if (e.request.mode === 'navigate') {
                return caches.match('./auth.html');
            }
        })
    );
});
