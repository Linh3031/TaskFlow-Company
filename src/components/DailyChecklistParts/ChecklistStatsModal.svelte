<script>
    import { createEventDispatcher } from 'svelte';
    export let show = false;
    export let statsData = { matrix: [], days: [], month: '' };
    export let statsLoading = false;
    export let allStaff = [];
    export let checklistData = [];
    export let excludedStaffIds = []; // Nhận danh sách đã bị miễn trừ từ DB

    const dispatch = createEventDispatcher();
    
    let activeTab = 'allocation'; 
    let sortBy = 'total';
    let sortDesc = true;
    
    // Quản lý trạng thái checkbox mượt mà khi đóng/mở modal
    let localExcludedIds = [];
    let prevShow = false;
    $: if (show && !prevShow) {
        localExcludedIds = [...excludedStaffIds];
    }
    $: prevShow = show;

    $: sortedMatrix = [...statsData.matrix].sort((a, b) => {
        if (sortBy === 'total') return sortDesc ? b.total - a.total : a.total - b.total;
        else return sortDesc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
    });

    function toggleSort(field) {
        if (sortBy === field) sortDesc = !sortDesc;
        else { sortBy = field; sortDesc = field === 'total'; }
    }

    $: grandTotal = sortedMatrix.reduce((sum, row) => sum + row.total, 0);
    $: dailyTotals = statsData.days.reduce((acc, day) => {
        acc[day] = sortedMatrix.reduce((sum, row) => sum + (row.days[day] || 0), 0);
        return acc;
    }, {});

    $: assignedStaffIds = new Set(checklistData.flatMap(item => (item.assignees || []).map(a => a.id)));
    $: unassignedStaff = allStaff.filter(s => !assignedStaffIds.has(s.id));
    $: unassignedCount = unassignedStaff.length;
    $: totalAreas = checklistData.length;

    function handleSaveExcluded() {
        dispatch('saveExcluded', localExcludedIds);
    }
</script>

