// public/sw.js
// Version 2.1 - Fix Chrome Extension Error + Network First
const CACHE_NAME = 'taskflow-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.jpeg'
];

// 1. Install Event: Cache file tĩnh
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Dọn cache cũ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// 3. Fetch Event: Xử lý request mạng
self.addEventListener('fetch', (event) => {
  // --- [FIX] CHẶN LỖI CHROME EXTENSION ---
  // Nếu request không bắt đầu bằng 'http' (vd: chrome-extension://, data://), bỏ qua ngay
  if (!event.request.url.startsWith('http')) return;

  // Chỉ xử lý GET request
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Nếu lấy được từ mạng, copy vào cache
        // Kiểm tra kỹ response hợp lệ mới cache
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          })
          .catch(err => {
             // Bắt lỗi cache phụ (nếu có) để không crash app
             console.warn('[SW] Cache Error:', err);
          });

        return response;
      })
      .catch(() => {
        // Nếu mất mạng (Offline), tìm trong cache
        return caches.match(event.request)
          .then((response) => {
             if (response) return response;
             // Có thể trả về trang offline.html ở đây nếu muốn
             return null; 
          });
      })
  );
});