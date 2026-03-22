<script>
  import { onMount, onDestroy } from 'svelte';
  import { db } from '../lib/firebase';
  import { doc, onSnapshot, updateDoc, getDoc, setDoc } from 'firebase/firestore';
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
  
  $: myStores = $currentUser?.storeIds || [];
  $: isAdmin = $currentUser?.role === 'admin' || $currentUser?.role === 'super_admin';
  let unsubscribe = () => {};
  
  $: if (activeTab === 'schedule' && $activeStoreId && currentMonthStr && currentMode === 'NV') { 
      loadSchedule(currentMonthStr, $activeStoreId);
  }

  // [NEW] Logic Smart Cover: Tạo mảng gợi ý trám ca khi có người OFF
  let smartCoverSuggestions = [];
  $: if (editingShift && editingShift.isOFF && scheduleData && isAdmin) {
      smartCoverSuggestions = buildSmartCover(editingShift);
  } else {
      smartCoverSuggestions = [];
  }

  function buildSmartCover(target) {
      let dayAssigns = scheduleData.data[target.day].filter(a => a.staffId !== target.staffId && a.shift !== 'OFF');
      let stats = scheduleData.stats;

      // Ưu tiên: Sort theo tổng giờ làm hiện tại tăng dần (Ai đói ca xếp trước)
      dayAssigns.sort((a, b) => {
          let hA = stats.find(s => s.id === a.staffId)?.totalHours || 0;
          let hB = stats.find(s => s.id === b.staffId)?.totalHours || 0;
          return hA - hB;
      });

      let suggestions = [];
      let offShift = target.originalShift; 
      if (offShift === 'OFF') return []; 

      const addSugg = (type, title, acts) => suggestions.push({ type, title, actions: acts });

      if (offShift === '123') {
          // Priority 1: Dây chuyền (23 -> 123, 45 -> 2345)
          let bList = dayAssigns.filter(a => a.shift === '23');
          let cList = dayAssigns.filter(a => ['45', '456'].includes(a.shift));
          bList.forEach(b => {
              cList.forEach(c => {
                  if (b.staffId !== c.staffId) {
                      addSugg('chain', `Đẩy ca 1 cho ${b.name}, ghép ${c.shift} cho ${c.name}`, [
                          { staffId: b.staffId, name: b.name, oldShift: b.shift, newShift: '123', role: target.originalRole },
                          { staffId: c.staffId, name: c.name, oldShift: c.shift, newShift: c.shift === '45' ? '2345' : '23456', role: b.role }
                      ]);
                  }
              });
          });
          // Priority 2: Trực tiếp (45 -> 12345)
          let dList = dayAssigns.filter(a => ['45', '456'].includes(a.shift));
          dList.forEach(d => {
              addSugg('direct', `Ghép thẳng 123 cho ${d.name}`, [
                  { staffId: d.staffId, name: d.name, oldShift: d.shift, newShift: d.shift === '45' ? '12345' : '123456', role: target.originalRole }
              ]);
          });
      }
      else if (offShift === '456') {
          // Priority 1: Dây chuyền (45 -> 456, 23 -> 2345)
          let bList = dayAssigns.filter(a => a.shift === '45');
          let cList = dayAssigns.filter(a => ['23', '123'].includes(a.shift));
          bList.forEach(b => {
              cList.forEach(c => {
                  if (b.staffId !== c.staffId) {
                      addSugg('chain', `Đẩy ca 6 cho ${b.name}, ghép ${c.shift} cho ${c.name}`, [
                          { staffId: b.staffId, name: b.name, oldShift: b.shift, newShift: '456', role: target.originalRole },
                          { staffId: c.staffId, name: c.name, oldShift: c.shift, newShift: c.shift === '23' ? '2345' : '12345', role: b.role }
                      ]);
                  }
              });
          });
          // Priority 2: Trực tiếp (23 -> 23456)
          let dList = dayAssigns.filter(a => ['23', '123'].includes(a.shift));
          dList.forEach(d => {
              addSugg('direct', `Ghép thẳng 456 cho ${d.name}`, [
                  { staffId: d.staffId, name: d.name, oldShift: d.shift, newShift: d.shift === '23' ? '23456' : '123456', role: target.originalRole }
              ]);
          });
      }
      else if (offShift === '23') {
          let dList = dayAssigns.filter(a => ['45', '456'].includes(a.shift));
          dList.forEach(d => addSugg('direct', `Ghép ca 23 cho ${d.name}`, [{ staffId: d.staffId, name: d.name, oldShift: d.shift, newShift: d.shift === '45' ? '2345' : '23456', role: target.originalRole }]));
      }
      else if (offShift === '45') {
          let dList = dayAssigns.filter(a => ['23', '123'].includes(a.shift));
          dList.forEach(d => addSugg('direct', `Ghép ca 45 cho ${d.name}`, [{ staffId: d.staffId, name: d.name, oldShift: d.shift, newShift: d.shift === '23' ? '2345' : '12345', role: target.originalRole }]));
      }
      return suggestions.slice(0, 5); // Hiển thị 5 option tốt nhất
  }

  // [NEW] Hàm thực thi ghi đè khi Admin chọn một phương án Trám Ca
  async function executeSmartCover(actions) {
      if (!editingShift || !scheduleData) return;
      if (!confirm("Xác nhận ÁP DỤNG phương án Trám Ca Thông Minh này?")) return;

      const dayKey = String(editingShift.day);
      const dayList = [...scheduleData.data[dayKey]];
      const newStats = [...scheduleData.stats];

      // 1. Chuyển người hiện tại thành OFF
      const tIdx = dayList.findIndex(x => x.staffId === editingShift.staffId);
      if (tIdx > -1) {
          const oldRole = dayList[tIdx].role;
          dayList[tIdx] = { ...dayList[tIdx], shift: 'OFF', role: '' };

          let rOld = ['GH', 'Giao Hàng'].includes(oldRole) ? 'gh' : (['TN', 'Thu Ngân'].includes(oldRole) ? 'tn' : (['K', 'Kho'].includes(oldRole) ? 'kho' : ''));
          const sIdx = newStats.findIndex(s => s.id === editingShift.staffId);
          if (rOld && sIdx > -1) newStats[sIdx][rOld] = Math.max(0, (newStats[sIdx][rOld]||0) - 1);
      }

      // 2. Chuyển những người trám ca sang ca mới
      actions.forEach(act => {
          const idx = dayList.findIndex(x => x.staffId === act.staffId);
          if (idx > -1) {
              const oldRole = dayList[idx].role;
              dayList[idx] = { ...dayList[idx], shift: act.newShift, role: act.role };

              let rOld = ['GH', 'Giao Hàng'].includes(oldRole) ? 'gh' : (['TN', 'Thu Ngân'].includes(oldRole) ? 'tn' : (['K', 'Kho'].includes(oldRole) ? 'kho' : ''));
              let rNew = ['GH', 'Giao Hàng'].includes(act.role) ? 'gh' : (['TN', 'Thu Ngân'].includes(act.role) ? 'tn' : (['K', 'Kho'].includes(act.role) ? 'kho' : ''));

              const sIdx = newStats.findIndex(s => s.id === act.staffId);
              if (sIdx > -1) {
                  if (rOld && rOld !== rNew) newStats[sIdx][rOld] = Math.max(0, (newStats[sIdx][rOld]||0) - 1);
                  if (rNew && rOld !== rNew) newStats[sIdx][rNew] = (newStats[sIdx][rNew]||0) + 1;
              }
          }
      });

      // 3. Đồng bộ lên Cloud
      try {
          await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), {
              [`data.${dayKey}`]: dayList,
              stats: newStats
          });
          editingShift = null; // Đóng modal
          alert("✅ Đã Trám ca tự động và lưu lịch thành công!");
      } catch (e) { alert("Lỗi hệ thống: " + e.message); }
  }

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
      } catch (e) { loading = false; errorMsg = e.message;
      }
  }

  async function handleRestoreBackup() {
      if (!isAdmin) return;
      if (!confirm(`⚠️ CẢNH BÁO: Bạn muốn khôi phục lại phiên bản lịch CŨ của tháng ${viewMonth}/${viewYear}?\n\nDữ liệu hiện tại sẽ bị ghi đè!`)) return;
      loading = true;
      try {
          const backupRef = doc(db, 'stores', $activeStoreId, 'schedules', `${currentMonthStr}_backup`);
          const backupSnap = await getDoc(backupRef);
          if (!backupSnap.exists()) { alert("❌ Không tìm thấy bản sao lưu nào."); loading = false; return;
          }
          const mainRef = doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr);
          await setDoc(mainRef, backupSnap.data());
          alert("✅ Đã khôi phục thành công!");
      } catch (e) { alert("Lỗi: " + e.message);
      } finally { loading = false; }
  }

  async function handleLockBaseline() {
      if (!isAdmin || !scheduleData) return;
      if (!confirm(`🔒 CHỐT LỊCH GỐC THÁNG ${viewMonth}/${viewYear}?\n\nHệ thống sẽ lưu toàn bộ kết quả sau khi bạn đã chỉnh sửa xong làm LỊCH GỐC (Baseline) để tính toán Lũy kế cho các tháng sau.\n\nBạn có chắc chắn?`)) return;
      try {
          const ref = doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr);
          await updateDoc(ref, { baselineStats: scheduleData.stats });
          alert("✅ Đã CHỐT Lịch Gốc thành công! Lũy kế các tháng sau sẽ dựa trên bản này.");
      } catch (e) {
          alert("Lỗi: " + e.message);
      }
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
      const stat = scheduleData.stats.find(s => s.id === staffId) ||
      { totalHours:0, gh:0, tn:0, kho:0 }; 
      selectedStaff = { id: staffId, name: staffName, days, blankCells, stats: stat };
  }
  
  function openEditShift(day, staffId, assign) { 
      if (!isAdmin) return;
      const staffInfo = scheduleData.stats.find(s => s.id === staffId);
      tempEditingShift = { 
          day, staffId, name: assign.name, shift: assign.shift, role: assign.role ||
          'TV', 
          isOFF: assign.shift === 'OFF', gender: staffInfo ?
          staffInfo.gender : 'Nữ', 
          originalRole: assign.originalRole !== undefined ?
          assign.originalRole : (assign.role || 'TV'), 
          originalShift: assign.originalShift !== undefined ?
          assign.originalShift : assign.shift 
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
          
          if (editingShift.role === 'GH' || editingShift.role === 'Giao Hàng') targetRoleCode = 'GH';
          else if (editingShift.role === 'Thu Ngân' || editingShift.role === 'TN') targetRoleCode = 'TN';
          else if (editingShift.role === 'Kho' || editingShift.role === 'K') targetRoleCode = 'Kho';
          const comboConfig = approvedCombos.find(c => { 
              let cRole = c.role || 'TV'; if (cRole === 'Thu Ngân' || cRole === 'TN') cRole = 'TN'; 
              return c.code === editingShift.shift && cRole === targetRoleCode; 
          });
          const quota = comboConfig ? (parseInt(comboConfig.qty) || 0) : 0;
          const currentCount = currentDayAssignments.filter(a => { 
              if (a.staffId === editingShift.staffId) return false; 
              let r = a.role || 'TV'; 
              if (r === 'Giao Hàng' || r === 'GH') r = 'GH'; 
              if (r === 'Thu Ngân' || r === 'TN') r = 'TN'; 
              if (r === 'Kho' || r === 'K') r = 'Kho'; 
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
          const oldRole = dayList[idx].role ||
          'TV';
          const newRole = editingShift.isOFF ? '' : (editingShift.role === 'TV' ? '' : editingShift.role);
          const updatedAssignment = { ...dayList[idx], shift: editingShift.isOFF ? 'OFF' : editingShift.shift, role: newRole }; 
          dayList[idx] = updatedAssignment;
          const newStats = [...scheduleData.stats]; 
          const statIdx = newStats.findIndex(s => s.id === editingShift.staffId);
          if (statIdx !== -1) { 
              const s = newStats[statIdx];
              let rOld = (oldRole === 'Giao Hàng' || oldRole === 'GH') ?
              'gh' : ((oldRole === 'Thu Ngân' || oldRole === 'TN') ? 'tn' : ((oldRole === 'Kho' || oldRole === 'K') ? 'kho' : ''));
              if(rOld) s[rOld] = Math.max(0, (s[rOld]||0) - 1); 
              
              let rNew = (newRole === 'Giao Hàng' || newRole === 'GH') ?
              'gh' : ((newRole === 'Thu Ngân' || newRole === 'TN') ? 'tn' : ((newRole === 'Kho' || newRole === 'K') ? 'kho' : ''));
              if(rNew) s[rNew] = (s[rNew]||0) + 1; 
          } 
          try { 
              await updateDoc(doc(db, 'stores', $activeStoreId, 'schedules', currentMonthStr), { [`data.${dayKey}`]: dayList, stats: newStats });
              editingShift = null; 
          } catch (e) { alert("Lỗi: " + e.message);
          } 
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
      
      const targetRoles = ['Kho', 'Thu Ngân', 'GH'];
      const details = { 'Kho': {}, 'Thu Ngân': {}, 'GH': {} };
      
      const shiftDetails = {};
      dayData.forEach(assign => { 
          let rawRole = assign.role || 'TV';
          let r = rawRole;
          if (r === 'TN' || r === 'Thu Ngân') r = 'Thu Ngân'; 
          if (r === 'K' || r === 'Kho') r = 'Kho'; 
          if (r === 'Giao Hàng' || r === 'GH') r = 'GH';

          let s = assign.shift || 'OFF';
          if (!shiftDetails[s]) shiftDetails[s] = [];
          shiftDetails[s].push({ name: assign.name, role: r });

          if (s !== 'OFF') {
              if (matrix[r]) { 
                  matrix[r][s] = (matrix[r][s] || 0) + 1; 
                  matrix[r]['Total']++; 
              } 
              if (targetRoles.includes(r)) {
                  if (!details[r][s]) details[r][s] = [];
                  details[r][s].push(assign.name);
              }
          }
      });
      const customShiftOrder = ['123', '23', '45', '456', '2345', '2-5'];
      const sortedShiftArray = Object.keys(shiftDetails).sort((a, b) => {
          if (a === 'OFF') return 1;
          if (b === 'OFF') return -1;
          const idxA = customShiftOrder.indexOf(a);
          const idxB = customShiftOrder.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
      }).map(key => ({
          shift: key,
          people: shiftDetails[key]
      }));
      selectedDayStats = { 
          day, weekday: getWeekday(day), 
          cols, matrix, roles, details, 
          shiftDetails: sortedShiftArray 
      };
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

  function handleExportExcel() {
      exportScheduleToExcel({ scheduleData, viewMonth, viewYear, selectedViewStore: $activeStoreId, getWeekday, getWeekendHardRoleCount });
  }

  function scrollToMyRow() {
      if (!$currentUser || !scheduleData || !scheduleData.stats) return;
      const normalizeStr = (str) => {
          if (!str) return '';
          return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      };
      const cUsername = normalizeStr($currentUser.username);
      const cName = normalizeStr($currentUser.name);
      const cId = normalizeStr($currentUser.id);
      const myStat = scheduleData.stats.find(s => {
          const sId = normalizeStr(s.id);
          const sName = normalizeStr(s.name);
          const sUsername = normalizeStr(s.username);
          if (sId && (sId === cId || sId === cUsername)) return true;
          if (sUsername && sUsername === cUsername) return true;
          if (sName && cName && (sName.includes(cName) || cName.includes(sName))) 
          return true;
          if (sName && cUsername && (sName.includes(cUsername) || cUsername.includes(sName))) return true;
          return false;
      });
      if (myStat) {
          const row = document.getElementById('staff-row-' + myStat.id);
          if (row) {
              row.scrollIntoView({ behavior: 'smooth', block: 'center' });
              const td = row.firstElementChild;
              if (td) {
                  td.classList.add('!bg-yellow-200', 'transition-colors', 'duration-500');
                  setTimeout(() => { td.classList.remove('!bg-yellow-200'); }, 2000);
              }
          } else {
              alert("Đã tìm thấy dữ liệu của bạn, nhưng giao diện chưa kịp hiển thị. Vui lòng thử lại!");
          }
      } else {
          alert(`Không tìm thấy "${$currentUser.name || $currentUser.username}" trong danh sách Lịch làm việc tháng này! Vui lòng báo Quản lý kiểm tra lại.`);
      }
  }
  
  let showScheduleTour = false;
  const scheduleSteps = [ 
      { target: '.overflow-x-auto', title: '1. Bảng Lịch Tổng', content: 'Đây là toàn bộ lịch làm việc trong tháng.' }, 
      { target: '#store-view-selector', title: '2. Chọn Kho Xem', content: 'Nếu quản lý nhiều kho, hãy chọn kho tại đây để xem lịch tương ứng.' }, 
      { target: '#tour-staff-name', title: '3. Xem Chi Tiết Cá Nhân', content: 'Bấm vào <b>Tên Nhân Viên</b> để mở popup xem lịch riêng.' }, 
      { target: '#tour-total-col', title: '4. Cột Tổng Kết', content: 'Kéo về cuối bảng để xem tổng giờ công.', action: () => { const tableContainer = document.querySelector('.overflow-x-auto');
      if(tableContainer) tableContainer.scrollLeft = tableContainer.scrollWidth; } } 
  ];

  onDestroy(() => {
      if (unsubscribe) unsubscribe();
  });
</script>

<ScheduleControls 
    bind:currentMode={currentMode}
    {myStores} {scheduleData} {isAdmin}
    bind:selectedViewStore={$activeStoreId} bind:viewMonth bind:viewYear bind:showPastDays
    on:locate={scrollToMyRow}
    on:openHistory={() => showHistoryModal = true}
    on:restoreBackup={handleRestoreBackup}
    on:lockBaseline={handleLockBaseline} on:exportExcel={handleExportExcel}
    on:startTour={() => showScheduleTour = true}
/>

{#if currentMode === 'NV'}
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
{:else if currentMode === 'PG'}
    <PGScheduleTable selectedViewStore={$activeStoreId} {isAdmin} />
{:else if currentMode === 'RS'}
    <RoadshowPanel selectedViewStore={$activeStoreId} {isAdmin} />
{/if}

{#if showHistoryModal && scheduleData}
    <CumulativeHistoryModal storeId={$activeStoreId} currentMonth={viewMonth} currentYear={viewYear} currentStats={scheduleData.stats} on:close={() => showHistoryModal = false} />
{/if}

{#if selectedStaff}
    <PersonalScheduleModal {selectedStaff} {getRoleBadge} on:close={() => selectedStaff = null} />
{/if}

{#if editingShift}
    <EditShiftModal 
        bind:editingShift 
        {tempEditingShift} 
        suggestions={smartCoverSuggestions}
        on:close={() => editingShift = null} 
        on:save={saveShiftChange} 
        on:applySmartCover={(e) => executeSmartCover(e.detail)}
    />
{/if}

{#if selectedDayStats}
    <DayStatsModal {selectedDayStats} on:close={() => selectedDayStats = null} />
{/if}

{#if showScheduleTour}
    <TourGuide steps={scheduleSteps} on:complete={() => showScheduleTour = false} />
{/if}