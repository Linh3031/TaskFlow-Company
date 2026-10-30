<script>
    import { createEventDispatcher } from 'svelte';
    import { COUNT_ITEMS, AMOUNT_ITEMS, GROUP_META, customCountFields, customRevenueFields } from '../../lib/baocao/catalog.js';
    import BandHeader from './BandHeader.svelte';
    import CounterRow from './CounterRow.svelte';
    import AmountRow from './AmountRow.svelte';
    const dispatch = createEventDispatcher();

    export let group;
    export let draft;
    export let fields = [];
    // Mục chung của kho (scope 'store') chỉ admin được xoá
    export let isAdmin = false;

    $: meta = GROUP_META[group];
    $: counts = draft.counts[group] || {};
    $: other = draft.others[group] || { name: '', count: 0 };
    $: countFields = customCountFields(fields, group);
    $: revenueFields = customRevenueFields(fields, group);
</script>

<section class="border border-slate-200 bg-white">
    <BandHeader icon={meta.icon} title={meta.label}>
        <button slot="right" class="h-6 px-1.5 flex items-center justify-center gap-1 text-[11px] font-bold text-sky-700 hover:bg-sky-50 rounded" title="Thêm mục mới" on:click={() => dispatch('addField', group)}>
            <span class="material-icons-round text-base">add</span> Thêm mục
        </button>
    </BandHeader>

    <!-- Lưới 2 cột ở mọi cỡ màn; ô lẻ kẻ viền phải để tách 2 cột -->
    <div class="grid grid-cols-2 [&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-r-slate-100">
        {#each AMOUNT_ITEMS[group] as item (item.key)}
            <AmountRow icon={item.icon} label={item.label} value={draft.amounts[item.key] ?? ''}
                on:change={(e) => dispatch('amount', { key: item.key, value: e.detail })} />
        {/each}
        {#each COUNT_ITEMS[group] as item (item.key)}
            <CounterRow icon={item.icon} label={item.label} value={Number(counts[item.key]) || 0}
                on:change={(e) => dispatch('count', { group, key: item.key, value: e.detail })} />
        {/each}
        {#each countFields as f (f.id)}
            <CounterRow icon={f.scope === 'store' ? 'store' : meta.icon} label={f.name} value={Number(counts[f.id]) || 0} deletable={f.scope !== 'store' || isAdmin}
                on:change={(e) => dispatch('count', { group, key: f.id, value: e.detail })}
                on:delete={() => dispatch('deleteField', f)} />
        {/each}
        {#each revenueFields as f (f.id)}
            <AmountRow icon={f.scope === 'store' ? 'store' : 'payments'} label="{f.name} (Tr)" value={draft.amounts[f.id] ?? ''} deletable={f.scope !== 'store' || isAdmin}
                on:change={(e) => dispatch('amount', { key: f.id, value: e.detail })}
                on:delete={() => dispatch('deleteField', f)} />
        {/each}
    </div>

    <!-- Dòng "khác": tên tự do + đếm (nhóm Ưu tiên không có) -->
    {#if meta.otherPlaceholder}
        <div class="flex items-center gap-2 px-2 h-11 lg:h-[34px] border-t border-slate-200 bg-slate-50/60">
            <input type="text" placeholder={meta.otherPlaceholder} value={other.name} aria-label={meta.otherPlaceholder}
                on:input={(e) => dispatch('other', { group, patch: { name: e.target.value } })}
                class="flex-1 min-w-0 h-8 lg:h-6 rounded border border-slate-200 bg-white px-2 text-base sm:text-[13px] outline-none focus:border-sky-500" />
            <div class="flex items-center gap-1 shrink-0">
                <button class="h-8 w-8 lg:h-6 lg:w-6 rounded border border-slate-200 bg-white text-slate-600 flex items-center justify-center active:bg-slate-100" aria-label="Giảm mục khác"
                    on:click={() => dispatch('other', { group, patch: { count: Math.max(0, other.count - 1) } })}>
                    <span class="material-icons-round text-base">remove</span>
                </button>
                <span class="w-6 text-center text-[13px] tabular-nums font-semibold {other.count > 0 ? 'text-sky-700' : 'text-slate-400'}">{other.count}</span>
                <button class="h-8 w-8 lg:h-6 lg:w-6 rounded border border-slate-200 bg-white text-slate-600 flex items-center justify-center active:bg-slate-100" aria-label="Tăng mục khác"
                    on:click={() => dispatch('other', { group, patch: { count: other.count + 1 } })}>
                    <span class="material-icons-round text-base">add</span>
                </button>
            </div>
        </div>
    {/if}
</section>
