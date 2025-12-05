<script>
  // Version 54.5 - Fix Critical Syntax Error & Remove Garbage Text
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
  export let targetStore = '';
  
  const dispatch = createEventDispatcher();
  let isLoading = false;
  let scheduleStaffList = [];
  let staffStats = { total: 0, male: 0, female: 0 };
  let scheduleMonth = new Date().getMonth() + 1;
  let scheduleYear = new Date().getFullYear();
  let showStoreConfig = false; 

  let showTour = false;
  const tourSteps = [
      { target: '#toolbar-actions', title: '1. Công Cụ Đầu Vào', content: 'Nơi tải danh sách nhân viên từ Excel và Cấu hình khung giờ hoạt động.' },
      { target: '#month-navigator', title: '2. Chọn Tháng & Chế Độ', content: 'Chọn tháng cần làm lịch. Chuyển đổi qua lại giữa <b>Thứ 2-6</b> và <b>T7-CN</b> để nhập định mức riêng.' },
      { target: '#matrix-header-target', title: '3. Nhập Định Mức', content: 'Nhập số lượng nhân viên cần thiết cho từng bộ phận (Kho, Thu Ngân...) tại các khung giờ bên dưới.' },
      { target: '#btn-calculate', title: '4. Tính Toán Tự Động', content: 'Bấm nút này để hệ thống quy đổi nhu cầu lẻ thành các Combo ca làm việc.' },
      { target: '#combo-header-target', title: '5. Tinh Chỉnh Combo', content: 'Xem kết quả quy đổi bên dưới. Bạn có thể sửa trực tiếp số lượng hoặc Thêm cột ca mới.' },
      { target: '#btn-preview-schedule', title: '6. Tạo & Xem Trước', content: 'Bước cuối: Tạo bảng phân ca chi tiết để kiểm tra và áp dụng.' }
  ];

  const defaultMatrix = { c1: { kho: 0, tn: 0, tv: 0, gh: 0 }, c2: { kho: 0, tn: 0, tv: 0, gh: 0 }, c3: { kho: 0, tn: 0, tv: 0, gh: 0 }, c4: { kho: 0, tn: 0, tv: 0, gh: 0 }, c5: { kho: 0, tn: 0, tv: 0, gh: 0 }, c6: { kho: 0, tn: 0, tv: 0, gh: 0 } };
  let shiftMatrix = JSON.parse(JSON.stringify(defaultMatrix)); 
  let weekendMatrix = JSON.parse(JSON.stringify(defaultMatrix));
  let suggestedCombos = []; 
  let suggestedWeekendCombos = [];
  let activeMatrixMode = 'weekday';
  let genderConfig = { kho: 'none', tn: 'none' };
  
  // Dynamic Columns State
  const DEFAULT_COLS = ['123', '456', '23', '45', '2-5', '2345', '123456', '12-56'];
  let customComboCols = [...DEFAULT_COLS]; 

  let showShortageAlert = false;
  let shortageCount = 0;
  let previewScheduleData = null;
  let previewStats = []; 
  let originalResult = null;
  let optimizationLogs = [];
  let inspectionMode = 'none';
  const shiftCols = [ { id: 'c1', label: 'C1 (08-09h)' }, { id: 'c2', label: 'C2 (09-12h)' }, { id: 'c3', label: 'C3 (12-15h)' }, { id: 'c4', label: 'C4 (15-18h)' }, { id: 'c5', label: 'C5 (18-21h)' }, { id: 'c6', label: 'C6 (21-21h30)' } ];
  const roleRows = [ { id: 'kho', label: 'Kho', color: 'text-orange-600 bg-orange-50 border-orange-100' }, { id: 'tn', label: 'Thu Ngân', color: 'text-purple-600 bg-purple-50 border-purple-100' }, { id: 'gh', label: 'Giao Hàng', color: 'text-blue-600 bg-blue-50 border-blue-100' }, { id: 'tv', label: 'Tư Vấn', color: 'text-gray-600 bg-gray-50 border-gray-200' } ];
  
  const QUICK_SHIFTS = ['OFF', '123', '456', '23', '45', '2345'];
  const INSPECTION_OPTIONS = [ { val: 'none', label: 'Tắt soi lỗi', icon: 'visibility_off', color: 'text-gray-400' }, { val: 'gender', label: 'Soi Giới Tính', icon: 'wc', color: 'text-pink-500' }, { val: 'weekend', label: 'Công Bằng Cuối Tuần', icon: 'balance', color: 'text-indigo-600' }, { val: 'rotation', label: 'Soi Nhịp Sáng/Chiều', icon: 'sync_problem', color: 'text-orange-500' }, { val: 'fatigue', label: 'Soi Trùng Nghiệp Vụ', icon: 'battery_alert', color: 'text-red-600' } ];
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
      } catch (e) { console.error(e); } 
  }
  
  function downloadScheduleSample() { const wb = utils.book_new();
  const wsData = [["Ho_Ten", "Gioi_Tinh"], ["Nguyễn Văn A", "Nam"], ["Trần Thị B", "Nữ"]]; const ws = utils.aoa_to_sheet(wsData); utils.book_append_sheet(wb, ws, "DS_Nhan_Vien");
  writeFile(wb, `Mau_Phan_Ca_${targetStore}.xlsx`); }
  
  async function handleStaffUpload(e) { const file = e.target.files[0]; if(!file) return; isLoading = true;
  setTimeout(async () => { try { const data = await file.arrayBuffer(); const wb = read(data); const json = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); let newStaff = []; for(let i=0; i<json.length; i++) { const row = json[i]; let name = row['Ho_Ten'] || row['Họ Tên'] || ''; let gender = row['Gioi_Tinh'] || row['Giới Tính'] || 'Nữ'; if(name) { newStaff.push({ id: String(newStaff.length+1), name: safeString(name), gender: String(gender).toLowerCase().includes('nam') ? 'Nam' : 'Nữ' }); } } if(newStaff.length > 0) { scheduleStaffList = newStaff; await setDoc(doc(db, 'settings', `staff_list_${targetStore}`), { staffList: scheduleStaffList, updatedAt: serverTimestamp() }); alert(`✅ Đã cập nhật danh sách: ${newStaff.length} nhân viên vào kho ${targetStore}.`); } else { alert(`⚠️ File không có dữ liệu hợp lệ!`); } } catch(e) { alert("Lỗi file: " + e.message); } finally { isLoading=false; e.target.value=null; } }, 100);
  }
  
  function updateComboQty(roleLabel, comboCode, newQty) { const qtyVal = parseInt(newQty) || 0; let currentList = activeMatrixMode === 'weekday' ?
  [...suggestedCombos] : [...suggestedWeekendCombos]; const targetRoles = [roleLabel]; if (roleLabel === 'Thu Ngân') targetRoles.push('TN', 'tn');
  if (roleLabel === 'Giao Hàng') targetRoles.push('GH', 'gh'); if (roleLabel === 'Tư Vấn') targetRoles.push('TV', 'tv');
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
  
  async function handleGeneratePreview() { if (totalCombos > staffStats.total) { 
    alert(`⛔ KHÔNG THỂ TẠO LỊCH!\n\nNhu cầu đang cần ${totalCombos} vị trí, nhưng chỉ có ${staffStats.total} nhân viên.`);
  return; } if (suggestedCombos.length === 0 && suggestedWeekendCombos.length === 0) return alert("Chưa có combo nào!"); isLoading = true;
  try { let prevMonth = scheduleMonth - 1, prevYear = scheduleYear; if(prevMonth === 0) { prevMonth = 12; prevYear--;
  } let prevScheduleData = null; const prevSnap = await getDoc(doc(db, 'stores', targetStore, 'schedules', `${prevYear}-${String(prevMonth).padStart(2,'0')}`)); if(prevSnap.exists()) prevScheduleData = prevSnap.data();
  const comboPayload = { weekday: suggestedCombos, weekend: suggestedWeekendCombos }; const result = generateMonthlySchedule(scheduleStaffList, comboPayload, scheduleMonth, scheduleYear, prevScheduleData, genderConfig);
  originalResult = JSON.parse(JSON.stringify(result)); previewScheduleData = result.schedule; previewStats = result.staffStats; optimizationLogs = []; await tick();
  setTimeout(() => { const previewEl = document.getElementById('preview-schedule-container'); if(previewEl) previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  } catch (e) { alert("Lỗi: " + e.message); } finally { isLoading = false;
  } }
  
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

  function getShiftColor(code) { if (code === 'OFF') return 'bg-slate-100 text-slate-400 border-slate-200 font-bold tracking-wider text-[10px]';
  const map = { '123': 'bg-green-50 text-green-700 border-green-100', '456': 'bg-orange-50 text-orange-700 border-orange-100', '23': 'bg-cyan-50 text-cyan-700 border-cyan-100', '45': 'bg-blue-50 text-blue-700 border-blue-100', '2-5': 'bg-pink-50 text-pink-700 border-pink-100', '2345': 'bg-red-50 text-red-700 border-red-100', '12-56': 'bg-purple-100 text-purple-700 border-purple-200' };
  return map[code] || 'bg-white text-gray-800 border-gray-200'; }
  function getRoleBadge(role) { if (!role || role === 'TV') return null;
  if (role === 'GH' || role === 'Giao Hàng') return { text: 'GH', class: 'bg-blue-600 text-white' };
  if (role === 'Thu Ngân' || role === 'TN') return { text: 'TN', class: 'bg-purple-600 text-white' };
  if (role === 'Kho') return { text: 'K', class: 'bg-orange-500 text-white' }; return { text: role.charAt(0), class: 'bg-gray-500 text-white' };
  }
  function isWeekendDay(d) { const date = new Date(scheduleYear, scheduleMonth - 1, d); const dayOfWeek = date.getDay();
  return (dayOfWeek === 0 || dayOfWeek === 6); }
  function getShiftGroup(code) { 
      return 'OFF'; 
  }
  function isHardRole(roleName) { return ['Kho', 'Thu Ngân', 'Giao Hàng', 'GH', 'TN', 'K'].includes(roleName);
  }
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
  if (mode === 'gender') { if (genderConfig.kho === 'none' && genderConfig.tn === 'none') return false; const dayAssignments = previewScheduleData[d] ||
  []; const sameShiftRole = dayAssignments.filter(a => a.shift === assign.shift && a.role === assign.role && a.shift !== 'OFF');
  if (assign.role === 'Kho') { if (genderConfig.kho === 'male_only' && !assign.gender.toLowerCase().includes('nam')) return `Kho ca ${assign.shift} yêu cầu Nam`;
  if (genderConfig.kho === 'mixed') { const hasMale = sameShiftRole.some(a => a.gender === 'Nam');
  if (!hasMale) return `Kho ca ${assign.shift} thiếu Nam`; } } if (assign.role === 'Thu Ngân') { if (genderConfig.tn === 'female_only' && assign.gender === 'Nam') return `TN ca ${assign.shift} yêu cầu Nữ`;
  if (genderConfig.tn === 'mixed') { const hasMale = sameShiftRole.some(a => a.gender === 'Nam');
  const hasFemale = sameShiftRole.some(a => a.gender !== 'Nam'); if (!hasMale || !hasFemale) return `TN ca ${assign.shift} thiếu cặp đôi`;
  } } return false; } if (mode === 'weekend') { if (!isWeekendDay(d) || !isHardRole(assign.role)) return false; const rowStatus = getWeekendFairnessStatus(assign.staffId);
  if (rowStatus === 1) return "Dư ca nghiệp vụ cuối tuần"; return false;
  } if (mode === 'rotation') { if (d == 1) return false; const prevAssign = previewScheduleData[d-1]?.find(a => a.staffId === assign.staffId);
  if (!prevAssign || prevAssign.shift === 'OFF') return false; 
  return false; } if (mode === 'fatigue') { if (d == 1) return false;
  const prevAssign = previewScheduleData[d-1]?.find(a => a.staffId === assign.staffId); if (!prevAssign || !prevAssign.role) return false;
  if (isHardRole(prevAssign.role) && isHardRole(assign.role)) { return `Làm nghiệp vụ liên tiếp 2 ngày`; } return false; } return false;
  }
  function isCellRelevant(d, assign, currentMode) { const mode = currentMode || inspectionMode; if (mode === 'none') return true;
  if (checkInspectionError(d, assign, mode)) return true; if (mode === 'weekend' && isWeekendDay(d)) return true; if (mode === 'rotation') return true;
  return false; }
  
  function handleAutoFixRotation() { if (!previewScheduleData) return; isLoading = true;
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
  function handleOptimize() { if (!previewScheduleData) return; const beforeOptimizeJSON = JSON.stringify(previewScheduleData); isLoading = true;
  setTimeout(() => { const optResult = optimizeSchedule(previewScheduleData, scheduleStaffList); const afterOptimizeJSON = JSON.stringify(optResult.optimizedSchedule); if (beforeOptimizeJSON === afterOptimizeJSON) { alert("✅ Lịch hiện tại đã tối ưu!"); isLoading = false; return; } previewScheduleData = optResult.optimizedSchedule; const newRoleStats = {}; optResult.finalStats.forEach(s => newRoleStats[s.id] = s.roles); previewStats = previewStats.map(s => { if (newRoleStats[s.id]) { return { ...s, ...newRoleStats[s.id] }; } return s; }); optimizationLogs = optResult.changesLog; isLoading = false; }, 200);
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

          await setDoc(mainRef, { 
              config: { matrix: shiftMatrix, approvedCombos: suggestedCombos, genderConfig, comboCols: customComboCols }, 
              data: previewScheduleData, 
              stats: previewStats, 
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
  tempEditingShift = { day, staffId, name: assign.name, shift: assign.shift, role: assign.role || 'TV', isOFF: assign.shift === 'OFF', gender: staffInfo ?
  staffInfo.gender : 'Nữ', originalRole: assign.originalRole !== undefined ? assign.originalRole : (assign.role || 'TV'), originalShift: assign.originalShift !== undefined ?
  assign.originalShift : assign.shift }; editingShift = JSON.parse(JSON.stringify(tempEditingShift)); }
  function resetEditPreviewShift() { if (!editingShift) return; editingShift.shift = editingShift.originalShift;
  editingShift.role = editingShift.originalRole; editingShift.isOFF = editingShift.shift === 'OFF'; }
  function savePreviewShiftChange() { if (!editingShift || !previewScheduleData) return;
  const dayKey = String(editingShift.day); const dayList = [...previewScheduleData[dayKey]]; const idx = dayList.findIndex(x => x.staffId === editingShift.staffId);
  if (idx !== -1) { const oldRole = dayList[idx].role || 'TV'; const newRole = editingShift.isOFF ?
  '' : (editingShift.role === 'TV' ? '' : editingShift.role); dayList[idx] = { ...dayList[idx], shift: editingShift.isOFF ?
  'OFF' : editingShift.shift, role: newRole, isChanged: true }; previewScheduleData[dayKey] = dayList; const newStats = [...previewStats];
  const statIdx = newStats.findIndex(s => s.id === editingShift.staffId); if (statIdx !== -1) { const s = newStats[statIdx];
  let rOld = oldRole === 'Giao Hàng' ? 'gh' : (oldRole === 'Thu Ngân' ? 'tn' : (oldRole === 'Kho' ? 'kho' : ''));
  if(rOld) s[rOld] = Math.max(0, (s[rOld]||0) - 1); let rNew = newRole === 'Giao Hàng' ?
  'gh' : (newRole === 'Thu Ngân' ? 'tn' : (newRole === 'Kho' ? 'kho' : ''));
  if(rNew) s[rNew] = (s[rNew]||0) + 1; previewStats = newStats; } editingShift = null;
  } }
  function viewPersonalSchedule(staffId, staffName) { if(!previewScheduleData) return; let days = Object.keys(previewScheduleData).sort((a,b)=>Number(a)-Number(b)).map(d => { const assign = previewScheduleData[d].find(x => x.staffId === staffId); if(assign) return { day: d, weekday: getWeekday(d), ...assign }; return null; }).filter(x=>x);
  const firstDayDate = new Date(scheduleYear, scheduleMonth - 1, 1); let startDayIdx = firstDayDate.getDay(); if (startDayIdx === 0) startDayIdx = 6;
  else startDayIdx = startDayIdx - 1; let blankCells = Array(startDayIdx).fill(null); const stat = previewStats.find(s => s.id === staffId) ||
  { totalHours:0, gh:0, tn:0, kho:0 }; selectedStaff = { id: staffId, name: staffName, days, blankCells, stats: stat };
  }
  function showDayStats(day) { if (!previewScheduleData || !previewScheduleData[day]) return; const dayData = previewScheduleData[day];
  const roles = ['Kho', 'Thu Ngân', 'GH', 'TV']; const matrix = { 'Kho': {}, 'Thu Ngân': {}, 'GH': {}, 'TV': {} };
  const activeShifts = new Set(); let totalHours = 0; dayData.forEach(assign => { if (assign.shift !== 'OFF') { activeShifts.add(assign.shift); } });
  const cols = Array.from(activeShifts).sort(); roles.forEach(r => { cols.forEach(c => matrix[r][c] = 0); matrix[r]['Total'] = 0; });
  dayData.forEach(assign => { if (assign.shift === 'OFF') return; let r = assign.role || 'TV'; if (r === 'TN') r = 'Thu Ngân'; if (matrix[r]) { matrix[r][assign.shift] = (matrix[r][assign.shift] || 0) + 1; matrix[r]['Total']++; } });
  selectedDayStats = { day, weekday: getWeekday(day), cols, matrix, roles, totalHours }; }
  function getDayColTotal(col) { return selectedDayStats ?
  selectedDayStats.roles.reduce((sum, r) => sum + (selectedDayStats.matrix[r][col]||0), 0) : 0; }
  function getDayGrandTotal() { return selectedDayStats ?
  selectedDayStats.roles.reduce((sum, r) => sum + selectedDayStats.matrix[r]['Total'], 0) : 0; }
  function handleResetPreview() { previewScheduleData = null; previewStats = [];
  optimizationLogs = []; }
  function handleDayHeaderClick(d) { showDayStats(d); }
</script>

<div class="flex flex-col gap-6 w-full pb-20 animate-fadeIn">
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div class="flex items-center gap-2">
            <div id="toolbar-actions" class="flex items-center gap-2">
                <button class="bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center gap-1 border border-blue-100" on:click={(e) => checkDemoAndBlock(e) || downloadScheduleSample()}>Tải Mẫu</button>
                <label class="bg-blue-600 text-white hover:bg-blue-700 font-bold py-2 px-3 rounded-lg text-xs cursor-pointer flex items-center gap-1 shadow-lg shadow-blue-200 transition-all active:scale-95">
                    <span class="material-icons-round text-sm">upload</span> Upload
                    <input type="file" hidden accept=".xlsx" disabled={isDemoMode} on:change={(e) => handleStaffUpload(e)}>
                </label>
                <div class="w-px h-8 bg-slate-200 mx-1"></div>
                <button class="bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center gap-1 border border-gray-200" on:click={()=>showStoreConfig=true}>
                    <span class="material-icons-round text-sm">settings</span> Khai báo giờ công
                </button>
            </div>
        </div>
        <div class="flex items-center gap-2">
             <button id="btn-help-schedule" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400" on:click={() => showTour = true}><span class="material-icons-round">help_outline</span></button>
        </div>
    </div>

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
        <SchedulePreview 
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

{#if editingShift} 
    <div class="fixed inset-0 z-[80] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={()=>editingShift=null}> 
        <div class="bg-white w-full max-w-sm rounded-xl p-5 shadow-2xl" on:click|stopPropagation> 
            <div class="flex justify-between items-start mb-4"> 
                <div>
                    <h3 class="font-bold text-lg text-slate-800">Sửa Ca: {editingShift.name}</h3>
                    <p class="text-xs text-gray-500">Ngày {editingShift.day} - Hiện tại: <span class="font-bold">{tempEditingShift.shift}</span></p>
                </div> 
                {#if editingShift.shift !== editingShift.originalShift || editingShift.role !== editingShift.originalRole} 
                    <button class="text-xs text-red-600 hover:underline font-bold bg-red-50 px-2 py-1 rounded" on:click={resetEditPreviewShift}>Reset về gốc</button> 
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
                <button class="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all" on:click={savePreviewShiftChange}>Lưu Thay Đổi</button> 
            </div> 
        </div> 
    </div> 
{/if}

{#if selectedStaff} 
    <div class="fixed inset-0 z-[90] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={()=>selectedStaff=null}> 
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

{#if selectedDayStats} 
    <div class="fixed inset-0 z-[90] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={()=>selectedDayStats=null}> 
        <div class="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" on:click|stopPropagation> 
            <div class="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center"> 
                <h3 class="font-bold text-lg text-slate-800"> Chi Tiết Ngày {selectedDayStats.day} ({selectedDayStats.weekday}) <span class="ml-2 text-sm text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">Tổng công: {selectedDayStats.totalHours} giờ</span> </h3> 
                <button on:click={()=>selectedDayStats=null} class="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center"><span class="material-icons-round text-slate-500">close</span></button> 
            </div> 
            <div class="p-5 overflow-x-auto"> 
                <table class="w-full text-sm border-separate border-spacing-0 rounded-xl overflow-hidden border border-slate-200"> 
                    <thead class="bg-slate-50 text-slate-500"><tr><th class="p-3 text-left font-bold border-b border-r border-slate-200">Bộ Phận</th>{#each selectedDayStats.cols as col}<th class="p-2 text-center border-b border-slate-200 border-l border-white min-w-[50px]"><div class="font-black text-slate-700">{col}</div></th>{/each}<th class="p-3 text-center font-bold bg-slate-100 border-b border-l border-slate-200 text-slate-700">Tổng</th></tr></thead> 
                    <tbody> 
                        {#each selectedDayStats.roles as role} 
                            <tr class="hover:bg-slate-50 transition-colors"> 
                                <td class="p-3 font-bold border-r border-slate-100 {role==='GH'?'text-blue-600':(role==='Thu Ngân'?'text-purple-600':(role==='Kho'?'text-orange-600':'text-gray-600'))}">{role}</td> 
                                {#each selectedDayStats.cols as col}<td class="p-2 border-r border-slate-100 text-center font-mono {selectedDayStats.matrix[role][col]>0?'font-bold text-slate-800':'text-gray-300'}">{selectedDayStats.matrix[role][col] || '-'}</td>{/each} 
                                <td class="p-3 text-center font-black text-slate-700 bg-slate-50 border-l border-slate-100">{selectedDayStats.matrix[role]['Total']}</td> 
                            </tr> 
                        {/each} 
                    </tbody> 
                    <tfoot class="bg-slate-800 text-slate-300 font-bold"><tr><td class="p-3 text-right text-xs uppercase tracking-wider">Tổng Cộng</td>{#each selectedDayStats.cols as col}<td class="p-3 text-center text-yellow-400 font-mono text-lg">{getDayColTotal(col)}</td>{/each}<td class="p-3 text-center text-white text-xl bg-slate-900">{getDayGrandTotal()}</td></tr></tfoot> 
                </table> 
            </div> 
        </div> 
    </div> 
{/if}

{#if showTour} <TourGuide steps={tourSteps} on:complete={() => showTour = false} /> {/if}