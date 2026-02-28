// src/lib/scheduleGenerator.js
import { BASE_HOURS, SHIFT_INFO, ROLE_MAP, DISPLAY_ROLE_MAP, HARD_ROLES } from './shiftConstants.js';

export function getDynamicShiftInfo(code) {
    if (!code || code === 'OFF') return { h: 0, group: 'OFF' };
    if (SHIFT_INFO[code]) return SHIFT_INFO[code];

    let totalHours = 0;
    let foundParts = [];
    for (let char of String(code)) {
        if (BASE_HOURS[char] !== undefined) {
            totalHours += BASE_HOURS[char];
            foundParts.push(parseInt(char));
        }
    }
    
    let group = 'OFF';
    const hasMorning = foundParts.some(p => [1, 2, 3].includes(p));
    const hasAfternoon = foundParts.some(p => [4, 5, 6].includes(p));

    if (hasMorning && hasAfternoon) {
        if (foundParts.length >= 4) group = 'FULL';
        else group = 'GAY';
        if (totalHours >= 10) group = 'EXTREME';
    } else if (hasMorning) {
        group = 'SANG';
    } else if (hasAfternoon) {
        group = 'CHIEU';
    }
    return { h: totalHours, group };
}

function isShiftConflict(yesterdayCode, todayCode) {
    if (!yesterdayCode || !todayCode || yesterdayCode === 'OFF' || todayCode === 'OFF') return false;
    const infoA = getDynamicShiftInfo(yesterdayCode);
    const infoB = getDynamicShiftInfo(todayCode);
    const gA = infoA.group;
    const gB = infoB.group;
    if (gA === gB && gA !== 'EXTREME' && gA !== 'GAY' && gA !== 'FULL') return true;
    return false;
}

