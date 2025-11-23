// Version 4.0 - Thêm storeList
import { writable } from 'svelte/store';

export const currentUser = writable(localStorage.getItem('taskflow_user') ? JSON.parse(localStorage.getItem('taskflow_user')) : null);
export const currentTasks = writable([]);
export const taskTemplate = writable({});
export const isLoading = writable(false);

// MỚI: Danh sách kho (để hiển thị Dropdown)
export const storeList = writable([]); 

export const setUser = (user) => {
    currentUser.set(user);
    if (user) localStorage.setItem('taskflow_user', JSON.stringify(user));
    else localStorage.removeItem('taskflow_user');
};

export const DEFAULT_TEMPLATE = {
    warehouse: [{ time: "08:00", title: "Kiểm tra đầu ca" }],
    cashier: [{ time: "08:00", title: "Kiểm quỹ" }]
};