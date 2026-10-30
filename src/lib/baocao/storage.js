// Lưu cục bộ trên máy (localStorage) cho tab Báo cáo: nháp đang nhập và mục tự thêm.
// Tách theo tài khoản đăng nhập (uid) để máy dùng chung không lẫn dữ liệu giữa nhân viên.
// Đơn đã báo cáo lưu trên Firestore — xem reportsRepo.js.
const KEY_DRAFT = 'baocao_draft_v1';
const KEY_FIELDS = 'baocao_custom_fields_v1';

const keyOf = (base, uid) => `${base}__${uid || 'guest'}`;

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

// Trả false khi ghi hỏng (bộ nhớ đầy, Safari chặn) để người gọi báo lại
function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error('[baocao] Không lưu được', key, e);
        return false;
    }
}

export function newId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const baoCaoStorage = {
    loadDraft: (uid) => readJSON(keyOf(KEY_DRAFT, uid), null),
    saveDraft: (uid, draft) => writeJSON(keyOf(KEY_DRAFT, uid), draft),

    loadCustomFields: (uid) => {
        const v = readJSON(keyOf(KEY_FIELDS, uid), []);
        return Array.isArray(v) ? v : [];
    },
    saveCustomFields: (uid, fields) => writeJSON(keyOf(KEY_FIELDS, uid), fields),

    // Nút "Xoá dữ liệu trên máy" ở tab Nhật ký — chỉ nháp + mục tự thêm của tài khoản này
    clearLocal: (uid) => {
        try {
            [KEY_DRAFT, KEY_FIELDS].forEach(k => localStorage.removeItem(keyOf(k, uid)));
            return true;
        } catch (e) {
            console.error('[baocao] Không xoá được dữ liệu', e);
            return false;
        }
    },
};
