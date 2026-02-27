<script>
    import { onMount, onDestroy } from 'svelte';
    import { db } from '../../lib/firebase';
    import { collection, query, where, getDocs, doc, setDoc, onSnapshot, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

    export let selectedViewStore;
    export let isAdmin = false;

    // --- LOGIC TÍNH NGÀY MẶC ĐỊNH ---
    function initDates() {
        const today = new Date();
        const start = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const threeDaysLater = new Date(today);
        threeDaysLater.setDate(today.getDate() + 2); // Chọn khoảng 3 ngày
        const end = `${threeDaysLater.getFullYear()}-${String(threeDaysLater.getMonth()+1).padStart(2,'0')}-${String(threeDaysLater.getDate()).padStart(2,'0')}`;
        return { start, end };
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

    // State cho Modal Search
    let showSearchModal = false;
    let targetDate = '';
    let targetSlot = ''; // 'morning' | 'afternoon'
    let searchQuery = '';

    // Lắng nghe sự thay đổi của khoảng ngày để tạo mảng các ngày
    $: {
        if (startDate && endDate && startDate <= endDate) {
            roadshowDays = getDatesInRange(startDate, endDate);
        } else {
            roadshowDays = [];
        }
    }

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

    // --- LOAD DỮ LIỆU ---
    onMount(async () => {
        if (selectedViewStore) {
            const q = query(collection(db, 'users'), where('storeIds', 'array-contains', selectedViewStore));
            const snap = await getDocs(q);
            allStaff = snap.docs.map(d => ({ 
                id: d.id, 
                name: d.data().name, 
                username: d.data().username,
                role: d.data().role,
                type: d.data().role === 'pg' ? 'pg' : 'nv'
            }));
        }
    });

    $: if (selectedViewStore && roadshowDays.length > 0) {
        loadRoadshowRange();
    }

    function loadRoadshowRange() {
        if (unsubscribe) unsubscribe();
        const q = query(collection(db, 'stores', selectedViewStore, 'roadshows'), 
                        where('date', '>=', startDate), 
                        where('date', '<=', endDate));
        
        unsubscribe = onSnapshot(q, (snap) => {
            let newData = {};
            // Khởi tạo khung rỗng cho tất cả các ngày trong mảng
            roadshowDays.forEach(d => newData[d] = { morning: [], afternoon: [] });
            // Ghi đè dữ liệu từ Cloud vào
            snap.forEach(doc => {
                newData[doc.id] = doc.data().data || { morning: [], afternoon: [] };
            });
            roadshowData = newData;
        });
    }

    // --- THUẬT TOÁN AUTO-GEN (TỰ ĐỘNG BỐC NGƯỜI CHO NHIỀU NGÀY) ---
    async function autoGenerate() {
        if (!isAdmin) return;
        if (!confirm('Hệ thống sẽ XÓA và TỰ ĐỘNG XẾP LẠI toàn bộ các ngày bạn đang chọn. Bạn chắc chắn chứ?')) return;

        loading = true;
        
        try {
            // Chuẩn bị các Tháng và Tuần cần fetch data (để không đọc database nhiều lần)
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

            // Xử lý mix data cho từng ngày
            for (let dStr of roadshowDays) {
                let dayObj = { morning: [], afternoon: [] };
                const d = new Date(dStr);
                const monthStr = dStr.substring(0, 7);
                const dayNumStr = String(d.getDate());
                const weekId = getWeekId(d);
                const weekdayStr = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];

                // Bóc tách Nhân Viên
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

                // Bóc tách PG
                const weekDataPG = pgSchedules[weekId] || {};
                Object.keys(weekDataPG).forEach(pgId => {
                    const shift = weekDataPG[pgId][weekdayStr];
                    const pgInfo = allStaff.find(s => s.id === pgId);
                    if (pgInfo) {
                        if (shift === 'Sáng') dayObj.afternoon.push({ id: pgId, displayName: pgInfo.username, type: 'pg' });
                        if (shift === 'Chiều') dayObj.morning.push({ id: pgId, displayName: pgInfo.username, type: 'pg' });
                    }
                });
                newRoadshowData[dStr] = dayObj;
            }

            // Ghi hàng loạt (Batch Write) lên Firebase
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
        // Kiểm tra xem đã có chưa
        if (roadshowData[targetDate][targetSlot].some(u => u.id === user.id)) {
            alert("Nhân sự này đã có trong danh sách!"); return;
        }
        
        roadshowData[targetDate][targetSlot].push({ 
            id: user.id, 
            displayName: user.type === 'pg' ? user.username : user.name, 
            type: user.type 
        });
        
        roadshowData = { ...roadshowData }; // Trigger Svelte Reactivity
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
        Object.values(saveTimeout).forEach(t => clearTimeout(t));
    });

    // --- RENDER HELPERS ---
    $: searchResults = allStaff.filter(s => {
        if (!searchQuery.trim()) return true; // TRẢ VỀ TOÀN BỘ NẾU KHÔNG GÕ GÌ
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || (s.username && s.username.toLowerCase().includes(q));
    }).slice(0, 40); // Lấy 40 người để list không quá dài
</script>

<div class="w-full bg-slate-50 rounded-xl shadow-sm border border-amber-200 overflow-hidden flex flex-col h-full animate-fadeIn">
    
    <div class="p-3 bg-white border-b border-amber-200 flex flex-wrap justify-between items-center gap-3 shrink-0">
        <div class="flex items-center gap-2 text-amber-600">
            <span class="material-icons-round text-2xl">campaign</span>
            <div>
                <h3 class="font-bold text-sm">Chiến dịch Roadshow / Tờ rơi</h3>
                <p class="text-[10px] opacity-80 text-slate-500">Quản lý nhân sự phát sinh ngắn hạn</p>
            </div>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
            <div class="bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-100 flex items-center gap-2 shadow-sm">
                <div class="flex items-center gap-1">
                    <span class="text-[10px] font-bold text-amber-600 uppercase">Từ:</span>
                    <input type="date" bind:value={startDate} class="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer">
                </div>
                <div class="w-px h-4 bg-amber-200"></div>
                <div class="flex items-center gap-1">
                    <span class="text-[10px] font-bold text-amber-600 uppercase">Đến:</span>
                    <input type="date" bind:value={endDate} class="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer">
                </div>
            </div>
            
            {#if isAdmin}
                <button class="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow-sm shadow-amber-200 transition-colors flex items-center gap-1" on:click={autoGenerate} disabled={loading || roadshowDays.length === 0}>
                    {#if loading} <span class="material-icons-round text-[14px] animate-spin">sync</span>
                    {:else} <span class="material-icons-round text-[14px]">auto_awesome</span> Tự Động Xếp Lịch {/if}
                </button>
            {/if}
        </div>
    </div>

    <div class="flex-1 overflow-auto relative bg-slate-100">
        {#if roadshowDays.length === 0}
            <div class="text-center p-10 flex flex-col items-center justify-center opacity-60">
                <span class="material-icons-round text-5xl text-amber-300 mb-2">date_range</span>
                <p class="text-slate-500 font-bold">Khoảng ngày không hợp lệ.</p>
                <p class="text-xs text-amber-600 mt-1">Vui lòng chọn ngày Bắt đầu nhỏ hơn hoặc bằng ngày Kết thúc.</p>
            </div>
        {:else}
            <table class="w-full text-left text-xs border-collapse bg-white relative">
                <thead class="bg-amber-100/50 text-slate-700 sticky top-0 z-20 shadow-sm border-b border-amber-200">
                    <tr>
                        <th class="p-2 border-r border-amber-200 w-[60px] min-w-[60px] sticky left-0 bg-amber-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-center text-[10px] font-black uppercase text-amber-800">
                            Buổi
                        </th>
                        {#each roadshowDays as d}
                            <th class="p-2 min-w-[140px] border-r border-amber-200 align-top">
                                <div class="font-bold text-sm text-slate-800 text-center">{formatDate(d)}</div>
                                <div class="flex justify-center gap-1.5 mt-1.5 text-[9px] font-bold">
                                    <span class="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 shadow-sm flex items-center gap-0.5">
                                        🌞: {roadshowData[d]?.morning?.length || 0}
                                    </span>
                                    <span class="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 shadow-sm flex items-center gap-0.5">
                                        🌛: {roadshowData[d]?.afternoon?.length || 0}
                                    </span>
                                </div>
                            </th>
                        {/each}
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    
                    <tr class="hover:bg-slate-50/50 transition-colors">
                        <td class="p-1 font-black text-blue-700 border-r border-amber-200 z-10 sticky left-0 bg-blue-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-center text-xs">
                            🌞<br>SÁNG
                        </td>
                        {#each roadshowDays as d}
                            <td class="p-1.5 border-r border-slate-200 align-top bg-white">
                                <div class="flex flex-wrap gap-1 mb-1">
                                    {#each roadshowData[d]?.morning || [] as p}
                                        <div class="inline-flex items-center gap-0.5 {p.type==='pg' ? 'bg-pink-50 border-pink-200 text-pink-700' : 'bg-slate-50 border-slate-200 text-slate-700'} border px-1 py-0.5 rounded text-[10px] shadow-sm font-semibold">
                                            <span class="opacity-70 font-black">{p.type==='pg'?'[PG]':'[NV]'}</span>
                                            <span>{p.displayName}</span>
                                            {#if isAdmin}
                                                <button class="text-red-300 hover:text-red-600 ml-0.5" on:click={() => removeUser(d, 'morning', p.id)}>
                                                    <span class="material-icons-round text-[10px]">close</span>
                                                </button>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                                {#if (roadshowData[d]?.morning || []).length === 0}
                                    <div class="text-[10px] text-slate-300 italic text-center py-2">Trống</div>
                                {/if}
                                {#if isAdmin}
                                    <button class="w-full py-1 mt-1 text-[9px] font-bold text-blue-500 bg-blue-50/50 border border-blue-100 border-dashed rounded hover:bg-blue-100 hover:border-blue-300 transition-colors flex items-center justify-center gap-0.5" on:click={() => openSearchModal(d, 'morning')}>
                                        <span class="material-icons-round text-[10px]">add</span> Thêm
                                    </button>
                                {/if}
                            </td>
                        {/each}
                    </tr>

                    <tr class="hover:bg-slate-50/50 transition-colors">
                        <td class="p-1 font-black text-orange-700 border-r border-amber-200 z-10 sticky left-0 bg-orange-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-center text-xs">
                            🌛<br>CHIỀU
                        </td>
                        {#each roadshowDays as d}
                            <td class="p-1.5 border-r border-slate-200 align-top bg-white">
                                <div class="flex flex-wrap gap-1 mb-1">
                                    {#each roadshowData[d]?.afternoon || [] as p}
                                        <div class="inline-flex items-center gap-0.5 {p.type==='pg' ? 'bg-pink-50 border-pink-200 text-pink-700' : 'bg-slate-50 border-slate-200 text-slate-700'} border px-1 py-0.5 rounded text-[10px] shadow-sm font-semibold">
                                            <span class="opacity-70 font-black">{p.type==='pg'?'[PG]':'[NV]'}</span>
                                            <span>{p.displayName}</span>
                                            {#if isAdmin}
                                                <button class="text-red-300 hover:text-red-600 ml-0.5" on:click={() => removeUser(d, 'afternoon', p.id)}>
                                                    <span class="material-icons-round text-[10px]">close</span>
                                                </button>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                                {#if (roadshowData[d]?.afternoon || []).length === 0}
                                    <div class="text-[10px] text-slate-300 italic text-center py-2">Trống</div>
                                {/if}
                                {#if isAdmin}
                                    <button class="w-full py-1 mt-1 text-[9px] font-bold text-orange-500 bg-orange-50/50 border border-orange-100 border-dashed rounded hover:bg-orange-100 hover:border-orange-300 transition-colors flex items-center justify-center gap-0.5" on:click={() => openSearchModal(d, 'afternoon')}>
                                        <span class="material-icons-round text-[10px]">add</span> Thêm
                                    </button>
                                {/if}
                            </td>
                        {/each}
                    </tr>

                </tbody>
            </table>
        {/if}
    </div>

    <div class="p-1.5 bg-slate-100 border-t flex justify-between items-center px-4 shrink-0 text-[10px] font-bold">
        <span class="text-slate-500">Auto-save: Dữ liệu được lưu riêng lẻ từng ngày.</span>
        {#if isSaving}
            <span class="text-amber-500 animate-pulse flex items-center gap-1"><span class="material-icons-round text-[12px]">sync</span> Đang lưu...</span>
        {:else}
            <span class="text-green-600 flex items-center gap-1"><span class="material-icons-round text-[12px]">cloud_done</span> Đã đồng bộ</span>
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