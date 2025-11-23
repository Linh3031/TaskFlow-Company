// src/lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDqNsRClI9_ygv-FLn1MeFWxa8DTscu8lI",
  authDomain: "taskflow-company-41ab3.firebaseapp.com",
  projectId: "taskflow-company-41ab3",
  storageBucket: "taskflow-company-41ab3.firebasestorage.app",
  messagingSenderId: "360187172258",
  appId: "1:360187172258:web:2a304a34c222c202d64efb"
};

// Khởi tạo Firebase (Singleton Pattern để tránh lỗi khởi tạo nhiều lần)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { db };