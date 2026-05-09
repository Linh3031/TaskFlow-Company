<script>
  import { onMount, onDestroy } from 'svelte';
  import { db } from '../lib/firebase';
  import { doc, onSnapshot, updateDoc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
  import { currentUser, activeStoreId } from '../lib/stores';
  import TourGuide from './TourGuide.svelte';
  import CumulativeHistoryModal from './CumulativeHistoryModal.svelte';
  
  import ScheduleControls from './ShiftScheduleParts/ScheduleControls.svelte';
  import ScheduleTable from './ShiftScheduleParts/ScheduleTable.svelte';
  import DayStatsModal from './ShiftScheduleParts/DayStatsModal.svelte';
  import EditShiftModal from './ShiftScheduleParts/EditShiftModal.svelte';
  import PersonalScheduleModal from './ShiftScheduleParts/PersonalScheduleModal.svelte';
  import { exportScheduleToExcel } from '../utils/excelExport.js';

  import PGScheduleTable from './ShiftScheduleParts/PGScheduleTable.svelte';
  import RoadshowPanel from './ShiftScheduleParts/RoadshowPanel.svelte';
  
  import { buildSmartCover, applySmartCoverActions } from '../lib/smartCover.js';
  import SmartSwapModal from './admin/schedule/SmartSwapModal.svelte';
  import LegacySyncManager from './ShiftScheduleParts/LegacySyncManager.svelte';
  import { 
      getShiftColor, getRoleBadge, getWeekday, getWeekendHardRoleCount, 
      preparePersonalSchedule, prepareDayStats, checkShiftQuotaWarning, 
      applyShiftChangeLocalData, findMyStatRowId 
  } from '../lib/shiftUtils.js';

  export let activeTab;
  let scheduleData = null, loading = false, errorMsg = '';
  let viewMonth = new Date().getMonth() + 1;
  let viewYear = new Date().getFullYear();
  $: currentMonthStr = `${viewYear}-${String(viewMonth).padStart(2,'0')}`;
  
  let currentMode = 'NV';
  let selectedStaff = null;
  let editingShift = null;
  let selectedDayStats = null;
  let showHistoryModal = false; 
  let showPastDays = false;
  let highlightedDay = null;
  let tempEditingShift = null;
  let showSmartSwap = false; 
  
  $: myStores = $currentUser?.storeIds || [];
  $: isAdmin = $currentUser?.role === 'admin' || $currentUser?.role === 'super_admin';
  let unsubscribe = () => {};

  $: if (activeTab === 'schedule' && $activeStoreId && currentMonthStr && currentMode === 'NV') { 
      loadSchedule(currentMonthStr, $activeStoreId);
  }

  // ==========================================
  // TÍNH NĂNG THẾ CHỖ NHÂN SỰ TOÀN LỊCH
  // ==========================================
  let allStoreUsers = [];
  $: availableStaffToSwap = allStoreUsers.filter(u => scheduleData && !scheduleData.stats.some(s => s.id === u.id));

  async function fetchAllStoreUsers() {
      if (!isAdmin || !$activeStoreId) return;
      try {
          const q = query(collection(db, 'users'), where('storeIds', 'array-contains', $activeStoreId));
          const snap = await getDocs(q);
          // Lọc trực tiếp bằng JS để chặn PG và Admin
          allStoreUsers = snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(u => u.role === 'staff');
      } catch (error) {
          console.error("Lỗi lấy danh sách user:", error);
      }
  }

  $: if (activeTab === 'schedule' && $activeStoreId && isAdmin) {
      fetchAllStoreUsers();
  }

  async function handleSwapStaffInSchedule(oldStaffId, newStaff) {
      if (!scheduleData) return;
      if (!confirm(`Xác nhận rút nhân viên cũ và thế chỗ bằng "${newStaff.name}" cho toàn bộ lịch từ đầu tháng?`)) return;
      loading = true;
      try {
          let localData = JSON.parse(JSON.stringify(scheduleData.data));
          let localStats = JSON.parse(JSON.stringify(scheduleData.stats));

          // 1. Thay tên trong Data từng ngày
          Object.keys(localData).forEach(day => {
              let assign = localData[day].find(a => a.staffId === oldStaffId);
              if (assign) {
                  assign.staffId = newStaff.id;
                  assign.name = newStaff.name;
                  assign.gender = newStaff.gender || 'Nữ';
              }
          });

          // 2. Thay tên trong Stats (Bảo toàn số ca)
          let statRow = localStats.find(s => s.id === oldStaffId);
          if (statRow) {
              statRow.id = newStaff.id;
              statRow.name = newStaff.name;
              statRow.gender = newStaff.gender || 'Nữ';
          }

          // 3. Đẩy lên Firebase
          await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), {
              data: localData,
              stats: localStats
          });
          selectedStaff = null; // Đóng modal
          alert(`✅ Đã thế chỗ thành công! ${newStaff.name} đã tiếp quản toàn bộ lịch.`);
      } catch (e) {
          alert("Lỗi thực thi: " + e.message);
      } finally {
          loading = false;
      }
  }

  // ==========================================
  // SMART SWAP EXECUTION (AI ĐỔI CA)
  // ==========================================
  async function executeSmartSwap(plan) {
      if (!scheduleData || !plan || plan.length === 0) return;
      if (!confirm(`Xác nhận thực hiện lộ trình đổi ca gồm ${plan.length} bước này?`)) return;

      loading = true;
      try {
          let localData = JSON.parse(JSON.stringify(scheduleData.data));
          let localStats = JSON.parse(JSON.stringify(scheduleData.stats)); // [PHẪU THUẬT LOGIC]: Tải Stats để cập nhật đồng bộ
          let updatedDayKeys = new Set();
          
          plan.forEach(step => {
              const dayKey = String(step.day);
              updatedDayKeys.add(dayKey);
              let dayList = localData[dayKey];

              const idx1 = dayList.findIndex(x => x.staffId === step.staff1.id);
              const idx2 = dayList.findIndex(x => x.staffId === step.staff2.id);

              if (idx1 > -1 && idx2 > -1) {
                  const oldRole1 = dayList[idx1].role;
                  const oldRole2 = dayList[idx2].role;
                  const newRole1 = step.role2 || 'TV';
                  const newRole2 = step.role1 || 'TV';

                  // Đổi ca trên Data
                  dayList[idx1].shift = step.shift2;
                  dayList[idx1].role = newRole1;
                  dayList[idx2].shift = step.shift1;
                  dayList[idx2].role = newRole2;

                  // [PHẪU THUẬT LOGIC]: Dịch vụ phân loại Role để chấm điểm
                  const getRoleKey = (r) => {
                      if (!r) return null;
                      let norm = r.toLowerCase();
                      if (norm.includes('gh') || norm.includes('giao')) return 'gh';
                      if (norm.includes('tn') || norm.includes('thu')) return 'tn';
                      if (norm.includes('k')) return 'kho';
                      return null;
                  };

                  // Trừ điểm cũ, Cộng điểm mới cho Staff 1
                  let rOld1 = getRoleKey(oldRole1);
                  let rNew1 = getRoleKey(newRole1);
                  let sIdx1 = localStats.findIndex(s => s.id === step.staff1.id);
                  if (sIdx1 > -1) {
                      if (rOld1 && rOld1 !== rNew1) localStats[sIdx1][rOld1] = Math.max(0, (localStats[sIdx1][rOld1]||0) - 1);
                      if (rNew1 && rOld1 !== rNew1) localStats[sIdx1][rNew1] = (localStats[sIdx1][rNew1]||0) + 1;
                  }

                  // Trừ điểm cũ, Cộng điểm mới cho Staff 2
                  let rOld2 = getRoleKey(oldRole2);
                  let rNew2 = getRoleKey(newRole2);
                  let sIdx2 = localStats.findIndex(s => s.id === step.staff2.id);
                  if (sIdx2 > -1) {
                      if (rOld2 && rOld2 !== rNew2) localStats[sIdx2][rOld2] = Math.max(0, (localStats[sIdx2][rOld2]||0) - 1);
                      if (rNew2 && rOld2 !== rNew2) localStats[sIdx2][rNew2] = (localStats[sIdx2][rNew2]||0) + 1;
                  }
              }
          });

          // [PHẪU THUẬT LOGIC]: Đóng gói Payload chứa cả Data và Stats đã được cập nhật
          let updatePayload = { stats: localStats };
          updatedDayKeys.forEach(key => {
              updatePayload[`data.${key}`] = localData[key];
          });
          
          await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), updatePayload);
          
          showSmartSwap = false;
          alert("✅ Đã thực hiện đổi ca thành công!");
      } catch (e) {
          alert("Lỗi thực thi: " + e.message);
      } finally {
          loading = false;
      }
  }

  // --- SMART COVER ---
  let smartCoverSuggestions = [];
  $: if (editingShift && editingShift.isOFF && scheduleData && isAdmin) {
      smartCoverSuggestions = buildSmartCover(editingShift, scheduleData);
  } else { smartCoverSuggestions = []; }

  async function executeSmartCover(actions) {
      if (!editingShift || !scheduleData) return;
      if (!confirm("Xác nhận ÁP DỤNG phương án Trám Ca Thông Minh này?")) return;
      const { dayKey, dayList, newStats } = applySmartCoverActions(actions, scheduleData, editingShift);
      try {
          await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), { [`data.${dayKey}`]: dayList, stats: newStats });
          editingShift = null; alert("✅ Đã Trám ca tự động và lưu lịch thành công!");
      } catch (e) { alert("Lỗi: " + e.message); }
  }

  function isPastDay(d) {
      const today = new Date();
      if (viewYear > today.getFullYear()) return false;
      if (viewYear < today.getFullYear()) return true;
      if (viewMonth > today.getMonth() + 1) return false;
      if (viewMonth < today.getMonth() + 1) return true;
      return Number(d) < today.getDate();
  }

  async function loadSchedule(monthStr, storeId) {
      scheduleData = null;
      loading = true;
      if (unsubscribe) unsubscribe();
      try {
          unsubscribe = onSnapshot(doc(db, 'stores', storeId, 'schedules', monthStr), (snap) => {
              loading = false; scheduleData = snap.exists() ? snap.data() : null;
          });
      } catch (e) { loading = false; }
  }

  async function handleRestoreBackup() {
      if (!isAdmin) return;
      if (!confirm(`⚠️ CẢNH BÁO: Khôi phục phiên bản lịch CŨ tháng ${viewMonth}/${viewYear}?\nDữ liệu hiện tại sẽ bị ghi đè!`)) return;
      loading = true;
      try {
          const backupSnap = await getDoc(doc(db, 'stores', $activeStoreId, 'schedules', `${currentMonthStr}_backup`));
          if (!backupSnap.exists()) return alert("❌ Không tìm thấy bản sao lưu.");
          await setDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), backupSnap.data());
          alert("✅ Đã khôi phục thành công!");
      } catch (e) { alert("Lỗi: " + e.message); } finally { loading = false; }
  }

  async function handleLockBaseline() {
      if (!isAdmin || !scheduleData) return;
      if (!confirm(`🔒 CHỐT LỊCH GỐC THÁNG ${viewMonth}/${viewYear}?`)) return;
      try {
          await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), { baselineStats: JSON.parse(JSON.stringify(scheduleData.stats)) });
          alert("✅ Đã CHỐT Lịch Gốc thành công!");
      } catch (e) { alert("Lỗi: " + e.message); }
  }

  $: boundGetWeekday = (d) => getWeekday(d, viewMonth, viewYear);
  $: boundGetWeekendCount = (sid) => getWeekendHardRoleCount(sid, scheduleData, viewMonth, viewYear);

  function openEditShift(day, staffId, assign) { 
      if (!isAdmin) return;
      const staffInfo = scheduleData.stats.find(s => s.id === staffId);
      tempEditingShift = { day, staffId, name: assign.name, shift: assign.shift, role: assign.role || 'TV', isOFF: assign.shift === 'OFF', gender: staffInfo?.gender || 'Nữ', originalRole: assign.originalRole || assign.role || 'TV', originalShift: assign.originalShift || assign.shift };
      editingShift = JSON.parse(JSON.stringify(tempEditingShift));
  }
  
  async function saveShiftChange() { 
      if (!editingShift || !scheduleData) return;
      const warning = checkShiftQuotaWarning(editingShift, scheduleData);
      if (warning && !confirm(warning)) return;
      const { dayKey, dayList, newStats } = applyShiftChangeLocalData(editingShift, scheduleData);
      try { 
          await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), { [`data.${dayKey}`]: dayList, stats: newStats });
          editingShift = null; 
      } catch (e) { alert("Lỗi: " + e.message); } 
  }

  function handleExportExcel() {
      exportScheduleToExcel({ scheduleData, viewMonth, viewYear, selectedViewStore: $activeStoreId, getWeekday: boundGetWeekday, getWeekendHardRoleCount: boundGetWeekendCount });
  }

  function scrollToMyRow() {
      if (!$currentUser || !scheduleData?.stats) return;
      const sid = findMyStatRowId($currentUser, scheduleData.stats);
      if (sid) {
          const row = document.getElementById('staff-row-' + sid);
          if (row) {
              row.scrollIntoView({ behavior: 'smooth', block: 'center' });
              row.firstElementChild?.classList.add('!bg-yellow-200', 'transition-colors', 'duration-500');
              setTimeout(() => row.firstElementChild?.classList.remove('!bg-yellow-200'), 2000);
          } else alert("Đã tìm thấy dữ liệu nhưng chưa kịp hiển thị!");
      } else alert(`Không tìm thấy "${$currentUser.name}" trong lịch tháng này!`);
  }
  
  let showScheduleTour = false;
  const scheduleSteps = [ { target: '.overflow-x-auto', title: '1. Bảng Lịch Tổng', content: 'Toàn bộ lịch làm việc.' }, { target: '#store-view-selector', title: '2. Chọn Kho Xem', content: 'Chọn kho.' }, { target: '#tour-staff-name', title: '3. Xem Cá Nhân', content: 'Bấm vào Tên.' }, { target: '#tour-total-col', title: '4. Cột Tổng Kết', content: 'Kéo về cuối bảng.', action: () => { document.querySelector('.overflow-x-auto').scrollLeft = 9999; } } ];
  onDestroy(() => { if (unsubscribe) unsubscribe(); });
