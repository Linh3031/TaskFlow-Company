<script>
    import { onMount } from 'svelte';
    import { db } from '../lib/firebase';
    import { doc, getDoc } from 'firebase/firestore';
    import { createEventDispatcher } from 'svelte';

    export let storeId;
    export let currentMonth; // 1-12
    export let currentYear;
    export let currentStats = []; // Dữ liệu của tháng hiện tại (để so sánh)

    const dispatch = createEventDispatcher();
    let loading = true;
    let historyData = []; 
    let aggregatedStats = [];
    let sortField = 'total_hours';
    let sortDirection = 'desc';

    // Reactive statement: Chạy lại khi input thay đổi và có giá trị hợp lệ
    $: if (storeId && currentMonth && currentYear) {
        loadHistory();
    }

    async function loadHistory() {
        // 1. Kiểm tra an toàn dữ liệu đầu vào để tránh lỗi NaN/undefined
        const mBase = Number(currentMonth);
        const yBase = Number(currentYear);

        if (!storeId || !mBase || !yBase || isNaN(mBase) || isNaN(yBase)) {
            return; // Chưa đủ dữ liệu thì chưa chạy
        }

        loading = true;
        historyData = [];
        
        // 2. Vòng lặp lấy 3 tháng
        for (let i = 0; i < 3; i++) {
            let m = mBase - i;
            let y = yBase;
            
            if (m <= 0) { 
                m += 12; 
                y -= 1; 
            }

            const label = `T${m}/${y}`;
            const isCurrent = (i === 0);

            if (isCurrent) {
                historyData.push({
                    label: `${label} (Hiện tại)`,
                    stats: currentStats || [],
                    isCurrent: true
                });
            } else {
                try {
                    const docId = `${y}-${String(m).padStart(2, '0')}`;
                    const snap = await getDoc(doc(db, 'stores', storeId, 'schedules', docId));
                    if (snap.exists()) {
                        const data = snap.data();
                        historyData.push({
                            label: label,
                            stats: data.stats || [],
                            isCurrent: false
                        });
                    } else {
                        historyData.push({ label: label, stats: [], isCurrent: false });
                    }
                } catch (e) {
                    console.error("Lỗi tải lịch sử:", e);
                    historyData.push({ label: label, stats: [], isCurrent: false });
                }
            }
        }

        calculateAggregatedStats();
        loading = false;
    }

    function calculateAggregatedStats() {
        let map = {};

        historyData.forEach(monthItem => {
            monthItem.stats.forEach(s => {
                if (!map[s.id]) {
                    map[s.id] = {
                        id: s.id,
                        name: s.name,
                        gender: s.gender,
                        isMale: (s.gender || '').trim().toLowerCase() === 'nam',
                        details: {}, 
                        total: { hours: 0, gh: 0, tn: 0, kho: 0, weekend: 0 }
                    };
                }
                
                map[s.id].details[monthItem.label] = {
                    hours: s.totalHours || 0,
                    gh: s.gh || 0,
                    tn: s.tn || 0,
                    kho: s.kho || 0,
                    weekend: s.weekendHardRoles || 0 
                };

                map[s.id].total.hours += (s.totalHours || 0);
                map[s.id].total.gh += (s.gh || 0);
                map[s.id].total.tn += (s.tn || 0);
                map[s.id].total.kho += (s.kho || 0);
                map[s.id].total.weekend += (s.weekendHardRoles || 0);
            });
        });

        aggregatedStats = Object.values(map);
        handleSort(sortField); 
    }

    function handleSort(field) {
        if (sortField === field) {
            sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
        } else {
            sortField = field;
            sortDirection = 'desc';
        }

        aggregatedStats = aggregatedStats.sort((a, b) => {
            let valA = 0, valB = 0;
            
            if (field === 'name') {
                return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            
            switch(field) {
                case 'total_hours': valA = a.total.hours; valB = b.total.hours; break;
                case 'total_gh': valA = a.total.gh; valB = b.total.gh; break;
                case 'total_tn': valA = a.total.tn; valB = b.total.tn; break;
                case 'total_kho': valA = a.total.kho; valB = b.total.kho; break;
                case 'total_weekend': valA = a.total.weekend; valB = b.total.weekend; break;
            }

            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });
    }
</script>

<div class="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-[95%] xl:max-w-7xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-popIn" on:click|stopPropagation>
        <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
            <div>
                <h3 class="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <span class="material-icons-round text-indigo-600">history_edu</span> 
                    Lũy Kế 3 Tháng Gần Nhất
                </h3>
            </div>
            <button class="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors" on:click={() => dispatch('close')}>
                <span class="material-icons-round text-slate-500">close</span>
            </button>
        </div>

        <div class="flex-1 overflow-auto bg-white">
            {#if loading}
                <div class="h-64 flex flex-col items-center justify-center text-slate-400">
                    <span class="material-icons-round animate-spin text-3xl mb-2 text-indigo-300">sync</span>
                    <span class="text-sm font-bold">Đang tải dữ liệu...</span>
                </div>
            {:else}
                <table class="w-full text-sm text-left border-collapse">
                    <thead class="bg-slate-50 text-slate-600 sticky top-0 z-10 shadow-sm text-xs uppercase tracking-wider">
                        <tr>
                            <th class="p-3 border-b border-r font-bold cursor-pointer hover:bg-slate-100 bg-slate-50 sticky left-0 z-20 min-w-[150px]" on:click={() => handleSort('name')}>
                                Nhân Sự {sortField==='name'?(sortDirection==='asc'?'▲':'▼'):''}
                            </th>

                            <th class="p-2 border-b text-center bg-indigo-50 border-r border-indigo-100 text-indigo-800 font-bold cursor-pointer hover:bg-indigo-100 min-w-[60px]" on:click={() => handleSort('total_hours')}>
                                Tổng Giờ {sortField==='total_hours'?(sortDirection==='asc'?'▲':'▼'):''}
                            </th>
                            <th class="p-2 border-b text-center bg-blue-50 border-r border-blue-100 text-blue-700 font-bold cursor-pointer hover:bg-blue-100 min-w-[50px]" on:click={() => handleSort('total_gh')}>
                                T.GH {sortField==='total_gh'?(sortDirection==='asc'?'▲':'▼'):''}
                            </th>
                            <th class="p-2 border-b text-center bg-purple-50 border-r border-purple-100 text-purple-700 font-bold cursor-pointer hover:bg-purple-100 min-w-[50px]" on:click={() => handleSort('total_tn')}>
                                T.TN {sortField==='total_tn'?(sortDirection==='asc'?'▲':'▼'):''}
                            </th>
                            <th class="p-2 border-b text-center bg-orange-50 border-r border-orange-100 text-orange-700 font-bold cursor-pointer hover:bg-orange-100 min-w-[50px]" on:click={() => handleSort('total_kho')}>
                                T.Kho {sortField==='total_kho'?(sortDirection==='asc'?'▲':'▼'):''}
                            </th>
                            <th class="p-2 border-b text-center bg-red-50 border-r border-red-100 text-red-700 font-bold cursor-pointer hover:bg-red-100 min-w-[60px]" title="Tổng ca nghiệp vụ cuối tuần" on:click={() => handleSort('total_weekend')}>
                                T.CT {sortField==='total_weekend'?(sortDirection==='asc'?'▲':'▼'):''}
                            </th>

                            {#each historyData as month}
                                <th class="p-2 border-b border-r text-center min-w-[120px] bg-white text-slate-500">
                                    <div class="font-bold {month.isCurrent ? 'text-indigo-600' : ''}">{month.label}</div>
                                    <div class="flex justify-center gap-1 text-[9px] font-normal opacity-60 mt-1">
                                        GH · TN · K · CT
                                    </div>
                                </th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 text-xs">
                        {#each aggregatedStats as staff}
                            <tr class="hover:bg-slate-50 transition-colors">
                                <td class="p-3 font-bold border-r border-slate-100 sticky left-0 bg-white z-10 {staff.isMale ? 'text-blue-600' : 'text-pink-600'}">
                                    {staff.name}
                                </td>

                                <td class="p-2 text-center font-black text-indigo-900 bg-indigo-50/30 border-r border-indigo-50 text-sm">{Math.round(staff.total.hours)}</td>
                                <td class="p-2 text-center font-bold text-blue-700 bg-blue-50/30 border-r border-blue-50">{staff.total.gh}</td>
                                <td class="p-2 text-center font-bold text-purple-700 bg-purple-50/30 border-r border-purple-50">{staff.total.tn}</td>
                                <td class="p-2 text-center font-bold text-orange-700 bg-orange-50/30 border-r border-orange-50">{staff.total.kho}</td>
                                <td class="p-2 text-center font-bold text-red-600 bg-red-50/30 border-r border-red-50">{staff.total.weekend}</td>

                                {#each historyData as month}
                                    {@const d = staff.details[month.label] || { hours:0, gh:0, tn:0, kho:0, weekend:0 }}
                                    <td class="p-2 text-center border-r border-slate-100 {month.isCurrent ? 'bg-yellow-50/20' : ''}">
                                        <div class="mb-1 font-bold text-slate-800">{Math.round(d.hours)}h</div>
                                        <div class="flex justify-center gap-1.5 text-[10px] text-slate-400">
                                            <span class="{d.gh>0?'text-blue-600 font-bold':''}">{d.gh||'-'}</span>
                                            <span>·</span>
                                            <span class="{d.tn>0?'text-purple-600 font-bold':''}">{d.tn||'-'}</span>
                                            <span>·</span>
                                            <span class="{d.kho>0?'text-orange-600 font-bold':''}">{d.kho||'-'}</span>
                                            <span>·</span>
                                            <span class="{d.weekend>0?'text-red-500 font-bold':''}">{d.weekend||'-'}</span>
                                        </div>
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