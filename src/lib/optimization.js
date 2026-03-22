// src/lib/optimization.js
// Version 37.2 - FIX: Auto Fix Fatigue respects Gender constraint for Delivery (Giao Hàng)

const SHIFT_GROUPS = {
    '123': 'SANG', '23': 'SANG', '12-56': 'SANG', '123-56': 'SANG', '12345': 'SANG',
    '456': 'CHIEU', '45': 'CHIEU', '23456': 'CHIEU',
    '2-5': 'GAY', '2345': 'FULL', 'OFF': 'OFF'
};

function getGroup(code) { return SHIFT_GROUPS[code] || 'OFF'; }

function isHardRole(r) { return ['Kho', 'Thu Ngân', 'Giao Hàng', 'GH', 'TN', 'K'].includes(r); }

function isWeekend(d, month, year) { 
    const date = new Date(year, month - 1, d);
    const day = date.getDay();
    return day === 0 || day === 6;
}

function hasRotationConflict(shift1, shift2) {
    const g1 = getGroup(shift1);
    const g2 = getGroup(shift2);
    if (g1 !== 'OFF' && g1 !== 'GAY' && g1 !== 'FULL' && g1 === g2) return true;
    return false;
}

// 1. AUTO FIX ROTATION
export function autoFixRotation(scheduleData, month, year) {
    let schedule = JSON.parse(JSON.stringify(scheduleData));
    let logs = [];
    let fixedCount = 0;
    const days = Object.keys(schedule).sort((a, b) => Number(a) - Number(b));

    for (let i = 1; i < days.length - 1; i++) {
        const todayKey = days[i];
        const prevKey = days[i-1];
        const nextKey = days[i+1];
        const todayAssigns = schedule[todayKey];
        const prevAssigns = schedule[prevKey];
        const nextAssigns = schedule[nextKey];

        let violators = [];
        todayAssigns.forEach(curr => {
            const prev = prevAssigns.find(p => p.staffId === curr.staffId);
            if (prev && hasRotationConflict(prev.shift, curr.shift)) {
                violators.push({ ...curr, group: getGroup(curr.shift) });
            }
        });

        let handledIds = [];
        violators.forEach(personA => {
            if (handledIds.includes(personA.staffId)) return;
            const personB = violators.find(v => !handledIds.includes(v.staffId) && v.staffId !== personA.staffId && v.group !== personA.group);

            if (personB) {
                const nextA = nextAssigns.find(n => n.staffId === personA.staffId);
                const nextB = nextAssigns.find(n => n.staffId === personB.staffId);
                const conflictA = nextA ? hasRotationConflict(personB.shift, nextA.shift) : false;
                const conflictB = nextB ? hasRotationConflict(personA.shift, nextB.shift) : false;

                if (!conflictA && !conflictB) {
                    const idxA = schedule[todayKey].findIndex(x => x.staffId === personA.staffId);
                    const idxB = schedule[todayKey].findIndex(x => x.staffId === personB.staffId);
                    if (idxA > -1 && idxB > -1) {
                        const tempShift = schedule[todayKey][idxA].shift;
                        const tempRole = schedule[todayKey][idxA].role;
                        schedule[todayKey][idxA].shift = schedule[todayKey][idxB].shift;
                        schedule[todayKey][idxA].role = schedule[todayKey][idxB].role;
                        schedule[todayKey][idxA].isChanged = true;
                        schedule[todayKey][idxB].shift = tempShift;
                        schedule[todayKey][idxB].role = tempRole;
                        schedule[todayKey][idxB].isChanged = true;
                        logs.push(`Ngày ${todayKey}: Tráo ca ${personA.name} (<->) ${personB.name} (Sửa lỗi nhịp).`);
                        fixedCount++;
                        handledIds.push(personA.staffId);
                        handledIds.push(personB.staffId);
                    }
                }
            }
        });
    }
    return { success: fixedCount > 0, count: fixedCount, schedule, logs };
}

