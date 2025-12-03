// Version 35.0 - Add Shift 123456
export const SHIFT_DEFINITIONS = [
    // Ca Chuẩn
    { code: '123', label: 'Ca Sáng (1+2+3)', time: '08:00 - 15:00', hours: 7, group: 'SANG' },
    { code: '456', label: 'Ca Chiều (4+5+6)', time: '15:00 - 22:00', hours: 6.5, group: 'CHIEU' },
    { code: '23', label: 'Ca Trưa (2+3)', time: '09:00 - 15:00', hours: 6, group: 'SANG' },
    { code: '45', label: 'Ca Chiều Lửng (4+5)', time: '15:00 - 21:00', hours: 6, group: 'CHIEU' },
    { code: '2-5', label: 'Ca Gãy (2+5)', time: '09:00-12:00 & 18:00-21:00', hours: 6, group: 'GAY' },
    { code: '2345', label: 'Giao Hàng Full', time: '09:00 - 21:00', hours: 12, group: 'FULL' },
    
    // Ca Siêu Cường & Đặc Biệt
    { code: '123456', label: 'Full Ngày Đêm', time: '08:00 - 22:00', hours: 13.5, group: 'EXTREME' }, // Mới thêm
    { code: '12-56', label: 'Sáng Sớm + Tối Muộn', time: '08:00-12:00 & 18:00-22:00', hours: 8, group: 'EXTREME' },
    { code: '12-456', label: 'Sáng Sớm + Chiều Full', time: '08:00-12:00 & 15:00-22:00', hours: 11, group: 'EXTREME' },
    { code: '123-56', label: 'Sáng Full + Tối Muộn', time: '08:00-15:00 & 18:00-22:00', hours: 11, group: 'EXTREME' },
    { code: '12345', label: 'Sáng Cường Lực', time: '08:00 - 21:00', hours: 13, group: 'EXTREME' },
    { code: '23456', label: 'Chiều Cường Lực', time: '09:00 - 22:00', hours: 13, group: 'EXTREME' }
];

// ... (Phần code bên dưới giữ nguyên không đổi)
const SHIFT_INFO = {};
SHIFT_DEFINITIONS.forEach(s => SHIFT_INFO[s.code] = { h: s.hours, group: s.group });
SHIFT_INFO['OFF'] = { h: 0, group: 'OFF' };

const ROLE_MAP = { 'Thu Ngân': 'tn', 'TN': 'tn', 'Kho': 'kho', 'K': 'kho', 'Giao Hàng': 'gh', 'GH': 'gh', 'Tư Vấn': 'tv', 'TV': 'tv', '': 'tv' };
const DISPLAY_ROLE_MAP = { 'tn': 'Thu Ngân', 'kho': 'Kho', 'gh': 'Giao Hàng', 'tv': '' };
const HARD_ROLES = ['gh', 'kho', 'tn'];

function getShiftGroup(code) { return SHIFT_INFO[code]?.group || 'OFF'; }

function isShiftConflict(yesterdayCode, todayCode) {
    if (!yesterdayCode || !todayCode || yesterdayCode === 'OFF' || todayCode === 'OFF') return false;
    const gA = getShiftGroup(yesterdayCode);
    const gB = getShiftGroup(todayCode);
    if (gA === gB && gA !== 'EXTREME' && gA !== 'GAY' && gA !== 'FULL') return true;
    return false;
}

function interleaveShifts(shiftList) {
    if (!shiftList || shiftList.length === 0) return [];
    const buckets = {};
    shiftList.forEach(s => { if (!buckets[s]) buckets[s] = []; buckets[s].push(s); });
    // Thêm 123456 vào độ ưu tiên
    const PRIORITY_ORDER = ['123456', '12345', '23456', '2345', '12-456', '123-56', '12-56', '2-5', '123', '456', '23', '45'];
    Object.keys(buckets).forEach(k => { if (!PRIORITY_ORDER.includes(k)) PRIORITY_ORDER.push(k); });
    let result = [];
    let hasItems = true;
    while (hasItems) {
        hasItems = false;
        PRIORITY_ORDER.forEach(code => {
            if (buckets[code] && buckets[code].length > 0) { result.push(buckets[code].shift()); hasItems = true; }
        });
    }
    return result;
}

