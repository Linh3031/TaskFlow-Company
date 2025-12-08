<script>
  // Version 39.0 - Added Mobile-Friendly Staff Details List
  import { onMount } from 'svelte';
  import { db } from '../lib/firebase';
  import { doc, onSnapshot, updateDoc, getDoc, setDoc } from 'firebase/firestore';
  import { currentUser } from '../lib/stores';
  import { utils, writeFile } from 'xlsx';
  import TourGuide from './TourGuide.svelte';

  export let activeTab;
  let scheduleData = null, loading = false, errorMsg = '';
  let viewMonth = new Date().getMonth() + 1;
  let viewYear = new Date().getFullYear();
  $: currentMonthStr = `${viewYear}-${String(viewMonth).padStart(2,'0')}`;
  
  let selectedStaff = null;
  let editingShift = null;
  let selectedDayStats = null;
  
  const QUICK_SHIFTS = ['OFF', '123', '456', '23', '45', '2345'];
  let tempEditingShift = null;
  $: myStores = $currentUser?.storeIds || [];
  $: isAdmin = $currentUser?.role === 'admin' || $currentUser?.role === 'super_admin';
  let selectedViewStore = '';
  $: if (myStores.length > 0 && !selectedViewStore) { selectedViewStore = myStores[0]; }

  let unsubscribe = () => {};
  $: if (activeTab === 'schedule' && selectedViewStore && currentMonthStr) { loadSchedule(currentMonthStr, selectedViewStore); }

  async function loadSchedule(monthStr, storeId) {
      scheduleData = null; loading = true;
      errorMsg = '';
      if (unsubscribe) unsubscribe();
      try {
          const ref = doc(db, 'stores', storeId, 'schedules', monthStr);
          unsubscribe = onSnapshot(ref, (snap) => {
              loading = false;
              if(snap.exists()) { scheduleData = snap.data(); } 
              else { scheduleData = null; }
          });
      } catch (e) { loading = false; errorMsg = e.message; }
  }

  // --- TÍNH NĂNG MỚI: KHÔI PHỤC LỊCH (CHỈ ADMIN) ---
  async function handleRestoreBackup() {
      if (!isAdmin) return;
      if (!confirm(`⚠️ CẢNH BÁO: Bạn muốn khôi phục lại phiên bản lịch CŨ của tháng ${viewMonth}/${viewYear}?\n\nDữ liệu hiện tại sẽ bị ghi đè!`)) return;
      loading = true;
      try {
          const backupRef = doc(db, 'stores', selectedViewStore, 'schedules', `${currentMonthStr}_backup`);
          const backupSnap = await getDoc(backupRef);

          if (!backupSnap.exists()) {
              alert("❌ Không tìm thấy bản sao lưu nào của tháng này.");
              loading = false;
              return;
          }

          // Ghi đè bản backup vào bản chính
          const mainRef = doc(db, 'stores', selectedViewStore, 'schedules', currentMonthStr);
          await setDoc(mainRef, backupSnap.data());

          alert("✅ Đã khôi phục thành công!");
      } catch (e) {
          alert("Lỗi: " + e.message);
      } finally {
          loading = false;
      }
  }
  // ------------------------------------------------

  function getShiftColor(code) {
      if (code === 'OFF') return 'bg-red-600 text-white border-red-700 font-black tracking-wider text-[10px] shadow-sm';
      const map = { '123': 'bg-green-50 text-green-700 border-green-100', '456': 'bg-orange-50 text-orange-700 border-orange-100', '23': 'bg-cyan-50 text-cyan-700 border-cyan-100', '45': 'bg-blue-50 text-blue-700 border-blue-100', '2-5': 'bg-pink-50 text-pink-700 border-pink-100', '2345': 'bg-red-50 text-red-700 border-red-100' };
      return map[code] || 'bg-white text-gray-800 border-gray-200';
  }

  function getRoleBadge(role) {
      if (!role || role === 'TV') return null;
      if (role === 'GH' || role === 'Giao Hàng') return { text: 'GH', class: 'bg-blue-600 text-white' };
      if (role === 'Thu Ngân' || role === 'TN') return { text: 'TN', class: 'bg-purple-600 text-white' };
      if (role === 'Kho') return { text: 'K', class: 'bg-orange-500 text-white' };
      return { text: role.charAt(0), class: 'bg-gray-500 text-white' };
  }

  function getWeekday(day) { const date = new Date(viewYear, viewMonth - 1, day);
  return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]; }
  
  function viewPersonalSchedule(staffId, staffName) { if(!scheduleData?.data) return;
  let days = []; Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b)).forEach(d => { const assign = scheduleData.data[d].find(x => x.staffId === staffId); if(assign) days.push({ day: d, weekday: getWeekday(d), ...assign }); });
  const firstDayDate = new Date(viewYear, viewMonth - 1, 1); let startDayIdx = firstDayDate.getDay(); if (startDayIdx === 0) startDayIdx = 6;
  else startDayIdx = startDayIdx - 1; let blankCells = Array(startDayIdx).fill(null); const stat = scheduleData.stats.find(s => s.id === staffId) ||
  { totalHours:0, gh:0, tn:0, kho:0 }; selectedStaff = { id: staffId, name: staffName, days, blankCells, stats: stat };
  }
  
  function openEditShift(day, staffId, assign) { if (!isAdmin) return; const staffInfo = scheduleData.stats.find(s => s.id === staffId);
  tempEditingShift = { day, staffId, name: assign.name, shift: assign.shift, role: assign.role || 'TV', isOFF: assign.shift === 'OFF', gender: staffInfo ?
  staffInfo.gender : 'Nữ', originalRole: assign.originalRole !== undefined ? assign.originalRole : (assign.role || 'TV'), originalShift: assign.originalShift !== undefined ?
  assign.originalShift : assign.shift }; editingShift = JSON.parse(JSON.stringify(tempEditingShift)); }
  function resetEditShift() { if (!editingShift) return; editingShift.shift = editingShift.originalShift;
  editingShift.role = editingShift.originalRole; editingShift.isOFF = editingShift.shift === 'OFF'; }
  
  async function saveShiftChange() { if (!editingShift || !scheduleData) return;
  if (editingShift.role === 'GH' && editingShift.gender !== 'Nam') { if (!confirm(`⚠️ CẢNH BÁO: Nhân viên ${editingShift.name} là NỮ.\nVị trí Giao Hàng thường yêu cầu NAM.\n\nBạn có chắc chắn muốn gán không?`)) return;
  } const approvedCombos = scheduleData.config?.approvedCombos || []; if (approvedCombos.length > 0 && !editingShift.isOFF) { const dayKey = String(editingShift.day);
  const currentDayAssignments = scheduleData.data[dayKey]; let targetRoleCode = 'TV'; if (editingShift.role === 'GH') targetRoleCode = 'GH';
  else if (editingShift.role === 'Thu Ngân') targetRoleCode = 'TN'; else if (editingShift.role === 'Kho') targetRoleCode = 'Kho';
  const comboConfig = approvedCombos.find(c => { let cRole = c.role || 'TV'; if (cRole === 'Thu Ngân') cRole = 'TN'; return c.code === editingShift.shift && cRole === targetRoleCode; });
  const quota = comboConfig ? (parseInt(comboConfig.qty) || 0) : 0;
  const currentCount = currentDayAssignments.filter(a => { if (a.staffId === editingShift.staffId) return false; let r = a.role || 'TV'; if (r === 'Giao Hàng') r = 'GH'; if (r === 'Thu Ngân') r = 'TN'; if (r === 'Kho') r = 'Kho'; return a.shift === editingShift.shift && r === targetRoleCode; }).length;
  if (currentCount + 1 > quota) { const msg = quota === 0 ?
  `⛔ CẢNH BÁO: Combo [${editingShift.shift} - ${targetRoleCode}] KHÔNG CÓ trong bảng định mức!\n(Quota = 0)\n\nBạn có muốn ép buộc gán không?` : `⚠️ CẢNH BÁO VƯỢT ĐỊNH MỨC:\n\nCombo [${editingShift.shift} - ${targetRoleCode}] quy định: ${quota}.\nHiện tại: ${currentCount}.\nThêm mới thành: ${currentCount + 1}.\n\nTiếp tục?`;
  if (!confirm(msg)) return; } } const dayKey = String(editingShift.day); const dayList = [...scheduleData.data[dayKey]];
  const idx = dayList.findIndex(x => x.staffId === editingShift.staffId); if (idx !== -1) { const oldRole = dayList[idx].role || 'TV';
  const newRole = editingShift.isOFF ? '' : (editingShift.role === 'TV' ? '' : editingShift.role);
  const updatedAssignment = { ...dayList[idx], shift: editingShift.isOFF ? 'OFF' : editingShift.shift, role: newRole }; dayList[idx] = updatedAssignment;
  const newStats = [...scheduleData.stats]; const statIdx = newStats.findIndex(s => s.id === editingShift.staffId);
  if (statIdx !== -1) { const s = newStats[statIdx]; let rOld = oldRole === 'Giao Hàng' ?
  'gh' : (oldRole === 'Thu Ngân' ? 'tn' : (oldRole === 'Kho' ? 'kho' : ''));
  if(rOld) s[rOld] = Math.max(0, (s[rOld]||0) - 1); let rNew = newRole === 'Giao Hàng' ?
  'gh' : (newRole === 'Thu Ngân' ? 'tn' : (newRole === 'Kho' ? 'kho' : ''));
  if(rNew) s[rNew] = (s[rNew]||0) + 1; } try { await updateDoc(doc(db, 'stores', selectedViewStore, 'schedules', currentMonthStr), { [`data.${dayKey}`]: dayList, stats: newStats });
  editingShift = null; } catch (e) { alert("Lỗi: " + e.message);
  } } }
  
  function showDayStats(day) { 
      if (!scheduleData || !scheduleData.data[day]) return; 
      const dayData = scheduleData.data[day];

      // 1. Logic cũ: Ma trận số lượng
      const roles = ['Kho', 'Thu Ngân', 'GH', 'TV']; 
      const matrix = { 'Kho': {}, 'Thu Ngân': {}, 'GH': {}, 'TV': {} };
      const activeShifts = new Set(); 
      dayData.forEach(assign => { if (assign.shift !== 'OFF') activeShifts.add(assign.shift); }); 
      const cols = Array.from(activeShifts).sort();
      roles.forEach(r => { cols.forEach(c => matrix[r][c] = 0); matrix[r]['Total'] = 0; });
      
      dayData.forEach(assign => { 
          if (assign.shift === 'OFF') return; 
          let r = assign.role || 'TV'; 
          if (r === 'TN') r = 'Thu Ngân'; 
          if (matrix[r]) { 
              matrix[r][assign.shift] = (matrix[r][assign.shift] || 0) + 1; 
              matrix[r]['Total']++; 
          } 
      });

      // 2. Logic Mới: Chi tiết tên nhân sự
      const targetRoles = ['Kho', 'Thu Ngân', 'GH']; 
      const details = { 'Kho': {}, 'Thu Ngân': {}, 'GH': {} };

      dayData.forEach(assign => {
          if (assign.shift === 'OFF') return;
          
          let r = assign.role || 'TV';
          if (r === 'TN') r = 'Thu Ngân';
          if (r === 'K') r = 'Kho';
          if (r === 'Giao Hàng') r = 'GH';

          if (targetRoles.includes(r)) {
              if (!details[r][assign.shift]) details[r][assign.shift] = [];
              details[r][assign.shift].push(assign.name);
          }
      });

      selectedDayStats = { day, weekday: getWeekday(day), cols, matrix, roles, details }; 
  }

  function getDayColTotal(col) { return selectedDayStats ?
  selectedDayStats.roles.reduce((sum, r) => sum + (selectedDayStats.matrix[r][col]||0), 0) : 0; }
  function getDayGrandTotal() { return selectedDayStats ?
  selectedDayStats.roles.reduce((sum, r) => sum + selectedDayStats.matrix[r]['Total'], 0) : 0; }

  function getWeekendHardRoleCount(staffId) {
      if (!scheduleData || !scheduleData.data) return 0;
      let count = 0;
      const isHardRole = (r) => ['Kho', 'Thu Ngân', 'Giao Hàng', 'GH', 'TN', 'K'].includes(r);
      const isWeekend = (d) => { const date = new Date(viewYear, viewMonth - 1, d); const day = date.getDay();
      return day === 0 || day === 6; };
      Object.keys(scheduleData.data).forEach(d => {
          if (isWeekend(d)) {
              const assign = scheduleData.data[d].find(a => a.staffId === staffId);
              if (assign && isHardRole(assign.role)) count++;
          }
      });
      return count;
  }

  function exportToExcel() {
      if (!scheduleData) return;
      const wb = utils.book_new();
      const days = Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b));
      const wsData = [];
      const row1 = ["NHÂN SỰ"];
      days.forEach(d => row1.push(d));
      row1.push("Tổng Giờ", "GH", "TN", "K", "Ca cuối tuần"); 
      wsData.push(row1);
      const row2 = [""];
      days.forEach(d => row2.push(getWeekday(d)));
      row2.push("", "", "", "", "");
      wsData.push(row2);
      scheduleData.stats.forEach(staff => {
          const row = [staff.name];
          days.forEach(d => {
              const assign = scheduleData.data[d].find(x => x.staffId === staff.id);
              if (assign) {
                  let cell = assign.shift;
                  if (assign.role && assign.role !== 'TV') cell += ` (${assign.role})`;
                  row.push(cell);
              } else { row.push(""); }
          });
          row.push(Math.round(staff.totalHours), staff.gh, staff.tn, staff.kho, getWeekendHardRoleCount(staff.id));
          wsData.push(row);
      });
      const ws = utils.aoa_to_sheet(wsData);
      utils.book_append_sheet(wb, ws, `Lich_T${viewMonth}`);
      writeFile(wb, `Lich_Lam_Viec_Kho_${selectedViewStore}_T${viewMonth}_${viewYear}.xlsx`);
  }
  
  let showScheduleTour = false;
  const scheduleSteps = [ { target: '.overflow-x-auto', title: '1. Bảng Lịch Tổng', content: 'Đây là toàn bộ lịch làm việc trong tháng.'
  }, { target: '#store-view-selector', title: '2. Chọn Kho Xem', content: 'Nếu quản lý nhiều kho, hãy chọn kho tại đây để xem lịch tương ứng.'
  }, { target: '#tour-staff-name', title: '3. Xem Chi Tiết Cá Nhân', content: 'Bấm vào <b>Tên Nhân Viên</b> để mở popup xem lịch riêng.'
  }, { target: '#tour-total-col', title: '4. Cột Tổng Kết', content: 'Kéo về cuối bảng để xem tổng giờ công.', action: () => { const tableContainer = document.querySelector('.overflow-x-auto');
  if(tableContainer) tableContainer.scrollLeft = tableContainer.scrollWidth; } } ];
