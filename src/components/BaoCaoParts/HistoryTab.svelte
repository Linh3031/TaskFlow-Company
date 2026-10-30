<script>
    // Tab Nhật ký — đơn đã báo cáo: lọc ngày, tìm kiếm, xem/copy lại, sửa lại, xoá.
    // Nhân viên chỉ nhận đơn của mình; admin nhận đơn cả kho và lọc theo nhân viên.
    import { createEventDispatcher } from 'svelte';
    import { parseTr } from '../../lib/baocao/catalog.js';
    import { buildReportText, buildDailyReportText, fmtTr } from '../../lib/baocao/reportText.js';
    import { groupTotal, insuranceOf, staffList } from '../../lib/baocao/aggregate.js';
    import { localDateKey } from '../../lib/baocao/streak.js';
    import BandHeader from './BandHeader.svelte';
    const dispatch = createEventDispatcher();

    export let reports = [];
    export let fields = [];
    export let staffName = '';
    export let isAdmin = false;
    export let uid = '';
    export let windowStart = '';
    export let staffFilter = 'all'; // admin: 'all' hoặc uid nhân viên

    let dateFilter = '';
    let search = '';
    let expanded = null;

    function fmtTime(iso, fallback) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return fallback;
        return `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Ngày cũ hơn khoảng đang nghe → nhờ cha tải riêng ngày đó
    $: if (dateFilter && windowStart && dateFilter < windowStart) dispatch('loadDay', dateFilter);

    $: staffOptions = isAdmin ? staffList(reports) : [];
    $: if (isAdmin && staffFilter !== 'all' && staffOptions.length > 0 && !staffOptions.some(s => s.uid === staffFilter)) staffFilter = 'all';
    $: scoped = isAdmin ? reports.filter(r => staffFilter === 'all' || r.username === staffFilter) : reports.filter(r => r.username === uid);

    $: q = search.trim().toLowerCase();
    $: rows = scoped
        .filter(r => !dateFilter || r.date === dateFilter)
        .filter(r => !q || (r.staffName || '').toLowerCase().includes(q) || String(parseTr(r.revenueTotal)).includes(q) || (r.notes || '').toLowerCase().includes(q))
        .sort((a, b) => (b.savedAt || b.date).localeCompare(a.savedAt || a.date));
    $: totalTr = rows.reduce((s, r) => s + parseTr(r.revenueTotal), 0);

    // ── Báo cáo cuối ngày: ngày đang lọc (mặc định hôm nay), theo nhân viên đang xem ──
    $: dayKey = dateFilter || localDateKey();
    $: dayLabel = dayKey.split('-').reverse().join('/');
    $: dayReports = scoped
        .filter(r => r.date === dayKey)
        .sort((a, b) => (a.savedAt || '').localeCompare(b.savedAt || ''));
    $: dayStaffCount = new Set(dayReports.map(r => r.username)).size;
    $: dayName = !isAdmin ? staffName
        : staffFilter === 'all' ? `Tất cả nhân viên (${dayStaffCount} NV)`
        : (staffOptions.find(s => s.uid === staffFilter)?.name || staffFilter);
    $: dailyText = buildDailyReportText(dayReports, fields, dayName, dayLabel);

    async function copyText(text, okMsg) {
        try {
            await navigator.clipboard.writeText(text);
            alert(okMsg);
        } catch (e) {
            alert(text);
        }
    }

    async function copyReport(r) {
        const text = buildReportText(r, fields);
        try {
            await navigator.clipboard.writeText(text);
            alert('Đã copy văn bản báo cáo');
        } catch (e) {
            alert(text);
        }
    }

    function askDelete(r) {
        if (confirm(`Xoá đơn ${fmtTr(parseTr(r.revenueTotal))} Tr lúc ${fmtTime(r.savedAt, r.date)}? Không hoàn tác được.`)) dispatch('delete', r);
    }

    function askClearLocal() {
        if (confirm('Xoá nháp đang nhập và mục tự thêm của bạn trên máy này? Đơn đã báo cáo vẫn giữ nguyên.')) dispatch('clearLocal');
    }

    const TH = 'h-7 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border-b border-slate-200 text-left whitespace-nowrap';
</script>

<div class="space-y-3">
    {#if isAdmin}
        <div class="flex items-center gap-2 min-w-0">
            <span class="material-icons-round text-lg text-slate-400 shrink-0">group</span>
            <select bind:value={staffFilter} aria-label="Lọc nhân viên" class="flex-1 sm:flex-none sm:w-64 min-w-0 h-9 rounded border border-slate-200 bg-white px-2 text-base sm:text-[13px] font-semibold text-slate-700 outline-none focus:border-sky-500">
                <option value="all">Tất cả nhân viên</option>
                {#each staffOptions as s (s.uid)}
                    <option value={s.uid}>{s.name}</option>
                {/each}
            </select>
        </div>
    {/if}

    <section class="border border-slate-200 bg-white">
        <BandHeader icon="summarize" title="Báo cáo cuối ngày · {dayLabel}">
            <span slot="right" class="text-[11px] text-slate-500 tabular-nums">{dayReports.length} đơn</span>
        </BandHeader>
        {#if dayReports.length === 0}
            <p class="px-3 py-4 text-[13px] text-slate-500 text-center">Chưa có đơn nào của <b>{dayName || 'bạn'}</b> trong ngày {dayLabel}. Đổi ngày ở ô lọc ngày bên dưới để xem ngày khác.</p>
        {:else}
            <pre class="px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words font-sans text-slate-800 overflow-hidden">{dailyText}</pre>
            <div class="px-2 pb-2">
                <button class="w-full sm:w-auto h-10 lg:h-9 px-4 rounded bg-sky-600 text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-sky-700"
                    on:click={() => copyText(dailyText, 'Đã copy báo cáo cuối ngày. Dán lên nhóm Zalo/Line nhé!')}>
                    <span class="material-icons-round text-lg">content_copy</span> Copy báo cáo cuối ngày
                </button>
            </div>
        {/if}
    </section>

    <section class="border border-slate-200 bg-white">
        <BandHeader icon="history" title="Nhật ký đơn hàng ({scoped.length})" />
        <div class="flex items-center gap-2 px-2 py-1.5 border-b border-slate-100 flex-wrap">
            <input type="date" bind:value={dateFilter} aria-label="Lọc theo ngày" class="h-8 lg:h-7 rounded border border-slate-200 px-1.5 text-[13px] w-[140px] outline-none focus:border-sky-500" />
            <input placeholder="Tìm NV, doanh thu, ghi chú…" bind:value={search} aria-label="Tìm trong nhật ký" class="flex-1 min-w-[140px] h-8 lg:h-7 rounded border border-slate-200 px-2 text-base sm:text-[13px] outline-none focus:border-sky-500" />
            {#if dateFilter || search}
                <button class="h-8 lg:h-7 px-2 rounded border border-slate-200 bg-white text-[12px] font-semibold text-slate-600" on:click={() => { dateFilter = ''; search = ''; }}>Xoá lọc</button>
            {/if}
        </div>

        {#if scoped.length === 0}
            <div class="m-2 bg-white rounded-lg border border-slate-200 px-4 py-10 text-center">
                <p class="text-[13px] text-slate-500">Chưa có đơn hàng nào được ghi nhận. Bấm <b class="text-sky-600">Báo cáo</b> ở tab Nhập báo cáo.</p>
            </div>
        {:else}
            <div class="overflow-x-auto">
                <table class="w-full min-w-[760px] text-[13px] tabular-nums border-collapse">
                    <thead>
                        <tr>
                            <th class="{TH} w-6"></th>
                            <th class={TH}>Thời gian</th>
                            <th class={TH}>Nhân viên</th>
                            <th class="{TH} text-right">Doanh thu</th>
                            <th class="{TH} text-right">SP</th>
                            <th class="{TH} text-right">BH (Tr)</th>
                            <th class="{TH} text-right" title="Gói bảo dưỡng MLN + Vệ sinh máy lạnh">BD/VS</th>
                            <th class="{TH} text-right" title="Phụ kiện - Đồng Hồ - SIM">PK-ĐH-SIM</th>
                            <th class="{TH} text-right">GD</th>
                            <th class="{TH} text-right">Vas</th>
                            <th class="{TH} text-center">Góp / Ví / Chiến</th>
                            <th class="{TH} text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        {#each rows as r (r.id)}
                            {@const open = expanded === r.id}
                            {@const ins = insuranceOf(r)}
                            <tr class="h-[30px] hover:bg-slate-50 cursor-pointer border-l-[3px] {r.traGop ? 'border-l-emerald-600' : 'border-l-slate-200'}" on:click={() => expanded = open ? null : r.id}>
                                <td class="px-1 text-slate-400"><span class="material-icons-round text-base align-middle">{open ? 'expand_more' : 'chevron_right'}</span></td>
                                <td class="px-2 whitespace-nowrap text-slate-600">{fmtTime(r.savedAt, r.date)}</td>
                                <td class="px-2 truncate max-w-[160px] text-slate-800">{r.staffName || '—'}</td>
                                <td class="px-2 text-right font-semibold text-slate-900">{fmtTr(parseTr(r.revenueTotal))}</td>
                                <td class="px-2 text-right">{groupTotal(r, 'products') || '—'}</td>
                                <td class="px-2 text-right">{ins > 0 ? fmtTr(ins) : '—'}</td>
                                <td class="px-2 text-right">{groupTotal(r, 'insurance') || '—'}</td>
                                <td class="px-2 text-right">{groupTotal(r, 'accessories') || '—'}</td>
                                <td class="px-2 text-right">{groupTotal(r, 'household') || '—'}</td>
                                <td class="px-2 text-right">{groupTotal(r, 'services') || '—'}</td>
                                <td class="px-2 text-center text-[12px] whitespace-nowrap">
                                    <span class={r.traGop ? 'text-emerald-700 font-semibold' : 'text-slate-300'}>Góp</span>
                                    <span class="text-slate-300"> · </span>
                                    <span class={r.moVi ? 'text-sky-700 font-semibold' : 'text-slate-300'}>Ví</span>
                                    <span class="text-slate-300"> · </span>
                                    <span class={r.priceWar ? 'text-rose-700 font-semibold' : 'text-slate-300'}>Chiến</span>
                                </td>
                                <td class="px-2 text-right whitespace-nowrap" on:click|stopPropagation>
                                    <button class="h-7 w-7 inline-flex items-center justify-center text-slate-400 hover:text-sky-700" title="Sao chép văn bản" aria-label="Sao chép" on:click={() => copyReport(r)}><span class="material-icons-round text-base">content_copy</span></button>
                                    <!-- Chỉ đơn của chính mình mới sửa / xoá được -->
                                    {#if r.username === uid}
                                        <button class="h-7 w-7 inline-flex items-center justify-center text-slate-400 hover:text-sky-700" title="Sửa lại" aria-label="Sửa lại" on:click={() => dispatch('edit', r)}><span class="material-icons-round text-base">edit</span></button>
                                        <button class="h-7 w-7 inline-flex items-center justify-center text-slate-400 hover:text-rose-600" title="Xoá" aria-label="Xoá" on:click={() => askDelete(r)}><span class="material-icons-round text-base">delete</span></button>
                                    {/if}
                                </td>
                            </tr>
                            {#if open}
                                <tr class="bg-slate-50/60">
                                    <td colspan="12" class="px-3 py-2">
                                        <pre class="text-[13px] leading-relaxed whitespace-pre-wrap break-words font-sans text-slate-800">{buildReportText(r, fields)}</pre>
                                    </td>
                                </tr>
                            {/if}
                        {/each}
                    </tbody>
                    <tfoot>
                        <tr class="h-7 bg-slate-100 border-t border-slate-200 font-semibold text-slate-800">
                            <td colspan="3" class="px-2 text-[11px] uppercase tracking-wider">Tổng ({rows.length} đơn)</td>
                            <td class="px-2 text-right">{fmtTr(totalTr)}</td>
                            <td colspan="8"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        {/if}
    </section>

    <section class="border border-rose-200 bg-rose-50 px-3 py-2 flex items-center justify-between gap-3">
        <div class="min-w-0">
            <p class="text-[12px] font-bold text-rose-700 uppercase tracking-wider">Xoá dữ liệu trên máy</p>
            <p class="text-[12px] text-rose-700/80">Xoá nháp và mục tự thêm của bạn trên máy này. Đơn đã báo cáo vẫn giữ nguyên.</p>
        </div>
        <button class="h-9 px-3 shrink-0 rounded bg-rose-600 text-white text-sm font-bold hover:bg-rose-700" on:click={askClearLocal}>Xoá</button>
    </section>
</div>
