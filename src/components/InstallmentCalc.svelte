<script>
    // Component: Tính Trả Góp (Final Refined Version)
    
    // --- STATE ---
    let productPrice = 0;
    
    // Trả trước
    let downPaymentType = 'percent'; // 'percent' | 'amount'
    let downPaymentPercent = 0; // Mặc định 0% theo ý người dùng
    let downPaymentAmount = 0;

    // Gói lãi suất
    let interestPackage = 0; 

    // Thời hạn
    let termMonths = 6; 

    // --- FORMATTER ---
    const formatCurrency = (val) => {
        if (val === undefined || val === null || isNaN(val)) return '0';
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
        // Fix lỗi hiển thị 010: Ép kiểu số ngay lập tức
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
        
        // Tính ngược lại phần trăm
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
    $: finalTotalPrice = downPaymentAmount + bhkvValue + totalInstallmentAmount;
    
    // Tổng tiền trả trước = Tiền gốc trả trước + Bảo hiểm khoản vay
    $: totalPrepaid = downPaymentAmount + bhkvValue;

    $: diffPrice = finalTotalPrice - productPrice;

</script>

<div class="h-full flex flex-col bg-slate-50 relative pb-72 overflow-y-auto">
    
    <div class="p-3 space-y-3">
        
        <div class="flex gap-3">
            <div class="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex-[2]">
                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Giá Sản Phẩm</label>
                <div class="relative">
                    <input 
                        type="text" 
                        inputmode="numeric"
                        value={displayPrice} 
                        on:input={handlePriceInput}
                        class="w-full text-xl font-black text-indigo-700 outline-none border-b border-slate-200 focus:border-indigo-500 py-1 bg-transparent placeholder-slate-300"
                        placeholder="0"
                    >
                    <span class="absolute right-0 bottom-2 text-[10px] font-bold text-slate-400">VNĐ</span>
                </div>
            </div>

            <div class="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex-1 min-w-[90px] opacity-70">
                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Lãi Suất</label>
                <div class="relative">
                    <input 
                        type="number" 
                        bind:value={interestPackage}
                        class="w-full text-xl font-bold text-slate-700 outline-none border-b border-slate-200 py-1 bg-transparent text-center"
                        readonly
                    >
                    <span class="absolute right-1 bottom-2 text-[10px] font-bold text-slate-400">%</span>
                </div>
            </div>
        </div>

        <div class="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
            <div class="flex justify-between items-center mb-1">
                <label class="text-[10px] font-bold text-slate-400 uppercase">Trả Trước</label>
                <div class="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                    <button 
                        class="px-2 py-0.5 rounded text-[10px] font-bold transition-all {downPaymentType==='percent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}"
                        on:click={()=>setDownType('percent')}
                    >%</button>
                    <button 
                        class="px-2 py-0.5 rounded text-[10px] font-bold transition-all {downPaymentType==='amount' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}"
                        on:click={()=>setDownType('amount')}
                    >VNĐ</button>
                </div>
            </div>

            <div class="flex items-end gap-3">
                {#if downPaymentType === 'percent'}
                    <div class="w-20 relative shrink-0">
                        <input 
                            type="number" 
                            bind:value={downPaymentPercent}
                            on:input={handleDownPaymentPercentInput}
                            on:focus={(e) => e.target.select()} 
                            class="w-full text-xl font-bold text-indigo-600 outline-none border-b-2 border-indigo-100 focus:border-indigo-500 py-1 text-center bg-transparent"
                        >
                        <span class="absolute right-0 bottom-2 text-[10px] font-bold text-indigo-300">%</span>
                    </div>
                    <div class="flex-1 text-right pb-1 border-b border-slate-100">
                        <div class="text-[10px] font-bold text-slate-400">Thành tiền:</div>
                        <div class="text-base font-black text-slate-700">{formatCurrency(downPaymentAmount)}</div>
                    </div>
                {:else}
                    <div class="flex-1 relative">
                        <input 
                            type="text" 
                            inputmode="numeric"
                            value={displayDownPaymentAmount}
                            on:input={handleDownPaymentAmountInput}
                            class="w-full text-xl font-bold text-indigo-600 outline-none border-b-2 border-indigo-100 focus:border-indigo-500 py-1 bg-transparent"
                            placeholder="0"
                        >
                        <span class="absolute right-0 bottom-2 text-[10px] font-bold text-indigo-300">VNĐ</span>
                    </div>
                {/if}
            </div>
            
            <div class="mt-2 flex justify-between items-center bg-orange-50 px-2 py-1 rounded">
                <span class="text-[10px] font-bold text-orange-400 uppercase">Cần Vay</span>
                <span class="text-sm font-black text-orange-600">{formatCurrency(loanAmount)} đ</span>
            </div>
        </div>

        <div class="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
            <label class="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Thời Hạn Góp (Tháng)</label>
            <div class="flex items-center gap-2">
                <button class="w-10 h-10 rounded-lg bg-slate-100 hover:bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center transition-colors active:scale-95" on:click={()=>termMonths = Math.max(1, termMonths-1)}>-</button>
                <div class="flex-1 relative">
                    <input 
                        type="number" 
                        bind:value={termMonths}
                        min="1"
                        class="w-full text-2xl font-black text-slate-700 outline-none border-b border-slate-200 focus:border-indigo-500 py-1 text-center bg-transparent"
                    >
                    <span class="absolute right-4 bottom-2 text-[10px] font-bold text-slate-400">Tháng</span>
                </div>
                <button class="w-10 h-10 rounded-lg bg-slate-100 hover:bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center transition-colors active:scale-95" on:click={()=>termMonths++}>+</button>
            </div>
            
            <div class="mt-3 text-center">
                <span class="text-[10px] font-bold px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 inline-block">
                    BHKV áp dụng: {bhkvRatePercent}% {loanAmount <= 5000000 && loanAmount > 0 ? '(Mốc min 5tr)' : ''}
                </span>
            </div>
        </div>

    </div>

    <div class="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 shadow-[0_-4px_25px_rgba(0,0,0,0.15)] z-[60] rounded-t-2xl animate-slideUp">
        <div class="p-4 max-w-md mx-auto">
            
            <div class="flex justify-between items-end mb-3">
                <div>
                    <div class="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Góp mỗi tháng</div>
                    <div class="text-3xl font-black text-indigo-600 tracking-tighter leading-none">
                        {formatCurrency(Math.round(monthlyPayment))} <small class="text-sm text-slate-500 font-bold">đ</small>
                    </div>
                    <div class="text-[9px] text-slate-400 font-bold mt-1 bg-slate-100 inline-block px-1.5 py-0.5 rounded">+12k phí thu hộ</div>
                </div>
                
                <div class="text-right pl-3 border-l border-slate-100">
                    <div class="text-[10px] font-bold text-slate-400 uppercase">Phí Bảo Hiểm</div>
                    <div class="text-lg font-bold text-slate-700">{formatCurrency(Math.round(bhkvValue))}</div>
                    <div class="text-[9px] text-slate-400 font-mono">({formatCurrency(Math.round(bhkvBase))} x {bhkvRatePercent}%)</div>
                </div>
            </div>

            <div class="bg-slate-50 rounded-xl p-3 space-y-1.5 border border-slate-100">
                <div class="flex justify-between items-center text-xs">
                    <span class="text-slate-500 font-bold">Giá Niêm Yết:</span>
                    <span class="font-bold text-slate-700">{formatCurrency(productPrice)} đ</span>
                </div>
                
                <div class="flex justify-between items-center text-sm">
                    <span class="text-indigo-900 font-bold">Tổng Giá Mua Góp:</span>
                    <span class="font-black text-indigo-700">{formatCurrency(Math.round(finalTotalPrice))} đ</span>
                </div>

                <div class="flex justify-between items-center text-sm bg-teal-50 -mx-3 px-3 py-1 border-y border-teal-100/50">
                    <span class="text-teal-700 font-bold">Tiền Cần Đưa Trước:</span>
                    <span class="font-black text-teal-700">{formatCurrency(Math.round(totalPrepaid))} đ</span>
                </div>
                <div class="flex justify-between items-center text-xs pt-1">
                    <span class="text-orange-600 font-bold">Chênh Lệch:</span>
                    <span class="font-black text-orange-600">+{formatCurrency(Math.round(diffPrice))} đ</span>
                </div>
            </div>

        </div>
    </div>

</div>

<style>
    .animate-slideUp {
        animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
    }
    
    input[type=number]::-webkit-inner-spin-button, 
    input[type=number]::-webkit-outer-spin-button { 
        -webkit-appearance: none; 
        margin: 0; 
    }
</style>