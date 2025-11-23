// src/lib/stores.js
import { writable } from 'svelte/store';

// User hiện tại
const storedUser = localStorage.getItem('taskflow_user');
export const currentUser = writable(storedUser ? JSON.parse(storedUser) : null);

// Danh sách công việc (Tổng hợp từ nhiều kho)
export const currentTasks = writable([]);

// Mẫu Checklist (Load từ kho chính)
export const taskTemplate = writable({});

// Danh sách tất cả các kho (Dùng cho Admin chọn)
export const storeList = writable([]);

// Trạng thái Loading
export const isLoading = writable(false);

// Hàm helper cập nhật User
export const setUser = (user) => {
    // Chuẩn hóa dữ liệu: Đảm bảo luôn có storeIds là mảng
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

export const DEFAULT_TEMPLATE = {
    warehouse: [
        { time: "08:00", title: "Kiểm tra hàng hóa đầu ca" },
        { time: "17:00", title: "Vệ sinh kho bãi" }
    ],
    cashier: [
        { time: "08:00", title: "Kiểm quỹ đầu ngày" }
    ]
};