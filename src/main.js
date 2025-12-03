// src/main.js
// Version 1.2 - Fix PWA Error on Localhost
import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// --- ĐĂNG KÝ PWA (CẬP NHẬT AN TOÀN) ---
// Chỉ chạy khi trình duyệt hỗ trợ VÀ ĐANG Ở CHẾ ĐỘ PRODUCTION (Đã Build)
// import.meta.env.PROD trả về true khi build, false khi chạy dev (localhost)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('✅ PWA Registered:', registration.scope);
        
        // Kiểm tra update
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker == null) return;
          
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('🔄 New content available, please refresh.');
              } else {
                console.log('✅ Content is cached for offline use.');
              }
            }
          };
        };
      })
      .catch(err => {
        console.error('❌ SW Registration Failed:', err);
      });
  });
} else {
  console.log('🚧 PWA Service Worker is disabled in Development mode.');
}
// ----------------------------------

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app