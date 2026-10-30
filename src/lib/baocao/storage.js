// Lưu cục bộ trên máy (localStorage) cho tab Báo cáo: nháp đang nhập, mục tuỳ chỉnh, các đơn đã báo cáo
const KEY_DRAFT = 'baocao_draft_v1';
const KEY_FIELDS = 'baocao_custom_fields_v1';
const KEY_REPORTS = 'baocao_reports_v1';

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
    loadDraft: () => readJSON(KEY_DRAFT, null),
    saveDraft: (draft) => writeJSON(KEY_DRAFT, draft),

    loadCustomFields: () => {
        const v = readJSON(KEY_FIELDS, []);
        return Array.isArray(v) ? v : [];
    },
    saveCustomFields: (fields) => writeJSON(KEY_FIELDS, fields),

    loadReports: () => {
        const v = readJSON(KEY_REPORTS, []);
        return Array.isArray(v) ? v : [];
    },
    saveReports: (reports) => writeJSON(KEY_REPORTS, reports),
};
