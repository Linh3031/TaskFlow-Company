<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    // Nhận dữ liệu từ component cha truyền xuống
    export let myStores = [];
    export let scheduleData = null;
    export let isAdmin = false;

    // Các biến dùng bind: (có thể thay đổi giá trị và báo ngược lại cho cha)
    export let selectedViewStore = '';
    export let viewMonth;
    export let viewYear;
    export let showPastDays;

    function prevMonth() {
        if (viewMonth === 1) { viewMonth = 12; viewYear--; } 
        else { viewMonth--; }
    }

    function nextMonth() {
        if (viewMonth === 12) { viewMonth = 1; viewYear++; } 
        else { viewMonth++; }
    }
</script>

<div class="flex items-center justify-between mb-3 px-1">
    <div class="flex items-center gap-2">
        {#if myStores.length > 1}
            <div id="store-view-selector" class="relative">
                <select bind:value={selectedViewStore} class="pl-3 pr-8 py-1.5 bg-white border border-gray-200 text-indigo-700 font-bold rounded-lg text-sm outline-none appearance-none cursor-pointer shadow-sm hover:border-indigo-300 transition-colors">
                    {#each myStores as s}<option value={s}>{s}</option>{/each}
                </select>
                <span class="material-icons-round absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 text-sm pointer-events-none">expand_more</span>
            </div>
        {:else}
            <span class="font-bold text-gray-500 text-sm bg-gray-100 px-2 py-1 rounded">Kho {selectedViewStore}</span>
        {/if}

        <div class="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
            <button class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded" on:click={prevMonth}>
                <span class="material-icons-round text-gray-500">chevron_left</span>
            </button>
            <span class="font-bold text-indigo-700 px-2 min-w-[90px] text-center text-sm">T{viewMonth}/{viewYear}</span>
            <button class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded" on:click={nextMonth}>
                <span class="material-icons-round text-gray-500">chevron_right</span>
            </button>
        </div>
    </div>
    
    {#if scheduleData}
        <div class="flex gap-2">
            <button class="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold text-xs shadow hover:bg-slate-200 transition-all border border-slate-200" on:click={() => showPastDays = !showPastDays} title="Ẩn/Hiện các ngày trước hôm nay">
                <span class="material-icons-round text-sm">{showPastDays ? 'visibility_off' : 'visibility'}</span>
                <span class="hidden sm:inline">{showPastDays ? 'Ẩn ngày cũ' : 'Hiện ngày cũ'}</span>
            </button>
            
            <button class="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-bold text-xs shadow hover:bg-indigo-100 transition-all border border-indigo-100" on:click={() => dispatch('openHistory')} title="Xem lịch sử giờ công các tháng trước">
                <span class="material-icons-round text-sm">history</span> Lũy Kế
            </button>
            
            {#if isAdmin}
                 <button class="flex items-center gap-2 bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-xs shadow hover:bg-slate-300 transition-all" on:click={() => dispatch('restoreBackup')} title="Hoàn tác về phiên bản trước khi áp dụng">
                    <span class="material-icons-round text-sm">history</span> Khôi Phục
                </button>
            {/if}
            
            <button class="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow hover:bg-green-700 transition-all" on:click={() => dispatch('exportExcel')}>
                <span class="material-icons-round text-sm">download</span> Xuất Excel
            </button>
            
            <button class="flex items-center justify-center bg-purple-500 text-white w-8 h-8 rounded-lg shadow hover:bg-purple-600 transition-all" on:click={() => dispatch('startTour')} title="Hướng dẫn xem lịch">
                <span class="material-icons-round text-lg">help_outline</span>
            </button>
        </div>
    {/if}
</div>