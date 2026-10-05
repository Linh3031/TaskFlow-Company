// Version 42.0 - Thêm Global activeStoreId
import { writable, get } from 'svelte/store';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

// User hiện tại
const storedUser = localStorage.getItem('taskflow_user');
export const currentUser = writable(storedUser ? JSON.parse(storedUser) : null);

// Danh sách công việc
export const currentTasks = writable([]);

// Mẫu Checklist
export const taskTemplate = writable({});

// Danh sách kho
export const storeList = writable([]);

// TRẠNG THÁI KHO TOÀN CỤC (GLOBAL STORE SELECTOR)
export const activeStoreId = writable('');

// CACHE MỚI: Danh sách nhân viên theo Kho
export const storeUsersCache = writable({});

// Trạng thái Loading
export const isLoading = writable(false);

export const setUser = (user) => {
    if (user && !user.storeIds) {
        user.storeIds = user.storeId ? [user.storeId] : [];
    }
    currentUser.set(user);
    if (user) {
        localStorage.setItem('taskflow_user', JSON.stringify(user));
    } else {
        localStorage.removeItem('taskflow_user');
    }
};

// TẢI LẠI HỒ SƠ NGƯỜI DÙNG TỪ FIREBASE (lúc mở app & lúc quay lại app từ nền)
const PROFILE_REFRESH_GAP = 10 * 60 * 1000; // Quay lại từ nền: tối đa 1 lần mỗi 10 phút
const PROFILE_FIELDS = ['username', 'name', 'gender', 'role', 'storeIds', 'storeId', 'maNV', 'pass', 'brand', 'category'];
let lastProfileRefresh = 0; // Mốc lần tải thành công gần nhất

export const refreshCurrentUser = async (force = false) => {
    const cached = get(currentUser);
    if (!cached || !cached.username_idx) return; // Bỏ qua tài khoản demo/setup (không có trên Firebase)
    if (!force && Date.now() - lastProfileRefresh < PROFILE_REFRESH_GAP) return;

    try {
        const snap = await getDocs(query(collection(db, 'users'), where('username_idx', '==', cached.username_idx)));
        if (snap.metadata.fromCache) return; // Không hỏi được máy chủ thì giữ hồ sơ cũ

        const current = get(currentUser);
        if (!current || current.username_idx !== cached.username_idx) return; // Đã đăng xuất/đổi tài khoản trong lúc chờ
        lastProfileRefresh = Date.now();

        if (snap.empty) {
            alert('Tài khoản của bạn đã bị xoá hoặc đổi tên đăng nhập. Vui lòng đăng nhập lại.');
            setUser(null);
            return;
        }

        const docs = snap.docs.map(d => ({ data: d.data(), id: d.id }));
        const picked = docs.find(d => d.data.pass === cached.pass) || docs.find(d => d.id === cached.username_idx) || docs[0];
        const fresh = picked.data;
        if (!fresh.storeIds) fresh.storeIds = fresh.storeId ? [fresh.storeId] : [];

        // So với bản đã lưu ở máy (không bị các chỉnh sửa tạm trong bộ nhớ làm sai lệch)
        let saved = cached;
        try { saved = JSON.parse(localStorage.getItem('taskflow_user')) || cached; } catch (e) { saved = cached; }
        const isChanged = PROFILE_FIELDS.some(f => JSON.stringify(fresh[f] ?? null) !== JSON.stringify(saved[f] ?? null));
        if (!isChanged) return;

        setUser(fresh);

        // Kho đang xem không còn thuộc tài khoản thì chuyển sang kho đầu tiên
        const currentStore = get(activeStoreId);
        if (fresh.role !== 'super_admin' && fresh.storeIds.length > 0 && currentStore && !fresh.storeIds.includes(currentStore)) {
            activeStoreId.set(fresh.storeIds[0]);
        }
    } catch (e) {
        console.warn("Không tải lại được hồ sơ, giữ hồ sơ cũ:", e);
    }
};

export const DEFAULT_TEMPLATE = {
    warehouse: [
        { time: "08:00", title: "Kiểm tra hàng nhập đầu ngày", isImportant: true, days: [0,1,2,3,4,5,6] },
        { time: "09:00", title: "Sắp xếp kệ trưng bày chính", isImportant: false, days: [0,1,2,3,4,5,6] },
        { time: "11:30", title: "Kiểm tra nhiệt độ tủ mát/đông", isImportant: true, days: [0,1,2,3,4,5,6] },
        { time: "14:00", title: "Soạn đơn hàng Online", isImportant: false, days: [0,1,2,3,4,5,6] },
        { time: "17:00", title: "Vệ sinh kho bãi & lối đi", isImportant: false, days: [0,1,2,3,4,5,6] },
        { time: "21:00", title: "Kiểm tra khóa cửa kho & tắt điện", isImportant: true, days: [0,1,2,3,4,5,6] }
    ],
    cashier: [
        { time: "08:00", title: "Kiểm quỹ đầu ca & Vệ sinh quầy", isImportant: true, days: [0,1,2,3,4,5,6] },
        { time: "12:00", title: "Nộp doanh thu ca Sáng", isImportant: true, days: [0,1,2,3,4,5,6] },
        { time: "15:00", title: "Kiểm tra vật tư (bao bì, bill...)", isImportant: false, days: [0,1,2,3,4,5,6] },
        { time: "18:00", title: "Vệ sinh khu vực thu ngân", isImportant: false, days: [0,1,2,3,4,5,6] },
        { time: "21:30", title: "Chốt ca & In báo cáo cuối ngày", isImportant: true, days: [0,1,2,3,4,5,6] }
    ],
    handover: []
};