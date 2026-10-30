<script>
    // Tab Biểu đồ — doanh số theo Hôm nay / Tuần này / Tháng này.
    // Nhân viên: chỉ của mình. Admin: chọn 1 nhân viên hoặc "Tất cả nhân viên" (cộng chung thành 1 biểu đồ).
    import { GROUP_META, AMOUNT_ITEMS, customRevenueFields } from '../../lib/baocao/catalog.js';
    import { summarize, isInRange, pct, staffList } from '../../lib/baocao/aggregate.js';
    import { fmtTr } from '../../lib/baocao/reportText.js';
    import BandHeader from './BandHeader.svelte';
    import KpiCard from './KpiCard.svelte';
    import RankingTable from './RankingTable.svelte';

    export let reports = [];
    export let fields = [];
    export let staffName = '';
    export let range = 'today';
    export let isAdmin = false;
    export let uid = '';
    export let staffFilter = 'all'; // admin: 'all' hoặc uid nhân viên

    const RANGE_ITEMS = [
        { id: 'today', label: 'Hôm nay' },
        { id: 'week', label: 'Tuần này' },
        { id: 'month', label: 'Tháng này' },
    ];
    const RANGE_LABEL = { today: 'hôm nay', week: 'tuần này', month: 'tháng này' };

    $: staffOptions = isAdmin ? staffList(reports) : [];
    $: if (isAdmin && staffFilter !== 'all' && staffOptions.length > 0 && !staffOptions.some(s => s.uid === staffFilter)) staffFilter = 'all';
    $: scoped = isAdmin ? reports.filter(r => staffFilter === 'all' || r.username === staffFilter) : reports.filter(r => r.username === uid);
    $: viewName = !isAdmin ? staffName
        : staffFilter === 'all' ? 'Tất cả nhân viên'
        : (staffOptions.find(s => s.uid === staffFilter)?.name || staffFilter);
    $: filtered = scoped.filter(r => isInRange(r.date, range));
    $: staffCount = new Set(filtered.map(r => r.username)).size;
    $: s = summarize(filtered, fields);
    $: svcRevenueFields = customRevenueFields(fields, 'services');
    $: accRevenueFields = customRevenueFields(fields, 'accessories');
    $: insRevenueFields = customRevenueFields(fields, 'insurance');
</script>

