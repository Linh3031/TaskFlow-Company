// src/main.js
import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// --- ĐOẠN CODE MỚI: ĐĂNG KÝ PWA ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('✅ App đã sẵn sàng để cài đặt: ', registration.scope);
      })
      .catch(err => {
        console.log('❌ Lỗi Service Worker: ', err);
      });
  });
}
// ----------------------------------

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app