// Danh mục "Báo cáo khai thác" — clone từ dự án Son911 (features/khai-thac/catalog.ts).
// Mỗi lần bấm "Báo cáo" = MỘT ĐƠN HÀNG. `short` là nhãn viết tắt trong văn bản gửi Zalo/Line — giữ nguyên mẫu.
// `icon` là tên Material Icons Round.
import { evaluateExpression, hasOperator } from './expression.js';

// Thứ tự nhóm dùng chung cho form và văn bản: Sản phẩm chính → Bảo hiểm → Phụ kiện → Gia dụng → Vas
export const ITEM_GROUPS = ['products', 'insurance', 'accessories', 'household', 'services'];

export const COUNT_ITEMS = {
    products: [
        { key: 'tivi', label: 'Tivi', short: 'Tivi', icon: 'tv' },
        { key: 'tuLanh', label: 'Tủ lạnh', short: 'TL', icon: 'kitchen' },
        { key: 'mayGiat', label: 'Máy giặt', short: 'MG', icon: 'local_laundry_service' },
        { key: 'mayLanh', label: 'Máy lạnh', short: 'ML', icon: 'ac_unit' },
        { key: 'smpTab', label: 'SMP / Tab', short: 'SMP', icon: 'smartphone' },
        { key: 'laptop', label: 'Laptop', short: 'LT', icon: 'laptop' },
    ],
    household: [
        { key: 'mln', label: 'Máy lọc nước', short: 'MLN', icon: 'water_drop' },
        { key: 'qdh', label: 'Quạt điều hoà', short: 'QĐH', icon: 'air' },
        { key: 'quat', label: 'Quạt gió', short: 'Quạt', icon: 'toys' },
        { key: 'noiCom', label: 'Nồi cơm', short: 'N.Cơm', icon: 'rice_bowl' },
        { key: 'noiChien', label: 'Nồi chiên', short: 'N.Chiên', icon: 'outdoor_grill' },
        { key: 'locKk', label: 'Máy lọc KK', short: 'LKK', icon: 'auto_awesome' },
        { key: 'bepDien', label: 'Bếp điện', short: 'B.Điện', icon: 'electrical_services' },
        { key: 'bepGas', label: 'Bếp gas', short: 'B.Gas', icon: 'local_fire_department' },
        { key: 'dcnb', label: 'DCNB', short: 'DCNB', icon: 'coffee' },
    ],
    services: [
        { key: 'vieon', label: 'Vieon', short: 'Vieon', icon: 'live_tv' },
        { key: 'mango', label: 'Mango', short: 'Mango', icon: 'live_tv' },
        { key: 'icalme', label: 'iCalme', short: 'iCalme', icon: 'nfc' },
        { key: 'kaspersky', label: 'Kaspersky', short: 'Kaspersky', icon: 'security' },
    ],
    // Nhóm "Bảo hiểm" (khoá nội bộ `insurance`): 3 ô tiền (AMOUNT_ITEMS) + 2 mục đếm dịch vụ
    insurance: [
        { key: 'baoDuongMln', label: 'Gói bảo dưỡng MLN', short: 'BD MLN', icon: 'build' },
        { key: 'veSinhMl', label: 'Vệ sinh máy lạnh', short: 'VSML', icon: 'cleaning_services' },
    ],
    accessories: [
        { key: 'camera', label: 'Camera', short: 'Cam', icon: 'videocam' },
        { key: 'sdp', label: 'Sạc dự phòng', short: 'SDP', icon: 'battery_charging_full' },
        { key: 'den', label: 'Đèn', short: 'Đèn', icon: 'lightbulb' },
        { key: 'loa', label: 'Loa', short: 'Loa', icon: 'speaker' },
        { key: 'taiNghe', label: 'Tai nghe', short: 'T.Nghe', icon: 'headphones' },
        { key: 'sim', label: 'SIM', short: 'SIM', icon: 'sim_card' },
        { key: 'dongHo', label: 'Đồng hồ', short: 'ĐH', icon: 'watch' },
    ],
};

