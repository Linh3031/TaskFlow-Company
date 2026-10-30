// Xuất ảnh tab Biểu đồ cho xem trên điện thoại: vẽ thẳng từ số liệu lên canvas khổ dọc 1080px
// (không chụp DOM — bảng nhân viên trên màn điện thoại phải cuộn ngang, chụp sẽ bị cắt).
// data = { title, subtitle, kpis: [{ title, value, unit, subLabel, subValue, tone }],
//          groups: [{ title, right, tone, rows: [{ label, value }] }],
//          staff: null | { title, right, columns: [{ label, width, tone, align }], rows: [[...]] } }

const W = 1080;
const P = 36;      // lề
const GAP = 20;
const FONT = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const TONES = {
    slate: { fg: '#334155', bg: '#f1f5f9', value: '#0f172a' },
    sky: { fg: '#075985', bg: '#e0f2fe', value: '#0369a1' },
    emerald: { fg: '#065f46', bg: '#d1fae5', value: '#047857' },
    violet: { fg: '#5b21b6', bg: '#ede9fe', value: '#6d28d9' },
    amber: { fg: '#92400e', bg: '#fef3c7', value: '#b45309' },
    rose: { fg: '#9f1239', bg: '#ffe4e6', value: '#be123c' },
    indigo: { fg: '#3730a3', bg: '#e0e7ff', value: '#4338ca' },
    teal: { fg: '#115e59', bg: '#ccfbf1', value: '#0f766e' },
};
const tone = (t) => TONES[t] || TONES.slate;

const KPI_H = 180;
const BAND_H = 52;
const ROW_H = 46;
const TH_H = 56;
const TR_H = 48;

function font(size, weight = 400) {
    return `${weight} ${size}px ${FONT}`;
}

// Cắt chữ dài kèm "…" cho vừa độ rộng
function fit(ctx, text, maxW) {
    const s = String(text ?? '');
    if (ctx.measureText(s).width <= maxW) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (ctx.measureText(s.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1;
    }
    return s.slice(0, lo) + '…';
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function text(ctx, s, x, y, { size = 24, weight = 400, color = '#0f172a', align = 'left', maxW } = {}) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(maxW ? fit(ctx, s, maxW) : String(s ?? ''), x, y);
}

const groupHeight = (g) => BAND_H + g.rows.length * ROW_H + 2;

// Xếp nhóm vào 2 cột, cột nào thấp hơn thì nhận nhóm tiếp theo
function placeGroups(groups) {
    const colW = (W - 2 * P - GAP) / 2;
    const cols = [0, 0];
    const placed = groups.map(g => {
        const c = cols[0] <= cols[1] ? 0 : 1;
        const item = { g, x: P + c * (colW + GAP), y: cols[c], w: colW, h: groupHeight(g) };
        cols[c] += item.h + GAP;
        return item;
    });
    return { placed, height: groups.length ? Math.max(...cols) - GAP : 0 };
}

function drawBand(ctx, x, y, w, title, right, t) {
    ctx.fillStyle = t.bg;
    ctx.fillRect(x, y, w, BAND_H);
    ctx.font = font(22, 700);
    const rightW = right ? ctx.measureText(right).width + 24 : 0;
    text(ctx, String(title).toUpperCase(), x + 16, y + BAND_H / 2, { size: 22, weight: 700, color: t.fg, maxW: w - 32 - rightW });
    if (right) text(ctx, right, x + w - 16, y + BAND_H / 2, { size: 22, weight: 700, color: t.fg, align: 'right' });
}

function drawGroup(ctx, { g, x, y, w, h }) {
    const t = tone(g.tone);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    drawBand(ctx, x, y, w, g.title, g.right, t);
    g.rows.forEach((r, i) => {
        const ry = y + BAND_H + i * ROW_H;
        if (i > 0) { ctx.fillStyle = '#f1f5f9'; ctx.fillRect(x, ry, w, 2); }
        ctx.font = font(26, 700);
        const valW = ctx.measureText(String(r.value)).width;
        text(ctx, r.label, x + 16, ry + ROW_H / 2, { size: 26, color: '#1e293b', maxW: w - 48 - valW });
        text(ctx, r.value, x + w - 16, ry + ROW_H / 2, { size: 26, weight: 700, color: t.value, align: 'right' });
    });
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawKpi(ctx, k, x, y, w) {
    const t = tone(k.tone);
    roundRect(ctx, x, y, w, KPI_H, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, String(k.title).toUpperCase(), x + 22, y + 36, { size: 22, weight: 700, color: t.fg, maxW: w - 44 });
    ctx.font = font(60, 800);
    const valW = ctx.measureText(String(k.value)).width;
    ctx.font = font(26, 700);
    const unitW = ctx.measureText(k.unit || '').width;
    const startX = x + (w - valW - 10 - unitW) / 2;
    text(ctx, k.value, startX, y + 92, { size: 60, weight: 800, color: t.value });
    text(ctx, k.unit || '', startX + valW + 10, y + 100, { size: 26, weight: 700, color: '#94a3b8' });
    text(ctx, k.subLabel, x + 22, y + 148, { size: 22, color: '#64748b', maxW: w / 2 });
    text(ctx, k.subValue, x + w - 22, y + 148, { size: 22, weight: 700, color: t.value, align: 'right' });
}

function drawStaff(ctx, st, x, y, w) {
    const t = tone('indigo');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, BAND_H + TH_H + st.rows.length * TR_H);
    drawBand(ctx, x, y, w, st.title, st.right, t);

    // Cột co giãn (width = 0) nhận phần còn lại
    const fixed = st.columns.reduce((s, c) => s + (c.width || 0), 0);
    const flexW = Math.max(120, w - fixed);
    const cols = [];
    let cx = x;
    for (const c of st.columns) {
        const cw = c.width || flexW;
        cols.push({ ...c, x: cx, w: cw });
        cx += cw;
    }

    const hy = y + BAND_H;
    for (const c of cols) {
        const ct = tone(c.tone);
        ctx.fillStyle = ct.bg;
        ctx.fillRect(c.x, hy, c.w, TH_H);
        const tx = c.align === 'right' ? c.x + c.w - 10 : c.x + 10;
        text(ctx, c.label, tx, hy + TH_H / 2, { size: 20, weight: 700, color: ct.fg, align: c.align === 'right' ? 'right' : 'left', maxW: c.w - 16 });
    }

    st.rows.forEach((row, i) => {
        const ry = hy + TH_H + i * TR_H;
        if (i % 2 === 1) { ctx.fillStyle = '#f8fafc'; ctx.fillRect(x, ry, w, TR_H); }
        cols.forEach((c, j) => {
            const tx = c.align === 'right' ? c.x + c.w - 10 : c.x + 10;
            const isName = j === 1;
            text(ctx, row[j], tx, ry + TR_H / 2, {
                size: 24,
                weight: isName || c.bold ? 700 : 400,
                color: c.tone && c.tone !== 'slate' ? tone(c.tone).value : (j === 0 && i < 3 ? '#4338ca' : '#1e293b'),
                align: c.align === 'right' ? 'right' : 'left',
                maxW: c.w - 16,
            });
        });
    });
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, BAND_H + TH_H + st.rows.length * TR_H - 2);
}

