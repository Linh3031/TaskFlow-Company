// src/lib/optimization.js
// Version 33.0 - Fix Lazy Search Logic in Gender Balance

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

// 1. AUTO FIX ROTATION (GIỮ NGUYÊN)
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

// 2. AUTO FIX WEEKEND FAIRNESS (GIỮ NGUYÊN)
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

// 3. AUTO FIX GENDER (NÂNG CẤP VÒNG LẶP SÂU)
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

        // Gom nhóm Kho
        const shiftGroups = {};
        todayAssigns.forEach((assign, idx) => {
            if (assign.shift === 'OFF') return;
            if (!shiftGroups[assign.shift]) shiftGroups[assign.shift] = { males: [], females: [], code: assign.shift };
            
            if (assign.role === 'Kho') {
                if (assign.gender === 'Nam') shiftGroups[assign.shift].males.push({ ...assign, idx });
                else shiftGroups[assign.shift].females.push({ ...assign, idx });
            }
        });

        // Tìm ca thiếu Nam (Chỉ có Nữ) và ca Dư Nam (Có >= 1 Nam)
        let lackMaleShifts = Object.values(shiftGroups).filter(g => g.males.length === 0 && g.females.length >= 1);
        let richMaleShifts = Object.values(shiftGroups).filter(g => g.males.length >= 1);

        // Duyệt qua từng ca thiếu Nam
        lackMaleShifts.forEach(badShift => {
            let fixed = false;

            // CHIẾN THUẬT 1: ĐỔI NỘI BỘ (Nam Kho ca khác -> Nữ Kho ca này)
            // Duyệt qua tất cả các ca Dư Nam
            for (let targetRich of richMaleShifts) {
                if (targetRich.code === badShift.code || fixed) continue;

                // VÒNG LẶP SÂU: Duyệt qua TẤT CẢ ứng viên Nam trong ca đó
                for (let maleCandidate of targetRich.males) {
                    if (fixed) break; // Đã sửa được thì thôi

                    const femaleCandidate = badShift.females[0]; // Lấy 1 bạn nữ ra đổi

                    // Check xung đột xoay ca
                    const prevMale = prevAssigns.find(p => p.staffId === maleCandidate.staffId);
                    const prevFemale = prevAssigns.find(p => p.staffId === femaleCandidate.staffId);

                    let conflictM = prevMale ? hasRotationConflict(prevMale.shift, badShift.code) : false;
                    let conflictF = prevFemale ? hasRotationConflict(prevFemale.shift, targetRich.code) : false;

                    if (conflictM || conflictF) {
                        if (!forceFix) {
                            conflictWarnings.push(`Ngày ${todayKey}: Đổi ${maleCandidate.name} (Kho) gây lỗi xoay ca.`);
                            continue; // Bỏ qua ông này, thử ông tiếp theo
                        }
                    }

                    // Thực hiện đổi
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
                    // Cập nhật lại array tạm để không lấy lại người này (Đơn giản hóa)
                    targetRich.males = targetRich.males.filter(m => m.staffId !== maleCandidate.staffId);
                }
            }

            // CHIẾN THUẬT 2: MƯỢN BINH TỪ TƯ VẤN (Nếu nội bộ bó tay)
            if (!fixed) {
                const maleTroops = todayAssigns.filter(a => a.role === 'TV' && a.gender === 'Nam' && a.shift !== 'OFF');
                
                for (let soldier of maleTroops) {
                    if (fixed) break;
                    
                    const femaleTarget = badShift.females[0];
                    const prevSoldier = prevAssigns.find(p => p.staffId === soldier.staffId);
                    // Lính nhận ca của Nữ Kho
                    const conflict = prevSoldier ? hasRotationConflict(prevSoldier.shift, femaleTarget.shift) : false;

                    if (conflict && !forceFix) {
                        conflictWarnings.push(`Ngày ${todayKey}: Mượn ${soldier.name} (TV) gây lỗi xoay ca.`);
                        continue;
                    }

                    // Đổi
                    const idxS = todayAssigns.findIndex(x => x.staffId === soldier.staffId);
                    const idxF = femaleTarget.idx; // Lưu ý idx này là index trong todayAssigns (đã map ở trên)

                    const shiftS = schedule[todayKey][idxS].shift;
                    
                    schedule[todayKey][idxS].shift = schedule[todayKey][idxF].shift;
                    schedule[todayKey][idxS].role = 'Kho';
                    schedule[todayKey][idxS].isChanged = true;

                    schedule[todayKey][idxF].shift = shiftS;
                    schedule[todayKey][idxF].role = 'TV';
                    schedule[todayKey][idxF].isChanged = true;

                    logs.push(`Ngày ${todayKey}: Điều động ${soldier.name} từ TV sang Kho.`);
                    fixedCount++;
                    fixed = true;
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

export function optimizeSchedule(scheduleData, staffList) { 
    return { optimizedSchedule: scheduleData, changesLog: [], finalStats: [] }; 
}