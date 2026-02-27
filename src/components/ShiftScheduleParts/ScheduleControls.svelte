<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    
    export let myStores = [];
    export let scheduleData = null;
    export let isAdmin = false;
    export let selectedViewStore = '';
    export let viewMonth;
    export let viewYear;
    export let showPastDays;
    
    // Thêm trạng thái 'RS' (Roadshow)
    export let currentMode = 'NV'; 

    function prevMonth() {
        if (viewMonth === 1) { viewMonth = 12; viewYear--; } 
        else { viewMonth--; }
    }
    function nextMonth() {
        if (viewMonth === 12) { viewMonth = 1; viewYear++; } 
        else { viewMonth++; }
    }
</script>

<div class="flex flex-wrap items-center justify-between mb-3 px-1 gap-2">
    <div class="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar shrink-0">
        
        <div class="flex bg-slate-200 p-0.5 rounded-lg border border-slate-300 shadow-inner shrink-0">
            <button class="px-3 py-1 text-xs font-bold rounded-md transition-all {currentMode === 'NV' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}" on:click={() => currentMode = 'NV'}>NV</button>
            <button class="px-3 py-1 text-xs font-bold rounded-md transition-all {currentMode === 'PG' ? 'bg-pink-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}" on:click={() => currentMode = 'PG'}>PG</button>
            <button class="px-3 py-1 text-xs font-bold rounded-md transition-all {currentMode === 'RS' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}" on:click={() => currentMode = 'RS'}>Roadshow</button>
        </div>

        {#if myStores.length > 1}
            <div id="store-view-selector" class="relative shrink-0">
                <select bind:value={selectedViewStore} class="pl-2 pr-6 py-1 bg-white border border-gray-200 text-indigo-700 font-bold rounded-lg text-xs outline-none appearance-none cursor-pointer shadow-sm hover:border-indigo-300 transition-colors">
                    {#each myStores as s}<option value={s}>{s}</option>{/each}
                </select>
                <span class="material-icons-round absolute right-1 top-1/2 -translate-y-1/2 text-indigo-400 text-[10px] pointer-events-none">expand_more</span>
            </div>
        {:else}
            <span class="font-bold text-gray-500 text-xs bg-gray-100 px-2 py-1 rounded shrink-0">Kho {selectedViewStore}</span>
        {/if}

        {#if currentMode === 'NV'}
            <div class="flex items-center gap-1 bg-white p-0.5 rounded-lg border shadow-sm shrink-0">
                <button class="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded" on:click={prevMonth}>
                    <span class="material-icons-round text-gray-500 text-sm">chevron_left</span>
                </button>
                <span class="font-bold text-indigo-700 px-1 min-w-[60px] text-center text-xs">T{viewMonth}/{viewYear}</span>
                <button class="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded" on:click={nextMonth}>
                    <span class="material-icons-round text-gray-500 text-sm">chevron_right</span>
                </button>
            </div>
        {/if}
    </div>
    
    {#if scheduleData && currentMode === 'NV'}
        <div class="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
            <button class="flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-bold text-xs shadow hover:bg-slate-200 transition-all border border-slate-200 shrink-0" on:click={() => showPastDays = !showPastDays} title="Ẩn/Hiện các ngày trước hôm nay">
                <span class="material-icons-round text-[14px]">{showPastDays ? 'visibility_off' : 'visibility'}</span>
                <span class="hidden md:inline">{showPastDays ? 'Ẩn ngày cũ' : 'Hiện ngày cũ'}</span>
            </button>
            <button class="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg font-bold text-xs shadow hover:bg-indigo-100 transition-all border border-indigo-100 shrink-0" on:click={() => dispatch('openHistory')} title="Xem lịch sử giờ công các tháng trước">
                <span class="material-icons-round text-[14px]">history</span> <span class="hidden sm:inline">Lũy Kế</span>
            </button>
            {#if isAdmin}
                 <button class="flex items-center gap-1 bg-slate-200 text-slate-700 px-2 py-1 rounded-lg font-bold text-xs shadow hover:bg-slate-300 transition-all shrink-0" on:click={() => dispatch('restoreBackup')} title="Hoàn tác về phiên bản trước khi áp dụng">
                    <span class="material-icons-round text-[14px]">restore</span> <span class="hidden sm:inline">Khôi Phục</span>
                </button>
            {/if}
            <button class="flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded-lg font-bold text-xs shadow hover:bg-green-700 transition-all shrink-0" on:click={() => dispatch('exportExcel')}>
                <span class="material-icons-round text-[14px]">download</span> <span class="hidden sm:inline">Xuất Excel</span>
            </button>
            <button class="flex items-center justify-center bg-purple-500 text-white w-6 h-6 rounded shadow hover:bg-purple-600 transition-all shrink-0" on:click={() => dispatch('startTour')} title="Hướng dẫn xem lịch">
                <span class="material-icons-round text-[14px]">help_outline</span>
            </button>
        </div>
    {/if}
</div>

<style>
    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>