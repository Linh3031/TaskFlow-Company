<script>
    export let blockCounts = {
        doanhThu: { achieved: 0, total: 0 },
        nangSuat: { achieved: 0, total: 0 },
        hieuQua: { achieved: 0, total: 0 },
        donGia: { achieved: 0, total: 0 }
    };

    const NHOM = [
        { key: 'doanhThu', label: 'Doanh thu', bg: '#EEF5FE', text: '#1D5DB5', bar: '#2F7BE0' },
        { key: 'nangSuat', label: 'Năng suất', bg: '#EAF8F2', text: '#0C7A5E', bar: '#14A37F' },
        { key: 'hieuQua', label: 'Hiệu quả', bg: '#FEF4EE', text: '#B44B1B', bar: '#E8692F' },
        { key: 'donGia', label: 'Đơn giá', bg: '#F4F1FE', text: '#5B42C2', bar: '#7B61E6' }
    ];

    $: rows = NHOM.map((n) => {
        const c = blockCounts[n.key] || { achieved: 0, total: 0 };
        const duoi50 = c.total > 0 && c.achieved / c.total < 0.5;
        return { ...n, achieved: c.achieved, total: c.total, duoi50 };
    });
</script>

<div class="bkd-grid">
    {#each rows as n}
        <div class="bkd-cell" style="background:{n.bg}">
            <div class="bkd-top">
                <span class="bkd-label" style="color:{n.text}">{n.label.toUpperCase()}</span>
                <span class="bkd-value" style="color:{n.duoi50 ? '#E03E3E' : n.text}">
                    {n.achieved}<small>/{n.total}</small>
                </span>
            </div>
            <div class="bkd-seg">
                {#each Array(n.total) as _, i}
                    <i style="background:{i < n.achieved ? n.bar : '#EDF0F5'}"></i>
                {/each}
                {#if n.total === 0}<i style="background:#EDF0F5"></i>{/if}
            </div>
        </div>
    {/each}
</div>

<style>
    .bkd-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
    }
    .bkd-cell {
        border-radius: 12px;
        padding: 10px 12px;
        min-width: 0;
    }
    .bkd-top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 6px;
    }
    .bkd-label {
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.4px;
        line-height: 1.35;
        min-width: 0;
        overflow-wrap: break-word;
        word-break: break-word;
    }
    .bkd-value {
        font-size: 16px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        flex: none;
    }
    .bkd-value small { font-size: 11px; opacity: 0.7; font-weight: 700; }
    .bkd-seg {
        display: flex;
        gap: 3px;
        margin-top: 6px;
    }
    .bkd-seg i {
        flex: 1;
        height: 6px;
        border-radius: 2px;
        min-width: 0;
    }
    @media (max-width: 860px) {
        .bkd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
</style>
