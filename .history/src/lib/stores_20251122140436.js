// src/lib/stores.js
import { writable } from 'svelte/store';

// User hiện tại (null nếu chưa đăng nhập)
const storedUser = localStorage.getItem('taskflow_user');
export const currentUser = writable(storedUser ? JSON.parse(storedUser) : null);

// Danh sách công việc hôm nay
export const currentTasks = writable([]);

// Mẫu Checklist (Template)
export const taskTemplate = writable({});

// Danh sách Kho (Dùng cho Dropdown màn hình đăng nhập)
export const storeList = writable([]);

// Trạng thái Loading toàn ứng dụng
export const isLoading = writable(false);

// Hàm helper để cập nhật User và lưu vào LocalStorage cùng lúc
export const setUser = (user) => {
    currentUser.set(user);
    if (user) {
        localStorage.setItem('taskflow_user', JSON.stringify(user));
    } else {
        localStorage.removeItem('taskflow_user');
    }
};

// Dữ liệu mẫu mặc định
export const DEFAULT_TEMPLATE = {
    warehouse: [
        { time: "08:00", title: "Kiểm tra hàng hóa đầu ca" },
        { time: "17:00", title: "Vệ sinh kho bãi" }
    ],
    cashier: [
        { time: "08:00", title: "Kiểm quỹ đầu ngày" }
    ]
};