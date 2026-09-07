<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    
    export let editingShift;
    export let tempEditingShift;
    export let suggestions = []; // [NEW] Nhận danh sách gợi ý trám ca từ cha
    export let staffList = [];
    export let dayAssignments = [];

    const QUICK_SHIFTS = ['OFF', '123', '456', '23', '45', '2345', 'FULL'];

    function resetEditShift() {
        if (!editingShift) return;
        editingShift.shift = editingShift.originalShift;
        editingShift.role = editingShift.originalRole;
        editingShift.isOFF = editingShift.shift === 'OFF';

        if (swapTarget) {
            if (swapTarget.shift !== swapTarget.originalShift || swapTarget.role !== swapTarget.originalRole) {
                if (confirm(`Bạn vừa reset ca của ${editingShift.name}. Có muốn reset luôn ca của ${swapTarget.name} về ca gốc không?`)) {
                    resetSwapTarget();
                }
            }
        } else if (editingShift.swapWithId) {
            const partnerAssign = dayAssignments.find(a => a.staffId === editingShift.swapWithId);
            if (partnerAssign) {
                if (confirm(`Ca này đang được đổi với ${partnerAssign.name}. Có muốn reset luôn ca của ${partnerAssign.name} về ca gốc không?`)) {
                    swapTarget = {
                        staffId: partnerAssign.staffId,
                        name: partnerAssign.name,
                        shift: partnerAssign.shift,
                        role: partnerAssign.role || 'TV',
                        isOFF: partnerAssign.shift === 'OFF',
                        originalShift: partnerAssign.originalShift !== undefined ? partnerAssign.originalShift : partnerAssign.shift,
                        originalRole: (partnerAssign.originalRole !== undefined ? partnerAssign.originalRole : (partnerAssign.role || 'TV')) || 'TV'
                    };
                    resetSwapTarget();
                }
            }
        }
    }

    function resetSwapTarget() {
        if (!swapTarget) return;
        swapTarget.shift = swapTarget.originalShift;
        swapTarget.role = swapTarget.originalRole;
        swapTarget.isOFF = swapTarget.shift === 'OFF';
    }

    let showSwapSearch = false;
    let searchSwap = '';
    let swapTarget = null;
    let swapNotFound = false;

    $: filteredSwapCandidates = staffList.filter(s => s.id !== editingShift.staffId && s.name.toLowerCase().includes(searchSwap.toLowerCase()));

    function toggleSwapSearch() {
        showSwapSearch = !showSwapSearch;
        searchSwap = '';
        swapNotFound = false;
    }

    function selectSwapTarget(s) {
        const assign = dayAssignments.find(a => a.staffId === s.id);
        if (!assign) { swapNotFound = true; return; }
        swapTarget = {
            staffId: s.id,
            name: s.name,
            shift: assign.shift,
            role: assign.role || 'TV',
            isOFF: assign.shift === 'OFF',
            originalShift: assign.shift,
            originalRole: assign.role || 'TV'
        };
        showSwapSearch = false;
        searchSwap = '';
        swapNotFound = false;
    }

    function clearSwapTarget() { swapTarget = null; }

    function selectQuickShiftA(value) {
        if (value === 'CUSTOM') { editingShift.isOFF = false; if (QUICK_SHIFTS.includes(editingShift.shift)) editingShift.shift = ''; }
        else if (value === 'OFF') { editingShift.isOFF = true; editingShift.shift = 'OFF'; }
        else { editingShift.isOFF = false; editingShift.shift = value; }
    }

    function selectQuickShiftB(value) {
        if (value === 'CUSTOM') { swapTarget.isOFF = false; if (QUICK_SHIFTS.includes(swapTarget.shift)) swapTarget.shift = ''; }
        else if (value === 'OFF') { swapTarget.isOFF = true; swapTarget.shift = 'OFF'; }
        else { swapTarget.isOFF = false; swapTarget.shift = value; }
    }

    function handleSwapFlip() { dispatch('swapFlip', { staffBId: swapTarget.staffId }); }

    function handleSave() { dispatch('save', swapTarget ? { swapTarget } : {}); }
</script>

