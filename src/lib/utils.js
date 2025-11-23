// src/lib/utils.js

// Hàm xử lý chuỗi an toàn
export function safeString(val) {
    if (val === undefined || val === null) return '';
    return String(val).trim();
}

// Lấy ngày hiện tại (YYYY-MM-DD)
export function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Định dạng ngày giờ hiển thị
export function formatDateTime(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const mon = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${h}:${m} - ${day}/${mon}`;
}

// Lấy giờ hiện tại ngắn gọn
export function getCurrentTimeShort() {
    const d = new Date();
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}