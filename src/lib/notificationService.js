// src/lib/notificationService.js
// Nơi DUY NHẤT tạo/đánh dấu thông báo (cái chuông). Các tính năng gọi lại hàm ở đây, không tự addDoc vào 'notifications'.
import { db } from './firebase';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';

// Gửi 1 thông báo cho nhiều người: gộp 1 lần ghi (batch), bỏ người trùng/rỗng
export async function sendNotifications(toUsers, payload) {
    const targets = [...new Set((toUsers || []).filter(Boolean))];
    if (targets.length === 0) return;
    const batch = writeBatch(db);
    targets.forEach(toUser => {
        batch.set(doc(collection(db, 'notifications')), {
            ...payload,
            toUser,
            isRead: false,
            createdAt: serverTimestamp()
        });
    });
    await batch.commit();
}

export async function markNotificationsRead(ids) {
    const unique = [...new Set((ids || []).filter(Boolean))];
    if (unique.length === 0) return;
    const batch = writeBatch(db);
    unique.forEach(id => batch.update(doc(db, 'notifications', id), { isRead: true }));
    await batch.commit();
}

// Lấy danh sách username được @tag trong nội dung (chỉ giữ người có thật trong kho, tránh ghi thông báo rác)
export function extractMentionUsernames(text, storeUsers) {
    const matches = String(text || '').match(/@([\w.-]+)/g) || [];
    return matches
        .map(m => m.slice(1).toLowerCase())
        .map(tag => (storeUsers || []).find(u => String(u.username || '').toLowerCase() === tag)?.username)
        .filter(Boolean);
}
