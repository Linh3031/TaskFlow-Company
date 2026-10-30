<script>
    // Bảng xếp hạng một nhóm: tên · thanh tỉ lệ · số. Thanh tỉ lệ 3px màu đặc. Mục bằng 0 không hiện.
    import { GROUP_META } from '../../lib/baocao/catalog.js';
    import BandHeader from './BandHeader.svelte';

    export let group;
    export let items = [];
    export let otherCount = 0;

    const BAR = { sky: 'bg-sky-600', emerald: 'bg-emerald-600', violet: 'bg-violet-600', amber: 'bg-amber-500', rose: 'bg-rose-600' };

    $: meta = GROUP_META[group];
    $: shown = items.filter(i => i.count > 0);
    $: max = Math.max(1, otherCount, ...shown.map(i => i.count));
    $: total = shown.reduce((s, i) => s + i.count, 0) + otherCount;
</script>

<section class="border border-slate-200 bg-white min-w-0">
    <BandHeader icon={meta.icon} title={meta.label} tone={meta.tone}>
        <span slot="right" class="text-[11px] tabular-nums">Tổng <b>{total}</b></span>
    </BandHeader>
    <table class="w-full text-[13px] tabular-nums table-fixed">
        <tbody class="divide-y divide-slate-100">
            {#each shown as i (i.key)}
                <tr class="h-[26px] text-slate-900">
                    <td class="px-2 py-0 w-[40%] truncate">{i.label}</td>
                    <td class="px-2 py-0">
                        <div class="h-[3px] bg-slate-100 w-full">
                            <div class="h-full {BAR[meta.tone] || 'bg-sky-600'}" style="width: {(i.count / max) * 100}%"></div>
                        </div>
                    </td>
                    <td class="px-2 py-0 w-12 text-right font-semibold">{i.count}</td>
                </tr>
            {/each}
            {#if otherCount > 0}
                <tr class="h-[26px] text-slate-700">
                    <td class="px-2 py-0">Khác</td>
                    <td class="px-2 py-0"></td>
                    <td class="px-2 py-0 text-right font-semibold">{otherCount}</td>
                </tr>
            {/if}
        </tbody>
    </table>
</section>