</script>

<div class="flex items-center justify-between mb-3 px-1">
    <div class="flex items-center gap-2">
        {#if myStores.length > 1}
            <div id="store-view-selector" class="relative">
                <select bind:value={selectedViewStore} class="pl-3 pr-8 py-1.5 bg-white border border-gray-200 text-indigo-700 font-bold rounded-lg text-sm outline-none appearance-none cursor-pointer shadow-sm hover:border-indigo-300 transition-colors">
                    {#each myStores as s}<option value={s}>Kho {s}</option>{/each}
                </select>
                <span class="material-icons-round absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 text-sm pointer-events-none">expand_more</span>
            </div>
        {:else}
            <span class="font-bold text-gray-500 text-sm bg-gray-100 px-2 py-1 rounded">Kho {selectedViewStore}</span>
        {/if}

        <div class="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
            <button class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded" on:click={()=>{ if(viewMonth==1){viewMonth=12;viewYear--}else{viewMonth--} }}><span class="material-icons-round text-gray-500">chevron_left</span></button>
            <span class="font-bold text-indigo-700 px-2 min-w-[90px] text-center text-sm">T{viewMonth}/{viewYear}</span>
            <button class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded" on:click={()=>{ if(viewMonth==12){viewMonth=1;viewYear++}else{viewMonth++} }}><span class="material-icons-round text-gray-500">chevron_right</span></button>
        </div>
    </div>
    
    {#if scheduleData}
        <div class="flex gap-2">
            {#if isAdmin}
                <button class="flex items-center gap-2 bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-xs shadow hover:bg-slate-300 transition-all" on:click={handleRestoreBackup} title="Hoàn tác về phiên bản trước khi áp dụng">
                    <span class="material-icons-round text-sm">history</span> Khôi Phục
                </button>
             {/if}

            <button class="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow hover:bg-green-700 transition-all" on:click={exportToExcel}>
                <span class="material-icons-round text-sm">download</span> Xuất Excel
            </button>
            <button class="flex items-center justify-center bg-purple-500 text-white w-8 h-8 rounded-lg shadow hover:bg-purple-600 transition-all" on:click={() => showScheduleTour = true} title="Hướng dẫn xem lịch">
                 <span class="material-icons-round text-lg">help_outline</span>
            </button>
        </div>
    {/if}
</div>

{#if loading} 
    <div class="p-10 text-center text-gray-400 animate-pulse bg-white rounded-xl border border-dashed flex flex-col items-center">
        <span class="material-icons-round text-4xl animate-spin text-indigo-300">sync</span>
        <p class="mt-2 text-sm font-bold">Đang tải lịch tháng {viewMonth}...</p>
    </div>
{:else if !scheduleData} 
    <div class="p-10 text-center text-gray-400 bg-white rounded-xl border border-dashed flex flex-col items-center">
        <span class="material-icons-round text-4xl text-gray-300">calendar_today</span>
        <p class="mt-2 text-sm">Chưa có lịch làm việc tháng {viewMonth}/{viewYear}.</p>
        {#if isAdmin}
            <p class="text-xs text-indigo-500 mt-1">Vui lòng vào mục "Quản trị" để tạo.</p>
        {/if}
    </div>
{:else}
    <div class="overflow-x-auto border rounded-xl bg-white shadow-sm max-h-[75vh] relative scroll-smooth">
        <table class="w-full text-sm text-center border-collapse min-w-[1500px]">
            <thead class="bg-amber-400 text-slate-900 sticky top-0 z-30 shadow-md">
                <tr>
                    <th rowspan="2" class="p-2 sticky left-0 bg-white border-r border-amber-200 z-40 min-w-[140px] text-left pl-3 shadow">NHÂN SỰ</th>
                    {#each Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b)) as d}
                         <th class="p-1 border-l border-amber-500/30 min-w-[40px] text-xs font-black cursor-pointer hover:bg-amber-500 transition-colors select-none {['T7','CN'].includes(getWeekday(d)) ? 'bg-amber-300' : ''}" on:click={()=>showDayStats(d)}>{d}</th>
                    {/each}
                    <th rowspan="2" class="p-2 w-12 bg-amber-100 text-[10px] border-l border-amber-300 font-bold">Giờ</th>
                    <th rowspan="2" class="p-2 w-10 bg-blue-100 text-[10px] border-l border-amber-300 font-bold text-blue-800">GH</th>
                    <th rowspan="2" class="p-2 w-10 bg-purple-100 text-[10px] border-l border-amber-300 font-bold text-purple-800">TN</th>
                    <th rowspan="2" class="p-2 w-10 bg-orange-100 text-[10px] border-l border-amber-300 font-bold text-orange-800">K</th>
                    <th rowspan="2" class="p-2 w-14 bg-indigo-100 text-[10px] border-l border-amber-300 font-bold text-indigo-800" title="Số ca nghiệp vụ T7/CN">Ca<br>cuối tuần</th>
                </tr>
                 <tr>
                    {#each Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b)) as d}
                        <th class="p-0.5 border-l border-amber-500/30 text-[9px] {['T7','CN'].includes(getWeekday(d))?'bg-amber-300/80 text-amber-900':'bg-amber-200/50 text-slate-700'}">{getWeekday(d)}</th>
                    {/each}
                </tr>
             </thead>
            <tbody class="divide-y text-xs">
                {#each scheduleData.stats as staff, i}
                    {@const weCount = getWeekendHardRoleCount(staff.id)}
                    <tr class="hover:bg-blue-50 transition-colors">
                        <td id={i===0 ? 'tour-staff-name' : ''} class="p-2 font-bold text-left sticky left-0 bg-white border-r z-20 cursor-pointer hover:text-indigo-600 shadow pl-3 truncate max-w-[140px] {staff.gender==='Nam'?'text-blue-700':'text-pink-600'}" on:click={() => viewPersonalSchedule(staff.id, staff.name)}>
                            {staff.name}
                        </td>
                        {#each Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b)) as d}
                            {@const assign = (scheduleData.data[d]||[]).find(x => x.staffId === staff.id)}
                              <td class="p-0.5 border-l border-gray-100 h-10 align-middle {isAdmin ? 'cursor-pointer hover:bg-gray-100' : ''} {['T7','CN'].includes(getWeekday(d)) ? 'bg-amber-50/50' : ''}" on:click={() => openEditShift(d, staff.id, assign)}>
                                   {#if assign}
                                    {@const badge = getRoleBadge(assign.role)}
                                     <div class="w-full h-full rounded py-1 font-bold text-[10px] flex flex-col items-center justify-center shadow-sm {getShiftColor(assign.shift)}">
                                        <span>{assign.shift}</span>
                                         {#if badge}<span class="text-[8px] leading-none px-1 py-0.5 rounded mt-0.5 {badge.class}">{badge.text}</span>{/if}
                                     </div>
                                {:else}<div class="text-gray-200">.</div>{/if}
                              </td>
                        {/each}
                        <td class="p-2 font-bold text-center bg-amber-50 text-gray-700 border-l">{Math.round(staff.totalHours) || 0}</td>
                        <td class="p-2 font-bold text-center bg-blue-50 text-blue-600 border-l">{staff.gh || '-'}</td>
                        <td class="p-2 font-bold text-center bg-purple-50 text-purple-600 border-l">{staff.tn || 0}</td>
                        <td id={i===0 ? 'tour-total-col' : ''} class="p-2 font-bold text-center bg-orange-50 text-orange-600 border-l">{staff.kho || 0}</td>
                        <td class="p-2 font-bold text-center bg-indigo-50 text-indigo-700 border-l">{weCount}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}

{#if selectedStaff}
    <div class="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={()=>selectedStaff=null}>
        <div class="bg-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" on:click|stopPropagation>
            <div class="p-4 bg-indigo-500 text-white shrink-0">
                <h3 class="font-bold text-lg">{selectedStaff.name}</h3>
                <div class="flex justify-between mt-2 text-xs font-bold bg-indigo-600/50 p-2 rounded">
                   <span>{Math.round(selectedStaff.stats.totalHours) || 0} Giờ</span>
                    <span class="text-blue-100">GH: {selectedStaff.stats.gh || 0}</span>
                    <span class="text-purple-100">TN: {selectedStaff.stats.tn || 0}</span>
                    <span class="text-orange-100">K: {selectedStaff.stats.kho || 0}</span>
                </div>
            </div>
            <div class="flex-1 overflow-y-auto p-3 bg-slate-100">
                <div class="grid grid-cols-7 gap-1 mb-1 text-center text-[10px] font-bold text-gray-400 uppercase">
                    {#each ['T2','T3','T4','T5','T6','T7','CN'] as day}<div>{day}</div>{/each}
                </div>
                <div class="grid grid-cols-7 gap-1">
                    {#each selectedStaff.blankCells as _}<div class="bg-transparent"></div>{/each}
                    {#each selectedStaff.days as d}
                        <div class="bg-white rounded border shadow-sm p-1 flex flex-col items-center justify-center aspect-square {d.shift==='OFF'?'opacity-60 bg-slate-100':''}">
                            <div class="text-[10px] text-gray-400 font-bold mb-1">{d.day}</div>
                            <div class="font-black text-slate-800 text-xs {d.shift==='OFF'?'text-slate-400':''}">{d.shift}</div>
                             {#if d.shift !== 'OFF'}
                                {@const badge = getRoleBadge(d.role)}
                                {#if badge}<span class="text-[9px] font-bold px-1 rounded mt-0.5 leading-tight {badge.class}">{badge.text}</span>{/if}
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
            <div class="p-3 border-t bg-white text-center"><button class="w-full py-2 bg-gray-100 rounded text-gray-600 font-bold text-sm" on:click={()=>selectedStaff=null}>Đóng</button></div>
        </div>
    </div>
{/if}

{#if editingShift}
    <div class="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={()=>editingShift=null}>
        <div class="bg-white w-full max-w-sm rounded-xl p-5 shadow-2xl" on:click|stopPropagation>
            <div class="flex justify-between items-start mb-4">
                <div><h3 class="font-bold text-lg text-slate-800">Sửa Ca: {editingShift.name}</h3><p class="text-xs text-gray-500">Ngày {editingShift.day} - Hiện tại: <span class="font-bold">{tempEditingShift.shift}</span></p></div>
                 {#if editingShift.shift !== editingShift.originalShift || editingShift.role !== editingShift.originalRole}
                    <button class="text-xs text-red-600 hover:underline font-bold bg-red-50 px-2 py-1 rounded" on:click={resetEditShift}>Reset về gốc</button>
                {/if}
            </div>
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-2">Chọn Ca Nhanh</label>
                    <div class="grid grid-cols-3 gap-2 mb-2">
                        {#each QUICK_SHIFTS as s}
                            <button class="py-2 border rounded-lg font-bold text-xs transition-all shadow-sm {editingShift.isOFF && s==='OFF' ? 'bg-red-600 text-yellow-300 border-red-600 ring-2 ring-red-200' : (!editingShift.isOFF && editingShift.shift === s ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200' : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200')}" on:click={() => { if(s === 'OFF') { editingShift.isOFF = true; editingShift.shift = 'OFF'; } else { editingShift.isOFF = false; editingShift.shift = s; } }}>{s}</button>
                        {/each}
                    </div>
                     <label class="block text-xs font-bold text-gray-500 mb-1 mt-3">Ca Tùy Chỉnh</label>
                    <input type="text" value={editingShift.isOFF ? 'OFF' : editingShift.shift} on:input={(e) => { if(!editingShift.isOFF) editingShift.shift = e.target.value; }} disabled={editingShift.isOFF} class="w-full p-2.5 border rounded-lg text-center font-bold text-sm transition-colors {editingShift.isOFF ? 'bg-red-600 text-yellow-300 border-red-600 cursor-not-allowed opacity-100' : 'bg-white text-slate-800 border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200'}" placeholder="Nhập mã ca (vd: 12-56)">
                </div>
                {#if !editingShift.isOFF}
                    <div class="p-3 bg-gray-50 rounded-lg border border-gray-200 animate-fadeIn">
                        <label class="block text-xs font-bold text-gray-500 mb-2">Vai Trò Mới</label>
                        <div class="grid grid-cols-2 gap-2">
                            {#each ['TV', 'Thu Ngân', 'Kho', 'GH'] as r}
                                <label class="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-gray-200 hover:border-indigo-300 transition-colors">
                                    <input type="radio" bind:group={editingShift.role} value={r} class="accent-indigo-600 w-4 h-4">
                                    <span class="text-xs font-bold {r==='GH'?'text-blue-600':(r==='Thu Ngân'?'text-purple-600':(r==='Kho'?'text-orange-600':'text-gray-600'))}">{r}</span>
                                </label>
                            {/each}
                        </div>
                     </div>
                 {/if}
            </div>
            <div class="flex gap-3 mt-6">
                <button class="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors" on:click={()=>editingShift=null}>Hủy Bỏ</button>
                <button class="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all" on:click={saveShiftChange}>Lưu Thay Đổi</button>
            </div>
        </div>
    </div>
{/if}

{#if selectedDayStats}
    <div class="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={()=>selectedDayStats=null}>
        <div class="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" on:click|stopPropagation>
            
            <div class="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                <h3 class="font-bold text-lg text-slate-800">Ngày {selectedDayStats.day} ({selectedDayStats.weekday})</h3>
                 <button on:click={()=>selectedDayStats=null} class="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center"><span class="material-icons-round text-slate-500">close</span></button>
            </div>

            <div class="overflow-y-auto p-4 bg-white">
                
                <div class="mb-6 overflow-x-auto">
                    <h4 class="text-xs font-bold text-gray-400 uppercase mb-2">Tổng quan số lượng</h4>
                    <table class="w-full text-sm border-separate border-spacing-0 rounded-xl overflow-hidden border border-slate-200">
                        <thead class="bg-slate-50 text-slate-500">
                            <tr>
                                <th class="p-2 text-left font-bold border-b border-r border-slate-200 text-xs">Bộ Phận</th>
                                {#each selectedDayStats.cols as col}<th class="p-2 text-center border-b border-slate-200 border-l border-white min-w-[40px] text-xs"><div class="font-black text-slate-700">{col}</div></th>{/each}
                                <th class="p-2 text-center font-bold bg-slate-100 border-b border-l border-slate-200 text-slate-700 text-xs">Tổng</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each selectedDayStats.roles as role}
                                <tr class="hover:bg-slate-50 transition-colors">
                                    <td class="p-2 font-bold border-r border-slate-100 text-xs {role==='GH'?'text-blue-600':(role==='Thu Ngân'?'text-purple-600':(role==='Kho'?'text-orange-600':'text-gray-600'))}">{role}</td>
                                    {#each selectedDayStats.cols as col}<td class="p-2 border-r border-slate-100 text-center font-mono text-xs {selectedDayStats.matrix[role][col]>0?'font-bold text-slate-800':'text-gray-300'}">{selectedDayStats.matrix[role][col] || '-'}</td>{/each}
                                    <td class="p-2 text-center font-black text-slate-700 bg-slate-50 border-l border-slate-100 text-xs">{selectedDayStats.matrix[role]['Total']}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <h4 class="text-xs font-bold text-gray-400 uppercase mb-3 sticky top-0 bg-white py-2 z-10 border-b">Chi tiết nhân sự</h4>
                <div class="space-y-4">
                    
                    <div class="rounded-xl border border-orange-100 bg-orange-50/30 overflow-hidden">
                        <div class="bg-orange-100 px-3 py-2 flex items-center justify-between">
                            <span class="font-bold text-orange-700 text-sm flex items-center gap-2">
                                <span class="material-icons-round text-base">inventory_2</span> KHO
                            </span>
                            <span class="bg-white text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-200">{selectedDayStats.matrix['Kho']['Total']} người</span>
                        </div>
                        <div class="p-3 grid gap-3">
                            {#each Object.keys(selectedDayStats.details['Kho']).sort() as shift}
                                <div class="flex items-start gap-2 text-sm border-b border-orange-100 last:border-0 pb-2 last:pb-0">
                                    <div class="font-bold text-orange-600 bg-white border border-orange-200 px-2 py-1 rounded text-xs min-w-[40px] text-center shrink-0">{shift}</div>
                                    <div class="flex flex-wrap gap-1.5 pt-0.5">
                                        {#each selectedDayStats.details['Kho'][shift] as name}
                                            <span class="text-slate-700 font-bold">{name}{#if name !== selectedDayStats.details['Kho'][shift][selectedDayStats.details['Kho'][shift].length - 1]}, {/if}</span>
                                        {/each}
                                    </div>
                                </div>
                            {/each}
                            {#if Object.keys(selectedDayStats.details['Kho']).length === 0}
                                <span class="text-xs text-gray-400 italic">Không có nhân sự</span>
                            {/if}
                        </div>
                    </div>

                    <div class="rounded-xl border border-purple-100 bg-purple-50/30 overflow-hidden">
                        <div class="bg-purple-100 px-3 py-2 flex items-center justify-between">
                            <span class="font-bold text-purple-700 text-sm flex items-center gap-2">
                                <span class="material-icons-round text-base">point_of_sale</span> THU NGÂN
                            </span>
                             <span class="bg-white text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200">{selectedDayStats.matrix['Thu Ngân']['Total']} người</span>
                        </div>
                        <div class="p-3 grid gap-3">
                            {#each Object.keys(selectedDayStats.details['Thu Ngân']).sort() as shift}
                                <div class="flex items-start gap-2 text-sm border-b border-purple-100 last:border-0 pb-2 last:pb-0">
                                    <div class="font-bold text-purple-600 bg-white border border-purple-200 px-2 py-1 rounded text-xs min-w-[40px] text-center shrink-0">{shift}</div>
                                    <div class="flex flex-wrap gap-1.5 pt-0.5">
                                         {#each selectedDayStats.details['Thu Ngân'][shift] as name}
                                            <span class="text-slate-700 font-bold">{name}{#if name !== selectedDayStats.details['Thu Ngân'][shift][selectedDayStats.details['Thu Ngân'][shift].length - 1]}, {/if}</span>
                                        {/each}
                                    </div>
                                </div>
                            {/each}
                             {#if Object.keys(selectedDayStats.details['Thu Ngân']).length === 0}
                                <span class="text-xs text-gray-400 italic">Không có nhân sự</span>
                            {/if}
                        </div>
                    </div>

                    <div class="rounded-xl border border-blue-100 bg-blue-50/30 overflow-hidden">
                        <div class="bg-blue-100 px-3 py-2 flex items-center justify-between">
                            <span class="font-bold text-blue-700 text-sm flex items-center gap-2">
                                <span class="material-icons-round text-base">local_shipping</span> GIAO HÀNG
                            </span>
                             <span class="bg-white text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">{selectedDayStats.matrix['GH']['Total']} người</span>
                        </div>
                        <div class="p-3 grid gap-3">
                            {#each Object.keys(selectedDayStats.details['GH']).sort() as shift}
                                <div class="flex items-start gap-2 text-sm border-b border-blue-100 last:border-0 pb-2 last:pb-0">
                                    <div class="font-bold text-blue-600 bg-white border border-blue-200 px-2 py-1 rounded text-xs min-w-[40px] text-center shrink-0">{shift}</div>
                                    <div class="flex flex-wrap gap-1.5 pt-0.5">
                                         {#each selectedDayStats.details['GH'][shift] as name}
                                            <span class="text-slate-700 font-bold">{name}{#if name !== selectedDayStats.details['GH'][shift][selectedDayStats.details['GH'][shift].length - 1]}, {/if}</span>
                                        {/each}
                                    </div>
                                </div>
                            {/each}
                             {#if Object.keys(selectedDayStats.details['GH']).length === 0}
                                <span class="text-xs text-gray-400 italic">Không có nhân sự</span>
                            {/if}
                        </div>
                    </div>

                </div>
            </div>
            
        </div>
    </div>
{/if}

{#if showScheduleTour}
    <TourGuide steps={scheduleSteps} on:complete={() => showScheduleTour = false} />
{/if}