export function calculateCombosFromMatrix(matrix) {
    let remain = JSON.parse(JSON.stringify(matrix));
    let combos = [];
    const subtract = (shiftCodes, role, qty) => {
        shiftCodes.forEach(code => { if (remain[code] && remain[code][role] >= qty) remain[code][role] -= qty; });
    };
    const findMaxCap = (shiftCodes, role) => {
        let min = 999;
        shiftCodes.forEach(code => { let val = remain[code] ? remain[code][role] : 0; if (val < min) min = val; });
        return min;
    };

    let ghFullQty = findMaxCap(['c2', 'c3', 'c4', 'c5'], 'gh');
    if (ghFullQty > 0) { combos.push({ code: '2345', role: 'GH', qty: ghFullQty }); subtract(['c2', 'c3', 'c4', 'c5'], 'gh', ghFullQty); }
    let gh23 = findMaxCap(['c2', 'c3'], 'gh');
    if (gh23 > 0) { combos.push({ code: '23', role: 'GH', qty: gh23 }); subtract(['c2', 'c3'], 'gh', gh23); }
    let gh45 = findMaxCap(['c4', 'c5'], 'gh');
    if (gh45 > 0) { combos.push({ code: '45', role: 'GH', qty: gh45 }); subtract(['c4', 'c5'], 'gh', gh45); }

    ['kho', 'tn', 'tv'].forEach(role => {
        let labelRole = role === 'kho' ? 'Kho' : (role === 'tn' ? 'Thu Ngân' : 'TV');
        let q123 = findMaxCap(['c1', 'c2', 'c3'], role);
        if (q123 > 0) { combos.push({ code: '123', role: labelRole, qty: q123 }); subtract(['c1', 'c2', 'c3'], role, q123); }
        let q456 = findMaxCap(['c4', 'c5', 'c6'], role);
        if (q456 > 0) { combos.push({ code: '456', role: labelRole, qty: q456 }); subtract(['c4', 'c5', 'c6'], role, q456); }
        let q23 = findMaxCap(['c2', 'c3'], role);
        if (q23 > 0) { combos.push({ code: '23', role: labelRole, qty: q23 }); subtract(['c2', 'c3'], role, q23); }
        let q45 = findMaxCap(['c4', 'c5'], role);
        if (q45 > 0) { combos.push({ code: '45', role: labelRole, qty: q45 }); subtract(['c4', 'c5'], role, q45); }
        let q25 = findMaxCap(['c2', 'c5'], role);
        if (q25 > 0) { combos.push({ code: '2-5', role: labelRole, qty: q25 }); subtract(['c2', 'c5'], role, q25); }
    });
    return combos;
}

export function suggestPeakCombos(baseCombos, deficit) {
    if (deficit <= 0) return baseCombos;
    let newCombos = JSON.parse(JSON.stringify(baseCombos));
    let savedSlots = 0;

    ['TV', 'Thu Ngân', 'Kho'].forEach(role => {
        if (savedSlots >= deficit) return;
        let idx123 = newCombos.findIndex(c => c.code === '123' && c.role === role);
        let idx456 = newCombos.findIndex(c => c.code === '456' && c.role === role);

        if (idx123 > -1 && idx456 > -1) {
            let qty123 = newCombos[idx123].qty;
            let qty456 = newCombos[idx456].qty;
            let mergeQty = Math.min(qty123, qty456);
            let needToSave = deficit - savedSlots;
            if (mergeQty > needToSave) mergeQty = needToSave;

            if (mergeQty > 0) {
                newCombos[idx123].qty -= mergeQty;
                newCombos[idx456].qty -= mergeQty;
                let idxNew = newCombos.findIndex(c => c.code === '12-56' && c.role === role);
                if (idxNew > -1) newCombos[idxNew].qty += mergeQty;
                else newCombos.push({ code: '12-56', role: role, qty: mergeQty });
                savedSlots += mergeQty;
            }
        }
    });
    return newCombos;
}

