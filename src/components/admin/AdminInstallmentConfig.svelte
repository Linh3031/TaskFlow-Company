<script>
    import { onMount } from 'svelte';
    import { db } from '../../lib/firebase';
    import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

    // Link mặc định bạn đã cung cấp
    let csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSIK5yVCxalw06QQaEZQ4lNp-b6wjPYJ4XgSSXB8XU91BpQk5R6cIi1XnluRVgVO4Gb21cCIxLT1u25/pub?output=csv';
    let isProcessing = false;
    let rawData = [];
    let groupedData = {};
    let statusMsg = { text: '', type: '' }; // type: 'error', 'success', 'info'

    // [NEW] Tự động tải dữ liệu cũ khi mở trang
    onMount(async () => {
        isProcessing = true;
        try {
            const docSnap = await getDoc(doc(db, 'system_configs', 'insurance_rates'));
            if (docSnap.exists()) {
                rawData = docSnap.data().data || [];
                groupData(rawData);
            }
        } catch (e) {
            console.error("Lỗi tải dữ liệu cũ:", e);
        } finally {
            isProcessing = false;
        }
    });

    function groupData(data) {
        const groups = {};
        data.forEach(item => {
            if (!groups[item.LoaiBaoHiem]) groups[item.LoaiBaoHiem] = [];
            groups[item.LoaiBaoHiem].push(item);
        });
        groupedData = groups;
    }

    async function fetchAndParseCSV() {
        if (!csvUrl.includes('pub?output=csv')) {
            statusMsg = { text: 'Link không đúng định dạng CSV từ Google Sheet!', type: 'error' };
            return;
        }

        isProcessing = true;
        statusMsg = { text: 'Đang tải dữ liệu từ Google...', type: 'info' };
        
        try {
            const response = await fetch(csvUrl);
            const text = await response.text();
            
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length < 2) throw new Error("File CSV trống hoặc không có dữ liệu.");

            const parsedData = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length >= 9) {
                    parsedData.push({
                        LoaiBaoHiem: cols[0].trim(),
                        NhomHang: cols[1].trim(),
                        GiaTu: Number(cols[2]) || 0,
                        GiaDen: Number(cols[3]) || 0,
                        GiaGoi1: Number(cols[4]) || 0,
                        GiaGoi2: Number(cols[5]) || 0,
                        GiaGoi3: Number(cols[6]) || 0,
                        DonVi: cols[7].trim(),
                        PhiMin: cols[8].trim()
                    });
                }
            }

            if (parsedData.length > 0) {
                // 1. Lưu lên Firebase
                await setDoc(doc(db, 'system_configs', 'insurance_rates'), {
                    data: parsedData,
                    updatedAt: serverTimestamp(),
                    source: csvUrl
                });

                // 2. [NEW] PHÁ CACHE: Ép các máy khách tải lại dữ liệu mới ngay lập tức
                localStorage.removeItem('insurance_rates_time');

                rawData = parsedData;
                groupData(parsedData);
                statusMsg = { text: `✅ Đồng bộ thành công ${parsedData.length} dòng dữ liệu!`, type: 'success' };
            }
        } catch (e) {
            statusMsg = { text: 'Lỗi: ' + e.message, type: 'error' };
        } finally {
            isProcessing = false;
        }
    }

    function formatMoney(val) {
        if (val >= 1000000) return (val / 1000000) + 'tr';
        if (val >= 1000) return (val / 1000) + 'k';
        return val;
    }
</script>

<div class="max-w-4xl mx-auto p-4 space-y-6">
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 class="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
            <span class="material-icons-round text-purple-600">sync_alt</span>
            Đồng bộ bảng phí bảo hiểm
        </h3>

        <div class="space-y-4">
            <div>
                <label class="text-[10px] font-black text-slate-400 uppercase block mb-1">Link CSV Google Sheet</label>
                <div class="flex gap-2">
                    <input type="text" bind:value={csvUrl} placeholder="Dán link CSV tại đây..." 
                        class="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-indigo-700 outline-none focus:border-indigo-500 focus:bg-white transition-all">
                    <button on:click={fetchAndParseCSV} disabled={isProcessing}
                        class="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
                        {isProcessing ? 'ĐANG XỬ LÝ...' : 'ĐỒNG BỘ NGAY'}
                    </button>
                </div>
            </div>

            {#if statusMsg.text}
                <div class="p-3 rounded-lg text-xs font-bold animate-fadeIn {statusMsg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : (statusMsg.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-blue-50 text-blue-600 border border-blue-100')}">
                    {statusMsg.text}
                </div>
            {/if}
        </div>
    </div>

    {#if Object.keys(groupedData).length > 0}
        <div class="space-y-4">
            <h4 class="text-sm font-black text-slate-500 uppercase tracking-widest px-2">Dữ liệu đang áp dụng</h4>
            <div class="grid gap-6">
                {#each Object.entries(groupedData) as [groupName, items]}
                    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div class="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                            <span class="font-black text-slate-700 uppercase text-xs">{groupName}</span>
                            <span class="bg-white px-2 py-0.5 rounded-full text-[10px] font-black text-slate-400 border border-slate-200">{items.length} gói</span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr class="text-slate-400 font-black uppercase text-[10px]">
                                        <th class="p-2">Nhóm Hàng</th>
                                        <th class="p-2">Khoảng Giá</th>
                                        <th class="p-2">Gói 1</th>
                                        <th class="p-2">Gói 2</th>
                                        <th class="p-2">Gói 3</th>
                                        <th class="p-2 text-center">ĐV</th>
                                        <th class="p-2">Min Fee</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each items as item}
                                        <tr class="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td class="p-2 font-bold text-purple-700">{item.NhomHang}</td>
                                            <td class="p-2 text-slate-600">
                                                {formatMoney(item.GiaTu)} <span class="text-slate-400">➔</span> 
                                                {item.GiaDen >= 999999999 ? 'MAX' : formatMoney(item.GiaDen)}
                                            </td>
                                            <td class="p-2 font-bold text-slate-800">{formatMoney(item.GiaGoi1)}</td>
                                            <td class="p-2 font-bold text-slate-800">{formatMoney(item.GiaGoi2)}</td>
                                            <td class="p-2 font-bold text-slate-800">{formatMoney(item.GiaGoi3)}</td>
                                            <td class="p-2 text-center font-bold {item.DonVi === '%' ? 'text-orange-500' : 'text-slate-500'}">{item.DonVi}</td>
                                            <td class="p-2 text-red-500 font-mono text-[10px]">{item.PhiMin}</td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>