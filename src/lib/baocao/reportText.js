import { ITEM_GROUPS, COUNT_ITEMS, AMOUNT_ITEMS, GROUP_META, parseTr, customCountFields, customRevenueFields } from './catalog.js';

// Số Tr gọn: 8 → "8", 8.5 → "8.5", 0.30000001 → "0.3"
export function fmtTr(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0';
    return String(parseFloat(v.toFixed(2)));
}

function groupLine(draft, group, fields) {
    const parts = [];
    const counts = draft.counts?.[group] || {};
    const amounts = draft.amounts || {};

    // Ô tiền cố định trước, mục đếm sau (nhóm Bảo hiểm: BH ĐMX, BH 1-1, BHMR rồi BD MLN, VSML)
    for (const item of AMOUNT_ITEMS[group]) {
        const v = parseTr(amounts[item.key]);
        if (v > 0) parts.push(`${item.short}: ${fmtTr(v)}`);
    }
    for (const item of COUNT_ITEMS[group]) {
        const v = Number(counts[item.key]) || 0;
        if (v > 0) parts.push(`${item.short}: ${v}`);
    }
    for (const f of customCountFields(fields, group)) {
        const v = Number(counts[f.id]) || 0;
        if (v > 0) parts.push(`${f.name}: ${v}`);
    }
    for (const f of customRevenueFields(fields, group)) {
        const v = parseTr(amounts[f.id]);
        if (v > 0) parts.push(`${f.name}: ${fmtTr(v)}`);
    }
    const other = draft.others?.[group];
    if (other && other.name.trim() && other.count > 0) parts.push(`${other.name.trim()}: ${other.count}`);

    if (parts.length === 0) return null;
    const meta = GROUP_META[group];
    if (meta.multiline) return `${meta.emoji} ${meta.short}:\n${parts.map(p => `   - ${p}`).join('\n')}`;
    return `${meta.emoji} ${meta.short}: ${parts.join(' | ')}`;
}

// Văn bản báo cáo gửi Zalo/Line — giữ nguyên định dạng của Son911
export function buildReportText(draft, fields) {
    const total = parseTr(draft.revenueTotal);
    const lines = ['📊 BÁO CÁO KHAI THÁC'];
    if (draft.staffName?.trim()) lines.push(`👤 ${draft.staffName.trim()}`);
    lines.push('');

    // Có doanh thu thì cờ Trả góp/Thanh toán ví là dòng con dưới 💰; không có doanh thu mà bật cờ thì ghi dòng riêng 💳
    const flags = `Trả góp: ${draft.traGop ? '✓' : '✗'} | Thanh toán ví: ${draft.moVi ? '✓' : '✗'}`;
    if (total > 0) {
        lines.push(`💰 Doanh thu: ${fmtTr(total)}tr`);
        lines.push(`   - ${flags}`);
    } else if (draft.traGop || draft.moVi) {
        lines.push(`💳 ${flags}`);
    }

    for (const group of ITEM_GROUPS) {
        const line = groupLine(draft, group, fields);
        if (line) lines.push(line);
    }

    if (draft.priceWar) lines.push('⚔️ Chiến giá: ✓');

    if (draft.notes.trim()) {
        lines.push('');
        lines.push(`📝 ${draft.notes.trim()}`);
    }

    return lines.join('\n').trim();
}
