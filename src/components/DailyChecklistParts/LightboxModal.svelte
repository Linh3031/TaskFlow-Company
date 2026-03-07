<script>
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    export let show = false;
    export let images = [];
    export let currentIndex = 0;

    const dispatch = createEventDispatcher();

    function close() { dispatch('close'); }
    function next() { if (currentIndex < images.length - 1) dispatch('updateIndex', currentIndex + 1); }
    function prev() { if (currentIndex > 0) dispatch('updateIndex', currentIndex - 1); }

    function handleKeydown(e) {
        if (!show) return;
        if (e.key === 'ArrowRight') next();
        if (e.key === 'ArrowLeft') prev();
        if (e.key === 'Escape') close();
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
<div class="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-2 backdrop-blur-md animate-fadeIn" on:click={close}>
    
    <div class="absolute top-4 right-4 z-10 flex gap-4 text-white">
        <span class="text-sm font-bold bg-black/50 px-3 py-1 rounded-full">{currentIndex + 1} / {images.length}</span>
        <button class="hover:text-red-400 transition-colors" on:click={close}><span class="material-icons-round text-3xl drop-shadow-lg">close</span></button>
    </div>

    <div class="w-full h-full max-w-4xl max-h-[85vh] flex items-center justify-center relative" on:click|stopPropagation>
        <img src={images[currentIndex]} alt="Phóng to" class="max-w-full max-h-full object-contain rounded-md shadow-2xl animate-popIn" on:error={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/800x600/e2e8f0/64748b?text=Anh+Da+Bi+Xoa+Sau+5+Ngay'; }}>
        
        {#if currentIndex > 0}
            <button class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-all" on:click|stopPropagation={prev}>
                <span class="material-icons-round text-3xl">chevron_left</span>
            </button>
        {/if}

        {#if currentIndex < images.length - 1}
            <button class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-all" on:click|stopPropagation={next}>
                <span class="material-icons-round text-3xl">chevron_right</span>
            </button>
        {/if}
    </div>
</div>
{/if}

<style>
    .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
    .animate-popIn { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
</style>