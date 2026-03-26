<script>
    import { formatFull, formatCompact } from '../../lib/installmentUtils.js';
    export let history = [];

    function deleteHistoryItem(id) { history = history.filter(item => item.id !== id); }
    function clearHistory() { if(confirm('Xóa toàn bộ lịch sử?')) history = []; }
    function clearSelection() { history = history.map(item => ({...item, selected: false})); }

    $: selectedItems = history.filter(h => h.selected);
    $: comboTotalProductPrice = selectedItems.reduce((sum, item) => sum + item.price, 0);
    $: comboTotalPrepaid = selectedItems.reduce((sum, item) => sum + item.prepaid, 0);
    $: comboTotalMonthly = selectedItems.reduce((sum, item) => sum + item.monthly, 0);
</script>

<div class="p-2 space-y-2 animate-fadeIn pb-24">
    {#if history.length === 0}
        <div class="text-center py-10 opacity-40">
            <span class="material-icons-round text-4xl mb-2 text-slate-300">history</span>
            <p class="text-xs font-bold text-slate-400">Bấm lưu bên tính toán để thêm sản phẩm vào danh sách tính combo</p>
        </div>
    {:else}
        <div class="flex justify-between items-center px-1 mb-2">
            <span class="text-[10px] font-bold text-slate-400 uppercase">Chọn để tính Combo</span>
            <button on:click={clearHistory} class="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase">Xóa hết</button>
        </div>
        {#each history as item (item.id)}
            <label class="bg-white p-3 rounded-lg shadow-sm border {item.selected ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'} relative group animate-slideIn flex gap-3 cursor-pointer select-none transition-all">
                <div class="flex items-center justify-center">
                    <input type="checkbox" bind:checked={item.selected} class="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600">
                </div>
                <div class="flex-1">
                    <button class="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1 z-10" on:click|preventDefault|stopPropagation={() => deleteHistoryItem(item.id)}><span class="material-icons-round text-base">close</span></button>
                    <div class="flex items-center gap-2 mb-2 pr-6">
                        <span class="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{item.timestamp}</span>
                        <span class="text-[10px] font-bold text-slate-500">Giá bán:</span>
                        <span class="text-xs font-black text-indigo-700">{formatCompact(item.price)}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2 text-center bg-slate-50 rounded p-2 border border-slate-100">
                        <div><div class="text-[8px] font-bold text-slate-400 uppercase">Trả Trước</div><div class="text-[10px] font-bold text-slate-700">{formatCompact(item.prepaid)}</div></div>
                        <div><div class="text-[8px] font-bold text-slate-400 uppercase">Góp/Tháng</div><div class="text-[10px] font-bold text-indigo-600">{formatCompact(item.monthly)}</div></div>
                        <div><div class="text-[8px] font-bold text-slate-400 uppercase">Kỳ Hạn</div><div class="text-[10px] font-bold text-slate-700">{item.term} Th</div></div>
                    </div>
                </div>
            </label>
        {/each}
    {/if}
</div>

{#if selectedItems.length > 0}
<div class="fixed bottom-0 left-0 w-full border-t border-indigo-200 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-[60] rounded-t-xl animate-slideUp pb-6 bg-indigo-50">
    <div class="p-3 max-w-md mx-auto">
        <div class="flex justify-between items-center mb-2">
            <span class="text-[10px] font-bold text-indigo-400 uppercase">Đang chọn: {selectedItems.length} đơn</span>
            <button on:click={clearSelection} class="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase bg-white px-2 py-0.5 rounded shadow-sm border border-red-100">Bỏ chọn tất cả</button>
        </div>
        <div class="grid grid-cols-3 gap-2">
            <div class="bg-white p-2 rounded shadow-sm border border-indigo-100 text-center">
                <div class="text-[8px] font-bold text-slate-400 uppercase">Tổng Giá Bán</div>
                <div class="text-xs font-black text-slate-700">{formatCompact(comboTotalProductPrice)}</div>
            </div>
            <div class="bg-white p-2 rounded shadow-sm border border-indigo-100 text-center">
                <div class="text-[8px] font-bold text-slate-400 uppercase">Tổng Trả Trước</div>
                <div class="text-xs font-black text-teal-600">{formatCompact(comboTotalPrepaid)}</div>
            </div>
            <div class="bg-white p-2 rounded shadow-sm border border-indigo-100 text-center">
                <div class="text-[8px] font-bold text-slate-400 uppercase">Tổng Góp/Th</div>
                <div class="text-xs font-black text-indigo-600">{formatCompact(comboTotalMonthly)}</div>
            </div>
        </div>
    </div>
</div>
{/if}

<style>
    .animate-slideIn { animation: slideInLeft 0.3s ease-out; }
    @keyframes slideInLeft { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
    .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>