<script>
  // Version 12.0 - Instant Task Creation & Renaming UI
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { read, utils, writeFile } from 'xlsx';
  import { db } from '../lib/firebase';
  // UPDATE: Thêm addDoc để tạo task ngay lập tức
  import { doc, setDoc, serverTimestamp, getDoc, updateDoc, writeBatch, collection, query, where, getDocs, deleteDoc, addDoc } from 'firebase/firestore';
  import { taskTemplate, currentUser } from '../lib/stores';
  // UPDATE: Thêm getTodayStr để lấy ngày hiện tại
  import { safeString, getTodayStr } from '../lib/utils';
  import { calculateCombosFromMatrix, generateMonthlySchedule } from '../lib/scheduleLogic';
  import { optimizeSchedule } from '../lib/optimization';
  import TourGuide from './TourGuide.svelte'; 

  const dispatch = createEventDispatcher();
  $: isSuperAdmin = $currentUser?.role === 'super_admin';
  $: myStores = $currentUser?.storeIds || [];
  
  let targetStore = '';
  $: if (myStores.length > 0 && !targetStore) { targetStore = myStores[0]; }
  $: if (targetStore) { loadStoreData(); loadAccountList(); }

  $: isDemoMode = targetStore.includes('DEMO');

  function checkDemoAndBlock(e) {
      if (isDemoMode) {
          e && e.preventDefault();
          e && e.stopPropagation();
          alert("Tài khoản demo không có tính năng này, vui lòng liên hệ 3031 để được cấp quyền");
          return true;
      }
      return false;
  }

  let activeSection = 'schedule'; 
  let isLoading = false;
  let showTour = false;
  
  // BIẾN CHO TAB TÀI KHOẢN
  let newAdminUser = '';
  let newAdminPass = ''; 
  let newAdminStore = '';
  let accountList = [];
  // BIẾN CHO MODAL THÊM 1 NGƯỜI
  let showAddUserModal = false;
  let singleGender = 'Nữ';
  let singleUsername = '';
  let singlePass = '123456';
  let singleRole = 'staff';
  // Config Tour Steps
  const matrixSteps = [{ target: '#store-select-container', title: '1. Chọn Kho', content: 'Xác định kho bạn đang muốn thao tác cấu hình.' }, { target: '#btn-download-schedule-sample', title: '2. Tải Mẫu DS', content: 'Tải file Excel mẫu: Ho_Ten, Gioi_Tinh, Ma_Kho.' }, { target: '#btn-import-staff', title: '3. Import Nhân Sự', content: 'Upload danh sách để nạp nhân viên vào hệ thống phân ca.' }, { target: '#matrix-table', title: '4. Định Mức', content: 'Nhập số lượng nhân sự cần thiết cho từng ca.' }, { target: '#btn-calculate', title: '5. Tính Toán', content: 'Quy đổi định mức ra Combo.' }, { target: '#btn-preview', title: '6. Xem Trước', content: 'Tạo và tối ưu lịch.' }];
  const templateSteps = [{ target: '#store-select-container', title: '1. Chọn Kho', content: 'Chọn kho để áp dụng mẫu công việc này.' }, { target: '#dept-select-container', title: '2. Chọn Bộ Phận', content: 'Chọn bộ phận muốn tạo việc mẫu.' }, { target: '#template-form', title: '3. Nhập Thông Tin', content: 'Điền giờ và tên công việc.' }, { target: '#btn-save-template', title: '4. Lưu Lại', content: 'Thêm vào danh sách.' }];
  const accountSteps = [{ target: '#btn-add-single', title: '1. Thêm Thủ Công', content: 'Tạo nhanh tài khoản (Tên đăng nhập sẽ là tên hiển thị).' }, { target: '#btn-upload-accounts', title: '2. Upload Excel', content: 'Dùng khi cần tạo danh sách lớn hàng loạt.' }, { target: '#account-table', title: '3. Quản Lý', content: 'Danh sách nhân viên hiện có.' }];
  
  let currentSteps = matrixSteps;
  function startAdminTour() { if (activeSection === 'schedule') currentSteps = matrixSteps; else if (activeSection === 'template') currentSteps = templateSteps; else currentSteps = accountSteps; showTour = true; }

  // Logic Schedule Variables
  let previewScheduleData = null;
  let previewStats = []; let originalResult = null; let optimizationLogs = []; 
  let scheduleMonth = new Date().getMonth() + 1;
  let scheduleYear = new Date().getFullYear();
  let scheduleStaffList = []; let staffStats = { total: 0, male: 0, female: 0 };
  $: { if (scheduleStaffList && scheduleStaffList.length > 0) { try { staffStats = { total: scheduleStaffList.length, male: scheduleStaffList.filter(s => String(s.gender || '').trim().toLowerCase() === 'nam').length, female: scheduleStaffList.filter(s => String(s.gender || '').trim().toLowerCase() !== 'nam').length }; } catch (e) { staffStats = { total: scheduleStaffList.length, male: 0, female: 0 }; } } else { staffStats = { total: 0, male: 0, female: 0 }; } }
  const defaultMatrix = { c1: { kho: 0, tn: 0, tv: 0, gh: 0 }, c2: { kho: 0, tn: 0, tv: 0, gh: 0 }, c3: { kho: 0, tn: 0, tv: 0, gh: 0 }, c4: { kho: 0, tn: 0, tv: 0, gh: 0 }, c5: { kho: 0, tn: 0, tv: 0, gh: 0 }, c6: { kho: 0, tn: 0, tv: 0, gh: 0 } };
  let shiftMatrix = JSON.parse(JSON.stringify(defaultMatrix));
  let suggestedCombos = [];
  $: totalCombos = suggestedCombos.reduce((sum, c) => sum + (parseInt(c.qty)||0), 0);
  let comboTotalsMap = {};
  $: { const map = {}; comboCols.forEach(code => { const items = suggestedCombos.filter(c => c.code === code); map[code] = items.reduce((sum, c) => sum + (parseInt(c.qty) || 0), 0); }); comboTotalsMap = map; }
  const shiftCols = [ { id: 'c1', label: 'C1 (08-09h)' }, { id: 'c2', label: 'C2 (09-12h)' }, { id: 'c3', label: 'C3 (12-15h)' }, { id: 'c4', label: 'C4 (15-18h)' }, { id: 'c5', label: 'C5 (18-21h)' }, { id: 'c6', label: 'C6 (21-21h30)' } ];
  const roleRows = [ { id: 'kho', label: 'Kho', color: 'text-orange-600 bg-orange-50 border-orange-100' }, { id: 'tn', label: 'Thu Ngân', color: 'text-purple-600 bg-purple-50 border-purple-100' }, { id: 'gh', label: 'Giao Hàng', color: 'text-blue-600 bg-blue-50 border-blue-100' }, { id: 'tv', label: 'Tư Vấn', color: 'text-gray-600 bg-gray-50 border-gray-200' } ];
  const comboCols = ['123', '456', '23', '45', '2-5', '2345'];
  let activeTemplateType = 'warehouse'; let newTemplateTime = '08:00';
  let newTemplateTitle = ''; let newTemplateImportant = false; let selectedDays = [0, 1, 2, 3, 4, 5, 6];
  let editingTemplateIndex = -1;
  const weekDays = [{ val: 1, label: 'T2' }, { val: 2, label: 'T3' }, { val: 3, label: 'T4' }, { val: 4, label: 'T5' }, { val: 5, label: 'T6' }, { val: 6, label: 'T7' }, { val: 0, label: 'CN' }];
  onMount(async () => { await loadStoreData(); });

  // Các hàm logic cũ (Giữ nguyên)
  async function loadStoreData() { if (!targetStore) return; scheduleStaffList = []; shiftMatrix = JSON.parse(JSON.stringify(defaultMatrix)); suggestedCombos = []; previewScheduleData = null; try { const staffSnap = await getDoc(doc(db, 'settings', `staff_list_${targetStore}`)); if (staffSnap.exists()) scheduleStaffList = staffSnap.data().staffList || []; const configSnap = await getDoc(doc(db, 'settings', `shift_matrix_${targetStore}`)); if (configSnap.exists()) { const loaded = configSnap.data().matrix; shiftMatrix = { ...defaultMatrix, ...loaded }; setTimeout(() => { if(getGrandTotal(shiftMatrix) > 0) handleCalculateCombos(false); }, 200); } } catch (e) { console.error(e); } }
  function matchRoleCode(uiLabel) { if (!uiLabel) return 'TV'; const cleanLabel = uiLabel.trim(); if (cleanLabel === 'Giao Hàng') return 'GH'; if (cleanLabel === 'Tư Vấn') return 'TV'; return cleanLabel; }
  function getComboQty(roleLabel, comboCode, sourceArray) { const targetRole = matchRoleCode(roleLabel); const found = sourceArray.find(c => { let cRole = c.role || 'TV'; if (cRole === 'TN') cRole = 'Thu Ngân'; return c.code === comboCode && cRole === targetRole; }); return found ? found.qty : 0; }
  function updateComboQty(roleLabel, comboCode, newQty) { const targetRole = matchRoleCode(roleLabel); const qtyVal = parseInt(newQty) || 0; const idx = suggestedCombos.findIndex(c => { let cRole = c.role || 'TV'; if (cRole === 'TN') cRole = 'Thu Ngân'; return c.code === comboCode && cRole === targetRole; }); if (idx >= 0) { suggestedCombos[idx].qty = qtyVal; } else if (qtyVal > 0) { suggestedCombos.push({ code: comboCode, role: targetRole, label: `${roleLabel} ${comboCode}`, qty: qtyVal }); } suggestedCombos = [...suggestedCombos]; }
  function getRoleTotal(roleId, matrix) { return Object.values(matrix).reduce((sum, s) => sum + (parseInt(s[roleId])||0), 0); }
  function getShiftTotal(shiftId, matrix) { const s = matrix[shiftId] || {}; return (parseInt(s.kho)||0) + (parseInt(s.tn)||0) + (parseInt(s.tv)||0) + (parseInt(s.gh)||0); }
  function getGrandTotal(matrix) { return Object.values(matrix).reduce((sum, s) => sum + (parseInt(s.kho)||0) + (parseInt(s.tn)||0) + (parseInt(s.tv)||0) + (parseInt(s.gh)||0), 0); }
  function handleMatrixChange() { shiftMatrix = shiftMatrix; }
  async function handleCalculateCombos(save = true) { if(save) isLoading = true; try { const cleanMatrix = JSON.parse(JSON.stringify(shiftMatrix)); Object.keys(cleanMatrix).forEach(key => { if(cleanMatrix[key]) { ['kho', 'tn', 'tv', 'gh'].forEach(role => { let raw = cleanMatrix[key][role]; let val = parseInt(raw); if (isNaN(val)) val = 0; cleanMatrix[key][role] = val; }); } }); shiftMatrix = cleanMatrix; if(save) { await setDoc(doc(db, 'settings', `shift_matrix_${targetStore}`), { matrix: shiftMatrix, updatedAt: serverTimestamp(), updatedBy: $currentUser.username }); } suggestedCombos = []; await tick(); const result = calculateCombosFromMatrix(shiftMatrix); suggestedCombos = result; const currentTotal = suggestedCombos.reduce((sum, c) => sum + (c.qty || 0), 0); if (currentTotal === 0 && getGrandTotal(shiftMatrix) > 0 && save) alert("⚠️ Kết quả tính toán bằng 0! Kiểm tra lại định mức."); } catch (e) { alert("Lỗi tính toán: " + e.message); } finally { if(save) isLoading = false; } }
  async function handleGeneratePreview() { if (totalCombos === 0) return alert("Chưa có combo nào!"); if (scheduleStaffList.length === 0) return alert("Chưa có nhân viên!"); isLoading = true; try { let prevMonth = scheduleMonth - 1, prevYear = scheduleYear; if(prevMonth === 0) { prevMonth = 12; prevYear--; } let prevScheduleData = null; const prevSnap = await getDoc(doc(db, 'stores', targetStore, 'schedules', `${prevYear}-${String(prevMonth).padStart(2,'0')}`)); if(prevSnap.exists()) prevScheduleData = prevSnap.data(); const result = generateMonthlySchedule(scheduleStaffList, suggestedCombos, scheduleMonth, scheduleYear, prevScheduleData); originalResult = JSON.parse(JSON.stringify(result)); previewScheduleData = result.schedule; previewStats = result.staffStats; optimizationLogs = []; await tick(); setTimeout(() => { const previewEl = document.getElementById('preview-schedule-container'); if(previewEl) previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100); } catch (e) { alert("Lỗi: " + e.message); } finally { isLoading = false; } }
  function handleOptimize() { if (!previewScheduleData) return; const beforeOptimizeJSON = JSON.stringify(previewScheduleData); isLoading = true; setTimeout(() => { const optResult = optimizeSchedule(previewScheduleData, scheduleStaffList); const afterOptimizeJSON = JSON.stringify(optResult.optimizedSchedule); if (beforeOptimizeJSON === afterOptimizeJSON) { alert("✅ Lịch hiện tại đã tối ưu! Không tìm thấy điểm cần điều chỉnh."); isLoading = false; return; } previewScheduleData = optResult.optimizedSchedule; const newRoleStats = {}; optResult.finalStats.forEach(s => newRoleStats[s.id] = s.roles); previewStats = previewStats.map(s => { if (newRoleStats[s.id]) { return { ...s, ...newRoleStats[s.id] }; } return s; }); optimizationLogs = optResult.changesLog; isLoading = false; }, 200); }
  function handleResetPreview() { if (originalResult) { previewScheduleData = JSON.parse(JSON.stringify(originalResult.schedule)); previewStats = JSON.parse(JSON.stringify(originalResult.staffStats)); optimizationLogs = []; } }
  async function handleApplySchedule() { if (!previewScheduleData) return; if (!confirm(`⚠️ XÁC NHẬN ÁP DỤNG LỊCH THÁNG ${scheduleMonth}/${scheduleYear}?`)) return; isLoading = true; try { const scheduleId = `${scheduleYear}-${String(scheduleMonth).padStart(2,'0')}`; await setDoc(doc(db, 'stores', targetStore, 'schedules', scheduleId), { config: { matrix: shiftMatrix, approvedCombos: suggestedCombos }, data: previewScheduleData, stats: previewStats, endOffset: originalResult.endOffset, updatedAt: serverTimestamp(), updatedBy: $currentUser.username }); alert("✅ Đã áp dụng lịch thành công!"); dispatch('close'); dispatch('switchTab', 'schedule'); } catch (e) { alert("Lỗi: " + e.message); } finally { isLoading = false; } }
  function getWeekday(day) { const date = new Date(scheduleYear, scheduleMonth - 1, day); return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]; }
  function toggleDay(d) { if (selectedDays.includes(d)) { if (selectedDays.length > 1) selectedDays = selectedDays.filter(x => x !== d); } else selectedDays = [...selectedDays, d]; }
  
  // --- HÀM SAVE TEMPLATE ĐƯỢC CẬP NHẬT LOGIC TẠO TASK NGAY ---
  async function saveTemplate() {
    const today = new Date();
    const currentDay = today.getDay();
    const isNew = editingTemplateIndex === -1;

    // 1. Lưu vào Cấu hình (Template)
    taskTemplate.update(curr => { 
        const up = { ...$taskTemplate }; 
        if (!up[activeTemplateType]) up[activeTemplateType] = []; 
        const newItem = { title: newTemplateTitle, time: newTemplateTime, isImportant: newTemplateImportant, days: selectedDays }; 
        if (editingTemplateIndex >= 0) up[activeTemplateType][editingTemplateIndex] = newItem; 
        else up[activeTemplateType].push(newItem); 
        
        up[activeTemplateType].sort((a,b) => (a.time||"00:00").localeCompare(b.time||"00:00")); 
        
        // Lưu cho tất cả các kho của user
        myStores.forEach(sid => setDoc(doc(db, 'settings', `template_${sid}`), up)); 
        return up; 
    });

    // 2. LOGIC MỚI: Nếu đang Tạo Mới (không phải Sửa) và Ngày chọn trùng với Hôm nay -> Tạo Task ngay
    if (isNew && selectedDays.includes(currentDay)) {
        try {
            const batchPromises = myStores.map(sid => {
                return addDoc(collection(db, 'tasks'), {
                    type: activeTemplateType,
                    title: newTemplateTitle,
                    timeSlot: newTemplateTime,
                    completed: false,
                    completedBy: null,
                    time: null,
                    note: '',
                    createdBy: 'Admin',
                    date: getTodayStr(),
                    storeId: sid,
                    isImportant: newTemplateImportant,
                    timestamp: serverTimestamp()
                });
            });
            await Promise.all(batchPromises);
            // Không alert làm phiền, chỉ cần task hiện ra ngoài là được
        } catch (e) {
            console.error("Lỗi tạo task nhanh:", e);
        }
    }

    newTemplateTitle = ''; newTemplateImportant = false; editingTemplateIndex = -1; selectedDays = [0,1,2,3,4,5,6];
  }

  function editTemplate(idx, item) { editingTemplateIndex = idx; newTemplateTitle = item.title; newTemplateTime = item.time; newTemplateImportant = item.isImportant || false; selectedDays = item.days || [0,1,2,3,4,5,6]; }
  function deleteTemplate(idx) { if(!confirm("Xóa?")) return; taskTemplate.update(curr => { const up = {...curr}; up[activeTemplateType].splice(idx, 1); myStores.forEach(sid => setDoc(doc(db, 'settings', `template_${sid}`), up)); return up; }); if(editingTemplateIndex === idx) { editingTemplateIndex = -1; newTemplateTitle = ''; } }
  function downloadScheduleSample() { const wb = utils.book_new(); const wsData = [["Ho_Ten", "Gioi_Tinh", "Ma_Kho"], ["Nguyễn Văn A", "Nam", targetStore], ["Trần Thị B", "Nữ", targetStore]]; const ws = utils.aoa_to_sheet(wsData); utils.book_append_sheet(wb, ws, "DS_Nhan_Vien"); writeFile(wb, `Mau_Phan_Ca_${targetStore}.xlsx`); }
  function downloadAccountSample() { const wb = utils.book_new(); const wsData = [["username", "pass", "ma_kho", "role"], [`nv1_${targetStore}`, "123456", targetStore, "staff"], [`quanly_${targetStore}`, "123456", targetStore, "admin"]]; const ws = utils.aoa_to_sheet(wsData); utils.book_append_sheet(wb, ws, "DS_Cap_Quyen"); writeFile(wb, `Mau_Tai_Khoan_${targetStore}.xlsx`); }

  async function loadAccountList() { if (!targetStore) return; try { const q = query(collection(db, 'users'), where('storeIds', 'array-contains', targetStore)); const snap = await getDocs(q); const list = []; snap.forEach(d => list.push({id: d.id, ...d.data()})); accountList = list; } catch (e) { console.error("Load accounts failed:", e); } }
  async function deleteAccount(uid) { if (checkDemoAndBlock()) return; if (!confirm(`Xóa tài khoản ${uid}? Hành động này không thể hoàn tác.`)) return; try { await deleteDoc(doc(db, 'users', uid)); await loadAccountList(); } catch (e) { alert("Lỗi xóa: " + e.message); } }
  async function changeRole(uid, newRole) { if (checkDemoAndBlock()) return; if (!confirm(`Đổi quyền tài khoản ${uid} thành ${newRole}?`)) return; try { await updateDoc(doc(db, 'users', uid), { role: newRole }); await loadAccountList(); } catch (e) { alert("Lỗi đổi quyền: " + e.message); } }
  async function resetPassword(uid) { if (checkDemoAndBlock()) return; if (!confirm(`Xác nhận đặt lại mật khẩu cho ${uid} thành '123456'?`)) return; try { await updateDoc(doc(db, 'users', uid), { pass: '123456' }); alert(`✅ Đã reset mật khẩu cho ${uid}.`); } catch (e) { alert("Lỗi reset: " + e.message); } }

  async function handleCreateSingleUser() { if (checkDemoAndBlock()) return; if (!singleUsername || !singlePass) return alert("Vui lòng nhập đủ thông tin!"); const uid = safeString(singleUsername).toLowerCase(); const nameToSave = uid; isLoading = true; const batch = writeBatch(db); try { const userRef = doc(db, 'users', uid); batch.set(userRef, { username: uid, username_idx: uid, pass: singlePass, name: nameToSave, gender: singleGender, role: singleRole, storeId: targetStore, storeIds: [targetStore], createdAt: serverTimestamp() }); const newStaffEntry = { id: String(scheduleStaffList.length + 1 + Date.now()%100), name: nameToSave, gender: singleGender }; const updatedStaffList = [...scheduleStaffList, newStaffEntry]; const staffListRef = doc(db, 'settings', `staff_list_${targetStore}`); batch.set(staffListRef, { staffList: updatedStaffList, updatedAt: serverTimestamp() }); await batch.commit(); alert(`✅ Đã thêm nhân viên: ${nameToSave}`); showAddUserModal = false; singleUsername = ''; singleRole = 'staff'; await loadStoreData(); await loadAccountList(); } catch (e) { alert("Lỗi tạo user: " + e.message); } finally { isLoading = false; } }
  async function handleCreateAdmin() { if (checkDemoAndBlock()) return; if (!newAdminUser || !newAdminPass || !newAdminStore) return alert("Vui lòng điền đủ thông tin!"); isLoading = true; try { const usernameClean = safeString(newAdminUser).toLowerCase(); const nameToSave = usernameClean; await setDoc(doc(db, 'users', usernameClean), { username: usernameClean, username_idx: usernameClean, pass: newAdminPass, name: nameToSave, role: 'admin', storeId: newAdminStore, storeIds: [newAdminStore], createdAt: serverTimestamp() }); alert(`✅ Đã tạo tài khoản quản lý: ${usernameClean}`); newAdminUser = ''; newAdminPass = ''; newAdminStore = ''; } catch (e) { alert("Lỗi: " + e.message); } finally { isLoading = false; } }
  async function handleStaffUpload(e) { const file = e.target.files[0]; if(!file) return; isLoading = true; setTimeout(async () => { try { const data = await file.arrayBuffer(); const wb = read(data); const json = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); let newStaff = []; let skipped = 0; for(let i=0; i<json.length; i++) { const row = json[i]; let maKho = row['Ma_Kho'] || row['Mã Kho'] || row['ma_kho'] || ''; if (String(maKho).trim() !== String(targetStore)) { skipped++; continue; } let nameVal = row['Ho_Ten'] || row['Họ Tên'] || ''; if (!nameVal) Object.values(row).forEach(v => { if(v && typeof v === 'string' && v.trim().length > nameVal.length) nameVal = v.trim(); }); let genderVal = row['Gioi_Tinh'] || row['Giới Tính'] || 'Nữ'; if (String(genderVal).toLowerCase().includes('nam')) genderVal = 'Nam'; else genderVal = 'Nữ'; if(nameVal.length > 2) { newStaff.push({ id: String(newStaff.length + 1), name: safeString(nameVal), gender: genderVal }); } } if(newStaff.length === 0) throw new Error(`Không tìm thấy nhân viên nào cho kho ${targetStore}! (Bỏ qua ${skipped} dòng khác kho)`); scheduleStaffList = newStaff; await setDoc(doc(db, 'settings', `staff_list_${targetStore}`), { staffList: scheduleStaffList, updatedAt: serverTimestamp() }); alert(`✅ Đã cập nhật ${newStaff.length} nhân sự cho kho ${targetStore}!`); } catch(err) { alert("Lỗi: " + err.message); } finally { isLoading = false; e.target.value = null; } }, 100); }
  async function handleAccountUpload(e) { const file = e.target.files[0]; if(!file) return; isLoading = true; setTimeout(async () => { try { const data = await file.arrayBuffer(); const wb = read(data); const json = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); const batch = writeBatch(db); let count = 0; for(let i=0; i<json.length; i++) { const row = json[i]; const u = row['username']; const p = row['pass']; const s = row['ma_kho'] || row['mã kho']; const r = row['role']; if (u && p && s && r) { const uid = safeString(u).toLowerCase(); const userRef = doc(db, 'users', uid); batch.set(userRef, { username: uid, username_idx: uid, pass: String(p), name: uid, role: safeString(r).toLowerCase(), storeId: String(s), storeIds: [String(s)], createdAt: serverTimestamp() }); count++; } } if (count > 0) { await batch.commit(); alert(`✅ Đã tạo/cập nhật ${count} tài khoản thành công!`); await loadAccountList(); } else { alert("⚠️ Không tìm thấy dữ liệu hợp lệ (Cần đủ 4 cột: username, pass, ma_kho, role)"); } } catch(err) { alert("Lỗi: " + err.message); } finally { isLoading = false; e.target.value = null; } }, 100); }
