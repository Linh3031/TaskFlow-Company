<script>
    // Component: Tính Trả Góp (Compact Dashboard + Tách nhóm BH)
    
    // --- STATE ---
    let productPrice = 0;
    
    // Trả trước
    let downPaymentType = 'percent'; 
    let downPaymentPercent = 0; 
    let downPaymentAmount = 0;

    // Cấu hình
    let interestPackage = 0; 
    let termMonths = 6; 

    // Bảo hiểm 1-1 (Tách riêng nhóm theo yêu cầu)
    // 'none' | 'air_conditioner' | 'fridge' | 'washer' | 'water_purifier'
    let selectedBh11Group = 'none'; 

    // --- FORMATTER ---
    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return '0';
        return Math.round(val).toLocaleString('vi-VN');
    };

    const parseNumber = (str) => {
        return Number(String(str).replace(/[^0-9]/g, '')) || 0;
    };

    // --- LOGIC NHẬP LIỆU ---
    
    let displayPrice = "";
    function handlePriceInput(e) {
        const raw = parseNumber(e.target.value);
        productPrice = raw;
        displayPrice = formatCurrency(raw);
        recalcDownPayment();
    }

    function handleDownPaymentPercentInput(e) {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) val = 0;
        if (val > 100) val = 100;
        if (val < 0) val = 0;
        downPaymentPercent = val;
        recalcDownPayment();
    }

    let displayDownPaymentAmount = "";
    function handleDownPaymentAmountInput(e) {
        const raw = parseNumber(e.target.value);
        downPaymentAmount = raw;
        if (downPaymentAmount > productPrice) downPaymentAmount = productPrice;
        displayDownPaymentAmount = formatCurrency(downPaymentAmount);
        
        if (productPrice > 0) {
            downPaymentPercent = (downPaymentAmount / productPrice) * 100;
        } else {
            downPaymentPercent = 0;
        }
    }

    function recalcDownPayment() {
        if (downPaymentType === 'percent') {
            downPaymentAmount = (productPrice * downPaymentPercent) / 100;
            displayDownPaymentAmount = formatCurrency(downPaymentAmount);
        } else {
             if (productPrice > 0) {
                downPaymentPercent = (downPaymentAmount / productPrice) * 100;
             }
        }
    }

    function setDownType(type) {
        downPaymentType = type;
        recalcDownPayment();
    }

    // --- LOGIC TÍNH TOÁN ---

    // 1. Phí BH 1-1 (Tách logic riêng từng nhóm)
    $: bh11Fee = (() => {
        const p = productPrice;
        if (selectedBh11Group === 'none' || p === 0) return 0;

        // Nhóm 1: Máy Lạnh
        if (selectedBh11Group === 'air_conditioner') {
            return p <= 10000000 ? 250000 : 350000;
        }
        
        // Nhóm 2: Tủ lạnh, đông, mát
        if (selectedBh11Group === 'fridge') {
            if (p <= 10000000) return 400000;
            if (p <= 25000000) return 700000;
            return 1350000;
        }

        // Nhóm 3: Máy giặt, sấy
        if (selectedBh11Group === 'washer') {
            // Hiện tại giá giống nhóm Tủ lạnh, nhưng tách code để future-proof
            if (p <= 10000000) return 400000;
            if (p <= 25000000) return 700000;
            return 1350000;
        }

        // Nhóm 4: Máy lọc nước
        if (selectedBh11Group === 'water_purifier') {
            if (p <= 8000000) return 280000;
            if (p <= 11000000) return 380000;
            return 460000;
        }
        return 0;
    })();

    // 2. Tính toán
    $: loanAmount = Math.max(0, productPrice - downPaymentAmount);
    $: bhkvBase = (loanAmount > 0 && loanAmount <= 5000000) ? 5000000 : loanAmount;

    $: bhkvRatePercent = (() => {
        if (termMonths <= 6) return 2.6;
        if (termMonths <= 9) return 2.9;
        return 3.5;
    })();

    $: bhkvValue = loanAmount > 0 ? (bhkvBase * bhkvRatePercent / 100) : 0;
    
    $: monthlyBase = (loanAmount > 0 && termMonths > 0) ? (loanAmount / termMonths) : 0;
    $: monthlyFee = 12000;
    $: monthlyPayment = monthlyBase + monthlyFee;

    $: totalInstallmentAmount = monthlyPayment * termMonths;
    $: finalTotalPrice = downPaymentAmount + bhkvValue + bh11Fee + totalInstallmentAmount;
    
    // Tổng tiền phải đưa trước
    $: totalPrepaid = downPaymentAmount + bhkvValue + bh11Fee;

    $: diffPrice = finalTotalPrice - productPrice;

