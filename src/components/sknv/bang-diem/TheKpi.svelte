<script>
    import { afterUpdate, onMount } from 'svelte';

    export let icon = 'circle';
    export let label = '';
    export let color = '#2F7BE0';
    export let value = '-';
    export let hasData = true;
    export let badgeType = 'up'; // 'up' | 'down' | 'target'
    export let badgeValue = '';

    onMount(() => { if (window.feather) window.feather.replace(); });
    afterUpdate(() => { if (window.feather) window.feather.replace(); });
</script>

<div class="kpi" style="border-color:{color}">
    <div class="kpi-top">
        <span class="kpi-icon" style="color:{color}"><i data-feather={icon} class="w-3.5 h-3.5"></i></span>
        <span class="kpi-label" title={label}>{label}</span>
    </div>

    <div class="kpi-value" style="color:{hasData ? color : '#A3ABBA'}">{hasData ? (value ?? '—') : '–'}</div>

    <div class="kpi-badge-wrap">
        {#if !hasData}
            <span class="kpi-badge" style="background:#F1F3F6;color:#A3ABBA">Chưa có số</span>
        {:else if badgeType === 'target'}
            <span class="kpi-badge" style="background:#F1EFE8;color:#5F5E5A">MT {badgeValue ?? '—'}</span>
        {:else if badgeType === 'up'}
            <span class="kpi-badge" style="background:#EAF8F2;color:#0C7A5E">↑ TB {badgeValue ?? '—'}</span>
        {:else}
            <span class="kpi-badge" style="background:#FDEAEA;color:#E03E3E">↓ TB {badgeValue ?? '—'}</span>
        {/if}
    </div>
</div>

<style>
    .kpi {
        background: #fff;
        border-left: 3px solid;
        border-radius: 12px;
        padding: 12px 14px;
        min-height: 88px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-rows: auto auto;
        column-gap: 8px;
        row-gap: 6px;
    }
    .kpi-top {
        grid-column: 1;
        grid-row: 1;
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }
    .kpi-icon { flex: none; display: flex; }
    .kpi-label {
        font-size: 10.5px;
        font-weight: 700;
        color: #4B5563;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        line-height: 1.35;
        overflow-wrap: break-word;
        word-break: break-word;
        min-width: 0;
    }
    .kpi-value {
        grid-column: 2;
        grid-row: 1 / 3;
        align-self: center;
        justify-self: end;
        text-align: right;
        font-size: 26px;
        font-weight: 800;
        line-height: 1.3;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
    }
    .kpi-badge-wrap { grid-column: 1; grid-row: 2; align-self: end; min-width: 0; }
    .kpi-badge {
        display: inline-flex;
        align-items: center;
        font-size: 10.5px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 6px;
        line-height: 1.3;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
    }
    @media (max-width: 560px) {
        .kpi-value { font-size: 20px; }
    }
</style>