// Ô tiền (Tr) cố định theo nhóm — hiện TRƯỚC các mục đếm trong khối
export const AMOUNT_ITEMS = {
    products: [],
    household: [],
    services: [],
    insurance: [
        { key: 'bhDmx', label: 'Bảo hiểm ĐMX (Tr)', short: 'BH ĐMX', icon: 'verified_user' },
        { key: 'bh11', label: 'Bảo hiểm 1-1 (Tr)', short: 'BH 1-1', icon: 'swap_horiz' },
        { key: 'bhmr', label: 'Bảo hành mở rộng (Tr)', short: 'BHMR', icon: 'more_time' },
    ],
    accessories: [],
};

// multiline: mỗi mục một dòng có gạch đầu dòng trong văn bản báo cáo; tone: màu tiêu đề nhóm ở tab Biểu đồ
export const GROUP_META = {
    products: { label: 'Sản phẩm chính', short: 'S.Phẩm', emoji: '📦', icon: 'inventory_2', otherPlaceholder: 'Sản phẩm chính khác…', multiline: true, tone: 'sky' },
    household: { label: 'Gia dụng', short: 'G.Dụng', emoji: '🏠', icon: 'blender', otherPlaceholder: 'Gia dụng khác…', tone: 'amber' },
    services: { label: 'Vas', short: 'Vas', emoji: '🛠', icon: 'verified_user', otherPlaceholder: 'Vas khác…', tone: 'rose' },
    insurance: { label: 'Bảo hiểm', short: 'B.Hiểm', emoji: '🛡', icon: 'health_and_safety', otherPlaceholder: null, tone: 'emerald' },
    accessories: { label: 'Phụ kiện - Đồng Hồ - SIM', short: 'PK - ĐH - SIM', emoji: '🎧', icon: 'headphones', otherPlaceholder: 'Phụ kiện khác…', tone: 'violet' },
};

export function emptyCounts() {
    return { products: {}, household: {}, services: {}, insurance: {}, accessories: {} };
}

export function emptyOthers() {
    return {
        products: { name: '', count: 0 },
        household: { name: '', count: 0 },
        services: { name: '', count: 0 },
        insurance: { name: '', count: 0 },
        accessories: { name: '', count: 0 },
    };
}

export function createEmptyDraft(staffName = '') {
    return {
        staffName,
        revenueTotal: '',
        traGop: false,
        moVi: false,
        priceWar: false,
        counts: emptyCounts(),
        amounts: {},
        others: emptyOthers(),
        notes: '',
    };
}

// Nháp lưu trên máy có thể thiếu trường — vá lại cho đủ hình
export function normalizeDraft(raw, fallbackName) {
    const base = createEmptyDraft(fallbackName);
    if (!raw || typeof raw !== 'object') return base;
    return {
        ...base,
        ...raw,
        staffName: raw.staffName || fallbackName,
        traGop: !!raw.traGop,
        counts: { ...emptyCounts(), ...(raw.counts || {}) },
        others: { ...emptyOthers(), ...(raw.others || {}) },
        amounts: { ...(raw.amounts || {}) },
        notes: raw.notes || '',
    };
}

// Tên - Mã (đúng dạng username, ví dụ "Linh-3031") hoặc Mã - Tên ("3031 - Linh")
export function isValidStaffName(name) {
    const v = String(name || '').trim();
    return /^\d+\s*-\s*\S+/.test(v) || /^\S.*-\s*\d+$/.test(v);
}

// Đọc số Tr từ ô nhập. Chuỗi có phép tính được tính ra giá trị; biểu thức dở ("5+") lấy phần số đầu
export function parseTr(value) {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
    const str = String(value);
    if (hasOperator(str)) {
        const v = evaluateExpression(str);
        if (v !== null) return v > 0 ? v : 0;
    }
    const n = parseFloat(str.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

export function customCountFields(fields, group) {
    return fields.filter(f => f.group === group && f.type === 'count');
}

export function customRevenueFields(fields, group) {
    return fields.filter(f => f.group === group && f.type === 'revenue');
}
