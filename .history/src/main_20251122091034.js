import './app.css' // (Nếu có file css chung, không có thì vite tự bỏ qua hoặc bạn tạo file rỗng)
import App from './App.svelte'

const app = new App({
  target: document.getElementById('app'),
})

export default app