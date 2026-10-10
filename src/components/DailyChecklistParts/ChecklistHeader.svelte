<script>
    import { createEventDispatcher } from 'svelte';
    export let isAdmin = false;
    
    const dispatch = createEventDispatcher();
</script>

<div class="p-3 bg-white border-b border-cyan-200 flex justify-between items-center shrink-0 shadow-sm z-10">
    <div class="flex items-center gap-2 flex-1 min-w-0 pr-2">
        <span class="material-icons-round text-cyan-600 text-xl shrink-0">fact_check</span>
        <div class="min-w-0 overflow-hidden">
            <h3 class="font-bold text-slate-800 text-sm truncate">Hạn chót hoàn tất 8NTTT</h3>
            <p class="text-[10px] text-slate-500 leading-tight"><span class="font-bold text-red-600">12:00</span> — Ca có số 2 (123, 23, 2-5, 2345, 123456…), hoặc PG ca Sáng / Full / Gãy</p>
            <p class="text-[10px] text-slate-500 leading-tight"><span class="font-bold text-orange-600">17:00</span> — Ca 45, 456, hoặc PG ca Chiều</p>
        </div>
    </div>
    
    <div class="flex gap-2">
        <button class="bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 px-2 py-1.5 rounded-lg transition-colors flex items-center justify-center shadow-sm" on:click={() => dispatch('locate')} title="Đến khu vực của tôi">
            <span class="material-icons-round text-[16px]">my_location</span>
        </button>

        {#if isAdmin}
            <button class="bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm" on:click={() => dispatch('autoRotate')} title="Tự động xoay vòng ca">
                <span class="material-icons-round text-[14px]">autorenew</span> 
                <span class="hidden sm:inline">Trộn Lịch</span>
            </button>

            <button class="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm" on:click={() => dispatch('openStats')}>
                <span class="material-icons-round text-[14px]">pie_chart</span> 
                <span class="hidden sm:inline">Thống Kê</span>
            </button>

            <button class="bg-cyan-50 border border-cyan-200 text-cyan-700 hover:bg-cyan-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm" on:click={() => dispatch('openAdmin')}>
                <span class="material-icons-round text-[14px]">add_circle</span> 
                <span class="hidden sm:inline">Thêm Khu Vực</span>
            </button>
        {/if}
    </div>
</div>