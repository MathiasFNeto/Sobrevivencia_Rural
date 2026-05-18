const CACHE_NAME = 'sobrevivencia-rural-v2';

const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.json',
  './assets/icons/icon-512.png',
  './assets/audio/dia.mp3',
  './assets/audio/noite.mp3',
  './assets/audio/latido.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if(key !== CACHE_NAME){
            return caches.delete(key);
          }
        })
      )
    )
  );

  self.clients.claim();
});