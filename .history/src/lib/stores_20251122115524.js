// Version 3.0 - Support Multi-Warehouse
import { writable } from 'svelte/store';

// User hiện tại
const storedUser = localStorage.getItem('taskflow_user');
export const currentUser = writable(storedUser ? JSON.parse(storedUser) : null);

// Danh sách công việc (sẽ lọc theo kho)
export const currentTasks = writable([]);

// Mẫu Checklist (sẽ load theo kho)
export const taskTemplate = writable({});

export const isLoading = writable(false);

export const setUser = (user) => {
    currentUser.set(user);
    if (user) {
        localStorage.setItem('taskflow_user', JSON.stringify(user));
    } else {
        localStorage.removeItem('taskflow_user');
    }
};

// Mẫu mặc định (Fallback nếu kho mới chưa có mẫu)
export const DEFAULT_TEMPLATE = {
    warehouse: [
        { time: "08:00", title: "Kiểm tra hàng hóa đầu ca" },
        { time: "17:00", title: "Vệ sinh kho bãi" }
    ],
    cashier: [
        { time: "08:00", title: "Kiểm quỹ đầu ngày" }
    ]
};