<div class="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full {swapTarget || showSwapSearch ? 'max-w-md' : 'max-w-sm'} rounded-xl p-5 shadow-2xl flex flex-col max-h-[90vh]" on:click|stopPropagation>
        <div class="flex justify-between items-start mb-4 shrink-0">
            <div><h3 class="font-bold text-lg text-slate-800">Sửa Ca: {editingShift.name}</h3><p class="text-xs text-gray-500">Ngày {editingShift.day} - Hiện tại: <span class="font-bold">{tempEditingShift.shift}</span></p></div>
            {#if editingShift.shift !== editingShift.originalShift || editingShift.role !== editingShift.originalRole}
                <button class="text-xs text-red-600 hover:underline font-bold bg-red-50 px-2 py-1 rounded" on:click={resetEditShift}>Reset về gốc</button>
            {/if}
        </div>

        <div class="mb-4 shrink-0">
            {#if !swapTarget}
                <button class="w-full py-2.5 rounded-xl border-2 border-indigo-400 text-indigo-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors" on:click={toggleSwapSearch}>
                    <span class="material-icons-round text-base">swap_horiz</span> Đổi ca với người khác
                </button>
                {#if showSwapSearch}
                    <div class="mt-2 p-2 border rounded-lg bg-slate-50">
                        <input type="text" bind:value={searchSwap} placeholder="Gõ tìm tên nhân viên..." class="w-full p-2 border rounded bg-white outline-none text-sm focus:ring-2 focus:ring-indigo-200" autofocus>
                        <div class="max-h-32 overflow-y-auto mt-1">
                            {#each filteredSwapCandidates as s}
                                <div class="p-2 text-sm hover:bg-indigo-50 cursor-pointer rounded font-medium" on:click={() => selectSwapTarget(s)}>{s.name}</div>
                            {/each}
                        </div>
                        {#if swapNotFound}<p class="text-xs text-red-600 mt-1">Người này chưa có ca trong ngày {editingShift.day}.</p>{/if}
                    </div>
                {/if}
            {:else}
                <div class="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div class="flex justify-between items-center mb-3">
                        <h4 class="text-xs font-black text-indigo-800 flex items-center gap-1"><span class="material-icons-round text-sm">swap_horiz</span> Đang đổi ca</h4>
                        <button class="text-xs text-slate-500 hover:underline" on:click={clearSwapTarget}>Bỏ chọn</button>
                    </div>
                    <div class="flex items-center gap-2 mb-3">
                        <div class="flex-1 bg-white rounded-lg border p-2 text-center overflow-hidden">
                            <div class="text-sm font-black text-indigo-900 truncate">{editingShift.name}</div>
                            <div class="text-[11px] text-gray-500 font-bold mt-0.5">{editingShift.isOFF ? 'OFF' : editingShift.shift}</div>
                        </div>
                        <span class="material-icons-round text-indigo-400 shrink-0">sync_alt</span>
                        <div class="flex-1 bg-white rounded-lg border p-2 text-center overflow-hidden">
                            <div class="text-sm font-black text-indigo-900 truncate">{swapTarget.name}</div>
                            <div class="text-[11px] text-gray-500 font-bold mt-0.5">{swapTarget.isOFF ? 'OFF' : swapTarget.shift}</div>
                        </div>
                    </div>
                    <button class="w-full py-2 rounded-lg bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition-colors" on:click={handleSwapFlip}>
                        🔁 Đảo ca 1-1 ngay (dùng ca gốc, bỏ qua sửa tay)
                    </button>
                </div>
            {/if}
        </div>

        <div class="space-y-4 overflow-y-auto pr-1">
            {#if !swapTarget}
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
            {:else}
                <div class="grid grid-cols-2 gap-3">
                    <div class="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                        <div class="text-sm font-black text-indigo-900 mb-2 truncate">{editingShift.name}</div>
                        <select value={editingShift.isOFF ? 'OFF' : (QUICK_SHIFTS.includes(editingShift.shift) ? editingShift.shift : 'CUSTOM')} on:change={(e) => selectQuickShiftA(e.target.value)} class="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold bg-white">
                            {#each QUICK_SHIFTS as s}<option value={s}>{s}</option>{/each}
                            <option value="CUSTOM">Khác (nhập tay)</option>
                        </select>
                        {#if !editingShift.isOFF && !QUICK_SHIFTS.includes(editingShift.shift)}
                            <input type="text" value={editingShift.shift} on:input={(e) => editingShift.shift = e.target.value} class="w-full p-2 border border-gray-300 rounded-lg text-center font-bold text-sm mt-2" placeholder="Nhập mã ca">
                        {/if}
                        <select bind:value={editingShift.role} disabled={editingShift.isOFF} class="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold bg-white disabled:bg-gray-100 disabled:text-gray-400 mt-2">
                            {#each ['TV', 'Thu Ngân', 'Kho', 'GH'] as r}<option value={r}>{r}</option>{/each}
                        </select>
                    </div>
                    <div class="p-2.5 bg-indigo-50/60 rounded-lg border border-indigo-100">
                        <div class="text-sm font-black text-indigo-900 mb-2 truncate">{swapTarget.name}</div>
                        <select value={swapTarget.isOFF ? 'OFF' : (QUICK_SHIFTS.includes(swapTarget.shift) ? swapTarget.shift : 'CUSTOM')} on:change={(e) => selectQuickShiftB(e.target.value)} class="w-full p-2 border border-indigo-200 rounded-lg text-sm font-bold bg-white">
                            {#each QUICK_SHIFTS as s}<option value={s}>{s}</option>{/each}
                            <option value="CUSTOM">Khác (nhập tay)</option>
                        </select>
                        {#if !swapTarget.isOFF && !QUICK_SHIFTS.includes(swapTarget.shift)}
                            <input type="text" value={swapTarget.shift} on:input={(e) => swapTarget.shift = e.target.value} class="w-full p-2 border border-indigo-200 rounded-lg text-center font-bold text-sm mt-2" placeholder="Nhập mã ca">
                        {/if}
                        <select bind:value={swapTarget.role} disabled={swapTarget.isOFF} class="w-full p-2 border border-indigo-200 rounded-lg text-sm font-bold bg-white disabled:bg-gray-100 disabled:text-gray-400 mt-2">
                            {#each ['TV', 'Thu Ngân', 'Kho', 'GH'] as r}<option value={r}>{r}</option>{/each}
                        </select>
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
            <button class="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all" on:click={handleSave}>Lưu Lịch</button>
        </div>
    </div>
</div>