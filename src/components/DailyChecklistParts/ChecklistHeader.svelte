<script>
    import { createEventDispatcher } from 'svelte';
    export let isAdmin = false;
    
    const dispatch = createEventDispatcher();
</script>

<div class="p-3 bg-white border-b border-cyan-200 flex justify-between items-center shrink-0 shadow-sm z-10">
    <div class="flex items-center gap-2">
        <span class="material-icons-round text-cyan-600 text-xl">fact_check</span>
        <div>
            <h3 class="font-bold text-slate-800 text-sm">Kiểm tra kỹ trước khi báo cáo</h3>
            <p class="text-[10px] text-slate-500">Yêu cầu 4 ảnh / khu vực</p>
        </div>
    </div>
    
    <div class="flex gap-2">
        <button class="bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 px-2 py-1.5 rounded-lg transition-colors flex items-center justify-center shadow-sm" on:click={() => dispatch('locate')} title="Đến khu vực của tôi">
            <span class="material-icons-round text-[16px]">my_location</span>
        </button>

        {#if isAdmin}
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