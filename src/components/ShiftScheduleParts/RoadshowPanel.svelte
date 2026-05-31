<script>
    import { onMount, onDestroy } from 'svelte';
    import { db } from '../../lib/firebase';
    import { collection, query, where, getDocs, doc, setDoc, onSnapshot, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

    export let selectedViewStore;
    export let isAdmin = false;

    // --- LOGIC TÍNH NGÀY MẶC ĐỊNH ---
    function initDates() {
        return { start: '', end: '' }; 
    }

    let startDate = initDates().start;
    let endDate = initDates().end;
    let roadshowDays = []; 
    
    // Data lưu trữ dưới dạng: { '2026-03-04': { morning: [], afternoon: [] }, ... }
    let roadshowData = {};
    let allStaff = []; 
    let loading = false;
    let isSaving = false;
    
    let unsubscribe = null;
    let unsubscribeStaff = null; 

    // State cho Modal Search
    let showSearchModal = false;
    let targetDate = '';
    let targetSlot = ''; // 'morning' | 'afternoon'
    let searchQuery = '';

    // Lắng nghe sự thay đổi của khoảng ngày để Admin thao tác
    $: {
        if (isAdmin && startDate && endDate && startDate <= endDate) {
            roadshowDays = getDatesInRange(startDate, endDate);
        } else {
            roadshowDays = [];
        }
    }

    $: displayDays = Array.from(new Set([
        ...roadshowDays,
        ...Object.keys(roadshowData).filter(d => 
            (roadshowData[d]?.morning?.length || 0) > 0 || (roadshowData[d]?.afternoon?.length || 0) > 0
        )
    ])).sort();

    // --- UTILS ---
    function getDatesInRange(startStr, endStr) {
        const arr = [];
        let current = new Date(startStr);
        const end = new Date(endStr);
        while (current <= end) {
            const y = current.getFullYear();
            const m = String(current.getMonth() + 1).padStart(2, '0');
            const d = String(current.getDate()).padStart(2, '0');
            arr.push(`${y}-${m}-${d}`);
            current.setDate(current.getDate() + 1);
        }
        return arr;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const day = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
        return `${day}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    }

    function getWeekId(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
        const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
        return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    }

    // --- LẮNG NGHE NHÂN SỰ THỜI GIAN THỰC ---
    $: if (selectedViewStore) {
        if (unsubscribeStaff) unsubscribeStaff();
        const q = query(collection(db, 'users'), where('storeIds', 'array-contains', selectedViewStore));
        unsubscribeStaff = onSnapshot(q, (snap) => {
            allStaff = snap.docs.map(d => ({ 
                id: d.id, 
                name: d.data().name, 
                username: d.data().username,
                role: d.data().role,
                type: d.data().role === 'pg' ? 'pg' : 'nv',
                roadshowMode: d.data().roadshowMode // Lưu trữ Object cấu hình 7 ngày
            }));
        }, (err) => {
            console.error("Lỗi đồng bộ danh sách nhân sự:", err);
        });
    }

    $: if (selectedViewStore) {
        loadRoadshowRange();
    }

    function loadRoadshowRange() {
        if (unsubscribe) unsubscribe();
        
        const today = new Date();
        const firstDayOfMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
        const queryStart = (isAdmin && startDate && startDate < firstDayOfMonth) ? startDate : firstDayOfMonth;

        const q = query(collection(db, 'stores', selectedViewStore, 'roadshows'), 
                        where('date', '>=', queryStart));
                        
        unsubscribe = onSnapshot(q, (snap) => {
            let newData = {};
            roadshowDays.forEach(d => newData[d] = { morning: [], afternoon: [] });
            
            snap.forEach(doc => {
                newData[doc.id] = doc.data().data || { morning: [], afternoon: [] };
            });
            roadshowData = newData;
        });
    }

    // --- THUẬT TOÁN XÓA TOÀN BỘ LỊCH ---
    async function clearSchedule() {
        if (!isAdmin) return;
        
        const targets = roadshowDays.length > 0 ? roadshowDays : displayDays;
        
        if (targets.length === 0) {
            alert("Không tìm thấy dữ liệu lịch nào đang hiển thị để thực hiện xóa!");
            return;
        }

        if (!confirm(`⚠️ CẢNH BÁO: Hệ thống sẽ XÓA TRẮNG toàn bộ nhân sự trong ${targets.length} ngày đang được chọn/hiển thị. Bạn chắc chắn chứ?`)) return;
        loading = true;
        try {
            const batch = writeBatch(db);
            for (let dStr of targets) {
                const ref = doc(db, 'stores', selectedViewStore, 'roadshows', dStr);
                batch.set(ref, {
                    date: dStr,
                    data: { morning: [], afternoon: [] },
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
            await batch.commit();
            
            if (roadshowDays.length === 0) {
                targets.forEach(d => {
                    if (roadshowData[d]) roadshowData[d] = { morning: [], afternoon: [] };
                });
                roadshowData = { ...roadshowData };
            }
            alert("Đã xóa dữ liệu lịch roadshow thành công!");
        } catch (e) {
            alert("Lỗi xóa danh sách: " + e.message);
        } finally {
            loading = false;
        }
    }

    // --- THUẬT TOÁN AUTO-GEN TÍCH HỢP TÙY CHỈNH THEO NGÀY ---
    async function autoGenerate() {
        if (!isAdmin) return;
        if (roadshowDays.length === 0) {
            alert("Vui lòng chọn khoảng ngày (Từ ngày - Đến ngày) hợp lệ trước khi bấm Tạo Lịch!");
            return;
        }
        if (!confirm('Hệ thống sẽ XÓA và TỰ ĐỘNG XẾP LẠI toàn bộ các ngày bạn đang chọn. Bạn chắc chắn chứ?')) return;
        loading = true;
        
        try {
            const monthsToFetch = [...new Set(roadshowDays.map(d => d.substring(0, 7)))];
            const weeksToFetch = [...new Set(roadshowDays.map(d => getWeekId(new Date(d))))];

            const nvSchedules = {};
            const pgSchedules = {};
            for (let m of monthsToFetch) {
                const snap = await getDoc(doc(db, 'stores', selectedViewStore, 'schedules', m));
                if (snap.exists()) nvSchedules[m] = snap.data().data || {};
            }
            for (let w of weeksToFetch) {
                const snap = await getDoc(doc(db, 'stores', selectedViewStore, 'pg_schedules', w));
                if (snap.exists()) pgSchedules[w] = snap.data().data || {};
            }

            let newRoadshowData = {};
            for (let dStr of roadshowDays) {
                let dayObj = { morning: [], afternoon: [] };
                const d = new Date(dStr);
                const monthStr = dStr.substring(0, 7);
                const dayNumStr = String(d.getDate());
                const weekId = getWeekId(d);
                const weekdayStr = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]; // Thứ của ngày đang duyệt

                // Bóc tách Nhân Viên nội bộ
                const dayDataNV = nvSchedules[monthStr]?.[dayNumStr] || [];
                dayDataNV.forEach(assign => {
                    const shift = assign.shift;
                    if (['123', '23'].includes(shift)) {
                        dayObj.afternoon.push({ id: assign.staffId, displayName: assign.name, type: 'nv' });
                    }
                    if (['456', '45'].includes(shift)) {
                        dayObj.morning.push({ id: assign.staffId, displayName: assign.name, type: 'nv' });
                    }
                });

                // Bóc tách PG theo thuật toán tùy chỉnh
                const weekDataPG = pgSchedules[weekId] || {};
                Object.keys(weekDataPG).forEach(pgId => {
                    const shift = weekDataPG[pgId][weekdayStr];
                    const pgInfo = allStaff.find(s => s.id === pgId);
                    
                    if (pgInfo) {
                        const rawMode = pgInfo.roadshowMode;
                        let dMode = 'different'; // Giá trị rớt đài (fallback)
                        
                        // [CodeGenesis] Phân rã dữ liệu Mode theo ngày
                        if (typeof rawMode === 'string') {
                            dMode = rawMode; // Đọc data cũ
                        } else if (typeof rawMode === 'object' && rawMode !== null) {
                            dMode = rawMode[weekdayStr] || 'different'; // Đọc mode của chính xác thứ đó
                        }
                        
                        if (dMode === 'same') {
                            if (shift === 'Sáng') dayObj.morning.push({ id: pgId, displayName: pgInfo.username, type: 'pg' });
                            if (shift === 'Chiều') dayObj.afternoon.push({ id: pgId, displayName: pgInfo.username, type: 'pg' });
                        } else { // 'different'
                            if (shift === 'Sáng') dayObj.afternoon.push({ id: pgId, displayName: pgInfo.username, type: 'pg' });
                            if (shift === 'Chiều') dayObj.morning.push({ id: pgId, displayName: pgInfo.username, type: 'pg' });
                        }
                    }
                });
                newRoadshowData[dStr] = dayObj;
            }

            const batch = writeBatch(db);
            for (let dStr of roadshowDays) {
                const ref = doc(db, 'stores', selectedViewStore, 'roadshows', dStr);
                batch.set(ref, {
                    date: dStr,
                    data: newRoadshowData[dStr],
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
            await batch.commit();
            alert("Tạo lịch tự động thành công!");
        } catch (e) {
            alert("Lỗi tạo danh sách: " + e.message);
        } finally {
            loading = false;
        }
    }

    // --- LOGIC CHỈNH SỬA THỦ CÔNG ---
    function removeUser(dateStr, slot, userId) {
        if (!isAdmin) return;
        roadshowData[dateStr][slot] = roadshowData[dateStr][slot].filter(u => u.id !== userId);
        triggerAutoSave(dateStr);
    }

    function openSearchModal(dateStr, slot) {
        if (!isAdmin) return;
        targetDate = dateStr;
        targetSlot = slot;
        searchQuery = '';
        showSearchModal = true;
    }

    function addUser(user) {
        if (roadshowData[targetDate][targetSlot].some(u => u.id === user.id)) {
            alert("Nhân sự này đã có trong danh sách!");
            return;
        }
        
        roadshowData[targetDate][targetSlot].push({ 
            id: user.id, 
            displayName: user.type === 'pg' ? user.username : user.name, 
            type: user.type 
        });
        roadshowData = { ...roadshowData }; 
        triggerAutoSave(targetDate);
        showSearchModal = false;
    }

    let saveTimeout = {};
    function triggerAutoSave(dateStr) {
        isSaving = true;
        if (saveTimeout[dateStr]) clearTimeout(saveTimeout[dateStr]);
        
        saveTimeout[dateStr] = setTimeout(async () => {
            const ref = doc(db, 'stores', selectedViewStore, 'roadshows', dateStr);
            await setDoc(ref, { 
                date: dateStr, 
                data: roadshowData[dateStr], 
                updatedAt: serverTimestamp() 
            }, { merge: true });
            isSaving = false;
        }, 800);
    }

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
        if (unsubscribeStaff) unsubscribeStaff();
        Object.values(saveTimeout).forEach(t => clearTimeout(t));
    });

    $: searchResults = allStaff.filter(s => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || (s.username && s.username.toLowerCase().includes(q));
    }).slice(0, 40);
</script>

<div class="w-full bg-slate-50 rounded-xl shadow-sm border border-amber-200 overflow-hidden flex flex-col h-full animate-fadeIn">
    
    <div class="p-2 sm:p-3 bg-white border-b border-amber-200 flex flex-row justify-between items-center gap-2 shrink-0">
        
        <div class="hidden sm:flex items-center gap-2 text-amber-600 shrink-0">
            <span class="material-icons-round text-2xl">campaign</span>
            <div>
                <h3 class="font-bold text-sm">Chiến dịch Roadshow / Tờ rơi</h3>
                <p class="text-[10px] opacity-80 text-slate-500">Quản lý nhân sự phát sinh ngắn hạn</p>
            </div>
        </div>

        <div class="flex items-center justify-between w-full sm:w-auto gap-2">
            {#if isAdmin}
                <div class="bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-100 flex items-center gap-1.5 shadow-sm shrink-0">
                    <div class="flex items-center gap-1">
                        <span class="hidden sm:inline text-[10px] font-bold text-amber-600 uppercase">Từ:</span>
                        <input type="date" bind:value={startDate} class="bg-transparent text-[11px] sm:text-xs font-bold text-slate-700 outline-none cursor-pointer">
                    </div>
                    <div class="text-amber-300 font-bold">-</div>
                    <div class="flex items-center gap-1">
                        <span class="hidden sm:inline text-[10px] font-bold text-amber-600 uppercase">Đến:</span>
                        <input type="date" bind:value={endDate} class="bg-transparent text-[11px] sm:text-xs font-bold text-slate-700 outline-none cursor-pointer">
                    </div>
                </div>
            
                <div class="flex items-center gap-1.5 shrink-0">
                    <button class="bg-red-500 hover:bg-red-600 text-white font-bold py-1.5 px-2.5 sm:px-3 rounded-lg text-xs shadow-sm shadow-red-200 transition-colors flex items-center gap-1" on:click={clearSchedule} disabled={loading || (roadshowDays.length === 0 && displayDays.length === 0)} title="Xóa toàn bộ lịch đang hiển thị">
                        {#if loading} 
                            <span class="material-icons-round text-[14px] animate-spin">sync</span>
                        {:else} 
                            <span class="material-icons-round text-[14px]">delete_sweep</span> 
                            <span class="hidden sm:inline">Xóa Lịch</span> 
                        {/if}
                    </button>

                    <button class="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-2.5 sm:px-3 rounded-lg text-xs shadow-sm shadow-amber-200 transition-colors flex items-center gap-1" on:click={autoGenerate} disabled={loading || roadshowDays.length === 0} title="Tự động sắp xếp từ bảng phân ca gốc">
                        {#if loading} 
                            <span class="material-icons-round text-[14px] animate-spin">sync</span>
                        {:else} 
                            <span class="material-icons-round text-[14px]">auto_awesome</span> 
                            <span class="hidden sm:inline">Tạo Lịch</span> 
                        {/if}
                    </button>
                </div>
            {/if}
        </div>
    </div>

    <div class="flex-1 overflow-x-auto overflow-y-hidden bg-slate-100/60 p-2 sm:p-4">
        {#if displayDays.length === 0}
            <div class="h-full w-full flex flex-col items-center justify-center opacity-60">
                <span class="material-icons-round text-5xl text-amber-300 mb-2">date_range</span>
                <p class="text-slate-500 font-bold">Chưa có lịch Roadshow.</p>
                {#if isAdmin}
                    <p class="text-[10px] sm:text-xs text-amber-600 mt-1">Vui lòng chọn Từ ngày - Đến ngày và bấm Tạo Lịch để bắt đầu.</p>
                {/if}
            </div>
        {:else}
            <div class="flex gap-2.5 sm:gap-4 h-full min-w-max items-start">
                {#each displayDays as d}
                    <div class="w-[280px] sm:w-[320px] flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 h-full max-h-full overflow-hidden shrink-0">
                        
                        <div class="p-2 sm:p-2.5 bg-amber-50/80 border-b border-amber-100 flex justify-between items-center shrink-0">
                            <span class="font-bold text-slate-800 text-xs sm:text-[13px]">{formatDate(d)}</span>
                            <div class="flex gap-1 text-[9px] sm:text-[10px] font-bold">
                                <span class="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 shadow-sm">🌞 {roadshowData[d]?.morning?.length || 0}</span>
                                <span class="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 shadow-sm">🌛 {roadshowData[d]?.afternoon?.length || 0}</span>
                            </div>
                        </div>

                        <div class="flex-1 overflow-y-auto p-1.5 sm:p-2 space-y-1.5 sm:space-y-2">
                            
                            <div class="bg-blue-50/40 rounded border border-blue-100 p-1 sm:p-1.5">
                                <div class="flex justify-between items-center mb-1 sm:mb-1.5 px-0.5">
                                    <div class="text-[9px] sm:text-[10px] font-black text-blue-700 flex items-center gap-1 uppercase tracking-wide">
                                        <span>🌞</span> CA SÁNG
                                    </div>
                                    {#if isAdmin}
                                        <button class="text-[9px] font-bold text-blue-600 bg-white hover:bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded shadow-sm transition-colors flex items-center gap-0.5" on:click={() => openSearchModal(d, 'morning')}>
                                            <span class="material-icons-round text-[11px]">add</span> Thêm
                                        </button>
                                    {/if}
                                </div>

                                <div class="flex flex-wrap gap-1 sm:gap-1.5">
                                    {#if (roadshowData[d]?.morning || []).length === 0}
                                        <div class="w-full text-[9px] sm:text-[10px] text-slate-400 italic text-center py-1.5 bg-white/50 rounded border border-dashed border-slate-200">Chưa có nhân sự</div>
                                    {:else}
                                        {#each (roadshowData[d]?.morning || []) as p}
                                            <div class="group relative flex items-center gap-1 {p.type==='pg' ? 'bg-pink-50/80 text-pink-700' : 'bg-white text-slate-700'} border {p.type==='pg' ? 'border-pink-200' : 'border-slate-200'} px-1.5 py-0.5 sm:py-1 rounded shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-[10px] sm:text-[11px] hover:border-slate-300 hover:shadow-sm w-auto max-w-full transition-all">
                                                <span class="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full {p.type==='pg' ? 'bg-pink-400' : 'bg-blue-400'} shrink-0"></span>
                                                <span class="font-semibold truncate tracking-tight">{p.displayName}</span>
                                                
                                                {#if isAdmin}
                                                    <button class="absolute -top-1.5 -right-1.5 bg-white rounded-full text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-slate-100 flex items-center justify-center z-10" on:click={() => removeUser(d, 'morning', p.id)} title="Xóa nhân sự">
                                                        <span class="material-icons-round text-[12px] block leading-none">cancel</span>
                                                    </button>
                                                {/if}
                                            </div>
                                        {/each}
                                    {/if}
                                </div>
                            </div>

                            <div class="bg-orange-50/40 rounded border border-orange-100 p-1 sm:p-1.5">
                                <div class="flex justify-between items-center mb-1 sm:mb-1.5 px-0.5">
                                    <div class="text-[9px] sm:text-[10px] font-black text-orange-700 flex items-center gap-1 uppercase tracking-wide">
                                        <span>🌛</span> CA CHIỀU
                                    </div>
                                    {#if isAdmin}
                                        <button class="text-[9px] font-bold text-orange-600 bg-white hover:bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded shadow-sm transition-colors flex items-center gap-0.5" on:click={() => openSearchModal(d, 'afternoon')}>
                                            <span class="material-icons-round text-[11px]">add</span> Thêm
                                        </button>
                                    {/if}
                                </div>

                                <div class="flex flex-wrap gap-1 sm:gap-1.5">
                                    {#if (roadshowData[d]?.afternoon || []).length === 0}
                                        <div class="w-full text-[9px] sm:text-[10px] text-slate-400 italic text-center py-1.5 bg-white/50 rounded border border-dashed border-slate-200">Chưa có nhân sự</div>
                                    {:else}
                                        {#each (roadshowData[d]?.afternoon || []) as p}
                                            <div class="group relative flex items-center gap-1 {p.type==='pg' ? 'bg-pink-50/80 text-pink-700' : 'bg-white text-slate-700'} border {p.type==='pg' ? 'border-pink-200' : 'border-slate-200'} px-1.5 py-0.5 sm:py-1 rounded shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-[10px] sm:text-[11px] hover:border-slate-300 hover:shadow-sm w-auto max-w-full transition-all">
                                                <span class="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full {p.type==='pg' ? 'bg-pink-400' : 'bg-orange-400'} shrink-0"></span>
                                                <span class="font-semibold truncate tracking-tight">{p.displayName}</span>
                                                
                                                {#if isAdmin}
                                                    <button class="absolute -top-1.5 -right-1.5 bg-white rounded-full text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-slate-100 flex items-center justify-center z-10" on:click={() => removeUser(d, 'afternoon', p.id)} title="Xóa nhân sự">
                                                        <span class="material-icons-round text-[12px] block leading-none">cancel</span>
                                                    </button>
                                                {/if}
                                            </div>
                                        {/each}
                                    {/if}
                                </div>
                            </div>

                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <div class="p-1.5 bg-slate-100 border-t flex justify-between items-center px-4 shrink-0 text-[9px] sm:text-[10px] font-bold">
        <span class="text-slate-500 truncate pr-2">Auto-save: Dữ liệu được lưu riêng lẻ từng ngày.</span>
        {#if isSaving}
            <span class="text-amber-500 animate-pulse flex items-center gap-1 shrink-0"><span class="material-icons-round text-[12px]">sync</span> <span class="hidden sm:inline">Đang lưu...</span></span>
        {:else}
            <span class="text-green-600 flex items-center gap-1 shrink-0"><span class="material-icons-round text-[12px]">cloud_done</span> <span class="hidden sm:inline">Đã đồng bộ</span></span>
        {/if}
    </div>
</div>

{#if showSearchModal}
    <div class="fixed inset-0 z-[70] bg-slate-900/60 flex items-start justify-center p-4 pt-10 backdrop-blur-sm" on:click={() => showSearchModal = false}>
        <div class="bg-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl animate-popIn flex flex-col max-h-[85vh]" on:click|stopPropagation>
            <div class="p-3 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center shrink-0">
                <h3 class="font-bold text-indigo-800 text-sm">Thêm nhân sự ca {targetSlot === 'morning' ? 'SÁNG' : 'CHIỀU'}</h3>
                <button class="text-slate-400 hover:text-red-500" on:click={() => showSearchModal = false}><span class="material-icons-round text-sm">close</span></button>
            </div>
            
            <div class="p-3 bg-white border-b shrink-0">
                <div class="relative">
                    <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                    <input type="text" bind:value={searchQuery} placeholder="Gõ tên để tìm nhanh..." class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" autofocus>
                </div>
            </div>
                
            <div class="overflow-y-auto p-2 space-y-1 flex-1 bg-slate-50">
                {#if searchResults.length === 0}
                    <div class="text-xs text-center text-red-400 py-6 font-bold">Không tìm thấy ai phù hợp</div>
                {:else}
                    {#each searchResults as user}
                        <button class="w-full text-left p-2.5 hover:bg-indigo-100 bg-white border border-slate-100 rounded-lg shadow-sm flex justify-between items-center group transition-colors" on:click={() => addUser(user)}>
                            <div>
                                <div class="font-bold text-slate-700 text-sm">{user.type === 'pg' ? user.username : user.name}</div>
                                {#if user.type === 'pg'}
                                    <div class="text-[9px] text-pink-500 font-bold uppercase mt-0.5 bg-pink-50 inline-block px-1.5 py-0.5 rounded border border-pink-100">Nhân sự PG</div>
                                {:else}
                                    <div class="text-[9px] text-blue-500 font-bold uppercase mt-0.5 bg-blue-50 inline-block px-1.5 py-0.5 rounded border border-blue-100">Nhân viên Nội bộ</div>
                                {/if}
                            </div>
                            <span class="material-icons-round text-indigo-400 opacity-0 group-hover:opacity-100 bg-white rounded-full">add_circle</span>
                        </button>
                    {/each}
                {/if}
            </div>
        </div>
    </div>
{/if}