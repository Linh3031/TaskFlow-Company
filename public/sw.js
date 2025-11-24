// Version 1.1 - Fix Install Prompt
const CACHE_NAME = 'taskflow-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Logic đơn giản nhất để Chrome nhận diện đây là PWA
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
  }
});