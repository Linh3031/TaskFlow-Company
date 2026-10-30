<script>
    // Tab Biểu đồ — doanh số theo Hôm nay / Tuần này / Tháng này.
    // Nhân viên: chỉ của mình. Admin: chọn 1 nhân viên hoặc "Tất cả nhân viên" (cộng chung thành 1 biểu đồ).
    // Nhóm / mục bằng 0 trong khoảng đang xem thì ẩn cho gọn.
    import { GROUP_META, AMOUNT_ITEMS, customRevenueFields } from '../../lib/baocao/catalog.js';
    import { summarize, isInRange, pct, staffList, staffRanking, mainQty, subQty } from '../../lib/baocao/aggregate.js';
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

    // Thẻ KPI: tổng số lượng SP chính / SP phụ (SP phụ = mọi nhóm ngoài SP chính)
    $: mainTotal = filtered.reduce((t, r) => t + mainQty(r), 0);
    $: subTotal = filtered.reduce((t, r) => t + subQty(r), 0);
    $: mainPerOrder = s.orders > 0 ? fmtTr(mainTotal / s.orders) : '0';

    // Chỉ giữ dòng có số > 0
    $: insAmounts = AMOUNT_ITEMS.insurance.filter(item => (s.amounts[item.key] || 0) > 0);
    $: insRevenue = customRevenueFields(fields, 'insurance').filter(f => (s.customRevenue[f.id] || 0) > 0);
    $: insCounts = s.ranking.insurance.filter(i => i.count > 0);
    $: accCounts = s.ranking.accessories.filter(i => i.count > 0);
    $: accRevenue = customRevenueFields(fields, 'accessories').filter(f => (s.customRevenue[f.id] || 0) > 0);
    $: svcCounts = s.ranking.services.filter(i => i.count > 0);
    $: svcRevenue = customRevenueFields(fields, 'services').filter(f => (s.customRevenue[f.id] || 0) > 0);

    // Nhóm nào trong khoảng đang xem không có gì thì ẩn
    $: hasProducts = s.ranking.products.some(i => i.count > 0) || s.otherCounts.products > 0;
    $: hasInsurance = insAmounts.length + insRevenue.length + insCounts.length > 0;
    $: hasAccessories = accCounts.length + accRevenue.length > 0 || s.otherCounts.accessories > 0;
    $: hasHousehold = s.ranking.household.some(i => i.count > 0) || s.otherCounts.household > 0;
    $: hasServices = s.moViCount > 0 || svcCounts.length + svcRevenue.length > 0 || s.otherCounts.services > 0;

    // ── Admin xem "Tất cả nhân viên": bảng nhân viên, bấm tiêu đề cột để sắp xếp ──
    const STAFF_COLS = [
        { key: 'name', label: 'Nhân viên', align: 'text-left', head: 'bg-slate-100 text-slate-700' },
        { key: 'orders', label: 'Đơn', align: 'text-right', head: 'bg-slate-100 text-slate-700' },
        { key: 'revenue', label: 'Doanh thu (Tr)', align: 'text-right', head: 'bg-indigo-100 text-indigo-800' },
        { key: 'mainQty', label: 'SL SP chính', align: 'text-right', head: 'bg-sky-100 text-sky-800' },
        { key: 'subQty', label: 'SL SP phụ', align: 'text-right', head: 'bg-violet-100 text-violet-800' },
        { key: 'insuranceTr', label: 'BH (Tr)', align: 'text-right', head: 'bg-emerald-100 text-emerald-800' },
        { key: 'traGop', label: 'Góp', align: 'text-right', head: 'bg-teal-100 text-teal-800' },
        { key: 'moVi', label: 'Ví', align: 'text-right', head: 'bg-amber-100 text-amber-800' },
    ];
    let sortKey = 'revenue';
    let sortDir = 'desc';
    function sortBy(key) {
        if (sortKey === key) { sortDir = sortDir === 'desc' ? 'asc' : 'desc'; return; }
        sortKey = key;
        sortDir = key === 'name' ? 'asc' : 'desc';
    }

    $: showStaffTable = isAdmin && staffFilter === 'all';
    $: staffRows = showStaffTable ? staffRanking(filtered) : [];
    $: sortedStaff = [...staffRows].sort((a, b) => {
        const d = sortKey === 'name' ? a.name.localeCompare(b.name) : (a[sortKey] || 0) - (b[sortKey] || 0);
        return (sortDir === 'asc' ? d : -d) || b.revenue - a.revenue;
    });
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
            <KpiCard icon="inventory_2" tone="sky" title="Sản phẩm chính" value={mainTotal} unit="SP" subLabel="TB / đơn" subValue={mainPerOrder} />
            <KpiCard icon="headphones" tone="violet" title="Sản phẩm phụ" value={subTotal} unit="SP" subLabel="Bảo hiểm" subValue="{fmtTr(s.insuranceTr)} Tr" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            {#if hasProducts}
                <RankingTable group="products" items={s.ranking.products} otherCount={s.otherCounts.products} />
            {/if}

            <!-- Bảo hiểm: ô tiền (BH ĐMX, BH 1-1, BHMR) trước, mục đếm (bảo dưỡng MLN, vệ sinh ML) sau -->
            {#if hasInsurance}
                <section class="border border-slate-200 bg-white min-w-0">
                    <BandHeader icon={GROUP_META.insurance.icon} title={GROUP_META.insurance.label} tone={GROUP_META.insurance.tone}>
                        <span slot="right" class="text-[11px] tabular-nums">Tổng <b>{fmtTr(s.insuranceTr)} Tr</b></span>
                    </BandHeader>
                    <table class="w-full text-[13px] tabular-nums table-fixed">
                        <tbody class="divide-y divide-slate-100">
                            {#each insAmounts as item (item.key)}
                                <tr class="h-[26px]"><td class="px-2 truncate">{item.label.replace(' (Tr)', '')}</td><td class="px-2 w-24 text-right font-semibold">{fmtTr(s.amounts[item.key])} Tr</td></tr>
                            {/each}
                            {#each insRevenue as f (f.id)}
                                <tr class="h-[26px]"><td class="px-2 truncate text-slate-600">{f.name}</td><td class="px-2 w-24 text-right font-semibold">{fmtTr(s.customRevenue[f.id])} Tr</td></tr>
                            {/each}
                            {#each insCounts as i (i.key)}
                                <tr class="h-[26px]"><td class="px-2 truncate">{i.label}</td><td class="px-2 w-24 text-right font-semibold">{i.count}</td></tr>
                            {/each}
                        </tbody>
                    </table>
                </section>
            {/if}

            <!-- Phụ kiện - Đồng Hồ - SIM -->
            {#if hasAccessories}
                <section class="border border-slate-200 bg-white min-w-0">
                    <BandHeader icon={GROUP_META.accessories.icon} title={GROUP_META.accessories.label} tone={GROUP_META.accessories.tone} />
                    <table class="w-full text-[13px] tabular-nums table-fixed">
                        <tbody class="divide-y divide-slate-100">
                            {#each accCounts as i (i.key)}
                                <tr class="h-[26px]"><td class="px-2 truncate">{i.label}</td><td class="px-2 w-24 text-right font-semibold">{i.count}</td></tr>
                            {/each}
                            {#each accRevenue as f (f.id)}
                                <tr class="h-[26px]"><td class="px-2 truncate text-slate-600">{f.name}</td><td class="px-2 w-24 text-right font-semibold">{fmtTr(s.customRevenue[f.id])} Tr</td></tr>
                            {/each}
                            {#if s.otherCounts.accessories > 0}
                                <tr class="h-[26px]"><td class="px-2">Khác</td><td class="px-2 w-24 text-right font-semibold">{s.otherCounts.accessories}</td></tr>
                            {/if}
                        </tbody>
                    </table>
                </section>
            {/if}

            {#if hasHousehold}
                <RankingTable group="household" items={s.ranking.household} otherCount={s.otherCounts.household} />
            {/if}

            {#if hasServices}
                <section class="border border-slate-200 bg-white min-w-0">
                    <BandHeader icon={GROUP_META.services.icon} title={GROUP_META.services.label} tone={GROUP_META.services.tone} />
                    <table class="w-full text-[13px] tabular-nums table-fixed">
                        <tbody class="divide-y divide-slate-100">
                            {#if s.moViCount > 0}
                                <tr class="h-[26px]"><td class="px-2 truncate">Thanh toán ví</td><td class="px-2 w-24 text-right font-semibold">{s.moViCount} <span class="text-slate-400 font-normal">đơn</span></td></tr>
                            {/if}
                            {#each svcCounts as i (i.key)}
                                <tr class="h-[26px]"><td class="px-2 truncate">{i.label}</td><td class="px-2 w-24 text-right font-semibold">{i.count}</td></tr>
                            {/each}
                            {#each svcRevenue as f (f.id)}
                                <tr class="h-[26px]"><td class="px-2 truncate text-slate-600">{f.name}</td><td class="px-2 w-24 text-right font-semibold">{fmtTr(s.customRevenue[f.id])} Tr</td></tr>
                            {/each}
                            {#if s.otherCounts.services > 0}
                                <tr class="h-[26px]"><td class="px-2">Khác</td><td class="px-2 w-24 text-right font-semibold">{s.otherCounts.services}</td></tr>
                            {/if}
                        </tbody>
                    </table>
                </section>
            {/if}
        </div>

        <!-- Admin xem tất cả: danh sách nhân viên, mặc định doanh thu cao → thấp, bấm tiêu đề cột để sắp xếp -->
        {#if showStaffTable && sortedStaff.length > 0}
            <section class="border border-slate-200 bg-white">
                <BandHeader icon="leaderboard" title="Nhân viên theo doanh thu" tone="indigo">
                    <span slot="right" class="text-[11px] tabular-nums">{sortedStaff.length} NV</span>
                </BandHeader>
                <div class="overflow-x-auto">
                    <table class="w-full min-w-[640px] text-[13px] tabular-nums">
                        <thead>
                            <tr class="h-8 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                                <th class="px-2 w-8 text-left bg-slate-100 text-slate-700">#</th>
                                {#each STAFF_COLS as c (c.key)}
                                    <th class="p-0 whitespace-nowrap {c.head}" aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                        <button class="w-full h-8 px-2 flex items-center gap-0.5 font-bold uppercase {c.align === 'text-right' ? 'justify-end' : 'justify-start'}" title="Sắp xếp theo {c.label}" on:click={() => sortBy(c.key)}>
                                            {c.label}
                                            <span class="material-icons-round text-sm {sortKey === c.key ? '' : 'opacity-30'}">{sortKey === c.key && sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                                        </button>
                                    </th>
                                {/each}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            {#each sortedStaff as row, idx (row.uid)}
                                <tr class="h-[30px]">
                                    <td class="px-2 font-bold {idx < 3 ? 'text-indigo-700' : 'text-slate-400'}">{idx + 1}</td>
                                    <td class="px-2 max-w-[180px] truncate text-slate-800 font-semibold">{row.name}</td>
                                    <td class="px-2 text-right">{row.orders}</td>
                                    <td class="px-2 text-right font-bold text-indigo-800">{fmtTr(row.revenue)}</td>
                                    <td class="px-2 text-right text-sky-800">{row.mainQty || '—'}</td>
                                    <td class="px-2 text-right text-violet-800">{row.subQty || '—'}</td>
                                    <td class="px-2 text-right text-emerald-800">{row.insuranceTr > 0 ? fmtTr(row.insuranceTr) : '—'}</td>
                                    <td class="px-2 text-right">{row.traGop || '—'}</td>
                                    <td class="px-2 text-right">{row.moVi || '—'}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </section>
        {/if}
    {/if}
</div>
