// src/main.js
// Version 1.1 - Safe PWA Registration
import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// --- ĐĂNG KÝ PWA (CẬP NHẬT AN TOÀN) ---
// Chỉ chạy khi trình duyệt hỗ trợ
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Lưu ý: Trong lúc Dev (localhost), SW đôi khi gây phiền toái vì cache quá mạnh.
    // Nếu muốn tắt ở chế độ Dev, hãy dùng: if (import.meta.env.PROD) { ... }
    
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
}
// ----------------------------------

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app