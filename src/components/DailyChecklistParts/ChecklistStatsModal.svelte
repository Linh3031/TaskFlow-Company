<script>
    import { createEventDispatcher } from 'svelte';
    export let show = false;
    export let statsData = { matrix: [], days: [], month: '' };
    export let statsLoading = false;
    const dispatch = createEventDispatcher();
    
    let sortBy = 'total'; // 'total' | 'name'
    let sortDesc = true;

    $: sortedMatrix = [...statsData.matrix].sort((a, b) => {
        if (sortBy === 'total') {
            return sortDesc ? b.total - a.total : a.total - b.total;
        } else {
            return sortDesc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
        }
    });

    function toggleSort(field) {
        if (sortBy === field) {
            sortDesc = !sortDesc;
        } else {
            sortBy = field;
            sortDesc = field === 'total'; // Mặc định name thì asc, total thì desc
        }
    }

    // [CodeGenesis] Tính toán dòng Tổng cộng toàn kho
    $: grandTotal = sortedMatrix.reduce((sum, row) => sum + row.total, 0);
    $: dailyTotals = statsData.days.reduce((acc, day) => {
        acc[day] = sortedMatrix.reduce((sum, row) => sum + (row.days[day] || 0), 0);
        return acc;
    }, {});
</script>

{#if show}
<div class="fixed inset-0 z-[80] bg-slate-900/70 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-popIn h-[85vh]" on:click|stopPropagation>
        
        <div class="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center shrink-0">
            <div>
                <h3 class="font-bold text-indigo-800 flex items-center gap-2">
                    <span class="material-icons-round">bar_chart</span>
                    Thống Kê Upload Ảnh 8NTTT - Tháng {statsData.month}
                </h3>
                <p class="text-xs text-indigo-600 mt-0.5">Thống kê chi tiết số lượng ảnh do từng nhân sự tải lên</p>
            </div>
            <button class="text-slate-400 hover:text-red-500 bg-white rounded-full p-1 shadow-sm" on:click={() => dispatch('close')}>
                <span class="material-icons-round">close</span>
            </button>
        </div>

        <div class="flex-1 overflow-auto bg-slate-50 relative">
            
            {#if statsLoading}
                <div class="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
                    <span class="material-icons-round animate-spin text-indigo-500 text-4xl mb-2">sync</span>
                    <span class="text-sm font-bold text-slate-500">Đang cào dữ liệu 31 ngày...</span>
                </div>
            {/if}

            <table class="w-full text-sm text-left border-collapse">
                <thead class="text-xs text-slate-600 uppercase bg-slate-200 sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th class="px-4 py-3 border-r border-slate-300 sticky left-0 bg-slate-200 z-30 cursor-pointer hover:bg-slate-300" on:click={() => toggleSort('name')}>
                            <div class="flex items-center gap-1">
                                NHÂN SỰ 
                                {#if sortBy === 'name'}<span class="material-icons-round text-[14px]">{sortDesc ? 'arrow_downward' : 'arrow_upward'}</span>{/if}
                            </div>
                        </th>
                        <th class="px-4 py-3 border-r border-slate-300 cursor-pointer hover:bg-slate-300 bg-indigo-100 text-indigo-800" on:click={() => toggleSort('total')}>
                            <div class="flex items-center gap-1">
                                TỔNG THÁNG 
                                {#if sortBy === 'total'}<span class="material-icons-round text-[14px]">{sortDesc ? 'arrow_downward' : 'arrow_upward'}</span>{/if}
                            </div>
                        </th>
                        {#each statsData.days as day}
                            <th class="px-2 py-3 border-r border-slate-300 text-center min-w-[35px]">{day}</th>
                        {/each}
                    </tr>
                </thead>
                <tbody>
                    {#each sortedMatrix as row, index}
                        <tr class="bg-white border-b hover:bg-indigo-50/50 transition-colors">
                            <td class="px-4 py-2 border-r font-bold text-slate-800 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">
                                {row.name}
                            </td>
                            <td class="px-4 py-2 border-r font-black text-indigo-600 bg-indigo-50/30 text-center text-base">
                                {row.total}
                            </td>
                            {#each statsData.days as day}
                                <td class="px-2 py-2 border-r text-center {row.days[day] ? 'font-bold text-cyan-600 bg-cyan-50/30' : 'text-slate-300'}">
                                    {row.days[day] || '-'}
                                </td>
                            {/each}
                        </tr>
                    {/each}
                    {#if sortedMatrix.length === 0 && !statsLoading}
                        <tr>
                            <td colspan={statsData.days.length + 2} class="text-center py-10 text-slate-500 font-bold">
                                Không có dữ liệu upload nào trong tháng này.
                            </td>
                        </tr>
                    {/if}
                </tbody>
                
                {#if sortedMatrix.length > 0 && !statsLoading}
                <tfoot class="sticky bottom-0 z-20 bg-indigo-100 text-indigo-900 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
                    <tr>
                        <td class="px-4 py-3 border-r border-indigo-200 font-black sticky left-0 bg-indigo-100 z-30 uppercase">
                            Tổng Toàn Kho
                        </td>
                        <td class="px-4 py-3 border-r border-indigo-200 font-black text-center text-lg text-indigo-700">
                            {grandTotal}
                        </td>
                        {#each statsData.days as day}
                            <td class="px-2 py-3 border-r border-indigo-200 text-center font-bold {dailyTotals[day] ? 'text-indigo-800' : 'text-indigo-300'}">
                                {dailyTotals[day] || '-'}
                            </td>
                        {/each}
                    </tr>
                </tfoot>
                {/if}
                
            </table>
        </div>
    </div>
</div>
{/if}

<style>
    .animate-popIn { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>