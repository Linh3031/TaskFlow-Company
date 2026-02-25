<script>
  // Version 40.5 - Refactored (Phase 4.1: Extracted Excel Export) [Surgical Fix]
  import { onMount } from 'svelte';
  import { db } from '../lib/firebase';
  import { doc, onSnapshot, updateDoc, getDoc, setDoc } from 'firebase/firestore';
  import { currentUser } from '../lib/stores';
  import TourGuide from './TourGuide.svelte';
  import CumulativeHistoryModal from './CumulativeHistoryModal.svelte';
  // Tích hợp các mảnh ghép giao diện
  import ScheduleControls from './ShiftScheduleParts/ScheduleControls.svelte';
  import ScheduleTable from './ShiftScheduleParts/ScheduleTable.svelte';
  import DayStatsModal from './ShiftScheduleParts/DayStatsModal.svelte';
  import EditShiftModal from './ShiftScheduleParts/EditShiftModal.svelte';
  import PersonalScheduleModal from './ShiftScheduleParts/PersonalScheduleModal.svelte';
  // [NEW] Import Service Xuất Excel
  import { exportScheduleToExcel } from '../utils/excelExport.js';

  export let activeTab;
  let scheduleData = null, loading = false, errorMsg = '';
  let viewMonth = new Date().getMonth() + 1;
  let viewYear = new Date().getFullYear();
  $: currentMonthStr = `${viewYear}-${String(viewMonth).padStart(2,'0')}`;
  
  let selectedStaff = null;
  let editingShift = null;
  let selectedDayStats = null;
  let showHistoryModal = false; 
  
  let showPastDays = false;
  let highlightedDay = null;
  let tempEditingShift = null;
  $: myStores = $currentUser?.storeIds || [];
  $: isAdmin = $currentUser?.role === 'admin' || $currentUser?.role === 'super_admin';
  let selectedViewStore = '';
  $: if (myStores.length > 0 && !selectedViewStore) { selectedViewStore = myStores[0]; }

  let unsubscribe = () => {};
  $: if (activeTab === 'schedule' && selectedViewStore && currentMonthStr) { loadSchedule(currentMonthStr, selectedViewStore); }

  function isPastDay(d) {
      const today = new Date();
      if (viewYear > today.getFullYear()) return false;
      if (viewYear < today.getFullYear()) return true;
      if (viewMonth > today.getMonth() + 1) return false;
      if (viewMonth < today.getMonth() + 1) return true;
      return Number(d) < today.getDate();
  }

  function handleHighlightClick(d) {
      if (highlightedDay === d) highlightedDay = null;
      else highlightedDay = d;
  }

  async function loadSchedule(monthStr, storeId) {
      scheduleData = null;
      loading = true; errorMsg = '';
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

  async function handleRestoreBackup() {
      if (!isAdmin) return;
      if (!confirm(`⚠️ CẢNH BÁO: Bạn muốn khôi phục lại phiên bản lịch CŨ của tháng ${viewMonth}/${viewYear}?\n\nDữ liệu hiện tại sẽ bị ghi đè!`)) return;
      loading = true;
      try {
          const backupRef = doc(db, 'stores', selectedViewStore, 'schedules', `${currentMonthStr}_backup`);
          const backupSnap = await getDoc(backupRef);
          if (!backupSnap.exists()) { alert("❌ Không tìm thấy bản sao lưu nào."); loading = false; return; }
          const mainRef = doc(db, 'stores', selectedViewStore, 'schedules', currentMonthStr);
          await setDoc(mainRef, backupSnap.data());
          alert("✅ Đã khôi phục thành công!");
      } catch (e) { alert("Lỗi: " + e.message); } finally { loading = false; }
  }

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

  function getWeekday(day) { 
      const date = new Date(viewYear, viewMonth - 1, day);
      return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]; 
  }
  
  function viewPersonalSchedule(staffId, staffName) { 
      if(!scheduleData?.data) return;
      let days = []; 
      Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b)).forEach(d => { 
          const assign = scheduleData.data[d].find(x => x.staffId === staffId); 
          if(assign) days.push({ day: d, weekday: getWeekday(d), ...assign }); 
      });
      const firstDayDate = new Date(viewYear, viewMonth - 1, 1); 
      let startDayIdx = firstDayDate.getDay(); 
      if (startDayIdx === 0) startDayIdx = 6;
      else startDayIdx = startDayIdx - 1; 
      let blankCells = Array(startDayIdx).fill(null); 
      const stat = scheduleData.stats.find(s => s.id === staffId) || { totalHours:0, gh:0, tn:0, kho:0 }; 
      selectedStaff = { id: staffId, name: staffName, days, blankCells, stats: stat };
  }
  
  function openEditShift(day, staffId, assign) { 
      if (!isAdmin) return;
      const staffInfo = scheduleData.stats.find(s => s.id === staffId);
      tempEditingShift = { 
          day, staffId, name: assign.name, shift: assign.shift, role: assign.role || 'TV', 
          isOFF: assign.shift === 'OFF', gender: staffInfo ? staffInfo.gender : 'Nữ', 
          originalRole: assign.originalRole !== undefined ? assign.originalRole : (assign.role || 'TV'), 
          originalShift: assign.originalShift !== undefined ? assign.originalShift : assign.shift 
      }; 
      editingShift = JSON.parse(JSON.stringify(tempEditingShift));
  }
  
  async function saveShiftChange() { 
      if (!editingShift || !scheduleData) return;
      if (editingShift.role === 'GH' && editingShift.gender !== 'Nam') { 
          if (!confirm(`⚠️ CẢNH BÁO: Nhân viên ${editingShift.name} là NỮ.\nVị trí Giao Hàng thường yêu cầu NAM.\n\nBạn có chắc chắn muốn gán không?`)) return;
      } 
      const approvedCombos = scheduleData.config?.approvedCombos || [];
      if (approvedCombos.length > 0 && !editingShift.isOFF) { 
          const dayKey = String(editingShift.day);
          const currentDayAssignments = scheduleData.data[dayKey]; 
          let targetRoleCode = 'TV'; 
          if (editingShift.role === 'GH') targetRoleCode = 'GH';
          else if (editingShift.role === 'Thu Ngân') targetRoleCode = 'TN'; 
          else if (editingShift.role === 'Kho') targetRoleCode = 'Kho';
          const comboConfig = approvedCombos.find(c => { 
              let cRole = c.role || 'TV'; if (cRole === 'Thu Ngân') cRole = 'TN'; 
              return c.code === editingShift.shift && cRole === targetRoleCode; 
          });
          const quota = comboConfig ? (parseInt(comboConfig.qty) || 0) : 0;
          const currentCount = currentDayAssignments.filter(a => { 
              if (a.staffId === editingShift.staffId) return false; 
              let r = a.role || 'TV'; if (r === 'Giao Hàng') r = 'GH'; if (r === 'Thu Ngân') r = 'TN'; if (r === 'Kho') r = 'Kho'; 
              return a.shift === editingShift.shift && r === targetRoleCode; 
          }).length;
          
          if (currentCount + 1 > quota) { 
              const msg = quota === 0 ?
              `⛔ CẢNH BÁO: Combo [${editingShift.shift} - ${targetRoleCode}] KHÔNG CÓ trong bảng định mức!\n(Quota = 0)\n\nBạn có muốn ép buộc gán không?` : `⚠️ CẢNH BÁO VƯỢT ĐỊNH MỨC:\n\nCombo [${editingShift.shift} - ${targetRoleCode}] quy định: ${quota}.\nHiện tại: ${currentCount}.\nThêm mới thành: ${currentCount + 1}.\n\nTiếp tục?`;
              if (!confirm(msg)) return; 
          } 
      } 
      
      const dayKey = String(editingShift.day);
      const dayList = [...scheduleData.data[dayKey]];
      const idx = dayList.findIndex(x => x.staffId === editingShift.staffId);
      if (idx !== -1) { 
          const oldRole = dayList[idx].role || 'TV';
          const newRole = editingShift.isOFF ? '' : (editingShift.role === 'TV' ? '' : editingShift.role);
          const updatedAssignment = { ...dayList[idx], shift: editingShift.isOFF ? 'OFF' : editingShift.shift, role: newRole }; 
          dayList[idx] = updatedAssignment;
          const newStats = [...scheduleData.stats]; 
          const statIdx = newStats.findIndex(s => s.id === editingShift.staffId);
          if (statIdx !== -1) { 
              const s = newStats[statIdx];
              let rOld = oldRole === 'Giao Hàng' ? 'gh' : (oldRole === 'Thu Ngân' ? 'tn' : (oldRole === 'Kho' ? 'kho' : ''));
              if(rOld) s[rOld] = Math.max(0, (s[rOld]||0) - 1); 
              let rNew = newRole === 'Giao Hàng' ? 'gh' : (newRole === 'Thu Ngân' ? 'tn' : (newRole === 'Kho' ? 'kho' : ''));
              if(rNew) s[rNew] = (s[rNew]||0) + 1; 
          } 
          try { 
              await updateDoc(doc(db, 'stores', selectedViewStore, 'schedules', currentMonthStr), { [`data.${dayKey}`]: dayList, stats: newStats });
              editingShift = null; 
          } catch (e) { alert("Lỗi: " + e.message); } 
      } 
  }
  
  function showDayStats(day) { 
      if (!scheduleData || !scheduleData.data[day]) return;
      const dayData = scheduleData.data[day];
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
          if (matrix[r]) { matrix[r][assign.shift] = (matrix[r][assign.shift] || 0) + 1; matrix[r]['Total']++; } 
      });
      const targetRoles = ['Kho', 'Thu Ngân', 'GH'];
      const details = { 'Kho': {}, 'Thu Ngân': {}, 'GH': {} };
      dayData.forEach(assign => {
          if (assign.shift === 'OFF') return;
          let r = assign.role || 'TV';
          if (r === 'TN') r = 'Thu Ngân'; if (r === 'K') r = 'Kho'; if (r === 'Giao Hàng') r = 'GH';
          if (targetRoles.includes(r)) {
               if (!details[r][assign.shift]) details[r][assign.shift] = [];
               details[r][assign.shift].push(assign.name);
          }
      });
      selectedDayStats = { day, weekday: getWeekday(day), cols, matrix, roles, details };
  }

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

  // [SURGICAL] Gọi hàm xuất Excel từ file util
  function handleExportExcel() {
      exportScheduleToExcel({
          scheduleData,
          viewMonth,
          viewYear,
          selectedViewStore,
          getWeekday,
          getWeekendHardRoleCount
      });
  }
  
  let showScheduleTour = false;
  const scheduleSteps = [ 
      { target: '.overflow-x-auto', title: '1. Bảng Lịch Tổng', content: 'Đây là toàn bộ lịch làm việc trong tháng.' }, 
      { target: '#store-view-selector', title: '2. Chọn Kho Xem', content: 'Nếu quản lý nhiều kho, hãy chọn kho tại đây để xem lịch tương ứng.' }, 
      { target: '#tour-staff-name', title: '3. Xem Chi Tiết Cá Nhân', content: 'Bấm vào <b>Tên Nhân Viên</b> để mở popup xem lịch riêng.' }, 
      { target: '#tour-total-col', title: '4. Cột Tổng Kết', content: 'Kéo về cuối bảng để xem tổng giờ công.', action: () => { const tableContainer = document.querySelector('.overflow-x-auto'); if(tableContainer) tableContainer.scrollLeft = tableContainer.scrollWidth; } } 
  ];
