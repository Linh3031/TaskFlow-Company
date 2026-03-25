<script>
    import { onMount } from 'svelte';
    import { parseNumber, formatFull, calculateBH11, calculateBHMR } from '../lib/installmentUtils.js';
    import InstallmentHistory from './InstallmentCalcParts/InstallmentHistory.svelte';
    import InstallmentFooter from './InstallmentCalcParts/InstallmentFooter.svelte';

    // --- STATE ---
    let productPrice = 0;
    let originalBasePrice = 0;

    let downPaymentType = 'percent';
    let downPaymentPercent = 0; 
    let downPaymentAmount = 0;
    let termMonths = 6;
    
    let selectedBh11Group = 'none';
    let bhmrCategory = 'none';
    let bhmrYears = 1;
    let bhmrIsDMX = false;

    let activeTab = 'calc'; 
    let history = [];
    
    // Trạng thái Tắt/Mở Phí
    let includeBhkvInPrepaid = true;
    let includeBh11 = true;
    let includeBhmr = true;

    onMount(() => {
        const savedHistory = localStorage.getItem('installment_history_v2'); 
        if (savedHistory) try { history = JSON.parse(savedHistory); } catch (e) {}
    });

    $: { if (history) localStorage.setItem('installment_history_v2', JSON.stringify(history)); }

    // --- LOGIC NHẬP LIỆU ---
    let displayPrice = "";
    function handlePriceInput(e) {
        const raw = parseNumber(e.target.value);
        productPrice = raw * 1000;
        displayPrice = raw > 0 ? raw.toLocaleString('vi-VN') : "";
        recalcDownPayment();
    }

    let displayBasePrice = "";
    function handleBasePriceInput(e) {
        const raw = parseNumber(e.target.value);
        originalBasePrice = raw * 1000;
        displayBasePrice = raw > 0 ? raw.toLocaleString('vi-VN') : "";
    }

   function handleDownPaymentPercentInput() {
        // [FIX] Nếu người dùng xóa trắng ô, để giá trị null/rỗng tự nhiên, không ép về 0
        if (downPaymentPercent === null || downPaymentPercent === "") {
            recalcDownPayment();
            return;
        }
        
        // Chặn nhập quá 100% hoặc nhỏ hơn 0%
        if (downPaymentPercent > 100) downPaymentPercent = 100;
        if (downPaymentPercent < 0) downPaymentPercent = 0;
        
        recalcDownPayment();
    }

    let displayDownPaymentAmount = "";
    function handleDownPaymentAmountInput(e) {
        const raw = parseNumber(e.target.value);
        downPaymentAmount = raw * 1000;
        if (downPaymentAmount > productPrice) downPaymentAmount = productPrice;
        displayDownPaymentAmount = raw > 0 ? raw.toLocaleString('vi-VN') : "";
        downPaymentPercent = productPrice > 0 ? (downPaymentAmount / productPrice) * 100 : 0;
    }

    function recalcDownPayment() {
        if (downPaymentType === 'percent') {
            const pct = downPaymentPercent || 0; // [FIX] Gán an toàn bằng 0 nếu ô đang trống để tính toán
            downPaymentAmount = (productPrice * pct) / 100;
            displayDownPaymentAmount = downPaymentAmount > 0 ? formatFull(Math.round(downPaymentAmount / 1000)) : "";
        } else {
            downPaymentPercent = productPrice > 0 ? (downPaymentAmount / productPrice) * 100 : 0;
        }
    }

    // --- LOGIC TÍNH TOÁN ---
    $: showOriginalPrice = selectedBh11Group !== 'none' || bhmrCategory !== 'none';
    $: if (!showOriginalPrice) { originalBasePrice = 0; displayBasePrice = ""; }
    $: if (!bhmrIsDMX && bhmrYears === 3) bhmrYears = 2; // Khóa 3 năm nếu ko phải ĐMX

    $: bh11Fee = calculateBH11(selectedBh11Group, originalBasePrice);
    $: bhmrFee = calculateBHMR(bhmrCategory, bhmrIsDMX, bhmrYears, originalBasePrice);
    
    $: loanAmount = Math.max(0, productPrice - downPaymentAmount);
    $: bhkvBase = (loanAmount > 0 && loanAmount <= 5000000) ? 5000000 : loanAmount;
    $: bhkvRatePercent = (() => { if (termMonths <= 6) return 2.6; if (termMonths <= 9) return 2.9; return 3.5; })();
    
    $: bhkvValue = loanAmount > 0 ? (bhkvBase * bhkvRatePercent / 100) : 0;
    $: monthlyBase = (loanAmount > 0 && termMonths > 0) ? (loanAmount / termMonths) : 0;
    $: monthlyPayment = monthlyBase + 12000; // Thu hộ
    
    $: totalInstallmentAmount = monthlyPayment * termMonths;
    
    // TỔNG TIỀN (Chỉ cộng vào Tổng nếu các công tắc được BẬT)
    $: finalTotalPrice = downPaymentAmount + (includeBhkvInPrepaid ? bhkvValue : 0) + (includeBh11 ? bh11Fee : 0) + (includeBhmr ? bhmrFee : 0) + totalInstallmentAmount;
    $: totalPrepaid = downPaymentAmount + (includeBhkvInPrepaid ? bhkvValue : 0) + (includeBh11 ? bh11Fee : 0) + (includeBhmr ? bhmrFee : 0);
    $: diffPrice = finalTotalPrice - productPrice;

    function saveToHistory() {
        if (productPrice === 0) return;
        history = [{ id: Date.now(), timestamp: new Date().toLocaleString('vi-VN', { hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'}), price: productPrice, prepaid: totalPrepaid, monthly: monthlyPayment, term: termMonths, diff: diffPrice, selected: false }, ...history].slice(0, 10);
    }
</script>

<div class="h-full flex flex-col bg-slate-50 relative pb-64 overflow-y-auto">
    <div class="bg-white px-2 pt-1 pb-0 z-10 flex gap-2 border-b border-slate-200 sticky top-0">
        <button class="flex-1 pb-2 text-sm font-bold uppercase transition-all border-b-2 {activeTab === 'calc' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}" on:click={() => activeTab = 'calc'}>Tính Toán</button>
        <button class="flex-1 pb-2 text-sm font-bold uppercase transition-all border-b-2 {activeTab === 'history' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}" on:click={() => activeTab = 'history'}>
            Lịch Sử <span class="ml-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-500">{history.length}</span>
        </button>
    </div>

    {#if activeTab === 'calc'}
    <div class="p-2 space-y-2 animate-fadeIn">
        
        <div class="bg-white p-2.5 rounded-lg shadow-sm border border-slate-200">
            <label class="text-[9px] font-bold text-slate-400 uppercase mb-0.5 block">Giá Bán Thực Tế</label>
            <input type="text" inputmode="numeric" value={displayPrice} on:input={handlePriceInput} class="w-full text-xl font-black text-indigo-700 outline-none border-b border-slate-200 focus:border-indigo-500 py-0.5 bg-transparent placeholder-slate-300" placeholder="VD: 25000">
            {#if productPrice > 0}<div class="text-[10px] text-indigo-500 font-bold mt-1 tracking-tight">Thực tế: {formatFull(productPrice)} VNĐ</div>{/if}
        </div>

        <div class="flex gap-2">
            <div class="flex-[6] bg-white p-2.5 rounded-lg shadow-sm border border-slate-200">
                <div class="flex justify-between items-center mb-1">
                    <label class="text-[9px] font-bold text-slate-400 uppercase">Trả Trước</label>
                    <div class="flex bg-slate-100 rounded p-0.5 border border-slate-200">
                        <button class="px-2 py-0.5 rounded text-[9px] font-bold transition-all {downPaymentType==='percent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}" on:click={()=>{downPaymentType='percent'; recalcDownPayment();}}>%</button>
                        <button class="px-2 py-0.5 rounded text-[9px] font-bold transition-all {downPaymentType==='amount' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}" on:click={()=>{downPaymentType='amount'; recalcDownPayment();}}>VNĐ</button>
                    </div>
                </div>

                {#if downPaymentType === 'percent'}
                    <div class="flex items-center gap-2">
                        <input type="number" bind:value={downPaymentPercent} on:input={handleDownPaymentPercentInput} on:focus={(e) => e.target.select()} class="w-12 text-lg font-bold text-indigo-600 outline-none border-b-2 border-indigo-100 focus:border-indigo-500 py-0.5 text-center bg-transparent shrink-0">
                        <div class="text-[10px] font-bold text-slate-500 line-clamp-1">{formatFull(downPaymentAmount)} đ</div>
                    </div>
                {:else}
                    <input type="text" inputmode="numeric" value={displayDownPaymentAmount} on:input={handleDownPaymentAmountInput} class="w-full text-lg font-bold text-indigo-600 outline-none border-b-2 border-indigo-100 focus:border-indigo-500 py-0.5 bg-transparent" placeholder="0">
                    {#if downPaymentAmount > 0}
                        <div class="text-[10px] text-indigo-500 font-bold mt-1 tracking-tight">Thực tế: {formatFull(downPaymentAmount)} VNĐ</div>
                    {/if}
                {/if}
            </div>

            <div class="flex-[4] bg-white p-2.5 rounded-lg shadow-sm border border-slate-200 flex flex-col justify-between">
                <label class="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Kỳ Hạn</label>
                <div class="flex items-center justify-between border-b-2 border-slate-100 pb-0.5">
                    <button class="w-6 h-6 rounded bg-slate-100 text-indigo-600 font-bold active:scale-90 flex items-center justify-center" on:click={()=>termMonths = Math.max(1, termMonths-1)}>-</button>
                    <div class="flex-1 relative text-center">
                        <input type="number" bind:value={termMonths} min="1" class="w-full text-lg font-black text-slate-700 outline-none border-none bg-transparent text-center p-0 m-0">
                        <span class="text-[9px] text-slate-400 font-normal block -mt-1">Tháng</span>
                    </div>
                    <button class="w-6 h-6 rounded bg-slate-100 text-indigo-600 font-bold active:scale-90 flex items-center justify-center" on:click={()=>termMonths++}>+</button>
                </div>
            </div>
        </div>

        <div class="bg-indigo-50/30 p-2.5 rounded-lg shadow-sm border border-indigo-100 space-y-2">
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold text-slate-600 w-16 shrink-0 uppercase">BH 1 Đổi 1</span>
                <select bind:value={selectedBh11Group} class="flex-1 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded p-1.5 outline-none focus:border-indigo-400">
                    <option value="none">Không mua</option>
                    <option value="smartphone">Smartphone (4.62%)</option>
                    <option value="laptop_tablet">Laptop - Tablet (6.0%)</option>
                    <option value="smart_watch">Smart Watch (5.5%)</option>
                    <option value="tv">Điện tử - Tivi (7.0%)</option>
                    <option value="air_conditioner">Máy Lạnh</option>
                    <option value="fridge">Tủ lạnh, Máy giặt</option>
                </select>
            </div>

            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold text-slate-600 w-16 shrink-0 uppercase">BHMR</span>
                <select bind:value={bhmrCategory} class="flex-1 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded p-1.5 outline-none focus:border-indigo-400">
                    <option value="none">Không mua</option>
                    <option value="apple">Sản phẩm Apple</option>
                    <option value="phone">Smartphone khác</option>
                    <option value="laptop">Laptop / PC</option>
                    <option value="tablet">Tablet / Đồng hồ</option>
                    <option value="tivi">Tivi / Loa</option>
                    <option value="fridge">Tủ lạnh / Tủ đông</option>
                    <option value="ac">Máy lạnh</option>
                    <option value="washer">Máy giặt</option>
                </select>
            </div>

            {#if bhmrCategory !== 'none'}
                <div class="flex items-center justify-end animate-fadeIn gap-2 pt-1 border-t border-indigo-100/50">
                    <select bind:value={bhmrYears} class="bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold rounded p-1 outline-none">
                        <option value={1}>1 Năm</option>
                        <option value={2}>2 Năm</option>
                        {#if bhmrIsDMX}<option value={3}>3 Năm</option>{/if}
                    </select>
                    <label class="flex items-center gap-1 cursor-pointer bg-white border border-slate-200 p-1 rounded shadow-sm hover:bg-slate-50 transition-colors">
                        <input type="checkbox" bind:checked={bhmrIsDMX} class="w-3 h-3 accent-indigo-600">
                        <span class="text-[9px] font-bold text-slate-700 uppercase">Gói ĐMX</span>
                    </label>
                </div>
            {/if}

            {#if showOriginalPrice}
                <div class="pt-2 animate-fadeIn border-t border-indigo-200 border-dashed mt-2">
                    <label class="text-[9px] font-bold text-indigo-600 uppercase mb-0.5 flex items-center gap-1">
                        <span class="material-icons-round text-[11px] text-orange-500">sell</span> Giá Gốc Thiết Bị (Để tính phí)
                    </label>
                    <input type="text" inputmode="numeric" value={displayBasePrice} on:input={handleBasePriceInput} class="w-full pl-2 pr-2 py-1.5 text-base font-black text-indigo-700 outline-none border border-indigo-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-100 placeholder-indigo-300" placeholder="VD: 32000">
                    {#if originalBasePrice > 0}
                        <div class="text-[10px] text-indigo-500 font-bold mt-1 tracking-tight">Thực tế: {formatFull(originalBasePrice)} VNĐ</div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
    
    <InstallmentFooter {monthlyPayment} bind:includeBhkvInPrepaid bind:includeBh11 bind:includeBhmr {bhkvRatePercent} {bhkvValue} {bh11Fee} {bhmrFee} {totalPrepaid} {finalTotalPrice} {productPrice} {diffPrice} on:save={saveToHistory} />
    
    {:else}
        <InstallmentHistory {history} />
    {/if}
</div>

<style>
    .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
</style>