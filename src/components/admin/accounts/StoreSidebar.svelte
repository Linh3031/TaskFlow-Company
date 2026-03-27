<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    
    export let storeList = [];
    export let selectedStoreId = '';
    export let storeCountMap = {};
    
    let storeSearchQuery = '';
    let sortField = 'id'; // 'id' hoặc 'count'
    let sortAsc = true;

    function toggleSort(field) {
        if (sortField === field) sortAsc = !sortAsc;
        else { sortField = field; sortAsc = (field === 'id'); } // Count mặc định giảm dần
    }

    $: filteredStores = storeList
        .filter(s => s.id.toLowerCase().includes(storeSearchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortField === 'id') {
                return sortAsc ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
            } else {
                let countA = storeCountMap[a.id] || 0;
                let countB = storeCountMap[b.id] || 0;
                return sortAsc ? countA - countB : countB - countA;
            }
        });
</script>

<div class="w-full md:w-64 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col shrink-0 animate-fadeIn h-full">
    <div class="p-3 border-b border-slate-100 bg-slate-50">
        <h3 class="font-bold text-slate-700 text-sm flex items-center justify-between mb-3">
            <span class="flex items-center gap-2"><span class="material-icons-round text-indigo-500 text-base">store</span> Danh Sách Kho</span>
            <span class="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded font-black">{storeList.length}</span>
        </h3>
        <div class="relative mb-2">
            <span class="material-icons-round absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input type="text" bind:value={storeSearchQuery} placeholder="Tìm mã kho..." class="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors shadow-sm uppercase">
        </div>
        <div class="flex gap-1">
            <button class="flex-1 bg-white border border-slate-200 text-[10px] font-bold py-1 rounded text-slate-500 hover:bg-slate-100 {sortField==='id'?'bg-indigo-50 text-indigo-700 border-indigo-200':''}" on:click={() => toggleSort('id')}>
                Mã Kho {sortField==='id'?(sortAsc?'▲':'▼'):''}
            </button>
            <button class="flex-1 bg-white border border-slate-200 text-[10px] font-bold py-1 rounded text-slate-500 hover:bg-slate-100 {sortField==='count'?'bg-indigo-50 text-indigo-700 border-indigo-200':''}" on:click={() => toggleSort('count')}>
                Số lượng {sortField==='count'?(sortAsc?'▲':'▼'):''}
            </button>
        </div>
    </div>
    <div class="flex-1 overflow-y-auto p-2 space-y-1">
        {#each filteredStores as store}
            <button class="w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all flex justify-between items-center group {selectedStoreId === store.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}" on:click={() => dispatch('select', store.id)}>
                <span>{store.id}</span>
                <div class="flex items-center gap-1.5">
                    <span class="text-[10px] px-1.5 py-0.5 rounded shadow-sm {selectedStoreId === store.id ? 'bg-indigo-500 text-white' : 'bg-white border border-slate-200 text-slate-500 group-hover:bg-slate-200'}">{storeCountMap[store.id] || 0}</span>
                    <div class="w-5 h-5 rounded hover:bg-red-500 hover:text-white flex items-center justify-center {selectedStoreId === store.id ? 'text-indigo-200' : 'text-transparent group-hover:text-slate-400'} transition-colors" title="Xóa toàn bộ kho và nhân sự" on:click|stopPropagation={() => dispatch('deleteStore', store.id)}>
                        <span class="material-icons-round text-[14px]">delete_forever</span>
                    </div>
                </div>
            </button>
        {/each}
        {#if filteredStores.length === 0}
            <div class="text-center p-4 text-xs font-bold text-slate-400">Không tìm thấy kho "{storeSearchQuery}"</div>
        {/if}
    </div>
</div>