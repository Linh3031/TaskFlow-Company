<script>
  import { onMount, onDestroy } from 'svelte';
  import { db } from '../lib/firebase';
  import { doc, onSnapshot, updateDoc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
  import { currentUser, activeStoreId } from '../lib/stores';
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
  import StaffReorderModal from './admin/schedule/StaffReorderModal.svelte'; // [NEW] Import Modal Sắp xếp
  import AppFooter from './AppFooter.svelte';

  import {
      getShiftColor, getRoleBadge, getWeekday, getWeekendHardRoleCount,
      preparePersonalSchedule, prepareDayStats, checkShiftQuotaWarning,
      applyShiftChangeLocalData, applyShiftSwapLocalData, applyAssignFullToAllLocalData, resetDayToOriginalLocalData, findMyStatRowId, healScheduleStats
  } from '../lib/shiftUtils.js';

  export let activeTab;
  let scheduleData = null, loading = false, errorMsg = '';
  let viewMonth = new Date().getMonth() + 1;
  let viewYear = new Date().getFullYear();
  $: currentMonthStr = `${viewYear}-${String(viewMonth).padStart(2,'0')}`;
  
  let currentMode = 'NV';
  let editingShift = null;
  let selectedDayStats = null;
  let showHistoryModal = false; 
  let showPastDays = false;
  let highlightedDay = null;
  let tempEditingShift = null;
  let showSmartSwap = false; 
  let showReorderModal = false; // [NEW] Biến hiển thị Modal Sắp xếp

  let modalStaffId = null;
  let modalStaffName = '';
  $: selectedStaff = (modalStaffId && scheduleData) 
      ? preparePersonalSchedule(modalStaffId, modalStaffName, scheduleData, viewMonth, viewYear) 
      : null;
  
  $: myStores = $currentUser?.storeIds || [];
  $: isAdmin = $currentUser?.role === 'admin' || $currentUser?.role === 'super_admin';
  let unsubscribe = () => {};

  $: if (activeTab === 'schedule' && $activeStoreId && currentMonthStr && currentMode === 'NV') { 
      loadSchedule(currentMonthStr, $activeStoreId);
  }

  let allStoreUsers = [];
  $: availableStaffToSwap = allStoreUsers.filter(u => scheduleData && !scheduleData.stats.some(s => s.id === u.id));

  async function fetchAllStoreUsers() {
      if (!isAdmin || !$activeStoreId) return;
      try {
          const q = query(collection(db, 'users'), where('storeIds', 'array-contains', $activeStoreId));
          const snap = await getDocs(q);
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

  // ==========================================
  // [NEW] LƯU THỨ TỰ NHÂN SỰ SAU KHI SẮP XẾP
  // ==========================================
  async function handleSaveStaffOrder(newStatsOrder) {
      if (!scheduleData || !newStatsOrder) return;
      loading = true;
      try {
          let localData = JSON.parse(JSON.stringify(scheduleData.data));

          // [QUAN TRỌNG]: Sắp xếp lại Mảng ca làm việc trong Từng Ngày (Data Layer)
          // Để đảm bảo "Ca làm việc đi theo Người" tuyệt đối 100%
          Object.keys(localData).forEach(day => {
              localData[day].sort((a, b) => {
                  let idxA = newStatsOrder.findIndex(s => s.id === a.staffId);
                  let idxB = newStatsOrder.findIndex(s => s.id === b.staffId);
                  // Đẩy những người không có trong list xuống cuối
                  if(idxA === -1) return 1;
                  if(idxB === -1) return -1;
                  return idxA - idxB;
              });
          });

          await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), {
              stats: newStatsOrder,
              data: localData
          });
          
          showReorderModal = false;
          alert("✅ Đã cập nhật cấu trúc danh sách thành công!");
      } catch (e) {
          alert("Lỗi thực thi: " + e.message);
      } finally {
          loading = false;
      }
  }

  async function handleSwapStaffInSchedule(oldStaffId, newStaff) {
      if (!scheduleData) return;
      if (!confirm(`Xác nhận rút nhân viên cũ và thế chỗ bằng "${newStaff.name}" cho toàn bộ lịch từ đầu tháng?`)) return;
      loading = true;
      try {
          let localData = JSON.parse(JSON.stringify(scheduleData.data));
          let localStats = JSON.parse(JSON.stringify(scheduleData.stats));

          Object.keys(localData).forEach(day => {
              let assign = localData[day].find(a => a.staffId === oldStaffId);
              if (assign) {
                  assign.staffId = newStaff.id;
                  assign.name = newStaff.name;
                  assign.gender = newStaff.gender || 'Nữ';
              }
          });

          let statRow = localStats.find(s => s.id === oldStaffId);
          if (statRow) {
              statRow.id = newStaff.id;
              statRow.name = newStaff.name;
              statRow.gender = newStaff.gender || 'Nữ';
          }

          await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), {
              data: localData,
              stats: localStats
          });
          
          modalStaffId = null; 
          alert(`✅ Đã thế chỗ thành công! ${newStaff.name} đã tiếp quản toàn bộ lịch.`);
      } catch (e) {
          alert("Lỗi thực thi: " + e.message);
      } finally {
          loading = false;
      }
  }

  async function executeSmartSwap(plan) {
      if (!scheduleData || !plan || plan.length === 0) return;
      if (!confirm(`Xác nhận thực hiện lộ trình đổi ca gồm ${plan.length} bước này?`)) return;

      loading = true;
      try {
          let localData = JSON.parse(JSON.stringify(scheduleData.data));
          let updatedDayKeys = new Set();
          
          plan.forEach(step => {
              const dayKey = String(step.day);
              updatedDayKeys.add(dayKey);
              let dayList = localData[dayKey];

              const idx1 = dayList.findIndex(x => x.staffId === step.staff1.id);
              const idx2 = dayList.findIndex(x => x.staffId === step.staff2.id);

              if (idx1 > -1 && idx2 > -1) {
                  dayList[idx1].shift = step.shift2;
                  dayList[idx1].role = step.role2 || 'TV';
                  dayList[idx2].shift = step.shift1;
                  dayList[idx2].role = step.role1 || 'TV';
                  dayList[idx1].swapWith = step.staff2.id;
                  dayList[idx2].swapWith = step.staff1.id;
              }
          });

          let tempScheduleData = { ...scheduleData, data: localData };
          let healedStats = healScheduleStats(tempScheduleData);

          let updatePayload = { stats: healedStats };
          updatedDayKeys.forEach(key => {
              updatePayload[`data.${key}`] = localData[key];
          });
          
          await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), updatePayload);

          showSmartSwap = false;
          editingShift = null;
          alert("✅ Đã thực hiện đổi ca thành công!");
      } catch (e) {
          alert("Lỗi thực thi: " + e.message);
      } finally {
          loading = false;
      }
  }

  function handleSwapFlip(staffBId) {
      if (!editingShift || !scheduleData) return;
      const dayKey = String(editingShift.day);
      const dayList = scheduleData.data[dayKey] || [];
      const assignA = dayList.find(x => x.staffId === editingShift.staffId);
      const assignB = dayList.find(x => x.staffId === staffBId);
      const staffA = scheduleData.stats.find(s => s.id === editingShift.staffId);
      const staffB = scheduleData.stats.find(s => s.id === staffBId);
      if (!assignA || !assignB || !staffA || !staffB) return;

      executeSmartSwap([{
          day: editingShift.day,
          staff1: { id: staffA.id, name: staffA.name },
          staff2: { id: staffB.id, name: staffB.name },
          shift1: assignA.shift, role1: assignA.role,
          shift2: assignB.shift, role2: assignB.role
      }]);
  }

  let smartCoverSuggestions = [];
  $: if (editingShift && editingShift.isOFF && scheduleData && isAdmin) {
      smartCoverSuggestions = buildSmartCover(editingShift, scheduleData);
  } else { smartCoverSuggestions = []; }

  async function executeSmartCover(actions) {
      if (!editingShift || !scheduleData) return;
      if (!confirm("Xác nhận ÁP DỤNG phương án Trám Ca Thông Minh này?")) return;
      
      const { dayKey, dayList } = applySmartCoverActions(actions, scheduleData, editingShift);
      try {
          let tempScheduleData = { ...scheduleData, data: { ...scheduleData.data, [dayKey]: dayList } };
          let healedStats = healScheduleStats(tempScheduleData);

          await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), { [`data.${dayKey}`]: dayList, stats: healedStats });
          editingShift = null; 
          alert("✅ Đã Trám ca tự động và lưu lịch thành công!");
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
              loading = false; 
              if (snap.exists()) {
                  let rawData = snap.data();
                  rawData.stats = healScheduleStats(rawData);
                  scheduleData = rawData;
              } else {
                  scheduleData = null;
              }
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
      tempEditingShift = { day, staffId, name: assign.name, shift: assign.shift, role: assign.role || 'TV', isOFF: assign.shift === 'OFF', gender: staffInfo?.gender || 'Nữ', originalRole: (assign.originalRole !== undefined ? assign.originalRole : (assign.role || 'TV')) || 'TV', originalShift: assign.originalShift !== undefined ? assign.originalShift : assign.shift, swapWithId: assign.swapWith || null };
      editingShift = JSON.parse(JSON.stringify(tempEditingShift));
  }
  
  async function saveShiftChange(event) {
      if (!editingShift || !scheduleData) return;
      const warning = checkShiftQuotaWarning(editingShift, scheduleData);
      if (warning && !confirm(warning)) return;

      const swapTarget = event?.detail?.swapTarget;
      const { dayKey, dayList, newStats } = swapTarget
          ? applyShiftSwapLocalData(editingShift, swapTarget, scheduleData)
          : applyShiftChangeLocalData(editingShift, scheduleData);
      try {
          await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), { [`data.${dayKey}`]: dayList, stats: newStats });
          editingShift = null; 
      } catch (e) { alert("Lỗi: " + e.message); } 
  }

  async function handleAssignFullToAll(day) {
      if (!isAdmin || !scheduleData) return;
      if (!confirm(`Xác nhận GÁN CA FULL cho TẤT CẢ nhân viên ngày ${day}?\n- NV Tư Vấn → FULL\n- NV Kho/Thu Ngân → ghép đủ 123-456 (giữ nguyên vai trò)\n- NV Giao Hàng và NV đang OFF → giữ nguyên`)) return;
      loading = true;
      try {
          const { dayKey, dayList, newStats } = applyAssignFullToAllLocalData(day, scheduleData);
          await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), { [`data.${dayKey}`]: dayList, stats: newStats });
          selectedDayStats = null;
          alert(`✅ Đã gán ca FULL cho toàn bộ nhân viên ngày ${day}!`);
      } catch (e) { alert("Lỗi: " + e.message); } finally { loading = false; }
  }

  async function handleResetDayToOriginal(day) {
      if (!isAdmin || !scheduleData) return;
      if (!confirm(`Xác nhận RESET TOÀN BỘ ca làm việc ngày ${day} về đúng lịch GỐC (trước khi chỉnh sửa)?\nMọi thay đổi tay trong ngày này (gán FULL, đổi ca, sửa ca lẻ...) sẽ bị hoàn tác.`)) return;
      loading = true;
      try {
          const { dayKey, dayList, newStats } = resetDayToOriginalLocalData(day, scheduleData);
          await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), { [`data.${dayKey}`]: dayList, stats: newStats });
          selectedDayStats = null;
          alert(`✅ Đã reset ca làm việc ngày ${day} về lịch gốc!`);
      } catch (e) { alert("Lỗi: " + e.message); } finally { loading = false; }
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
            on:clickStaff={(e) => { modalStaffId = e.detail.id; modalStaffName = e.detail.name; }}
            on:clickCell={(e) => openEditShift(e.detail.day, e.detail.staffId, e.detail.assign)}
            on:openReorder={() => showReorderModal = true}
        />
    {/if}
    <AppFooter />

