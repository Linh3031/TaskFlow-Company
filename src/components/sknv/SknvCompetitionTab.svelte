<script>
    import { formatters } from '../../utils/formatters.js';

    // Field `thiDua` của document sknv_app/{kho}/phieu/{maNV} — nhóm Đạt / Gần đạt / Cần cố gắng / Chưa có số bán
    // do dashboard phân sẵn, app KHÔNG phân nhóm lại. Giao diện chép theo CompetitionDetailView.svelte (dashboard-svelte).
    export let thiDua = null;

    let viewMode = 'rut_gon';

    $: summary = thiDua?.summary || { total: 0, dat: 0, ganDat: 0, canCoGang: 0, rate: 0 };
    $: compactList = thiDua?.compactList || [];
    $: chuaCoSoBan = thiDua?.chuaCoSoBan || [];
    $: nhom = [
        { id: 'dat', title: 'Nhóm Đạt', data: thiDua?.dat || [], color: 'blue', icon: 'check_circle' },
        { id: 'ganDat', title: 'Nhóm Gần Đạt', data: thiDua?.ganDat || [], color: 'amber', icon: 'trending_up' },
        { id: 'canCoGang', title: 'Nhóm Cần Cố Gắng', data: thiDua?.canCoGang || [], color: 'red', icon: 'warning' }
    ];
    $: coDuLieu = (summary.total || 0) > 0 || compactList.length > 0 || chuaCoSoBan.length > 0 || nhom.some(g => g.data.length > 0);

    // Class viết đầy đủ để Tailwind giữ lại (không ghép động kiểu bg-{color}-50)
    const MAU = {
        blue: { khung: 'bg-blue-50/30 border-blue-100', dau: 'bg-blue-50/80 border-blue-100', icon: 'text-blue-600', tieuDe: 'text-blue-900', the: 'border-blue-200', thanh: 'bg-blue-500' },
        amber: { khung: 'bg-amber-50/30 border-amber-100', dau: 'bg-amber-50/80 border-amber-100', icon: 'text-amber-600', tieuDe: 'text-amber-900', the: 'border-amber-200', thanh: 'bg-amber-500' },
        red: { khung: 'bg-red-50/30 border-red-100', dau: 'bg-red-50/80 border-red-100', icon: 'text-red-600', tieuDe: 'text-red-900', the: 'border-red-200', thanh: 'bg-red-500' }
    };

    function getColorClass(percent) {
        if (percent >= 100) return 'text-blue-600';
        if (percent >= 80) return 'text-green-600';
        return 'text-red-600';
    }
    const coSo = (v) => v !== null && v !== undefined;
</script>

