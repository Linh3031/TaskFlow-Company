/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Tận dụng lại các biến màu cũ của bạn để dùng cú pháp Tailwind
      // Ví dụ: class="bg-warehouse" hoặc class="text-warehouse"
      colors: {
        warehouse: '#ff9800',
        cashier: '#4caf50',
        handover: '#673ab7',
        completed: '#9e9e9e',
      }
    },
  },
  plugins: [],
}