</script>

<div class="h-full flex flex-col bg-slate-50 relative pb-64 overflow-y-auto">
    
    <div class="p-2 space-y-2">
        
        <div class="flex gap-2">
            <div class="bg-white p-2.5 rounded-lg shadow-sm border border-slate-200 flex-[2]">
                <label class="text-[9px] font-bold text-slate-400 uppercase mb-0.5 block">Giá Sản Phẩm</label>
                <div class="relative">
                    <input 
                        type="text" 
                        inputmode="numeric"
                        value={displayPrice} 
                        on:input={handlePriceInput}
                        class="w-full text-xl font-black text-indigo-700 outline-none border-b border-slate-200 focus:border-indigo-500 py-0 bg-transparent placeholder-slate-300"
                        placeholder="0"
                    >
                    <span class="absolute right-0 bottom-1 text-[10px] font-bold text-slate-400">VNĐ</span>
                </div>
            </div>

            <div class="bg-white p-2.5 rounded-lg shadow-sm border border-slate-200 flex-1 min-w-[80px] opacity-70">
                <label class="text-[9px] font-bold text-slate-400 uppercase mb-0.5 block">Lãi Suất</label>
                <div class="relative">
                    <input 
                        type="number" 
                        bind:value={interestPackage}
                        class="w-full text-xl font-bold text-slate-700 outline-none border-b border-slate-200 py-0 bg-transparent text-center"
                        readonly
                    >
                    <span class="absolute right-0 bottom-1 text-[10px] font-bold text-slate-400">%</span>
                </div>
            </div>
        </div>

        <div class="bg-white p-2.5 rounded-lg shadow-sm border border-slate-200">
            <div class="flex justify-between items-center mb-1">
                <label class="text-[9px] font-bold text-slate-400 uppercase">Trả Trước (Gốc)</label>
                <div class="flex bg-slate-100 rounded p-0.5 border border-slate-200">
                    <button 
                        class="px-2 py-0.5 rounded text-[9px] font-bold transition-all {downPaymentType==='percent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}"
                        on:click={()=>setDownType('percent')}
                    >%</button>
                    <button 
                        class="px-2 py-0.5 rounded text-[9px] font-bold transition-all {downPaymentType==='amount' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}"
                        on:click={()=>setDownType('amount')}
                    >VNĐ</button>
                </div>
            </div>

            <div class="flex items-end gap-2">
                {#if downPaymentType === 'percent'}
                    <div class="w-16 relative shrink-0">
                        <input 
                            type="number" 
                            bind:value={downPaymentPercent}
                            on:input={handleDownPaymentPercentInput}
                            on:focus={(e) => e.target.select()} 
                            class="w-full text-lg font-bold text-indigo-600 outline-none border-b-2 border-indigo-100 focus:border-indigo-500 py-0 text-center bg-transparent"
                        >
                        <span class="absolute right-0 bottom-1 text-[9px] font-bold text-indigo-300">%</span>
                    </div>
                    <div class="flex-1 text-right pb-1 border-b border-slate-100">
                        <div class="text-[9px] font-bold text-slate-400">Thành tiền:</div>
                        <div class="text-sm font-black text-slate-700">{formatCurrency(downPaymentAmount)}</div>
                    </div>
                {:else}
                    <div class="flex-1 relative">
                        <input 
                            type="text" 
                            inputmode="numeric"
                            value={displayDownPaymentAmount}
                            on:input={handleDownPaymentAmountInput}
                            class="w-full text-lg font-bold text-indigo-600 outline-none border-b-2 border-indigo-100 focus:border-indigo-500 py-0 bg-transparent"
                            placeholder="0"
                        >
                        <span class="absolute right-0 bottom-1 text-[9px] font-bold text-indigo-300">VNĐ</span>
                    </div>
                {/if}
            </div>
            
            <div class="mt-1 flex justify-between items-center bg-orange-50 px-2 py-0.5 rounded">
                <span class="text-[9px] font-bold text-orange-400 uppercase">Cần Vay</span>
                <span class="text-xs font-black text-orange-600">{formatCurrency(loanAmount)}</span>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
            
            <div class="bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                <label class="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Kỳ Hạn</label>
                <div class="flex items-center gap-1">
                    <button class="w-8 h-8 rounded bg-slate-100 text-indigo-600 font-bold flex items-center justify-center active:scale-90" on:click={()=>termMonths = Math.max(1, termMonths-1)}>-</button>
                    <div class="flex-1 relative text-center">
                         <input 
                            type="number" 
                            bind:value={termMonths}
                            min="1"
                            class="w-full text-xl font-black text-slate-700 outline-none border-none bg-transparent text-center p-0 m-0"
                        >
                         <span class="text-[9px] text-slate-400 font-bold block -mt-1">Tháng</span>
                    </div>
                    <button class="w-8 h-8 rounded bg-slate-100 text-indigo-600 font-bold flex items-center justify-center active:scale-90" on:click={()=>termMonths++}>+</button>
                </div>
            </div>

            <div class="bg-white p-2 rounded-lg shadow-sm border border-slate-200 flex flex-col justify-between">
                <label class="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Bảo Hiểm 1-1</label>
                <select 
                    bind:value={selectedBh11Group}
                    class="w-full text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded py-1.5 px-1 outline-none focus:border-indigo-500"
                >
                    <option value="none">Không chọn</option>
                    <option value="air_conditioner">Máy Lạnh</option>
                    <option value="fridge">Tủ lạnh, Đông, Mát</option>
                    <option value="washer">Máy Giặt, Sấy</option>
                    <option value="water_purifier">Máy Lọc Nước</option>
                </select>
                {#if bh11Fee > 0}
                    <div class="text-[10px] text-right font-bold text-indigo-600 mt-1">+{formatCurrency(bh11Fee)}đ</div>
                {/if}
            </div>
        </div>

    </div>

    <div class="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-[60] rounded-t-xl animate-slideUp">
        <div class="p-3 max-w-md mx-auto">
            
            <div class="flex justify-between items-end mb-2">
                <div>
                    <div class="text-[9px] font-bold text-slate-400 uppercase">Góp mỗi tháng (Đã +12k phí thu hộ)</div>
                    <div class="text-3xl font-black text-indigo-600 tracking-tighter leading-none">
                        {formatCurrency(Math.round(monthlyPayment))} <small class="text-sm text-slate-500 font-bold">đ</small>
                    </div>
                </div>
            </div>

            <div class="flex gap-2 mb-2">
                <div class="flex-1 bg-slate-50 rounded p-1.5 border border-slate-100 text-center">
                    <div class="text-[8px] font-bold text-slate-400 uppercase">BHKV ({bhkvRatePercent}%)</div>
                    <div class="text-xs font-bold text-slate-700">{formatCurrency(Math.round(bhkvValue))}</div>
                </div>
                
                {#if bh11Fee > 0}
                    <div class="flex-1 bg-indigo-50 rounded p-1.5 border border-indigo-100 text-center">
                        <div class="text-[8px] font-bold text-indigo-400 uppercase">BH 1 Đổi 1</div>
                        <div class="text-xs font-bold text-indigo-700">{formatCurrency(bh11Fee)}</div>
                    </div>
                {/if}
            </div>

            <div class="space-y-1">
                <div class="flex justify-between items-center text-sm bg-teal-50 -mx-3 px-3 py-1.5 border-y border-teal-100">
                    <span class="text-teal-800 font-bold text-xs uppercase">Tổng Tiền Đưa Trước:</span>
                    <span class="font-black text-teal-700 text-base">{formatCurrency(Math.round(totalPrepaid))} đ</span>
                </div>
                
                <div class="flex justify-between items-center text-[10px] pt-1 px-1">
                    <span class="text-slate-500">Giá gốc: <b class="text-slate-700">{formatCurrency(productPrice)}</b></span>
                    <span class="text-slate-500">Tổng góp: <b class="text-indigo-700">{formatCurrency(Math.round(finalTotalPrice))}</b></span>
                    <span class="text-orange-600 font-bold">Lệch: +{formatCurrency(Math.round(diffPrice))}</span>
                </div>
            </div>

        </div>
    </div>

</div>

<style>
    .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
</style>