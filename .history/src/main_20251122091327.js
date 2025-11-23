// src/main.js (Chuẩn Svelte 5)
import { mount } from 'svelte' // Hàm mount mới của Svelte 5
import './app.css' // Nếu bạn chưa có file này thì có thể xóa dòng này hoặc tạo file rỗng
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app