<script>
    import { createEventDispatcher } from 'svelte';
    import ChecklistImageGrid from './ChecklistImageGrid.svelte';
    import { ROLE_MAP } from '../../lib/shiftConstants.js';

    export let item;
    export let isAdmin = false;
    export let uploadingId = null;
    export let todayScheduleMap = {};
    export let todayRoleMap = {};
    export let dateStr = '';

    const dispatch = createEventDispatcher();

    $: uniqueContributors = (() => {
        const list = [];
        if (item.uploaders && item.uploaders.length > 0) list.push(...item.uploaders);
        if (item.completedBy) list.push(item.completedBy);
        return Array.from(new Set(list)).filter(Boolean).join(', ');
    })();

    $: mappedAssignees = (item.assignees || []).map(a => {
        // [PHẪU THUẬT LOGIC]: Bơm .normalize('NFC') để đồng bộ chuẩn Unicode với dataSection
        const idLower = String(a.id || '').normalize('NFC').trim().toLowerCase();
        const nameLower = String(a.username || '').normalize('NFC').trim().toLowerCase();
        
        let shiftRaw = todayScheduleMap[idLower] || todayScheduleMap[nameLower] || '';
        const shift = String(shiftRaw).trim();
        const isOff = shift.toUpperCase() === 'OFF';

        const roleRaw = String(todayRoleMap[idLower] || todayRoleMap[nameLower] || '').trim();
        const isGH = ROLE_MAP[roleRaw] === 'gh';

        let isLate = false;

        if (!item.completed && !isOff && !isGH) {
            const [y, m, d] = dateStr.split('-').map(Number);
            const targetDateObj = new Date(y, m - 1, d);
            const now = new Date();
            const todayObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            if (targetDateObj < todayObj) {
                isLate = true;
            } 
            else if (targetDateObj.getTime() === todayObj.getTime()) {
                const s = shift.toLowerCase();
                const currentHour = now.getHours();
                
                let needsNoonLock = s.includes('2') || s === 'sáng' || s === 'full' || s === 'gãy';
                let needsEveningLock = ((s.includes('4') || s.includes('5')) && !s.includes('2')) || s === 'chiều' || s === ''; 

                if (needsNoonLock && currentHour >= 12) isLate = true;
                else if (needsEveningLock && currentHour >= 17) isLate = true;
            }
        }

        return { ...a, shift, isOff, isLate, isGH };
    });
    
    $: activeShifts = mappedAssignees.filter(a => !a.isOff).map(a => a.shift);
    $: isAllOff = mappedAssignees.length > 0 && mappedAssignees.every(a => a.isOff);
</script>

<div class="bg-white p-3 rounded-xl border-y border-r shadow-sm flex flex-col gap-2 transition-all duration-300 {item.completed ? 'bg-slate-50 border-l-4 border-l-green-500 border-y-slate-200 border-r-slate-200 opacity-70 hover:opacity-100' : 'border-l-4 border-l-orange-500 border-y-slate-200 border-r-slate-200 hover:border-cyan-400'}">
                    
    <div class="flex justify-between items-start">
        <div class="flex-1 pr-2 min-w-0">
            <div class="flex items-center gap-2">
                <div class="font-bold text-slate-800 text-sm truncate {item.completed ? 'line-through decoration-green-400' : ''}">{item.areaName}</div>
                
                {#if isAdmin}
                    <div class="flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity shrink-0">
                        <button class="text-slate-500 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-100" on:click={() => dispatch('edit', item)} title="Sửa khu vực">
                            <span class="material-icons-round text-[14px]">edit</span>
                        </button>
                        <button class="text-slate-500 hover:text-red-500 p-0.5 rounded hover:bg-slate-100" on:click={() => dispatch('delete', { id: item.id, name: item.areaName })} title="Xóa khu vực">
                            <span class="material-icons-round text-[14px]">delete</span>
                        </button>
                    </div>
                {/if}
            </div>
             
            <div class="text-[11px] text-slate-500 font-semibold mt-1.5 flex flex-wrap items-center gap-1.5">
                <span class="material-icons-round text-[14px] text-indigo-400 shrink-0">groups</span>
                
                {#if mappedAssignees.length > 0}
                    <div class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        {#each mappedAssignees as ma, index}
                            <div class="flex items-center gap-1">
                                <span class={ma.isLate ? 'text-slate-700 font-bold' : ''}>{ma.username}</span>
                                
                                {#if ma.isOff}
                                    <span class="text-[9px] text-red-500 font-bold border border-red-500 bg-red-50 px-1 rounded shadow-sm">OFF</span>
                                {/if}

                                {#if ma.isGH}
                                    <span class="text-[9px] text-blue-600 font-bold border border-blue-500 bg-blue-50 px-1 rounded shadow-sm" title="Ca giao hàng - không cần thực hiện">GH</span>
                                {/if}

                                {#if ma.isLate}
                                    <span class="text-[9px] text-white font-black bg-gradient-to-r from-red-500 to-rose-600 px-1.5 py-0.5 rounded shadow-sm border border-red-700 animate-pulse flex items-center whitespace-nowrap">
                                        Đã trễ
                                    </span>
                                {/if}
                                
                                {#if index < mappedAssignees.length - 1}
                                    <span class="text-slate-300">,</span>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {:else}
                    <span class="text-red-400 font-bold">Chưa gán người</span>
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

    <ChecklistImageGrid 
        {item} 
        {uploadingId}
        {activeShifts}
        {isAllOff}
        {isAdmin}
        {dateStr}
        on:upload
        on:openCamera
        on:openLightbox
    />
</div>