<script>
    export let data = {};
    
    $: hierarchy = data.categoryHierarchy || [];
    $: total = data.totalCat || { sl: 0, dt: 0, dtqd: 0 };

    let expanded = {};
    function toggle(name) {
        expanded[name] = !expanded[name];
    }

    // Các hàm format đã được điều chỉnh chia 1000 cho gọn
    const fmtK = (val) => new Intl.NumberFormat('vi-VN').format(Math.round((val || 0) / 1000));
    const fmtNum = (val) => new Intl.NumberFormat('vi-VN').format(Math.round(val || 0));
    const fmtPrice = (dt, sl) => {
        if (!sl || sl <= 0) return '-';
        // Đơn giá = DT / SL. Sau đó chia 1.000.000 để ra số Triệu đồng (Tr)
        return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format((dt / sl) / 1000000);
    };
</script>

<div class="space-y-4 animate-fade-in">
    {#if hierarchy.length === 0}
        <div class="text-center p-8 bg-white rounded-xl border border-dashed border-gray-300 shadow-sm">
            <span class="material-icons-round text-4xl text-gray-300 mb-2 block">category</span>
            <p class="text-gray-500 text-sm font-medium">Chưa phát sinh doanh thu ngành hàng.</p>
        </div>
    {:else}
        <div class="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200 custom-scrollbar">
            <table class="w-full text-left border-collapse whitespace-nowrap min-w-[500px]">
                <thead>
                    <tr class="bg-gray-50 border-b border-gray-200 text-[10px] uppercase text-gray-500 font-bold tracking-wider">
                        <th class="p-3 sticky left-0 bg-gray-50 z-10 border-r border-gray-100">Danh Mục</th>
                        <th class="p-3 text-right">SL</th>
                        <th class="p-3 text-right text-blue-700">DT Thực (K)</th>
                        <th class="p-3 text-right text-orange-700">Đ.Giá (Tr)</th>
                        <th class="p-3 text-right text-purple-700">DT QĐ (K)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="bg-blue-50 border-b border-blue-100 text-blue-900">
                        <td class="p-3 text-[12px] font-black uppercase sticky left-0 bg-blue-50 z-10 border-r border-blue-100">TỔNG CỘNG</td>
                        <td class="p-3 text-right font-black text-blue-900">{fmtNum(total.sl)}</td>
                        <td class="p-3 text-right font-black text-blue-700">{fmtK(total.dt)}</td>
                        <td class="p-3 text-right font-bold text-orange-700">{fmtPrice(total.dt, total.sl)}</td>
                        <td class="p-3 text-right font-black text-purple-700">{fmtK(total.dtqd)}</td>
                    </tr>

                    {#each hierarchy as nganh}
                        <tr class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors" on:click={() => toggle(nganh.name)}>
                            <td class="p-3 text-[12px] font-bold text-gray-800 flex items-center gap-1 sticky left-0 bg-white z-10 border-r border-gray-100 group">
                                <span class="material-icons-round text-[16px] text-gray-400 transition-transform {expanded[nganh.name] ? 'rotate-90 text-blue-500' : ''}">chevron_right</span>
                                <span class="truncate max-w-[180px] group-hover:text-blue-700 transition-colors" title={nganh.name}>{nganh.name}</span>
                            </td>
                            <td class="p-3 text-right font-bold text-gray-700">{fmtNum(nganh.sl)}</td>
                            <td class="p-3 text-right font-bold text-blue-600">{fmtK(nganh.dt)}</td>
                            <td class="p-3 text-right font-semibold text-orange-600">{fmtPrice(nganh.dt, nganh.sl)}</td>
                            <td class="p-3 text-right font-bold text-purple-600">{fmtK(nganh.dtqd)}</td>
                        </tr>

                        {#if expanded[nganh.name]}
                            {#each nganh.children as nhom}
                                <tr class="bg-gray-50 border-b border-white hover:bg-gray-100 transition-colors">
                                    <td class="p-2.5 pl-8 text-[11px] font-semibold text-gray-600 flex items-center gap-1.5 sticky left-0 bg-gray-50 z-10 border-r border-white">
                                        <div class="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                        <span class="truncate max-w-[160px]" title={nhom.name}>{nhom.name}</span>
                                    </td>
                                    <td class="p-2.5 text-right font-medium text-gray-600">{fmtNum(nhom.sl)}</td>
                                    <td class="p-2.5 text-right font-medium text-blue-500">{fmtK(nhom.dt)}</td>
                                    <td class="p-2.5 text-right text-orange-500">{fmtPrice(nhom.dt, nhom.sl)}</td>
                                    <td class="p-2.5 text-right font-medium text-purple-500">{fmtK(nhom.dtqd)}</td>
                                </tr>
                            {/each}
                        {/if}
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

<style>
    .animate-fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    .custom-scrollbar::-webkit-scrollbar { height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-radius: 8px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
</style>