export function renderDashboardImage(data) {
    const kpiRows = Math.ceil(data.kpis.length / 2);
    const { placed, height: groupsH } = placeGroups(data.groups);
    const staffH = data.staff ? BAND_H + TH_H + data.staff.rows.length * TR_H : 0;

    const headerH = 110;
    const kpiH = kpiRows * KPI_H + (kpiRows - 1) * GAP;
    let H = P + headerH + kpiH;
    if (groupsH) H += GAP + groupsH;
    if (staffH) H += GAP + staffH;
    H += 70 + P;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    let y = P;
    text(ctx, data.title, P, y + 26, { size: 34, weight: 800, color: '#0f172a', maxW: W - 2 * P });
    text(ctx, data.subtitle, P, y + 76, { size: 26, weight: 600, color: '#0369a1', maxW: W - 2 * P });
    y += headerH;

    const kpiW = (W - 2 * P - GAP) / 2;
    data.kpis.forEach((k, i) => {
        drawKpi(ctx, k, P + (i % 2) * (kpiW + GAP), y + Math.floor(i / 2) * (KPI_H + GAP), kpiW);
    });
    y += kpiH;

    if (groupsH) {
        y += GAP;
        placed.forEach(p => drawGroup(ctx, { ...p, y: y + p.y }));
        y += groupsH;
    }

    if (staffH) {
        y += GAP;
        drawStaff(ctx, data.staff, P, y, W - 2 * P);
        y += staffH;
    }

    const now = new Date();
    text(ctx, `Xuất lúc ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${now.toLocaleDateString('vi-VN')}`, W / 2, y + 45, { size: 22, color: '#94a3b8', align: 'center' });

    return canvas;
}

// Điện thoại / máy tính bảng (iPad báo là Macintosh nhưng có cảm ứng)
function isMobileDevice() {
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// Điện thoại: mở bảng chia sẻ (Zalo / Lưu ảnh). Máy tính (hoặc không chia sẻ được): tải file PNG về
export async function shareDashboardImage(data, filename) {
    const canvas = renderDashboardImage(data);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Không tạo được ảnh');

    const file = typeof File === 'function' ? new File([blob], filename, { type: 'image/png' }) : null;
    if (isMobileDevice() && file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: data.title });
            return 'shared';
        } catch (e) {
            if (e && e.name === 'AbortError') return 'cancelled';
            // Chia sẻ lỗi → tải về
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
}
