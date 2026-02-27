<script>
    import { onMount } from 'svelte';
    import { db } from '../lib/firebase';
    import { doc, getDoc } from 'firebase/firestore';
    import { createEventDispatcher } from 'svelte';

    export let storeId;
    export let currentMonth; // 1-12
    export let currentYear;
    export let currentStats = []; // Dữ liệu của tháng hiện tại (để so sánh và sắp xếp)

    const dispatch = createEventDispatcher();
    let loading = true;
    let historyData = []; 
    let aggregatedStats = [];
    let sortField = 'default';
    let sortDirection = 'asc';

    $: if (storeId && currentMonth && currentYear) {
        loadHistory();
    }

    async function loadHistory() {
        const mBase = Number(currentMonth);
        const yBase = Number(currentYear);

        if (!storeId || !mBase || !yBase || isNaN(mBase) || isNaN(yBase)) {
            return;
        }

        loading = true;
        historyData = [];
        
        for (let i = 0; i < 3; i++) {
            let m = mBase - i;
            let y = yBase;
            
            if (m <= 0) { 
                m += 12;
                y -= 1;
            }
            
            const mStr = `${y}-${String(m).padStart(2,'0')}`;
            try {
                const docRef = doc(db, 'stores', storeId, 'schedules', mStr);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    // Đọc systemStats nguyên thủy. Nếu tháng cũ chưa có mới đọc stats
                    historyData.push({ month: `${m}/${y}`, data: data.systemStats || data.stats || [] });
                } else {
                    historyData.push({ month: `${m}/${y}`, data: [] });
                }
            } catch (e) {
                console.error("Lỗi lấy lịch sử:", e);
                historyData.push({ month: `${m}/${y}`, data: [] });
            }
        }
        
        processAggregatedData();
        loading = false;
    }

    function processAggregatedData() {
        const map = {};
        historyData.forEach((hObj, monthIndex) => {
            hObj.data.forEach(staff => {
                if (!map[staff.id]) {
                    map[staff.id] = {
                        staffId: staff.id,
                        name: staff.name,
                        gender: staff.gender || '',
                        total_hours: 0,
                        history: [null, null, null] // Tối đa 3 tháng
                    };
                }
                map[staff.id].total_hours += Number(staff.totalHours) || 0;
                map[staff.id].history[monthIndex] = {
                    gh: staff.gh || 0,
                    tn: staff.tn || 0,
                    kho: staff.kho || 0,
                    weekend: staff.weekendHardRoles || 0
                };
            });
        });
        
        currentStats.forEach(curr => {
            if (!map[curr.id]) {
                map[curr.id] = {
                    staffId: curr.id,
                    name: curr.name,
                    gender: curr.gender || '',
                    total_hours: 0,
                    history: [null, null, null]
                };
            }
        });

        // Tính toán trước tổng 3 tháng cho từng nhân viên để dễ Sort
        aggregatedStats = Object.values(map).map(staff => {
            const curr = currentStats.find(s => s.id === staff.staffId) || { gh: 0, tn: 0, kho: 0, weekendHardRoles: 0 };
            const past1 = staff.history[1] || { gh: 0, tn: 0, kho: 0, weekend: 0 };
            const past2 = staff.history[2] || { gh: 0, tn: 0, kho: 0, weekend: 0 };

            return {
                ...staff,
                totalGH: (curr.gh || 0) + (past1.gh || 0) + (past2.gh || 0),
                totalTN: (curr.tn || 0) + (past1.tn || 0) + (past2.tn || 0),
                totalKho: (curr.kho || 0) + (past1.kho || 0) + (past2.kho || 0),
                totalWeekend: (curr.weekendHardRoles || 0) + (past1.weekend || 0) + (past2.weekend || 0)
            };
        });
    }

    $: sortedData = [...aggregatedStats].sort((a, b) => {
        if (sortField === 'default') {
            const idxA = currentStats.findIndex(s => s.id === a.staffId);
            const idxB = currentStats.findIndex(s => s.id === b.staffId);
            const posA = idxA === -1 ? 999 : idxA;
            const posB = idxB === -1 ? 999 : idxB;
            return posA - posB;
        }

        let valA = a[sortField] || 0;
        let valB = b[sortField] || 0;
        
        if (sortField === 'total_hours') {
            valA = Number(a.total_hours) || 0;
            valB = Number(b.total_hours) || 0;
        }
        
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    function toggleSort(field) {
        if (sortField === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDirection = 'desc'; // Mặc định khi bấm vào các cột số là xếp giảm dần trước
        }
    }
</script>

<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh] overflow-hidden animate-popIn">
        
        <div class="flex items-center justify-between p-4 border-b bg-slate-50">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                    <span class="material-icons-round">history</span>
                </div>
                <div>
                    <h3 class="text-lg font-black text-slate-800">Lịch Sử Nghiệp Vụ (3 Tháng)</h3>
                    <p class="text-xs text-slate-500">Kiểm tra số lượng ca nghiệp vụ 3 tháng (Lịch do máy phân)</p>
                </div>
            </div>
            <button on:click={() => dispatch('close')} class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
                <span class="material-icons-round">close</span>
            </button>
        </div>

        <div class="p-4 flex flex-wrap gap-2 text-xs font-medium border-b bg-white">
            <button class="px-3 py-1.5 rounded-full border {sortField==='default'?'bg-slate-800 text-white border-slate-800':'bg-slate-50 text-slate-600 hover:bg-slate-100'}" on:click={() => {sortField='default'; sortDirection='asc'}}>
                Sắp xếp theo Bảng Phân Ca
            </button>
            <button class="px-3 py-1.5 rounded-full border {sortField==='total_hours'?'bg-indigo-100 text-indigo-700 border-indigo-200':'bg-slate-50 text-slate-600 hover:bg-slate-100'}" on:click={() => toggleSort('total_hours')}>
                Lọc theo Tổng Giờ {sortField==='total_hours'?(sortDirection==='desc'?'↓':'↑'):''}
            </button>
        </div>

        <div class="p-4 overflow-auto flex-1 bg-slate-50/50">
            {#if loading}
                <div class="flex flex-col items-center justify-center py-20 opacity-50">
                    <span class="material-icons-round text-4xl animate-spin text-indigo-400 mb-2">sync</span>
                    <p class="font-medium text-slate-500">Đang tổng hợp dữ liệu 3 tháng...</p>
                </div>
            {:else}
                <table class="w-full text-sm bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left border-collapse">
                    <thead>
                        <tr class="bg-slate-800 text-slate-200 text-xs">
                            <th class="p-3 font-bold border-r border-slate-700 w-48">Nhân viên</th>
                            
                            <th class="p-3 text-center border-r border-slate-700 bg-slate-700/80 cursor-pointer hover:bg-slate-600 transition-colors w-16" on:click={() => toggleSort('totalGH')}>
                                <div class="font-bold text-blue-300">Tổng GH</div>
                                <div class="text-[10px] font-normal text-slate-400 mt-0.5">{sortField === 'totalGH' ? (sortDirection === 'desc' ? '▼' : '▲') : '↕'}</div>
                            </th>
                            <th class="p-3 text-center border-r border-slate-700 bg-slate-700/80 cursor-pointer hover:bg-slate-600 transition-colors w-16" on:click={() => toggleSort('totalTN')}>
                                <div class="font-bold text-purple-300">Tổng TN</div>
                                <div class="text-[10px] font-normal text-slate-400 mt-0.5">{sortField === 'totalTN' ? (sortDirection === 'desc' ? '▼' : '▲') : '↕'}</div>
                            </th>
                            <th class="p-3 text-center border-r border-slate-700 bg-slate-700/80 cursor-pointer hover:bg-slate-600 transition-colors w-16" on:click={() => toggleSort('totalKho')}>
                                <div class="font-bold text-orange-300">Tổng KHO</div>
                                <div class="text-[10px] font-normal text-slate-400 mt-0.5">{sortField === 'totalKho' ? (sortDirection === 'desc' ? '▼' : '▲') : '↕'}</div>
                            </th>
                            <th class="p-3 text-center border-r border-slate-700 bg-slate-700/80 cursor-pointer hover:bg-slate-600 transition-colors w-16" on:click={() => toggleSort('totalWeekend')}>
                                <div class="font-bold text-red-300">Tổng CT</div>
                                <div class="text-[10px] font-normal text-slate-400 mt-0.5">{sortField === 'totalWeekend' ? (sortDirection === 'desc' ? '▼' : '▲') : '↕'}</div>
                            </th>

                            <th class="p-3 text-center border-r border-slate-700 bg-indigo-900/50">
                                <div class="font-bold text-indigo-200">Tháng này (Dự kiến)</div>
                                <div class="text-[10px] font-normal text-slate-400 mt-0.5">GH · TN · K · Cuối tuần</div>
                            </th>
                            
                            {#each historyData.slice(1) as m}
                                <th class="p-3 text-center border-r border-slate-700">
                                    <div class="font-bold">Tháng {m.month}</div>
                                    <div class="text-[10px] font-normal text-slate-400 mt-0.5">GH · TN · K · Cuối tuần</div>
                                </th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        {#each sortedData as staff, i}
                            {@const currStat = currentStats.find(s => s.id === staff.staffId) || { gh: 0, tn: 0, kho: 0, weekendHardRoles: 0 }}

                            <tr class="hover:bg-slate-50 transition-colors {sortField !== 'default' ? 'bg-slate-50/50' : ''}">
                                <td class="p-3 border-r border-slate-100 sticky left-0 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                    <div class="font-bold text-slate-700 flex items-center gap-2">
                                        <span class="text-[10px] text-slate-400 w-4 text-right">{i+1}.</span>
                                        {staff.name}
                                    </div>
                                    <div class="text-[10px] text-slate-400 ml-6 mt-0.5 uppercase tracking-wider">{staff.gender}</div>
                                </td>
                                
                                <td class="p-3 border-r border-slate-100 bg-amber-50/30 text-center">
                                    <span class="inline-block w-6 text-center {staff.totalGH>0?'text-blue-600 font-bold bg-amber-100 rounded':'text-slate-300'}">{staff.totalGH||'-'}</span>
                                </td>
                                <td class="p-3 border-r border-slate-100 bg-amber-50/30 text-center">
                                    <span class="inline-block w-6 text-center {staff.totalTN>0?'text-purple-600 font-bold bg-amber-100 rounded':'text-slate-300'}">{staff.totalTN||'-'}</span>
                                </td>
                                <td class="p-3 border-r border-slate-100 bg-amber-50/30 text-center">
                                    <span class="inline-block w-6 text-center {staff.totalKho>0?'text-orange-600 font-bold bg-amber-100 rounded':'text-slate-300'}">{staff.totalKho||'-'}</span>
                                </td>
                                <td class="p-3 border-r border-slate-100 bg-amber-50/30 text-center">
                                    <span class="inline-block w-6 text-center {staff.totalWeekend>0?'text-red-600 font-bold bg-amber-100 rounded':'text-slate-300'}">{staff.totalWeekend||'-'}</span>
                                </td>

                                <td class="p-3 border-r border-slate-100 bg-indigo-50/30">
                                    <div class="flex justify-center gap-2 text-xs">
                                        <span class="w-5 text-center {currStat.gh>0?'text-blue-600 font-bold bg-blue-100 rounded':'text-slate-300'}">{currStat.gh||'-'}</span>
                                        <span class="w-5 text-center {currStat.tn>0?'text-purple-600 font-bold bg-purple-100 rounded':'text-slate-300'}">{currStat.tn||'-'}</span>
                                        <span class="w-5 text-center {currStat.kho>0?'text-orange-600 font-bold bg-orange-100 rounded':'text-slate-300'}">{currStat.kho||'-'}</span>
                                        <span class="w-5 text-center {currStat.weekendHardRoles>0?'text-red-600 font-bold bg-red-100 rounded':'text-slate-300'}">{currStat.weekendHardRoles||'-'}</span>
                                    </div>
                                </td>

                                {#each staff.history.slice(1) as d}
                                    <td class="p-3 border-r border-slate-100">
                                        {#if !d}
                                            <div class="text-center text-slate-300 text-xs">-</div>
                                        {:else}
                                            <div class="flex justify-center gap-2 text-xs opacity-80">
                                                <span class="w-5 text-center {d.gh>0?'text-blue-600 font-bold':'text-slate-300'}">{d.gh||'-'}</span>
                                                <span class="w-5 text-center {d.tn>0?'text-purple-600 font-bold':'text-slate-300'}">{d.tn||'-'}</span>
                                                <span class="w-5 text-center {d.kho>0?'text-orange-600 font-bold':'text-slate-300'}">{d.kho||'-'}</span>
                                                <span class="w-5 text-center {d.weekend>0?'text-red-500 font-bold':'text-slate-300'}">{d.weekend||'-'}</span>
                                            </div>
                                        {/if}
                                    </td>
                                {/each}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {/if}
        </div>
    </div>
</div>

<style>
    .animate-popIn { animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes popIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
    
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>