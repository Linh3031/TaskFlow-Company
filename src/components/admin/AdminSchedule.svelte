<script>
  // Version 37.9 - Dual-Snapshot Architecture & 3-Month History Injection
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { db } from '../../lib/firebase';
  import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
  import { read, utils, writeFile } from 'xlsx';
  import { safeString } from '../../lib/utils';
  import { currentUser } from '../../lib/stores';
  import { calculateCombosFromMatrix, generateMonthlySchedule, SHIFT_DEFINITIONS, suggestPeakCombos } from '../../lib/scheduleLogic';
  import { optimizeSchedule, autoFixRotation, autoFixWeekendFairness, autoFixGenderBalance, manualBalanceGender } from '../../lib/optimization';
  import TourGuide from '../TourGuide.svelte'; 
  
  import ScheduleMatrix from './schedule/ScheduleMatrix.svelte';
  import SchedulePreview from './schedule/SchedulePreview.svelte';
  import StoreConfig from '../StoreConfig.svelte';
  
  // Modals & Toolbar Components
  import AdminEditShiftModal from './schedule/AdminEditShiftModal.svelte';
  import AdminPersonalScheduleModal from './schedule/AdminPersonalScheduleModal.svelte';
  import AdminDayStatsModal from './schedule/AdminDayStatsModal.svelte';
  import AdminScheduleToolbar from './schedule/AdminScheduleToolbar.svelte';

  // Constants & Utilities
  import { 
      tourSteps, defaultMatrix, DEFAULT_COLS, shiftCols, roleRows, 
      INSPECTION_OPTIONS, getShiftColor, getRoleBadge, isHardRole 
  } from './schedule/scheduleConstants.js';

  export let targetStore = '';
  
  const dispatch = createEventDispatcher();
  let isLoading = false;
  let scheduleStaffList = [];
  let staffStats = { total: 0, male: 0, female: 0 };
  let scheduleMonth = new Date().getMonth() + 1;
  let scheduleYear = new Date().getFullYear();
  let showStoreConfig = false; 
  let showTour = false;

  let shiftMatrix = JSON.parse(JSON.stringify(defaultMatrix)); 
  let weekendMatrix = JSON.parse(JSON.stringify(defaultMatrix));
  let suggestedCombos = []; 
  let suggestedWeekendCombos = [];
  let activeMatrixMode = 'weekday';
  let genderConfig = { kho: 'none', tn: 'none' };
  
  let customComboCols = [...DEFAULT_COLS]; 

  let showShortageAlert = false;
  let shortageCount = 0;
  let previewScheduleData = null;
  let previewStats = [];
  let originalResult = null;
  let optimizationLogs = [];
  let inspectionMode = 'none';
  
  // [NEW] Kiến trúc Dual-Snapshot và Lịch sử
  let pureSystemStats = []; 
  let pastThreeMonthsData = [];
  let ignoreHistory = false;

  let editingShift = null; 
  let tempEditingShift = null;
  let selectedStaff = null;
  let selectedDayStats = null;
  $: isDemoMode = targetStore?.includes('DEMO');
  $: activeSuggestedCombos = activeMatrixMode === 'weekday' ? suggestedCombos : suggestedWeekendCombos;
  $: totalCombos = activeSuggestedCombos.reduce((sum, c) => sum + (parseInt(c.qty)||0), 0);
  let comboTotalsMap = {};
  $: { 
      const map = {};
      customComboCols.forEach(code => { 
          const items = activeSuggestedCombos.filter(c => c.code === code); 
          map[code] = items.reduce((sum, c) => sum + (parseInt(c.qty) || 0), 0); 
      });
      comboTotalsMap = map; 
  }

  $: if (scheduleStaffList) { try { staffStats = { total: scheduleStaffList.length, male: scheduleStaffList.filter(s => String(s.gender || '').trim().toLowerCase() === 'nam').length, female: scheduleStaffList.filter(s => String(s.gender || '').trim().toLowerCase() !== 'nam').length };
  } catch (e) { staffStats = { total: 0, male: 0, female: 0 };
  } }
  
  $: if (targetStore) loadStoreData();
  
  function checkDemoAndBlock(e) { if (isDemoMode) { e && e.preventDefault();
  alert("Tài khoản demo không có tính năng này!"); return true; } return false;
  }
  
  async function loadStoreData() { 
      if (!targetStore) return; 
      scheduleStaffList = [];
      shiftMatrix = JSON.parse(JSON.stringify(defaultMatrix)); 
      weekendMatrix = JSON.parse(JSON.stringify(defaultMatrix));
      suggestedCombos = []; 
      suggestedWeekendCombos = []; 
      previewScheduleData = null;
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
              if (data.comboCols && Array.isArray(data.comboCols)) {
                  customComboCols = data.comboCols;
              } else {
                  customComboCols = [...DEFAULT_COLS];
              }
          } 
      } catch (e) { console.error(e);
      } 
  }
  
  function downloadScheduleSample() { const wb = utils.book_new();
  const wsData = [["Ho_Ten", "Gioi_Tinh"], ["Nguyễn Văn A", "Nam"], ["Trần Thị B", "Nữ"]]; const ws = utils.aoa_to_sheet(wsData); utils.book_append_sheet(wb, ws, "DS_Nhan_Vien");
  writeFile(wb, `Mau_Phan_Ca_${targetStore}.xlsx`); }
  
  async function handleStaffUpload(e) { const file = e.target.files[0]; if(!file) return; isLoading = true;
  setTimeout(async () => { try { const data = await file.arrayBuffer(); const wb = read(data); const json = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); let newStaff = []; for(let i=0; i<json.length; i++) { const row = json[i]; let name = row['Ho_Ten'] || row['Họ Tên'] || ''; let gender = row['Gioi_Tinh'] || row['Giới Tính'] || 'Nữ'; if(name) { newStaff.push({ id: String(newStaff.length+1), name: safeString(name), gender: String(gender).toLowerCase().includes('nam') ? 'Nam' : 'Nữ' }); } } if(newStaff.length > 0) { scheduleStaffList = newStaff; await setDoc(doc(db, 'settings', `staff_list_${targetStore}`), { staffList: scheduleStaffList, updatedAt: serverTimestamp() }); alert(`✅ Đã cập nhật danh sách: ${newStaff.length} nhân viên vào kho ${targetStore}.`); } else { alert(`⚠️ File không có dữ liệu hợp lệ!`); } } catch(e) { alert("Lỗi file: " + e.message); } finally { isLoading=false; e.target.value=null; } }, 100);
  }
  
  function updateComboQty(roleLabel, comboCode, newQty) { const qtyVal = parseInt(newQty) || 0;
  let currentList = activeMatrixMode === 'weekday' ? [...suggestedCombos] : [...suggestedWeekendCombos]; const targetRoles = [roleLabel];
  if (roleLabel === 'Thu Ngân') targetRoles.push('TN', 'tn');
  if (roleLabel === 'Giao Hàng') targetRoles.push('GH', 'gh');
  if (roleLabel === 'Tư Vấn') targetRoles.push('TV', 'tv');
  const idx = currentList.findIndex(c => { const cRole = c.role || 'TV'; return c.code === comboCode && targetRoles.includes(cRole); });
  if (idx >= 0) { currentList[idx].qty = qtyVal; currentList[idx].role = roleLabel;
  } else if (qtyVal > 0) { currentList.push({ code: comboCode, role: roleLabel, label: `${roleLabel} ${comboCode}`, qty: qtyVal });
  } if (activeMatrixMode === 'weekday') suggestedCombos = currentList; else suggestedWeekendCombos = currentList;
  }
  
  async function saveGenderConfig(newConfig) { if (!targetStore) return; genderConfig = newConfig;
  try { await setDoc(doc(db, 'settings', `shift_matrix_${targetStore}`), { genderConfig }, { merge: true }); } catch (e) { console.error(e);
  } }
  
  function handleAddColumn() {
      customComboCols = [...customComboCols, ''];
  }

  function handleUpdateColumns(newCols) {
      customComboCols = newCols;
  }

  async function handleCalculateCombos(save = true) { if(save) isLoading = true;
  try { const clean = (m) => { const c = JSON.parse(JSON.stringify(m));
  Object.keys(c).forEach(key => { if(c[key]) ['kho', 'tn', 'tv', 'gh'].forEach(role => { let val = parseInt(c[key][role]); if (isNaN(val)) val = 0; c[key][role] = val; }); });
  return c; }; shiftMatrix = clean(shiftMatrix); weekendMatrix = clean(weekendMatrix); await tick(); showShortageAlert = false; shortageCount = 0;
  let tempWeekday = calculateCombosFromMatrix(shiftMatrix); let tempWeekend = calculateCombosFromMatrix(weekendMatrix); const checkShortage = (combos) => { const totalDemand = combos.reduce((sum, c) => sum + (parseInt(c.qty)||0), 0);
  return totalDemand > staffStats.total ? (totalDemand - staffStats.total) : 0; }; const s1 = checkShortage(tempWeekday); const s2 = checkShortage(tempWeekend);
  suggestedCombos = tempWeekday; 
  suggestedWeekendCombos = tempWeekend;
  
  if (s1 > 0 || s2 > 0) { shortageCount = Math.max(s1, s2); showShortageAlert = true; } 
  
  if(save) { 
      await setDoc(doc(db, 'settings', `shift_matrix_${targetStore}`), { 
          matrix: shiftMatrix, 
          approvedCombos: suggestedCombos, 
          weekendMatrix: weekendMatrix, 
          weekendCombos: suggestedWeekendCombos, 
          genderConfig, 
          comboCols: customComboCols, 
          updatedAt: serverTimestamp(), 
          updatedBy: $currentUser.username 
      });
  } } catch (e) { alert("Lỗi tính toán: " + e.message); } finally { if(save) isLoading = false;
  } }
  
  async function handleGeneratePreview() { 
    if (totalCombos > staffStats.total) { 
        alert(`⛔ KHÔNG THỂ TẠO LỊCH!\n\nNhu cầu đang cần ${totalCombos} vị trí, nhưng chỉ có ${staffStats.total} nhân viên.`);
        return; 
    } 
    if (suggestedCombos.length === 0 && suggestedWeekendCombos.length === 0) return alert("Chưa có combo nào!"); 
    
    isLoading = true;
    try { 
        // [NEW] 1. Quét lùi 3 tháng lấy dữ liệu gốc (systemStats)
        pastThreeMonthsData = [];
        if (!ignoreHistory) {
            for (let i = 1; i <= 3; i++) {
                let m = scheduleMonth - i; let y = scheduleYear;
                if (m <= 0) { m += 12; y -= 1; }
                const snap = await getDoc(doc(db, 'stores', targetStore, 'schedules', `${y}-${String(m).padStart(2,'0')}`));
                if (snap.exists()) {
                    const sData = snap.data();
                    // Ưu tiên bản gốc máy tạo, không có thì xài bản thủ công
                    pastThreeMonthsData.push({ month: m, year: y, stats: sData.systemStats || sData.stats || [] });
                }
            }
        }

        let prevMonth = scheduleMonth - 1, prevYear = scheduleYear; 
        if(prevMonth === 0) { prevMonth = 12; prevYear--; } 
        let prevScheduleData = null; 
        const prevSnap = await getDoc(doc(db, 'stores', targetStore, 'schedules', `${prevYear}-${String(prevMonth).padStart(2,'0')}`)); 
        if(prevSnap.exists()) prevScheduleData = prevSnap.data();
        
        const comboPayload = { weekday: suggestedCombos, weekend: suggestedWeekendCombos }; 
        
        // [NEW] 2. Truyền mảng 3 tháng vào thuật toán (Thuật toán sẽ được nâng cấp sau để nhận biến này)
        const result = generateMonthlySchedule(scheduleStaffList, comboPayload, scheduleMonth, scheduleYear, prevScheduleData, genderConfig, pastThreeMonthsData);
        
        originalResult = JSON.parse(JSON.stringify(result)); 
        previewScheduleData = result.schedule; 
        previewStats = result.staffStats; 

        // [NEW] 3. Chụp hình hiện trường (Bản nguyên gốc máy làm)
        pureSystemStats = JSON.parse(JSON.stringify(result.staffStats));
        
        optimizationLogs = []; 
        await tick();
        setTimeout(() => { const previewEl = document.getElementById('preview-schedule-container'); if(previewEl) previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    } catch (e) { 
        alert("Lỗi: " + e.message); 
    } finally { 
        isLoading = false;
    } 
  }
  
  function handleManualBalance(e) {
    const config = e.detail;
    if (!previewScheduleData) return;
    const params = {
        fromGender: config.direction === 'male_to_female' ? 'Nam' : 'Nữ',
        toGender: config.direction === 'male_to_female' ? 'Nữ' : 'Nam',
        role: config.role,
        qty: parseInt(config.qty) || 1
    };

    isLoading = true;
    setTimeout(() => {
        const result = manualBalanceGender(previewScheduleData, scheduleStaffList, scheduleMonth, scheduleYear, params);
        
        if (result.count > 0) {
            previewScheduleData = result.schedule;
            optimizationLogs = [...optimizationLogs, ...result.logs];
            
            const newRoleStats = {};
            scheduleStaffList.forEach(s => {
                let h=0, tn=0, kho=0, gh=0;
                Object.values(previewScheduleData).forEach(dayList => {
                    const assign = dayList.find(a => a.staffId === s.id);
                    if(assign && assign.shift !== 'OFF') {
                        if(assign.role==='Thu Ngân' || assign.role==='TN') tn++;
                        if(assign.role==='Kho' || assign.role==='K') kho++;
                        if(assign.role==='Giao Hàng' || assign.role==='GH') gh++;
                    }
                });
                newRoleStats[s.id] = { tn, kho, gh };
            });

            previewStats = previewStats.map(s => {
                if (newRoleStats[s.id]) return { ...s, ...newRoleStats[s.id] };
                return s;
            });
            alert(`✅ Đã đổi thành công ${result.count} ca!`);
        } else {
            alert("⚠️ Không tìm thấy ca nào phù hợp để đổi (hoặc đã vi phạm hết các điều kiện ưu tiên).");
        }
        isLoading = false;
    }, 200);
  }

  function isWeekendDay(d) { const date = new Date(scheduleYear, scheduleMonth - 1, d); const dayOfWeek = date.getDay();
  return (dayOfWeek === 0 || dayOfWeek === 6); }
  function getWeekday(day) { const date = new Date(scheduleYear, scheduleMonth - 1, day);
  return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]; }
  function getWeekendFairnessStatus(staffId) { if (inspectionMode !== 'weekend' || !previewScheduleData) return 0;
  const allStats = previewStats.map(s => { let count = 0; Object.keys(previewScheduleData).forEach(d => { if (isWeekendDay(d)) { const assign = previewScheduleData[d].find(a => a.staffId === s.id); if (assign && isHardRole(assign.role)) count++; } }); return { id: s.id, count }; });
  const counts = allStats.map(x => x.count); const max = Math.max(...counts); const min = Math.min(...counts);
  const myStat = allStats.find(x => x.id === staffId); if (!myStat) return 0; if (max - min <= 1) return 0;
  if (myStat.count === max) return 1; if (myStat.count === min) return -1; return 0;
  }
  function getWeekendHardRoleCount(staffId) { if (!previewScheduleData) return 0; let count = 0;
  Object.keys(previewScheduleData).forEach(d => { if (isWeekendDay(d)) { const assign = previewScheduleData[d].find(a => a.staffId === staffId); if (assign && isHardRole(assign.role)) count++; } });
  return count; }
  function checkInspectionError(d, assign, currentMode) { const mode = currentMode || inspectionMode;
  if (mode === 'none') return false; if (!assign || assign.shift === 'OFF') return false;
  if (mode === 'gender') { if (genderConfig.kho === 'none' && genderConfig.tn === 'none') return false; const dayAssignments = previewScheduleData[d] || []; 
  const sameShiftRole = dayAssignments.filter(a => a.shift === assign.shift && a.role === assign.role && a.shift !== 'OFF');
  if (assign.role === 'Kho') { if (genderConfig.kho === 'male_only' && !assign.gender.toLowerCase().includes('nam')) return `Kho ca ${assign.shift} yêu cầu Nam`;
  if (genderConfig.kho === 'mixed') { const hasMale = sameShiftRole.some(a => a.gender === 'Nam');
  if (!hasMale) return `Kho Kho ca ${assign.shift} thiếu Nam`; } } if (assign.role === 'Thu Ngân') { if (genderConfig.tn === 'female_only' && assign.gender === 'Nam') return `TN ca ${assign.shift} yêu cầu Nữ`;
  if (genderConfig.tn === 'mixed') { const hasMale = sameShiftRole.some(a => a.gender === 'Nam');
  const hasFemale = sameShiftRole.some(a => a.gender !== 'Nam'); if (!hasMale || !hasFemale) return `TN ca ${assign.shift} thiếu cặp đôi`;
  } } return false; } if (mode === 'weekend') { if (!isWeekendDay(d) || !isHardRole(assign.role)) return false; const rowStatus = getWeekendFairnessStatus(assign.staffId);
  if (rowStatus === 1) return "Dư ca nghiệp vụ cuối tuần"; return false;
  } if (mode === 'rotation') { if (d == 1) return false; const prevAssign = previewScheduleData[d-1]?.find(a => a.staffId === assign.staffId);
  if (!prevAssign || prevAssign.shift === 'OFF') return false; 
  return false;
  } if (mode === 'fatigue') { if (d == 1) return false;
  const prevAssign = previewScheduleData[d-1]?.find(a => a.staffId === assign.staffId);
  if (!prevAssign || !prevAssign.role) return false;
  if (isHardRole(prevAssign.role) && isHardRole(assign.role)) { return `Làm nghiệp vụ liên tiếp 2 ngày`;
  } return false; } return false;
  }
  function isCellRelevant(d, assign, currentMode) { const mode = currentMode || inspectionMode;
  if (mode === 'none') return true;
  if (checkInspectionError(d, assign, mode)) return true; if (mode === 'weekend' && isWeekendDay(d)) return true;
  if (mode === 'rotation') return true;
  return false; }
  
  function handleAutoFixRotation() { if (!previewScheduleData) return;
  isLoading = true;
  setTimeout(() => { const result = autoFixRotation(previewScheduleData, scheduleMonth, scheduleYear); if (result.success) { previewScheduleData = result.schedule; optimizationLogs = [...optimizationLogs, ...result.logs]; alert(`✅ Đã sửa thành công ${result.count} lỗi!`); } else { alert("✅ Hệ thống đã tối ưu."); } isLoading = false; }, 300);
  }
  function handleAutoFixWeekend() { if (!previewScheduleData) return; isLoading = true;
  setTimeout(() => { const result = autoFixWeekendFairness(previewScheduleData, scheduleMonth, scheduleYear, scheduleStaffList); if (result.success) { previewScheduleData = result.schedule; optimizationLogs = [...optimizationLogs, ...result.logs]; previewStats = [...previewStats]; alert(`✅ Đã cân bằng lại ${result.count} ca cuối tuần!`); } else { alert("✅ Hệ thống đã tối ưu."); } isLoading = false; }, 300);
  }
  function handleAutoFixGender() { if (!previewScheduleData) return; const dryRun = autoFixGenderBalance(previewScheduleData, scheduleMonth, scheduleYear, false);
  if (!dryRun.success && !dryRun.hasConflict) { alert("✅ Không tìm thấy lỗi giới tính có thể sửa."); return;
  } if (dryRun.hasConflict) { if (confirm(`⚠️ CẢNH BÁO XUNG ĐỘT!\n\nCân bằng giới tính sẽ gây lỗi Xoay Ca. BỎ QUA luật xoay ca?`)) { const forceFix = autoFixGenderBalance(previewScheduleData, scheduleMonth, scheduleYear, true);
  previewScheduleData = forceFix.schedule; optimizationLogs = [...optimizationLogs, ...forceFix.logs]; alert(`✅ Đã sửa ${forceFix.count} lỗi (Chấp nhận gãy nhịp)!`);
  } } else { previewScheduleData = dryRun.schedule; optimizationLogs = [...optimizationLogs, ...dryRun.logs]; alert(`✅ Đã sửa thành công ${dryRun.count} lỗi!`);
  } }
  
  function handleOptimize() { 
      if (!previewScheduleData) return; 
      const beforeOptimizeJSON = JSON.stringify(previewScheduleData); 
      isLoading = true;
      setTimeout(() => { 
          // Truyền pastThreeMonthsData vào để thuật toán Optimize cũng biết lịch sử (Sau này)
          const optResult = optimizeSchedule(previewScheduleData, scheduleStaffList, pastThreeMonthsData); 
          const afterOptimizeJSON = JSON.stringify(optResult.optimizedSchedule); 
          
          if (beforeOptimizeJSON === afterOptimizeJSON) { 
              alert("✅ Lịch hiện tại đã tối ưu!"); isLoading = false; return; 
          } 
          previewScheduleData = optResult.optimizedSchedule; 
          const newRoleStats = {}; 
          optResult.finalStats.forEach(s => newRoleStats[s.id] = s.roles); 
          
          previewStats = previewStats.map(s => { 
              if (newRoleStats[s.id]) { return { ...s, ...newRoleStats[s.id] }; } return s; 
          }); 
          
          // [NEW] Cập nhật lại bản nguyên gốc vì Optimize là máy tự làm, không phải người làm
          pureSystemStats = JSON.parse(JSON.stringify(previewStats));

          optimizationLogs = optResult.changesLog; 
          isLoading = false; 
      }, 200);
  }
  
  async function handleApplySchedule() { 
      if (!previewScheduleData) return;
      if (!confirm(`⚠️ XÁC NHẬN ÁP DỤNG LỊCH THÁNG ${scheduleMonth}/${scheduleYear}?`)) return;
      
      isLoading = true;
      try { 
          const scheduleId = `${scheduleYear}-${String(scheduleMonth).padStart(2,'0')}`;
          const mainRef = doc(db, 'stores', targetStore, 'schedules', scheduleId);
          
          const currentSnap = await getDoc(mainRef);
          if (currentSnap.exists()) {
              const backupRef = doc(db, 'stores', targetStore, 'schedules', `${scheduleId}_backup`);
              await setDoc(backupRef, currentSnap.data());
              console.log("✅ Đã tạo backup bản lịch cũ.");
          }

          // [NEW] Lưu song song cả stats (cho lương/hiển thị chung) và systemStats (nguyên gốc để soi 3 tháng)
          await setDoc(mainRef, { 
              config: { matrix: shiftMatrix, approvedCombos: suggestedCombos, genderConfig, comboCols: customComboCols }, 
              data: previewScheduleData, 
              stats: previewStats, 
              systemStats: pureSystemStats, 
              endOffset: originalResult.endOffset, 
              updatedAt: serverTimestamp(), 
              updatedBy: $currentUser.username 
          });
          alert("✅ Đã áp dụng lịch thành công!"); 
          dispatch('switchTab', 'schedule'); 
      } catch (e) { 
          alert("Lỗi: " + e.message);
      } finally { 
          isLoading = false;
      } 
  }

  async function handleRestoreBackup() {
      if (!confirm("⚠️ CẢNH BÁO: Bạn có chắc chắn muốn khôi phục lại phiên bản lịch trước đó?")) return;
      isLoading = true;
      try {
          const scheduleId = `${scheduleYear}-${String(scheduleMonth).padStart(2,'0')}`;
          const backupRef = doc(db, 'stores', targetStore, 'schedules', `${scheduleId}_backup`);
          const backupSnap = await getDoc(backupRef);
          if (!backupSnap.exists()) {
              alert("❌ Không tìm thấy bản sao lưu nào để khôi phục.");
              isLoading = false;
              return;
          }

          const mainRef = doc(db, 'stores', targetStore, 'schedules', scheduleId);
          await setDoc(mainRef, backupSnap.data());

          alert("✅ Đã khôi phục thành công lịch cũ!");
          dispatch('switchTab', 'schedule');
      } catch (e) {
          alert("Lỗi khôi phục: " + e.message);
      } finally {
          isLoading = false;
      }
  }

  function openEditPreviewShift(day, staffId, assign) { const staffInfo = previewStats.find(s => s.id === staffId);
  tempEditingShift = { day, staffId, name: assign.name, shift: assign.shift, role: assign.role || 'TV', isOFF: assign.shift === 'OFF', gender: staffInfo ? staffInfo.gender : 'Nữ', originalRole: assign.originalRole !== undefined ? assign.originalRole : (assign.role || 'TV'), originalShift: assign.originalShift !== undefined ? assign.originalShift : assign.shift }; editingShift = JSON.parse(JSON.stringify(tempEditingShift)); }
  function resetEditPreviewShift() { if (!editingShift) return; editingShift.shift = editingShift.originalShift;
  editingShift.role = editingShift.originalRole; editingShift.isOFF = editingShift.shift === 'OFF'; }
  function savePreviewShiftChange() { if (!editingShift || !previewScheduleData) return;
  const dayKey = String(editingShift.day); const dayList = [...previewScheduleData[dayKey]]; const idx = dayList.findIndex(x => x.staffId === editingShift.staffId);
  if (idx !== -1) { const oldRole = dayList[idx].role || 'TV'; const newRole = editingShift.isOFF ? '' : (editingShift.role === 'TV' ? '' : editingShift.role); dayList[idx] = { ...dayList[idx], shift: editingShift.isOFF ? 'OFF' : editingShift.shift, role: newRole, isChanged: true }; previewScheduleData[dayKey] = dayList; const newStats = [...previewStats];
  const statIdx = newStats.findIndex(s => s.id === editingShift.staffId); if (statIdx !== -1) { const s = newStats[statIdx];
  let rOld = oldRole === 'Giao Hàng' ? 'gh' : (oldRole === 'Thu Ngân' ? 'tn' : (oldRole === 'Kho' ? 'kho' : ''));
  if(rOld) s[rOld] = Math.max(0, (s[rOld]||0) - 1); let rNew = newRole === 'Giao Hàng' ? 'gh' : (newRole === 'Thu Ngân' ? 'tn' : (newRole === 'Kho' ? 'kho' : ''));
  if(rNew) s[rNew] = (s[rNew]||0) + 1; previewStats = newStats; } editingShift = null;
  } }
  function viewPersonalSchedule(staffId, staffName) { if(!previewScheduleData) return; let days = Object.keys(previewScheduleData).sort((a,b)=>Number(a)-Number(b)).map(d => { const assign = previewScheduleData[d].find(x => x.staffId === staffId); if(assign) return { day: d, weekday: getWeekday(d), ...assign }; return null; }).filter(x=>x);
  const firstDayDate = new Date(scheduleYear, scheduleMonth - 1, 1); let startDayIdx = firstDayDate.getDay(); if (startDayIdx === 0) startDayIdx = 6;
  else startDayIdx = startDayIdx - 1; let blankCells = Array(startDayIdx).fill(null); const stat = previewStats.find(s => s.id === staffId) || { totalHours:0, gh:0, tn:0, kho:0 }; selectedStaff = { id: staffId, name: staffName, days, blankCells, stats: stat };
  }
  function showDayStats(day) { if (!previewScheduleData || !previewScheduleData[day]) return; const dayData = previewScheduleData[day];
  const roles = ['Kho', 'Thu Ngân', 'GH', 'TV']; const matrix = { 'Kho': {}, 'Thu Ngân': {}, 'GH': {}, 'TV': {} };
  const activeShifts = new Set(); let totalHours = 0; dayData.forEach(assign => { if (assign.shift !== 'OFF') { activeShifts.add(assign.shift); } });
  const cols = Array.from(activeShifts).sort(); roles.forEach(r => { cols.forEach(c => matrix[r][c] = 0); matrix[r]['Total'] = 0; });
  dayData.forEach(assign => { if (assign.shift === 'OFF') return; let r = assign.role || 'TV'; if (r === 'TN') r = 'Thu Ngân'; if (matrix[r]) { matrix[r][assign.shift] = (matrix[r][assign.shift] || 0) + 1; matrix[r]['Total']++; } });
  selectedDayStats = { day, weekday: getWeekday(day), cols, matrix, roles, totalHours }; }
  function handleResetPreview() { previewScheduleData = null; previewStats = [];
  optimizationLogs = []; }
  function handleDayHeaderClick(d) { showDayStats(d); }
</script>

<div class="flex flex-col gap-6 w-full pb-20 animate-fadeIn">
    
    <AdminScheduleToolbar 
        {isDemoMode}
        on:downloadSample={() => { if(!checkDemoAndBlock()) downloadScheduleSample(); }}
        on:uploadStaff={(e) => handleStaffUpload(e.detail)}
        on:openConfig={() => showStoreConfig = true}
        on:openHelp={() => showTour = true}
    />

    <div id="matrix-input-area">
        <ScheduleMatrix 
            bind:staffStats
            bind:shiftMatrix
            bind:weekendMatrix
            bind:activeMatrixMode
            bind:scheduleMonth
            bind:scheduleYear
            {shiftCols}
            {roleRows}
            comboCols={customComboCols}
            {activeSuggestedCombos}
            {comboTotalsMap}
            {genderConfig}
            on:modeChange={(e) => activeMatrixMode = e.detail}
            on:monthChange={(e) => {
                if(e.detail === 1) { if(scheduleMonth==12){scheduleMonth=1;scheduleYear++}else{scheduleMonth++} }
                else { if(scheduleMonth==1){scheduleMonth=12;scheduleYear--}else{scheduleMonth--} }
            }}
            on:calculate={() => handleCalculateCombos(true)}
            on:updateCombo={(e) => updateComboQty(e.detail.role, e.detail.code, e.detail.qty)}
            on:configChange={(e) => { const newConf = {...genderConfig}; newConf[e.detail.type] = e.detail.val; saveGenderConfig(newConf); }}
            on:preview={handleGeneratePreview}
            on:addCol={handleAddColumn}
            on:updateCols={(e) => handleUpdateColumns(e.detail)}
        />
    </div>

    <div id="combo-table-area">
        <div class="flex items-center gap-2 mb-4 px-2">
            <label class="flex items-center gap-2 cursor-pointer bg-amber-50 text-amber-800 px-4 py-2.5 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors shadow-sm">
                <input type="checkbox" bind:checked={ignoreHistory} class="w-4 h-4 text-amber-600 rounded">
                <span class="text-sm font-bold"> Bắt đầu chu kỳ mới (Thuật toán sẽ bỏ qua nợ ca của 3 tháng trước)</span>
            </label>
        </div>

        <SchedulePreview 
            storeId={targetStore}          
            viewMonth={scheduleMonth}      
            viewYear={scheduleYear}        
            bind:inspectionMode
            {previewScheduleData}
            {previewStats}
            {optimizationLogs}
            {INSPECTION_OPTIONS}
            {checkInspectionError}
            {getWeekendFairnessStatus}
            {getWeekendHardRoleCount}
            {getWeekday}
            {getShiftColor}
            {getRoleBadge}
            {isCellRelevant}
            on:inspectionChange={(e) => inspectionMode = e.detail}
            on:fixRotation={handleAutoFixRotation}
            on:fixWeekend={handleAutoFixWeekend}
            on:fixGender={handleAutoFixGender}
            on:optimize={handleOptimize}
            on:reset={handleResetPreview}
            on:apply={handleApplySchedule}
            on:restore={handleRestoreBackup} 
            on:cellClick={(e) => openEditPreviewShift(e.detail.day, e.detail.staffId, e.detail.assign)}
            on:staffClick={(e) => viewPersonalSchedule(e.detail.id, e.detail.name)}
            on:headerClick={(e) => handleDayHeaderClick(e.detail)}
            on:balanceGender={handleManualBalance}
        />
    </div>
</div>

{#if showStoreConfig} <StoreConfig storeId={targetStore} on:close={()=>showStoreConfig=false} /> {/if}
{#if isLoading}<div class="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-[60]"><div class="animate-bounce font-bold text-indigo-900 text-lg">Đang xử lý dữ liệu...</div></div>{/if}
{#if showTour} <TourGuide steps={tourSteps} on:complete={() => showTour = false} /> {/if}

{#if editingShift}
    <AdminEditShiftModal
        bind:editingShift={editingShift}
        {tempEditingShift}
        on:reset={resetEditPreviewShift}
        on:save={savePreviewShiftChange}
        on:close={() => editingShift = null}
    />
{/if}

{#if selectedStaff}
    <AdminPersonalScheduleModal
        {selectedStaff}
        {getRoleBadge}
        on:close={() => selectedStaff = null}
    />
{/if}

{#if selectedDayStats}
    <AdminDayStatsModal
        {selectedDayStats}
        on:close={() => selectedDayStats = null}
    />
{/if}