// Tổng hợp đơn đã báo cáo cho tab Biểu đồ & Nhật ký — clone từ Son911 (features/khai-thac/utils/aggregate.ts)
import { ITEM_GROUPS, COUNT_ITEMS, AMOUNT_ITEMS, parseTr, customCountFields } from './catalog.js';
import { localDateKey } from './streak.js';

// Thứ Hai đầu tuần chứa `d` (tuần Thứ Hai → Chủ Nhật)
export function startOfWeek(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = x.getDay(); // 0 = CN
    x.setDate(x.getDate() + (dow === 0 ? -6 : 1 - dow));
    return x;
}

// range: 'today' | 'week' | 'month'
export function isInRange(dateKey, range, now = new Date()) {
    if (!dateKey) return false;
    if (range === 'today') return dateKey === localDateKey(now);
    if (range === 'month') return dateKey.slice(0, 7) === localDateKey(now).slice(0, 7);
    const monday = startOfWeek(now);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return dateKey >= localDateKey(monday) && dateKey <= localDateKey(sunday);
}

const emptyByGroup = (make) => Object.fromEntries(ITEM_GROUPS.map(g => [g, make()]));

export function summarize(reports, fields) {
    let revenueTotal = 0, traGopCount = 0, moViCount = 0, priceWarCount = 0;
    const sums = emptyByGroup(() => ({}));
    const otherCounts = emptyByGroup(() => 0);
    const amounts = {};
    const customRevenue = {};

    for (const r of reports) {
        revenueTotal += parseTr(r.revenueTotal);
        if (r.traGop) traGopCount++;
        if (r.moVi) moViCount++;
        if (r.priceWar) priceWarCount++;
        const rAmounts = r.amounts || {};
        for (const g of ITEM_GROUPS) {
            for (const item of AMOUNT_ITEMS[g]) amounts[item.key] = (amounts[item.key] || 0) + parseTr(rAmounts[item.key]);
            const counts = r.counts?.[g] || {};
            for (const [k, v] of Object.entries(counts)) sums[g][k] = (sums[g][k] || 0) + (Number(v) || 0);
            otherCounts[g] += Number(r.others?.[g]?.count) || 0;
        }
        for (const f of fields) {
            if (f.type === 'revenue') customRevenue[f.id] = (customRevenue[f.id] || 0) + parseTr(rAmounts[f.id]);
        }
    }

    // Xếp hạng mục đếm theo nhóm (kể cả mục tuỳ chỉnh dạng đếm), giảm dần
    const ranking = {};
    for (const g of ITEM_GROUPS) {
        const items = [
            ...COUNT_ITEMS[g].map(i => ({ key: i.key, label: i.label, count: sums[g][i.key] || 0 })),
            ...customCountFields(fields, g).map(f => ({ key: f.id, label: f.name, count: sums[g][f.id] || 0 })),
        ];
        ranking[g] = items.sort((a, b) => b.count - a.count);
    }

    return {
        orders: reports.length,
        revenueTotal,
        traGopCount,
        moViCount,
        priceWarCount,
        // Tổng các ô tiền nhóm BH (BH ĐMX + BH 1-1 + BHMR)
        insuranceTr: AMOUNT_ITEMS.insurance.reduce((s, item) => s + (amounts[item.key] || 0), 0),
        amounts,
        ranking,
        customRevenue,
        otherCounts,
    };
}

// Tổng số lượng của một nhóm trong một đơn (mục chuẩn + tuỳ chỉnh đếm + "khác")
export function groupTotal(r, g) {
    const counts = r.counts?.[g] || {};
    const base = Object.values(counts).reduce((s, v) => s + (Number(v) || 0), 0);
    return base + (Number(r.others?.[g]?.count) || 0);
}

// Tổng tiền bảo hiểm (Tr) của một đơn
export function insuranceOf(r) {
    const a = r.amounts || {};
    return AMOUNT_ITEMS.insurance.reduce((s, item) => s + parseTr(a[item.key]), 0);
}

// Ngày đầu khoảng cần tải: sớm nhất giữa đầu tháng, Thứ Hai tuần này và 14 ngày trước (cho cảnh báo 3 ngày)
export function windowStartKey(now = new Date()) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const twoWeeks = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
    const earliest = [monthStart, startOfWeek(now), twoWeeks].reduce((a, b) => (a < b ? a : b));
    return localDateKey(earliest);
}

// Danh sách nhân viên có đơn (cho admin lọc): [{ uid, name }] theo tên
export function staffList(reports) {
    const map = new Map();
    for (const r of reports) {
        if (!r.username) continue;
        // Giữ tên của đơn mới nhất
        const cur = map.get(r.username);
        if (!cur || (r.savedAt || '') > cur.savedAt) map.set(r.username, { uid: r.username, name: r.staffName || r.username, savedAt: r.savedAt || '' });
    }
    return Array.from(map.values()).map(({ uid, name }) => ({ uid, name })).sort((a, b) => a.name.localeCompare(b.name));
}

// Sản phẩm phụ = mọi mục đếm ngoài nhóm Sản phẩm chính (BH dạng đếm, PK - ĐH - SIM, Gia dụng, Vas)
export const SUB_GROUPS = ['insurance', 'accessories', 'household', 'services'];
export const mainQty = (r) => groupTotal(r, 'products');
export const subQty = (r) => SUB_GROUPS.reduce((t, g) => t + groupTotal(r, g), 0);

// Bảng nhân viên cho admin: số đơn, doanh thu, SL SP chính / phụ, bảo hiểm, trả góp, ví — sắp doanh thu cao → thấp
export function staffRanking(reports) {
    const map = new Map();
    for (const r of reports) {
        const key = r.username || r.staffName || '?';
        let row = map.get(key);
        if (!row) {
            row = { uid: key, name: r.staffName || key, savedAt: '', orders: 0, revenue: 0, mainQty: 0, subQty: 0, insuranceTr: 0, traGop: 0, moVi: 0 };
            map.set(key, row);
        }
        // Giữ tên của đơn mới nhất
        if ((r.savedAt || '') > row.savedAt) { row.savedAt = r.savedAt || ''; row.name = r.staffName || key; }
        row.orders++;
        row.revenue += parseTr(r.revenueTotal);
        row.mainQty += mainQty(r);
        row.subQty += subQty(r);
        row.insuranceTr += insuranceOf(r);
        if (r.traGop) row.traGop++;
        if (r.moVi) row.moVi++;
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
}

// Mục tự thêm đã dùng trong đơn — đính kèm vào đơn để admin (máy khác) vẫn cộng đúng
export function usedFieldDefs(report, fields) {
    return fields
        .filter(f => (Number(report.counts?.[f.group]?.[f.id]) || 0) > 0 || parseTr(report.amounts?.[f.id]) > 0)
        .map(({ id, name, group, type }) => ({ id, name, group, type }));
}

// Gộp mục của máy này với mục đính kèm trong các đơn (theo id)
export function mergeFields(fields, reports) {
    const map = new Map(fields.map(f => [f.id, f]));
    for (const r of reports) for (const f of r.fieldDefs || []) if (!map.has(f.id)) map.set(f.id, f);
    return Array.from(map.values());
}

// Tỉ lệ %, mẫu số 0 → 0 (không để NaN/Infinity lên UI)
export function pct(part, whole) {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
