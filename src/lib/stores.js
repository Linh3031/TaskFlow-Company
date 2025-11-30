// Version 6.0 - Update Default Template (Standard 908)
import { writable } from 'svelte/store';

// User hiện tại (null nếu chưa đăng nhập)
const storedUser = localStorage.getItem('taskflow_user');
export const currentUser = writable(storedUser ? JSON.parse(storedUser) : null);

// Danh sách công việc hôm nay
export const currentTasks = writable([]);

// Mẫu Checklist
export const taskTemplate = writable({});

// Danh sách kho
export const storeList = writable([]);

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

// DỮ LIỆU MẪU MẶC ĐỊNH (CHUẨN KHO 908)
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
    handover: [] // Bàn giao thường nhập tay theo tình huống
};