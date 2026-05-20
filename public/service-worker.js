const CACHE_NAME = 'sobrevivencia-rural-v13';

const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './assets.js',
  './controls.js',
  './firebase-service.js',
  './game.js',
  './save-system.js',
  './pwa.js',
  './service-worker.js',
  './manifest.json',
  './assets/icons/icon-512.png',
  './assets/audio/dia.mp3',
  './assets/audio/noite.mp3',
  './assets/audio/latido.mp3',
  './assets/sprites/house/house.png',
  './assets/sprites/galinha/sprite_04.png',
  './assets/sprites/galinha/sprite_05.png',
  './assets/sprites/galinha/sprite_06.png',
  './assets/sprites/galinha/sprite_07.png',
  './assets/sprites/player/adventurer_idle.png',
  './assets/sprites/player/adventurer_back.png',
  './assets/sprites/player/adventurer_walk1.png',
  './assets/sprites/player/adventurer_walk2.png',
  './assets/sprites/player/adventurer_action1.png',
  './assets/sprites/player/adventurer_action2.png',
  './assets/sprites/player/adventurer_hurt.png',
  './assets/sprites/player/adventurer_kick.png',
  './assets/sprites/zombie/zombie_idle.png',
  './assets/sprites/zombie/zombie_walk1.png',
  './assets/sprites/zombie/zombie_walk2.png',
  './assets/sprites/zombie/zombie_hurt.png',
  './assets/sprites/zombie/zombie_action1.png',
  './assets/sprites/zombie/zombie_action2.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET')return;

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request).then(fetchResponse => {
        const requestUrl = new URL(event.request.url);

        if(requestUrl.origin === self.location.origin && fetchResponse.ok){
          const responseClone = fetchResponse.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
        }

        return fetchResponse;
      }))
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