</script>

<ScheduleControls 
    bind:currentMode={currentMode}
    {myStores} {scheduleData} {isAdmin}
    bind:selectedViewStore={$activeStoreId} bind:viewMonth bind:viewYear bind:showPastDays
    on:locate={scrollToMyRow}
    on:openHistory={() => showHistoryModal = true}
    on:restoreBackup={handleRestoreBackup}
    on:lockBaseline={handleLockBaseline}
    on:exportExcel={handleExportExcel}
    on:startTour={() => showScheduleTour = true}
    on:openSmartSwap={() => showSmartSwap = true}
/>

{#if currentMode === 'NV'}
    
    <LegacySyncManager {scheduleData} activeStoreId={$activeStoreId} {currentMonthStr} {isAdmin} {currentMode} />

    {#if loading} 
        <div class="p-10 text-center text-gray-400 animate-pulse bg-white rounded-xl border flex flex-col items-center"><span class="material-icons-round text-4xl animate-spin text-indigo-300">sync</span><p class="mt-2 text-sm font-bold">Đang tải lịch tháng {viewMonth}...</p></div>
    {:else if !scheduleData} 
        <div class="p-10 text-center text-gray-400 bg-white rounded-xl border flex flex-col items-center"><span class="material-icons-round text-4xl text-gray-300">calendar_today</span><p class="mt-2 text-sm">Chưa có lịch tháng {viewMonth}/{viewYear}.</p></div>
    {:else}
        <ScheduleTable 
            {scheduleData} {showPastDays} {highlightedDay} {isAdmin} {isPastDay} 
            getWeekday={boundGetWeekday} {getRoleBadge} {getShiftColor} getWeekendHardRoleCount={boundGetWeekendCount}
            on:clickHighlight={(e) => highlightedDay = highlightedDay === e.detail ? null : e.detail}
            on:clickDayStats={(e) => selectedDayStats = prepareDayStats(e.detail, scheduleData, viewMonth, viewYear)}
            on:clickStaff={(e) => selectedStaff = preparePersonalSchedule(e.detail.id, e.detail.name, scheduleData, viewMonth, viewYear)}
            on:clickCell={(e) => openEditShift(e.detail.day, e.detail.staffId, e.detail.assign)}
        />
    {/if}

{:else if currentMode === 'PG'}
    <PGScheduleTable selectedViewStore={$activeStoreId} {isAdmin} />
{:else if currentMode === 'RS'}
    <RoadshowPanel selectedViewStore={$activeStoreId} {isAdmin} />
{/if}

{#if showHistoryModal && scheduleData} <CumulativeHistoryModal storeId={$activeStoreId} currentMonth={viewMonth} currentYear={viewYear} currentStats={scheduleData.stats} on:close={() => showHistoryModal = false} /> {/if}

{#if selectedStaff} 
    <PersonalScheduleModal 
        {selectedStaff} 
        {getRoleBadge} 
        {isAdmin}
        {availableStaffToSwap}
        on:swapStaff={(e) => handleSwapStaffInSchedule(e.detail.oldStaffId, e.detail.newStaff)}
        on:close={() => selectedStaff = null} 
    /> 
{/if}

{#if editingShift} <EditShiftModal bind:editingShift {tempEditingShift} suggestions={smartCoverSuggestions} on:close={() => editingShift = null} on:save={saveShiftChange} on:applySmartCover={(e) => executeSmartCover(e.detail)} /> {/if}
{#if selectedDayStats} <DayStatsModal {selectedDayStats} on:close={() => selectedDayStats = null} /> {/if}
{#if showScheduleTour} <TourGuide steps={scheduleSteps} on:complete={() => showScheduleTour = false} /> {/if}

{#if showSmartSwap && scheduleData}
    <SmartSwapModal 
        scheduleData={scheduleData.data} 
        staffList={scheduleData.stats} 
        currentStats={scheduleData.stats}
        genderConfig={{ kho: 'none', tn: 'none' }}
        month={viewMonth}
        year={viewYear}
        on:close={() => showSmartSwap = false}
        on:execute={(e) => executeSmartSwap(e.detail)}
    />
{/if}