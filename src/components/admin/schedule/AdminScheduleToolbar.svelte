<script>
    import { createEventDispatcher } from 'svelte';
    export let isDemoMode = false;
    export let setupMode = 'auto'; 
    export let byGender = false;

    const dispatch = createEventDispatcher();
</script>

<div class="w-full bg-[#E6F1FB] rounded-[10px] px-3 py-2 overflow-x-auto">
    <div class="flex flex-nowrap items-center gap-3 w-max text-[13px]">
        <div id="toolbar-actions" class="flex items-center gap-2 whitespace-nowrap shrink-0">
            <span class="text-[11px] font-semibold text-slate-500">Thiết lập</span>
            <button class="h-[34px] px-3 rounded-[8px] bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-[13px] transition-colors flex items-center gap-1.5" on:click={() => dispatch('openConfig')}>
                <span class="material-icons-round text-[16px] text-[#378ADD]">settings</span> Khai báo giờ công
            </button>
            
            <button class="h-[34px] px-3 rounded-[8px] bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-[13px] transition-colors flex items-center gap-1.5" on:click={() => dispatch('openRoster')} title="Sắp xếp danh sách ưu tiên chạy ca">
                <span class="material-icons-round text-[16px] text-[#378ADD]">format_list_numbered</span> Đội Hình
            </button>
        </div>

        <div class="w-px h-6 bg-[#B5D4F4] shrink-0"></div>

        <div class="flex items-center gap-2 whitespace-nowrap shrink-0">
            <span class="text-[11px] font-semibold text-slate-500">Chế độ</span>
            <div class="h-[34px] flex items-center gap-0.5 bg-white p-0.5 rounded-[8px] border border-slate-200">
                <label class="h-full flex items-center gap-1.5 cursor-pointer px-3 rounded-[6px] text-[13px] transition-colors {setupMode === 'auto' ? 'bg-[#534AB7] text-white font-semibold' : 'text-slate-500 hover:text-slate-700 font-medium'}">
                    <input type="radio" bind:group={setupMode} value="auto" class="hidden">
                    <span class="material-icons-round text-[16px]">auto_awesome</span> Tự Động (AI)
                </label>
                <label class="h-full flex items-center gap-1.5 cursor-pointer px-3 rounded-[6px] text-[13px] transition-colors {setupMode === 'manual' ? 'bg-[#534AB7] text-white font-semibold' : 'text-slate-500 hover:text-slate-700 font-medium'}">
                    <input type="radio" bind:group={setupMode} value="manual" class="hidden">
                    <span class="material-icons-round text-[16px]">grid_on</span> Excel Thủ Công
                </label>
            </div>
        </div>

        {#if setupMode === 'auto'}
            <div class="w-px h-6 bg-[#B5D4F4] shrink-0"></div>

            <label class="h-[34px] flex items-center gap-2 cursor-pointer px-3 rounded-[8px] border border-[#F4C0D1] bg-white text-[13px] font-semibold text-[#993556] whitespace-nowrap shrink-0" title="Khai báo định mức theo Nam/Nữ thay vì theo bộ phận">
                <input type="checkbox" bind:checked={byGender} class="sr-only">
                <span class="relative inline-block w-8 h-[18px] rounded-full transition-colors shrink-0 {byGender ? 'bg-[#D4537E]' : 'bg-slate-300'}">
                    <span class="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform {byGender ? 'translate-x-[14px]' : ''}"></span>
                </span>
                <span class="material-icons-round text-[16px]">wc</span> Phân ca theo Nam/Nữ
            </label>
        {/if}
    </div>
</div>
