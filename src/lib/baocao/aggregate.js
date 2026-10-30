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
        // Tổng các ô tiền nhóm Bảo hiểm (BH ĐMX + BH 1-1 + BHMR)
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

// Tỉ lệ %, mẫu số 0 → 0 (không để NaN/Infinity lên UI)
export function pct(part, whole) {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
