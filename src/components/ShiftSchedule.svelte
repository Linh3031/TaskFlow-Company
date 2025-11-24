<script>
  import { onMount, tick } from 'svelte';
  import { db } from '../lib/firebase';
  import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
  import { currentUser } from '../lib/stores';
  import TourGuide from './TourGuide.svelte';

  export let activeTab;
  let scheduleData = null, loading = true, errorMsg = '';
  let viewMonth = new Date().getMonth() + 1;
  let viewYear = new Date().getFullYear();
  $: currentMonthStr = `${viewYear}-${String(viewMonth).padStart(2,'0')}`;
  
  let selectedStaff = null; 
  let editingShift = null;
  let showReportModal = false;
  let reportData = []; 
  let reportLoading = false;
  
  $: myStoreId = $currentUser?.storeIds?.[0];
  $: isAdmin = $currentUser?.role === 'admin' || $currentUser?.role === 'super_admin';

  // TOUR GUIDE
  let showScheduleTour = false;
  const scheduleTourKey = 'taskflow_shift_tour_v6_final'; 
  
  const scheduleSteps = [
      { target: '#sch-month-picker', title: '1. Chọn Thời Gian', content: 'Xem lại lịch sử hoặc tạo lịch tương lai.' },
      { target: '#sch-report-btn', title: '2. Báo Cáo 3 Tháng', content: 'So sánh giờ công tích lũy để kiểm tra độ công bằng.' },
      { target: '#sch-table-header', title: '3. Bảng Phân Ca', content: 'Theo dõi lịch làm việc chi tiết của toàn bộ nhân viên.' },
      { target: '#sch-stats-col', title: '4. Thống Kê Nhanh', content: 'Xem tổng giờ công và số ca (GH/TN/Kho) trong tháng hiện tại.' },
      { target: '#sch-first-staff', title: '5. Xem Lịch Cá Nhân', content: 'Bấm vào tên nhân viên để xem lịch riêng dạng tháng trên điện thoại.' },
      { 
          target: '#tour-target-cell', 
          title: '6. Chỉnh Sửa Ca', 
          content: 'Dành cho QUYỀN QUẢN LÝ: Bấm vào ô lịch này để đổi Ca làm việc hoặc cho nhân viên nghỉ (OFF).' 
      },
      { target: '#btn-help-schedule', title: 'Xem Lại', content: 'Bấm vào đây để xem lại hướng dẫn.' }
  ];

  async function loadSchedule() {
      if(!myStoreId) return;
      loading = true; errorMsg = '';
      try {
          const ref = doc(db, 'stores', myStoreId, 'schedules', currentMonthStr);
          onSnapshot(ref, (snap) => {
              loading = false;
              if(snap.exists()) {
                  const data = snap.data();
                  if (data && data.data && data.stats) scheduleData = data;
                  else { scheduleData = null; errorMsg = "Dữ liệu lỗi."; }
              } else scheduleData = null;
          });
      } catch (e) { loading = false; errorMsg = e.message; }
  }
  $: if(activeTab === 'schedule' && myStoreId && currentMonthStr) loadSchedule();
  
  onMount(() => {
      if (!localStorage.getItem(scheduleTourKey)) {
          setTimeout(() => showScheduleTour = true, 1500);
      }
  });

  async function loadComparisonReport() {
      if(!myStoreId) return;
      showReportModal = true;
      reportLoading = true;
      const months = [];
      for(let i=0; i<3; i++) {
          const d = new Date(viewYear, viewMonth - 1 - i, 1);
          const mStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          months.push({ id: mStr, label: `Tháng ${d.getMonth()+1}` });
      }
      months.reverse();
      let consolidated = {}; 
      for(let i=0; i<months.length; i++) {
          const m = months[i];
          try {
              const snap = await getDoc(doc(db, 'stores', myStoreId, 'schedules', m.id));
              if(snap.exists()) {
                  const data = snap.data();
                  data.stats.forEach(s => {
                      if(!consolidated[s.id]) consolidated[s.id] = { name: s.name, stats: [{},{},{}] };
                      consolidated[s.id].stats[i] = { gh: s.gh||0, tn: s.tn||0, kho: s.kho||0, hours: s.totalHours||0 };
                  });
              }
          } catch(e) { console.error(e); }
      }
      reportData = Object.values(consolidated).map(staff => {
          let total = { gh:0, tn:0, kho:0, hours:0 };
          staff.stats.forEach(s => { total.gh += s.gh||0; total.tn += s.tn||0; total.kho += s.kho||0; total.hours += s.hours||0; });
          return { ...staff, total };
      });
      reportLoading = false;
  }

  function getShiftColor(code) { if (code === 'OFF') return 'bg-red-600 text-yellow-300 font-bold border-red-700';
    const s = scheduleData?.config?.computed?.find(x => x.code === code); return s ? s.color : 'bg-gray-100';
  }
  function getWeekday(day) { const date = new Date(viewYear, viewMonth - 1, day);
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']; return days[date.getDay()]; }

  function viewPersonalSchedule(staffId, staffName) { if(!scheduleData?.data) return;
    let days = []; Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b)).forEach(d => { const assign = scheduleData.data[d].find(x => x.staffId === staffId); if(assign) days.push({ day: d, ...assign }); });
    const stat = scheduleData.stats.find(s => s.id === staffId) || { totalHours:0, gh:0, tn:0, kho:0 };
    selectedStaff = { id: staffId, name: staffName, days, stats: stat };
  }
  function openEditShift(day, staffId, assign) { if (!isAdmin) return;
    editingShift = { day, staffId, name: assign.name, currentCode: assign.shift, newCode: assign.shift, isOFF: assign.shift === 'OFF', isGH: assign.role === 'GH', isTN: assign.role === 'TN', isKho: assign.role === 'Kho' };
  }
  async function saveShiftChange() { if (!editingShift || !scheduleData) return; let finalCode = editingShift.isOFF ? 'OFF' : editingShift.newCode;
    let finalRole = ''; if (!editingShift.isOFF) { if (editingShift.isGH) finalRole = 'GH'; else if (editingShift.isTN) finalRole = 'TN';
    else if (editingShift.isKho) finalRole = 'Kho'; } const dayKey = String(editingShift.day); const dayList = scheduleData.data[dayKey];
    const idx = dayList.findIndex(x => x.staffId === editingShift.staffId); if (idx !== -1) { dayList[idx].shift = finalCode; dayList[idx].role = finalRole;
    const staffId = editingShift.staffId; let newStats = { gh: 0, tn: 0, kho: 0, totalHours: 0 };
    Object.values(scheduleData.data).forEach(dList => { const item = dList.find(x => x.staffId === staffId); if (item && item.shift !== 'OFF') { if (item.role === 'GH') newStats.gh++; if (item.role === 'TN') newStats.tn++; if (item.role === 'Kho') newStats.kho++; const sCfg = scheduleData.config.computed.find(c => c.code === item.shift); if (sCfg) newStats.totalHours += sCfg.hours; } });
    const statIdx = scheduleData.stats.findIndex(s => s.id === staffId); if (statIdx !== -1) scheduleData.stats[statIdx] = { ...scheduleData.stats[statIdx], ...newStats };
    try { await updateDoc(doc(db, 'stores', myStoreId, 'schedules', currentMonthStr), { [`data.${dayKey}`]: dayList, stats: scheduleData.stats }); editingShift = null;
    } catch (e) { alert(e.message); } } }
  function toggleRole(role) { if(role === 'GH') { editingShift.isTN = false;
    editingShift.isKho = false; } if(role === 'TN') { editingShift.isGH = false; editingShift.isKho = false;
    } if(role === 'Kho') { editingShift.isGH = false; editingShift.isTN = false; } }
  function startTour() { showScheduleTour = true; }
