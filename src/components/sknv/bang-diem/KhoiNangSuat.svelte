<script>
    import { afterUpdate, onMount } from 'svelte';
    import { formatters } from '../../../utils/formatters.js';
    import { evaluateCriterion } from '../../../lib/sknv/danhGiaTieuChi.js';
    import TheKpi from './TheKpi.svelte';

    export let nangSuatKhoStats = null; // { tongThuNhap, thuNhapTrenGioCong, dtqdTrenGioCong } — mỗi cái {rawValue, rawAverage}
    export let count = { achieved: 0, total: 0 };
    // Set id chỉ số bị TẮT trong "Cài đặt chỉ số SKNV" của kho (id cố định ở src/lib/sknv/chiSoSKNV.js).
    export let boTatChiSo = new Set();

    const COLOR = '#0C7A5E';

    $: conBat = (id) => !boTatChiSo.has(id);

    $: countColor = count.total === 0 ? '#A3ABBA' : (count.achieved / count.total >= 0.5 ? '#0F9F6E' : '#E03E3E');

    // Cùng quy tắc đếm dùng chung với count ở trên
    // (evaluateCriterion, src/lib/sknv/tinhDiemNhanVien.js) — để thẻ KPI không tô màu sai cho tiêu chí đã bị loại khỏi đếm.
    function coDuLieu(rawValue, rawAverage) {
        return evaluateCriterion({ rawValue, rawMoc: rawAverage }).counted;
    }

    onMount(() => { if (window.feather) window.feather.replace(); });
    afterUpdate(() => { if (window.feather) window.feather.replace(); });
</script>

<div class="kns-box">
    <div class="kns-head">
        <span class="kns-icon"><i data-feather="zap" class="w-4 h-4"></i></span>
        <h3>Năng suất</h3>
        <span class="kns-count" style="color:{countColor}">{count.achieved}/{count.total}</span>
    </div>

    {#if nangSuatKhoStats}
        <div class="kns-grid">
            {#if conBat('tongThuNhap') && nangSuatKhoStats.tongThuNhap}
            <TheKpi icon="briefcase" label="Tổng thu nhập" color={COLOR}
                value="{formatters.formatRevenue(nangSuatKhoStats.tongThuNhap.rawValue)} tr" hasData={coDuLieu(nangSuatKhoStats.tongThuNhap.rawValue, nangSuatKhoStats.tongThuNhap.rawAverage)}
                badgeType={nangSuatKhoStats.tongThuNhap.rawValue >= nangSuatKhoStats.tongThuNhap.rawAverage ? 'up' : 'down'}
                badgeValue="{formatters.formatRevenue(nangSuatKhoStats.tongThuNhap.rawAverage)} tr" />
            {/if}

            {#if conBat('thuNhapGioCong') && nangSuatKhoStats.thuNhapTrenGioCong}
            <TheKpi icon="clock" label="Thu nhập / giờ công" color={COLOR}
                value="{formatters.formatNumberOrDash(nangSuatKhoStats.thuNhapTrenGioCong.rawValue, 1)}K" hasData={coDuLieu(nangSuatKhoStats.thuNhapTrenGioCong.rawValue, nangSuatKhoStats.thuNhapTrenGioCong.rawAverage)}
                badgeType={nangSuatKhoStats.thuNhapTrenGioCong.rawValue >= nangSuatKhoStats.thuNhapTrenGioCong.rawAverage ? 'up' : 'down'}
                badgeValue="{formatters.formatNumberOrDash(nangSuatKhoStats.thuNhapTrenGioCong.rawAverage, 1)}K" />
            {/if}

            {#if conBat('dtqdGioCong') && nangSuatKhoStats.dtqdTrenGioCong}
            <TheKpi icon="trending-up" label="DTQĐ / giờ công" color={COLOR}
                value={formatters.formatNumberOrDash(nangSuatKhoStats.dtqdTrenGioCong.rawValue, 2)} hasData={coDuLieu(nangSuatKhoStats.dtqdTrenGioCong.rawValue, nangSuatKhoStats.dtqdTrenGioCong.rawAverage)}
                badgeType={nangSuatKhoStats.dtqdTrenGioCong.rawValue >= nangSuatKhoStats.dtqdTrenGioCong.rawAverage ? 'up' : 'down'}
                badgeValue={formatters.formatNumberOrDash(nangSuatKhoStats.dtqdTrenGioCong.rawAverage, 2)} />
            {/if}
        </div>
    {:else}
        <p class="kns-empty">Chưa có số liệu năng suất.</p>
    {/if}
</div>

<style>
    .kns-box { background: #EAF8F2; border-radius: 16px; padding: 16px 18px; }
    .kns-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .kns-icon {
        width: 28px; height: 28px; border-radius: 8px; background: #fff;
        display: flex; align-items: center; justify-content: center; color: #14A37F; flex: none;
    }
    .kns-head h3 { margin: 0; font-size: 12.5px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #0C7A5E; }
    .kns-count { display: inline-flex; align-items: center; font-size: 12px; font-weight: 800; padding: 1px 9px; line-height: 1.3; border-radius: 999px; background: #fff; font-variant-numeric: tabular-nums; }
    .kns-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .kns-empty { font-size: 13px; color: #A3ABBA; font-style: italic; text-align: center; }
    @media (max-width: 860px) {
        .kns-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
</style>
