<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    
    export let selectedStaff;
    export let getRoleBadge;
    
    export let isAdmin = false;
    export let availableStaffToSwap = []; 

    let showSwapPanel = false;
    let selectedNewStaffId = '';

    function confirmSwap() {
        if (!selectedNewStaffId) return alert("Vui lòng chọn nhân viên mới!");
        const newStaffObj = availableStaffToSwap.find(s => s.id === selectedNewStaffId);
        if (!newStaffObj) return;
        
        dispatch('swapStaff', {
            oldStaffId: selectedStaff.id || selectedStaff.stats.id,
            newStaff: newStaffObj
        });
    }
</script>

<div class="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" on:click|stopPropagation>
        <div class="p-4 bg-indigo-500 text-white shrink-0 relative">
            <h3 class="font-bold text-lg pr-24 truncate">{selectedStaff.name}</h3>
            
            {#if isAdmin}
                <button class="absolute top-3 right-3 px-2.5 py-1.5 flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg shadow-sm transition-all" title="Thế chỗ nhân sự khác" on:click={() => showSwapPanel = !showSwapPanel}>
                    <span class="material-icons-round text-[16px]">swap_horiz</span>
                    <span class="text-[11px] font-bold uppercase tracking-wider">Đổi Người</span>
                </button>
            {/if}

            <div class="flex justify-between mt-3 text-xs font-bold bg-indigo-600/50 p-2 rounded">
               <span>{Math.round(selectedStaff.stats.totalHours) || 0} Giờ</span>
                <span class="text-blue-100">GH: {selectedStaff.stats.gh || 0}</span>
                <span class="text-purple-100">TN: {selectedStaff.stats.tn || 0}</span>
                <span class="text-orange-100">K: {selectedStaff.stats.kho || 0}</span>
            </div>
        </div>

        {#if showSwapPanel && isAdmin}
            <div class="p-3 bg-amber-50 border-b border-amber-200 shrink-0 animate-fadeIn">
                <label class="block text-[11px] font-bold text-amber-900 uppercase mb-2 flex items-center gap-1">
                    <span class="material-icons-round text-[14px]">warning</span> Thay người gánh vác lịch này
                </label>
                <div class="flex gap-2">
                    <select bind:value={selectedNewStaffId} class="flex-1 p-2 text-sm border border-amber-300 rounded outline-none font-bold text-slate-700 bg-white shadow-sm cursor-pointer">
                        <option value="">-- Chọn nhân viên rảnh --</option>
                        {#each availableStaffToSwap as staff}
                            <option value={staff.id}>{staff.name} ({staff.gender || 'Nữ'})</option>
                        {/each}
                    </select>
                    <button class="px-3 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs transition-colors shadow-sm whitespace-nowrap" on:click={confirmSwap}>
                        Thế Chỗ
                    </button>
                </div>
                <p class="text-[10px] text-amber-700 mt-1.5 italic">Lưu ý: Nhân viên mới sẽ nhận toàn bộ ca làm việc và chỉ số nghiệp vụ từ nhân viên cũ.</p>
            </div>
        {/if}

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
        <div class="p-3 border-t bg-white text-center"><button class="w-full py-2 bg-gray-100 rounded-lg text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors" on:click={() => dispatch('close')}>Đóng</button></div>
    </div>
</div>

<style>
    .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
</style>