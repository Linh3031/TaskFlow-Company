<script>
    import { afterUpdate, onMount } from 'svelte';

    // items: TOÀN BỘ danh sách đơn giá (detailStats.donGia). Nhân viên chưa bán hiện ô "–": shop có bán
    // thì tô đỏ (chưa đạt), shop cũng không bán thì tô xanh (đạt) — khớp cách đếm `count`.
    export let items = [];
    export let count = { achieved: 0, total: 0 };

    $: countColor = count.total === 0 ? '#A3ABBA' : (count.achieved / count.total >= 0.5 ? '#0F9F6E' : '#E03E3E');

    function nhanNgan(label) {
        return (label || '').replace(/^Đơn giá\s*/i, '').toUpperCase();
    }

    onMount(() => { if (window.feather) window.feather.replace(); });
    afterUpdate(() => { if (window.feather) window.feather.replace(); });
</script>

<div class="kdg-box">
    <div class="kdg-head">
        <span class="kdg-icon"><i data-feather="tag" class="w-4 h-4"></i></span>
        <h3>Đơn giá</h3>
        <span class="kdg-count" style="color:{countColor}">{count.achieved}/{count.total}</span>
        <span class="kdg-note">so với TB siêu thị</span>
    </div>

    <div class="kdg-grid">
        {#each items as m}
            {@const hasData = (m.rawValue || 0) > 0}
            {@const ok = hasData ? m.rawValue >= m.rawAverage : !((m.rawAverage || 0) > 0)}
            {@const color = ok ? '#0F9F6E' : '#E03E3E'}
            <div class="kdg-cell" style="border-color:{color}">
                <p class="kdg-l" title={m.label}>{nhanNgan(m.label)}</p>
                <p class="kdg-v" style="color:{color}">{hasData ? (m.value ?? '—') : '–'}</p>
                <p class="kdg-s">TB {m.average ?? '—'}</p>
            </div>
        {/each}
        {#if items.length === 0}
            <p class="kdg-empty">Chưa có số liệu đơn giá.</p>
        {/if}
    </div>
</div>

<style>
    .kdg-box { background: #F4F1FE; border-radius: 16px; padding: 16px 18px; }
    .kdg-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .kdg-icon {
        width: 28px; height: 28px; border-radius: 8px; background: #fff;
        display: flex; align-items: center; justify-content: center; color: #7B61E6; flex: none;
    }
    .kdg-head h3 { margin: 0; font-size: 12.5px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #5B42C2; white-space: nowrap; }
    .kdg-count { display: inline-flex; align-items: center; font-size: 12px; font-weight: 800; padding: 1px 9px; line-height: 1.3; border-radius: 999px; background: #fff; font-variant-numeric: tabular-nums; }
    .kdg-note { margin-left: auto; font-size: 11px; font-weight: 600; color: #6B7488; white-space: nowrap; }
    .kdg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
    .kdg-cell { background: #fff; border-radius: 10px; padding: 8px 10px; border-left: 3px solid; min-width: 0; }
    .kdg-l { margin: 0; font-size: 10px; font-weight: 700; color: #6B7488; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.35; overflow-wrap: break-word; word-break: break-word; }
    .kdg-v { margin: 2px 0 0; font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .kdg-s { margin: 0; font-size: 11px; color: #6B7488; font-variant-numeric: tabular-nums; }
    .kdg-empty { font-size: 13px; color: #A3ABBA; font-style: italic; grid-column: 1 / -1; }
</style>
