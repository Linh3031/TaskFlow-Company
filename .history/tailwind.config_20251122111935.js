/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
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