</script>

<div class="flex justify-between items-center mb-3 px-1">
    <div id="sch-month-picker" class="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
        <button class="p-1 hover:bg-gray-100 rounded" on:click={()=>{ if(viewMonth==1){viewMonth=12;viewYear--}else{viewMonth--} }} aria-label="Tháng trước"><span class="material-icons-round text-gray-500">chevron_left</span></button>
        <span class="font-bold text-indigo-700 px-2">Tháng {viewMonth}/{viewYear}</span>
        <button class="p-1 hover:bg-gray-100 rounded" on:click={()=>{ if(viewMonth==12){viewMonth=1;viewYear++}else{viewMonth++} }} aria-label="Tháng sau"><span class="material-icons-round text-gray-500">chevron_right</span></button>
    </div>
    <div class="flex gap-2">
        <button id="sch-report-btn" class="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-1 hover:bg-indigo-100 transition-colors" on:click={loadComparisonReport}>
            <span class="material-icons-round text-base">analytics</span> Báo Cáo 3 Tháng
        </button>
        <button id="btn-help-schedule" class="w-8 h-8 bg-white text-purple-600 rounded-lg border border-purple-200 flex items-center justify-center hover:bg-purple-50 transition-colors" on:click={startTour} aria-label="Hướng dẫn">
            <span class="material-icons-round text-sm">help</span>
        </button>
    </div>
