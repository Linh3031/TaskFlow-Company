// src/lib/smartSwap.js
export function findSmartSwap(scheduleData, staffList, staffAId, staffBId, bridgeStaffIds, targetRoleStr, genderConfig, month, year, currentStats) {
    const days = Object.keys(scheduleData).map(Number).sort((a, b) => a - b);
    const staffA = staffList.find(s => s.id === staffAId);
    const staffB = staffList.find(s => s.id === staffBId);
    if (!staffA || !staffB) return [];

    const getRole = (r) => {
        if (!r) return 'TV';
        let norm = r.toLowerCase();
        if (norm.includes('gh') || norm.includes('giao')) return 'GH';
        if (norm.includes('tn') || norm.includes('thu')) return 'TN';
        if (norm.includes('k')) return 'Kho';
        return 'TV';
    };

    const isWeekend = (d) => {
        const day = new Date(year, month - 1, d).getDay();
        return day === 0 || day === 6;
    };

    const isHard = (r) => ['GH', 'TN', 'Kho'].includes(getRole(r));

    // Luật Giới Tính cốt lõi
    const canTakeRole = (staff, role) => {
        if (role === 'GH' && staff.gender !== 'Nam') return false;
        if (role === 'Kho' && genderConfig?.kho === 'male_only' && staff.gender !== 'Nam') return false;
        if (role === 'TN' && genderConfig?.tn === 'female_only' && staff.gender === 'Nam') return false;
        return true;
    };

    // Luật Chống Mệt Mỏi (Không làm nghiệp vụ 2 ngày liên tiếp)
    const checkFatigue = (staffId, day, newRole) => {
        if (!isHard(newRole)) return true; 
        let prevDay = scheduleData[day - 1]?.find(x => x.staffId === staffId);
        let nextDay = scheduleData[day + 1]?.find(x => x.staffId === staffId);
        if (prevDay && isHard(prevDay.role)) return false;
        if (nextDay && isHard(nextDay.role)) return false;
        return true;
    };

    let solutions = [];

    // Tính toán Bức tranh tổng quan (Impact)
    const calculateImpact = (plan) => {
        let impact = {};
        const initImpact = (id, name) => { 
            if(!impact[id]) impact[id] = { name, gh: 0, tn: 0, kho: 0, weekend: 0 }; 
        };
        
        plan.forEach(step => {
            initImpact(step.staff1.id, step.staff1.name);
            initImpact(step.staff2.id, step.staff2.name);
            
            let r1 = getRole(step.role1); let r2 = getRole(step.role2);
            let isW = isWeekend(step.day);

            // S1 mất r1, nhận r2
            if(r1 === 'GH') impact[step.staff1.id].gh -= 1; if(r1 === 'TN') impact[step.staff1.id].tn -= 1; if(r1 === 'Kho') impact[step.staff1.id].kho -= 1;
            if(r2 === 'GH') impact[step.staff1.id].gh += 1; if(r2 === 'TN') impact[step.staff1.id].tn += 1; if(r2 === 'Kho') impact[step.staff1.id].kho += 1;
            if(isW) { if(isHard(r1) && !isHard(r2)) impact[step.staff1.id].weekend -= 1; if(!isHard(r1) && isHard(r2)) impact[step.staff1.id].weekend += 1; }

            // S2 mất r2, nhận r1
            if(r2 === 'GH') impact[step.staff2.id].gh -= 1; if(r2 === 'TN') impact[step.staff2.id].tn -= 1; if(r2 === 'Kho') impact[step.staff2.id].kho -= 1;
            if(r1 === 'GH') impact[step.staff2.id].gh += 1; if(r1 === 'TN') impact[step.staff2.id].tn += 1; if(r1 === 'Kho') impact[step.staff2.id].kho += 1;
            if(isW) { if(isHard(r2) && !isHard(r1)) impact[step.staff2.id].weekend -= 1; if(!isHard(r2) && isHard(r1)) impact[step.staff2.id].weekend += 1; }
        });
        return Object.values(impact).filter(i => i.gh !== 0 || i.tn !== 0 || i.kho !== 0 || i.weekend !== 0);
    };

    const isTargetRole = (role, day) => {
        if (targetRoleStr === 'ANY_HARD') return isHard(role);
        if (targetRoleStr === 'Weekend') return isWeekend(day) && isHard(role);
        return getRole(role) === targetRoleStr;
    };

    // --- BƯỚC 1: QUÉT ĐỔI TRỰC TIẾP (1-1) ---
    for (let d of days) {
        let aA = scheduleData[d].find(x => x.staffId === staffAId);
        let aB = scheduleData[d].find(x => x.staffId === staffBId);
        if (!aA || !aB) continue; // Đã bỏ chặn ca OFF

        if (!isTargetRole(aA.role, d)) continue;
        if (isHard(aB.role)) continue; // B đang làm ca Khó rồi thì không gánh thêm được trong cùng 1 ngày
        
        let roleA_clean = getRole(aA.role);
        
        if (!canTakeRole(staffB, roleA_clean)) continue;
        if (!checkFatigue(staffBId, d, roleA_clean)) continue;

        let plan = [{ day: d, staff1: staffA, staff2: staffB, role1: aA.role, role2: aB.role, shift1: aA.shift, shift2: aB.shift }];
        solutions.push({ id: `direct-${d}`, type: 'Đổi Trực tiếp (1-1)', plan, impact: calculateImpact(plan) });
    }

    // --- BƯỚC 2: QUÉT ĐỔI BẮC CẦU QUA TRẠM C ---
    if (bridgeStaffIds && bridgeStaffIds.length > 0) {
        let bridgeStaffs = staffList.filter(s => bridgeStaffIds.includes(s.id) && s.id !== staffAId && s.id !== staffBId);
        
        for (let d1 of days) {
            let aA_d1 = scheduleData[d1].find(x => x.staffId === staffAId);
            if (!aA_d1 || !isTargetRole(aA_d1.role, d1)) continue;
            let roleA_clean = getRole(aA_d1.role);

            for (let d2 of days) {
                if (d1 === d2) continue;
                let aB_d2 = scheduleData[d2].find(x => x.staffId === staffBId);
                // Ngày d2 B phải rảnh (làm TV/OFF) để nhận ca
                if (!aB_d2 || isHard(aB_d2.role)) continue;

                for (let staffC of bridgeStaffs) {
                    let aC_d1 = scheduleData[d1].find(x => x.staffId === staffC.id);
                    let aC_d2 = scheduleData[d2].find(x => x.staffId === staffC.id);
                    if (!aC_d1 || !aC_d2) continue;

                    // Ngày d1: C phải rảnh (Làm TV/OFF) để nhận ca Khó của A
                    if (isHard(aC_d1.role)) continue;
                    // Ngày d2: C đang có sẵn 1 ca Khó để ném cho B
                    if (!isHard(aC_d2.role)) continue;
                    let roleC_clean = getRole(aC_d2.role);

                    // Kiểm tra Rule Giới tính chéo
                    if (!canTakeRole(staffC, roleA_clean)) continue; // C không nhận được ca của A
                    if (!canTakeRole(staffB, roleC_clean)) continue; // B không nhận được ca của C

                    // Kiểm tra Mệt mỏi chéo
                    if (!checkFatigue(staffC.id, d1, roleA_clean)) continue;
                    if (!checkFatigue(staffB.id, d2, roleC_clean)) continue;

                    let plan = [
                        { day: d1, staff1: staffA, staff2: staffC, role1: aA_d1.role, role2: aC_d1.role, shift1: aA_d1.shift, shift2: aC_d1.shift },
                        { day: d2, staff1: staffC, staff2: staffB, role1: aC_d2.role, role2: aB_d2.role, shift1: aC_d2.shift, shift2: aB_d2.shift }
                    ];
                    solutions.push({ id: `bridge-${d1}-${d2}-${staffC.id}`, type: `Bắc cầu qua ${staffC.name}`, plan, impact: calculateImpact(plan) });
                    if (solutions.length >= 25) break; 
                }
                if (solutions.length >= 25) break;
            }
            if (solutions.length >= 25) break;
        }
    }

    return solutions.sort((a, b) => a.plan.length - b.plan.length);
}