import { ITEM_GROUPS, COUNT_ITEMS, customCountFields } from './catalog.js';

// YYYY-MM-DD theo giờ máy (KHÔNG dùng toISOString — lệch ngày sau 17h ở múi giờ +7)
export function localDateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Cảnh báo mặt hàng "3 ngày liên tiếp không khai thác": hôm nay (nháp + các đơn đã báo cáo hôm nay) = 0
// VÀ 2 ngày có báo cáo gần nhất trước đó đều = 0. Gộp theo NGÀY, không theo đơn.
export function streakWarnings(draft, reports, fields, now = new Date()) {
    const today = localDateKey(now);
    const pastDays = Array.from(new Set(reports.map(r => r.date).filter(d => d < today))).sort().slice(-2);
    if (pastDays.length < 2) return [];

    const items = ITEM_GROUPS.flatMap(g => [
        ...COUNT_ITEMS[g].map(i => ({ g, key: i.key, label: i.label })),
        ...customCountFields(fields, g).map(f => ({ g, key: f.id, label: f.name })),
    ]);

    const sumOn = (day, g, key) =>
        reports.filter(r => r.date === day).reduce((s, r) => s + (Number(r.counts?.[g]?.[key]) || 0), 0);

    const out = [];
    for (const it of items) {
        const todayVal = (Number(draft.counts?.[it.g]?.[it.key]) || 0) + sumOn(today, it.g, it.key);
        if (todayVal > 0) continue;
        if (pastDays.every(d => sumOn(d, it.g, it.key) === 0)) out.push(it.label);
    }
    return out;
}