<div class="space-y-3">
    <div class="flex items-center gap-2 flex-wrap">
        <div class="flex bg-slate-100 rounded p-0.5 border border-slate-200 w-full sm:w-auto sm:inline-flex">
            {#each RANGE_ITEMS as r (r.id)}
                <button class="flex-1 sm:flex-none px-3 h-7 rounded text-[12px] font-bold transition-all {range === r.id ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}" on:click={() => range = r.id}>{r.label}</button>
            {/each}
        </div>
        {#if isAdmin}
            <select bind:value={staffFilter} aria-label="Chọn nhân viên" class="w-full sm:w-64 min-w-0 h-8 rounded border border-slate-200 bg-white px-2 text-base sm:text-[13px] font-semibold text-slate-700 outline-none focus:border-sky-500">
                <option value="all">Tất cả nhân viên</option>
                {#each staffOptions as s (s.uid)}
                    <option value={s.uid}>{s.name}</option>
                {/each}
            </select>
        {/if}
    </div>

    <div class="flex items-baseline justify-between gap-2 border-b border-slate-200 pb-1 min-w-0">
        <div class="min-w-0 truncate">
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">{isAdmin && staffFilter === 'all' ? 'Doanh số cả kho' : 'Doanh số cá nhân'} · {RANGE_LABEL[range]}</span>
            {#if viewName}<span class="ml-2 text-[12px] font-semibold text-sky-700">{viewName}{isAdmin && staffFilter === 'all' ? ` (${staffCount} NV)` : ''}</span>{/if}
        </div>
        <span class="text-[11.5px] text-slate-400 tabular-nums shrink-0">{new Date().toLocaleDateString('vi-VN')} · {s.orders} đơn</span>
    </div>

    {#if filtered.length === 0}
        <div class="bg-white rounded-lg border border-slate-200 px-4 py-10 text-center">
            <p class="text-[13px] text-slate-500">Chưa có đơn hàng nào {RANGE_LABEL[range]}. Bấm <b class="text-sky-600">Báo cáo</b> ở tab Nhập báo cáo để ghi nhận.</p>
        </div>
    {:else}
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3">
            <KpiCard icon="payments" tone="slate" title="Tổng doanh số" value={fmtTr(s.revenueTotal)} unit="Tr" subLabel="Số đơn" subValue={s.orders} />
            <KpiCard icon="credit_card" tone="emerald" title="Trả góp" value={s.traGopCount} unit="đơn" subLabel="Tỉ lệ" subValue="{pct(s.traGopCount, s.orders)}%" />
            <KpiCard icon="account_balance_wallet" tone="sky" title="Thanh toán ví" value={s.moViCount} unit="đơn" subLabel="Tỉ lệ" subValue="{pct(s.moViCount, s.orders)}%" />
            <KpiCard icon="local_offer" tone="rose" title="Chiến giá" value={s.priceWarCount} unit="đơn" subLabel="Bảo hiểm" subValue="{fmtTr(s.insuranceTr)} Tr" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <RankingTable group="products" items={s.ranking.products} otherCount={s.otherCounts.products} />

            <!-- Bảo hiểm: ô tiền (BH ĐMX, BH 1-1, BHMR) trước, mục đếm (bảo dưỡng MLN, vệ sinh ML) sau -->
            <section class="border border-slate-200 bg-white min-w-0">
                <BandHeader icon={GROUP_META.insurance.icon} title={GROUP_META.insurance.label}>
                    <span slot="right" class="text-[11px] text-slate-500 tabular-nums">Tổng <b class="text-slate-800">{fmtTr(s.insuranceTr)} Tr</b></span>
                </BandHeader>
                <table class="w-full text-[13px] tabular-nums table-fixed">
                    <tbody class="divide-y divide-slate-100">
                        {#each AMOUNT_ITEMS.insurance as item (item.key)}
                            <tr class="h-[26px] {(s.amounts[item.key] || 0) > 0 ? '' : 'text-slate-400'}"><td class="px-2 truncate">{item.label.replace(' (Tr)', '')}</td><td class="px-2 w-24 text-right font-semibold">{fmtTr(s.amounts[item.key] || 0)} Tr</td></tr>
                        {/each}
                        {#each insRevenueFields as f (f.id)}
                            <tr class="h-[26px]"><td class="px-2 truncate text-slate-600">{f.name}</td><td class="px-2 w-24 text-right font-semibold">{fmtTr(s.customRevenue[f.id] || 0)} Tr</td></tr>
                        {/each}
                        {#each s.ranking.insurance as i (i.key)}
                            <tr class="h-[26px] {i.count > 0 ? '' : 'text-slate-400'}"><td class="px-2 truncate">{i.label}</td><td class="px-2 w-24 text-right font-semibold">{i.count}</td></tr>
                        {/each}
                    </tbody>
                </table>
            </section>

            <!-- Phụ kiện - Đồng Hồ - SIM -->
            <section class="border border-slate-200 bg-white min-w-0">
                <BandHeader icon={GROUP_META.accessories.icon} title={GROUP_META.accessories.label} />
                <table class="w-full text-[13px] tabular-nums table-fixed">
                    <tbody class="divide-y divide-slate-100">
                        {#each s.ranking.accessories as i (i.key)}
                            <tr class="h-[26px] {i.count > 0 ? '' : 'text-slate-400'}"><td class="px-2 truncate">{i.label}</td><td class="px-2 w-24 text-right font-semibold">{i.count}</td></tr>
                        {/each}
                        {#each accRevenueFields as f (f.id)}
                            <tr class="h-[26px]"><td class="px-2 truncate text-slate-600">{f.name}</td><td class="px-2 w-24 text-right font-semibold">{fmtTr(s.customRevenue[f.id] || 0)} Tr</td></tr>
                        {/each}
                        {#if s.otherCounts.accessories > 0}
                            <tr class="h-[26px]"><td class="px-2">Khác</td><td class="px-2 w-24 text-right font-semibold">{s.otherCounts.accessories}</td></tr>
                        {/if}
                    </tbody>
                </table>
            </section>

            <RankingTable group="household" items={s.ranking.household} otherCount={s.otherCounts.household} />

            <section class="border border-slate-200 bg-white min-w-0">
                <BandHeader icon={GROUP_META.services.icon} title={GROUP_META.services.label} />
                <table class="w-full text-[13px] tabular-nums table-fixed">
                    <tbody class="divide-y divide-slate-100">
                        <tr class="h-[26px] {s.moViCount > 0 ? '' : 'text-slate-400'}"><td class="px-2 truncate">Thanh toán ví</td><td class="px-2 w-24 text-right font-semibold">{s.moViCount} <span class="text-slate-400 font-normal">đơn</span></td></tr>
                        {#each s.ranking.services as i (i.key)}
                            <tr class="h-[26px] {i.count > 0 ? '' : 'text-slate-400'}"><td class="px-2 truncate">{i.label}</td><td class="px-2 w-24 text-right font-semibold">{i.count}</td></tr>
                        {/each}
                        {#each svcRevenueFields as f (f.id)}
                            <tr class="h-[26px]"><td class="px-2 truncate text-slate-600">{f.name}</td><td class="px-2 w-24 text-right font-semibold">{fmtTr(s.customRevenue[f.id] || 0)} Tr</td></tr>
                        {/each}
                        {#if s.otherCounts.services > 0}
                            <tr class="h-[26px]"><td class="px-2">Khác</td><td class="px-2 w-24 text-right font-semibold">{s.otherCounts.services}</td></tr>
                        {/if}
                    </tbody>
                </table>
            </section>
        </div>
    {/if}
</div>
