<script>
    import { onMount, onDestroy } from 'svelte';
    import { db } from '../../lib/firebase';
    import { collection, query, where, getDocs, doc, setDoc, onSnapshot } from 'firebase/firestore';
    // Lấy thông tin User đang đăng nhập để phân quyền xếp ca
    import { currentUser } from '../../lib/stores';
    import PGInfoModal from './PGInfoModal.svelte';
    import PGDayStatsModal from './PGDayStatsModal.svelte';

    export let selectedViewStore;
    export let isAdmin = false;

    let pgList = [];
    let groupedPGs = {};
    let pgScheduleData = {}; 
    
    let loading = false;
    let isSaving = false;
    let unsubscribe = null;
    let saveTimeout = null;

    let selectedPGForModal = null;
    let selectedDayForStats = null;
    // Quản lý Tuần
    let currentDate = new Date();
    $: weekId = getWeekId(currentDate);
    $: weekLabel = getWeekLabel(currentDate);
    // [CodeGenesis v2] LOGIC KHÓA THỜI GIAN
    let realCurrentDate = new Date();
    $: realCurrentWeekId = getWeekId(realCurrentDate);
    $: isFutureWeek = weekId > realCurrentWeekId; 

    // Bộ nhớ tạm lưu trữ lịch trước khi xóa phòng trường hợp ấn nhầm
    let lastDeletedData = null;
    $: if (weekId) lastDeletedData = null; // Tự động hủy cache nếu đổi tuần để tránh khôi phục sai lệch tuần

    const SHIFT_COLORS = {
        '': 'bg-slate-50 text-slate-400 border-dashed border-slate-200',
        'OFF': 'bg-red-100 text-red-600 border-red-200 font-bold',
        'Sáng': 'bg-blue-100 text-blue-700 border-blue-200 font-bold',
        'Chiều': 'bg-orange-100 text-orange-700 border-orange-200 font-bold',
        'Gãy': 'bg-purple-100 text-purple-700 border-purple-200 font-bold',
        'Full': 'bg-teal-100 text-teal-700 border-teal-200 font-bold'
    };
    const CATEGORY_COLORS = [
        'bg-blue-100 text-blue-800 border-blue-200',
        'bg-green-100 text-green-800 border-green-200',
        'bg-purple-100 text-purple-800 border-purple-200',
        'bg-amber-100 text-amber-800 border-amber-200',
        'bg-teal-100 text-teal-800 border-teal-200',
        'bg-rose-100 text-rose-800 border-rose-200'
    ];
    const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    
    function getWeekId(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
        const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
        return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    }

    function getWeekLabel(d) {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        return `${monday.getDate()}/${monday.getMonth()+1} - ${sunday.getDate()}/${sunday.getMonth()+1}`;
    }

    function changeWeek(offset) {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + (offset * 7));
        currentDate = newDate;
    }

    // [CodeGenesis v2] HÀM CUỘN TỚI LỊCH CÁ NHÂN
    function scrollToMyRow() {
        if (!$currentUser) return;
        const row = document.getElementById('pg-row-' + $currentUser.username);
        if (row) {
            // Cuộn trượt mượt mà tới dòng của PG
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Nháy sáng ô Tên để gây chú ý
            const td = row.querySelector('td');
            if (td) {
                td.classList.add('!bg-yellow-200', 'transition-colors', 'duration-300');
                setTimeout(() => td.classList.remove('!bg-yellow-200'), 1500);
            }
        } else {
            alert("Không tìm thấy tên của bạn trong danh sách hiện tại!");
        }
    }

    // [CodeGenesis] HÀM XÓA TOÀN BỘ LỊCH CHO ADMIN
    async function clearAllSchedules() {
        if (!isAdmin) return;
        if (pgList.length === 0) {
            alert("Không có nhân sự PG nào trong kho hiện tại để xóa lịch!");
            return;
        }

        const isConfirmed = confirm(`BẠN CÓ CHẮC CHẮN muốn xóa TOÀN BỘ lịch đã xếp của tất cả PG trong tuần [${weekLabel}] không?\nHệ thống sẽ lưu bản sao lưu tạm thời để bạn khôi phục nếu lỡ tay bấm nhầm.`);
        if (!isConfirmed) return;

        try {
            isSaving = true;
            const ref = doc(db, 'stores', selectedViewStore, 'pg_schedules', weekId);
            
            // Sao lưu dữ liệu lịch hiện tại trước khi thực hiện xóa sạch
            lastDeletedData = JSON.parse(JSON.stringify(pgScheduleData));

            // Xây dựng tập dữ liệu trống cho tất cả PG đang có mặt trong kho
            const resetData = {};
            pgList.forEach(pg => {
                resetData[pg.id] = { 'T2':'', 'T3':'', 'T4':'', 'T5':'', 'T6':'', 'T7':'', 'CN':'' };
            });

            // Ghi đè cập nhật lên Firestore
            await setDoc(ref, { data: resetData }, { merge: true });
            alert("Đã xóa sạch toàn bộ lịch PG của tuần này thành công!");
        } catch (e) {
            console.error("Lỗi khi xóa lịch PG:", e);
            alert("Lỗi hệ thống khi xóa lịch: " + e.message);
        } finally {
            isSaving = false;
        }
    }

    // [CodeGenesis] HÀM KHÔI PHỤC LỊCH CHO ADMIN
    async function restoreSchedules() {
        if (!isAdmin || !lastDeletedData) return;

        const isConfirmed = confirm("Bạn có chắc chắn muốn KHÔI PHỤC lại toàn bộ dữ liệu lịch vừa xóa trước đó không?");
        if (!isConfirmed) return;

        try {
            isSaving = true;
            const ref = doc(db, 'stores', selectedViewStore, 'pg_schedules', weekId);
            
            // Đẩy lại bản sao lưu tạm thời lên Firestore
            await setDoc(ref, { data: lastDeletedData }, { merge: true });
            lastDeletedData = null; // Khôi phục thành công -> Giải phóng bộ nhớ tạm
            alert("Đã khôi phục dữ liệu lịch PG thành công!");
        } catch (e) {
            console.error("Lỗi khi khôi phục lịch PG:", e);
            alert("Lỗi hệ thống khi khôi phục lịch: " + e.message);
        } finally {
            isSaving = false;
        }
    }

    $: if (selectedViewStore) loadPGs();
    $: if (selectedViewStore && weekId) loadScheduleForWeek();
    
    async function loadPGs() {
        try {
            loading = true;
            const q = query(collection(db, 'users'), where('storeIds', 'array-contains', selectedViewStore), where('role', '==', 'pg'));
            const snap = await getDocs(q);
            pgList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            groupedPGs = pgList.reduce((acc, pg) => {
                const cat = pg.category || 'Khác';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(pg);
                return acc;
            }, {});
        } catch (e) { console.error("Lỗi load PG:", e); } finally { loading = false; }
    }

    function loadScheduleForWeek() {
        if (unsubscribe) unsubscribe();
        const ref = doc(db, 'stores', selectedViewStore, 'pg_schedules', weekId);
        unsubscribe = onSnapshot(ref, (snap) => {
            if (snap.exists()) { pgScheduleData = snap.data().data || {}; } 
            else {
                pgScheduleData = {};
                pgList.forEach(pg => { pgScheduleData[pg.id] = { 'T2':'', 'T3':'', 'T4':'', 'T5':'', 'T6':'', 'T7':'', 'CN':'' }; });
            }
        });
    }

    function updateShift(pgId, pgUsername, day, value) {
        const isOwner = $currentUser?.username === pgUsername;
        
        if (!isAdmin) {
            if (!isOwner) {
                pgScheduleData = { ...pgScheduleData }; // Force UI Sync
                return;
            }
            if (!isFutureWeek) {
                alert("Bạn chỉ có thể đăng ký/chỉnh sửa lịch cho các tuần tiếp theo!");
                pgScheduleData = { ...pgScheduleData }; // Force UI Sync
                return;
            }

            // [CodeGenesis] LOGIC GIỚI HẠN OFF 50%
            if (value === 'OFF') {
                const currentPG = pgList.find(p => p.id === pgId);
                const pgCategory = currentPG?.category || 'Khác';
                const groupPGs = pgList.filter(p => (p.category || 'Khác') === pgCategory);
                
                // Làm tròn xuống theo yêu cầu
                const maxOffs = Math.floor(groupPGs.length / 2);
                
                // Đếm số lượng PG trong NHÓM NÀY đã OFF ngày này (bỏ qua bản thân người đang sửa)
                const currentOffCount = groupPGs.filter(p => 
                    p.id !== pgId && 
                    pgScheduleData[p.id] && 
                    pgScheduleData[p.id][day] === 'OFF'
                ).length;

                if (currentOffCount >= maxOffs) {
                    alert("Đã hết lượt off của ngày này, vui lòng chọn ngày khác hoặc liên hệ QL");
                    pgScheduleData = { ...pgScheduleData }; // Ép Svelte render lại thẻ select về giá trị cũ
                    return;
                }
            }
        }

        if (!pgScheduleData[pgId]) pgScheduleData[pgId] = { 'T2':'', 'T3':'', 'T4':'', 'T5':'', 'T6':'', 'T7':'', 'CN':'' };
        pgScheduleData[pgId][day] = value;
        pgScheduleData = { ...pgScheduleData }; 
        triggerAutoSave();
    }

    function triggerAutoSave() {
        isSaving = true;
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            try {
                const ref = doc(db, 'stores', selectedViewStore, 'pg_schedules', weekId);
                await setDoc(ref, { data: pgScheduleData }, { merge: true });
                isSaving = false;
            } 
            catch (e) { console.error("Lỗi lưu lịch PG:", e); isSaving = false; }
        }, 800);
    }

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
        if (saveTimeout) clearTimeout(saveTimeout);
    });
