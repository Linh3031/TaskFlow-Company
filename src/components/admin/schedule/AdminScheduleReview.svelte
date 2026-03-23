<script>
    import { createEventDispatcher, tick } from 'svelte';
    import { db } from '../../../lib/firebase';
    import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
    import { currentUser } from '../../../lib/stores';
    import { generateMonthlySchedule } from '../../../lib/scheduleLogic';
    import { optimizeSchedule, autoFixRotation, autoFixWeekendFairness, autoFixGenderBalance, manualBalanceGender, autoFixFatigue } from '../../../lib/optimization';
    
    import SchedulePreview from './SchedulePreview.svelte';
    import AdminEditShiftModal from './AdminEditShiftModal.svelte';
    import AdminPersonalScheduleModal from './AdminPersonalScheduleModal.svelte';
    import AdminDayStatsModal from './AdminDayStatsModal.svelte';
    import SmartSwapModal from './SmartSwapModal.svelte'; 
    import { INSPECTION_OPTIONS, getShiftColor, getRoleBadge, isHardRole } from './scheduleConstants.js';

    const dispatch = createEventDispatcher();

    export let targetStore;
    export let isLoading;
    export let scheduleStaffList;
    export let staffStats;
    export let scheduleMonth;
    export let scheduleYear;
    export let suggestedCombos;
    export let suggestedWeekendCombos;
    export let genderConfig;
    export let customComboCols;
    export let shiftMatrix;
    export let weekendMatrix;
    export let activeMatrixMode;
    export let triggerPreview = 0;
    export let manualPreviewPayload = null; // [NEW] Nhận Payload từ Excel

    let previewScheduleData = null;
    let previewStats = [];
    let originalResult = null;
    let optimizationLogs = [];
    let inspectionMode = 'none';
    
    let pureSystemStats = []; 
    let pastThreeMonthsData = [];
    let ignoreHistory = false;
    let editingShift = null; 
    let tempEditingShift = null;
    let selectedStaff = null;
    let selectedDayStats = null;
    let showSmartSwap = false;

    $: activeSuggestedCombos = activeMatrixMode === 'weekday' ? suggestedCombos : suggestedWeekendCombos;
    $: totalCombos = activeSuggestedCombos.reduce((sum, c) => sum + (parseInt(c.qty)||0), 0);
    
    $: if (triggerPreview > 0) { handleGeneratePreview(); }
    $: if (targetStore) { handleResetPreview(); }

    // [NEW] Chặn ngang dòng thác dữ liệu để render dữ liệu Excel
    $: if (manualPreviewPayload) {
        previewScheduleData = manualPreviewPayload.schedule;
        previewStats = manualPreviewPayload.stats;
        pureSystemStats = JSON.parse(JSON.stringify(manualPreviewPayload.stats));
        // Lừa hệ thống để khi ấn Áp dụng vẫn giữ nguyên cấu trúc lưu trữ
        originalResult = { endOffset: 0 }; 
        optimizationLogs = ["📥 Đã tải lên dữ liệu phân ca thủ công từ file Excel thành công."];
        inspectionMode = 'none';
        
        setTimeout(() => { 
            const previewEl = document.getElementById('preview-schedule-container'); 
            if(previewEl) previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
        }, 100);
        
        manualPreviewPayload = null; // Reset lại để hứng lần upload tiếp theo
    }

    async function handleGeneratePreview() { 
        if (totalCombos > staffStats.total) { 
            alert(`⛔ KHÔNG THỂ TẠO LỊCH!\n\nNhu cầu đang cần ${totalCombos} vị trí, nhưng chỉ có ${staffStats.total} nhân viên.`);
            return; 
        } 
        if (suggestedCombos.length === 0 && suggestedWeekendCombos.length === 0) return alert("Chưa có combo nào!");
        isLoading = true;
        try { 
            pastThreeMonthsData = [];
            if (!ignoreHistory) {
                for (let i = 1; i <= 3; i++) {
                    let m = scheduleMonth - i;
                    let y = scheduleYear;
                    if (m <= 0) { m += 12; y -= 1; }
                    const snap = await getDoc(doc(db, 'stores', targetStore, 'schedules', `${y}-${String(m).padStart(2,'0')}`));
                    if (snap.exists()) {
                        const sData = snap.data();
                        pastThreeMonthsData.push({ month: m, year: y, stats: sData.baselineStats || sData.systemStats || sData.stats || [] });
                    }
                }
            }

            let prevMonth = scheduleMonth - 1, prevYear = scheduleYear;
            if(prevMonth === 0) { prevMonth = 12; prevYear--; } 
            let prevScheduleData = null;
            const prevSnap = await getDoc(doc(db, 'stores', targetStore, 'schedules', `${prevYear}-${String(prevMonth).padStart(2,'0')}`)); 
            if(prevSnap.exists()) prevScheduleData = prevSnap.data();
            const comboPayload = { weekday: suggestedCombos, weekend: suggestedWeekendCombos }; 
            const result = generateMonthlySchedule(scheduleStaffList, comboPayload, scheduleMonth, scheduleYear, prevScheduleData, genderConfig, pastThreeMonthsData);
            originalResult = JSON.parse(JSON.stringify(result)); 
            previewScheduleData = result.schedule; 
            previewStats = result.staffStats; 
            pureSystemStats = JSON.parse(JSON.stringify(result.staffStats));
            
            optimizationLogs = []; 
            await tick();
            setTimeout(() => { const previewEl = document.getElementById('preview-schedule-container'); if(previewEl) previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        } catch (e) { alert("Lỗi: " + e.message); } finally { isLoading = false; } 
    }

    function handleManualBalance(e) {
        const config = e.detail;
        if (!previewScheduleData) return;
        const params = { fromGender: config.direction === 'male_to_female' ? 'Nam' : 'Nữ', toGender: config.direction === 'male_to_female' ? 'Nữ' : 'Nam', role: config.role, qty: parseInt(config.qty) || 1 };
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
                previewStats = previewStats.map(s => { if (newRoleStats[s.id]) return { ...s, ...newRoleStats[s.id] }; return s; });
                alert(`✅ Đã đổi thành công ${result.count} ca!`);
            } else { alert("⚠️ Không tìm thấy ca nào phù hợp để đổi (hoặc đã vi phạm hết các điều kiện ưu tiên)."); }
            isLoading = false;
        }, 200);
    }

    function isWeekendDay(d) { const date = new Date(scheduleYear, scheduleMonth - 1, d); const dayOfWeek = date.getDay(); return (dayOfWeek === 0 || dayOfWeek === 6); }
    function getWeekday(day) { const date = new Date(scheduleYear, scheduleMonth - 1, day); return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]; }
    function getWeekendFairnessStatus(staffId) { 
        if (inspectionMode !== 'weekend' || !previewScheduleData) return 0;
        const allStats = previewStats.map(s => { let count = 0; Object.keys(previewScheduleData).forEach(d => { if (isWeekendDay(d)) { const assign = previewScheduleData[d].find(a => a.staffId === s.id); if (assign && isHardRole(assign.role)) count++; } }); return { id: s.id, count }; });
        const counts = allStats.map(x => x.count); const max = Math.max(...counts); const min = Math.min(...counts);
        const myStat = allStats.find(x => x.id === staffId); 
        if (!myStat) return 0; if (max - min <= 1) return 0;
        if (myStat.count === max) return 1; if (myStat.count === min) return -1; return 0;
    }
    function getWeekendHardRoleCount(staffId) { 
        if (!previewScheduleData) return 0;
        let count = 0;
        Object.keys(previewScheduleData).forEach(d => { if (isWeekendDay(d)) { const assign = previewScheduleData[d].find(a => a.staffId === staffId); if (assign && isHardRole(assign.role)) count++; } });
        return count; 
    }
    function checkInspectionError(d, assign, currentMode) { 
        const mode = currentMode || inspectionMode;
        if (mode === 'none') return false; if (!assign || assign.shift === 'OFF') return false;
        if (mode === 'gender') { 
            if (genderConfig.kho === 'none' && genderConfig.tn === 'none') return false;
            const dayAssignments = previewScheduleData[d] || []; 
            const sameShiftRole = dayAssignments.filter(a => a.shift === assign.shift && a.role === assign.role && a.shift !== 'OFF');
            if (assign.role === 'Kho') { 
                if (genderConfig.kho === 'male_only' && !assign.gender.toLowerCase().includes('nam')) return `Kho ca ${assign.shift} yêu cầu Nam`;
                if (genderConfig.kho === 'mixed') { const hasMale = sameShiftRole.some(a => a.gender === 'Nam');
                    if (!hasMale) return `Kho Kho ca ${assign.shift} thiếu Nam`; } 
            } 
            if (assign.role === 'Thu Ngân') { 
                if (genderConfig.tn === 'female_only' && assign.gender === 'Nam') return `TN ca ${assign.shift} yêu cầu Nữ`;
                if (genderConfig.tn === 'mixed') { const hasMale = sameShiftRole.some(a => a.gender === 'Nam');
                    const hasFemale = sameShiftRole.some(a => a.gender !== 'Nam'); if (!hasMale || !hasFemale) return `TN ca ${assign.shift} thiếu cặp đôi`;
                } 
            } 
            return false;
        } 
        if (mode === 'weekend') { 
            if (!isWeekendDay(d) || !isHardRole(assign.role)) return false;
            const rowStatus = getWeekendFairnessStatus(assign.staffId);
            if (rowStatus === 1) return "Dư ca nghiệp vụ cuối tuần"; 
            return false;
        } 
        if (mode === 'rotation') { 
            if (d == 1) return false;
            const prevAssign = previewScheduleData[d-1]?.find(a => a.staffId === assign.staffId);
            if (!prevAssign || prevAssign.shift === 'OFF') return false; 
            return false;
        } 
        if (mode === 'fatigue') { 
            if (d == 1) return false;
            const prevAssign = previewScheduleData[d-1]?.find(a => a.staffId === assign.staffId);
            if (!prevAssign || !prevAssign.role) return false;
            if (isHardRole(prevAssign.role) && isHardRole(assign.role)) { return `Làm nghiệp vụ liên tiếp 2 ngày`; } 
            return false;
        } 
        return false;
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
        setTimeout(() => { const result = autoFixRotation(previewScheduleData, scheduleMonth, scheduleYear); if (result.success) { previewScheduleData = result.schedule; optimizationLogs = [...optimizationLogs, ...result.logs]; alert(`✅ Đã sửa thành công ${result.count} lỗi!`); } else { alert("✅ Hệ thống đã tối ưu."); } isLoading = false; }, 300);
    }

    function handleAutoFixFatigue() {
        if (!previewScheduleData) return;
        isLoading = true;
        setTimeout(() => {
            const result = autoFixFatigue(previewScheduleData, scheduleMonth, scheduleYear);
            if (result.success) {
                previewScheduleData = result.schedule;
                optimizationLogs = [...optimizationLogs, ...result.logs];
                
                const newRoleStats = {};
                scheduleStaffList.forEach(s => {
                    let tn=0, kho=0, gh=0;
                    Object.values(previewScheduleData).forEach(dayList => {
                        const assign = dayList.find(a => a.staffId === s.id);
                        if(assign && assign.shift !== 'OFF') {
                            let r = (assign.role||'').toLowerCase();
                            if(r.includes('tn') || r.includes('thu')) tn++;
                            if(r.includes('kho') || r.includes('k')) kho++;
                            if(r.includes('gh') || r.includes('giao')) gh++;
                        }
                    });
                    newRoleStats[s.id] = { tn, kho, gh };
                });
                previewStats = previewStats.map(s => { if (newRoleStats[s.id]) return { ...s, ...newRoleStats[s.id] }; return s; });
                
                alert(`✅ Đã rã thành công ${result.count} ca nghiệp vụ liên tiếp!`);
            } else {
                alert("✅ Hệ thống không còn lỗi nghiệp vụ liên tiếp hoặc không tìm được người thế thân phù hợp.");
            }
            isLoading = false;
        }, 300);
    }

    function handleAutoFixWeekend() { 
        if (!previewScheduleData) return;
        isLoading = true;
        setTimeout(() => { const result = autoFixWeekendFairness(previewScheduleData, scheduleMonth, scheduleYear, scheduleStaffList); if (result.success) { previewScheduleData = result.schedule; optimizationLogs = [...optimizationLogs, ...result.logs]; previewStats = [...previewStats]; alert(`✅ Đã cân bằng lại ${result.count} ca cuối tuần!`); } else { alert("✅ Hệ thống đã tối ưu."); } isLoading = false; }, 300);
    }
    function handleAutoFixGender() { 
        if (!previewScheduleData) return;
        const dryRun = autoFixGenderBalance(previewScheduleData, scheduleMonth, scheduleYear, false);
        if (!dryRun.success && !dryRun.hasConflict) { alert("✅ Không tìm thấy lỗi giới tính có thể sửa.");
            return; } 
        if (dryRun.hasConflict) { 
            if (confirm(`⚠️ CẢNH BÁO XUNG ĐỘT!\n\nCân bằng giới tính sẽ gây lỗi Xoay Ca. BỎ QUA luật xoay ca?`)) { 
                const forceFix = autoFixGenderBalance(previewScheduleData, scheduleMonth, scheduleYear, true);
                previewScheduleData = forceFix.schedule; optimizationLogs = [...optimizationLogs, ...forceFix.logs]; alert(`✅ Đã sửa ${forceFix.count} lỗi (Chấp nhận gãy nhịp)!`);
            } 
        } else { previewScheduleData = dryRun.schedule; optimizationLogs = [...optimizationLogs, ...dryRun.logs];
            alert(`✅ Đã sửa thành công ${dryRun.count} lỗi!`); } 
    }

    function handleOptimize() { 
        if (!previewScheduleData) return;
        const beforeOptimizeJSON = JSON.stringify(previewScheduleData); 
        isLoading = true;
        setTimeout(() => { 
            const optResult = optimizeSchedule(previewScheduleData, scheduleStaffList, pastThreeMonthsData); 
            const afterOptimizeJSON = JSON.stringify(optResult.optimizedSchedule); 
            if (beforeOptimizeJSON === afterOptimizeJSON) { alert("✅ Lịch hiện tại đã tối ưu!"); isLoading = false; return; } 
            previewScheduleData = optResult.optimizedSchedule; 
            
            const newRoleStats = {}; 
            optResult.finalStats.forEach(s => newRoleStats[s.id] = s.roles); 
            previewStats = previewStats.map(s => { if (newRoleStats[s.id]) { return { ...s, ...newRoleStats[s.id] }; } return s; }); 
            pureSystemStats = JSON.parse(JSON.stringify(previewStats));
            optimizationLogs = optResult.changesLog; isLoading = false; 
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
            await setDoc(mainRef, { 
                config: { matrix: shiftMatrix, approvedCombos: suggestedCombos, genderConfig, comboCols: customComboCols }, 
                data: previewScheduleData, stats: previewStats, systemStats: pureSystemStats, baselineStats: pureSystemStats, endOffset: originalResult?.endOffset || 0, updatedAt: serverTimestamp(), updatedBy: $currentUser.username 
            });
            alert("✅ Đã áp dụng lịch thành công!"); 
            dispatch('switchTab', 'schedule'); 
        } catch (e) { alert("Lỗi: " + e.message);
        } finally { isLoading = false; } 
    }

    async function handleRestoreBackup() { 
        if (!confirm("⚠️ CẢNH BÁO: Bạn có chắc chắn muốn khôi phục lại phiên bản lịch trước đó?")) return;
        isLoading = true; 
        try { 
            const scheduleId = `${scheduleYear}-${String(scheduleMonth).padStart(2,'0')}`;
            const backupRef = doc(db, 'stores', targetStore, 'schedules', `${scheduleId}_backup`); 
            const backupSnap = await getDoc(backupRef);
            if (!backupSnap.exists()) { alert("❌ Không tìm thấy bản sao lưu nào để khôi phục."); isLoading = false; return;
            } 
            const mainRef = doc(db, 'stores', targetStore, 'schedules', scheduleId);
            await setDoc(mainRef, backupSnap.data()); alert("✅ Đã khôi phục thành công lịch cũ!"); dispatch('switchTab', 'schedule');
        } catch (e) { alert("Lỗi khôi phục: " + e.message); } finally { isLoading = false;
        } 
    }

    function openEditPreviewShift(day, staffId, assign) { 
        const staffInfo = previewStats.find(s => s.id === staffId);
        tempEditingShift = { day, staffId, name: assign.name, shift: assign.shift, role: assign.role || 'TV', isOFF: assign.shift === 'OFF', gender: staffInfo ? staffInfo.gender : 'Nữ', originalRole: assign.originalRole !== undefined ? assign.originalRole : (assign.role || 'TV'), originalShift: assign.originalShift !== undefined ? assign.originalShift : assign.shift }; 
        editingShift = JSON.parse(JSON.stringify(tempEditingShift)); 
    }
    
    function resetEditPreviewShift() { if (!editingShift) return;
        editingShift.shift = editingShift.originalShift; editingShift.role = editingShift.originalRole; editingShift.isOFF = editingShift.shift === 'OFF';
    }
    
    function savePreviewShiftChange() { 
        if (!editingShift || !previewScheduleData) return;
        const dayKey = String(editingShift.day); 
        const dayList = [...previewScheduleData[dayKey]]; 
        const idx = dayList.findIndex(x => x.staffId === editingShift.staffId);
        if (idx !== -1) { 
            const oldRole = dayList[idx].role || 'TV'; 
            const newRole = editingShift.isOFF ? '' : (editingShift.role === 'TV' ? '' : editingShift.role);
            dayList[idx] = { ...dayList[idx], shift: editingShift.isOFF ? 'OFF' : editingShift.shift, role: newRole, isChanged: true }; 
            previewScheduleData[dayKey] = dayList;
            const newStats = [...previewStats];
            const statIdx = newStats.findIndex(s => s.id === editingShift.staffId);
            if (statIdx !== -1) { 
                const s = newStats[statIdx];
                let rOld = (oldRole === 'Giao Hàng' || oldRole === 'GH') ? 'gh' : ((oldRole === 'Thu Ngân' || oldRole === 'TN') ? 'tn' : ((oldRole === 'Kho' || oldRole === 'K') ? 'kho' : ''));
                if(rOld) s[rOld] = Math.max(0, (s[rOld]||0) - 1); 
                let rNew = (newRole === 'Giao Hàng' || newRole === 'GH') ? 'gh' : ((newRole === 'Thu Ngân' || newRole === 'TN') ? 'tn' : ((newRole === 'Kho' || newRole === 'K') ? 'kho' : ''));
                if(rNew) s[rNew] = (s[rNew]||0) + 1; 
                previewStats = newStats; 
            } 
            editingShift = null;
        } 
    }

    function viewPersonalSchedule(staffId, staffName) { 
        if(!previewScheduleData) return;
        let days = Object.keys(previewScheduleData).sort((a,b)=>Number(a)-Number(b)).map(d => { const assign = previewScheduleData[d].find(x => x.staffId === staffId); if(assign) return { day: d, weekday: getWeekday(d), ...assign }; return null; }).filter(x=>x);
        const firstDayDate = new Date(scheduleYear, scheduleMonth - 1, 1); 
        let startDayIdx = firstDayDate.getDay(); 
        if (startDayIdx === 0) startDayIdx = 6;
        else startDayIdx = startDayIdx - 1; 
        let blankCells = Array(startDayIdx).fill(null); 
        const stat = previewStats.find(s => s.id === staffId) || { totalHours:0, gh:0, tn:0, kho:0 }; 
        selectedStaff = { id: staffId, name: staffName, days, blankCells, stats: stat };
    }
    
    function showDayStats(day) { 
        if (!previewScheduleData || !previewScheduleData[day]) return;
        const dayData = previewScheduleData[day];
        const roles = ['Kho', 'Thu Ngân', 'GH', 'TV'];
        const matrix = { 'Kho': {}, 'Thu Ngân': {}, 'GH': {}, 'TV': {} };
        const activeShifts = new Set();
        let totalHours = 0; dayData.forEach(assign => { if (assign.shift !== 'OFF') { activeShifts.add(assign.shift); } });
        const cols = Array.from(activeShifts).sort();
        roles.forEach(r => { cols.forEach(c => matrix[r][c] = 0); matrix[r]['Total'] = 0; });
        dayData.forEach(assign => { if (assign.shift === 'OFF') return; let r = assign.role || 'TV'; if (r === 'TN') r = 'Thu Ngân'; if (matrix[r]) { matrix[r][assign.shift] = (matrix[r][assign.shift] || 0) + 1; matrix[r]['Total']++; } });
        selectedDayStats = { day, weekday: getWeekday(day), cols, matrix, roles, totalHours };
    }
    
    function handleResetPreview() { previewScheduleData = null; previewStats = []; optimizationLogs = []; }
    function handleDayHeaderClick(d) { showDayStats(d); }
</script>

<div id="combo-table-area" class="animate-fadeIn">
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
        on:fixFatigue={handleAutoFixFatigue}
        on:optimize={handleOptimize}
        on:reset={handleResetPreview}
        on:apply={handleApplySchedule}
        on:restore={handleRestoreBackup} 
        on:cellClick={(e) => openEditPreviewShift(e.detail.day, e.detail.staffId, e.detail.assign)}
        on:staffClick={(e) => viewPersonalSchedule(e.detail.id, e.detail.name)}
        on:headerClick={(e) => handleDayHeaderClick(e.detail)}
        on:balanceGender={handleManualBalance}
        on:openSmartSwap={() => showSmartSwap = true}
    />
</div>

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

{#if showSmartSwap}
    <SmartSwapModal 
        scheduleData={previewScheduleData}
        staffList={scheduleStaffList}
        {genderConfig}
        month={scheduleMonth}
        year={scheduleYear}
        currentStats={previewStats}
        on:close={() => showSmartSwap = false}
        on:execute={(e) => {
            const plan = e.detail;
            let newSchedule = JSON.parse(JSON.stringify(previewScheduleData));
            plan.forEach(swap => {
                const dayList = newSchedule[swap.day];
                let assign1 = dayList.find(a => a.staffId === swap.staff1.id);
                let assign2 = dayList.find(a => a.staffId === swap.staff2.id);
                
                let tempShift = assign1.shift; let tempRole = assign1.role;
                assign1.shift = assign2.shift; assign1.role = assign2.role; assign1.isChanged = true;
                assign2.shift = tempShift; assign2.role = tempRole; assign2.isChanged = true;
            });
            previewScheduleData = newSchedule;
            
            const newRoleStats = {};
            scheduleStaffList.forEach(s => {
                let tn=0, kho=0, gh=0;
                Object.values(previewScheduleData).forEach(dayList => {
                    const assign = dayList.find(a => a.staffId === s.id);
                    if(assign && assign.shift !== 'OFF') {
                        let r = (assign.role||'').toLowerCase();
                        if(r.includes('tn') || r.includes('thu')) tn++;
                        if(r.includes('kho') || r.includes('k')) kho++;
                        if(r.includes('gh') || r.includes('giao')) gh++;
                    }
                });
                newRoleStats[s.id] = { tn, kho, gh };
            });
            previewStats = previewStats.map(s => { if (newRoleStats[s.id]) return { ...s, ...newRoleStats[s.id] }; return s; });
            optimizationLogs = [...optimizationLogs, `🤖 SmartSwap AI: Đã xử lý phương án đảo chéo ca để cân bằng.`];
            showSmartSwap = false;
        }}
    />
{/if}