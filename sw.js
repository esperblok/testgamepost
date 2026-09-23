/**
 * SpaceBlox — service worker
 *
 * Strategie:
 *   • HTML        → netwerk eerst, cache als back-up (altijd de nieuwste versie)
 *   • css/js/afbeeldingen → cache eerst (verandert zelden, sneller laden)
 *   • navigaties die offline mislukken → de homepage uit de cache
 *
 * Belangrijk: verhoog CACHE bij elke wijziging, anders blijven bezoekers
 * een oude versie zien.
 */
const CACHE = 'spaceblox-v5';

const SHELL = [
  './',
  './index.html',
  './dashboard.html',
  './profile.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './assets/css/app.css',
  './assets/css/home.css',
  './assets/css/shell.css',
  './assets/css/avatar.css',
  './assets/css/dashboard.css',
  './assets/js/store.js',
  './assets/js/auth.js',
  './assets/js/admin.config.js',
  './assets/js/games.js',
  './assets/js/juice.js',
  './assets/js/avatar.js',
  './assets/js/shell.js',
  './assets/js/home.js',
  './assets/js/profile.js',
  './assets/js/dashboard.js',
  './assets/img/race.jpg',
  './assets/img/snake.jpg',
  './assets/img/shooter.jpg',
  './assets/img/racer.jpg',
  './assets/img/dino.jpg',
  './assets/img/blockrun.jpg',
  './assets/img/pong.jpg',
  './assets/img/memory.jpg',
  './assets/img/guess.jpg',
  './assets/img/clicker.jpg',
  './assets/img/orlog.jpg',
  './assets/img/moon.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll faalt helemaal als één bestand mist; per bestand proberen
      // houdt de installatie werken als er iets niet bestaat.
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHtml = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHtml) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