// 2. AUTO FIX WEEKEND FAIRNESS
export function autoFixWeekendFairness(scheduleData, month, year, staffList) {
    let schedule = JSON.parse(JSON.stringify(scheduleData));
    let logs = [];
    let fixedCount = 0;
    
    const getStats = () => {
        const map = {};
        staffList.forEach(s => map[s.id] = { ...s, count: 0, isMale: s.gender === 'Nam' });
        Object.keys(schedule).forEach(d => {
            if (isWeekend(parseInt(d), month, year)) {
                schedule[d].forEach(a => { if (isHardRole(a.role)) map[a.staffId].count++; });
            }
        });
        return Object.values(map);
    };

    for(let loop=0; loop<100; loop++) {
        let stats = getStats();
        let maxVal = Math.max(...stats.map(s => s.count));
        let minVal = Math.min(...stats.map(s => s.count));
        
        if (maxVal - minVal <= 1) break;

        const donor = stats.find(s => s.count === maxVal);
        let receiver = stats.find(s => s.count === minVal && s.isMale === donor.isMale);
        if (!receiver) receiver = stats.find(s => s.count === minVal);

        if (!donor || !receiver) break;

        let swapDay = null;
        const days = Object.keys(schedule);
        
        for (const d of days) {
            if (isWeekend(parseInt(d), month, year)) {
                const assignD = schedule[d].find(a => a.staffId === donor.id);
                const assignR = schedule[d].find(a => a.staffId === receiver.id);
                
                if (assignD && isHardRole(assignD.role) && assignR && !isHardRole(assignR.role)) {
                    if ((assignD.role === 'GH' || assignD.role === 'Giao Hàng') && !receiver.isMale) continue;
                    swapDay = d; 
                    break;
                }
            }
        }

        if (swapDay) {
            const idxD = schedule[swapDay].findIndex(x => x.staffId === donor.id);
            const idxR = schedule[swapDay].findIndex(x => x.staffId === receiver.id);
            const tempShift = schedule[swapDay][idxD].shift;
            const tempRole = schedule[swapDay][idxD].role;
            schedule[swapDay][idxD].shift = schedule[swapDay][idxR].shift;
            schedule[swapDay][idxD].role = schedule[swapDay][idxR].role;
            schedule[swapDay][idxD].isChanged = true;
            schedule[swapDay][idxR].shift = tempShift;
            schedule[swapDay][idxR].role = tempRole;
            schedule[swapDay][idxR].isChanged = true;
            logs.push(`Ngày ${swapDay}: Chuyển ${tempRole} từ ${donor.name} sang ${receiver.name}.`);
            fixedCount++;
        } else {
            receiver.count += 999;
        }
    }
    return { success: fixedCount > 0, count: fixedCount, schedule, logs };
}

// 3. AUTO FIX GENDER (Basic)
export function autoFixGenderBalance(scheduleData, month, year, forceFix = false) {
    let schedule = JSON.parse(JSON.stringify(scheduleData));
    let logs = [];
    let conflictWarnings = [];
    let fixedCount = 0;
    const days = Object.keys(schedule).sort((a, b) => Number(a) - Number(b));

    for (let i = 1; i < days.length; i++) {
        const todayKey = days[i];
        const prevKey = days[i-1];
        const todayAssigns = schedule[todayKey];
        const prevAssigns = schedule[prevKey] || [];

        const shiftGroups = {};
        todayAssigns.forEach((assign, idx) => {
            if (assign.shift === 'OFF') return;
            if (!shiftGroups[assign.shift]) shiftGroups[assign.shift] = { males: [], females: [], code: assign.shift };
            
            if (assign.role === 'Kho') {
                if (assign.gender === 'Nam') shiftGroups[assign.shift].males.push({ ...assign, idx });
                else shiftGroups[assign.shift].females.push({ ...assign, idx });
            }
        });

        let lackMaleShifts = Object.values(shiftGroups).filter(g => g.males.length === 0 && g.females.length >= 1);
        let richMaleShifts = Object.values(shiftGroups).filter(g => g.males.length >= 1);

        lackMaleShifts.forEach(badShift => {
            let fixed = false;
            for (let targetRich of richMaleShifts) {
                if (targetRich.code === badShift.code || fixed) continue;
                for (let maleCandidate of targetRich.males) {
                    if (fixed) break;
                    const femaleCandidate = badShift.females[0];
                    const prevMale = prevAssigns.find(p => p.staffId === maleCandidate.staffId);
                    const prevFemale = prevAssigns.find(p => p.staffId === femaleCandidate.staffId);

                    let conflictM = prevMale ? hasRotationConflict(prevMale.shift, badShift.code) : false;
                    let conflictF = prevFemale ? hasRotationConflict(prevFemale.shift, targetRich.code) : false;

                    if ((conflictM || conflictF) && !forceFix) {
                        conflictWarnings.push(`Ngày ${todayKey}: Đổi ${maleCandidate.name} (Kho) gây lỗi xoay ca.`);
                        continue;
                    }

                    const idxM = maleCandidate.idx;
                    const idxF = femaleCandidate.idx;
                    const shiftM = schedule[todayKey][idxM].shift;
                    
                    schedule[todayKey][idxM].shift = schedule[todayKey][idxF].shift;
                    schedule[todayKey][idxM].isChanged = true;
                    schedule[todayKey][idxF].shift = shiftM;
                    schedule[todayKey][idxF].isChanged = true;
                    logs.push(`Ngày ${todayKey}: Đổi nội bộ Kho: ${maleCandidate.name} qua ca ${badShift.code}.`);
                    fixedCount++;
                    fixed = true;
                    targetRich.males = targetRich.males.filter(m => m.staffId !== maleCandidate.staffId);
                }
            }
        });
    }

    return { 
        success: fixedCount > 0, 
        count: fixedCount, 
        schedule, 
        logs,
        hasConflict: conflictWarnings.length > 0,
        conflicts: conflictWarnings
    };
}

