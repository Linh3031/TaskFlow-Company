<script>
    import { createEventDispatcher } from 'svelte';
    import ChecklistImageGrid from './ChecklistImageGrid.svelte';

    export let item;
    export let isAdmin = false;
    export let uploadingId = null;

    const dispatch = createEventDispatcher();

    // [CodeGenesis] Phẫu thuật: Gom toàn bộ người trong mảng VÀ người chốt hạ cuối cùng để không sót ai
    $: uniqueContributors = (() => {
        const list = [];
        
        // 1. Nhặt tất cả những người đã up ảnh (nếu có)
        if (item.uploaders && item.uploaders.length > 0) {
            list.push(...item.uploaders);
        }
        
        // 2. Dự phòng: Luôn nhét thêm người completedBy vào (để cứu dữ liệu cũ)
        if (item.completedBy) {
            list.push(item.completedBy);
        }
        
        // 3. Lọc trùng (Set) và loại bỏ các giá trị rỗng/undefined (filter Boolean)
        return Array.from(new Set(list)).filter(Boolean).join(', ');
    })();
</script>

<div class="bg-white p-3 rounded-xl border-y border-r shadow-sm flex flex-col gap-2 transition-all duration-300 {item.completed ? 'bg-slate-50 border-l-4 border-l-green-500 border-y-slate-200 border-r-slate-200 opacity-70 hover:opacity-100' : 'border-l-4 border-l-orange-500 border-y-slate-200 border-r-slate-200 hover:border-cyan-400'}">
                    
    <div class="flex justify-between items-start">
        <div class="flex-1 pr-2">
            <div class="flex items-center gap-2">
                <div class="font-bold text-slate-800 text-sm {item.completed ? 'line-through decoration-green-400' : ''}">{item.areaName}</div>
                
                {#if isAdmin}
                    <div class="flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                        <button class="text-slate-500 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-100" on:click={() => dispatch('edit', item)} title="Sửa khu vực">
                            <span class="material-icons-round text-[14px]">edit</span>
                        </button>
                        <button class="text-slate-500 hover:text-red-500 p-0.5 rounded hover:bg-slate-100" on:click={() => dispatch('delete', { id: item.id, name: item.areaName })} title="Xóa khu vực">
                            <span class="material-icons-round text-[14px]">delete</span>
                        </button>
                    </div>
                {/if}
            </div>
             
            <div class="text-[11px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
                <span class="material-icons-round text-[14px] text-indigo-400">groups</span>
                {(item.assignees || []).map(a => a.username).join(', ') || 'Chưa gán người'}
            </div>
        </div>
        
        <div class="text-right shrink-0">
            {#if item.completed}
                <div class="inline-flex items-center gap-1 text-green-700 font-bold text-[10px] bg-green-100 px-2 py-0.5 rounded-full border border-green-300 mb-0.5 shadow-sm">
                    <span class="material-icons-round text-[12px]">check_circle</span> Hoàn tất
                </div>
                <div class="text-[9px] text-slate-500 mt-0.5">
                    ✍️ {uniqueContributors || item.completedBy} • {item.completedAt}
                </div>
            {:else}
                <div class="text-[10px] shrink-0 font-bold px-2 py-1 rounded bg-orange-100 text-orange-600 border border-orange-300 shadow-sm mb-0.5">
                    Chưa đạt ({(item.imageUrls || []).length}/4)
                </div>
                {#if uniqueContributors}
                    <div class="text-[9px] text-slate-500 mt-0.5">
                        ✍️ {uniqueContributors}
                    </div>
                {/if}
            {/if}
        </div>
    </div>

    <ChecklistImageGrid 
        {item} 
        {uploadingId}
        on:upload 
        on:openLightbox 
    />
</div>