</div>

{#if loading} <div class="p-10 text-center text-gray-400 animate-pulse">Đang tải dữ liệu lịch...</div>
{:else if errorMsg} <div class="p-10 text-center text-red-500">{errorMsg}</div>
{:else if !scheduleData} 
    <div class="p-10 text-center text-gray-400 flex flex-col items-center">
        <span class="material-icons-round text-6xl text-gray-200">calendar_off</span>
        <p class="mt-2">Chưa có lịch tháng {currentMonthStr}</p>
    </div>
{:else}
    <div id="sch-table-header" class="overflow-x-auto border rounded-xl bg-white shadow-sm max-h-[75vh] relative">
        <table class="w-full text-sm text-center border-collapse min-w-[1500px]">
            <thead class="bg-amber-400 text-slate-800 sticky top-0 z-20 shadow-md">
                <tr>
                    <th rowspan="2" class="p-2 sticky left-0 bg-white border-r border-amber-200 z-30 min-w-[180px] text-left pl-4 shadow">NHÂN VIÊN</th>
                    {#each Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b)) as d}
                        <th class="p-1 border-l border-amber-500/20 min-w-[45px] text-xs font-bold {['T7','CN'].includes(getWeekday(d))?'bg-amber-300':''}">{d}</th>
                    {/each}
                    <th rowspan="2" id="sch-stats-col" class="p-2 w-12 bg-amber-100 text-amber-900 text-xs border-l border-amber-300 font-bold">Giờ</th>
                    <th rowspan="2" class="p-2 w-12 bg-red-100 text-red-900 text-xs border-l border-amber-300 font-bold">GH</th>
                    <th rowspan="2" class="p-2 w-12 bg-purple-100 text-purple-900 text-xs border-l border-amber-300 font-bold">TN</th>
                    <th rowspan="2" class="p-2 w-12 bg-green-100 text-green-900 text-xs border-l border-amber-300 font-bold">Kho</th>
                </tr>
                <tr>
                    {#each Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b)) as d}
                        {@const wd = getWeekday(d)}
                        <th class="p-0.5 border-l border-amber-500/20 text-[10px] font-normal {['T7','CN'].includes(wd)?'bg-amber-300 text-amber-900 font-bold':'bg-amber-200/50'}">{wd}</th>
                    {/each}
                </tr>
            </thead>
            <tbody class="divide-y">
                {#each scheduleData.stats as staff, i}
                    <tr class="hover:bg-blue-50 transition-colors group">
                        <td id={i===0?'sch-first-staff':''} class="p-2 font-bold text-left sticky left-0 bg-white border-r z-10 text-indigo-700 cursor-pointer hover:underline shadow pl-4"
                            on:click={()=>viewPersonalSchedule(staff.id, staff.name)}>
                            {staff.name}
                        </td>
                        {#each Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b)) as d, j}
                            {@const assign = (scheduleData.data[d]||[]).find(x => x.staffId === staff.id)}
                            <td 
                                id={(i===0 && j===0) ? 'tour-target-cell' : ''}
                                class="p-1 border-l text-xs h-12 align-middle {isAdmin ? 'cursor-pointer hover:bg-gray-200' : ''}"
                                on:click={()=>openEditShift(d, staff.id, assign)}
                            >
                                {#if assign}
                                    <div class="rounded py-1.5 font-bold text-[11px] leading-tight shadow-sm transition-transform hover:scale-105 {getShiftColor(assign.shift)}">
                                        {assign.shift}
                                        {#if assign.role}<div class="flex justify-center mt-0.5"><span class="text-[9px] px-1.5 rounded-full bg-black/20 text-black font-extrabold uppercase">{assign.role}</span></div>{/if}
                                    </div>
                                {/if}
                            </td>
                        {/each}
                        <td class="p-2 font-mono font-bold bg-amber-50 text-gray-700 border-l">{staff.totalHours}</td>
                        <td class="p-2 font-mono font-bold bg-red-50 text-red-600 border-l">{staff.gh}</td>
                        <td class="p-2 font-mono font-bold bg-purple-50 text-purple-600 border-l">{staff.tn}</td>
                        <td class="p-2 font-mono font-bold bg-green-50 text-green-600 border-l">{staff.kho}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}

{#if showReportModal}
    <div class="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm" on:click={()=>showReportModal=false}>
        <div class="bg-white w-full max-w-6xl rounded-xl flex flex-col max-h-[90vh] overflow-hidden animate-slideUp shadow-2xl" on:click|stopPropagation>
            <div class="p-4 border-b flex justify-between items-center bg-indigo-50">
                <h3 class="text-lg font-bold text-indigo-800 flex items-center gap-2"><span class="material-icons-round">analytics</span> Báo Cáo Tích Lũy (Tính đến T{viewMonth}/{viewYear})</h3>
                <button on:click={()=>showReportModal=false} class="p-1 hover:bg-indigo-200 rounded" aria-label="Đóng"><span class="material-icons-round">close</span></button>
            </div>
            <div class="p-4 overflow-auto flex-1 bg-gray-50">
                {#if reportLoading} <div class="text-center py-10 text-gray-500 font-bold">Đang tổng hợp...</div>
                {:else}
                    <table class="w-full text-xs border-collapse text-center bg-white shadow-sm">
                        <thead>
                            <tr class="bg-gray-100 font-bold uppercase text-[10px]">
                                <th rowspan="2" class="p-2 border w-32 sticky left-0 bg-gray-100 text-left z-10">Nhân Viên</th>
                                <th colspan="4" class="p-2 border bg-blue-50 text-blue-800">Tháng T-2</th>
                                <th colspan="4" class="p-2 border bg-purple-50 text-purple-800">Tháng T-1</th>
                                <th colspan="4" class="p-2 border bg-orange-50 text-orange-800">Tháng T (Hiện tại)</th>
                                <th colspan="4" class="p-2 border bg-green-100 text-green-900 text-sm">TỔNG CỘNG</th>
                            </tr>
                            <tr class="font-bold text-[10px]">{#each Array(4) as _}<th class="p-1 border w-10">Giờ</th><th class="p-1 border w-8 text-red-600">GH</th><th class="p-1 border w-8 text-purple-600">TN</th><th class="p-1 border w-8 text-green-600">Kho</th>{/each}</tr>
                        </thead>
                        <tbody>
                            {#each reportData as r}
                                <tr class="hover:bg-gray-50">
                                    <td class="p-2 border font-bold text-left sticky left-0 bg-white text-indigo-700">{r.name}</td>
                                    <td class="p-1 border">{r.stats[0]?.hours||0}</td><td class="p-1 border">{r.stats[0]?.gh||0}</td><td class="p-1 border">{r.stats[0]?.tn||0}</td><td class="p-1 border">{r.stats[0]?.kho||0}</td>
                                    <td class="p-1 border">{r.stats[1]?.hours||0}</td><td class="p-1 border">{r.stats[1]?.gh||0}</td><td class="p-1 border">{r.stats[1]?.tn||0}</td><td class="p-1 border">{r.stats[1]?.kho||0}</td>
                                    <td class="p-1 border">{r.stats[2]?.hours||0}</td><td class="p-1 border">{r.stats[2]?.gh||0}</td><td class="p-1 border">{r.stats[2]?.tn||0}</td><td class="p-1 border">{r.stats[2]?.kho||0}</td>
                                    <td class="p-1 border bg-green-50 font-bold text-sm">{r.total.hours}</td><td class="p-1 border bg-green-50 font-bold text-red-600">{r.total.gh}</td><td class="p-1 border bg-green-50 font-bold text-purple-600">{r.total.tn}</td><td class="p-1 border bg-green-50 font-bold text-green-600">{r.total.kho}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {/if}
            </div>
        </div>
    </div>
{/if}

{#if selectedStaff}
    <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" on:click={()=>selectedStaff=null}>
        <div class="bg-white w-full max-w-md rounded-xl overflow-hidden animate-scaleIn shadow-2xl" on:click|stopPropagation>
            <div class="p-4 bg-indigo-600 text-white flex justify-between items-center">
                <div><h3 class="font-bold text-lg">{selectedStaff.name}</h3><p class="text-xs opacity-80">Giờ công: {selectedStaff.stats.totalHours}h</p></div>
                <button on:click={()=>selectedStaff=null} class="hover:bg-white/20 rounded-full p-1" aria-label="Đóng"><span class="material-icons-round">close</span></button>
            </div>
            <div class="p-4 bg-gray-50 grid grid-cols-7 gap-2">
                <div class="col-span-7 grid grid-cols-7 mb-2 text-center text-xs font-bold text-gray-400 uppercase"><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span class="text-red-500">CN</span></div>
                {#each selectedStaff.days as day}
                    <div class="relative aspect-square rounded-xl flex flex-col items-center justify-center shadow-sm transition-all border border-gray-100 overflow-hidden {getShiftColor(day.shift)}">
                        
                        <span class="absolute top-1 left-1.5 text-[10px] font-bold opacity-60 leading-none">{day.day}</span>
                        
                        <span class="font-bold text-sm sm:text-base drop-shadow-sm">{day.shift}</span>
                        
                        {#if day.role}
                            <span class="text-[8px] font-extrabold px-1.5 py-0.5 rounded mt-0.5 backdrop-blur-sm bg-white/30 shadow-sm">
                                {day.role}
                            </span>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    </div>
{/if}

{#if editingShift}
    <div class="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={()=>editingShift=null}>
        <div class="bg-white w-full max-w-sm rounded-xl p-5 animate-scaleIn shadow-2xl border border-gray-200" on:click|stopPropagation>
            <div class="flex justify-between items-start mb-4 border-b pb-2">
                <div><h3 class="text-lg font-bold text-gray-800">Sửa: {editingShift.name}</h3><p class="text-xs text-gray-500 font-bold">Ngày {editingShift.day}</p></div>
                <div class="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-500">Hiện tại: <span class="text-indigo-600">{editingShift.currentCode}</span></div>
            </div>
            
            <label for="shift-off-checkbox" class="flex items-center gap-3 p-3 border rounded-lg bg-red-50 cursor-pointer mb-4 hover:bg-red-100">
                <input id="shift-off-checkbox" type="checkbox" bind:checked={editingShift.isOFF} class="w-5 h-5 accent-red-600">
                <div class="flex flex-col"><span class="font-bold text-red-700 text-sm">Nhân viên Nghỉ (OFF)</span><span class="text-[10px] text-red-500">Chọn mục này nếu nhân viên nghỉ phép</span></div>
            </label>

            {#if !editingShift.isOFF}
                <div class="space-y-4">
                    <div>
                        <span class="block text-xs font-bold text-gray-500 uppercase mb-1">Ca Chỉnh Sửa</span>
                        <div class="grid grid-cols-3 gap-2">
                            {#each scheduleData.config.computed as s}
                                <button class="py-2 border rounded text-xs font-bold transition-all {editingShift.newCode===s.code ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 scale-105' : 'bg-white text-gray-600 hover:bg-gray-50'}" 
                                    on:click={()=>editingShift.newCode=s.code}>
                                    {s.code}
                                </button>
                            {/each}
                        </div>
                    </div>
                    <div>
                        <span class="block text-xs font-bold text-gray-500 uppercase mb-1">Vị trí</span>
                        <div class="flex flex-col gap-2">
                            <label for="role-gh" class="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                <input id="role-gh" type="checkbox" bind:checked={editingShift.isGH} on:change={()=>toggleRole('GH')} class="w-4 h-4 accent-red-600">
                                <span class="text-sm font-bold text-gray-700">Giao Hàng (GH)</span>
                            </label>
                            <label for="role-tn" class="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                <input id="role-tn" type="checkbox" bind:checked={editingShift.isTN} on:change={()=>toggleRole('TN')} class="w-4 h-4 accent-purple-600">
                                <span class="text-sm font-bold text-gray-700">Thu Ngân (TN)</span>
                            </label>
                            <label for="role-kho" class="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                <input id="role-kho" type="checkbox" bind:checked={editingShift.isKho} on:change={()=>toggleRole('Kho')} class="w-4 h-4 accent-green-600">
                                <span class="text-sm font-bold text-gray-700">Kho (Kho)</span>
                            </label>
                        </div>
                    </div>
                </div>
            {/if}
            <div class="flex gap-3 pt-4 mt-2 border-t">
                <button class="flex-1 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300" on:click={()=>editingShift=null}>Hủy Bỏ</button>
                <button class="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-transform active:scale-95" on:click={saveShiftChange}>Lưu Thay Đổi</button>
            </div>
        </div>
    </div>
{/if}

{#if showScheduleTour}
    <TourGuide steps={scheduleSteps} on:complete={() => { showScheduleTour = false; localStorage.setItem(scheduleTourKey, 'true'); }} />
{/if}

<style>
    .animate-scaleIn { animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .animate-slideUp { animation: slideUp 0.2s ease-out; }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>