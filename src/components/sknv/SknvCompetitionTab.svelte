<script>
    export let thiDuaList = []; 

    // Chia nhóm & Sắp xếp giảm dần
    $: listDat = thiDuaList.filter(i => (i.hoanThanhValue || 0) >= 100).sort((a, b) => b.hoanThanhValue - a.hoanThanhValue);
    $: listSapDat = thiDuaList.filter(i => (i.hoanThanhValue || 0) >= 80 && (i.hoanThanhValue || 0) < 100).sort((a, b) => b.hoanThanhValue - a.hoanThanhValue);
    $: listCoGang = thiDuaList.filter(i => (i.hoanThanhValue || 0) < 80).sort((a, b) => b.hoanThanhValue - a.hoanThanhValue);
    const fmtNum = (val) => new Intl.NumberFormat('vi-VN').format(val || 0);
    const fmtPct = (val) => ((val || 0)).toFixed(0) + '%';
</script>

<div class="space-y-6 pb-4">
    {#if !thiDuaList || thiDuaList.length === 0}
        <div class="p-8 text-center bg-white rounded-2xl shadow-sm border border-gray-100">
            <span class="material-icons-round text-4xl text-gray-300 mb-2">sports_score</span>
            <p class="text-gray-500 font-medium text-sm">Chưa có dữ liệu thi đua.</p>
        </div>
    {:else}
        {#snippet renderGroup(title, list, colorClass, barColor)}
            {#if list.length > 0}
                <div>
                    <h3 class="text-xs font-black uppercase tracking-wider mb-2 {colorClass} flex items-center gap-1">
                        <div class="w-2 h-2 rounded-full {barColor}"></div> {title} ({list.length})
                    </h3>
    
                    <div class="grid grid-cols-2 gap-2">
                        {#each list as item}
                            <div class="bg-white border border-gray-100 rounded-xl p-2.5 shadow-sm flex flex-col justify-between">
                 
                                <h4 class="font-bold text-gray-700 text-[11px] leading-tight mb-2 line-clamp-2 min-h-[30px]" title={item.name}>{item.name}</h4>
                                
                                <div class="w-full bg-gray-100 rounded-full h-2 mb-2 relative overflow-hidden">
                                    <div class="h-full rounded-full {barColor}" style="width: {Math.min(item.hoanThanhValue || 0, 100)}%;"></div>
                                </div>

                                <div class="flex justify-between items-end">
                                    <div class="text-[10px] text-gray-500 leading-tight">
                                        <div class="mb-0.5">Bán: <strong class="text-gray-800">{fmtNum(item.luyKe)}</strong></div>
                                        <div>Target: <strong class="text-gray-800">{fmtNum(item.target)}</strong></div>
                                    </div>
                                    <span class="text-[11px] font-black {colorClass}">{fmtPct(item.hoanThanhValue)}</span>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        {/snippet}

        {@render renderGroup('Hoàn Thành Tốt', listDat, 'text-blue-600', 'bg-blue-500')}
        {@render renderGroup('Sắp Đạt Kế Hoạch', listSapDat, 'text-emerald-600', 'bg-emerald-500')}
        {@render renderGroup('Cần Nỗ Lực Hơn', listCoGang, 'text-orange-500', 'bg-orange-400')}
    {/if}
</div>