// 4. MANUAL BALANCE GENDER (UPDATED LOGIC)
export function manualBalanceGender(scheduleData, staffList, month, year, config) {
    let schedule = JSON.parse(JSON.stringify(scheduleData));
    let logs = [];
    let successCount = 0;
    
    const targetRoleLabel = config.role === 'tn' ? 'Thu Ngân' : 'Kho';
    const targetRoleKey = config.role; 

    const donors = staffList.filter(s => s.gender === config.fromGender);
    const receivers = staffList.filter(s => s.gender === config.toGender);

    const getWeekendLoad = (staffId) => {
        let count = 0;
        Object.keys(schedule).forEach(d => {
            if (isWeekend(parseInt(d), month, year)) {
                const assign = schedule[d].find(a => a.staffId === staffId);
                if (assign && isHardRole(assign.role)) count++;
            }
        });
        return count;
    };

    const getRoleCount = (staffId) => {
        let count = 0;
        Object.values(schedule).forEach(dayList => {
            const assign = dayList.find(a => a.staffId === staffId);
            if (assign && (assign.role === targetRoleLabel || assign.role === targetRoleKey)) count++;
        });
        return count;
    };

    const days = Object.keys(schedule).sort((a, b) => Number(a) - Number(b));
    const lockedStaffOnDay = {}; 
    days.forEach(d => lockedStaffOnDay[d] = new Set());

    donors.forEach(donor => {
        let swappedCount = 0;

        for (const d of days) {
            if (swappedCount >= config.qty) break; 
            if (lockedStaffOnDay[d].has(donor.id)) continue;

            const dayList = schedule[d];
            const donorIdx = dayList.findIndex(a => a.staffId === donor.id);
            const donorAssign = dayList[donorIdx];

            if (donorAssign && (donorAssign.role === targetRoleLabel || donorAssign.role === targetRoleKey)) {
                
                let bestCandidate = null;
                let bestScore = -Infinity;

                const sortedReceivers = [...receivers].sort((a, b) => getRoleCount(a.id) - getRoleCount(b.id));

                for (const receiver of sortedReceivers) {
                    if (lockedStaffOnDay[d].has(receiver.id)) continue;

                    const receiverIdx = dayList.findIndex(a => a.staffId === receiver.id);
                    const receiverAssign = dayList[receiverIdx];

                    if (isHardRole(receiverAssign.role)) continue; 

                    let score = 0;
                    let isViable = true;
                    
                    const isDayWeekend = isWeekend(d, month, year);

                    if (isDayWeekend) {
                        const currentWeekendLoad = getWeekendLoad(receiver.id);
                        score -= (currentWeekendLoad * 5000);
                        score -= 1000; 
                    } else {
                        score += 100;
                    }

                    if (d > 1) {
                        const prevDay = schedule[d-1];
                        const prevAssign = prevDay.find(a => a.staffId === receiver.id);
                        if (prevAssign && isHardRole(prevAssign.role)) { score -= 2000; isViable = false; }
                    }
                    if (d < days.length) {
                        const nextDay = schedule[Number(d)+1];
                        if (nextDay) {
                            const nextAssign = nextDay.find(a => a.staffId === receiver.id);
                            if (nextAssign && isHardRole(nextAssign.role)) { score -= 2000; isViable = false; }
                        }
                    }

                    if (d > 1) {
                        const prevDay = schedule[d-1];
                        const prevAssign = prevDay.find(a => a.staffId === receiver.id);
                        if (prevAssign && hasRotationConflict(prevAssign.shift, donorAssign.shift)) score -= 500;
                        else score += 50;
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestCandidate = { ...receiver, idx: receiverIdx, currentShift: receiverAssign.shift, currentRole: receiverAssign.role };
                    }
                }

                if (bestCandidate) {
                    schedule[d][donorIdx].shift = bestCandidate.currentShift;
                    schedule[d][donorIdx].role = bestCandidate.currentRole;
                    schedule[d][donorIdx].isChanged = true;

                    schedule[d][bestCandidate.idx].shift = donorAssign.shift;
                    schedule[d][bestCandidate.idx].role = donorAssign.role;
                    schedule[d][bestCandidate.idx].isChanged = true;

                    lockedStaffOnDay[d].add(donor.id);
                    lockedStaffOnDay[d].add(bestCandidate.id);

                    logs.push(`Ngày ${d}: Đổi ${donorAssign.role} từ ${donor.name} -> ${bestCandidate.name}.`);
                    successCount++;
                    swappedCount++;
                }
            }
        }
    });

    return { schedule, logs, count: successCount };
}

