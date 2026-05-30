// src/lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ==========================================
// 1. FIREBASE CŨ (Dự án: taskflow-company-41ab3)
// ==========================================
const firebaseConfigOld = {
  apiKey: "AIzaSyDqNsRClI9_ygv-FLn1MeFWxa8DTscu8lI",
  authDomain: "taskflow-company-41ab3.firebaseapp.com",
  projectId: "taskflow-company-41ab3",
  storageBucket: "taskflow-company-41ab3.firebasestorage.app",
  messagingSenderId: "360187172258",
  appId: "1:360187172258:web:2a304a34c222c202d64efb"
};
const app = !getApps().length ? initializeApp(firebaseConfigOld) : getApp();
const db = getFirestore(app);

// ==========================================
// 2. FIREBASE MỚI (Dự án: taskflow-storage-dd622) - LƯU ẢNH
// ==========================================
const firebaseConfigNew = {
  apiKey: "AIzaSyCfPKXNcFhZQa18kgTpcrf9zmLRuq6oltY",
  authDomain: "taskflow-storage-dd622.firebaseapp.com",
  projectId: "taskflow-storage-dd622",
  storageBucket: "taskflow-storage-dd622.firebasestorage.app",
  messagingSenderId: "587190655154",
  appId: "1:587190655154:web:8c662dad1a53f7834ed1ab"
};
const appStorage = initializeApp(firebaseConfigNew, "StorageApp");
const storage = getStorage(appStorage);

// ==========================================
// 3. [MỚI] FIREBASE ĐỌC DỮ LIỆU SKNV TỪ ADMIN (Dự án: qlst-9e6bd)
// ==========================================
const firebaseConfigDoanhThu = {
  apiKey: "AIzaSyAQ3TWcpa4AnTN-32igGseYDlXrCf1BVew",
  authDomain: "qlst-9e6bd.firebaseapp.com",
  projectId: "qlst-9e6bd",
  storageBucket: "qlst-9e6bd.firebasestorage.app",
  messagingSenderId: "2316705291",
  appId: "1:2316705291:web:ebec2963816aea7585b10e",
  measurementId: "G-M0SM0XHCEK"
};
const appDoanhThu = initializeApp(firebaseConfigDoanhThu, "AppDoanhThu");
const dbDoanhThu = getFirestore(appDoanhThu);

// Xuất khẩu cả 3 biến ra ngoài
export { db, storage, dbDoanhThu };