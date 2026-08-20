<script>
    import { createEventDispatcher } from 'svelte';
    import ChecklistImageGrid from './ChecklistImageGrid.svelte';

    export let item;
    export let isAdmin = false;
    export let uploadingId = null;
    export let todayScheduleMap = {}; // [CodeGenesis] Map Lịch được truyền từ cha
    export let dateStr = ''; // Truyền xuống để khóa nếu là ngày cũ

    const dispatch = createEventDispatcher();

    // [CodeGenesis] Phẫu thuật: Gom toàn bộ người trong mảng VÀ người chốt hạ cuối cùng để không sót ai
    $: uniqueContributors = (() => {
        const list = [];
        
        if (item.uploaders && item.uploaders.length > 0) {
            list.push(...item.uploaders);
        }
        if (item.completedBy) {
            list.push(item.completedBy);
        }
        return Array.from(new Set(list)).filter(Boolean).join(', ');
    })();

    // [CodeGenesis] Tính toán trạng thái OFF và lọc ra danh sách ca làm việc thực sự để khóa giờ
    $: mappedAssignees = (item.assignees || []).map(a => {
        const idLower = String(a.id || '').toLowerCase();
        const nameLower = String(a.username || '').toLowerCase();
        const shift = todayScheduleMap[idLower] || todayScheduleMap[nameLower] || '';
        const isOff = shift === 'OFF';
        return { ...a, shift, isOff };
    });
    
    // Thu thập tất cả các ca của những người KHÔNG OFF trong khu vực này
    // Chuyển cho ImageGrid để tính toán giờ khóa chung của quầy này.
    $: activeShifts = mappedAssignees.filter(a => !a.isOff).map(a => a.shift);
    
    // Cờ báo hiệu khu vực này TẤT CẢ mọi người đều OFF
    $: isAllOff = mappedAssignees.length > 0 && mappedAssignees.every(a => a.isOff);
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
             
            <!-- [CodeGenesis] Phẫu thuật Badge OFF -->
            <div class="text-[11px] text-slate-500 font-semibold mt-1 flex flex-wrap items-center gap-1.5">
                <span class="material-icons-round text-[14px] text-indigo-400">groups</span>
                {#if mappedAssignees.length > 0}
                    {#each mappedAssignees as ma, index}
                        <span class="flex items-center gap-1">
                            <span>{ma.username}</span>
                            {#if ma.isOff}
                                <span class="text-[9px] text-red-500 font-bold border border-red-500 bg-red-50 px-1 rounded shadow-sm">OFF</span>
                            {/if}
                            {#if index < mappedAssignees.length - 1}<span>,</span>{/if}
                        </span>
                    {/each}
                {:else}
                    <span>Chưa gán người</span>
                {/if}
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

    <!-- [CodeGenesis] Truyền activeShifts, isAllOff, isAdmin và dateStr để grid xử lý khóa -->
    <ChecklistImageGrid 
        {item} 
        {uploadingId}
        {activeShifts}
        {isAllOff}
        {isAdmin}
        {dateStr}
        on:upload 
        on:openLightbox 
    />
</div>