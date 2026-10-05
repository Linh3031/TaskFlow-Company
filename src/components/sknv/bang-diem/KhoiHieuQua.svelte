<script>
    import { afterUpdate, onMount } from 'svelte';
    import { evaluateCriterion } from '../../../lib/sknv/danhGiaTieuChi.js';

    export let hieuQuaKhaiThacItems = []; // [{label, value, hasData, rawValue, mocLabel, moc, rawMoc}]
    export let count = { achieved: 0, total: 0 };

    const CLASS_COLOR = { ok: '#0F9F6E', bad: '#E03E3E', na: '#A3ABBA' };

    $: countColor = count.total === 0 ? CLASS_COLOR.na : (count.achieved / count.total >= 0.5 ? '#0F9F6E' : '#E03E3E');

    function classify(rawValue, rawMoc, hasData) {
        const r = evaluateCriterion({ rawValue, rawMoc, hasData });
        if (!r.counted) return 'na';
        return r.achieved ? 'ok' : 'bad';
    }
    function barScale(pct) { return Math.min(100, (pct / 60) * 100); }
    function barWidth(pct) { return Math.max(barScale(pct), pct > 0 ? 2 : 0); }

    onMount(() => { if (window.feather) window.feather.replace(); });
    afterUpdate(() => { if (window.feather) window.feather.replace(); });
</script>

<div class="khq-box">
    <div class="khq-head">
        <span class="khq-icon"><i data-feather="activity" class="w-4 h-4"></i></span>
        <h3>Hiệu quả khai thác</h3>
        <span class="khq-count" style="color:{countColor}">{count.achieved}/{count.total}</span>
        <span class="khq-note">│ = TB siêu thị</span>
    </div>

    <div class="khq-list">
        {#each hieuQuaKhaiThacItems as m}
            {@const st = classify(m.rawValue, m.rawMoc, m.hasData)}
            {@const pct = (m.rawValue || 0) * 100}
            {@const mocPct = (m.rawMoc || 0) * 100}
            <div class="khq-row">
                <div class="khq-top">
                    <span class="khq-l">{m.label}</span>
                    <b style="color:{CLASS_COLOR[st]}">{m.hasData ? (m.value ?? '—') : '–'}</b>
                </div>
                <div class="khq-bar">
                    <div class="khq-bar-fill" style="width:{m.hasData ? barWidth(pct) : 0}%;background:{CLASS_COLOR[st]}"></div>
                    {#if m.hasData || m.rawMoc > 0}
                        <div class="khq-bar-mark" style="left:{barScale(mocPct)}%"></div>
                    {/if}
                </div>
            </div>
        {/each}
        {#if hieuQuaKhaiThacItems.length === 0}
            <p class="khq-empty">Chưa có số liệu hiệu quả.</p>
        {/if}
    </div>
</div>

<style>
    .khq-box { background: #FEF4EE; border-radius: 16px; padding: 16px 18px; }
    .khq-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .khq-icon {
        width: 28px; height: 28px; border-radius: 8px; background: #fff;
        display: flex; align-items: center; justify-content: center; color: #E8692F; flex: none;
    }
    .khq-head h3 { margin: 0; font-size: 12.5px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #B44B1B; white-space: nowrap; }
    .khq-count { display: inline-flex; align-items: center; font-size: 12px; font-weight: 800; padding: 1px 9px; line-height: 1.3; border-radius: 999px; background: #fff; font-variant-numeric: tabular-nums; }
    .khq-note { margin-left: auto; font-size: 11px; font-weight: 600; color: #6B7488; white-space: nowrap; }
    .khq-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 24px; row-gap: 10px; }
    .khq-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 12.5px; }
    .khq-l { color: #374151; font-weight: 600; min-width: 0; line-height: 1.35; overflow-wrap: break-word; word-break: break-word; }
    .khq-top b { font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; flex: none; }
    .khq-bar { position: relative; height: 7px; border-radius: 3px; background: #EDF0F5; margin-top: 4px; }
    .khq-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; }
    .khq-bar-mark { position: absolute; top: -3px; bottom: -3px; width: 2px; border-radius: 2px; background: #1B2233; opacity: 0.45; }
    .khq-empty { font-size: 13px; color: #A3ABBA; font-style: italic; text-align: center; grid-column: 1 / -1; }
    @media (max-width: 860px) {
        .khq-list { grid-template-columns: 1fr; }
    }
</style>