export function generateMonthlySchedule(originalStaffList, comboData, month, year, prevScheduleData = null, genderConfig = { kho: 'none', tn: 'none' }) {
    const daysInMonth = new Date(year, month, 0).getDate();
    let warnings = [];

    let weekdayCombos = Array.isArray(comboData) ? comboData : (comboData.weekday || []);
    let weekendCombos = Array.isArray(comboData) ? comboData : (comboData.weekend || []);

    let staffList = originalStaffList.map(s => ({
        id: s.id, name: s.name, gender: s.gender,
        isMale: (s.gender || '').trim().toLowerCase() === 'nam',
        lastShiftCode: 'OFF', lastRole: 'tv', lastHardRoleDay: -10,
        weekendHardRoleCount: 0,
        stats: { hours: 0, roles: { tn: 0, tv: 0, kho: 0, gh: 0 } }
    }));
    if (prevScheduleData && prevScheduleData.data) {
        const lastDayKey = Object.keys(prevScheduleData.data).sort((a,b)=>Number(b)-Number(a))[0];
        if (lastDayKey) {
            prevScheduleData.data[lastDayKey].forEach(assign => {
                const staff = staffList.find(s => s.id === assign.staffId);
                if (staff) {
                    staff.lastShiftCode = assign.shift;
                    const rCode = ROLE_MAP[assign.role] || 'tv';
                    staff.lastRole = rCode;
                    if (HARD_ROLES.includes(rCode)) staff.lastHardRoleDay = 0;
                }
            });
        }
    }

    const buildPool = (combos) => {
        let raw = [];
        combos.forEach(c => {
            let rId = ROLE_MAP[c.role] || 'tv';
            let qty = parseInt(c.qty) || 0;
            for (let i = 0; i < qty; i++) raw.push(c.code);
        });
        let pool = interleaveShifts(raw);
        while (pool.length < staffList.length) pool.push('OFF');
        return pool.slice(0, staffList.length);
    };

    const weekdayPool = buildPool(weekdayCombos);
    const weekendPool = buildPool(weekendCombos);

    const getDemands = (combos) => {
        let demand = {};
        combos.forEach(c => {
            let rId = ROLE_MAP[c.role] || 'tv';
            let qty = parseInt(c.qty) || 0;
            for (let i = 0; i < qty; i++) {
                if (!demand[c.code]) demand[c.code] = [];
                demand[c.code].push(rId);
            }
        });
        return demand;
    };
    const weekdayDemands = getDemands(weekdayCombos);
    const weekendDemands = getDemands(weekendCombos);

    let schedule = {};
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month - 1, d);
        const dayOfWeek = dateObj.getDay(); 
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

        const currentPool = isWeekend ? weekendPool : weekdayPool;
        const currentDemands = JSON.parse(JSON.stringify(isWeekend ? weekendDemands : weekdayDemands));
        let currentDayAssignments = staffList.map((staff, index) => {
            let poolIndex = (index + d) % staffList.length;
            let assignedShift = currentPool[poolIndex];
            return {
                staffId: staff.id, name: staff.name, isMale: staff.isMale,
                shift: assignedShift, role: 'tv', fixed: false, originalIndex: index
            };
        });
        const ROLE_PRIORITY = ['gh', 'kho', 'tn'];

        ROLE_PRIORITY.forEach(targetRole => {
            let shiftsNeedingRole = [];
            Object.keys(currentDemands).forEach(shiftCode => {
                let count = currentDemands[shiftCode].filter(r => r === targetRole).length;
                for(let k=0; k<count; k++) shiftsNeedingRole.push(shiftCode);
            });

            if (shiftsNeedingRole.length === 0) return;

            let allCandidates = currentDayAssignments.filter(a => !a.fixed);

            allCandidates.forEach(cand => {
                const staff = staffList.find(s => s.id === cand.staffId);
                let score = 0;
                if (targetRole === 'gh' && !cand.isMale) { cand.score = -99999999; return; }
                const gap = d - staff.lastHardRoleDay;
                if (gap <= 1) {
                    score -= 5000000; 
                } else {
                    score += gap * 400;
                }
                score -= staff.stats.roles[targetRole] * 1000;
                if (isWeekend) score -= staff.weekendHardRoleCount * 50000;
                if (targetRole === 'kho' && genderConfig.kho === 'mixed') {
                    const existingInShift = currentDayAssignments.filter(a => a.fixed && a.role === 'kho' && a.shift === cand.shift);
                    const hasMale = existingInShift.some(a => a.isMale);
                    if (existingInShift.length > 0 && !hasMale && !cand.isMale) score -= 500;
                }
                if (targetRole === 'tn' && genderConfig.tn === 'mixed') {
                    const existingInShift = currentDayAssignments.filter(a => a.fixed && a.role === 'tn' && a.shift === cand.shift);
                    const hasMale = existingInShift.some(a => a.isMale);
                    const hasFemale = existingInShift.some(a => !a.isMale);
                    if (existingInShift.length > 0) {
                        if (!hasMale && !cand.isMale) score -= 500;
                        if (!hasFemale && cand.isMale) score -= 500;
                    }
                }
                let nextPoolIndex = (cand.originalIndex + d + 1) % staffList.length;
                let nextShift = currentPool[nextPoolIndex];
                if (['2345', '123', '12-56'].includes(nextShift)) score -= 50;

                cand.score = score;
            });
            allCandidates.sort((a, b) => b.score - a.score);

            for (let i = 0; i < shiftsNeedingRole.length; i++) {
                let targetShiftCode = shiftsNeedingRole[i];
                for (let j = 0; j < allCandidates.length; j++) {
                    let cand = allCandidates[j];
                    if (cand.fixed) continue;
                    
                    const staffCand = staffList.find(s => s.id === cand.staffId);
                    if (cand.shift !== targetShiftCode) {
                        if (isShiftConflict(staffCand.lastShiftCode, targetShiftCode)) continue;
                    }

                    if (cand.shift === targetShiftCode) {
                        cand.role = targetRole;
                        cand.fixed = true; break;
                    } else {
                        let potentialSeatHolders = currentDayAssignments.filter(a => a.shift === targetShiftCode && !a.fixed);
                        let validSeatHolder = null;
                        for (let k = 0; k < potentialSeatHolders.length; k++) {
                            let holder = potentialSeatHolders[k];
                            let staffHolder = staffList.find(s => s.id === holder.staffId);
                            if (!isShiftConflict(staffHolder.lastShiftCode, cand.shift)) {
                                validSeatHolder = holder;
                                break; 
                            }
                        }
                        if (validSeatHolder) {
                            let tempShift = validSeatHolder.shift;
                            validSeatHolder.shift = cand.shift;
                            cand.shift = tempShift;
                            cand.role = targetRole;
                            cand.fixed = true;
                            break;
                        } else continue;
                    }
                }
            }
        });
        schedule[d] = currentDayAssignments.map(a => {
            const staff = staffList.find(s => s.id === a.staffId);
            staff.lastShiftCode = a.shift;
            staff.lastRole = a.role;
            
            if (a.shift !== 'OFF') {
                staff.stats.hours += SHIFT_INFO[a.shift].h;
                if (HARD_ROLES.includes(a.role)) {
                    staff.stats.roles[a.role]++;
                    staff.lastHardRoleDay = d;
                    if (isWeekend) staff.weekendHardRoleCount++;
                } else {
                    staff.stats.roles.tv++;
                }
            }
            
            return {
                staffId: a.staffId, name: a.name, gender: staff.gender,
                shift: a.shift, role: DISPLAY_ROLE_MAP[a.role] || '',
                originalShift: a.shift, originalRole: DISPLAY_ROLE_MAP[a.role] || ''
            };
        });
    }

    const finalStaffStats = staffList.map(s => ({
        id: s.id, name: s.name, gender: s.gender,
        totalHours: Math.round(s.stats.hours),
        gh: s.stats.roles.gh, tn: s.stats.roles.tn, kho: s.stats.roles.kho,
        weekendHardRoles: s.weekendHardRoleCount
    }));
    return { schedule, staffStats: finalStaffStats, endOffset: 0, warnings };
}