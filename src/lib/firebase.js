// src/lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Import thêm Storage

// ==========================================
// 1. FIREBASE CŨ (Dự án: taskflow-company-41ab3)
// Dùng cho Auth và Database (Text, Lịch ca, Nhân viên)
// ==========================================
const firebaseConfigOld = {
  apiKey: "AIzaSyDqNsRClI9_ygv-FLn1MeFWxa8DTscu8lI",
  authDomain: "taskflow-company-41ab3.firebaseapp.com",
  projectId: "taskflow-company-41ab3",
  storageBucket: "taskflow-company-41ab3.firebasestorage.app",
  messagingSenderId: "360187172258",
  appId: "1:360187172258:web:2a304a34c222c202d64efb"
};

// Khởi tạo app mặc định (Singleton Pattern)
const app = !getApps().length ? initializeApp(firebaseConfigOld) : getApp();
const db = getFirestore(app);


// ==========================================
// 2. FIREBASE MỚI (Dự án: taskflow-storage-dd622)
// CHỈ DÙNG ĐỂ LƯU ẢNH 8NTTT
// ==========================================
const firebaseConfigNew = {
  apiKey: "AIzaSyCfPKXNcFhZQa18kgTpcrf9zmLRuq6oltY",
  authDomain: "taskflow-storage-dd622.firebaseapp.com",
  projectId: "taskflow-storage-dd622",
  storageBucket: "taskflow-storage-dd622.firebasestorage.app",
  messagingSenderId: "587190655154",
  appId: "1:587190655154:web:8c662dad1a53f7834ed1ab"
};

// Khởi tạo app thứ 2 với tên định danh là "StorageApp"
// (Nếu không đặt tên, Firebase sẽ báo lỗi đụng độ với app cũ)
const appStorage = initializeApp(firebaseConfigNew, "StorageApp");
const storage = getStorage(appStorage);

// Export cả db (cũ) và storage (mới) ra để các file Svelte sử dụng
export { db, storage };