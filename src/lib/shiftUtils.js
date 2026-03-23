// src/lib/shiftUtils.js

export function getShiftColor(code) {
    if (code === 'OFF') return 'bg-red-600 text-white border-red-700 font-black tracking-wider text-[10px] shadow-sm';
    const map = { '123': 'bg-green-50 text-green-700 border-green-100', '456': 'bg-orange-50 text-orange-700 border-orange-100', '23': 'bg-cyan-50 text-cyan-700 border-cyan-100', '45': 'bg-blue-50 text-blue-700 border-blue-100', '2-5': 'bg-pink-50 text-pink-700 border-pink-100', '2345': 'bg-red-50 text-red-700 border-red-100' };
    return map[code] || 'bg-white text-gray-800 border-gray-200';
}

export function getRoleBadge(role) {
    if (!role || role === 'TV') return null;
    if (role === 'GH' || role === 'Giao Hàng') return { text: 'GH', class: 'bg-blue-600 text-white' };
    if (role === 'Thu Ngân' || role === 'TN') return { text: 'TN', class: 'bg-purple-600 text-white' };
    if (role === 'Kho') return { text: 'K', class: 'bg-orange-500 text-white' };
    return { text: role.charAt(0), class: 'bg-gray-500 text-white' };
}

export function getWeekday(day, viewMonth, viewYear) { 
    const date = new Date(viewYear, viewMonth - 1, day);
    return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]; 
}

export function getWeekendHardRoleCount(staffId, scheduleData, viewMonth, viewYear) {
    if (!scheduleData || !scheduleData.data) return 0;
    let count = 0;
    const isHardRole = (r) => ['Kho', 'Thu Ngân', 'Giao Hàng', 'GH', 'TN', 'K'].includes(r);
    const isWeekend = (d) => { const date = new Date(viewYear, viewMonth - 1, d); const day = date.getDay(); return day === 0 || day === 6; };
    Object.keys(scheduleData.data).forEach(d => {
        if (isWeekend(d)) {
            const assign = scheduleData.data[d].find(a => a.staffId === staffId);
            if (assign && isHardRole(assign.role)) count++;
        }
    });
    return count;
}

export function preparePersonalSchedule(staffId, staffName, scheduleData, viewMonth, viewYear) {
    if(!scheduleData?.data) return null;
    let days = []; 
    Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b)).forEach(d => { 
        const assign = scheduleData.data[d].find(x => x.staffId === staffId); 
        if(assign) days.push({ day: d, weekday: getWeekday(d, viewMonth, viewYear), ...assign }); 
    });
    const firstDayDate = new Date(viewYear, viewMonth - 1, 1); 
    let startDayIdx = firstDayDate.getDay(); 
    if (startDayIdx === 0) startDayIdx = 6;
    else startDayIdx = startDayIdx - 1; 
    let blankCells = Array(startDayIdx).fill(null); 
    const stat = scheduleData.stats.find(s => s.id === staffId) || { totalHours:0, gh:0, tn:0, kho:0 }; 
    return { id: staffId, name: staffName, days, blankCells, stats: stat };
}

export function prepareDayStats(day, scheduleData, viewMonth, viewYear) {
    if (!scheduleData || !scheduleData.data[day]) return null;
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
            if (matrix[r]) { matrix[r][s] = (matrix[r][s] || 0) + 1; matrix[r]['Total']++; } 
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
    }).map(key => ({ shift: key, people: shiftDetails[key] }));
    return { day, weekday: getWeekday(day, viewMonth, viewYear), cols, matrix, roles, details, shiftDetails: sortedShiftArray };
}

export function checkShiftQuotaWarning(editingShift, scheduleData) {
    if (editingShift.role === 'GH' && editingShift.gender !== 'Nam') { 
        return `⚠️ CẢNH BÁO: Nhân viên ${editingShift.name} là NỮ.\nVị trí Giao Hàng thường yêu cầu NAM.\n\nBạn có chắc chắn muốn gán không?`;
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
            return quota === 0 ? `⛔ CẢNH BÁO: Combo [${editingShift.shift} - ${targetRoleCode}] KHÔNG CÓ trong bảng định mức!\n(Quota = 0)\n\nBạn có muốn ép buộc gán không?` : `⚠️ CẢNH BÁO VƯỢT ĐỊNH MỨC:\n\nCombo [${editingShift.shift} - ${targetRoleCode}] quy định: ${quota}.\nHiện tại: ${currentCount}.\nThêm mới thành: ${currentCount + 1}.\n\nTiếp tục?`;
        } 
    } 
    return null;
}

export function applyShiftChangeLocalData(editingShift, scheduleData) {
    const dayKey = String(editingShift.day);
    const dayList = [...scheduleData.data[dayKey]];
    const idx = dayList.findIndex(x => x.staffId === editingShift.staffId);
    let newStats = [...scheduleData.stats]; 

    if (idx !== -1) { 
        const oldRole = dayList[idx].role || 'TV';
        const newRole = editingShift.isOFF ? '' : (editingShift.role === 'TV' ? '' : editingShift.role);
        const updatedAssignment = { ...dayList[idx], shift: editingShift.isOFF ? 'OFF' : editingShift.shift, role: newRole }; 
        dayList[idx] = updatedAssignment;
        const statIdx = newStats.findIndex(s => s.id === editingShift.staffId);
        if (statIdx !== -1) { 
            const s = newStats[statIdx];
            let rOld = (oldRole === 'Giao Hàng' || oldRole === 'GH') ? 'gh' : ((oldRole === 'Thu Ngân' || oldRole === 'TN') ? 'tn' : ((oldRole === 'Kho' || oldRole === 'K') ? 'kho' : ''));
            if(rOld) s[rOld] = Math.max(0, (s[rOld]||0) - 1); 
            
            let rNew = (newRole === 'Giao Hàng' || newRole === 'GH') ? 'gh' : ((newRole === 'Thu Ngân' || newRole === 'TN') ? 'tn' : ((newRole === 'Kho' || newRole === 'K') ? 'kho' : ''));
            if(rNew) s[rNew] = (s[rNew]||0) + 1; 
        } 
    }
    return { dayKey, dayList, newStats };
}

export function findMyStatRowId(currentUser, stats) {
    const normalizeStr = (str) => str ? String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const cUsername = normalizeStr(currentUser.username);
    const cName = normalizeStr(currentUser.name);
    const cId = normalizeStr(currentUser.id);
    const myStat = stats.find(s => {
        const sId = normalizeStr(s.id);
        const sName = normalizeStr(s.name);
        const sUsername = normalizeStr(s.username);
        if (sId && (sId === cId || sId === cUsername)) return true;
        if (sUsername && sUsername === cUsername) return true;
        if (sName && cName && (sName.includes(cName) || cName.includes(sName))) return true;
        if (sName && cUsername && (sName.includes(cUsername) || cUsername.includes(sName))) return true;
        return false;
    });
    return myStat ? myStat.id : null;
}