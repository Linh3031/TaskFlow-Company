<script>
  // Version 35.0 - Reorder Columns, Font Fix, WE Ops Column
  // ... (Giữ nguyên toàn bộ phần Script logic đã có từ v34.0)
  // ... (Chỉ thay đổi phần Template bên dưới)
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { read, utils, writeFile } from 'xlsx';
  import { db } from '../lib/firebase';
  import { doc, setDoc, serverTimestamp, getDoc, updateDoc, writeBatch, collection, query, where, getDocs, deleteDoc, addDoc } from 'firebase/firestore';
  import { taskTemplate, currentUser } from '../lib/stores';
  import { safeString, getTodayStr } from '../lib/utils';
  import { calculateCombosFromMatrix, generateMonthlySchedule, SHIFT_DEFINITIONS, suggestPeakCombos } from '../lib/scheduleLogic';
  import { optimizeSchedule, autoFixRotation, autoFixWeekendFairness, autoFixGenderBalance } from '../lib/optimization';
  import TourGuide from './TourGuide.svelte';
  import StoreConfig from './StoreConfig.svelte';

  const dispatch = createEventDispatcher();
  $: isSuperAdmin = $currentUser?.role === 'super_admin';
  $: myStores = $currentUser?.storeIds || [];
  let targetStore = '';
  $: if (myStores.length > 0 && !targetStore) { targetStore = myStores[0]; }
  $: if (targetStore) { loadStoreData(); loadAccountList(); }

  $: isDemoMode = targetStore.includes('DEMO');
  function checkDemoAndBlock(e) {
      if (isDemoMode) { e && e.preventDefault(); e && e.stopPropagation(); alert("Tài khoản demo không có tính năng này!"); return true; }
      return false;
  }

  let activeSection = 'schedule'; 
  let isLoading = false;
  let showTour = false;
  
  let newAdminUser = ''; let newAdminPass = ''; let newAdminStore = '';
  let accountList = [];
  let showAddUserModal = false; let singleGender = 'Nữ'; let singleUsername = ''; let singlePass = '123456';
  let singleRole = 'staff';
  
  let genderConfig = { kho: 'none', tn: 'none' };
  let showConfigDropdown = false; 
  let activeMatrixMode = 'weekday'; 
  let showStoreConfig = false;
  
  let inspectionMode = 'none'; 
  const INSPECTION_OPTIONS = [
      { val: 'none', label: 'Tắt soi lỗi', icon: 'visibility_off', color: 'text-gray-400' },
      { val: 'gender', label: 'Soi Giới Tính', icon: 'wc', color: 'text-pink-500' },
      { val: 'weekend', label: 'Công Bằng Cuối Tuần', icon: 'balance', color: 'text-indigo-600' },
      { val: 'rotation', label: 'Soi Nhịp Sáng/Chiều', icon: 'sync_problem', color: 'text-orange-500' },
      { val: 'fatigue', label: 'Soi Trùng Nghiệp Vụ', icon: 'battery_alert', color: 'text-red-600' }
  ];

  let isPeakMode = false;
  let showShortageAlert = false;
  let shortageCount = 0;
  let configDropdownNode;
  function handleWindowClick(e) { if (showConfigDropdown && configDropdownNode && !configDropdownNode.contains(e.target)) { showConfigDropdown = false; } }

  let editingShift = null; 
  let tempEditingShift = null;
  let selectedStaff = null;
  let selectedDayStats = null; 
  
  const BASE_COLS = ['123', '456', '23', '45', '2-5', '2345'];
  const EXTREME_COLS = ['12-56', '12-456', '123-56', '12345']; 
  $: comboCols = isPeakMode ? [...BASE_COLS, ...EXTREME_COLS] : BASE_COLS;
  const QUICK_SHIFTS = ['OFF', '123', '456', '23', '45', '2345'];

  function getShiftColor(code) {
      if (code === 'OFF') return 'bg-slate-100 text-slate-400 border-slate-200 font-bold tracking-wider text-[10px]';
      const map = { '123': 'bg-green-50 text-green-700 border-green-100', '456': 'bg-orange-50 text-orange-700 border-orange-100', '23': 'bg-cyan-50 text-cyan-700 border-cyan-100', '45': 'bg-blue-50 text-blue-700 border-blue-100', '2-5': 'bg-pink-50 text-pink-700 border-pink-100', '2345': 'bg-red-50 text-red-700 border-red-100', '12-56': 'bg-purple-100 text-purple-700 border-purple-200' };
      return map[code] || 'bg-white text-gray-800 border-gray-200';
  }
  
  function getRoleBadge(role) {
      if (!role || role === 'TV') return null;
      if (role === 'GH' || role === 'Giao Hàng') return { text: 'GH', class: 'bg-blue-600 text-white' };
      if (role === 'Thu Ngân' || role === 'TN') return { text: 'TN', class: 'bg-purple-600 text-white' };
      if (role === 'Kho') return { text: 'K', class: 'bg-orange-500 text-white' }; 
      return { text: role.charAt(0), class: 'bg-gray-500 text-white' };
  }

  let previewScheduleData = null;
  let previewStats = []; let originalResult = null; let optimizationLogs = []; 
  let scheduleMonth = new Date().getMonth() + 1;
  let scheduleYear = new Date().getFullYear();
  let scheduleStaffList = []; let staffStats = { total: 0, male: 0, female: 0 };
  $: { if (scheduleStaffList && scheduleStaffList.length > 0) { try { staffStats = { total: scheduleStaffList.length, male: scheduleStaffList.filter(s => String(s.gender || '').trim().toLowerCase() === 'nam').length, female: scheduleStaffList.filter(s => String(s.gender || '').trim().toLowerCase() !== 'nam').length }; } catch (e) { staffStats = { total: scheduleStaffList.length, male: 0, female: 0 }; } } else { staffStats = { total: 0, male: 0, female: 0 }; } }
  
  const defaultMatrix = { c1: { kho: 0, tn: 0, tv: 0, gh: 0 }, c2: { kho: 0, tn: 0, tv: 0, gh: 0 }, c3: { kho: 0, tn: 0, tv: 0, gh: 0 }, c4: { kho: 0, tn: 0, tv: 0, gh: 0 }, c5: { kho: 0, tn: 0, tv: 0, gh: 0 }, c6: { kho: 0, tn: 0, tv: 0, gh: 0 } };
  let shiftMatrix = JSON.parse(JSON.stringify(defaultMatrix)); 
  let weekendMatrix = JSON.parse(JSON.stringify(defaultMatrix)); 
  let suggestedCombos = []; let suggestedWeekendCombos = [];
  $: activeSuggestedCombos = activeMatrixMode === 'weekday' ? suggestedCombos : suggestedWeekendCombos;
  $: totalCombos = activeSuggestedCombos.reduce((sum, c) => sum + (parseInt(c.qty)||0), 0);
  let comboTotalsMap = {};
  $: { const map = {}; comboCols.forEach(code => { const items = activeSuggestedCombos.filter(c => c.code === code); map[code] = items.reduce((sum, c) => sum + (parseInt(c.qty) || 0), 0); }); comboTotalsMap = map; }

  const shiftCols = [ { id: 'c1', label: 'C1 (08-09h)' }, { id: 'c2', label: 'C2 (09-12h)' }, { id: 'c3', label: 'C3 (12-15h)' }, { id: 'c4', label: 'C4 (15-18h)' }, { id: 'c5', label: 'C5 (18-21h)' }, { id: 'c6', label: 'C6 (21-21h30)' } ];
  const roleRows = [ { id: 'kho', label: 'Kho', color: 'text-orange-600 bg-orange-50 border-orange-100' }, { id: 'tn', label: 'Thu Ngân', color: 'text-purple-600 bg-purple-50 border-purple-100' }, { id: 'gh', label: 'Giao Hàng', color: 'text-blue-600 bg-blue-50 border-blue-100' }, { id: 'tv', label: 'Tư Vấn', color: 'text-gray-600 bg-gray-50 border-gray-200' } ];
  
  let activeTemplateType = 'warehouse'; let newTemplateTime = '08:00'; let newTemplateTitle = ''; let newTemplateImportant = false; let selectedDays = [0, 1, 2, 3, 4, 5, 6]; let editingTemplateIndex = -1;
  const weekDays = [{ val: 1, label: 'T2' }, { val: 2, label: 'T3' }, { val: 3, label: 'T4' }, { val: 4, label: 'T5' }, { val: 5, label: 'T6' }, { val: 6, label: 'T7' }, { val: 0, label: 'CN' }];
  
  onMount(async () => { await loadStoreData(); });

  async function loadStoreData() { 
      if (!targetStore) return;
      scheduleStaffList = []; 
      shiftMatrix = JSON.parse(JSON.stringify(defaultMatrix)); 
      weekendMatrix = JSON.parse(JSON.stringify(defaultMatrix));
      suggestedCombos = []; suggestedWeekendCombos = []; previewScheduleData = null;
      try { 
          const staffSnap = await getDoc(doc(db, 'settings', `staff_list_${targetStore}`));
          if (staffSnap.exists()) scheduleStaffList = staffSnap.data().staffList || []; 
          const configSnap = await getDoc(doc(db, 'settings', `shift_matrix_${targetStore}`));
          if (configSnap.exists()) { 
              const data = configSnap.data();
              if (data.matrix) shiftMatrix = { ...defaultMatrix, ...data.matrix };
              if (data.approvedCombos) suggestedCombos = data.approvedCombos;
              if (data.weekendMatrix) weekendMatrix = { ...defaultMatrix, ...data.weekendMatrix };
              if (data.weekendCombos) suggestedWeekendCombos = data.weekendCombos;
              if (data.genderConfig) genderConfig = data.genderConfig;
          } 
      } catch (e) { console.error(e); } 
  }

  async function saveGenderConfig() {
      if (!targetStore) return;
      try { await setDoc(doc(db, 'settings', `shift_matrix_${targetStore}`), { genderConfig }, { merge: true }); } catch (e) { console.error("Auto save config error:", e); }
  }
  function handleConfigChange(type, val) { genderConfig[type] = val; saveGenderConfig(); }

  // ... (Keep all utility functions and auto-fix functions exactly as they were in v34.0) ...
  function matchRoleCode(uiLabel) { if (!uiLabel) return 'TV'; const cleanLabel = uiLabel.trim(); if (cleanLabel === 'Giao Hàng') return 'GH'; if (cleanLabel === 'Kho') return 'Kho'; if (cleanLabel === 'Thu Ngân') return 'TN'; if (cleanLabel === 'Tư Vấn') return 'TV'; return cleanLabel; }
  function getComboQty(roleLabel, comboCode, listToUse) { const targetRole = matchRoleCode(roleLabel); const found = listToUse.find(c => { let cRole = c.role || 'TV'; if (cRole === 'Thu Ngân') cRole = 'TN'; if (cRole === 'Kho') cRole = 'Kho'; if (cRole === 'Giao Hàng') cRole = 'GH'; return c.code === comboCode && cRole === targetRole; }); return found ? found.qty : 0; }
  function updateComboQty(roleLabel, comboCode, newQty) { const targetRole = matchRoleCode(roleLabel); const qtyVal = parseInt(newQty) || 0; let currentList = [...activeSuggestedCombos]; const idx = currentList.findIndex(c => { let cRole = c.role || 'TV'; if (cRole === 'Thu Ngân') cRole = 'TN'; if (cRole === 'Kho') cRole = 'Kho'; if (cRole === 'Giao Hàng') cRole = 'GH'; return c.code === comboCode && cRole === targetRole; }); let saveRoleLabel = targetRole; if(saveRoleLabel === 'TN') saveRoleLabel = 'Thu Ngân'; if (idx >= 0) { currentList[idx].qty = qtyVal; } else if (qtyVal > 0) { currentList.push({ code: comboCode, role: saveRoleLabel, label: `${roleLabel} ${comboCode}`, qty: qtyVal }); } if (activeMatrixMode === 'weekday') suggestedCombos = currentList; else suggestedWeekendCombos = currentList; }
  function getRoleTotal(roleId, matrix) { return Object.values(matrix).reduce((sum, s) => sum + (parseInt(s[roleId])||0), 0); }
  function getShiftTotal(shiftId, matrix) { const s = matrix[shiftId] || {}; return (parseInt(s.kho)||0) + (parseInt(s.tn)||0) + (parseInt(s.tv)||0) + (parseInt(s.gh)||0); }
  function getGrandTotal(matrix) { return Object.values(matrix).reduce((sum, s) => sum + (parseInt(s.kho)||0) + (parseInt(s.tn)||0) + (parseInt(s.tv)||0) + (parseInt(s.gh)||0), 0); }
  async function handleCalculateCombos(save = true) { 
      if(save) isLoading = true;
      try { 
          const clean = (m) => { const c = JSON.parse(JSON.stringify(m)); Object.keys(c).forEach(key => { if(c[key]) ['kho', 'tn', 'tv', 'gh'].forEach(role => { let val = parseInt(c[key][role]); if (isNaN(val)) val = 0; c[key][role] = val; }); }); return c; };
          shiftMatrix = clean(shiftMatrix); weekendMatrix = clean(weekendMatrix);
          await tick(); showShortageAlert = false; shortageCount = 0;
          let tempWeekday = calculateCombosFromMatrix(shiftMatrix); let tempWeekend = calculateCombosFromMatrix(weekendMatrix);
          const checkShortage = (combos) => { const totalDemand = combos.reduce((sum, c) => sum + (parseInt(c.qty)||0), 0); return totalDemand > staffStats.total ? (totalDemand - staffStats.total) : 0; };
          const s1 = checkShortage(tempWeekday); const s2 = checkShortage(tempWeekend);
          if (s1 > 0 || s2 > 0) { shortageCount = Math.max(s1, s2); showShortageAlert = true; if (isPeakMode) { suggestedCombos = suggestPeakCombos(tempWeekday, s1); suggestedWeekendCombos = suggestPeakCombos(tempWeekend, s2); } else { suggestedCombos = tempWeekday; suggestedWeekendCombos = tempWeekend; } } else { suggestedCombos = tempWeekday; suggestedWeekendCombos = tempWeekend; }
          if(save) { await setDoc(doc(db, 'settings', `shift_matrix_${targetStore}`), { matrix: shiftMatrix, approvedCombos: suggestedCombos, weekendMatrix: weekendMatrix, weekendCombos: suggestedWeekendCombos, genderConfig, updatedAt: serverTimestamp(), updatedBy: $currentUser.username }); } 
      } catch (e) { alert("Lỗi tính toán: " + e.message); } finally { if(save) isLoading = false; } 
  }
  function togglePeakMode() { isPeakMode = !isPeakMode; if (isPeakMode) { handleCalculateCombos(true); } }
  function confirmEnablePeak() { showShortageAlert = false; isPeakMode = true; handleCalculateCombos(true); }
  async function handleGeneratePreview() { 
      if (totalCombos > staffStats.total && !isPeakMode) { alert(`⛔ KHÔNG THỂ TẠO LỊCH!\n\nNhu cầu đang cần ${totalCombos} vị trí, nhưng chỉ có ${staffStats.total} nhân viên.`); return; }
      if (suggestedCombos.length === 0 && suggestedWeekendCombos.length === 0) return alert("Chưa có combo nào!");
      isLoading = true; 
      try { 
          let prevMonth = scheduleMonth - 1, prevYear = scheduleYear; if(prevMonth === 0) { prevMonth = 12; prevYear--; } 
          let prevScheduleData = null;
          const prevSnap = await getDoc(doc(db, 'stores', targetStore, 'schedules', `${prevYear}-${String(prevMonth).padStart(2,'0')}`)); 
          if(prevSnap.exists()) prevScheduleData = prevSnap.data();
          const comboPayload = { weekday: suggestedCombos, weekend: suggestedWeekendCombos };
          const result = generateMonthlySchedule(scheduleStaffList, comboPayload, scheduleMonth, scheduleYear, prevScheduleData, genderConfig);
          originalResult = JSON.parse(JSON.stringify(result)); previewScheduleData = result.schedule; previewStats = result.staffStats; optimizationLogs = []; 
          await tick();
          setTimeout(() => { const previewEl = document.getElementById('preview-schedule-container'); if(previewEl) previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
      } catch (e) { alert("Lỗi: " + e.message); } finally { isLoading = false; } 
  }
  function isWeekendDay(d) { const date = new Date(scheduleYear, scheduleMonth - 1, d); const dayOfWeek = date.getDay(); return (dayOfWeek === 0 || dayOfWeek === 6); }
  function getShiftGroup(code) { const def = SHIFT_DEFINITIONS.find(s => s.code === code); return def ? def.group : 'OFF'; }
  function isHardRole(roleName) { return ['Kho', 'Thu Ngân', 'Giao Hàng', 'GH', 'TN', 'K'].includes(roleName); }
  function getWeekendFairnessStatus(staffId) {
      if (inspectionMode !== 'weekend' || !previewScheduleData) return 0;
      const allStats = previewStats.map(s => {
          let count = 0;
          Object.keys(previewScheduleData).forEach(d => {
              if (isWeekendDay(d)) {
                  const assign = previewScheduleData[d].find(a => a.staffId === s.id);
                  if (assign && isHardRole(assign.role)) count++;
              }
          });
          return { id: s.id, count };
      });
      const counts = allStats.map(x => x.count);
      const max = Math.max(...counts);
      const min = Math.min(...counts);
      const myStat = allStats.find(x => x.id === staffId);
      if (!myStat) return 0;
      if (max - min <= 1) return 0; 
      if (myStat.count === max) return 1; 
      if (myStat.count === min) return -1; 
      return 0;
  }
  function checkInspectionError(d, assign, currentMode) {
      const mode = currentMode || inspectionMode;
      if (mode === 'none') return false;
      if (!assign || assign.shift === 'OFF') return false;
      if (mode === 'gender') {
          if (genderConfig.kho === 'none' && genderConfig.tn === 'none') return false;
          const dayAssignments = previewScheduleData[d] || [];
          const sameShiftRole = dayAssignments.filter(a => a.shift === assign.shift && a.role === assign.role && a.shift !== 'OFF');
          if (assign.role === 'Kho') {
              if (genderConfig.kho === 'male_only' && !assign.gender.toLowerCase().includes('nam')) return `Kho ca ${assign.shift} yêu cầu Nam`;
              if (genderConfig.kho === 'mixed') {
                  const hasMale = sameShiftRole.some(a => a.gender === 'Nam');
                  if (!hasMale) return `Kho ca ${assign.shift} thiếu Nam`;
              }
          }
          if (assign.role === 'Thu Ngân') {
              if (genderConfig.tn === 'female_only' && assign.gender === 'Nam') return `TN ca ${assign.shift} yêu cầu Nữ`;
              if (genderConfig.tn === 'mixed') {
                  const hasMale = sameShiftRole.some(a => a.gender === 'Nam');
                  const hasFemale = sameShiftRole.some(a => a.gender !== 'Nam');
                  if (!hasMale || !hasFemale) return `TN ca ${assign.shift} thiếu cặp đôi`;
              }
          }
          return false;
      }
      if (mode === 'weekend') {
          if (!isWeekendDay(d) || !isHardRole(assign.role)) return false;
          const rowStatus = getWeekendFairnessStatus(assign.staffId);
          if (rowStatus === 1) return "Dư ca nghiệp vụ cuối tuần (Cần giảm tải)";
          return false;
      }
      if (mode === 'rotation') {
          if (d == 1) return false;
          const prevDayData = previewScheduleData[d-1];
          const prevAssign = prevDayData?.find(a => a.staffId === assign.staffId);
          if (!prevAssign || prevAssign.shift === 'OFF') return false;
          const gCurrent = getShiftGroup(assign.shift);
          const gPrev = getShiftGroup(prevAssign.shift);
          if (gCurrent !== 'OFF' && gCurrent !== 'GAY' && gCurrent !== 'FULL' && gCurrent !== 'EXTREME' && gCurrent === gPrev) return `Lặp lại nhóm ca ${gCurrent} (Sáng-Sáng/Chiều-Chiều)`;
          return false;
      }
      if (mode === 'fatigue') {
          if (d == 1) return false;
          const prevDayData = previewScheduleData[d-1];
          const prevAssign = prevDayData?.find(a => a.staffId === assign.staffId);
          if (!prevAssign || !prevAssign.role) return false; 
          if (isHardRole(prevAssign.role) && isHardRole(assign.role)) {
              return `Làm nghiệp vụ liên tiếp 2 ngày (Hôm qua: ${prevAssign.role})`;
          }
          return false;
      }
      return false;
  }
  function handleDayHeaderClick(d) {
      if (inspectionMode !== 'none') {
          console.log(`[DEBUG] Inspecting Day ${d} with Mode: ${inspectionMode}`);
          const errors = [];
          previewScheduleData[d].forEach(assign => {
              const msg = checkInspectionError(d, assign, inspectionMode);
              if (msg && typeof msg === 'string') {
                  errors.push(`- ${assign.name}: ${msg}`);
              }
          });
          if (errors.length > 0) {
              alert(`⚠️ CÁC LỖI NGÀY ${d}/${scheduleMonth}:\n\n${errors.join('\n')}`);
          } else {
              alert(`✅ Ngày ${d}/${scheduleMonth} không có lỗi vi phạm cho chế độ này.`);
          }
      } else {
          showDayStats(d);
      }
  }
  function isCellRelevant(d, assign, currentMode) {
      const mode = currentMode || inspectionMode;
      if (mode === 'none') return true; 
      if (checkInspectionError(d, assign, mode)) return true; 
      if (mode === 'weekend' && isWeekendDay(d)) return true;
      if (mode === 'rotation') return true; 
      return false;
  }
  function handleAutoFixRotation() {
      if (!previewScheduleData) return;
      isLoading = true;
      setTimeout(() => {
          const result = autoFixRotation(previewScheduleData, scheduleMonth, scheduleYear);
          if (result.success) {
              previewScheduleData = result.schedule;
              optimizationLogs = [...optimizationLogs, ...result.logs];
              alert(`✅ Đã sửa thành công ${result.count} cặp lỗi nhịp!\n\nChi tiết:\n${result.logs.join('\n')}`);
          } else {
              alert("✅ Hệ thống đã tối ưu.");
          }
          isLoading = false;
      }, 300);
  }
  function handleAutoFixWeekend() {
      if (!previewScheduleData) return;
      isLoading = true;
      setTimeout(() => {
          const result = autoFixWeekendFairness(previewScheduleData, scheduleMonth, scheduleYear, scheduleStaffList);
          if (result.success) {
              previewScheduleData = result.schedule;
              optimizationLogs = [...optimizationLogs, ...result.logs];
              previewStats = [...previewStats]; 
              alert(`✅ Đã cân bằng lại ${result.count} ca cuối tuần!\n\nChi tiết:\n${result.logs.join('\n')}`);
          } else {
              alert("✅ Hệ thống đã tối ưu.");
          }
          isLoading = false;
      }, 300);
  }
  function handleAutoFixGender() {
      if (!previewScheduleData) return;
      const dryRun = autoFixGenderBalance(previewScheduleData, scheduleMonth, scheduleYear, false);
      if (!dryRun.success && !dryRun.hasConflict) {
          alert("✅ Không tìm thấy lỗi giới tính nào có thể sửa tự động (hoặc đã tối ưu).");
          return;
      }
      if (dryRun.hasConflict) {
          const confirmMsg = `⚠️ CẢNH BÁO XUNG ĐỘT!\n\nHệ thống phát hiện việc cân bằng giới tính sẽ gây ra lỗi Xoay Ca (Sáng-Sáng/Chiều-Chiều) tại các ngày:\n${dryRun.conflicts.slice(0,3).join('\n')}\n(và ${dryRun.conflicts.length - 3} lỗi khác...)\n\nBạn có muốn BỎ QUA luật xoay ca để ưu tiên Giới tính không?`;
          if (confirm(confirmMsg)) {
              const forceFix = autoFixGenderBalance(previewScheduleData, scheduleMonth, scheduleYear, true);
              previewScheduleData = forceFix.schedule;
              optimizationLogs = [...optimizationLogs, ...forceFix.logs];
              alert(`✅ Đã sửa ${forceFix.count} lỗi giới tính (Chấp nhận gãy nhịp)!`);
          }
      } else {
          previewScheduleData = dryRun.schedule;
          optimizationLogs = [...optimizationLogs, ...dryRun.logs];
          alert(`✅ Đã sửa thành công ${dryRun.count} lỗi giới tính (An toàn)!`);
      }
  }
  function getWeekendHardRoleCount(staffId) {
      if (!previewScheduleData) return 0;
      let count = 0;
      Object.keys(previewScheduleData).forEach(d => {
          if (isWeekendDay(d)) {
              const assign = previewScheduleData[d].find(a => a.staffId === staffId);
              if (assign && isHardRole(assign.role)) count++;
          }
      });
      return count;
  }
  function handleOptimize() { if (!previewScheduleData) return; const beforeOptimizeJSON = JSON.stringify(previewScheduleData); isLoading = true; setTimeout(() => { const optResult = optimizeSchedule(previewScheduleData, scheduleStaffList); const afterOptimizeJSON = JSON.stringify(optResult.optimizedSchedule); if (beforeOptimizeJSON === afterOptimizeJSON) { alert("✅ Lịch hiện tại đã tối ưu! Không tìm thấy điểm cần điều chỉnh."); isLoading = false; return; } previewScheduleData = optResult.optimizedSchedule; const newRoleStats = {}; optResult.finalStats.forEach(s => newRoleStats[s.id] = s.roles); previewStats = previewStats.map(s => { if (newRoleStats[s.id]) { return { ...s, ...newRoleStats[s.id] }; } return s; }); optimizationLogs = optResult.changesLog; isLoading = false; }, 200); }
  function handleResetPreview() { if (originalResult) { previewScheduleData = JSON.parse(JSON.stringify(originalResult.schedule)); previewStats = JSON.parse(JSON.stringify(originalResult.staffStats)); optimizationLogs = []; } }
  async function handleApplySchedule() { if (!previewScheduleData) return; if (!confirm(`⚠️ XÁC NHẬN ÁP DỤNG LỊCH THÁNG ${scheduleMonth}/${scheduleYear}?`)) return; isLoading = true; try { const scheduleId = `${scheduleYear}-${String(scheduleMonth).padStart(2,'0')}`; await setDoc(doc(db, 'stores', targetStore, 'schedules', scheduleId), { config: { matrix: shiftMatrix, approvedCombos: suggestedCombos, genderConfig }, data: previewScheduleData, stats: previewStats, endOffset: originalResult.endOffset, updatedAt: serverTimestamp(), updatedBy: $currentUser.username }); alert("✅ Đã áp dụng lịch thành công!"); dispatch('close'); dispatch('switchTab', 'schedule'); } catch (e) { alert("Lỗi: " + e.message); } finally { isLoading = false; } }
  function getWeekday(day) { const date = new Date(scheduleYear, scheduleMonth - 1, day); return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]; }
  function toggleDay(d) { if (selectedDays.includes(d)) { if (selectedDays.length > 1) selectedDays = selectedDays.filter(x => x !== d); } else selectedDays = [...selectedDays, d]; }
  function openEditPreviewShift(day, staffId, assign) { const staffInfo = previewStats.find(s => s.id === staffId); tempEditingShift = { day, staffId, name: assign.name, shift: assign.shift, role: assign.role || 'TV', isOFF: assign.shift === 'OFF', gender: staffInfo ? staffInfo.gender : 'Nữ', originalRole: assign.originalRole !== undefined ? assign.originalRole : (assign.role || 'TV'), originalShift: assign.originalShift !== undefined ? assign.originalShift : assign.shift }; editingShift = JSON.parse(JSON.stringify(tempEditingShift)); }
  function resetEditPreviewShift() { if (!editingShift) return; editingShift.shift = editingShift.originalShift; editingShift.role = editingShift.originalRole; editingShift.isOFF = editingShift.shift === 'OFF'; }
  function savePreviewShiftChange() { if (!editingShift || !previewScheduleData) return; const dayKey = String(editingShift.day); const dayList = [...previewScheduleData[dayKey]]; const idx = dayList.findIndex(x => x.staffId === editingShift.staffId); if (idx !== -1) { const oldRole = dayList[idx].role || 'TV'; const newRole = editingShift.isOFF ? '' : (editingShift.role === 'TV' ? '' : editingShift.role); dayList[idx] = { ...dayList[idx], shift: editingShift.isOFF ? 'OFF' : editingShift.shift, role: newRole, isChanged: true }; previewScheduleData[dayKey] = dayList; const newStats = [...previewStats]; const statIdx = newStats.findIndex(s => s.id === editingShift.staffId); if (statIdx !== -1) { const s = newStats[statIdx]; let rOld = oldRole === 'Giao Hàng' ? 'gh' : (oldRole === 'Thu Ngân' ? 'tn' : (oldRole === 'Kho' ? 'kho' : '')); if(rOld) s[rOld] = Math.max(0, (s[rOld]||0) - 1); let rNew = newRole === 'Giao Hàng' ? 'gh' : (newRole === 'Thu Ngân' ? 'tn' : (newRole === 'Kho' ? 'kho' : '')); if(rNew) s[rNew] = (s[rNew]||0) + 1; previewStats = newStats; } editingShift = null; } }
  function viewPersonalSchedule(staffId, staffName) { if(!previewScheduleData) return; let days = []; Object.keys(previewScheduleData).sort((a,b)=>Number(a)-Number(b)).forEach(d => { const assign = previewScheduleData[d].find(x => x.staffId === staffId); if(assign) days.push({ day: d, weekday: getWeekday(d), ...assign }); }); const firstDayDate = new Date(scheduleYear, scheduleMonth - 1, 1); let startDayIdx = firstDayDate.getDay(); if (startDayIdx === 0) startDayIdx = 6; else startDayIdx = startDayIdx - 1; let blankCells = Array(startDayIdx).fill(null); const stat = previewStats.find(s => s.id === staffId) || { totalHours:0, gh:0, tn:0, kho:0 }; selectedStaff = { id: staffId, name: staffName, days, blankCells, stats: stat }; }
  function showDayStats(day) { if (!previewScheduleData || !previewScheduleData[day]) return; const dayData = previewScheduleData[day]; const roles = ['Kho', 'Thu Ngân', 'GH', 'TV']; const matrix = { 'Kho': {}, 'Thu Ngân': {}, 'GH': {}, 'TV': {} }; const activeShifts = new Set(); let totalHours = 0; dayData.forEach(assign => { if (assign.shift !== 'OFF') { activeShifts.add(assign.shift); const def = SHIFT_DEFINITIONS.find(s => s.code === assign.shift); if (def) totalHours += def.hours; } }); const cols = Array.from(activeShifts).sort(); roles.forEach(r => { cols.forEach(c => matrix[r][c] = 0); matrix[r]['Total'] = 0; }); dayData.forEach(assign => { if (assign.shift === 'OFF') return; let r = assign.role || 'TV'; if (r === 'TN') r = 'Thu Ngân'; if (matrix[r]) { matrix[r][assign.shift] = (matrix[r][assign.shift] || 0) + 1; matrix[r]['Total']++; } }); selectedDayStats = { day, weekday: getWeekday(day), cols, matrix, roles, totalHours }; }
  function getDayColTotal(col) { return selectedDayStats ? selectedDayStats.roles.reduce((sum, r) => sum + (selectedDayStats.matrix[r][col]||0), 0) : 0; }
  function getDayGrandTotal() { return selectedDayStats ? selectedDayStats.roles.reduce((sum, r) => sum + selectedDayStats.matrix[r]['Total'], 0) : 0; }
  // ... (Other functions kept as is)
  async function saveTemplate() { const today = new Date(); const currentDay = today.getDay(); const isNew = editingTemplateIndex === -1; taskTemplate.update(curr => { const up = { ...$taskTemplate }; if (!up[activeTemplateType]) up[activeTemplateType] = []; const newItem = { title: newTemplateTitle, time: newTemplateTime, isImportant: newTemplateImportant, days: selectedDays }; if (editingTemplateIndex >= 0) up[activeTemplateType][editingTemplateIndex] = newItem; else up[activeTemplateType].push(newItem); up[activeTemplateType].sort((a,b) => (a.time||"00:00").localeCompare(b.time||"00:00")); myStores.forEach(sid => setDoc(doc(db, 'settings', `template_${sid}`), up)); return up; }); if (isNew && selectedDays.includes(currentDay)) { try { const batchPromises = myStores.map(sid => { return addDoc(collection(db, 'tasks'), { type: activeTemplateType, title: newTemplateTitle, timeSlot: newTemplateTime, completed: false, completedBy: null, time: null, note: '', createdBy: 'Admin', date: getTodayStr(), storeId: sid, isImportant: newTemplateImportant, timestamp: serverTimestamp() }); }); await Promise.all(batchPromises); } catch (e) { console.error("Lỗi tạo task nhanh:", e); } } newTemplateTitle = ''; newTemplateImportant = false; editingTemplateIndex = -1; selectedDays = [0,1,2,3,4,5,6]; }
  function editTemplate(idx, item) { editingTemplateIndex = idx; newTemplateTitle = item.title; newTemplateTime = item.time; newTemplateImportant = item.isImportant || false; selectedDays = item.days || [0,1,2,3,4,5,6]; }
  function deleteTemplate(idx) { if(!confirm("Xóa?")) return; taskTemplate.update(curr => { const up = {...curr}; up[activeTemplateType].splice(idx, 1); myStores.forEach(sid => setDoc(doc(db, 'settings', `template_${sid}`), up)); return up; }); if(editingTemplateIndex === idx) { editingTemplateIndex = -1; newTemplateTitle = ''; } }
  function downloadScheduleSample() { const wb = utils.book_new(); const wsData = [["Ho_Ten", "Gioi_Tinh", "Ma_Kho"], ["Nguyễn Văn A", "Nam", targetStore], ["Trần Thị B", "Nữ", targetStore]]; const ws = utils.aoa_to_sheet(wsData); utils.book_append_sheet(wb, ws, "DS_Nhan_Vien"); writeFile(wb, `Mau_Phan_Ca_${targetStore}.xlsx`); }
  function downloadAccountSample() { const wb = utils.book_new(); const wsData = [["username", "pass", "ma_kho", "role"], [`nv1_${targetStore}`, "123456", targetStore, "staff"], [`quanly_${targetStore}`, "123456", targetStore, "admin"]]; const ws = utils.aoa_to_sheet(wsData); utils.book_append_sheet(wb, ws, "DS_Cap_Quyen"); writeFile(wb, `Mau_Tai_Khoan_${targetStore}.xlsx`); }
  async function loadAccountList() { if (!targetStore) return; try { const q = query(collection(db, 'users'), where('storeIds', 'array-contains', targetStore)); const snap = await getDocs(q); const list = []; snap.forEach(d => list.push({id: d.id, ...d.data()})); accountList = list; } catch (e) { console.error("Load accounts failed:", e); } }
  async function deleteAccount(uid) { if (checkDemoAndBlock()) return; if (!confirm(`Xóa tài khoản ${uid}?`)) return; try { await deleteDoc(doc(db, 'users', uid)); await loadAccountList(); } catch (e) { alert("Lỗi xóa: " + e.message); } }
  async function changeRole(uid, newRole) { if (checkDemoAndBlock()) return; if (!confirm(`Đổi quyền tài khoản ${uid}?`)) return; try { await updateDoc(doc(db, 'users', uid), { role: newRole }); await loadAccountList(); } catch (e) { alert("Lỗi đổi quyền: " + e.message); } }
  async function resetPassword(uid) { if (checkDemoAndBlock()) return; if (!confirm(`Reset mật khẩu cho ${uid}?`)) return; try { await updateDoc(doc(db, 'users', uid), { pass: '123456' }); alert("OK"); } catch (e) { alert("Lỗi: " + e.message); } }
  async function handleCreateSingleUser() { if (checkDemoAndBlock()) return; if (!singleUsername || !singlePass) return alert("Thiếu thông tin!"); const uid = safeString(singleUsername).toLowerCase(); isLoading = true; const batch = writeBatch(db); try { batch.set(doc(db, 'users', uid), { username: uid, username_idx: uid, pass: singlePass, name: uid, gender: singleGender, role: singleRole, storeId: targetStore, storeIds: [targetStore], createdAt: serverTimestamp() }); const newStaffEntry = { id: String(scheduleStaffList.length + 1 + Date.now()%100), name: uid, gender: singleGender }; const updatedStaffList = [...scheduleStaffList, newStaffEntry]; batch.set(doc(db, 'settings', `staff_list_${targetStore}`), { staffList: updatedStaffList, updatedAt: serverTimestamp() }); await batch.commit(); alert("OK"); showAddUserModal = false; await loadStoreData(); await loadAccountList(); } catch (e) { alert(e.message); } finally { isLoading = false; } }
  async function handleCreateAdmin() { if (checkDemoAndBlock()) return; if (!newAdminUser || !newAdminPass) return alert("Thiếu thông tin!"); isLoading = true; try { const u = safeString(newAdminUser).toLowerCase(); await setDoc(doc(db, 'users', u), { username: u, username_idx: u, pass: newAdminPass, name: u, role: 'admin', storeId: newAdminStore, storeIds: [newAdminStore], createdAt: serverTimestamp() }); alert("OK"); newAdminUser=''; } catch (e) { alert(e.message); } finally { isLoading = false; } }
  async function handleStaffUpload(e) { const file = e.target.files[0]; if(!file) return; isLoading = true; setTimeout(async () => { try { const data = await file.arrayBuffer(); const wb = read(data); const json = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); let newStaff = []; for(let i=0; i<json.length; i++) { const row = json[i]; let maKho = row['Ma_Kho'] || row['Mã Kho'] || ''; if (String(maKho).trim() !== String(targetStore)) continue; let name = row['Ho_Ten'] || row['Họ Tên'] || ''; let gender = row['Gioi_Tinh'] || row['Giới Tính'] || 'Nữ'; if(name) newStaff.push({id: String(newStaff.length+1), name: safeString(name), gender: String(gender).toLowerCase().includes('nam')?'Nam':'Nữ'}); } if(newStaff.length>0) { scheduleStaffList = newStaff; await setDoc(doc(db, 'settings', `staff_list_${targetStore}`), { staffList: scheduleStaffList, updatedAt: serverTimestamp() }); alert("OK"); } } catch(e) { alert(e.message); } finally { isLoading=false; e.target.value=null; } }, 100); }
  async function handleAccountUpload(e) { const file = e.target.files[0]; if(!file) return; isLoading = true; setTimeout(async () => { try { const data = await file.arrayBuffer(); const wb = read(data); const json = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); const batch = writeBatch(db); let c = 0; json.forEach(row => { const u = row['username']; const p = row['pass']; const s = row['ma_kho']; const r = row['role']; if(u&&p&&s&&r) { const uid = safeString(u).toLowerCase(); batch.set(doc(db, 'users', uid), { username: uid, username_idx: uid, pass: String(p), name: uid, role: safeString(r).toLowerCase(), storeId: String(s), storeIds: [String(s)], createdAt: serverTimestamp() }); c++; } }); if(c>0) { await batch.commit(); alert("OK"); await loadAccountList(); } } catch(e) { alert(e.message); } finally { isLoading=false; e.target.value=null; } }, 100); }
