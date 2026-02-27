<script>
    import { createEventDispatcher } from 'svelte';

    export let editingShift;
    export let tempEditingShift;

    const dispatch = createEventDispatcher();
    const QUICK_SHIFTS = ['OFF', '123', '456', '23', '45', '2345'];
</script>

<div class="fixed inset-0 z-[80] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}> 
    <div class="bg-white w-full max-w-sm rounded-xl p-5 shadow-2xl" on:click|stopPropagation> 
        <div class="flex justify-between items-start mb-4"> 
            <div>
                <h3 class="font-bold text-lg text-slate-800">Sửa Ca: {editingShift.name}</h3>
                <p class="text-xs text-gray-500">Ngày {editingShift.day} - Hiện tại: <span class="font-bold">{tempEditingShift.shift}</span></p>
            </div> 
            {#if editingShift.shift !== editingShift.originalShift || editingShift.role !== editingShift.originalRole} 
                <button class="text-xs text-red-600 hover:underline font-bold bg-red-50 px-2 py-1 rounded" on:click={() => dispatch('reset')}>Reset về gốc</button> 
            {/if} 
        </div> 
        <div class="space-y-4"> 
            <div> 
                <label class="block text-xs font-bold text-gray-500 mb-2">Chọn Ca Nhanh</label> 
                <div class="grid grid-cols-3 gap-2 mb-2"> 
                    {#each QUICK_SHIFTS as s} 
                        <button class="py-2 border rounded-lg font-bold text-xs transition-all shadow-sm {editingShift.isOFF && s==='OFF' ? 'bg-red-600 text-yellow-300 border-red-600 ring-2 ring-red-200' : (!editingShift.isOFF && editingShift.shift === s ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200' : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200')}" on:click={() => { if(s === 'OFF') { editingShift.isOFF = true; editingShift.shift = 'OFF'; } else { editingShift.isOFF = false; editingShift.shift = s; } }}>{s}</button> 
                    {/each} 
                </div> 
                <label class="block text-xs font-bold text-gray-500 mb-1 mt-3">Ca Tùy Chỉnh</label> 
                <input type="text" value={editingShift.isOFF ? 'OFF' : editingShift.shift} on:input={(e) => { if(!editingShift.isOFF) editingShift.shift = e.target.value; }} disabled={editingShift.isOFF} class="w-full p-2.5 border rounded-lg text-center font-bold text-sm transition-colors {editingShift.isOFF ? 'bg-red-600 text-yellow-300 border-red-600 cursor-not-allowed opacity-100' : 'bg-white text-slate-800 border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200'}" placeholder="Nhập mã ca (vd: 12-56)"> 
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
        </div> 
        <div class="flex gap-3 mt-6"> 
            <button class="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors" on:click={() => dispatch('close')}>Hủy Bỏ</button> 
            <button class="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all" on:click={() => dispatch('save')}>Lưu Thay Đổi</button> 
        </div> 
    </div> 
</div>