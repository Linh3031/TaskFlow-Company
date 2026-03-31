<script>
    import { createEventDispatcher } from 'svelte';
    export let isDemoMode = false;
    export let setupMode = 'auto'; 

    const dispatch = createEventDispatcher();
</script>

<div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
    <div class="flex items-center gap-4">
        <div id="toolbar-actions" class="flex items-center gap-2">
            <button class="bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center gap-1 border border-gray-200" on:click={() => dispatch('openConfig')}>
                <span class="material-icons-round text-sm">settings</span> Khai báo giờ công
            </button>
            
            <button class="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center gap-1 border border-indigo-200 shadow-sm" on:click={() => dispatch('openRoster')} title="Sắp xếp danh sách ưu tiên chạy ca">
                <span class="material-icons-round text-sm">format_list_numbered</span> Đội Hình
            </button>
        </div>

        <div class="w-px h-8 bg-slate-200 mx-1 hidden lg:block"></div>

        <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner">
            <label class="flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-md transition-all {setupMode === 'auto' ? 'bg-white text-indigo-700 shadow-sm font-bold ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 font-medium'}">
                <input type="radio" bind:group={setupMode} value="auto" class="hidden">
                <span class="material-icons-round text-[16px]">auto_awesome</span> Tự Động (AI)
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-md transition-all {setupMode === 'manual' ? 'bg-white text-indigo-700 shadow-sm font-bold ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 font-medium'}">
                <input type="radio" bind:group={setupMode} value="manual" class="hidden">
                <span class="material-icons-round text-[16px]">grid_on</span> Excel Thủ Công
            </label>
        </div>
    </div>
    <div class="flex items-center gap-2">
         <button id="btn-help-schedule" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400" on:click={() => dispatch('openHelp')}><span class="material-icons-round">help_outline</span></button>
    </div>
</div>