</script>

<div class="fixed inset-0 z-50 bg-slate-100 flex flex-col animate-fadeIn">
    <div class="h-16 bg-white border-b border-slate-200 flex items-center justify-center lg:justify-between px-6 shrink-0 shadow-sm z-20">
        <div class="flex items-center gap-6">
            <button class="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-all text-slate-500 hover:text-indigo-600" on:click={() => dispatch('close')}>
                <span class="material-icons-round">arrow_back</span>
            </button>
            <h2 class="text-xl font-bold text-slate-800 tracking-tight hidden lg:block">Quản Trị</h2>
            <div class="flex items-center gap-2">
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
                <button class="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100" on:click={startAdminTour} title="Hướng dẫn"><span class="material-icons-round text-lg">help</span></button>
            </div>
        </div>
    </div>

    <div class="flex-1 overflow-auto p-4 lg:p-6 relative">
        {#if activeSection === 'schedule'}
            <div class="flex flex-col gap-6 w-full pb-20">
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 shrink-0">
                    <div id="tour-admin-matrix" class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[480px]">
                        <div class="p-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/50">
                            <div class="flex justify-between items-center">
                                <div><h3 class="font-bold text-slate-800 text-lg">Định Mức Nhân Sự</h3></div>
                                <div class="flex items-center gap-2">
                                    <button id="btn-download-schedule-sample" class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100" on:click={checkDemoAndBlock(event) || downloadScheduleSample()}>Tải Mẫu</button>
                                    <label id="btn-import-staff" class="btn-sm flex items-center gap-2 bg-white border border-indigo-100 text-indigo-600 px-3 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-50 cursor-pointer {isDemoMode ? 'opacity-50' : ''}" on:click={(e) => checkDemoAndBlock(e)}>
                                        <span class="material-icons-round text-base">upload_file</span> Import
                                        <input type="file" hidden accept=".xlsx" disabled={isDemoMode} on:change={(e) => handleStaffUpload(e)}>
                                    </label>
                                </div>
                            </div>
                            <div class="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm w-fit">
                                <button class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded" on:click={()=>{if(scheduleMonth==1){scheduleMonth=12;scheduleYear--}else{scheduleMonth--}}}><span class="material-icons-round text-sm">chevron_left</span></button>
                                <div class="flex items-center gap-1 font-bold text-slate-700 text-sm px-2"><span>T</span><input type="number" bind:value={scheduleMonth} class="w-8 text-center bg-transparent outline-none text-indigo-600"><span>/</span><input type="number" bind:value={scheduleYear} class="w-12 text-center bg-transparent outline-none text-indigo-600"></div>
                                <button class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded" on:click={()=>{if(scheduleMonth==12){scheduleMonth=1;scheduleYear++}else{scheduleMonth++}}}><span class="material-icons-round text-sm">chevron_right</span></button>
                            </div>
                            {#if staffStats.total > 0}<div class="flex items-center gap-4 text-xs font-bold bg-green-50 text-green-800 px-3 py-2 rounded-lg border border-green-100"><span>Tổng: {staffStats.total}</span><span>Nam: {staffStats.male}</span><span>Nữ: {staffStats.female}</span></div>{/if}
                        </div>
                        <div id="matrix-table" class="flex-1 overflow-auto p-4">
                             <table class="w-full text-sm border-separate border-spacing-0 rounded-xl overflow-hidden border border-slate-200">
                                <thead class="bg-slate-50 text-slate-500"><tr><th class="p-3 text-left font-bold border-b border-r border-slate-200">Bộ Phận</th>{#each shiftCols as col}<th class="p-2 text-center border-b border-slate-200 border-l border-white min-w-[60px]"><div class="font-black text-slate-700">{col.id.toUpperCase()}</div></th>{/each}<th class="p-3 text-center font-bold bg-slate-100 border-b border-l border-slate-200 text-slate-700">Tổng</th></tr></thead>
                                <tbody>
                                    {#each roleRows as role}
                                        <tr class="group hover:bg-slate-50/50 transition-colors">
                                            <td class="p-3 font-bold border-r border-slate-100 {role.color} border-l-4">{role.label}</td>
                                            {#each shiftCols as shift}
                                                <td class="p-1 border-r border-slate-100 text-center"><input type="number" min="0" bind:value={shiftMatrix[shift.id][role.id]} on:input={handleMatrixChange} class="w-full h-8 text-center font-bold outline-none rounded focus:bg-indigo-50 hover:bg-white text-slate-700 bg-transparent transition-all"></td>
                                            {/each}
                                            <td class="p-3 text-center font-black text-slate-700 bg-slate-50 border-l border-slate-100">{getRoleTotal(role.id, shiftMatrix)}</td>
                                        </tr>
                                    {/each}
                                </tbody>
                                <tfoot class="bg-slate-800 text-slate-300 font-bold">
                                    <tr>
                                        <td class="p-3 text-right text-xs uppercase tracking-wider">Tổng</td>
                                         {#each shiftCols as shift}
                                            <td class="p-3 text-center text-yellow-400 font-mono text-sm font-bold">{getShiftTotal(shift.id, shiftMatrix)}</td>
                                         {/each}
                                         <td class="p-3 text-center text-white text-sm font-bold bg-slate-900">{getGrandTotal(shiftMatrix)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div class="p-4 border-t bg-white">
                            <button id="btn-calculate" class="w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow hover:bg-green-700 flex justify-center items-center gap-2" on:click={() => handleCalculateCombos(true)}><span class="material-icons-round">calculate</span> TÍNH TOÁN & QUY ĐỔI RA COMBO</button>
                        </div>
                    </div>
                    
                    <div id="combo-table" class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[480px]">
                        <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                             <div><h3 class="font-bold text-slate-800 text-lg">Combo Gợi Ý</h3><p class="text-xs text-slate-400">Kết quả tính toán</p></div>
                        </div>
                        <div class="flex-1 overflow-auto p-4">
                             <table class="w-full text-sm border-separate border-spacing-0 rounded-xl overflow-hidden border border-slate-200">
                                <thead class="bg-slate-50 text-slate-500"><tr><th class="p-3 text-left font-bold border-b border-r border-slate-200">Bộ Phận</th>{#each comboCols as code}<th class="p-2 text-center border-b border-slate-200 border-l border-white min-w-[60px]"><div class="font-black text-slate-700">{code}</div></th>{/each}</tr></thead>
                                <tbody>
                                    {#each roleRows as role}
                                        <tr class="group hover:bg-slate-50/50 transition-colors">
                                            <td class="p-3 font-bold border-r border-slate-100 {role.color} border-l-4">{role.label}</td>
                                            {#each comboCols as code}
                                                <td class="p-1 border-r border-slate-100 text-center"><input type="number" min="0" value={getComboQty(role.label, code, suggestedCombos)} on:change={(e) => updateComboQty(role.label, code, e.target.value)} class="w-full h-8 text-center font-bold outline-none rounded focus:bg-indigo-50 hover:bg-white text-indigo-600 bg-transparent transition-all"></td>
                                            {/each}
                                        </tr>
                                    {/each}
                                </tbody>
                                <tfoot class="bg-slate-800 text-slate-300 font-bold">
                                    <tr>
                                        <td class="p-3 text-right text-xs uppercase tracking-wider">Tổng</td>
                                        {#each comboCols as code}
                                            <td class="p-3 text-center text-white text-sm font-bold bg-slate-900 border-l border-slate-700">
                                                {comboTotalsMap[code] || 0}
                                            </td>
                                        {/each}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div class="p-4 bg-white border-t border-slate-100 flex gap-3">
                             <button id="btn-preview" disabled={totalCombos===0} class="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" on:click={handleGeneratePreview}><span class="material-icons-round">calendar_view_month</span><span>XEM TRƯỚC LỊCH</span></button>
                        </div>
                    </div>
                </div>

                <div id="preview-schedule-container" class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-fadeIn scroll-mt-20">
                    <div class="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center bg-slate-50/50 gap-4">
                        <div><h3 class="font-bold text-slate-800 text-lg">Xem Trước & Tối Ưu Lịch</h3><p class="text-xs text-slate-400">Kiểm tra kỹ trước khi Áp dụng</p></div>
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
                        <div class="flex-1 overflow-x-auto p-4 max-h-[600px]"> <table class="w-full text-xs text-center border-collapse min-w-[1000px]"> <thead class="sticky top-0 z-[60]"> <tr> <th class="p-2 border font-bold bg-white sticky left-0 z-[70] shadow-r">Nhân sự</th> {#each Object.keys(previewScheduleData).sort((a,b)=>Number(a)-Number(b)) as d} <th class="p-1 border min-w-[30px] {['T7','CN'].includes(getWeekday(d))?'bg-amber-200':'bg-slate-100'} z-[60]">{d}<br><span class="text-[9px] font-normal">{getWeekday(d)}</span></th> {/each} <th class="p-2 border w-10 bg-slate-100 z-[60]">GH</th> <th class="p-2 border w-10 bg-slate-100 z-[60]">TN</th> <th class="p-2 border w-10 bg-slate-100 z-[60]">K</th> </tr> </thead> <tbody> {#each previewStats as staff} <tr> <td class="p-2 border font-bold text-left sticky left-0 bg-white z-[50] shadow-r {staff.gender==='Nam'?'text-blue-700':'text-pink-600'}">{staff.name}</td> {#each Object.keys(previewScheduleData).sort((a,b)=>Number(a)-Number(b)) as d} {@const assign = previewScheduleData[d].find(x => x.staffId === staff.id)} <td class="p-1 border {assign?.isChanged ? 'bg-yellow-100' : ''} {['T7','CN'].includes(getWeekday(d))?'bg-amber-50':''}"> {#if assign && assign.shift !== 'OFF'} <div class="font-bold text-[9px]">{assign.shift}</div> {#if assign.role && assign.role !== 'TV'}<div class="text-[8px] text-white rounded px-1 {assign.role==='Giao Hàng'?'bg-blue-600':(assign.role==='Thu Ngân'?'bg-purple-600':'bg-orange-500')}">{assign.role==='Giao Hàng'?'GH':(assign.role==='Thu Ngân'?'TN':'K')}</div>{/if} {/if} </td> {/each} <td class="p-2 border font-bold text-blue-600">{staff.gh||'-'}</td> <td class="p-2 border font-bold text-purple-600">{staff.tn||0}</td> <td class="p-2 border font-bold text-orange-600">{staff.kho||0}</td> </tr> {/each} </tbody> </table> </div>
                    {/if}
                </div>
            </div>
        {/if}
        
        {#if activeSection === 'template'}
             <div class="flex flex-col lg:flex-row gap-6 h-full">
                 <div class="w-full lg:w-[35%] bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-fit">
                    <h4 class="font-bold text-slate-700 mb-4 flex items-center gap-2 text-lg border-b pb-2"><span class="material-icons-round text-orange-500 bg-orange-50 p-1 rounded-lg">edit_note</span> {editingTemplateIndex >= 0 ? 'Chỉnh Sửa' : 'Thêm Mới'}</h4>
                    <div id="template-form" class="space-y-4">
                        <div id="dept-select-container"><label for="dept-select" class="text-xs font-bold text-slate-500 uppercase">Bộ phận áp dụng</label><select id="dept-select" bind:value={activeTemplateType} class="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"><option value="warehouse">Kho</option><option value="cashier">Thu Ngân</option><option value="handover">Bàn Giao</option></select></div>
                        <div class="flex gap-3">
                            <div class="w-24"><label for="time-input" class="text-xs font-bold text-slate-500 uppercase">Giờ</label><input id="time-input" type="time" bind:value={newTemplateTime} class="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"></div>
                            <div class="flex-1"><label for="title-input" class="text-xs font-bold text-slate-500 uppercase">Tên công việc</label><input id="title-input" type="text" bind:value={newTemplateTitle} class="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100" placeholder="VD: Kiểm quỹ..."></div>
                        </div>
                        <div id="weekdays-container"><label class="text-xs font-bold text-slate-500 uppercase mb-2 block">Lặp lại</label><div class="flex gap-1 flex-wrap">{#each weekDays as d}<button class="w-8 h-8 rounded-lg text-xs font-bold border transition-all {selectedDays.includes(d.val)?'bg-indigo-600 text-white border-indigo-600 shadow-md':'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}" on:click={() => toggleDay(d.val)}>{d.label}</button>{/each}</div></div>
                        <label class="flex items-center gap-3 p-3 rounded-lg border border-red-100 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors mt-1"><input type="checkbox" bind:checked={newTemplateImportant} class="w-5 h-5 accent-red-600 rounded"><span class="text-sm font-bold text-red-700">Đánh dấu Quan Trọng</span></label>
                        <div class="flex gap-2 pt-2 border-t">{#if editingTemplateIndex >= 0}<button class="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200" on:click={()=>{editingTemplateIndex=-1;newTemplateTitle=''}}>Hủy</button>{/if}<button id="btn-save-template" class="flex-[2] py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all" on:click={saveTemplate}>{editingTemplateIndex >= 0?'Lưu':'Thêm Vào List'}</button></div>
                    </div>
                 </div>
                 <div class="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-full">
                    <div class="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0"><span class="font-bold text-slate-700">Danh sách công việc ({$taskTemplate[activeTemplateType]?.length || 0})</span></div>
                    <div class="flex-1 overflow-y-auto p-3 space-y-2">
                        {#each ($taskTemplate[activeTemplateType] || []) as item, i}
                            <div class="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all group relative">
                                <div class="font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm">{item.time}</div>
                                <div class="flex-1"><div class="font-bold text-slate-800 text-base mb-1 {item.isImportant?'text-red-600':''}">{item.isImportant ? '★ ' : ''}{item.title}</div><div class="flex gap-1 flex-wrap">{#if !item.days || item.days.length===7}<span class="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Hàng ngày</span>{:else}{#each weekDays as d}{#if item.days.includes(d.val)}<span class="text-[10px] font-bold border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded">{d.label}</span>{/if}{/each}{/if}</div></div>
                                <div class="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2"><button class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center" on:click={()=>editTemplate(i, item)}><span class="material-icons-round text-sm">edit</span></button><button class="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center" on:click={()=>deleteTemplate(i)}><span class="material-icons-round text-sm">delete</span></button></div>
                            </div>
                        {/each}
                    </div>
                 </div>
            </div>
        {/if}

        {#if activeSection === 'accounts'}
            <div class="flex flex-col lg:flex-row gap-6 w-full max-w-5xl mx-auto animate-fadeIn">
                {#if isSuperAdmin}
                    <div id="super-admin-area" class="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 class="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                            <span class="material-icons-round text-purple-500 bg-purple-50 p-1.5 rounded-lg">admin_panel_settings</span> 
                            Tạo Quản Lý Mới
                        </h3>
                        <div class="space-y-4">
                            <div><label for="new-admin-user" class="text-xs font-bold text-slate-500 uppercase">Tên đăng nhập</label><input id="new-admin-user" type="text" bind:value={newAdminUser} class="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-200 font-bold" placeholder="VD: quanly1"></div>
                            <div class="grid grid-cols-2 gap-4">
                                <div><label for="new-admin-pass" class="text-xs font-bold text-slate-500 uppercase">Mật khẩu</label><input id="new-admin-pass" type="text" bind:value={newAdminPass} class="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-200" placeholder="******"></div>
                                <div><label for="new-admin-store" class="text-xs font-bold text-slate-500 uppercase">Mã Kho Quản Lý</label><input id="new-admin-store" type="text" bind:value={newAdminStore} class="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-200 font-bold" placeholder="VD: 908"></div>
                            </div>
                            <button id="btn-create-admin" class="w-full py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700 transition-all mt-2" on:click={handleCreateAdmin}>Tạo Tài Khoản Admin</button>
                        </div>
                    </div>
                {/if}

                <div class="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <span class="material-icons-round text-blue-500 bg-blue-50 p-1.5 rounded-lg">groups</span> 
                            Cấp Quyền Nhân Viên
                        </h3>
                        <div class="flex gap-2">
                            <button id="btn-add-single" class="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 flex items-center gap-1 transition-colors" on:click={() => checkDemoAndBlock() || (showAddUserModal = true)}>
                                <span class="material-icons-round text-sm">add</span> Thêm 1 NV
                            </button>
                            <button id="btn-download-account-sample" class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1 transition-colors" on:click={checkDemoAndBlock(event) || downloadAccountSample()}>Tải Mẫu</button>
                            <label id="btn-upload-accounts" class="text-xs font-bold text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1 transition-colors cursor-pointer shadow {isDemoMode ? 'opacity-50' : ''}" on:click={(e) => checkDemoAndBlock(e)}>
                                <span class="material-icons-round text-sm">upload</span> Upload
                                <input type="file" hidden accept=".xlsx" disabled={isDemoMode} on:change={handleAccountUpload}>
                            </label>
                        </div>
                    </div>
                    
                    <div id="account-table" class="flex-1 overflow-auto border border-slate-200 rounded-xl">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-slate-50 text-slate-500 font-bold">
                                <tr>
                                    <th class="p-3">User</th>
                                    <th class="p-3">Quyền</th>
                                    <th class="p-3 text-center">Xóa/Reset</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                {#each accountList as acc}
                                    <tr class="hover:bg-slate-50">
                                        <td class="p-3 font-bold text-slate-700">{acc.username}</td>
                                        <td class="p-3">
                                            <select class="bg-transparent text-xs font-bold {acc.role==='admin'?'text-purple-600':'text-gray-500'} outline-none cursor-pointer" value={acc.role} on:change={(e) => changeRole(acc.id, e.target.value)}>
                                                <option value="staff">Nhân viên</option>
                                                <option value="admin">Quản lý</option>
                                            </select>
                                        </td>
                                        <td class="p-3 text-center flex justify-center gap-2">
                                            <button class="w-7 h-7 flex items-center justify-center rounded bg-yellow-100 text-yellow-600 hover:bg-yellow-200 transition-colors" on:click={() => resetPassword(acc.id)} title="Reset Mật khẩu về 123456">
                                                <span class="material-icons-round text-sm">key</span>
                                            </button>
                                            <button class="w-7 h-7 flex items-center justify-center rounded bg-red-100 text-red-500 hover:bg-red-200 transition-colors" on:click={() => deleteAccount(acc.id)} title="Xóa tài khoản">
                                                <span class="material-icons-round text-sm">delete</span>
                                            </button>
                                        </td>
                                    </tr>
                                {/each}
                                {#if accountList.length === 0}
                                    <tr><td colspan="3" class="p-4 text-center text-gray-400 text-xs">Chưa có tài khoản nào thuộc kho {targetStore}.</td></tr>
                                {/if}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        {/if}
    </div>
    {#if isLoading}<div class="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-[60]"><div class="animate-bounce font-bold text-indigo-900 text-lg">Đang xử lý dữ liệu...</div></div>{/if}
</div>

{#if showAddUserModal}
<div class="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => showAddUserModal = false}>
    <div class="bg-white w-full max-w-sm rounded-xl p-5 shadow-2xl" on:click|stopPropagation>
        <h3 class="font-bold text-lg text-slate-800 mb-4">Thêm Nhân Sự Mới</h3>
        <div class="space-y-3">
            <div class="flex gap-3">
                <div class="flex-1">
                    <label class="text-xs font-bold text-slate-500 uppercase">Giới tính</label>
                    <select bind:value={singleGender} class="w-full mt-1 p-2 border rounded-lg bg-white">
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                    </select>
                </div>
                <div class="flex-1">
                    <label class="text-xs font-bold text-slate-500 uppercase">Quyền hạn</label>
                    <select bind:value={singleRole} class="w-full mt-1 p-2 border rounded-lg bg-white">
                        <option value="staff">Nhân viên</option>
                        <option value="admin">Quản lý</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="text-xs font-bold text-slate-500 uppercase">Tên đăng nhập</label>
                <input type="text" bind:value={singleUsername} class="w-full mt-1 p-2 border rounded-lg font-bold" placeholder="VD: nv_moi">
            </div>
            <div>
                <label class="text-xs font-bold text-slate-500 uppercase">Mật khẩu</label>
                <input type="text" bind:value={singlePass} class="w-full mt-1 p-2 border rounded-lg text-gray-500" placeholder="123456">
            </div>
            <div class="flex gap-2 pt-2">
                <button class="flex-1 py-2 bg-gray-100 rounded-lg text-gray-600 font-bold text-sm" on:click={() => showAddUserModal = false}>Hủy</button>
                <button class="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold text-sm shadow hover:bg-green-700" on:click={handleCreateSingleUser}>Lưu</button>
            </div>
        </div>
    </div>
</div>
{/if}

{#if showTour} <TourGuide steps={currentSteps} on:complete={() => showTour = false} /> {/if}
<style>.animate-fadeIn { animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); } @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }</style>