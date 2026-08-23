<script>
    import { createEventDispatcher } from 'svelte';
    import { getTodayStr } from '../../lib/utils';
    
    export let item;
    export let uploadingId = null;
    export let activeShifts = []; 
    export let isAllOff = false; 
    export let isAdmin = false;  
    export let dateStr = '';     
    
    const dispatch = createEventDispatcher();

    $: timeLockData = (() => {
        if (isAdmin) return { locked: false, reason: '' };

        const today = getTodayStr();
        if (dateStr && dateStr < today) {
            return { locked: true, reason: 'Không thể báo cáo cho ngày cũ.' };
        }

        if (isAllOff) {
            return { locked: true, reason: 'Nhân sự phụ trách khu vực này đang OFF.' };
        }
        
        if (activeShifts.length === 0) {
            return { locked: false, reason: '' }; 
        }

        const currentHour = new Date().getHours();
        let needsNoonLock = false; 
        let needsEveningLock = false; 

        for (const shift of activeShifts) {
            const s = String(shift).toLowerCase();
            
            // [PHẪU THUẬT LOGIC]: Ép khóa ca rỗng vào 17h để đồng bộ với thẻ báo Trễ
            if (!s) {
                 needsEveningLock = true;
                 continue;
            }

            if (s.includes('2') || s === 'sáng' || s === 'full' || s === 'gãy') {
                needsNoonLock = true;
            }
            else if ((s.includes('4') || s.includes('5')) && !s.includes('2') || s === 'chiều') {
                needsEveningLock = true;
            }
        }

        if (needsNoonLock) {
            if (currentHour >= 12) return { locked: true, reason: 'Quá 12:00 (Nhân sự ca Sáng/Full/Gãy).' };
        }
        else if (needsEveningLock) {
            if (currentHour >= 17) return { locked: true, reason: 'Quá 17:00 (Nhân sự ca Chiều hoặc Không có ca).' };
        }

        return { locked: false, reason: '' };
    })();
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
        {#if timeLockData.locked}
            <div class="w-14 h-14 sm:w-16 sm:h-16 border-2 border-dashed border-red-200 rounded-lg flex flex-col items-center justify-center text-red-400 bg-red-50/50 shadow-inner" title={timeLockData.reason}>
                <span class="material-icons-round text-lg mb-0.5">lock_clock</span>
                <span class="text-[7px] font-bold uppercase text-center leading-tight px-1">Đã Khóa</span>
            </div>
        {:else}
            <label class="w-14 h-14 sm:w-16 sm:h-16 border-2 border-dashed border-orange-300 rounded-lg flex flex-col items-center justify-center text-orange-500 cursor-pointer hover:bg-orange-50 transition-colors bg-orange-50/30 relative shadow-inner {uploadingId === item.id ? 'pointer-events-none opacity-50' : ''}">
                <input type="file" multiple accept="image/*" class="absolute w-0 h-0 opacity-0" on:change={(e) => dispatch('upload', { event: e, itemId: item.id })} disabled={uploadingId === item.id}>
                {#if uploadingId === item.id}
                    <span class="material-icons-round text-lg animate-spin">sync</span>
                {:else}
                    <span class="material-icons-round text-lg mb-0.5">add_a_photo</span>
                    <span class="text-[8px] font-bold uppercase tracking-tighter text-orange-500 leading-none">Thêm</span>
                {/if}
            </label>
        {/if}
    {/if}
</div>