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

    const SHIFT_COLORS = {
        '': 'bg-slate-50 text-slate-400 border-dashed border-slate-200',
        'OFF': 'bg-red-100 text-red-600 border-red-200 font-bold',
        'Sáng': 'bg-blue-100 text-blue-700 border-blue-200 font-bold',
        'Chiều': 'bg-orange-100 text-orange-700 border-orange-200 font-bold',
        'Gãy': 'bg-purple-100 text-purple-700 border-purple-200 font-bold'
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
        if (!isAdmin && $currentUser?.username !== pgUsername) return; 
        
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
            } catch (e) { console.error("Lỗi lưu lịch PG:", e); isSaving = false; }
        }, 800);
    }

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
        if (saveTimeout) clearTimeout(saveTimeout);
    });
</script>

<div class="w-full bg-white rounded-xl shadow-sm border border-pink-200 overflow-hidden flex flex-col h-full animate-fadeIn">
    
    <div class="p-2 sm:p-3 bg-pink-50 border-b border-pink-100 flex flex-row justify-between items-center gap-2 shrink-0">
        
        <div class="hidden sm:flex items-center gap-2 text-pink-700 shrink-0">
            <span class="material-icons-round text-xl">face_retouching_natural</span>
            <div>
                <h3 class="font-bold text-sm">Lịch Làm Việc PG (Tổng: {pgList.length} PG)</h3>
                <p class="text-[10px] opacity-80">Chọn ca từ danh sách xổ xuống</p>
            </div>
        </div>

        <div class="flex items-center justify-between sm:justify-center w-full sm:w-auto gap-2 bg-white px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg border border-pink-200 shadow-sm shrink-0">
            <button class="w-7 h-7 flex items-center justify-center hover:bg-pink-100 text-pink-600 rounded" on:click={() => changeWeek(-1)}>
                <span class="material-icons-round text-base">chevron_left</span>
            </button>
            <div class="text-center flex-1 sm:min-w-[120px]">
                <div class="font-black text-pink-700 text-sm tracking-tight">{weekLabel}</div>
                <div class="hidden sm:block text-[9px] text-pink-400 font-bold uppercase mt-0.5">Tuần: {weekId}</div>
            </div>
            <button class="w-7 h-7 flex items-center justify-center hover:bg-pink-100 text-pink-600 rounded" on:click={() => changeWeek(1)}>
                <span class="material-icons-round text-base">chevron_right</span>
            </button>
        </div>
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
                                        <tr class="hover:bg-slate-50/50 transition-colors">
                                            <td class="p-1.5 sm:p-2 text-left border-r z-10 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[95px] max-w-[95px] sm:min-w-[140px] sm:max-w-[140px] cursor-pointer hover:bg-pink-50 transition-colors" title="Xem SĐT {pg.username}" on:click={() => selectedPGForModal = pg}>
                                                <div class="font-bold text-[11px] sm:text-sm text-indigo-700 truncate">{pg.username}</div>
                                            </td>
                                            
                                            {#each DAYS as d}
                                                {@const currentShift = pgScheduleData[pg.id]?.[d] || ''}
                                                {@const canEdit = isAdmin || $currentUser?.username === pg.username}
                                                
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