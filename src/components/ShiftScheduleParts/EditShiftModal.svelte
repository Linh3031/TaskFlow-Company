<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    
    export let editingShift;
    export let tempEditingShift;
    export let suggestions = []; // [NEW] Nhận danh sách gợi ý trám ca từ cha

    const QUICK_SHIFTS = ['OFF', '123', '456', '23', '45', '2345'];

    function resetEditShift() { 
        if (!editingShift) return;
        editingShift.shift = editingShift.originalShift;
        editingShift.role = editingShift.originalRole; 
        editingShift.isOFF = editingShift.shift === 'OFF';
    }
</script>

<div class="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-sm rounded-xl p-5 shadow-2xl flex flex-col max-h-[90vh]" on:click|stopPropagation>
        <div class="flex justify-between items-start mb-4 shrink-0">
            <div><h3 class="font-bold text-lg text-slate-800">Sửa Ca: {editingShift.name}</h3><p class="text-xs text-gray-500">Ngày {editingShift.day} - Hiện tại: <span class="font-bold">{tempEditingShift.shift}</span></p></div>
            {#if editingShift.shift !== editingShift.originalShift || editingShift.role !== editingShift.originalRole}
                <button class="text-xs text-red-600 hover:underline font-bold bg-red-50 px-2 py-1 rounded" on:click={resetEditShift}>Reset về gốc</button>
            {/if}
        </div>
        
        <div class="space-y-4 overflow-y-auto pr-1">
            <div>
                <label class="block text-xs font-bold text-gray-500 mb-2">Chọn Ca Nhanh</label>
                 <div class="grid grid-cols-3 gap-2 mb-2">
                    {#each QUICK_SHIFTS as s}
                        <button class="py-2 border rounded-lg font-bold text-xs transition-all shadow-sm {editingShift.isOFF && s==='OFF' ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-200' : (!editingShift.isOFF && editingShift.shift === s ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200' : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200')}" on:click={() => { if(s === 'OFF') { editingShift.isOFF = true; editingShift.shift = 'OFF'; } else { editingShift.isOFF = false; editingShift.shift = s; } }}>{s}</button>
                    {/each}
                </div>
                 <label class="block text-xs font-bold text-gray-500 mb-1 mt-3">Ca Tùy Chỉnh</label>
                <input type="text" value={editingShift.isOFF ? 'OFF' : editingShift.shift} on:input={(e) => { if(!editingShift.isOFF) editingShift.shift = e.target.value; }} disabled={editingShift.isOFF} class="w-full p-2.5 border rounded-lg text-center font-bold text-sm transition-colors {editingShift.isOFF ? 'bg-red-50 text-red-700 border-red-200 cursor-not-allowed opacity-100' : 'bg-white text-slate-800 border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200'}" placeholder="Nhập mã ca (vd: 12-56)">
            </div>
            
            {#if !editingShift.isOFF}
                <div class="p-3 bg-gray-50 rounded-lg border border-gray-200 animate-fadeIn">
                    <label class="block text-xs font-bold text-gray-500 mb-2">Vai Trò Mới</label>
                    <div class="grid grid-cols-2 gap-2">
                        {#each ['TV', 'Thu Ngân', 'Kho', 'GH'] as r}
                            <label class="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-gray-200 hover:border-indigo-300 transition-colors">
                                 <input type="radio" bind:group={editingShift.role} value={r} class="accent-indigo-600 w-4 h-4">
                                <span class="text-xs font-bold {r==='GH'?'text-blue-600':(r==='Thu Ngân'?'text-purple-600':(r==='Kho'?'text-orange-600':'text-gray-600'))}">{r}</span>
                            </label>
                         {/each}
                    </div>
                </div>
             {/if}

             {#if editingShift.isOFF && suggestions.length > 0}
                 <div class="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg animate-fadeIn">
                     <h4 class="text-[11px] font-black text-indigo-800 mb-2 flex items-center gap-1 uppercase tracking-wider">
                         <span class="material-icons-round text-sm">psychology</span> Trám Ca Thông Minh
                     </h4>
                     <div class="space-y-2">
                         {#each suggestions as sugg}
                             <div class="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-sm cursor-pointer hover:border-indigo-400 hover:shadow transition-all group" on:click={() => dispatch('applySmartCover', sugg.actions)}>
                                 <div class="font-bold text-indigo-700 mb-1.5 flex items-center gap-1 text-xs group-hover:text-indigo-800">
                                     <span class="material-icons-round text-[14px]">{sugg.type === 'chain' ? 'link' : 'merge_type'}</span>
                                     {sugg.title}
                                 </div>
                                 <div class="space-y-1">
                                     {#each sugg.actions as act}
                                         <div class="text-xs text-gray-600 ml-5 flex items-center gap-1.5">
                                             <span class="font-bold text-slate-800 w-16 truncate">{act.name}</span> 
                                             <span class="bg-gray-100 px-1 rounded text-[10px] font-mono">{act.oldShift}</span> 
                                             <span class="material-icons-round text-[10px] text-indigo-400">arrow_forward</span> 
                                             <span class="font-black text-indigo-600 bg-indigo-50 px-1 rounded text-[10px] font-mono">{act.newShift}</span>
                                         </div>
                                     {/each}
                                 </div>
                             </div>
                         {/each}
                     </div>
                 </div>
             {/if}
        </div>
        
        <div class="flex gap-3 mt-6 shrink-0">
             <button class="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors" on:click={() => dispatch('close')}>Hủy Bỏ</button>
            <button class="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all" on:click={() => dispatch('save')}>Lưu Lịch</button>
        </div>
    </div>
</div>