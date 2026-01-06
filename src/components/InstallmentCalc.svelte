<script>
    // Component: Tính Trả Góp (File 2 - Integrated History v2.0)
    import { onMount } from 'svelte'; // [ADDED] Cần cho LocalStorage

    // --- STATE ---
    let productPrice = 0;
    // Giá bán (dùng để tính trả trước)
    let originalBasePrice = 0;
    // Giá gốc (dùng để tính BH 1-1)

    // Trả trước
    let downPaymentType = 'percent';
    let downPaymentPercent = 0; 
    let downPaymentAmount = 0;
    
    // Cấu hình
    let interestPackage = 0;
    let termMonths = 6;
    
    // Bảo hiểm 1-1
    let selectedBh11Group = 'none';

    // --- [NEW] STATE HISTORY & TABS ---
    let activeTab = 'calc'; 
    let history = [];

    // --- [NEW] LOGIC HISTORY (From File Mau) ---
    onMount(() => {
        // NẠP LỊCH SỬ TỪ TRÌNH DUYỆT (LocalStorage)
        const savedHistory = localStorage.getItem('installment_history_v2'); // Đổi key một chút để không đụng file cũ nếu chạy chung domain
        if (savedHistory) {
            try {
                history = JSON.parse(savedHistory);
            } catch (e) {
                console.error('Lỗi đọc lịch sử cũ', e);
            }
        }
    });

    // TỰ ĐỘNG LƯU VÀO TRÌNH DUYỆT
    $: {
        if (history) {
            localStorage.setItem('installment_history_v2', JSON.stringify(history));
        }
    }

    // --- FORMATTER ---
    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return '0';
        return Math.round(val).toLocaleString('vi-VN');
    };

    const parseNumber = (str) => {
        return Number(String(str).replace(/[^0-9]/g, '')) ||
        0;
    };

    // --- LOGIC NHẬP LIỆU GIÁ BÁN ---
    let displayPrice = "";
    function handlePriceInput(e) {
        const raw = parseNumber(e.target.value);
        productPrice = raw;
        displayPrice = formatCurrency(raw);
        recalcDownPayment();
    }

    // --- LOGIC NHẬP LIỆU GIÁ GỐC (CHO BH 1-1) ---
    let displayBasePrice = "";
    function handleBasePriceInput(e) {
        const raw = parseNumber(e.target.value);
        originalBasePrice = raw;
        displayBasePrice = formatCurrency(raw);
    }

    // --- LOGIC TRẢ TRƯỚC ---
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

    // --- LOGIC TÍNH TOÁN (Giữ nguyên của File 2) ---

    // 1. Phí BH 1-1 (Dựa trên GIÁ GỐC - originalBasePrice)
    $: bh11Fee = (() => {
        const p = originalBasePrice; // Dùng giá gốc để tính phí
        if (selectedBh11Group === 'none' || p === 0) return 0;

        // --- NHÓM CŨ (Theo mức giá cố định) ---
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

        // --- NHÓM MỚI (Theo % + Min 200k) ---
        // Smartphone: 4.62%
        if (selectedBh11Group === 'smartphone') {
            const fee = p * 0.0462;
            return fee < 200000 ? 200000 : fee;
        }
        // Laptop - Tablet: 6.0%
        if (selectedBh11Group === 'laptop_tablet') {
            const fee = p * 0.06;
            return fee < 200000 ? 200000 : fee;
        }
        // Smart Watch: 5.5%
        if (selectedBh11Group === 'smart_watch') {
            const fee = p * 0.055;
            return fee < 200000 ? 200000 : fee;
        }
        // Điện tử (Tivi): 7.0% (Không áp Min 200k theo đề bài, hoặc áp dụng nếu cần)
        if (selectedBh11Group === 'tv') {
            return p * 0.07;
        }

        return 0;
    })();

    // 2. Tính toán trả góp
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
    // Tổng tiền phải đưa trước (Gồm BH 1-1)
    $: totalPrepaid = downPaymentAmount + bhkvValue + bh11Fee;
    $: diffPrice = finalTotalPrice - productPrice;

    // --- [NEW] LOGIC HISTORY ACTIONS ---
    function saveToHistory() {
        if (productPrice === 0) return;
        const newItem = {
            id: Date.now(),
            timestamp: new Date().toLocaleString('vi-VN', { hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'}),
            price: productPrice,
            prepaid: totalPrepaid,
            monthly: monthlyPayment,
            term: termMonths,
            diff: diffPrice,
            selected: false 
        };
        history = [newItem, ...history].slice(0, 10);
    }

    function deleteHistoryItem(id) {
        history = history.filter(item => item.id !== id);
    }

    function clearHistory() {
        if(confirm('Xóa toàn bộ lịch sử?')) {
            history = [];
        }
    }

    function clearSelection() {
        history = history.map(item => ({...item, selected: false}));
    }

    $: selectedItems = history.filter(h => h.selected);
    $: comboTotalProductPrice = selectedItems.reduce((sum, item) => sum + item.price, 0);
    $: comboTotalPrepaid = selectedItems.reduce((sum, item) => sum + item.prepaid, 0);
    $: comboTotalMonthly = selectedItems.reduce((sum, item) => sum + item.monthly, 0);

</script>

<div class="h-full flex flex-col bg-slate-50 relative pb-64 overflow-y-auto">
    
    <div class="bg-white px-2 pt-1 pb-0 z-10 flex gap-2 border-b border-slate-200 sticky top-0">
        <button 
            class="flex-1 pb-2 text-sm font-bold uppercase transition-all border-b-2 {activeTab === 'calc' ?
            'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}"
            on:click={() => activeTab = 'calc'}
        >
            Tính Toán
        </button>
        <button 
            class="flex-1 pb-2 text-sm font-bold uppercase transition-all border-b-2 {activeTab === 'history' ?
            'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}"
            on:click={() => activeTab = 'history'}
        >
            Lịch Sử <span class="ml-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-500">{history.length}</span>
        </button>
    </div>

    {#if activeTab === 'calc'}
    <div class="p-2 space-y-2 animate-fadeIn">
        
        <div class="flex gap-2">
            <div class="bg-white p-2.5 rounded-lg shadow-sm border border-slate-200 flex-[2]">
                <label class="text-[9px] font-bold text-slate-400 uppercase mb-0.5 block">Giá Bán (Để tính vay)</label>
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
                        class="px-2 py-0.5 rounded text-[9px] font-bold transition-all {downPaymentType==='percent' ?
                        'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}"
                        on:click={()=>setDownType('percent')}
                    >%</button>
                    <button 
                        class="px-2 py-0.5 rounded text-[9px] font-bold transition-all {downPaymentType==='amount' 
                        ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}"
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
                            class="w-full text-lg font-bold text-indigo-600 outline-none border-b-2 border-indigo-100 focus:border-indigo-500 py-0 
                            bg-transparent"
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
                    <option value="smartphone">Smartphone (4.62%)</option>
                    <option value="laptop_tablet">Laptop - Tablet (6.0%)</option>
                    <option value="smart_watch">Smart Watch (5.5%)</option>
                    <option value="tv">Điện tử - Tivi (7.0%)</option>
                </select>
                {#if bh11Fee > 0}
                    <div class="text-[10px] text-right font-bold text-indigo-600 mt-1">+{formatCurrency(bh11Fee)}đ</div>
                {/if}
            </div>
        </div>

        {#if selectedBh11Group !== 'none'}
            <div class="bg-indigo-50/50 p-2.5 rounded-lg shadow-sm border border-indigo-100 animate-slideUp">
                <label class="text-[9px] font-bold text-indigo-500 uppercase mb-0.5 block flex items-center gap-1">
                    <span class="material-icons-round text-[10px]">price_check</span> Nhập Giá Máy Gốc (Để tính phí BH)
                </label>
                
                <div class="relative">
                    <input 
                        type="text" 
                        inputmode="numeric"
                        value={displayBasePrice} 
                        on:input={handleBasePriceInput}
                        class="w-full text-lg font-black text-indigo-700 outline-none border-b border-indigo-200 focus:border-indigo-500 py-0 bg-transparent placeholder-indigo-300"
                        placeholder="Nhập giá gốc..."
                    >
                    <span class="absolute right-0 bottom-1 text-[10px] font-bold text-indigo-400">VNĐ</span>
                </div>
            </div>
        {/if}

    </div>
    {/if}

    {#if activeTab === 'history'}
        <div class="p-2 space-y-2 animate-fadeIn pb-24">
            {#if history.length === 0}
                <div class="text-center py-10 opacity-40">
                    <span class="material-icons-round text-4xl mb-2 text-slate-300">history</span>
                    <p class="text-xs font-bold text-slate-400">Chưa có lịch sử tính toán</p>
                </div>
            {:else}
                <div class="flex justify-between items-center px-1 mb-2">
                    <span class="text-[10px] font-bold text-slate-400 uppercase">Chọn để tính Combo</span>
                    <button on:click={clearHistory} class="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase">Xóa hết</button>
                </div>
                {#each history as item (item.id)}
                    <label class="bg-white p-3 rounded-lg shadow-sm border {item.selected ?
                    'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'} relative group animate-slideIn flex gap-3 cursor-pointer select-none transition-all">
                        
                        <div class="flex items-center justify-center">
                            <input 
                                type="checkbox" 
                                bind:checked={item.selected}
                                class="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                            >
                        </div>

                        <div class="flex-1">
                            <button 
                                class="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1 z-10"
                                on:click|preventDefault|stopPropagation={() => deleteHistoryItem(item.id)}
                            >
                                <span class="material-icons-round text-base">close</span>
                            </button>
                            
                            <div class="flex items-center gap-2 mb-2 pr-6">
                                <span class="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{item.timestamp}</span>
                                <span class="text-[10px] font-bold text-slate-500">Giá bán:</span>
                                <span class="text-xs font-black text-indigo-700">{formatCurrency(item.price)} đ</span>
                            </div>

                            <div class="grid grid-cols-3 gap-2 text-center bg-slate-50 rounded p-2 border border-slate-100">
                                <div>
                                    <div class="text-[8px] font-bold text-slate-400 uppercase">Trả Trước</div>
                                    <div class="text-[10px] font-bold text-slate-700">{formatCurrency(item.prepaid)}</div>
                                </div>
                                <div>
                                    <div class="text-[8px] font-bold text-slate-400 uppercase">Góp/Tháng</div>
                                    <div class="text-[10px] font-bold text-indigo-600">{formatCurrency(item.monthly)}</div>
                                </div>
                                <div>
                                    <div class="text-[8px] font-bold text-slate-400 uppercase">Kỳ Hạn</div>
                                    <div class="text-[10px] font-bold text-slate-700">{item.term} Th</div>
                                </div>
                            </div>
                        </div>
                    </label>
                {/each}
            {/if}
        </div>
    {/if}

    <div class="h-6"></div>

    {#if activeTab === 'calc'}
    <div class="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-[60] rounded-t-xl animate-slideUp pb-6">
        <div class="p-3 max-w-md mx-auto">
            
            <div class="flex justify-between items-end mb-2">
                <div>
                    <div class="text-[9px] font-bold text-slate-400 uppercase">Góp mỗi tháng (Đã +12k phí thu hộ)</div>
                    <div class="text-3xl font-black text-indigo-600 tracking-tighter leading-none">
                        {formatCurrency(Math.round(monthlyPayment))} <small class="text-sm text-slate-500 font-bold">đ</small>
                    </div>
                </div>
                <button 
                    on:click={saveToHistory}
                    class="bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-600 p-2 rounded-lg flex flex-col items-center justify-center transition-all border border-indigo-100"
                    title="Lưu vào lịch sử"
                >
                    <span class="material-icons-round text-xl">save</span>
                    <span class="text-[8px] font-bold uppercase mt-0.5">Lưu</span>
                </button>
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
                    <span class="text-slate-500">Giá bán: <b class="text-slate-700">{formatCurrency(productPrice)}</b></span>
                    <span class="text-slate-500">Tổng góp: <b class="text-indigo-700">{formatCurrency(Math.round(finalTotalPrice))}</b></span>
                    <span class="text-orange-600 font-bold">Lệch: +{formatCurrency(Math.round(diffPrice))}</span>
                </div>
            </div>

            <div class="text-center mt-2 opacity-30">
                <span class="text-[8px] font-mono font-bold text-slate-500">Design by 3031</span>
            </div>

        </div>
    </div>
    {/if}

    {#if activeTab === 'history' && selectedItems.length > 0}
    <div class="fixed bottom-0 left-0 w-full bg-white border-t border-indigo-200 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-[60] rounded-t-xl animate-slideUp pb-6 bg-indigo-50">
        <div class="p-3 max-w-md mx-auto">
            <div class="flex justify-between items-center mb-2">
                <span class="text-[10px] font-bold text-indigo-400 uppercase">Đang chọn: {selectedItems.length} đơn</span>
                <button 
                    on:click={clearSelection}
                    class="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase bg-white px-2 py-0.5 rounded shadow-sm border border-red-100"
                >
                    Bỏ chọn tất cả
                </button>
            </div>
            
            <div class="grid grid-cols-3 gap-2">
                <div class="bg-white p-2 rounded shadow-sm border border-indigo-100 text-center">
                    <div class="text-[8px] font-bold text-slate-400 uppercase">Tổng Giá Bán</div>
                    <div class="text-[13px] font-black text-slate-700">{formatCurrency(comboTotalProductPrice)}<small>đ</small></div>
                </div>
                <div class="bg-white p-2 rounded shadow-sm border border-indigo-100 text-center">
                    <div class="text-[8px] font-bold text-slate-400 uppercase">Tổng Trả Trước</div>
                    <div class="text-[13px] font-black text-teal-600">{formatCurrency(comboTotalPrepaid)}<small>đ</small></div>
                </div>
                <div class="bg-white p-2 rounded shadow-sm border border-indigo-100 text-center">
                    <div class="text-[8px] font-bold text-slate-400 uppercase">Tổng Góp/Th</div>
                    <div class="text-[13px] font-black text-indigo-600">{formatCurrency(comboTotalMonthly)}<small>đ</small></div>
                </div>
            </div>
        </div>
    </div>
    {/if}

</div>

<style>
    .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    
    /* [NEW] Thêm animation cho History */
    .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .animate-slideIn { animation: slideInLeft 0.3s ease-out; }
    @keyframes slideInLeft { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }

    input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
</style>