{:else if currentMode === 'PG'}
    <PGScheduleTable selectedViewStore={$activeStoreId} {isAdmin} />
{:else if currentMode === 'RS'}
    <RoadshowPanel selectedViewStore={$activeStoreId} {isAdmin} />
{/if}

{#if showHistoryModal && scheduleData} <CumulativeHistoryModal storeId={$activeStoreId} currentMonth={viewMonth} currentYear={viewYear} currentStats={scheduleData.stats} scheduleData={scheduleData.data} on:close={() => showHistoryModal = false} /> {/if}

{#if selectedStaff} 
    <PersonalScheduleModal 
        {selectedStaff} 
        {getRoleBadge} 
        {isAdmin}
        {availableStaffToSwap}
        on:swapStaff={(e) => handleSwapStaffInSchedule(e.detail.oldStaffId, e.detail.newStaff)}
        on:close={() => { modalStaffId = null; }} 
    /> 
{/if}

{#if editingShift} <EditShiftModal bind:editingShift {tempEditingShift} suggestions={smartCoverSuggestions} staffList={scheduleData.stats} dayAssignments={scheduleData.data[String(editingShift.day)] || []} on:close={() => editingShift = null} on:save={saveShiftChange} on:applySmartCover={(e) => executeSmartCover(e.detail)} on:swapFlip={(e) => handleSwapFlip(e.detail.staffBId)} /> {/if}
{#if selectedDayStats} <DayStatsModal {selectedDayStats} {isAdmin} on:close={() => selectedDayStats = null} on:assignFullToAll={(e) => handleAssignFullToAll(e.detail)} on:resetDayToOriginal={(e) => handleResetDayToOriginal(e.detail)} /> {/if}

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

<!-- [NEW] GẮN MODAL SẮP XẾP VÀO ĐÂY, TRUYỀN FULL STORE STAFF VÀ SCHEDULE DATA -->
{#if showReorderModal && scheduleData}
    <StaffReorderModal 
        staffList={scheduleData.stats} 
        fullStoreStaff={allStoreUsers}
        {scheduleData}
        on:close={() => showReorderModal = false} 
        on:save={(e) => handleSaveStaffOrder(e.detail)} 
    />
{/if}