</script>

<svelte:window on:click={handleWindowClick} />

<div class="fixed inset-0 z-50 bg-slate-100 flex flex-col animate-fadeIn">
    <div class="h-16 bg-white border-b border-slate-200 flex items-center justify-center lg:justify-between px-6 shrink-0 shadow-sm z-20">
        <div class="flex items-center gap-6">
            <button class="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-all text-slate-500 hover:text-indigo-600" on:click={() => dispatch('close')}><span class="material-icons-round">arrow_back</span></button>
            <h2 class="text-xl font-bold text-slate-800 tracking-tight hidden lg:block">Quản Trị</h2>
            <div class="flex items-center gap-2">
                <button class="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200" on:click={()=>showStoreConfig=true} title="Cấu hình giờ ca">
                    <span class="material-icons-round text-sm">settings</span>
                </button>
                <div id="store-select-container" class="relative">
                    <select bind:value={targetStore} class="pl-3 pr-8 py-1.5 bg-indigo-50 border-indigo-100 text-indigo-700 font-bold rounded-lg text-sm outline-none appearance-none cursor-pointer hover:bg-indigo-100 transition-colors">
                        {#each myStores as s}<option value={s}>{s}</option>{/each}
                    </select>
                    <span class="material-icons-round absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 text-sm pointer-events-none">expand_more</span>
                </div>
                <div class="flex bg-slate-100 p-1 rounded-lg ml-2">
                    <button class="px-4 py-1.5 rounded-md text-sm font-bold transition-all {activeSection==='schedule'?'bg-white text-indigo-600 shadow-sm':'text-slate-500 hover:text-slate-700'}" on:click={() => activeSection = 'schedule'}>Phân Ca</button>
                    <button class="px-4 py-1.5 rounded-md text-sm font-bold transition-all {activeSection==='template'?'bg-white text-orange-600 shadow-sm':'text-slate-500 hover:text-slate-700'}" on:click={() => activeSection = 'template'}>Tạo công việc</button>
                    <button class="px-4 py-1.5 rounded-md text-sm font-bold transition-all {activeSection==='accounts'?'bg-white text-blue-600 shadow-sm':'text-slate-500 hover:text-slate-700'}" on:click={() => activeSection = 'accounts'}>Nhân Sự</button>
                </div>
            </div>
        </div>
    </div>

    <div class="flex-1 overflow-auto p-4 lg:p-6 relative">
        {#if activeSection === 'schedule'}
            <div class="flex flex-col gap-6 w-full pb-20">
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 shrink-0">
                    <div id="matrix-card" class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[600px]">
                        <div class="h-[120px] p-3 border-b border-slate-100 flex flex-col gap-2 justify-center bg-slate-50/50 shrink-0">
                            <div class="flex justify-between items-center">
                                <h3 class="font-bold text-slate-800 text-lg mr-4 shrink-0">Định Mức Nhân Sự</h3>
                                {#if staffStats.total > 0}
                                    <div class="flex items-center gap-3 text-[10px] font-bold bg-white text-slate-600 px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                                        <div class="flex items-center gap-1"><span class="material-icons-round text-xs text-slate-400">groups</span> <span>{staffStats.total}</span></div>
                                        <div class="w-px h-3 bg-slate-200"></div>
                                        <div class="flex items-center gap-1 text-blue-600"><span class="material-icons-round text-xs">male</span> <span>{staffStats.male}</span></div>
                                        <div class="w-px h-3 bg-slate-200"></div>
                                        <div class="flex items-center gap-1 text-pink-600"><span class="material-icons-round text-xs">female</span> <span>{staffStats.female}</span></div>
                                    </div>
                                {/if}
                            </div>
                            <div class="flex justify-between items-center">
                                <div class="bg-slate-200 p-1 rounded-lg flex gap-1">
                                    <button class="px-3 py-1 rounded-md text-xs font-bold transition-all {activeMatrixMode==='weekday'?'bg-white text-indigo-600 shadow-sm':'text-slate-500 hover:text-slate-700'}" on:click={() => activeMatrixMode = 'weekday'}>Thứ 2 - Thứ 6</button>
                                    <button class="px-3 py-1 rounded-md text-xs font-bold transition-all {activeMatrixMode==='weekend'?'bg-orange-100 text-orange-600 shadow-sm':'text-slate-500 hover:text-slate-700'}" on:click={() => activeMatrixMode = 'weekend'}>Thứ 7 & CN 🔥</button>
                                </div>
                                <div class="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm shrink-0">
                                    <button class="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded" on:click={()=>{if(scheduleMonth==1){scheduleMonth=12;scheduleYear--}else{scheduleMonth--}}}><span class="material-icons-round text-xs">chevron_left</span></button>
                                    <div class="flex items-center gap-1 font-bold text-slate-700 text-xs px-1"><span>T</span><input type="number" bind:value={scheduleMonth} class="w-8 text-center bg-transparent outline-none text-indigo-600"><span>/</span><input type="number" bind:value={scheduleYear} class="w-12 text-center bg-transparent outline-none text-indigo-600"></div>
                                    <button class="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded" on:click={()=>{if(scheduleMonth==12){scheduleMonth=1;scheduleYear++}else{scheduleMonth++}}}><span class="material-icons-round text-xs">chevron_right</span></button>
                                </div>
                            </div>
                        </div>
                        <div id="matrix-table" class="flex-1 overflow-auto p-4 relative {activeMatrixMode==='weekend'?'bg-orange-50/30':''}">
                             <table class="w-full text-sm border-separate border-spacing-0 rounded-xl border border-slate-200">
                                 <thead class="bg-slate-50 text-slate-500 sticky top-0 z-10"><tr><th class="p-3 text-left font-bold border-b border-r border-slate-200 bg-slate-50">Bộ Phận</th>{#each shiftCols as col}<th class="p-2 text-center border-b border-slate-200 border-l border-white min-w-[60px] bg-slate-50"><div class="font-black text-slate-700">{col.id.toUpperCase()}</div></th>{/each}<th class="p-3 text-center font-bold bg-slate-100 border-b border-l border-slate-200 text-slate-700 sticky right-0">Tổng</th></tr></thead>
                                <tbody>
                                    {#each roleRows as role}
                                        <tr class="group hover:bg-slate-50/50 transition-colors">
                                            <td class="p-3 font-bold border-r border-slate-100 {role.color} border-l-4">{role.label}</td>
                                            {#each shiftCols as shift}
                                                <td class="p-1 border-r border-slate-100 text-center">
                                                    {#if activeMatrixMode === 'weekday'}
                                                        <input type="number" min="0" bind:value={shiftMatrix[shift.id][role.id]} class="w-full h-8 text-center font-bold outline-none rounded focus:bg-indigo-50 hover:bg-white text-slate-700 bg-transparent transition-all">
                                                    {:else}
                                                        <input type="number" min="0" bind:value={weekendMatrix[shift.id][role.id]} class="w-full h-8 text-center font-bold outline-none rounded focus:bg-orange-100 hover:bg-white text-orange-800 bg-transparent transition-all">
                                                    {/if}
                                                </td>
                                            {/each}
                                            <td class="p-3 text-center font-black text-slate-700 bg-slate-50 border-l border-slate-100 sticky right-0">{getRoleTotal(role.id, activeMatrixMode==='weekday'?shiftMatrix:weekendMatrix)}</td>
                                        </tr>
                                    {/each}
                                </tbody>
                                <tfoot class="bg-slate-800 text-slate-300 font-bold sticky bottom-0 z-10 shadow-lg">
                                    <tr>
                                        <td class="p-3 text-right text-xs uppercase tracking-wider bg-slate-800">Tổng</td>
                                        {#each shiftCols as shift}
                                            <td class="p-3 text-center text-yellow-400 font-mono text-sm font-bold bg-slate-800">{getShiftTotal(shift.id, activeMatrixMode==='weekday'?shiftMatrix:weekendMatrix)}</td>
                                        {/each}
                                         <td class="p-3 text-center text-white text-sm font-bold bg-slate-900 sticky right-0">{getGrandTotal(activeMatrixMode==='weekday'?shiftMatrix:weekendMatrix)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div class="h-[80px] p-4 border-t bg-white shrink-0 flex items-center">
                            <button id="btn-calculate" class="w-full h-12 bg-green-600 text-white font-bold rounded-xl shadow hover:bg-green-700 flex justify-center items-center gap-2" on:click={() => handleCalculateCombos(true)}><span class="material-icons-round">calculate</span> TÍNH TOÁN & QUY ĐỔI RA COMBO</button>
                        </div>
                    </div>
                    
                    <div id="combo-table" class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
                        <div class="h-[120px] p-3 border-b border-slate-100 flex flex-col gap-1 justify-start bg-slate-50/50 shrink-0 pt-4"> 
                             <div class="flex justify-between items-center">
                                 <h3 class="font-bold text-slate-800 text-lg">Combo Gợi Ý</h3>
                                 <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Có thể chỉnh sửa lại</p>
                             </div>
                             <div class="flex items-center gap-2 mt-2">
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <div class="relative">
                                        <input type="checkbox" class="sr-only" checked={isPeakMode} disabled={!showShortageAlert && !isPeakMode} on:change={togglePeakMode}>
                                        <div class="block bg-slate-200 w-10 h-6 rounded-full transition-colors {isPeakMode ? 'bg-red-500' : ''}"></div>
                                        <div class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition {isPeakMode ? 'translate-x-full' : ''}"></div>
                                    </div>
                                    <span class="text-xs font-bold {isPeakMode ? 'text-red-600' : 'text-slate-400'}">🔥 Chế độ Cao Điểm {isPeakMode ? '(Đang bật)' : ''}</span>
                                </label>
                             </div>
                        </div>
                        
                        <div id="combo-list" class="flex-1 overflow-auto p-4 relative {activeMatrixMode==='weekend'?'bg-orange-50/30':''}">
                             <table class="w-full text-sm border-separate border-spacing-0 rounded-xl border border-slate-200">
                                <thead class="bg-slate-50 text-slate-500 sticky top-0 z-10"><tr><th class="p-3 text-left font-bold border-b border-r border-slate-200 bg-slate-50">Bộ Phận</th>{#each comboCols as code}<th class="p-2 text-center border-b border-slate-200 border-l border-white min-w-[60px] bg-slate-50"><div class="font-black text-slate-700">{code}</div></th>{/each}</tr></thead>
                                <tbody>
                                    {#each roleRows as role}
                                        <tr class="group hover:bg-slate-50/50 transition-colors">
                                            <td class="p-3 font-bold border-r border-slate-100 {role.color} border-l-4">{role.label}</td>
                                            {#each comboCols as code}
                                                <td class="p-1 border-r border-slate-100 text-center"><input type="number" min="0" value={getComboQty(role.label, code, activeSuggestedCombos)} on:change={(e) => updateComboQty(role.label, code, e.target.value)} class="w-full h-8 text-center font-bold outline-none rounded focus:bg-indigo-50 hover:bg-white text-indigo-600 bg-transparent transition-all"></td>
                                            {/each}
                                        </tr>
                                    {/each}
                                </tbody>
                                <tfoot class="bg-slate-800 text-slate-300 font-bold sticky bottom-0 z-10 shadow-lg">
                                    <tr>
                                        <td class="p-3 text-right text-xs uppercase tracking-wider bg-slate-800">Tổng</td>
                                        {#each comboCols as code}
                                            <td class="p-3 text-center text-white text-sm font-bold bg-slate-900 border-l border-slate-700">{comboTotalsMap[code] || 0}</td>
                                        {/each}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div class="h-[80px] p-4 bg-white border-t border-slate-100 flex gap-2 shrink-0 relative items-center">
                             <div class="relative" bind:this={configDropdownNode}>
                                <button id="btn-config-toggle" class="h-12 px-4 flex items-center justify-center bg-slate-100 text-slate-600 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors border border-slate-200 gap-2 font-bold text-xs" on:click={()=>showConfigDropdown=!showConfigDropdown}>
                                    <span class="material-icons-round">settings</span> <span>Cấu hình giới tính</span>
                                </button>
                                {#if showConfigDropdown}
                                    <div class="absolute bottom-full left-0 mb-3 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-50 animate-fadeIn arrow-bottom">
                                        <h4 class="text-xs font-bold text-slate-800 mb-3 border-b pb-2">TÙY CHỌN GIỚI TÍNH</h4>
                                        <div class="space-y-4">
                                            <div>
                                                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Yêu cầu Kho</label>
                                                <div class="flex bg-slate-50 rounded-lg border border-slate-200 p-1">
                                                    <button class="flex-1 py-1.5 text-[10px] font-bold rounded {genderConfig.kho==='none'?'bg-white shadow text-indigo-700':'text-slate-400 hover:text-slate-600'}" on:click={()=>handleConfigChange('kho', 'none')}>Thoải mái</button>
                                                    <button class="flex-1 py-1.5 text-[10px] font-bold rounded {genderConfig.kho==='male_only'?'bg-white shadow text-indigo-700':'text-slate-400 hover:text-slate-600'}" on:click={()=>handleConfigChange('kho', 'male_only')}>Chỉ Nam</button>
                                                    <button class="flex-1 py-1.5 text-[10px] font-bold rounded {genderConfig.kho==='mixed'?'bg-white shadow text-indigo-700':'text-slate-400 hover:text-slate-600'}" on:click={()=>handleConfigChange('kho', 'mixed')}>Cặp Đôi</button>
                                                </div>
                                            </div>
                                            <div>
                                                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Yêu cầu Thu Ngân</label>
                                                <div class="flex bg-slate-50 rounded-lg border border-slate-200 p-1">
                                                    <button class="flex-1 py-1.5 text-[10px] font-bold rounded {genderConfig.tn==='none'?'bg-white shadow text-purple-700':'text-slate-400 hover:text-slate-600'}" on:click={()=>handleConfigChange('tn', 'none')}>Thoải mái</button>
                                                    <button class="flex-1 py-1.5 text-[10px] font-bold rounded {genderConfig.tn==='female_only'?'bg-white shadow text-purple-700':'text-slate-400 hover:text-slate-600'}" on:click={()=>handleConfigChange('tn', 'female_only')}>Chỉ Nữ</button>
                                                    <button class="flex-1 py-1.5 text-[10px] font-bold rounded {genderConfig.tn==='mixed'?'bg-white shadow text-purple-700':'text-slate-400 hover:text-slate-600'}" on:click={()=>handleConfigChange('tn', 'mixed')}>Cặp Đôi</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                {/if}
                             </div>

                             <button id="btn-preview" disabled={totalCombos===0} class="flex-1 h-12 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" on:click={handleGeneratePreview}>
                                 <span class="material-icons-round">calendar_view_month</span><span>XEM TRƯỚC LỊCH</span>
                             </button>
                        </div>
                    </div>
                </div>

                <div id="preview-schedule-container" class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-fadeIn scroll-mt-20 min-h-[500px]">
                    <div class="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center bg-slate-50/50 gap-4">
                        <div class="flex items-center gap-4">
                            <div><h3 class="font-bold text-slate-800 text-lg">Xem Trước & Tối Ưu Lịch</h3><p class="text-xs text-slate-400">Kiểm tra kỹ trước khi Áp dụng</p></div>
                            
                            <div class="relative group">
                                <label for="inspection-select" class="sr-only">Chế độ soi lỗi</label>
                                <div class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors select-none">
                                    <span class="material-icons-round text-sm {inspectionMode!=='none' ? 'animate-pulse' : 'text-slate-400'} {INSPECTION_OPTIONS.find(o=>o.val===inspectionMode)?.color}">
                                        {INSPECTION_OPTIONS.find(o=>o.val===inspectionMode)?.icon}
                                    </span>
                                    <select id="inspection-select" bind:value={inspectionMode} class="bg-transparent font-bold text-xs text-slate-700 outline-none cursor-pointer appearance-none pr-4">
                                        {#each INSPECTION_OPTIONS as opt}
                                            <option value={opt.val}>{opt.label}</option>
                                        {/each}
                                    </select>
                                    <span class="material-icons-round text-xs text-slate-400 absolute right-2 pointer-events-none">expand_more</span>
                                </div>
                            </div>

                            {#if inspectionMode === 'rotation'}
                                <button class="px-3 py-1.5 bg-orange-100 text-orange-700 font-bold rounded-lg hover:bg-orange-200 text-xs flex items-center gap-1 animate-pulse" on:click={handleAutoFixRotation}>
                                    <span class="material-icons-round text-sm">build</span> Sửa Nhịp Tự Động
                                </button>
                            {/if}
                            {#if inspectionMode === 'weekend'}
                                <button class="px-3 py-1.5 bg-indigo-100 text-indigo-700 font-bold rounded-lg hover:bg-indigo-200 text-xs flex items-center gap-1 animate-pulse" on:click={handleAutoFixWeekend}>
                                    <span class="material-icons-round text-sm">balance</span> Cân Bằng Tự Động
                                </button>
                            {/if}
                            {#if inspectionMode === 'gender'}
                                <button class="px-3 py-1.5 bg-pink-100 text-pink-700 font-bold rounded-lg hover:bg-pink-200 text-xs flex items-center gap-1 animate-pulse" on:click={handleAutoFixGender}>
                                    <span class="material-icons-round text-sm">wc</span> Cân Bằng Nam/Nữ
                                </button>
                            {/if}
                        </div>
                        <div class="flex gap-3">
                            <button id="btn-optimize" disabled={!previewScheduleData} class="px-4 py-2 bg-yellow-500 text-white font-bold rounded-lg shadow hover:bg-yellow-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" on:click={handleOptimize}><span class="material-icons-round text-sm">auto_fix_high</span> Tối Ưu</button>
                            <button id="btn-reset" disabled={!previewScheduleData} class="px-4 py-2 bg-gray-500 text-white font-bold rounded-lg shadow hover:bg-gray-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" on:click={handleResetPreview}><span class="material-icons-round text-sm">restart_alt</span> Reset</button>
                            <button id="btn-apply" disabled={!previewScheduleData} class="px-6 py-2 bg-green-600 text-white font-bold rounded-lg shadow hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" on:click={handleApplySchedule}><span class="material-icons-round text-sm">check_circle</span> ÁP DỤNG</button>
                        </div>
                    </div>
                    {#if !previewScheduleData}
                        <div class="p-10 text-center text-gray-400 flex flex-col items-center">
                            <span class="material-icons-round text-4xl mb-2 opacity-30">visibility_off</span>
                            <p class="text-sm">Chưa có dữ liệu xem trước.</p>
                        </div>
                    {:else}
                        {#if optimizationLogs.length > 0} <div class="bg-yellow-50 p-3 text-xs text-yellow-800 border-b border-yellow-100 max-h-32 overflow-y-auto"> <div class="font-bold mb-1">Đã thực hiện tối ưu:</div> {#each optimizationLogs as log}<div>• {log}</div>{/each} </div> {/if}
                        <div class="flex-1 overflow-x-auto p-4 max-h-[600px] relative scroll-smooth"> 
                            <table class="w-full text-xs text-center border-collapse min-w-[1500px]"> 
                                <thead class="bg-amber-400 text-slate-900 sticky top-0 z-[60] shadow-md"> 
                                    <tr> 
                                        <th rowspan="2" class="p-2 sticky left-0 bg-white border-r border-amber-200 z-[70] min-w-[140px] text-left pl-3 shadow">NHÂN SỰ</th> 
                                        {#each Object.keys(previewScheduleData).sort((a,b)=>Number(a)-Number(b)) as d} 
                                            <th class="p-1 border-l border-amber-500/30 min-w-[40px] text-xs font-black cursor-pointer hover:bg-amber-500 transition-colors select-none {['T7','CN'].includes(getWeekday(d))?'bg-amber-300':''} relative group" on:click={()=>handleDayHeaderClick(d)}>
                                                {d}
                                                {#if inspectionMode !== 'none'}
                                                    {@const hasError = previewScheduleData[d].some(assign => checkInspectionError(d, assign, inspectionMode))}
                                                    {#if hasError}
                                                        <span class="absolute top-0 right-0 w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                                                        <span class="absolute top-0 right-0 w-2 h-2 bg-red-600 rounded-full"></span>
                                                    {/if}
                                                {/if}
                                                <div class="absolute bottom-full mb-1 hidden group-hover:flex bg-black text-white text-[9px] p-1 rounded whitespace-nowrap z-50 left-1/2 -translate-x-1/2">
                                                    {inspectionMode!=='none'?'Xem lỗi':'Chi tiết'}
                                                </div>
                                            </th> 
                                        {/each} 
                                        <th rowspan="2" class="p-2 w-12 bg-white border-l border-amber-300 z-[70] font-bold text-[10px] text-slate-600">GIỜ</th>
                                        <th rowspan="2" class="p-2 w-10 bg-blue-100 text-[10px] border-l border-amber-300 font-bold text-blue-800">GH</th> 
                                        <th rowspan="2" class="p-2 w-10 bg-purple-100 text-[10px] border-l border-amber-300 font-bold text-purple-800">TN</th> 
                                        <th rowspan="2" class="p-2 w-10 bg-orange-100 text-[10px] border-l border-amber-300 font-bold text-orange-800">K</th> 
                                        <th rowspan="2" class="p-2 w-14 bg-indigo-100 text-[10px] border-l border-amber-300 font-bold text-indigo-800" title="Số ca nghiệp vụ T7/CN">WE<br>Ops</th>
                                    </tr> 
                                    <tr>
                                        {#each Object.keys(previewScheduleData).sort((a,b)=>Number(a)-Number(b)) as d}
                                            <th class="p-0.5 border-l border-amber-500/30 text-[9px] {['T7','CN'].includes(getWeekday(d))?'bg-amber-300/80 text-amber-900':'bg-amber-200/50 text-slate-700'}">{getWeekday(d)}</th>
                                        {/each}
                                    </tr>
                                </thead> 
                                <tbody class="divide-y text-xs"> 
                                    {#each previewStats as staff} 
                                        {@const weekendStatus = getWeekendFairnessStatus(staff.id)}
                                        {@const weCount = getWeekendHardRoleCount(staff.id)}
                                        
                                        <tr class="transition-colors"> 
                                            <td class="p-2 border font-bold text-left sticky left-0 z-[50] shadow-r cursor-pointer hover:text-indigo-600 transition-all {staff.gender==='Nam'?'text-blue-700':'text-pink-600'} {weekendStatus !== 0 && inspectionMode==='weekend' ? (weekendStatus===1?'bg-red-100 ring-inset ring-2 ring-red-400 z-[60]':'bg-green-100 ring-inset ring-2 ring-green-400 z-[60]') : 'bg-white'}" on:click={() => viewPersonalSchedule(staff.id, staff.name)}>
                                                {staff.name}
                                                {#if weekendStatus === 1}<span class="block text-[8px] text-red-500 font-normal animate-pulse">Quá tải cuối tuần</span>{/if}
                                                {#if weekendStatus === -1}<span class="block text-[8px] text-green-600 font-normal animate-pulse">Thiếu ca cuối tuần</span>{/if}
                                            </td> 
                                            
                                            {#each Object.keys(previewScheduleData).sort((a,b)=>Number(a)-Number(b)) as d} 
                                                {@const assign = previewScheduleData[d].find(x => x.staffId === staff.id)} 
                                                {@const errorMsg = checkInspectionError(d, assign, inspectionMode)}
                                                {@const isError = !!errorMsg}
                                                {@const relevant = isCellRelevant(d, assign, inspectionMode)}

                                                <td class="p-0.5 border-l border-gray-100 h-10 align-middle transition-all duration-300 
                                                    {assign?.isChanged ? 'bg-yellow-100' : ''} 
                                                    {['T7','CN'].includes(getWeekday(d))?'bg-amber-50/50':''} 
                                                    cursor-pointer 
                                                    {isError ? 'opacity-100 bg-white ring-4 ring-red-500 z-[60] scale-110 shadow-lg font-black' : 
                                                    (inspectionMode !== 'none' && !relevant ? 'opacity-25 grayscale blur-[0.5px]' : 'opacity-100 hover:bg-gray-100')}" 
                                                    on:click={()=>openEditPreviewShift(d, staff.id, assign)}
                                                    title={isError ? errorMsg : ''}> 
                                                    {#if assign && assign.shift !== 'OFF'} 
                                                        {@const badge = getRoleBadge(assign.role)}
                                                        <div class="w-full h-full rounded py-1 font-bold text-[10px] flex flex-col items-center justify-center shadow-sm {getShiftColor(assign.shift)}">
                                                            <span>{assign.shift}</span>
                                                            {#if badge}<span class="text-[8px] leading-none px-1 py-0.5 rounded mt-0.5 {badge.class}">{badge.text}</span>{/if}
                                                        </div> 
                                                    {/if} 
                                                </td> 
                                            {/each} 
                                            
                                            <td class="p-2 border font-bold text-center bg-white text-slate-700 border-l {inspectionMode!=='none'?'opacity-100':''}">{staff.totalHours||0}</td>
                                            <td class="p-2 border font-bold text-center bg-blue-50 text-blue-600 {inspectionMode!=='none'?'opacity-100':''}">{staff.gh||'-'}</td> 
                                            <td class="p-2 border font-bold text-center bg-purple-50 text-purple-600 {inspectionMode!=='none'?'opacity-100':''}">{staff.tn||0}</td> 
                                            <td class="p-2 border font-bold text-center bg-orange-50 text-orange-600 {inspectionMode!=='none'?'opacity-100':''}">{staff.kho||0}</td> 
                                            <td class="p-2 border font-bold text-center border-l {inspectionMode==='weekend' ? 'opacity-100' : 'opacity-100'} 
                                                {weekendStatus===1?'text-red-600 bg-red-50':(weekendStatus===-1?'text-green-600 bg-green-50':'text-slate-600')}">
                                                {weCount}
                                            </td>
                                        </tr> 
                                    {/each} 
                                </tbody> 
                            </table> 
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
        {#if activeSection === 'template'} <div class="flex flex-col lg:flex-row gap-6 h-full"> <div class="w-full lg:w-[35%] bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-fit"> <h4 class="font-bold text-slate-700 mb-4 flex items-center gap-2 text-lg border-b pb-2"><span class="material-icons-round text-orange-500 bg-orange-50 p-1 rounded-lg">edit_note</span> {editingTemplateIndex >= 0 ? 'Chỉnh Sửa' : 'Thêm Mới'}</h4> <div id="template-form" class="space-y-4"> <div id="dept-select-container"><label for="dept-select" class="text-xs font-bold text-slate-500 uppercase">Bộ phận áp dụng</label><select id="dept-select" bind:value={activeTemplateType} class="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"><option value="warehouse">Kho</option><option value="cashier">Thu Ngân</option><option value="handover">Bàn Giao</option></select></div> <div class="flex gap-3"> <div class="w-24"><label for="time-input" class="text-xs font-bold text-slate-500 uppercase">Giờ</label><input id="time-input" type="time" bind:value={newTemplateTime} class="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"></div> <div class="flex-1"><label for="title-input" class="text-xs font-bold text-slate-500 uppercase">Tên công việc</label><input id="title-input" type="text" bind:value={newTemplateTitle} class="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100" placeholder="VD: Kiểm quỹ..."></div> </div> <div id="weekdays-container"><label class="text-xs font-bold text-slate-500 uppercase mb-2 block">Lặp lại</label><div class="flex gap-1 flex-wrap">{#each weekDays as d}<button class="w-8 h-8 rounded-lg text-xs font-bold border transition-all {selectedDays.includes(d.val)?'bg-indigo-600 text-white border-indigo-600 shadow-md':'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}" on:click={() => toggleDay(d.val)}>{d.label}</button>{/each}</div></div> <label class="flex items-center gap-3 p-3 rounded-lg border border-red-100 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors mt-1"><input type="checkbox" bind:checked={newTemplateImportant} class="w-5 h-5 accent-red-600 rounded"><span class="text-sm font-bold text-red-700">Đánh dấu Quan Trọng</span></label> <div class="flex gap-2 pt-2 border-t">{#if editingTemplateIndex >= 0}<button class="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200" on:click={()=>{editingTemplateIndex=-1;newTemplateTitle=''}}>Hủy</button>{/if}<button id="btn-save-template" class="flex-[2] py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all" on:click={saveTemplate}>{editingTemplateIndex >= 0?'Lưu':'Thêm Vào List'}</button></div> </div> </div> <div class="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-full"> <div class="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0"><span class="font-bold text-slate-700">Danh sách công việc ({$taskTemplate[activeTemplateType]?.length || 0})</span></div> <div class="flex-1 overflow-y-auto p-3 space-y-2"> {#each ($taskTemplate[activeTemplateType] || []) as item, i} <div class="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all group relative"> <div class="font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm">{item.time}</div> <div class="flex-1"><div class="font-bold text-slate-800 text-base mb-1 {item.isImportant?'text-red-600':''}">{item.isImportant ? '★ ' : ''}{item.title}</div><div class="flex gap-1 flex-wrap">{#if !item.days || item.days.length===7}<span class="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Hàng ngày</span>{:else}{#each weekDays as d}{#if item.days.includes(d.val)}<span class="text-[10px] font-bold border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded">{d.label}</span>{/if}{/each}{/if}</div></div> <div class="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2"><button class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center" on:click={()=>editTemplate(i, item)}><span class="material-icons-round text-sm">edit</span></button><button class="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center" on:click={()=>deleteTemplate(i)}><span class="material-icons-round text-sm">delete</span></button></div> </div> {/each} </div> </div> </div> {/if}
        {#if activeSection === 'accounts'} <div class="flex flex-col lg:flex-row gap-6 w-full max-w-5xl mx-auto animate-fadeIn"> {#if isSuperAdmin} <div id="super-admin-area" class="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200"> <h3 class="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"> <span class="material-icons-round text-purple-500 bg-purple-50 p-1.5 rounded-lg">admin_panel_settings</span> Tạo Quản Lý Mới </h3> <div class="space-y-4"> <div><label for="new-admin-user" class="text-xs font-bold text-slate-500 uppercase">Tên đăng nhập</label><input id="new-admin-user" type="text" bind:value={newAdminUser} class="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-200 font-bold" placeholder="VD: quanly1"></div> <div class="grid grid-cols-2 gap-4"> <div><label for="new-admin-pass" class="text-xs font-bold text-slate-500 uppercase">Mật khẩu</label><input id="new-admin-pass" type="text" bind:value={newAdminPass} class="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-200" placeholder="******"></div> <div><label for="new-admin-store" class="text-xs font-bold text-slate-500 uppercase">Mã Kho Quản Lý</label><input id="new-admin-store" type="text" bind:value={newAdminStore} class="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-200 font-bold" placeholder="VD: 908"></div> </div> <button id="btn-create-admin" class="w-full py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700 transition-all mt-2" on:click={handleCreateAdmin}>Tạo Tài Khoản Admin</button> </div> </div> {/if} <div class="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col"> <div class="flex justify-between items-center mb-4"> <h3 class="font-bold text-lg text-slate-800 flex items-center gap-2"> <span class="material-icons-round text-blue-500 bg-blue-50 p-1.5 rounded-lg">groups</span> Cấp Quyền Nhân Viên </h3> <div class="flex gap-2"> <button id="btn-add-single" class="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 flex items-center gap-1 transition-colors" on:click={() => checkDemoAndBlock() || (showAddUserModal = true)}> <span class="material-icons-round text-sm">add</span> Thêm 1 NV </button> <button id="btn-download-account-sample" class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1 transition-colors" on:click={checkDemoAndBlock(event) || downloadAccountSample()}>Tải Mẫu</button> <label id="btn-upload-accounts" class="text-xs font-bold text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1 transition-colors cursor-pointer shadow {isDemoMode ? 'opacity-50' : ''}" on:click={(e) => checkDemoAndBlock(e)}> <span class="material-icons-round text-sm">upload</span> Upload <input type="file" hidden accept=".xlsx" disabled={isDemoMode} on:change={handleAccountUpload}> </label> </div> </div> <div id="account-table" class="flex-1 overflow-auto border border-slate-200 rounded-xl"> <table class="w-full text-sm text-left"> <thead class="bg-slate-50 text-slate-500 font-bold"> <tr> <th class="p-3">User</th> <th class="p-3">Quyền</th> <th class="p-3 text-center">Xóa/Reset</th> </tr> </thead> <tbody class="divide-y divide-slate-100"> {#each accountList as acc} <tr class="hover:bg-slate-50"> <td class="p-3 font-bold text-slate-700">{acc.username}</td> <td class="p-3"> <select class="bg-transparent text-xs font-bold {acc.role==='admin'?'text-purple-600':'text-gray-500'} outline-none cursor-pointer" value={acc.role} on:change={(e) => changeRole(acc.id, e.target.value)}> <option value="staff">Nhân viên</option> <option value="admin">Quản lý</option> </select> </td> <td class="p-3 text-center flex justify-center gap-2"> <button class="w-7 h-7 flex items-center justify-center rounded bg-yellow-100 text-yellow-600 hover:bg-yellow-200 transition-colors" on:click={() => resetPassword(acc.id)} title="Reset Mật khẩu về 123456"> <span class="material-icons-round text-sm">key</span> </button> <button class="w-7 h-7 flex items-center justify-center rounded bg-red-100 text-red-500 hover:bg-red-200 transition-colors" on:click={() => deleteAccount(acc.id)} title="Xóa tài khoản"> <span class="material-icons-round text-sm">delete</span> </button> </td> </tr> {/each} {#if accountList.length === 0} <tr><td colspan="3" class="p-4 text-center text-gray-400 text-xs">Chưa có tài khoản nào thuộc kho {targetStore}.</td></tr> {/if} </tbody> </table> </div> </div> </div> {/if}
    </div>
    {#if isLoading}<div class="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-[60]"><div class="animate-bounce font-bold text-indigo-900 text-lg">Đang xử lý dữ liệu...</div></div>{/if}
</div>

{#if showShortageAlert} <div class="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm"> <div class="bg-white w-full max-w-sm rounded-xl p-5 shadow-2xl animate-fadeIn"> <div class="flex items-center gap-3 text-red-600 mb-2"> <span class="material-icons-round text-3xl">warning</span> <h3 class="font-bold text-lg">Thiếu Nhân Sự!</h3> </div> <p class="text-sm text-slate-600 mb-4">Nhu cầu hiện tại cần thêm <b>{shortageCount}</b> vị trí so với nhân viên hiện có.<br><br>Bạn có muốn kích hoạt <b>Chế độ Cao Điểm</b> để tự động ghép ca không?</p> <div class="flex gap-3"> <button class="flex-1 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg text-sm" on:click={() => showShortageAlert = false}>Để tôi sửa lại</button> <button class="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg text-sm shadow hover:bg-red-700" on:click={confirmEnablePeak}>Bật ngay 🔥</button> </div> </div> </div> {/if}
{#if showStoreConfig} <StoreConfig storeId={targetStore} on:close={()=>showStoreConfig=false} /> {/if}
{#if showAddUserModal} <div class="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => showAddUserModal = false}> <div class="bg-white w-full max-w-sm rounded-xl p-5 shadow-2xl" on:click|stopPropagation> <h3 class="font-bold text-lg text-slate-800 mb-4">Thêm Nhân Sự Mới</h3> <div class="space-y-3"> <div class="flex gap-3"> <div class="flex-1"> <label class="text-xs font-bold text-slate-500 uppercase">Giới tính</label> <select bind:value={singleGender} class="w-full mt-1 p-2 border rounded-lg bg-white"> <option value="Nam">Nam</option> <option value="Nữ">Nữ</option> </select> </div> <div class="flex-1"> <label class="text-xs font-bold text-slate-500 uppercase">Quyền hạn</label> <select bind:value={singleRole} class="w-full mt-1 p-2 border rounded-lg bg-white"> <option value="staff">Nhân viên</option> <option value="admin">Quản lý</option> </select> </div> </div> <div> <label class="text-xs font-bold text-slate-500 uppercase">Tên đăng nhập</label> <input type="text" bind:value={singleUsername} class="w-full mt-1 p-2 border rounded-lg font-bold" placeholder="VD: nv_moi"> </div> <div> <label class="text-xs font-bold text-slate-500 uppercase">Mật khẩu</label> <input type="text" bind:value={singlePass} class="w-full mt-1 p-2 border rounded-lg text-gray-500" placeholder="123456"> </div> <div class="flex gap-2 pt-2"> <button class="flex-1 py-2 bg-gray-100 rounded-lg text-gray-600 font-bold text-sm" on:click={() => showAddUserModal = false}>Hủy</button> <button class="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold text-sm shadow hover:bg-green-700" on:click={handleCreateSingleUser}>Lưu</button> </div> </div> </div> </div> {/if}
{#if editingShift} <div class="fixed inset-0 z-[80] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={()=>editingShift=null}> <div class="bg-white w-full max-w-sm rounded-xl p-5 shadow-2xl" on:click|stopPropagation> <div class="flex justify-between items-start mb-4"> <div><h3 class="font-bold text-lg text-slate-800">Sửa Ca: {editingShift.name}</h3><p class="text-xs text-gray-500">Ngày {editingShift.day} - Hiện tại: <span class="font-bold">{tempEditingShift.shift}</span></p></div> {#if editingShift.shift !== editingShift.originalShift || editingShift.role !== editingShift.originalRole} <button class="text-xs text-red-600 hover:underline font-bold bg-red-50 px-2 py-1 rounded" on:click={resetEditPreviewShift}>Reset về gốc</button> {/if} </div> <div class="space-y-4"> <div> <label class="block text-xs font-bold text-gray-500 mb-2">Chọn Ca Nhanh</label> <div class="grid grid-cols-3 gap-2 mb-2"> {#each QUICK_SHIFTS as s} <button class="py-2 border rounded-lg font-bold text-xs transition-all shadow-sm {editingShift.isOFF && s==='OFF' ? 'bg-red-600 text-yellow-300 border-red-600 ring-2 ring-red-200' : (!editingShift.isOFF && editingShift.shift === s ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200' : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200')}" on:click={() => { if(s === 'OFF') { editingShift.isOFF = true; editingShift.shift = 'OFF'; } else { editingShift.isOFF = false; editingShift.shift = s; } }}>{s}</button> {/each} </div> <label class="block text-xs font-bold text-gray-500 mb-1 mt-3">Ca Tùy Chỉnh</label> <input type="text" value={editingShift.isOFF ? 'OFF' : editingShift.shift} on:input={(e) => { if(!editingShift.isOFF) editingShift.shift = e.target.value; }} disabled={editingShift.isOFF} class="w-full p-2.5 border rounded-lg text-center font-bold text-sm transition-colors {editingShift.isOFF ? 'bg-red-600 text-yellow-300 border-red-600 cursor-not-allowed opacity-100' : 'bg-white text-slate-800 border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200'}" placeholder="Nhập mã ca (vd: 12-56)"> </div> {#if !editingShift.isOFF} <div class="p-3 bg-gray-50 rounded-lg border border-gray-200 animate-fadeIn"> <label class="block text-xs font-bold text-gray-500 mb-2">Vai Trò Mới</label> <div class="grid grid-cols-2 gap-2"> {#each ['TV', 'Thu Ngân', 'Kho', 'GH'] as r} <label class="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-gray-200 hover:border-indigo-300 transition-colors"> <input type="radio" bind:group={editingShift.role} value={r} class="accent-indigo-600 w-4 h-4"> <span class="text-xs font-bold {r==='GH'?'text-blue-600':(r==='Thu Ngân'?'text-purple-600':(r==='Kho'?'text-orange-600':'text-gray-600'))}">{r}</span> </label> {/each} </div> </div> {/if} </div> <div class="flex gap-3 mt-6"> <button class="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors" on:click={()=>editingShift=null}>Hủy Bỏ</button> <button class="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all" on:click={savePreviewShiftChange}>Lưu Thay Đổi</button> </div> </div> </div> {/if}
{#if selectedStaff} <div class="fixed inset-0 z-[90] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={()=>selectedStaff=null}> <div class="bg-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" on:click|stopPropagation> <div class="p-4 bg-indigo-500 text-white shrink-0"> <h3 class="font-bold text-lg">{selectedStaff.name}</h3> <div class="flex justify-between mt-2 text-xs font-bold bg-indigo-600/50 p-2 rounded"> <span>{selectedStaff.stats.totalHours || 0} Giờ</span> <span class="text-blue-100">GH: {selectedStaff.stats.gh || 0}</span> <span class="text-purple-100">TN: {selectedStaff.stats.tn || 0}</span> <span class="text-orange-100">K: {selectedStaff.stats.kho || 0}</span> </div> </div> <div class="flex-1 overflow-y-auto p-3 bg-slate-100"> <div class="grid grid-cols-7 gap-1 mb-1 text-center text-[10px] font-bold text-gray-400 uppercase"> {#each ['T2','T3','T4','T5','T6','T7','CN'] as day}<div>{day}</div>{/each} </div> <div class="grid grid-cols-7 gap-1"> {#each selectedStaff.blankCells as _}<div class="bg-transparent"></div>{/each} {#each selectedStaff.days as d} <div class="bg-white rounded border shadow-sm p-1 flex flex-col items-center justify-center aspect-square {d.shift==='OFF'?'opacity-60 bg-slate-100':''}"> <div class="text-[10px] text-gray-400 font-bold mb-1">{d.day}</div> <div class="font-black text-slate-800 text-xs {d.shift==='OFF'?'text-slate-400':''}">{d.shift}</div> {#if d.shift !== 'OFF'} {@const badge = getRoleBadge(d.role)} {#if badge}<span class="text-[9px] font-bold px-1 rounded mt-0.5 leading-tight {badge.class}">{badge.text}</span>{/if} {/if} </div> {/each} </div> </div> <div class="p-3 border-t bg-white text-center"><button class="w-full py-2 bg-gray-100 rounded text-gray-600 font-bold text-sm" on:click={()=>selectedStaff=null}>Đóng</button></div> </div> </div> {/if}
{#if selectedDayStats} <div class="fixed inset-0 z-[90] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={()=>selectedDayStats=null}> <div class="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" on:click|stopPropagation> <div class="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center"> <h3 class="font-bold text-lg text-slate-800"> Chi Tiết Ngày {selectedDayStats.day} ({selectedDayStats.weekday}) <span class="ml-2 text-sm text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">Tổng công: {selectedDayStats.totalHours} giờ</span> </h3> <button on:click={()=>selectedDayStats=null} class="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center"><span class="material-icons-round text-slate-500">close</span></button> </div> <div class="p-5 overflow-x-auto"> <table class="w-full text-sm border-separate border-spacing-0 rounded-xl overflow-hidden border border-slate-200"> <thead class="bg-slate-50 text-slate-500"><tr><th class="p-3 text-left font-bold border-b border-r border-slate-200">Bộ Phận</th>{#each selectedDayStats.cols as col}<th class="p-2 text-center border-b border-slate-200 border-l border-white min-w-[50px]"><div class="font-black text-slate-700">{col}</div></th>{/each}<th class="p-3 text-center font-bold bg-slate-100 border-b border-l border-slate-200 text-slate-700">Tổng</th></tr></thead> <tbody> {#each selectedDayStats.roles as role} <tr class="hover:bg-slate-50 transition-colors"> <td class="p-3 font-bold border-r border-slate-100 {role==='GH'?'text-blue-600':(role==='Thu Ngân'?'text-purple-600':(role==='Kho'?'text-orange-600':'text-gray-600'))}">{role}</td> {#each selectedDayStats.cols as col}<td class="p-2 border-r border-slate-100 text-center font-mono {selectedDayStats.matrix[role][col]>0?'font-bold text-slate-800':'text-gray-300'}">{selectedDayStats.matrix[role][col] || '-'}</td>{/each} <td class="p-3 text-center font-black text-slate-700 bg-slate-50 border-l border-slate-100">{selectedDayStats.matrix[role]['Total']}</td> </tr> {/each} </tbody> <tfoot class="bg-slate-800 text-slate-300 font-bold"><tr><td class="p-3 text-right text-xs uppercase tracking-wider">Tổng Cộng</td>{#each selectedDayStats.cols as col}<td class="p-3 text-center text-yellow-400 font-mono text-lg">{getDayColTotal(col)}</td>{/each}<td class="p-3 text-center text-white text-xl bg-slate-900">{getDayGrandTotal()}</td></tr></tfoot> </table> </div> </div> </div> {/if}
{#if showTour} <TourGuide steps={currentSteps} on:complete={() => showTour = false} /> {/if}
<style>.animate-fadeIn { animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); } @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } } .arrow-bottom:after { content:''; position: absolute; bottom: -6px; left: 24px; width: 12px; height: 12px; background: white; transform: rotate(45deg); border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }</style>