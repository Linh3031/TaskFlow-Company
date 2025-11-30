// public/sw.js
// Version 1.0 - Network First Strategy (Safe for Dev)

const CACHE_NAME = 'taskflow-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.jpeg'
];

// 1. Install Event: Cache các file tĩnh cơ bản
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Kích hoạt ngay lập tức
});

// 2. Activate Event: Dọn dẹp cache cũ
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

// 3. Fetch Event: Network First (Ưu tiên mạng -> Fallback Cache)
self.addEventListener('fetch', (event) => {
  // Chỉ xử lý GET request
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Nếu lấy được từ mạng, copy vào cache cho lần sau (Dynamic Caching)
        // Chỉ cache những request http/https thành công
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Nếu mất mạng (Offline), tìm trong cache
        console.log('[SW] Network failed, serving from cache:', event.request.url);
        return caches.match(event.request)
          .then((response) => {
             // Nếu có trong cache thì trả về
             if (response) return response;
             
             // Nếu không có trong cache (ví dụ ảnh mới), trả về fallback hoặc lỗi
             // Ở đây ta đơn giản trả về null để browser tự xử lý lỗi
             return null;
          });
      })
  );
});