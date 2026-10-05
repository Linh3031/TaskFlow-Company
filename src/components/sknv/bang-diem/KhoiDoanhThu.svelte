<script>
    import { afterUpdate, onMount } from 'svelte';
    import { formatters } from '../../../utils/formatters.js';
    import { evaluateCriterion } from '../../../lib/sknv/danhGiaTieuChi.js';
    import TheKpi from './TheKpi.svelte';

    export let doanhThuThuc = null; // { label, value, average, rawValue, rawAverage }
    export let doanhThuQD = null;
    export let tyLeQD = null;
    export let tyLeTC = null;
    export let tyLeBanKemStats = { hasData: false, value: '', average: '', rawValue: 0, rawAverage: 0 };
    export let targetCaNhan = 0;
    export let percentTargetValue = 0;
    export let count = { achieved: 0, total: 0 };
    // Set id chỉ số bị TẮT trong "Cài đặt chỉ số SKNV" của kho (id cố định ở src/lib/sknv/chiSoSKNV.js).
    export let boTatChiSo = new Set();

    const COLOR = { dtThuc: '#0EA5B7', dtQD: '#2F7BE0', target: '#0F9F6E', pctQD: '#7B61E6', pctTC: '#E0891B', pctBK: '#D6457F' };

    $: conBat = (id) => !boTatChiSo.has(id);

    $: countColor = count.total === 0 ? '#A3ABBA' : (count.achieved / count.total >= 0.5 ? '#0F9F6E' : '#E03E3E');

    // Cùng quy tắc đếm dùng chung với count ở trên
    // (evaluateCriterion, src/lib/sknv/tinhDiemNhanVien.js) — để thẻ KPI không tô màu sai cho tiêu chí đã bị loại khỏi đếm.
    function coDuLieu(rawValue, rawAverage, hasData = true) {
        return evaluateCriterion({ rawValue, rawMoc: rawAverage, hasData }).counted;
    }

    onMount(() => { if (window.feather) window.feather.replace(); });
    afterUpdate(() => { if (window.feather) window.feather.replace(); });
</script>

<div class="kdt-box">
    <div class="kdt-head">
        <span class="kdt-icon"><i data-feather="dollar-sign" class="w-4 h-4"></i></span>
        <h3>Doanh thu</h3>
        <span class="kdt-count" style="color:{countColor}">{count.achieved}/{count.total}</span>
    </div>

    <div class="kdt-grid">
        {#if doanhThuThuc && conBat('dtThuc')}
            <TheKpi icon="dollar-sign" label={doanhThuThuc.label} color={COLOR.dtThuc} value={doanhThuThuc.value} hasData={coDuLieu(doanhThuThuc.rawValue, doanhThuThuc.rawAverage)}
                badgeType={doanhThuThuc.rawValue >= doanhThuThuc.rawAverage ? 'up' : 'down'} badgeValue={doanhThuThuc.average} />
        {/if}
        {#if doanhThuQD && conBat('dtQuyDoi')}
            <TheKpi icon="repeat" label={doanhThuQD.label} color={COLOR.dtQD} value={doanhThuQD.value} hasData={coDuLieu(doanhThuQD.rawValue, doanhThuQD.rawAverage)}
                badgeType={doanhThuQD.rawValue >= doanhThuQD.rawAverage ? 'up' : 'down'} badgeValue={doanhThuQD.average} />
        {/if}
        {#if conBat('pctTarget')}
            <TheKpi icon="target" label="% Target" color={COLOR.target}
                value={targetCaNhan > 0 ? formatters.formatPercentage(percentTargetValue / 100, 0) : '-'}
                hasData={targetCaNhan > 0} badgeType="target" badgeValue={formatters.formatRevenue(targetCaNhan)} />
        {/if}
        {#if tyLeQD && conBat('pctQuyDoi')}
            <TheKpi icon="percent" label={tyLeQD.label} color={COLOR.pctQD} value={tyLeQD.value} hasData={coDuLieu(tyLeQD.rawValue, tyLeQD.rawAverage)}
                badgeType={tyLeQD.rawValue >= tyLeQD.rawAverage ? 'up' : 'down'} badgeValue={tyLeQD.average} />
        {/if}
        {#if tyLeTC && conBat('pctTraCham')}
            <TheKpi icon="credit-card" label={tyLeTC.label} color={COLOR.pctTC} value={tyLeTC.value} hasData={coDuLieu(tyLeTC.rawValue, tyLeTC.rawAverage)}
                badgeType={tyLeTC.rawValue >= tyLeTC.rawAverage ? 'up' : 'down'} badgeValue={tyLeTC.average} />
        {/if}
        {#if conBat('pctBanKem')}
            <TheKpi icon="shopping-bag" label="% Bán kèm" color={COLOR.pctBK} value={tyLeBanKemStats.value ?? '—'}
                hasData={coDuLieu(tyLeBanKemStats.rawValue, tyLeBanKemStats.rawAverage, tyLeBanKemStats.hasData)} badgeType={tyLeBanKemStats.rawValue >= tyLeBanKemStats.rawAverage ? 'up' : 'down'} badgeValue={tyLeBanKemStats.average} />
        {/if}
    </div>
</div>

<style>
    .kdt-box { background: #EEF5FE; border-radius: 16px; padding: 16px 18px; }
    .kdt-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .kdt-icon {
        width: 28px; height: 28px; border-radius: 8px; background: #fff;
        display: flex; align-items: center; justify-content: center; color: #2F7BE0; flex: none;
    }
    .kdt-head h3 { margin: 0; font-size: 12.5px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #1D5DB5; }
    .kdt-count { display: inline-flex; align-items: center; font-size: 12px; font-weight: 800; padding: 1px 9px; line-height: 1.3; border-radius: 999px; background: #fff; font-variant-numeric: tabular-nums; }
    .kdt-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    @media (max-width: 860px) {
        .kdt-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
</style>
