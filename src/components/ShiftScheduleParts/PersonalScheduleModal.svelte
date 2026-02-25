<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    
    export let selectedStaff;
    export let getRoleBadge; // Hàm lấy nhãn chức vụ truyền từ cha xuống
</script>

<div class="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" on:click|stopPropagation>
        <div class="p-4 bg-indigo-500 text-white shrink-0">
            <h3 class="font-bold text-lg">{selectedStaff.name}</h3>
            <div class="flex justify-between mt-2 text-xs font-bold bg-indigo-600/50 p-2 rounded">
               <span>{Math.round(selectedStaff.stats.totalHours) || 0} Giờ</span>
                <span class="text-blue-100">GH: {selectedStaff.stats.gh || 0}</span>
                <span class="text-purple-100">TN: {selectedStaff.stats.tn || 0}</span>
                <span class="text-orange-100">K: {selectedStaff.stats.kho || 0}</span>
            </div>
        </div>
        <div class="flex-1 overflow-y-auto p-3 bg-slate-100">
            <div class="grid grid-cols-7 gap-1 mb-1 text-center text-[10px] font-bold text-gray-400 uppercase">
                {#each ['T2','T3','T4','T5','T6','T7','CN'] as day}<div>{day}</div>{/each}
            </div>
            <div class="grid grid-cols-7 gap-1">
                {#each selectedStaff.blankCells as _}<div class="bg-transparent"></div>{/each}
                {#each selectedStaff.days as d}
                    <div class="bg-white rounded border shadow-sm p-1 flex flex-col items-center justify-center aspect-square {d.shift==='OFF'?'opacity-60 bg-slate-100':''}">
                        <div class="text-[10px] text-gray-400 font-bold mb-1">{d.day}</div>
                        <div class="font-black text-slate-800 text-xs {d.shift==='OFF'?'text-slate-400':''}">{d.shift}</div>
                        {#if d.shift !== 'OFF'}
                            {@const badge = getRoleBadge(d.role)}
                            {#if badge}<span class="text-[9px] font-bold px-1 rounded mt-0.5 leading-tight {badge.class}">{badge.text}</span>{/if}
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
        <div class="p-3 border-t bg-white text-center"><button class="w-full py-2 bg-gray-100 rounded text-gray-600 font-bold text-sm" on:click={() => dispatch('close')}>Đóng</button></div>
    </div>
</div>