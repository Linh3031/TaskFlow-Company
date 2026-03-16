<script>
    import { createEventDispatcher } from 'svelte';
    export let show = false;
    export let editingAreaId = null;
    export let newAreaName = '';
    export let allStaff = [];
    export let selectedStaffIds = [];
    
    let searchStaffQuery = '';
    const dispatch = createEventDispatcher();

    // [CodeGenesis] Phẫu thuật: Lọc và Sắp xếp (người được chọn nằm trên cùng)
    $: filteredStaff = allStaff
        .filter(s => s.username.toLowerCase().includes(searchStaffQuery.toLowerCase()))
        .sort((a, b) => {
            const isASelected = selectedStaffIds.includes(a.id);
            const isBSelected = selectedStaffIds.includes(b.id);
            
            if (isASelected && !isBSelected) return -1;
            if (!isASelected && isBSelected) return 1;
            return a.username.localeCompare(b.username);
        });

    function toggleStaffSelection(staffId) {
        if (selectedStaffIds.includes(staffId)) {
            selectedStaffIds = selectedStaffIds.filter(id => id !== staffId);
        } else {
            selectedStaffIds = [...selectedStaffIds, staffId];
        }
    }

    // [CodeGenesis] Thêm nút bỏ chọn tất cả
    function clearAllSelected() {
        selectedStaffIds = [];
    }
</script>

{#if show}
<div class="fixed inset-0 z-[70] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-popIn max-h-[90vh]" on:click|stopPropagation>
        <div class="p-4 bg-cyan-50 border-b border-cyan-100 flex justify-between items-center shrink-0">
            <h3 class="font-bold text-cyan-800">{editingAreaId ?
'Sửa Khu Vực' : 'Thêm Khu Vực 8NTTT'}</h3>
            <button class="text-slate-400 hover:text-red-500" on:click={() => dispatch('close')}><span class="material-icons-round">close</span></button>
        </div>
        
        <div class="p-4 flex-1 overflow-y-auto space-y-4 bg-white">
            <div>
                <label class="block text-xs font-bold text-slate-500 mb-1">Tên Khu Vực / Quầy Kệ</label>
        
                <input type="text" bind:value={newAreaName} placeholder="Vd: Quầy Tivi Sony..." class="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-semibold focus:border-cyan-500 focus:ring-1 focus:ring-cyan-200 outline-none">
            </div>
            
            <div class="flex flex-col h-full">
                <div class="flex justify-between items-end mb-2">
                    <label class="block text-xs font-bold text-slate-500">Người Phụ Trách (Chọn nhiều)</label>
                    {#if selectedStaffIds.length > 0}
                        <button class="text-[10px] font-bold text-red-500 hover:text-red-700 hover:bg-red-100 bg-red-50 px-2 py-0.5 rounded border border-red-200 transition-colors" on:click={clearAllSelected}>
                            Bỏ chọn tất cả ({selectedStaffIds.length})
                        </button>
                    {/if}
                </div>
                 
                <div class="relative mb-2">
                    <span class="material-icons-round absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[16px]">search</span>
                    <input type="text" bind:value={searchStaffQuery} placeholder="Tìm nhân viên..." class="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-cyan-500">
               
                </div>

                <div class="max-h-56 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-1.5 space-y-0.5">
                    {#each filteredStaff as s}
                        <label class="flex items-center gap-3 p-2 hover:bg-cyan-100 rounded-md cursor-pointer transition-colors border border-transparent hover:border-cyan-200 {selectedStaffIds.includes(s.id) ?
'bg-cyan-50 border-cyan-200' : ''}">
                            <input type="checkbox" checked={selectedStaffIds.includes(s.id)} on:change={() => toggleStaffSelection(s.id)} class="w-4 h-4 accent-cyan-600 rounded">
                            <span class="text-sm font-semibold text-slate-700">{s.username}</span>
                        </label>
     
                    {/each}
                    {#if filteredStaff.length === 0}
                        <div class="text-xs text-center text-slate-400 py-4 font-bold">Không tìm thấy nhân sự phù hợp</div>
                    {/if}
       
                 </div>
            </div>
        </div>

        <div class="p-3 bg-slate-50 border-t flex gap-2 shrink-0">
            <button class="flex-1 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100" on:click={() => dispatch('close')}>Hủy</button>
            <button class="flex-[2] py-2 rounded-xl bg-cyan-600 text-white font-bold text-sm shadow-md hover:bg-cyan-700 transition-colors" on:click={() => dispatch('save')}>
       
                 {editingAreaId ?
'Cập Nhật' : 'Lưu Khu Vực'}
            </button>
        </div>
    </div>
</div>
{/if}

<style>
    .animate-popIn { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
    @keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1);
} }
</style>