<script>
    import { createEventDispatcher } from 'svelte';
    
    export let item;
    export let uploadingId = null;
    
    const dispatch = createEventDispatcher();
</script>

<div class="flex flex-wrap gap-2 mt-1">
    {#each (item.imageUrls || []) as url, index}
        <button class="w-14 h-14 sm:w-16 sm:h-16 rounded-lg border border-slate-200 shadow-sm overflow-hidden bg-slate-100 flex items-center justify-center group relative outline-none" on:click={() => dispatch('openLightbox', { images: item.imageUrls, index })}>
            
            <img 
                src={url} 
                alt="Checklist pic" 
                loading="lazy" 
                decoding="async"
                class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" 
                on:error={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100/e2e8f0/64748b?text=Da+Xoa'; }}
            >
            
            <span class="material-icons-round text-white absolute text-sm drop-shadow-md opacity-0 group-hover:opacity-100">zoom_in</span>
        </button>
    {/each}

    {#if (item.imageUrls || []).length < 4}
        <label class="w-14 h-14 sm:w-16 sm:h-16 border-2 border-dashed border-orange-300 rounded-lg flex flex-col items-center justify-center text-orange-500 cursor-pointer hover:bg-orange-50 transition-colors bg-orange-50/30 relative shadow-inner">
            <input type="file" multiple accept="image/*" class="absolute w-0 h-0 opacity-0" on:change={(e) => dispatch('upload', { event: e, itemId: item.id })} disabled={uploadingId === item.id}>
            {#if uploadingId === item.id}
                <span class="material-icons-round text-lg animate-spin">sync</span>
            {:else}
                <span class="material-icons-round text-lg mb-0.5">add_a_photo</span>
                <span class="text-[8px] font-bold uppercase tracking-tighter text-orange-500 leading-none">Thêm</span>
            {/if}
        </label>
    {/if}
</div>