// 5. OPTIMIZE SCHEDULE
export function optimizeSchedule(scheduleData, staffList) { 
    let schedule = JSON.parse(JSON.stringify(scheduleData));
    let allLogs = [];
    
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const fixRot = autoFixRotation(schedule, month, year);
    if (fixRot.success) {
        schedule = fixRot.schedule;
        allLogs = [...allLogs, ...fixRot.logs];
    }

    const fixWeek = autoFixWeekendFairness(schedule, month, year, staffList);
    if (fixWeek.success) {
        schedule = fixWeek.schedule;
        allLogs = [...allLogs, ...fixWeek.logs];
    }

    const finalStats = staffList.map(s => {
        let roles = { tn: 0, tv: 0, kho: 0, gh: 0 };
        let totalH = 0;
        Object.values(schedule).forEach(dayList => {
            const assign = dayList.find(a => a.staffId === s.id);
            if (assign && assign.shift !== 'OFF') {
                if (assign.role === 'tn' || assign.role === 'TN' || assign.role === 'Thu Ngân') roles.tn++;
                else if (assign.role === 'kho' || assign.role === 'K' || assign.role === 'Kho') roles.kho++;
                else if (assign.role === 'gh' || assign.role === 'GH' || assign.role === 'Giao Hàng') roles.gh++;
                else roles.tv++;
            }
        });
        return { id: s.id, roles };
    });

    return { 
        optimizedSchedule: schedule, 
        changesLog: allLogs, 
        finalStats: finalStats 
    };
}

// 6. AUTO FIX FATIGUE (Rã ca nghiệp vụ liên tiếp 2 ngày)
export function autoFixFatigue(scheduleData, month, year) {
    let newSchedule = JSON.parse(JSON.stringify(scheduleData));
    let logs = [];
    let count = 0;

    const days = Object.keys(newSchedule).sort((a,b) => Number(a)-Number(b));
    
    for (let i = 1; i < days.length; i++) {
        const today = days[i];
        const prevDay = days[i-1];
        const nextDay = days[i+1];

        const todayAssigns = newSchedule[today];
        const prevAssigns = newSchedule[prevDay];
        
        let violators = todayAssigns.filter(a => {
            if (a.shift === 'OFF' || !isHardRole(a.role)) return false;
            const prevA = prevAssigns.find(p => p.staffId === a.staffId);
            return prevA && prevA.shift !== 'OFF' && isHardRole(prevA.role);
        });

        for (let violator of violators) {
            // Kiểm tra xem ca nghiệp vụ của người vi phạm có phải là Giao Hàng không
            const isGH = (violator.role === 'GH' || violator.role === 'Giao Hàng');

            let candidate = todayAssigns.find(c => {
                if (c.staffId === violator.staffId) return false;
                
                // [NEW FIX] Nếu ca bị trùng là Giao Hàng, thế thân BẮT BUỘC phải là Nam
                if (isGH && c.gender !== 'Nam') return false;

                if (c.shift !== 'OFF' && isHardRole(c.role)) return false;
                
                const cPrev = prevAssigns.find(p => p.staffId === c.staffId);
                if (cPrev && cPrev.shift !== 'OFF' && isHardRole(cPrev.role)) return false;

                if (nextDay) {
                    const cNext = newSchedule[nextDay].find(n => n.staffId === c.staffId);
                    if (cNext && cNext.shift !== 'OFF' && isHardRole(cNext.role)) return false;
                }
                return true;
            });

            if (candidate) {
                let tempShift = violator.shift;
                let tempRole = violator.role;
                
                violator.shift = candidate.shift;
                violator.role = candidate.role || 'TV';
                violator.isChanged = true;

                candidate.shift = tempShift;
                candidate.role = tempRole;
                candidate.isChanged = true;

                logs.push(`Ngày ${today}: Rã ca NV liên tiếp của [${violator.name}] sang cho [${candidate.name}]`);
                count++;
            }
        }
    }

    return { success: count > 0, schedule: newSchedule, logs, count };
}