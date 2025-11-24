// public/sw.js
// Version 1.0 - Minimal Service Worker to trigger PWA Install
const CACHE_NAME = 'taskflow-cache-v1';

// 1. Cài đặt: Cache lại các file quan trọng để App chạy nhanh hơn
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Kích hoạt ngay lập tức
});

// 2. Kích hoạt: Xóa cache cũ nếu có
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 3. Fetch: Yêu cầu bắt buộc của PWA (Dù chỉ đơn giản là chuyển tiếp request)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => {
      // Nếu mất mạng, có thể trả về trang offline (để trống logic này sau)
  }));
});