<script>
    import { createEventDispatcher } from 'svelte';
    export let loadingData = false;
    export let faqCount = 0;
    export let isAdmin = false;
    export let showAdminPanel = false;

    const dispatch = createEventDispatcher();
</script>

<div class="bg-indigo-600 text-white p-3 flex justify-between items-center shrink-0 shadow-md z-10">
    <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 border-2 border-indigo-300">
            <span class="material-icons-round text-indigo-600 text-2xl {loadingData ? 'animate-spin' : 'animate-pulse'}">
                {loadingData ? 'sync' : 'smart_toy'}
            </span>
        </div>
        <div>
            <h3 class="font-bold text-[15px] leading-tight">Trợ Lý Chính Sách</h3>
            <p class="text-[11px] text-indigo-100 flex items-center gap-1">
                <span class="w-2 h-2 {loadingData ? 'bg-orange-400' : 'bg-green-400'} rounded-full"></span> 
                {loadingData ? 'Đang kết nối...' : `${faqCount} chủ đề`}
            </p>
        </div>
    </div>
    
    {#if isAdmin}
        <button class="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-500 hover:bg-indigo-700 transition-colors" on:click={() => dispatch('toggleAdmin')} title="Quản trị dữ liệu">
            <span class="material-icons-round text-sm">{showAdminPanel ? 'forum' : 'settings'}</span>
        </button>
    {/if}
</div>