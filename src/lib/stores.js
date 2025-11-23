// Version 5.0 - Full Store Logic
import { writable } from 'svelte/store';

// User hiện tại (null nếu chưa đăng nhập)
const storedUser = localStorage.getItem('taskflow_user');
export const currentUser = writable(storedUser ? JSON.parse(storedUser) : null);

// Danh sách công việc hôm nay (Tổng hợp từ các kho)
export const currentTasks = writable([]);

// Mẫu Checklist (Thường lấy từ kho chính để hiển thị)
export const taskTemplate = writable({});

// Danh sách tất cả các kho (Dùng cho Admin chọn)
export const storeList = writable([]);

// Trạng thái Loading toàn ứng dụng
export const isLoading = writable(false);

// Hàm helper để cập nhật User và lưu vào LocalStorage cùng lúc
export const setUser = (user) => {
    // Chuẩn hóa dữ liệu: Đảm bảo luôn có storeIds là mảng
    // Nếu dữ liệu cũ chỉ có storeId string, chuyển nó thành mảng 1 phần tử
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