</script>

<div class="w-full bg-white rounded-xl shadow-sm border border-pink-200 overflow-hidden flex flex-col h-full animate-fadeIn">
    
    <div class="p-2 bg-pink-50 border-b border-pink-100 flex flex-col gap-1.5 shrink-0">
        <div class="flex justify-between items-center gap-2 w-full">
            
            <div class="flex items-center gap-2 shrink-0">
                <h3 class="font-bold text-xs sm:text-sm text-pink-700 whitespace-nowrap">Lịch PG ({pgList.length})</h3>
                
                <div class="flex items-center bg-white rounded border border-pink-200 shadow-sm shrink-0 h-7">
                    <button class="w-6 h-full flex items-center justify-center hover:bg-pink-100 text-pink-600 rounded-l" on:click={() => changeWeek(-1)}>
                        <span class="material-icons-round text-[14px]">chevron_left</span>
                    </button>
                    <div class="px-1.5 sm:px-2 text-[10px] sm:text-xs font-black text-pink-700 tracking-tight select-none flex items-center h-full">
                        {weekLabel} <span class="hidden sm:inline font-normal text-pink-400 ml-1">({weekId})</span>
                    </div>
                    <button class="w-6 h-full flex items-center justify-center hover:bg-pink-100 text-pink-600 rounded-r" on:click={() => changeWeek(1)}>
                        <span class="material-icons-round text-[14px]">chevron_right</span>
                    </button>
                </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
                {#if !isAdmin}
                    <button class="w-7 h-7 flex items-center justify-center hover:bg-indigo-100 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 shadow-sm transition-colors" on:click={scrollToMyRow} title="Đến lịch của tôi">
                         <span class="material-icons-round text-[16px]">my_location</span>
                    </button>
                {:else}
                    {#if lastDeletedData}
                        <button class="h-7 px-1.5 sm:px-2 flex items-center justify-center gap-1 bg-green-50 hover:bg-green-100 text-green-600 border border-green-100 rounded text-[11px] font-bold shadow-sm animate-pulse transition-colors" on:click={restoreSchedules} title="Khôi phục dữ liệu vừa xóa nhầm">
                             <span class="material-icons-round text-[16px]">restore</span> 
                             <span class="hidden sm:inline">Khôi Phục</span>
                        </button>
                    {/if}
                    <button class="h-7 px-1.5 sm:px-2 flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded text-[11px] font-bold shadow-sm transition-colors" on:click={clearAllSchedules} title="Xóa toàn bộ lịch tuần này">
                         <span class="material-icons-round text-[16px]">delete_sweep</span> 
                         <span class="hidden sm:inline">Xóa Lịch</span>
                    </button>
                {/if}
            </div>
        </div>

        {#if !isAdmin && !isFutureWeek}
            <div class="text-[9px] text-red-500 font-bold flex items-center gap-1">
                <span class="material-icons-round text-[10px]">lock</span> Tuần này đã khóa, không thể sửa lịch!
            </div>
        {/if}
    </div>

    <div class="flex-1 overflow-auto relative p-1.5 sm:p-4 bg-slate-50">
        {#if loading}
            <div class="text-center text-pink-400 p-10 animate-pulse font-bold text-sm">Đang tải danh sách PG...</div>
        {:else if pgList.length === 0}
            <div class="text-center p-10 text-gray-400 flex flex-col items-center">
                <span class="material-icons-round text-4xl mb-2 opacity-20">group_off</span>
                <span class="text-sm font-bold">Chưa có PG nào thuộc Kho {selectedViewStore}</span>
            </div>
        {:else}
            <div class="space-y-4 sm:space-y-6">
                {#each Object.entries(groupedPGs) as [category, pgs], index}
                    {@const headerColorClass = CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    
                    <div class="w-full bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden relative">
                        <div class="p-2 border-b text-[11px] sm:text-xs flex justify-between items-center font-bold {headerColorClass}">
                            <span>NHÓM: {category.toUpperCase()}</span>
                            <span class="text-[9px] sm:text-[10px] bg-white/70 px-2 py-0.5 rounded-full border border-white/50">{pgs.length} NV</span>
                        </div>
  
                        <div class="overflow-x-auto relative scroll-smooth pb-1.5 sm:pb-2">
                            <table class="w-full text-center text-xs border-collapse">
                                <thead class="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th class="p-1.5 sm:p-2 text-[10px] sm:text-xs text-left font-bold border-r border-b z-20 sticky left-0 bg-slate-50 min-w-[95px] max-w-[95px] sm:min-w-[140px] sm:max-w-[140px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nhân sự</th>
                                        {#each DAYS as d}
                                            <th class="p-1 min-w-[55px] sm:min-w-[70px] text-[10px] sm:text-xs font-bold border-r border-b last:border-0 cursor-pointer hover:bg-indigo-50 transition-colors group" title="Xem thống kê ca ngày {d}" on:click={() => selectedDayForStats = d}>
                                                <div class="flex items-center justify-center gap-1 {['T7','CN'].includes(d) ? 'text-pink-600' : ''}">
                                                    {d} <span class="material-icons-round text-[10px] text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">pie_chart</span>
                                                </div>
                                            </th>
                                        {/each}
                                    </tr>
                                </thead>
                                
                                <tbody class="divide-y divide-slate-100">
                                    {#each pgs as pg}
                                        {@const isOwner = $currentUser?.username === pg.username}
                                        
                                        <tr id="pg-row-{pg.username}" class="transition-colors {isOwner ? 'bg-indigo-50/40' : 'hover:bg-slate-50/50'}">
                                            <td class="p-1.5 sm:p-2 text-left border-r z-10 sticky left-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[95px] max-w-[95px] sm:min-w-[140px] sm:max-w-[140px] cursor-pointer transition-colors {isOwner ? 'bg-indigo-50 hover:bg-indigo-100' : 'bg-white hover:bg-pink-50'}" title="Xem SĐT {pg.username}" on:click={() => selectedPGForModal = pg}>
                                                <div class="flex justify-between items-center w-full">
                                                    <div class="font-bold text-[11px] sm:text-sm text-indigo-700 truncate">{pg.username}</div>
                                                    
                                                    {#if isOwner}
                                                        <span class="text-[8px] sm:text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded shadow-sm shrink-0 ml-1">BẠN</span>
                                                    {/if}
                                                </div>
                                            </td>
                                            
                                            {#each DAYS as d}
                                                {@const currentShift = pgScheduleData[pg.id]?.[d] || ''}
                                                {@const canEdit = isAdmin || (isOwner && isFutureWeek)}
                                                
                                                <td class="p-0.5 sm:p-1 border-r last:border-0 align-middle">
                                                    <select 
                                                        class="w-full h-7 sm:h-8 rounded border text-[10px] sm:text-[11px] font-semibold outline-none text-center cursor-pointer transition-colors shadow-sm appearance-none {SHIFT_COLORS[currentShift]} {!canEdit ? 'pointer-events-none opacity-80' : 'hover:border-indigo-300'}"
                                                        value={currentShift}
                                                        disabled={!canEdit}
                                                        on:change={(e) => updateShift(pg.id, pg.username, d, e.target.value)}
                                                    >
                                                        <option value="" class="bg-white text-gray-500">—</option>
                                                        <option value="OFF" class="bg-white text-red-600 font-bold">OFF</option>
                                                        <option value="Sáng" class="bg-white text-blue-700 font-bold">Sáng</option>
                                                        <option value="Chiều" class="bg-white text-orange-700 font-bold">Chiều</option>
                                                        <option value="Gãy" class="bg-white text-purple-700 font-bold">Gãy</option>
                                                        <option value="Full" class="bg-white text-teal-700 font-bold">Full</option>
                                                    </select>
                                                </td>
                                            {/each}
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <div class="p-1.5 bg-slate-100 border-t flex justify-between items-center px-4 shrink-0 text-[9px] sm:text-[10px] font-bold">
        <span class="text-slate-500 truncate pr-2">Auto-save: Dữ liệu lưu tự động.</span>
        {#if isSaving}
            <span class="text-amber-500 animate-pulse flex items-center gap-1 shrink-0"><span class="material-icons-round text-[12px]">sync</span> <span class="hidden sm:inline">Đang lưu...</span></span>
        {:else}
            <span class="text-green-600 flex items-center gap-1 shrink-0"><span class="material-icons-round text-[12px]">cloud_done</span> <span class="hidden sm:inline">Đã đồng bộ</span></span>
        {/if}
    </div>
</div>

{#if selectedPGForModal}
    <PGInfoModal pg={selectedPGForModal} {isAdmin} currentUser={$currentUser} on:close={() => selectedPGForModal = null} />
{/if}

{#if selectedDayForStats}
    <PGDayStatsModal day={selectedDayForStats} {pgList} {pgScheduleData} on:close={() => selectedDayForStats = null} />
{/if}