</script>

<ScheduleControls 
    {myStores} {scheduleData} {isAdmin}
    bind:selectedViewStore bind:viewMonth bind:viewYear bind:showPastDays
    on:openHistory={() => showHistoryModal = true}
    on:restoreBackup={handleRestoreBackup}
    on:exportExcel={handleExportExcel}
    on:startTour={() => showScheduleTour = true}
/>

{#if loading} 
    <div class="p-10 text-center text-gray-400 animate-pulse bg-white rounded-xl border border-dashed flex flex-col items-center">
        <span class="material-icons-round text-4xl animate-spin text-indigo-300">sync</span>
        <p class="mt-2 text-sm font-bold">Đang tải lịch tháng {viewMonth}...</p>
    </div>
{:else if !scheduleData} 
    <div class="p-10 text-center text-gray-400 bg-white rounded-xl border border-dashed flex flex-col items-center">
        <span class="material-icons-round text-4xl text-gray-300">calendar_today</span>
        <p class="mt-2 text-sm">Chưa có lịch làm việc tháng {viewMonth}/{viewYear}.</p>
        {#if isAdmin}<p class="text-xs text-indigo-500 mt-1">Vui lòng vào mục "Quản trị" để tạo.</p>{/if}
    </div>
{:else}
    <ScheduleTable 
        {scheduleData} {showPastDays} {highlightedDay} {isAdmin}
        {isPastDay} {getWeekday} {getRoleBadge} {getShiftColor} {getWeekendHardRoleCount}
        on:clickHighlight={(e) => handleHighlightClick(e.detail)}
        on:clickDayStats={(e) => showDayStats(e.detail)}
        on:clickStaff={(e) => viewPersonalSchedule(e.detail.id, e.detail.name)}
        on:clickCell={(e) => openEditShift(e.detail.day, e.detail.staffId, e.detail.assign)}
    />
{/if}

{#if showHistoryModal && scheduleData}
    <CumulativeHistoryModal storeId={selectedViewStore} currentMonth={viewMonth} currentYear={viewYear} currentStats={scheduleData.stats} on:close={() => showHistoryModal = false} />
{/if}

{#if selectedStaff}
    <PersonalScheduleModal {selectedStaff} {getRoleBadge} on:close={() => selectedStaff = null} />
{/if}

{#if editingShift}
    <EditShiftModal bind:editingShift {tempEditingShift} on:close={() => editingShift = null} on:save={saveShiftChange} />
{/if}

{#if selectedDayStats}
    <DayStatsModal {selectedDayStats} on:close={() => selectedDayStats = null} />
{/if}

{#if showScheduleTour}
    <TourGuide steps={scheduleSteps} on:complete={() => showScheduleTour = false} />
{/if}