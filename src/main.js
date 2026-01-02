// Version 3.0 - Svelte 5 Mount Fix + PWA Debug Mode
import { mount } from 'svelte' // BẮT BUỘC CHO SVELTE 5
import './app.css'
import App from './App.svelte'

// --- PWA LOGIC (Chế độ Debug cho phép chạy Local) ---
if ('serviceWorker' in navigator) {
  // Logic: Chạy SW kể cả khi ở Localhost để fix lỗi hiển thị
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker Active:', registration.scope);
      })
      .catch((err) => {
        console.log('❌ Service Worker Fail:', err);
      });
  });
}
// ----------------------------------------------------

// KHỞI TẠO APP (CÚ PHÁP SVELTE 5)
// Thay thế cho new App(...) gây lỗi
const app = mount(App, {
  target: document.getElementById('app'),
})

export default app