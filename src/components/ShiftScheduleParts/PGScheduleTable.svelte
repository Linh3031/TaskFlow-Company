<script>
    import { onMount, onDestroy } from 'svelte';
    import { db } from '../../lib/firebase';
    import { collection, query, where, doc, setDoc, onSnapshot } from 'firebase/firestore';
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
    let pgUnsubscribe = null; 

    // Biến quản lý trạng thái Khóa/Mở của Admin
    let isScheduleUnlocked = false; 

    let selectedPGForModal = null;
    let selectedDayForStats = null;
    
    // Quản lý Tuần
    let currentDate = new Date();
    $: weekId = getWeekId(currentDate);
    $: weekLabel = getWeekLabel(currentDate);
    
    // LOGIC KHÓA THỜI GIAN
    let realCurrentDate = new Date();
    $: realCurrentWeekId = getWeekId(realCurrentDate);
    $: isFutureWeek = weekId > realCurrentWeekId; 

    // Bộ nhớ tạm lưu trữ lịch trước khi xóa phòng trường hợp ấn nhầm
    let lastDeletedData = null;
    $: if (weekId) lastDeletedData = null; 

    const SHIFT_COLORS = {
        '': 'bg-slate-50 text-slate-400 border-dashed border-slate-200',
        'OFF': 'bg-red-100 text-red-600 border-red-200 font-bold',
        'Sáng': 'bg-blue-100 text-blue-700 border-blue-200 font-bold',
        'Chiều': 'bg-orange-100 text-orange-700 border-orange-200 font-bold',
        'Gãy': 'bg-purple-100 text-purple-700 border-purple-200 font-bold',
        'Full': 'bg-teal-100 text-teal-700 border-teal-200 font-bold'
    };
    
    const CATEGORY_COLORS = [
        'bg-blue-600 text-white border-blue-700',
        'bg-green-600 text-white border-green-700',
        'bg-purple-600 text-white border-purple-700',
        'bg-amber-600 text-white border-amber-700',
        'bg-teal-600 text-white border-teal-700',
        'bg-rose-600 text-white border-rose-700'
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

    function scrollToMyRow() {
        if (!$currentUser) return;
        const row = document.getElementById('pg-row-' + $currentUser.username);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const td = row.querySelector('td');
            if (td) {
                td.classList.add('!bg-yellow-200', 'transition-colors', 'duration-300');
                setTimeout(() => td.classList.remove('!bg-yellow-200'), 1500);
            }
        } else {
            alert("Không tìm thấy tên của bạn trong danh sách hiện tại!");
        }
    }

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
            lastDeletedData = JSON.parse(JSON.stringify(pgScheduleData));

            const resetData = {};
            pgList.forEach(pg => {
                resetData[pg.id] = { 'T2':'', 'T3':'', 'T4':'', 'T5':'', 'T6':'', 'T7':'', 'CN':'' };
            });

            await setDoc(ref, { data: resetData }, { merge: true });
            alert("Đã xóa sạch toàn bộ lịch PG của tuần này thành công!");
        } catch (e) {
            console.error("Lỗi khi xóa lịch PG:", e);
            alert("Lỗi hệ thống khi xóa lịch: " + e.message);
        } finally {
            isSaving = false;
        }
    }

    async function restoreSchedules() {
        if (!isAdmin || !lastDeletedData) return;

        const isConfirmed = confirm("Bạn có chắc chắn muốn KHÔI PHỤC lại toàn bộ dữ liệu lịch vừa xóa trước đó không?");
        if (!isConfirmed) return;

        try {
            isSaving = true;
            const ref = doc(db, 'stores', selectedViewStore, 'pg_schedules', weekId);
            await setDoc(ref, { data: lastDeletedData }, { merge: true });
            lastDeletedData = null; 
            alert("Đã khôi phục dữ liệu lịch PG thành công!");
        } catch (e) {
            console.error("Lỗi khi khôi phục lịch PG:", e);
            alert("Lỗi hệ thống khi khôi phục lịch: " + e.message);
        } finally {
            isSaving = false;
        }
    }

    async function toggleScheduleLock() {
        if (!isAdmin) return;
        try {
            isSaving = true;
            const ref = doc(db, 'stores', selectedViewStore, 'pg_schedules', weekId);
            await setDoc(ref, { isUnlocked: !isScheduleUnlocked }, { merge: true });
        } catch (e) {
            console.error("Lỗi thao tác khóa/mở lịch:", e);
        } finally {
            isSaving = false;
        }
    }

    $: if (selectedViewStore) loadPGs();
    $: if (selectedViewStore && weekId) loadScheduleForWeek();
    
    function loadPGs() {
        loading = true;
        const q = query(collection(db, 'users'), where('storeIds', 'array-contains', selectedViewStore), where('role', '==', 'pg'));
        
        if (pgUnsubscribe) pgUnsubscribe();
        
        pgUnsubscribe = onSnapshot(q, (snap) => {
            pgList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            groupedPGs = pgList.reduce((acc, pg) => {
                const cat = pg.category || 'Khác';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(pg);
                return acc;
            }, {});
            loading = false;
        }, (error) => {
            console.error("Lỗi tải danh sách PG Realtime:", error);
            loading = false;
        });
    }

    function loadScheduleForWeek() {
        if (unsubscribe) unsubscribe();
        const ref = doc(db, 'stores', selectedViewStore, 'pg_schedules', weekId);
        unsubscribe = onSnapshot(ref, (snap) => {
            if (snap.exists()) { 
                const docData = snap.data();
                pgScheduleData = docData.data || {}; 
                isScheduleUnlocked = docData.isUnlocked || false;
            } 
            else {
                pgScheduleData = {};
                isScheduleUnlocked = false;
                pgList.forEach(pg => { pgScheduleData[pg.id] = { 'T2':'', 'T3':'', 'T4':'', 'T5':'', 'T6':'', 'T7':'', 'CN':'' }; });
            }
        });
    }

    // [PHẪU THUẬT LOGIC]: Bổ sung tham số "e" (Event) để ép DOM reset khi cần
    async function updateShift(e, pgId, pgUsername, day, value) {
        const originalValue = pgScheduleData[pgId]?.[day] || ''; // Chốt sổ giá trị gốc trước khi thay đổi
        
        const isOwner = $currentUser?.username === pgUsername;
        const currentPG = pgList.find(p => p.id === pgId);
        const shiftType = currentPG?.shiftType || 'flexible';
        
        if (!isAdmin && !isOwner) {
            e.target.value = originalValue; // Ép DOM quay về
            return;
        }

        if (!isAdmin && !isFutureWeek && !isScheduleUnlocked) {
            alert("Bạn chỉ có thể đăng ký/chỉnh sửa lịch cho các tuần tiếp theo hoặc khi Quản Lý đã mở khóa!");
            e.target.value = originalValue; // Ép DOM quay về
            return;
        }

        let warningMsg = "";
        const pgCategory = currentPG?.category || 'Khác';
        const groupPGs = pgList.filter(p => (p.category || 'Khác') === pgCategory);

        // 1. Ràng buộc: Tối đa 4 ca (Sáng/Chiều) một tuần (Chỉ áp dụng linh hoạt)
        if (shiftType !== 'morning_only' && shiftType !== 'afternoon_only') {
            if (value === 'Sáng' || value === 'Chiều') {
                let typeCount = 0;
                const weekData = pgScheduleData[pgId] || {};
                for (const [d, v] of Object.entries(weekData)) {
                    if (d !== day && v === value) {
                        typeCount++;
                    }
                }
                if (typeCount >= 4) {
                    warningMsg = `PG linh hoạt chỉ được xếp tối đa 4 ca [${value}] một tuần để đảm bảo tỷ lệ 50-50!`;
                }
            }
        }

        // 2. Ràng buộc: 50% số lượng PG linh hoạt làm cùng ca trong 1 ngày
        if (!warningMsg && value !== '' && value !== 'OFF') {
            if (shiftType !== 'morning_only' && shiftType !== 'afternoon_only') {
                const flexiblePGs = groupPGs.filter(p => p.shiftType !== 'morning_only' && p.shiftType !== 'afternoon_only');
                const maxSameShift = Math.ceil(flexiblePGs.length * 0.5);
                
                const currentSameShiftCount = flexiblePGs.filter(p => 
                    p.id !== pgId && 
                    pgScheduleData[p.id] && 
                    pgScheduleData[p.id][day] === value
                ).length;

                if (currentSameShiftCount >= maxSameShift) {
                    warningMsg = `Vượt giới hạn 50% quân số cùng ca!\n(Tối đa ${maxSameShift}/${flexiblePGs.length} PG linh hoạt của nhóm ${pgCategory} làm ca [${value}] vào ngày này).`;
                }
            }
        }

        // 3. Ràng buộc: OFF tối đa 30% TỔNG NHÂN SỰ của bộ phận (Bao gồm cả ca cố định)
        if (!warningMsg && value === 'OFF') {
            const maxOffs = Math.ceil(groupPGs.length * 0.3);
            const currentOffCount = groupPGs.filter(p => 
                p.id !== pgId && 
                pgScheduleData[p.id] && 
                pgScheduleData[p.id][day] === 'OFF'
            ).length;

            if (currentOffCount >= maxOffs) {
                warningMsg = `Vượt giới hạn OFF!\n(Tối đa ${maxOffs} người / ${groupPGs.length} tổng nhân sự nhóm ${pgCategory} được OFF cùng ngày).`;
            }
        }

        // --- XỬ LÝ CẢNH BÁO & QUYỀN ADMIN BYPASS ---
        if (warningMsg) {
            if (isAdmin) {
                const isOverride = confirm(warningMsg + "\n\nQuyền ADMIN: Bạn có muốn GHI ĐÈ để bỏ qua cảnh báo này không?");
                if (!isOverride) {
                    // Nếu nhấn Cancel -> Tát DOM tỉnh lại bằng originalValue
                    e.target.value = originalValue; 
                    return;
                }
            } else {
                alert(warningMsg + "\nVui lòng chọn ca/ngày khác hoặc liên hệ Quản lý.");
                // Bị chặn cứng -> Tát DOM tỉnh lại bằng originalValue
                e.target.value = originalValue; 
                return;
            }
        }

        // Tiến hành cập nhật State thật sự nếu hợp lệ (Hoặc Admin nhấn OK ghi đè)
        if (!pgScheduleData[pgId]) pgScheduleData[pgId] = { 'T2':'', 'T3':'', 'T4':'', 'T5':'', 'T6':'', 'T7':'', 'CN':'' };
        pgScheduleData[pgId][day] = value;
        pgScheduleData = { ...pgScheduleData }; 

        isSaving = true;
        try {
            const ref = doc(db, 'stores', selectedViewStore, 'pg_schedules', weekId);
            await setDoc(ref, { 
                data: {
                    [pgId]: {
                        [day]: value
                    }
                }
            }, { merge: true });
        } catch (error) { 
            console.error("Lỗi lưu lịch PG Atomic:", error); 
            // Rollback UI nếu lỗi mạng
            e.target.value = originalValue;
        } finally {
            isSaving = false; 
        }
    }

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
        if (pgUnsubscribe) pgUnsubscribe(); 
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
                    <button class="h-7 px-1.5 sm:px-2 flex items-center justify-center gap-1 {isScheduleUnlocked ? 'bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-200' : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200'} rounded text-[11px] font-bold shadow-sm transition-colors" on:click={toggleScheduleLock} title="Bật/Tắt quyền sửa lịch tuần này">
                        <span class="material-icons-round text-[16px]">{isScheduleUnlocked ? 'lock_open' : 'lock'}</span> 
                        <span class="hidden sm:inline">{isScheduleUnlocked ? 'Đang Mở' : 'Đang Khóa'}</span>
                    </button>

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

        {#if !isAdmin && !isFutureWeek && !isScheduleUnlocked}
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
            <div class="w-full bg-white border border-slate-200 rounded-lg shadow-sm relative">
                <table class="w-full text-center text-xs border-collapse">
                    <thead class="bg-slate-700 text-white">
                        <tr>
                            <th class="p-1.5 sm:p-2 text-[10px] sm:text-xs text-left font-bold border-r border-b border-slate-600 rounded-tl-lg z-30 sticky top-0 left-0 bg-slate-700 min-w-[95px] max-w-[95px] sm:min-w-[140px] sm:max-w-[140px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.2)]">Nhân sự</th>
                            {#each DAYS as d, dIdx}
                                <th class="p-1 min-w-[55px] sm:min-w-[70px] text-[10px] sm:text-xs font-bold border-r border-b border-slate-600 last:border-0 {dIdx === DAYS.length - 1 ? 'rounded-tr-lg' : ''} z-20 sticky top-0 bg-slate-700 cursor-pointer hover:bg-slate-600 transition-colors group" title="Xem thống kê ca ngày {d}" on:click={() => selectedDayForStats = d}>
                                    <div class="flex items-center justify-center gap-1 {['T7','CN'].includes(d) ? 'text-pink-300' : ''}">
                                        {d} <span class="material-icons-round text-[10px] text-indigo-200 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">pie_chart</span>
                                    </div>
                                </th>
                            {/each}
                        </tr>
                    </thead>

                    {#each Object.entries(groupedPGs) as [category, pgs], index}
                            {@const headerColorClass = CATEGORY_COLORS[index % CATEGORY_COLORS.length]}

                            <tbody class="divide-y divide-slate-100">
                                <tr>
                                    <td colspan={DAYS.length + 1} class="p-2 text-[11px] sm:text-xs font-bold border-b {headerColorClass}">
                                        <div class="flex justify-between items-center">
                                            <span>NHÓM: {category.toUpperCase()}</span>
                                            <span class="text-[9px] sm:text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/40">{pgs.length} NV</span>
                                        </div>
                                    </td>
                                </tr>
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
                                            {@const canEdit = isAdmin || (isOwner && (isFutureWeek || isScheduleUnlocked))}

                                            <td class="p-0.5 sm:p-1 border-r last:border-0 align-middle">
                                                <!-- [Surgical Fix]: Pass 'e' event vào updateShift -->
                                                <select
                                                    class="w-full h-7 sm:h-8 rounded border text-[10px] sm:text-[11px] font-semibold outline-none text-center cursor-pointer transition-colors shadow-sm appearance-none {SHIFT_COLORS[currentShift]} {!canEdit ? 'pointer-events-none opacity-80' : 'hover:border-indigo-300'}"
                                                    value={currentShift}
                                                    disabled={!canEdit}
                                                    on:change={(e) => updateShift(e, pg.id, pg.username, d, e.target.value)}
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
                        {/each}
                </table>
            </div>
        {/if}
    </div>

    <div class="p-1.5 bg-slate-100 border-t flex justify-between items-center px-4 shrink-0 text-[9px] sm:text-[10px] font-bold">
        <span class="text-slate-500 truncate pr-2">Cập nhật tức thời: Lịch đổi tới đâu lưu tự động tới đó.</span>
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