function interleaveShifts(shiftList) {
    if (!shiftList || shiftList.length === 0) return [];
    const buckets = {};
    shiftList.forEach(s => { if (!buckets[s]) buckets[s] = []; buckets[s].push(s); });
    
    const PRIORITY_ORDER = ['123', '456', '23', '45', '2-5', '12-56', '123-56', '12-456', '12345', '23456', '2345', '123456', 'OFF'];
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

export function generateMonthlySchedule(originalStaffList, comboData, month, year, pastSchedules = [], genderConfig = { kho: 'none', tn: 'none' }) {
    const daysInMonth = new Date(year, month, 0).getDate();
    let warnings = [];

    let weekdayCombos = Array.isArray(comboData) ? comboData : (comboData.weekday || []);
    let weekendCombos = Array.isArray(comboData) ? comboData : (comboData.weekend || []);

    let staffList = originalStaffList.map(s => {
        return {
            id: s.id, name: s.name, gender: s.gender,
            isMale: (s.gender || '').trim().toLowerCase() === 'nam',
            lastShiftCode: 'OFF', lastRole: 'tv', lastHardRoleDay: -10,
            weekendHardRoleCount: 0,
            stats: { hours: 0, roles: { tn: 0, tv: 0, kho: 0, gh: 0 } },
            baseStats: { roles: { tn: 0, kho: 0, gh: 0 }, weekendHardRoleCount: 0 }
        };
    });

    if (pastSchedules && pastSchedules.length > 0) {
        pastSchedules.forEach(pastMonth => {
            const pData = pastMonth.data;
            if (!pData || !pData.data) return;

            const [pYear, pMonth] = pastMonth.monthStr.split('-').map(Number);
            
            Object.keys(pData.data).forEach(d => {
                const prevDateObj = new Date(pYear, pMonth - 1, parseInt(d));
                const isPrevWeekend = (prevDateObj.getDay() === 0 || prevDateObj.getDay() === 6);

                pData.data[d].forEach(assign => {
                    const staff = staffList.find(s => s.id === assign.staffId);
                    if (staff && assign.originalShift && assign.originalShift !== 'OFF') {
                        const rCode = ROLE_MAP[assign.originalRole || assign.role] || 'tv';
                        if (HARD_ROLES.includes(rCode)) {
                            staff.baseStats.roles[rCode]++;
                            if (isPrevWeekend) staff.baseStats.weekendHardRoleCount++;
                        }
                    }
                });
            });
        });

        const prevMonthData = pastSchedules[0].data;
        if (prevMonthData && prevMonthData.data) {
            const days = Object.keys(prevMonthData.data).map(Number).sort((a,b)=>b-a);
            if (days.length > 0) {
                const lastDayKey = String(days[0]);
                prevMonthData.data[lastDayKey].forEach(assign => {
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
    }

    const buildPool = (combos) => {
        let raw = [];
        combos.forEach(c => {
            let rId = ROLE_MAP[c.role] || 'tv';
            let qty = parseInt(c.qty) || 0;
            for (let i = 0; i < qty; i++) raw.push(c.code);
        });
        
        while (raw.length < staffList.length) {
            raw.push('OFF');
        }
        
        let pool = interleaveShifts(raw);
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
                
                if (gap <= 1) score -= 300000; 
                else score += gap * 10; 
                
                const totalRoleCount = staff.baseStats.roles[targetRole] + staff.stats.roles[targetRole];
                score -= totalRoleCount * 1000000;
                
                if (isWeekend) {
                    const totalWeekendCount = staff.baseStats.weekendHardRoleCount + staff.weekendHardRoleCount;
                    score -= totalWeekendCount * 500000;
                }

                const candInfo = getDynamicShiftInfo(cand.shift);
                const lastInfo = getDynamicShiftInfo(staff.lastShiftCode);
                if (candInfo.group !== 'OFF' && candInfo.group === lastInfo.group) {
                    score -= 50000;
                }
                
                if (!isWeekend) { 
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
                }

                cand.score = score;
            });

            allCandidates.sort((a, b) => b.score - a.score);

            for (let i = 0; i < shiftsNeedingRole.length; i++) {
                let targetShiftCode = shiftsNeedingRole[i];
                let isAssigned = false;

                const trySwap = (candidate, potentialHolders, debug = false) => {
                    for (let k = 0; k < potentialHolders.length; k++) {
                        let holder = potentialHolders[k];
                        let staffHolder = staffList.find(s => s.id === holder.staffId);
                        
                        if (isShiftConflict(staffHolder.lastShiftCode, candidate.shift)) continue;

                        let tempShift = holder.shift;
                        holder.shift = candidate.shift;
                        candidate.shift = tempShift;
                        candidate.role = targetRole;
                        candidate.fixed = true;
                        return true;
                    }
                    return false;
                };

                let bestCandidateScore = allCandidates.length > 0 ? allCandidates[0].score : 0;

                for (let j = 0; j < allCandidates.length; j++) {
                    let cand = allCandidates[j];
                    if (cand.fixed) continue;
                    
                    if (targetRole === 'gh' && !cand.isMale) continue;
                    
                    const staffCand = staffList.find(s => s.id === cand.staffId);
                    
                    if (d - staffCand.lastHardRoleDay <= 1) continue;
                    
                    if (bestCandidateScore - cand.score >= 900000) continue;
                    
                    if (cand.shift === targetShiftCode) {
                        if (!isShiftConflict(staffCand.lastShiftCode, targetShiftCode)) {
                            cand.role = targetRole;
                            cand.fixed = true; 
                            isAssigned = true;
                            break;
                        }
                    }
                }

                if (isAssigned) continue;

                for (let j = 0; j < allCandidates.length; j++) {
                    let cand = allCandidates[j];
                    if (cand.fixed) continue;
                    
                    if (targetRole === 'gh' && !cand.isMale) continue;
                    
                    const staffCand = staffList.find(s => s.id === cand.staffId);
                    
                    if (isShiftConflict(staffCand.lastShiftCode, targetShiftCode)) continue;

                    let potentialSeatHolders = currentDayAssignments.filter(a => a.shift === targetShiftCode && !a.fixed);
                    
                    if (trySwap(cand, potentialSeatHolders, false)) {
                        isAssigned = true;
                        break;
                    }

                    if (!isAssigned) {
                        let offHolders = currentDayAssignments.filter(a => a.shift === 'OFF' && !a.fixed);
                        let bridgeFound = false;
                        
                        for(let b=0; b < offHolders.length; b++) {
                            let bridge = offHolders[b];
                            let staffBridge = staffList.find(s => s.id === bridge.staffId);
                            
                            if (isShiftConflict(staffBridge.lastShiftCode, cand.shift)) continue;

                            let oldCandShift = cand.shift;
                            cand.shift = 'OFF';
                            
                            if (trySwap(cand, potentialSeatHolders, false)) {
                                bridge.shift = oldCandShift;
                                bridgeFound = true;
                                isAssigned = true;
                                break; 
                            } else {
                                cand.shift = oldCandShift;
                            }
                        }
                        if (bridgeFound) break;
                    }
                }
            }
        });

        schedule[d] = currentDayAssignments.map(a => {
            const staff = staffList.find(s => s.id === a.staffId);
            staff.lastShiftCode = a.shift;
            staff.lastRole = a.role;
            
            if (a.shift !== 'OFF') {
                staff.stats.hours += getDynamicShiftInfo(a.shift).h;
                if (HARD_ROLES.includes(a.role)) {
                    staff.stats.roles[a.role]++;
                    staff.lastHardRoleDay = d;
                    if (isWeekend) staff.weekendHardRoleCount++;
                } else {
                    staff.stats.roles.tv++;
                }
            }
            
            // [KHÔI PHỤC] Trả lại DISPLAY_ROLE_MAP để UI Table có màu như cũ
            // [THÊM MỚI] Gài thêm rawRole để Modal Sửa ca có cái dùng sau này
            return {
                staffId: a.staffId, name: a.name, gender: staff.gender,
                shift: a.shift, 
                role: DISPLAY_ROLE_MAP[a.role] || '', 
                originalShift: a.shift, 
                originalRole: DISPLAY_ROLE_MAP[a.role] || '',
                rawRole: a.role
            };
        });
    }

    const finalStaffStats = staffList.map(s => ({
        id: s.id, name: s.name, gender: s.gender,
        totalHours: Math.round(s.stats.hours),
        gh: s.stats.roles.gh, tn: s.stats.roles.tn, kho: s.stats.roles.kho,
        weekendHardRoles: s.weekendHardRoleCount
    }));

    ['gh', 'tn', 'kho'].forEach(role => {
        let eligibleStaff = finalStaffStats;
        if (role === 'gh') eligibleStaff = finalStaffStats.filter(s => (s.gender || '').toLowerCase() === 'nam');
        
        if (eligibleStaff.length > 0) {
            let counts = eligibleStaff.map(s => s[role]);
            let min = Math.min(...counts);
            let max = Math.max(...counts);
            
            if (max - min > 2) {
                let maxNames = eligibleStaff.filter(s => s[role] === max).map(s => `${s.name}(${max})`).join(', ');
                let minNames = eligibleStaff.filter(s => s[role] === min).map(s => `${s.name}(${min})`).join(', ');
                warnings.push(`CẢNH BÁO LỆCH ${role.toUpperCase()}: Max=${max}, Min=${min}. [Thừa: ${maxNames}] - [Thiếu: ${minNames}]`);
            }
        }
    });

    return { schedule, staffStats: finalStaffStats, endOffset: 0, warnings };
}