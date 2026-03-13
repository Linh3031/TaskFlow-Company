<script>
    import { createEventDispatcher } from 'svelte';
    
    export let loadingData = false;
    export let faqCount = 0;
    export let isAdmin = false;
    export let showAdminPanel = false;

    const dispatch = createEventDispatcher();
</script>

<div class="bg-indigo-600 text-white p-3 sm:p-4 shrink-0 flex items-center justify-between shadow-md relative z-10">
    <div class="flex items-center gap-3">
        <div class="w-11 h-11 bg-white/90 rounded-full flex items-center justify-center p-0.5 shadow-inner shrink-0 overflow-hidden">
            <img src="/bot-icon.png" alt="Trợ lý ĐMX" class="w-full h-full object-contain drop-shadow-sm" />
        </div>
        
        <div>
            <h3 class="font-bold text-[15px] sm:text-base leading-tight text-white drop-shadow-sm">Trợ Lý Chính Sách</h3>
            <div class="text-[11px] sm:text-xs text-indigo-100 flex items-center gap-1 mt-0.5">
                {#if loadingData}
                    <span class="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span> Đang tải dữ liệu...
                {:else}
                    <span class="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_5px_#4ade80]"></span> Sẵn sàng • {faqCount} chủ đề
                {/if}
            </div>
        </div>
    </div>

    <div class="flex items-center gap-1">
        {#if isAdmin}
            <button 
                class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors {showAdminPanel ? 'bg-white/30' : ''}" 
                on:click={() => dispatch('toggleAdmin')}
                title="Quản lý dữ liệu"
            >
                <span class="material-icons-round text-sm sm:text-base">settings</span>
            </button>
        {/if}
        
        <button 
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors bg-white/10 sm:bg-transparent ml-1" 
            on:click={() => dispatch('closeChat')}
            title="Thu nhỏ"
        >
            <span class="material-icons-round text-xl">keyboard_arrow_down</span>
        </button>
    </div>
</div>