{#if show}
<div class="fixed inset-0 z-[80] bg-slate-900/70 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-popIn h-[85vh]" on:click|stopPropagation>
        
        <div class="p-4 bg-indigo-50 flex justify-between items-center shrink-0">
            <div>
                <h3 class="font-bold text-indigo-800 flex items-center gap-2">
                    <span class="material-icons-round">dashboard_customize</span> Tổng Quan 8NTTT - Tháng {statsData.month}
                </h3>
            </div>
            <button class="text-slate-400 hover:text-red-500 bg-white rounded-full p-1 shadow-sm" aria-label="Đóng thống kê" on:click={() => dispatch('close')}>
                <span class="material-icons-round">close</span>
            </button>
        </div>

        <div class="flex border-b border-slate-200 bg-slate-50 shrink-0">
            <button class="flex-1 py-3 font-bold text-sm border-b-[3px] transition-colors {activeTab === 'allocation' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}" on:click={() => activeTab = 'allocation'}>
                <span class="material-icons-round text-[16px] align-text-bottom mr-1">groups</span> Nhân Sự & Phân Bổ
            </button>
            <button class="flex-1 py-3 font-bold text-sm border-b-[3px] transition-colors {activeTab === 'upload' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}" on:click={() => activeTab = 'upload'}>
                <span class="material-icons-round text-[16px] align-text-bottom mr-1">insert_photo</span> Tiến Độ Hình Ảnh
            </button>
        </div>

        <div class="flex-1 overflow-auto bg-slate-100 relative">
            {#if statsLoading}
                <div class="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-[60]">
                    <span class="material-icons-round animate-spin text-indigo-500 text-4xl mb-2">sync</span>
                    <span class="text-sm font-bold text-slate-500">Đang quét dữ liệu toàn kho...</span>
                </div>
            {/if}

            {#if activeTab === 'allocation'}
                <div class="p-4 flex flex-col md:flex-row gap-4 h-full items-stretch">
                    
                    <div class="flex-[3] bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col max-h-full">
                        <div class="p-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center shrink-0 flex-wrap gap-2">
                            <span class="flex items-center gap-1"><span class="material-icons-round text-indigo-500 text-sm">fact_check</span> Khu Vực Hiện Có ({totalAreas})</span>
                            <div class="flex flex-wrap gap-2 justify-end">
                                <button class="bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 px-3 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 shadow-sm font-bold" aria-label="Xóa tất cả khu vực" on:click={() => dispatch('deleteAll')}>
                                    <span class="material-icons-round text-[16px]">delete_sweep</span> Xóa Hết
                                </button>
                                <button class="bg-teal-50 border border-teal-300 text-teal-700 hover:bg-teal-100 px-3 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 shadow-sm font-bold" aria-label="Tải file mẫu" on:click={() => dispatch('exportTemplate')}>
                                    <span class="material-icons-round text-[16px]">description</span> File Mẫu
                                </button>
                                <button class="bg-green-50 border border-green-300 text-green-700 hover:bg-green-100 px-3 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 shadow-sm font-bold" aria-label="Xuất dữ liệu Excel" on:click={() => dispatch('exportExcel')}>
                                    <span class="material-icons-round text-[16px]">file_download</span> Xuất Excel
                                </button>
                                <label for="import-excel-input" class="bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100 px-3 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 shadow-sm font-bold cursor-pointer" aria-label="Nạp dữ liệu Excel">
                                    <span class="material-icons-round text-[16px]">file_upload</span> Nạp Excel
                                    <input type="file" id="import-excel-input" accept=".xlsx, .xls" class="hidden" on:change={(e) => { dispatch('importExcel', { file: e.target.files[0] }); e.target.value = null; }}>
                                </label>
                            </div>
                        </div>
                        <div class="flex-1 overflow-y-auto p-3 space-y-2">
                            {#each checklistData as item}
                                <div class="p-3 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:justify-between sm:items-center hover:border-indigo-300 transition-all gap-2 shadow-sm group">
                                    <div class="flex flex-col">
                                        <span class="font-bold text-slate-800 text-sm">{item.areaName}</span>
                                        <span class="text-[10px] font-bold text-slate-500 mt-0.5"><span class="material-icons-round text-[12px] align-text-bottom text-slate-400">group</span> {item.assignees?.length || 0} nhân sự</span>
                                    </div>

                                    <div class="flex items-center gap-2">
                                        <div class="text-[11px] font-bold px-2 py-1 rounded-md text-right shrink-0 {item.assignees?.length ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-red-50 text-red-600 border border-red-100'}">
                                            {#if item.assignees?.length}
                                                {item.assignees.map(a => a.username).join(', ')}
                                            {:else}
                                                <span class="material-icons-round text-[12px] align-text-bottom mr-0.5">warning</span> Chưa phân người
                                            {/if}
                                        </div>
                                        <button class="bg-indigo-50 hover:bg-indigo-600 text-indigo-500 hover:text-white border border-indigo-100 p-1.5 rounded-lg transition-colors flex items-center justify-center opacity-70 group-hover:opacity-100 shadow-sm" aria-label="Chỉnh sửa khu vực" on:click={() => dispatch('editArea', item)} title="Chỉnh sửa khu vực này">
                                            <span class="material-icons-round text-[16px]">edit</span>
                                        </button>
                                    </div>
                                </div>
                            {/each}
                            {#if totalAreas === 0}
                                <div class="text-center text-slate-400 py-10 font-bold">Chưa tạo khu vực 8NTTT nào.</div>
                            {/if}
                        </div>
                    </div>

                    <div class="flex-[2] bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col max-h-full">
                        <!-- PHẪU THUẬT: Thêm nút Lưu tại Header Cột Nhân Sự Trống -->
                        <div class="p-2.5 bg-red-50 border-b border-red-100 font-bold text-red-700 flex justify-between items-center shrink-0">
                            <span class="flex items-center gap-1"><span class="material-icons-round text-red-500 text-sm">person_off</span> Nhân Sự Trống ({unassignedCount})</span>
                            {#if unassignedCount > 0}
                                <button class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded shadow-sm text-xs transition-colors flex items-center gap-1" on:click={handleSaveExcluded}>
                                    <span class="material-icons-round text-[14px]">save</span> Lưu
                                </button>
                            {/if}
                        </div>
                        <div class="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
                            {#each unassignedStaff as staff}
                                <div class="p-2 bg-white border border-slate-200 rounded-lg flex items-center gap-2 shadow-sm {localExcludedIds.includes(staff.id) ? 'opacity-60 bg-slate-100' : ''}">
                                    <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                        <span class="material-icons-round text-[18px]">person_outline</span>
                                    </div>
                                    <div class="flex flex-col flex-1 min-w-0">
                                        <span class="font-bold text-slate-700 text-sm truncate">{staff.username}</span>
                                        <span class="text-[10px] text-slate-400 uppercase">{staff.role}</span>
                                    </div>
                                    <!-- PHẪU THUẬT: Thêm Checkbox chọn loại trừ -->
                                    <label class="flex items-center gap-1.5 cursor-pointer pl-2 border-l border-slate-200" title="Đánh dấu để bỏ qua khi Trộn Lịch">
                                        <span class="text-[10px] font-bold {localExcludedIds.includes(staff.id) ? 'text-red-500' : 'text-slate-400'} hidden sm:inline">Loại Trừ</span>
                                        <input type="checkbox" value={staff.id} bind:group={localExcludedIds} class="w-5 h-5 accent-red-500 rounded border-slate-300 cursor-pointer">
                                    </label>
                                </div>
                            {/each}
                            {#if unassignedCount === 0 && allStaff.length > 0}
                                <div class="p-6 text-center text-green-600 font-bold text-sm bg-green-50 rounded-xl border border-green-200 shadow-inner flex flex-col items-center">
                                    <span class="material-icons-round text-4xl mb-2 text-green-500">task_alt</span>
                                    <p>Tuyệt vời!</p>
                                    <p class="text-xs text-green-700 mt-1">Tất cả {allStaff.length} nhân viên đều đã được tham gia dọn dẹp.</p>
                                </div>
                            {/if}
                        </div>
                    </div>

                </div>

            {:else}
                <table class="w-full text-sm text-left border-collapse bg-white">
                    <thead class="text-xs text-slate-600 uppercase bg-slate-200 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th class="px-4 py-3 border-r border-slate-300 sticky left-0 bg-slate-200 z-30 cursor-pointer hover:bg-slate-300" on:click={() => toggleSort('name')}>
                                <div class="flex items-center gap-1">NHÂN SỰ {#if sortBy === 'name'}<span class="material-icons-round text-[14px]">{sortDesc ? 'arrow_downward' : 'arrow_upward'}</span>{/if}</div>
                            </th>
                            <th class="px-4 py-3 border-r border-slate-300 cursor-pointer hover:bg-slate-300 bg-indigo-100 text-indigo-800" on:click={() => toggleSort('total')}>
                                <div class="flex items-center gap-1">TỔNG THÁNG {#if sortBy === 'total'}<span class="material-icons-round text-[14px]">{sortDesc ? 'arrow_downward' : 'arrow_upward'}</span>{/if}</div>
                            </th>
                            {#each statsData.days as day}
                                <th class="px-2 py-3 border-r border-slate-300 text-center min-w-[35px]">{day}</th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody>
                        {#each sortedMatrix as row, index}
                            <tr class="bg-white border-b hover:bg-indigo-50/50 transition-colors">
                                <td class="px-4 py-2 border-r font-bold text-slate-800 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">{row.name}</td>
                                <td class="px-4 py-2 border-r font-black text-indigo-600 bg-indigo-50/30 text-center text-base">{row.total}</td>
                                {#each statsData.days as day}
                                    <td class="px-2 py-2 border-r text-center {row.days[day] ? 'font-bold text-cyan-600 bg-cyan-50/30' : 'text-slate-300'}">{row.days[day] || '-'}</td>
                                {/each}
                            </tr>
                        {/each}
                        {#if sortedMatrix.length === 0 && !statsLoading}
                            <tr>
                                <td colspan={statsData.days.length + 2} class="text-center py-12 text-slate-500 font-bold">Không có dữ liệu upload nào.</td>
                            </tr>
                        {/if}
                    </tbody>
                    
                    {#if sortedMatrix.length > 0 && !statsLoading}
                    <tfoot class="sticky bottom-0 z-20 bg-indigo-100 text-indigo-900 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
                        <tr>
                            <td class="px-4 py-3 border-r border-indigo-200 font-black sticky left-0 bg-indigo-100 z-30 uppercase">Tổng Toàn Kho</td>
                            <td class="px-4 py-3 border-r border-indigo-200 font-black text-center text-lg text-indigo-700">{grandTotal}</td>
                            {#each statsData.days as day}
                                <td class="px-2 py-3 border-r border-indigo-200 text-center font-bold {dailyTotals[day] ? 'text-indigo-800' : 'text-indigo-300'}">{dailyTotals[day] || '-'}</td>
                            {/each}
                        </tr>
                    </tfoot>
                    {/if}
                </table>
            {/if}
        </div>
    </div>
</div>
{/if}

<style>
    .animate-popIn { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>