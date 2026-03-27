<script>
    import { db } from '../../lib/firebase';
    import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

    let csvUrl = '';
    let isProcessing = false;
    let rawData = [];
    let groupedData = {};
    let statusMsg = { text: '', type: '' }; // type: 'error', 'success', 'info'

    // Hàm đọc và bóc tách CSV
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
            
            // Cắt dòng và loại bỏ dòng trống
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length < 2) throw new Error("File CSV trống hoặc không có dữ liệu.");

            const parsedData = [];
            // Bỏ dòng tiêu đề (i=0), bắt đầu đọc từ dòng số 1
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                // Đảm bảo có đủ 9 cột
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

            rawData = parsedData;
            groupDataForPreview(parsedData);
            statusMsg = { text: `Đã đọc thành công ${parsedData.length} cấu hình gói bảo hiểm! Hãy kiểm tra bảng bên dưới và bấm Lưu.`, type: 'success' };
            
        } catch (error) {
            console.error(error);
            statusMsg = { text: 'Lỗi khi đọc file. Vui lòng kiểm tra lại link.', type: 'error' };
        } finally {
            isProcessing = false;
        }
    }

    // Nhóm dữ liệu để hiển thị trực quan
    function groupDataForPreview(data) {
        const groups = {};
        data.forEach(item => {
            if (!groups[item.LoaiBaoHiem]) groups[item.LoaiBaoHiem] = [];
            groups[item.LoaiBaoHiem].push(item);
        });
        groupedData = groups;
    }

    // Lưu lên Firebase
    async function saveToFirebase() {
        if (rawData.length === 0) return;
        isProcessing = true;
        statusMsg = { text: 'Đang đồng bộ lên hệ thống...', type: 'info' };

        try {
            await setDoc(doc(db, 'system_configs', 'insurance_rates'), {
                data: rawData,
                updatedAt: serverTimestamp(),
                sourceUrl: csvUrl
            });
            statusMsg = { text: 'ĐÃ LƯU VÀ ĐỒNG BỘ THÀNH CÔNG CHO TOÀN BỘ DỰ ÁN!', type: 'success' };
            // Tự động clear sau 5s
            setTimeout(() => { statusMsg = { text: '', type: '' }; }, 5000);
        } catch (error) {
            console.error(error);
            statusMsg = { text: 'Lỗi khi lưu lên hệ thống Firebase.', type: 'error' };
        } finally {
            isProcessing = false;
        }
    }

    // Tiện ích format số tiền
    function formatMoney(val) {
        if (!val || val === 0) return '-';
        return val.toLocaleString('vi-VN');
    }
</script>

<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 animate-fadeIn">
    <div class="mb-4">
        <h2 class="text-lg font-black text-slate-800 flex items-center gap-2">
            <span class="material-icons-round text-purple-600">cloud_sync</span>
            Khai Báo Dữ Liệu Trả Góp / Bảo Hiểm
        </h2>
        <p class="text-xs text-slate-500 mt-1">Dán link Google Sheet định dạng CSV vào ô bên dưới. Chỉ Super Admin mới có quyền thực hiện thao tác này.</p>
    </div>

    <div class="flex flex-col md:flex-row gap-2 mb-4">
        <input 
            type="text" 
            bind:value={csvUrl} 
            placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv" 
            class="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            disabled={isProcessing}
        />
        <button 
            on:click={fetchAndParseCSV}
            disabled={isProcessing || !csvUrl}
            class="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors whitespace-nowrap">
            {isProcessing ? 'Đang xử lý...' : 'Đọc Dữ Liệu'}
        </button>
    </div>

    {#if statusMsg.text}
        <div class="p-3 mb-4 rounded-md text-sm font-bold {statusMsg.type === 'error' ? 'bg-red-50 text-red-600' : statusMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-600'}">
            {statusMsg.text}
        </div>
    {/if}

    {#if rawData.length > 0}
        <div class="border-t border-slate-200 pt-4 mt-2">
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold text-slate-700 text-sm uppercase">Bảng Kiểm Tra Trực Quan</h3>
                <button 
                    on:click={saveToFirebase}
                    disabled={isProcessing}
                    class="bg-green-600 hover:bg-green-700 text-white font-black py-2 px-6 rounded-md shadow flex items-center gap-2 transition-transform active:scale-95">
                    <span class="material-icons-round text-sm">save</span>
                    ÁP DỤNG & ĐỒNG BỘ
                </button>
            </div>

            <div class="space-y-6">
                {#each Object.entries(groupedData) as [loai, items]}
                    <div class="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                        <div class="bg-slate-200 px-3 py-2 font-black text-slate-700 text-sm flex items-center gap-2">
                            <span class="material-icons-round text-base text-slate-500">category</span>
                            LOẠI BẢO HIỂM: {loai}
                            <span class="bg-white px-2 py-0.5 rounded text-[10px] text-slate-500 font-bold ml-auto">{items.length} gói</span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs">
                                <thead>
                                    <tr class="bg-slate-100 text-slate-500">
                                        <th class="p-2 font-bold w-1/5">Nhóm Hàng</th>
                                        <th class="p-2 font-bold w-1/4">Khung Giá Máy</th>
                                        <th class="p-2 font-bold">Gói 1</th>
                                        <th class="p-2 font-bold">Gói 2</th>
                                        <th class="p-2 font-bold">Gói 3</th>
                                        <th class="p-2 font-bold text-center">Đ.Vị</th>
                                        <th class="p-2 font-bold">Phí Min</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each items as item}
                                        <tr class="border-t border-slate-100 hover:bg-white transition-colors">
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