<div class="space-y-6 pb-4">
    {#if !coDuLieu}
        <div class="p-8 text-center bg-white rounded-2xl shadow-sm border border-gray-100">
            <span class="material-icons-round text-4xl text-gray-300 mb-2">sports_score</span>
            <p class="text-gray-500 font-medium text-sm">Chưa có dữ liệu thi đua.</p>
        </div>
    {:else}
        <div class="space-y-4">
            <div class="bg-white p-1 rounded-xl border border-blue-100 shadow-sm flex items-center w-full">
                <button on:click={() => viewMode = 'rut_gon'} class="flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-colors {viewMode === 'rut_gon' ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:text-slate-600'}">Rút gọn</button>
                <button on:click={() => viewMode = 'chi_tiet'} class="flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-colors {viewMode === 'chi_tiet' ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:text-slate-600'}">Chi tiết</button>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div class="bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-xl p-3 shadow-sm flex flex-col justify-between min-h-[96px]">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0"><span class="material-icons-round text-[16px]">check_circle</span></div>
                        <span class="text-[10px] font-bold uppercase text-blue-50 leading-tight">Ngành hàng Đạt</span>
                    </div>
                    <div class="flex items-end justify-between mt-2">
                        <div class="text-[10px] font-semibold text-blue-100">Đã đạt: <strong class="text-white">{summary.dat ?? '—'}</strong> / {summary.total ?? '—'}</div>
                        <span class="text-4xl font-black leading-none">{summary.dat ?? '—'}</span>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-rose-500 to-pink-500 text-white rounded-xl p-3 shadow-sm flex flex-col justify-between min-h-[96px]">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0"><span class="material-icons-round text-[16px]">track_changes</span></div>
                        <span class="text-[10px] font-bold uppercase text-rose-50 leading-tight">Tỷ lệ Hoàn thành</span>
                    </div>
                    <div class="flex items-end justify-between mt-2">
                        <div class="text-[10px] font-semibold text-rose-100 leading-tight">Dựa trên tiến độ dự kiến</div>
                        <span class="text-3xl font-black text-yellow-200 leading-none">{formatters.formatNumber(summary.rate, 0)}%</span>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-xl p-3 shadow-sm flex flex-col justify-between min-h-[96px]">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0"><span class="material-icons-round text-[16px]">trending_up</span></div>
                        <span class="text-[10px] font-bold uppercase text-amber-50 leading-tight">Gần Đạt (&gt;=70%)</span>
                    </div>
                    <span class="text-4xl font-black leading-none self-end mt-2">{summary.ganDat ?? '—'}</span>
                </div>

                <div class="bg-gradient-to-br from-red-500 to-rose-600 text-white rounded-xl p-3 shadow-sm flex flex-col justify-between min-h-[96px]">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0"><span class="material-icons-round text-[16px]">error_outline</span></div>
                        <span class="text-[10px] font-bold uppercase text-red-50 leading-tight">Cần Cố Gắng</span>
                    </div>
                    <span class="text-4xl font-black leading-none self-end mt-2">{summary.canCoGang ?? '—'}</span>
                </div>
            </div>
        </div>

        {#if viewMode === 'rut_gon'}
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                <h3 class="font-bold text-gray-700 uppercase text-xs tracking-wide mb-3 flex items-center gap-2">
                    <span class="material-icons-round text-[16px] text-indigo-500">grid_view</span> Tổng quan các ngành hàng có số liệu
                </h3>
                {#if compactList.length > 0}
                    <div class="grid grid-cols-3 gap-2">
                        {#each compactList as item}
                            <div class="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col items-center justify-center text-center min-w-0">
                                <span class="text-[11px] font-bold text-gray-600 truncate w-full mb-0.5" title={item.name}>{item.name}</span>
                                <span class="text-[17px] font-black {getColorClass(item.percentOfAvg)}">
                                    {formatters.formatNumber(item.percentOfAvg, 0)}%
                                </span>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="text-sm text-gray-400 italic">Không có ngành hàng nào phát sinh số liệu.</p>
                {/if}
            </div>
        {:else}
            <div class="space-y-5">
                {#each nhom as group}
                    {#if group.data.length > 0}
                        {@const mau = MAU[group.color]}
                        <div class="{mau.khung} rounded-2xl border overflow-hidden">
                            <div class="px-4 py-3 {mau.dau} border-b flex items-center gap-2">
                                <span class="material-icons-round text-[20px] {mau.icon}">{group.icon}</span>
                                <h3 class="font-black {mau.tieuDe} uppercase text-sm tracking-wide">{group.title} ({group.data.length})</h3>
                            </div>
                            <div class="p-3 grid grid-cols-1 gap-3">
                                {#each group.data as item}
                                    <div class="bg-white p-3.5 rounded-xl border {mau.the} shadow-sm relative">
                                        <div class="flex justify-between items-start gap-2 mb-3">
                                            <h4 class="font-black text-slate-800 text-[14px] leading-snug line-clamp-2 break-words min-w-0" title={item.name}>{item.name}</h4>
                                            {#if item.target > 0}
                                                <span class="font-black {getColorClass(item.percentOfAvg)} text-[16px] bg-slate-50 px-2 py-0.5 rounded border border-slate-100 whitespace-nowrap shrink-0">
                                                    {formatters.formatNumber(item.percentOfAvg, 0)}%
                                                </span>
                                            {/if}
                                        </div>
                                        <div class="w-full bg-slate-100 rounded-full h-1.5 mb-3 overflow-hidden"><div class="{mau.thanh} h-1.5 rounded-full" style="width: {Math.max(0, Math.min(item.percentOfAvg || 0, 100))}%"></div></div>
                                        <div class="space-y-1.5 text-[12px]">
                                            <div class="flex justify-between items-center"><span class="text-slate-500 font-medium">Thực / Target:</span><span class="font-bold text-slate-800">{formatters.formatNumber(item.value)} <span class="text-slate-300 font-normal mx-0.5">/</span> {item.target > 0 ? formatters.formatNumber(item.target) : '-'}</span></div>
                                            <div class="flex justify-between items-center bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 gap-1">
                                                {#if coSo(item.diff)}
                                                    <span class="text-slate-600 font-medium">{item.diff >= 0 ? 'Vượt' : 'Thiếu'}: <strong class="{item.diff >= 0 ? 'text-green-600' : 'text-red-500'}">{formatters.formatNumber(Math.abs(item.diff))}</strong></span>
                                                {:else}
                                                    <span class="text-slate-600 font-medium">Vượt/Thiếu: <strong class="text-slate-400">—</strong></span>
                                                {/if}
                                                <span class="text-slate-300">|</span>
                                                <span class="text-slate-600 font-medium">Dự kiến: <strong class="text-blue-600">{coSo(item.projected) ? formatters.formatNumber(item.projected) : '—'}</strong></span>
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                {/each}
            </div>
        {/if}

        {#if chuaCoSoBan.length > 0}
            <div class="pt-5 border-t border-slate-200/60">
                <h3 class="font-bold text-slate-500 uppercase text-xs mb-3 flex items-center gap-1.5"><span class="material-icons-round text-[16px]">inbox</span> Chưa có số bán ({chuaCoSoBan.length})</h3>
                <div class="flex flex-wrap gap-2">
                    {#each chuaCoSoBan as item}
                        <span class="bg-red-600 text-yellow-300 px-3.5 py-1.5 rounded-full text-[11px] font-black shadow-sm uppercase tracking-wide break-words max-w-full">
                            {item.name}
                        </span>
                    {/each}
                </div>
            </div>
        {/if}
    {/if}
</div>
