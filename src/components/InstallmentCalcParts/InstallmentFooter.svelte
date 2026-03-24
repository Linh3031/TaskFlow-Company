<script>
    import { formatCompact } from '../../lib/installmentUtils.js';
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    export let monthlyPayment = 0;
    export let includeBhkvInPrepaid = true;
    export let includeBh11 = true;
    export let includeBhmr = true;
    
    export let bhkvRatePercent = 0;
    export let bhkvValue = 0;
    export let bh11Fee = 0;
    export let bhmrFee = 0;
    
    export let totalPrepaid = 0;
    export let finalTotalPrice = 0;
    export let productPrice = 0;
    export let diffPrice = 0;
</script>

<div class="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-[60] rounded-t-xl animate-slideUp pb-4">
    <div class="p-3 max-w-md mx-auto">
        <div class="flex justify-between items-end mb-2">
            <div>
                <div class="text-[9px] font-bold text-slate-400 uppercase">Góp mỗi tháng (Đã +12k phí thu hộ)</div>
                <div class="text-3xl font-black text-indigo-600 tracking-tighter leading-none">
                    {formatCompact(Math.round(monthlyPayment))}
                </div>
            </div>
            <button on:click={() => dispatch('save')} class="bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-600 p-2 rounded-lg flex flex-col items-center justify-center transition-all border border-indigo-100 shrink-0 shadow-sm" title="Lưu vào lịch sử">
                <span class="material-icons-round text-xl">save</span>
                <span class="text-[8px] font-bold uppercase mt-0.5">Lưu</span>
            </button>
        </div>

        <div class="text-[9px] font-bold text-slate-400 mb-1 flex items-center gap-1">
            <span class="material-icons-round text-[11px] text-indigo-400">touch_app</span> Chạm vào phí để Thêm/Bớt khỏi Hóa Đơn
        </div>
        <div class="flex flex-wrap gap-1.5 mb-2">
            {#if bh11Fee > 0}
                <button on:click={() => includeBh11 = !includeBh11} class="border text-[10px] font-bold px-2 py-1 rounded-md shadow-sm transition-all active:scale-95 {includeBh11 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-400 line-through opacity-70'}">
                    + BH 1-1: {formatCompact(bh11Fee)}
                </button>
            {/if}
            {#if bhmrFee > 0}
                <button on:click={() => includeBhmr = !includeBhmr} class="border text-[10px] font-bold px-2 py-1 rounded-md shadow-sm transition-all active:scale-95 {includeBhmr ? 'bg-pink-50 border-pink-200 text-pink-700' : 'bg-slate-100 border-slate-200 text-slate-400 line-through opacity-70'}">
                    + BHMR: {formatCompact(bhmrFee)}
                </button>
            {/if}
            <button on:click={() => includeBhkvInPrepaid = !includeBhkvInPrepaid} class="border text-[10px] font-bold px-2 py-1 rounded-md shadow-sm transition-all active:scale-95 {includeBhkvInPrepaid ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-slate-100 border-slate-200 text-slate-400 line-through opacity-70'}">
                + BHKV ({bhkvRatePercent}%): {formatCompact(bhkvValue)}
            </button>
        </div>

        <div class="grid grid-cols-2 gap-2 mb-2">
            <div class="bg-teal-50 p-2 rounded-xl border border-teal-200 text-center shadow-sm relative overflow-hidden">
                <div class="absolute inset-0 bg-teal-400 opacity-10"></div>
                <div class="text-[9px] font-black text-teal-700 uppercase tracking-tight relative z-10">Tổng Trả Trước</div>
                <div class="text-base font-black text-teal-600 leading-none mt-1 relative z-10">{formatCompact(totalPrepaid)}</div>
            </div>
            <div class="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center shadow-sm flex flex-col justify-center">
                <div class="text-[9px] font-black text-slate-500 uppercase tracking-tight">Tổng Hóa Đơn</div>
                <div class="text-base font-black text-slate-800 leading-none mt-1">{formatCompact(finalTotalPrice)}</div>
            </div>
        </div>

        <div class="flex justify-between items-center text-[10px] pt-1.5 px-1 border-t border-slate-100">
            <span class="text-slate-500">Giá bán: <b class="text-slate-700">{formatCompact(productPrice)}</b></span>
            <span class="text-slate-500">Tổng góp: <b class="text-indigo-700">{formatCompact(finalTotalPrice)}</b></span>
            <span class="text-orange-600 font-bold">Lệch: +{formatCompact(diffPrice)}</span>
        </div>
        
    </div>
</div>

<style>
    .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>