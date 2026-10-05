<script>
    // Phiếu điểm nhân viên — chép từ dashboard-svelte (src/components/sknv/chi-tiet/PhieuNhanVien.svelte).
    // Props lấy nguyên từ document sknv_app/{kho}/phieu/{maNV} (field `phieu`) — phiếu KHÔNG tự tính lại điểm.
    // Khác bản gốc: rộng 100% theo màn hình, chân phiếu ghi giờ đồng bộ (dongBoLuc), số null hiện "—".
    import CardIcon from './CardIcon.svelte';
    import HuyChuong from './HuyChuong.svelte';
    import { getHeadStyle } from '../../../lib/sknv/mauHang.js';
    import BonKhoiDat from './BonKhoiDat.svelte';
    import KhenGopY from './KhenGopY.svelte';
    import KhoiDoanhThu from './KhoiDoanhThu.svelte';
    import KhoiNangSuat from './KhoiNangSuat.svelte';
    import KhoiHieuQua from './KhoiHieuQua.svelte';
    import KhoiDonGia from './KhoiDonGia.svelte';

    export let hoTen = '';
    export let maNV = '';
    export let boPhan = '';
    export let maKho = '';
    export let rank = 0;
    export let totalNV = 0;
    export let blockCounts = {
        doanhThu: { achieved: 0, total: 0 },
        nangSuat: { achieved: 0, total: 0 },
        hieuQua: { achieved: 0, total: 0 },
        donGia: { achieved: 0, total: 0 },
        grandAchieved: 0,
        grandTotal: 0
    };
    export let nhomList = [];
    export let doanhThuThuc = null;
    export let doanhThuQD = null;
    export let tyLeQD = null;
    export let tyLeTC = null;
    export let tyLeBanKemStats = { hasData: false, value: '', average: '', rawValue: 0, rawAverage: 0 };
    export let targetCaNhan = 0;
    export let percentTargetValue = 0;
    export let nangSuatKhoStats = null;
    export let boTatChiSo = new Set();
    export let hieuQuaKhaiThacItems = [];
    export let donGiaItems = [];
    export let thiDuaSummary = { hasData: false, dat: 0, ganDat: 0, canCoGang: 0, chuaCoSoBan: 0, total: 0, withDataCount: 0, rate: 0, tiles: [], chuaCoSoBanNames: [], moc: 0, loaiMoc: 'TB', ketQua: 'khongTinh' };
    // Thời điểm dashboard đồng bộ phiếu này (mili giây) — ghi ở chân phiếu.
    export let dongBoLuc = null;

    // --- Đầu phiếu: cùng bộ màu theo hạng và cùng cách tính % hoàn thành như DauPhieu ---
    $: grandAchieved = blockCounts?.grandAchieved || 0;
    $: grandTotal = blockCounts?.grandTotal || 0;
    $: grandRatio = grandTotal > 0 ? grandAchieved / grandTotal : 0;
    $: tier = getHeadStyle(rank, grandRatio);
    $: hoanThanhPct = grandTotal > 0 ? Math.round(grandRatio * 100) : 0;
    $: coHuyChuong = rank >= 1 && rank <= 5;

    const SIZE = 72, STROKE = 7, RADIUS = 29;
    const CIRC = 2 * Math.PI * RADIUS;
    $: dashLen = (CIRC * grandRatio).toFixed(1);

    // --- Thi đua: chia các chương trình có số theo nhóm đã phân sẵn (tiles[].group) ---
    $: tiles = thiDuaSummary?.tiles || [];
    $: sapDat = tiles.filter(t => t.group === 'ganDat');
    $: daDat = tiles.filter(t => t.group === 'dat');
    $: canCoGang = tiles.filter(t => t.group === 'canCoGang');
    $: coKetQuaThiDua = thiDuaSummary?.hasData && thiDuaSummary?.total > 0;
    $: thanhThiDua = [
        { count: thiDuaSummary?.dat || 0, color: '#0F9F6E' },
        { count: thiDuaSummary?.ganDat || 0, color: '#C98A06' },
        { count: thiDuaSummary?.canCoGang || 0, color: '#E03E3E' },
        { count: thiDuaSummary?.chuaCoSoBan || 0, color: '#A3ABBA' }
    ].filter(s => s.count > 0);

    function pct(v) { return v === null || v === undefined || !isFinite(v) ? '—' : `${Math.round(Number(v) || 0)}%`; }
    function soHoacGach(v) { return v === null || v === undefined ? '—' : v; }

    function thoiGianText(ms) {
        if (!ms) return '—';
        const d = new Date(ms);
        if (isNaN(d.getTime())) return '—';
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    $: thoiGian = thoiGianText(dongBoLuc);
</script>

<div class="pnv">
    <!-- ===== TỔNG QUAN ===== -->
    <div class="pnv-head" style="background:{tier.bg};color:{tier.ink}">
        <div class="pnv-ring">
            <svg width={SIZE} height={SIZE} viewBox="0 0 {SIZE} {SIZE}">
                <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="#fff" fill-opacity="0.55" stroke={tier.ring} stroke-opacity="0.22" stroke-width={STROKE} />
                <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={tier.ring} stroke-width={STROKE} stroke-linecap="round"
                    stroke-dasharray="{dashLen} {CIRC.toFixed(1)}" transform="rotate(-90 {SIZE / 2} {SIZE / 2})" />
            </svg>
            <div class="pnv-ring__center">
                <b>{grandAchieved}</b>
                <small>/{grandTotal}</small>
            </div>
        </div>

        <div class="pnv-who">
            <h1>{hoTen}</h1>
            <p>{maNV} · {boPhan}</p>
            <span class="pnv-pill">
                {#if tier.icon}<CardIcon type={tier.icon} size={12} />{/if}
                Hạng {soHoacGach(rank)} / {soHoacGach(totalNV)}
            </span>
        </div>

        <div class="pnv-right">
            {#if coHuyChuong}<HuyChuong hang={rank} />{/if}
            <span class="pnv-done">{hoanThanhPct}%</span>
        </div>
    </div>

    <div class="pnv-body">
        <BonKhoiDat {blockCounts} />
        {#if nhomList && nhomList.length > 0}
            <KhenGopY nhomList={nhomList} xepChong={true} />
        {/if}

        <div class="pnv-dt">
            <KhoiDoanhThu
                {doanhThuThuc}
                {doanhThuQD}
                {tyLeQD}
                {tyLeTC}
                {tyLeBanKemStats}
                {targetCaNhan}
                {percentTargetValue}
                count={blockCounts.doanhThu}
                {boTatChiSo}
            />
        </div>

        <div class="pnv-ns">
            <KhoiNangSuat {nangSuatKhoStats} count={blockCounts.nangSuat} {boTatChiSo} />
        </div>

        <!-- ===== CHI TIẾT (bản gọn) ===== -->
        <KhoiHieuQua {hieuQuaKhaiThacItems} count={blockCounts.hieuQua} />
        <KhoiDonGia items={donGiaItems} count={blockCounts.donGia} />

        <div class="pnv-td">
            <div class="pnv-td-head">
                <h3>Thi đua</h3>
                {#if coKetQuaThiDua}
                    {#if thiDuaSummary.ketQua === 'dat'}
                        <span class="pnv-td-pill pnv-td-pill--dat">✓ Đạt</span>
                    {:else}
                        <span class="pnv-td-pill pnv-td-pill--chuadat">✕ Chưa đạt</span>
                    {/if}
                {/if}
            </div>

            {#if !thiDuaSummary?.hasData}
                <div class="pnv-td-empty">Chưa có dữ liệu thi đua</div>
            {:else}
                <div class="pnv-td-hero">
                    <div class="pnv-td-big">{pct(thiDuaSummary.rate)}</div>
                    <div class="pnv-td-hero-r">
                        <div class="pnv-td-a">Tỷ lệ đạt</div>
                        <div class="pnv-td-b">{soHoacGach(thiDuaSummary.dat)}/{soHoacGach(thiDuaSummary.total)} chương trình</div>
                        <div class="pnv-td-bar">
                            {#each thanhThiDua as seg}
                                <i style="flex:{seg.count};background:{seg.color}"></i>
                            {/each}
                        </div>
                    </div>
                </div>

                {#if sapDat.length > 0}
                    <p class="pnv-td-title" style="color:#C98A06"><i style="background:#C98A06"></i>Sắp đạt – cố thêm chút ({sapDat.length})</p>
                    <div class="pnv-td-chips">
                        {#each sapDat as t}
                            <span class="pnv-td-chip pnv-td-chip--gan">{t.name} {pct(t.percent)}</span>
                        {/each}
                    </div>
                {/if}

                {#if daDat.length > 0}
                    <p class="pnv-td-title" style="color:#0F9F6E"><i style="background:#0F9F6E"></i>Đã đạt ({daDat.length})</p>
                    <p class="pnv-td-dat">{daDat.map(t => `${t.name} ${pct(t.percent)}`).join(' · ')}</p>
                {/if}

                {#if canCoGang.length > 0}
                    <p class="pnv-td-title" style="color:#E03E3E"><i style="background:#E03E3E"></i>Cần cố gắng ({canCoGang.length})</p>
                    <div class="pnv-td-chips">
                        {#each canCoGang as t}
                            <span class="pnv-td-chip pnv-td-chip--can">{t.name} {pct(t.percent)}</span>
                        {/each}
                    </div>
                {/if}

                {#if (thiDuaSummary.chuaCoSoBan || 0) > 0}
                    <p class="pnv-td-nod">+ {thiDuaSummary.chuaCoSoBan} chương trình chưa có số liệu (không tính)</p>
                {/if}
            {/if}
        </div>
    </div>

    <!-- ===== CHÂN PHIẾU (chỉ 1 lần, cuối phiếu) ===== -->
    <div class="pnv-foot">
        <span>Công cụ phân tích số cho QL</span>
        <span>Siêu thị {maKho} · {thoiGian}</span>
    </div>
</div>

<style>
    .pnv {
        width: 100%;
        flex: none;
        box-sizing: border-box;
        background: #fff;
        border-radius: 20px;
        font-family: 'Inter', sans-serif;
        line-height: 1.35;
        color: #1B2233;
    }
    .pnv * { box-sizing: border-box; }

    /* ----- Đầu phiếu ----- */
    .pnv-head {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-radius: 20px 20px 0 0;
    }
    .pnv-ring { position: relative; width: 72px; height: 72px; flex: none; }
    .pnv-ring svg { display: block; }
    .pnv-ring__center {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        line-height: 1.3;
        font-variant-numeric: tabular-nums;
    }
    .pnv-ring__center b { font-size: 22px; font-weight: 800; }
    .pnv-ring__center small { font-size: 11px; opacity: 0.8; }
    .pnv-who { flex: 1; min-width: 0; }
    .pnv-who h1 {
        margin: 0;
        font-size: 18px;
        font-weight: 800;
        line-height: 1.3;
        overflow-wrap: break-word;
        word-break: break-word;
    }
    .pnv-who p {
        margin: 1px 0 6px;
        font-size: 12.5px;
        line-height: 1.35;
        overflow-wrap: break-word;
        word-break: break-word;
    }
    .pnv-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.3;
        padding: 3px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.7);
    }
    .pnv-right {
        flex: none;
        align-self: flex-start;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    }
    .pnv-done {
        font-size: 13px;
        font-weight: 700;
        line-height: 1.3;
        opacity: 0.85;
        font-variant-numeric: tabular-nums;
    }

    /* ----- Thân phiếu ----- */
    .pnv-body {
        padding: 12px 14px 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    /* 4 khối đếm: luôn 2×2 */
    .pnv :global(.bkd-grid) { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }

    /* Khen / Góp ý */
    .pnv :global(.kgy-grid) { gap: 6px; }
    .pnv :global(.kgy-box) { font-size: 12.5px; line-height: 1.4; padding: 8px 10px; }

    /* Tiêu đề chung của các khối (Doanh thu, Năng suất, Hiệu quả, Đơn giá) */
    .pnv :global(.kdt-box),
    .pnv :global(.kns-box),
    .pnv :global(.khq-box),
    .pnv :global(.kdg-box) { padding: 12px; border-radius: 14px; }
    .pnv :global(.kdt-head),
    .pnv :global(.kns-head),
    .pnv :global(.khq-head),
    .pnv :global(.kdg-head) { margin-bottom: 8px; gap: 6px; }
    .pnv :global(.kdt-icon),
    .pnv :global(.kns-icon),
    .pnv :global(.khq-icon),
    .pnv :global(.kdg-icon) { display: none; }
    .pnv :global(.khq-head h3),
    .pnv :global(.kdg-head h3) { white-space: normal; }

    /* Thẻ KPI (dùng trong Doanh thu + Năng suất) */
    .pnv :global(.kpi) { padding: 8px 10px; min-height: 0; row-gap: 2px; border-radius: 10px; }
    .pnv :global(.kpi-icon) { display: none; }
    .pnv :global(.kpi-label) { font-size: 10px; line-height: 1.3; }
    .pnv :global(.kpi-value) { font-size: 20px; line-height: 1.3; white-space: normal; }
    .pnv :global(.kpi-badge) { background: transparent !important; padding: 0; font-size: 10.5px; white-space: normal; }

    /* Doanh thu: 6 thẻ, 2 cột — nhãn trên, số trái + so sánh phải */
    .pnv-dt :global(.kdt-grid) { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    .pnv-dt :global(.kpi-top) { grid-column: 1 / -1; grid-row: 1; }
    .pnv-dt :global(.kpi-value) { grid-column: 1; grid-row: 2; justify-self: start; text-align: left; align-self: end; }
    .pnv-dt :global(.kpi-badge-wrap) { grid-column: 2; grid-row: 2; align-self: end; justify-self: end; padding-bottom: 3px; }

    /* Năng suất: 3 thẻ 1 hàng — nhãn trên, số và so sánh xếp dọc bên dưới */
    .pnv-ns :global(.kns-grid) { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .pnv-ns :global(.kpi) { display: flex; flex-direction: column; }
    .pnv-ns :global(.kpi-value) { margin-top: auto; padding-top: 4px; align-self: flex-start; text-align: left; font-size: 18px; }
    .pnv-ns :global(.kpi-badge-wrap) { align-self: flex-start; }

    /* Hiệu quả khai thác: luôn 2 cột */
    .pnv :global(.khq-list) { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 14px; row-gap: 6px; }
    .pnv :global(.khq-note) { white-space: normal; }
    .pnv :global(.khq-top) { font-size: 12px; }
    .pnv :global(.khq-top b) { font-size: 12.5px; }

    /* Đơn giá: lưới 4 cột */
    .pnv :global(.kdg-note) { display: none; }
    .pnv :global(.kdg-grid) { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
    .pnv :global(.kdg-cell) { padding: 6px 7px; }
    .pnv :global(.kdg-v) { font-size: 15px; line-height: 1.3; }
    .pnv :global(.kdg-s) { font-size: 10.5px; line-height: 1.3; }

    /* ----- Thi đua ----- */
    .pnv-td { background: #FDF1F7; border-radius: 14px; padding: 12px; }
    .pnv-td-head { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .pnv-td-head h3 { margin: 0; font-size: 12.5px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #9B2C6B; line-height: 1.3; }
    .pnv-td-pill { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; line-height: 1.3; padding: 2px 8px; border-radius: 999px; }
    .pnv-td-pill--dat { background: #EAF8F2; color: #0C7A5E; }
    .pnv-td-pill--chuadat { background: #FDEAEA; color: #E03E3E; }
    .pnv-td-empty { background: #fff; border-radius: 10px; padding: 12px; text-align: center; font-size: 12.5px; font-weight: 600; color: #A3ABBA; }
    .pnv-td-hero { display: flex; align-items: center; gap: 12px; background: #fff; border-radius: 12px; padding: 10px 12px; }
    .pnv-td-big { flex: none; font-size: 30px; font-weight: 800; line-height: 1.3; color: #C2418A; font-variant-numeric: tabular-nums; }
    .pnv-td-hero-r { flex: 1; min-width: 0; }
    .pnv-td-a { font-size: 10.5px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; color: #9B2C6B; }
    .pnv-td-b { font-size: 13px; font-weight: 700; color: #1B2233; margin-top: 1px; }
    .pnv-td-bar { display: flex; gap: 2px; margin-top: 6px; }
    .pnv-td-bar i { display: block; height: 7px; border-radius: 999px; min-width: 4px; }
    .pnv-td-title { display: flex; align-items: center; gap: 6px; margin: 10px 0 5px; font-size: 12.5px; font-weight: 800; line-height: 1.3; }
    .pnv-td-title i { flex: none; width: 9px; height: 9px; border-radius: 2px; }
    .pnv-td-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .pnv-td-chip { display: inline-flex; align-items: center; font-size: 11.5px; font-weight: 700; line-height: 1.3; padding: 2px 7px; border-radius: 6px; overflow-wrap: break-word; word-break: break-word; }
    .pnv-td-chip--gan { background: #FCEFCB; color: #9A6A00; }
    .pnv-td-chip--can { background: #fff; color: #E03E3E; }
    .pnv-td-dat { margin: 0; font-size: 12px; font-weight: 700; line-height: 1.4; color: #0F9F6E; overflow-wrap: break-word; }
    .pnv-td-nod { margin: 10px 0 0; font-size: 11.5px; line-height: 1.35; color: #6B7488; }

    /* ----- Chân phiếu ----- */
    .pnv-foot {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 4px 10px;
        padding: 9px 16px 11px;
        border-top: 1px solid #E8ECF3;
        font-size: 11px;
        line-height: 1.35;
        color: #6B7488;
    }
</style>
