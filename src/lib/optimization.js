// src/lib/optimization.js
// Version 2.0 - Aggressive Balancing Logic (Desperation Mode)

const ROLE_MAP_REV = {
    'Thu Ngân': 'tn', 'Kho': 'kho', 'Giao Hàng': 'gh', '': 'tv'
};
const HARD_ROLES = ['tn', 'kho', 'gh'];

function isHardRole(roleName) {
    const code = ROLE_MAP_REV[roleName] || 'tv';
    return HARD_ROLES.includes(code);
}

function getShiftGroup(code) {
    if (['123', '23'].includes(code)) return 'SANG';
    if (['456', '45'].includes(code)) return 'CHIEU';
    return 'OFF';
}

function isValidRotation(prevShift, newShift) {
    if (!prevShift || prevShift === 'OFF' || !newShift || newShift === 'OFF') return true;
    const gA = getShiftGroup(prevShift);
    const gB = getShiftGroup(newShift);
    if (gA === gB && gA !== 'OFF') return false;
    return true;
}

export function optimizeSchedule(scheduleData, staffList) {
    let optimizedSchedule = JSON.parse(JSON.stringify(scheduleData));
    let changesLog = [];
    
    const staffStats = {};
    staffList.forEach(s => staffStats[s.id] = { id: s.id, name: s.name, isMale: s.gender === 'Nam', roles: { tn: 0, kho: 0, gh: 0 } });
    
    // Tái tạo Stats hiện tại
    Object.keys(optimizedSchedule).forEach(day => {
        optimizedSchedule[day].forEach(assign => {
            const rCode = ROLE_MAP_REV[assign.role] || 'tv';
            if (staffStats[assign.staffId] && HARD_ROLES.includes(rCode)) {
                staffStats[assign.staffId].roles[rCode]++;
            }
        });
    });

    // 2. Chạy tối ưu (Loop nhiều lần để ép cân bằng)
    ['gh', 'kho', 'tn'].forEach(targetRole => {
        let roleName = targetRole === 'gh' ? 'Giao Hàng' : (targetRole === 'tn' ? 'Thu Ngân' : 'Kho');
        
        // Loop tối đa 50 lần để tránh infinite loop
        for (let loop = 0; loop < 50; loop++) {
            let counts = Object.values(staffStats).map(s => s.roles[targetRole]);
            let maxVal = Math.max(...counts);
            let minVal = Math.min(...counts);

            // NẾU CHÊNH LỆCH <= 1 THÌ DỪNG (ĐÃ CÂN BẰNG)
            if (maxVal - minVal <= 1) break;

            // Tìm Donor (người làm nhiều nhất) và Receiver (người làm ít nhất)
            let donor = Object.values(staffStats).find(s => s.roles[targetRole] === maxVal && (targetRole !== 'gh' || s.isMale));
            let receiver = Object.values(staffStats).find(s => s.roles[targetRole] === minVal && (targetRole !== 'gh' || s.isMale));

            if (!donor || !receiver) break;

            let bestDay = null;
            let bestScore = -Infinity;

            const days = Object.keys(optimizedSchedule).sort((a,b)=>Number(a)-Number(b));
            for (let dStr of days) {
                let d = parseInt(dStr);
                let donorAssign = optimizedSchedule[d].find(a => a.staffId === donor.id);
                let receiverAssign = optimizedSchedule[d].find(a => a.staffId === receiver.id);

                if (ROLE_MAP_REV[donorAssign.role] !== targetRole) continue;
                if (isHardRole(receiverAssign.role)) continue; // Receiver phải rảnh

                let score = 0;
                
                // Quy tắc Xoay Ca (Fatigue)
                let prevAssign = d > 1 ? optimizedSchedule[d-1].find(a => a.staffId === receiver.id) : null;
                let nextAssign = d < days.length ? optimizedSchedule[d+1].find(a => a.staffId === receiver.id) : null;
                
                let violation = false;
                if (prevAssign && !isValidRotation(prevAssign.shift, donorAssign.shift)) violation = true;
                if (nextAssign && !isValidRotation(donorAssign.shift, nextAssign.shift)) violation = true;

                if (violation) score -= 2000;

                // CHẾ ĐỘ QUYẾT LIỆT (DESPERATION MODE)
                // Nếu chênh lệch quá lớn (>2), ta chấp nhận vi phạm luật xoay ca để ưu tiên cân bằng
                if (maxVal - minVal > 2) {
                    score += 3000; // Bonus cực lớn để override hình phạt
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestDay = d;
                }
            }

            if (bestDay) {
                let dayKey = String(bestDay);
                let dAssign = optimizedSchedule[dayKey].find(a => a.staffId === donor.id);
                let rAssign = optimizedSchedule[dayKey].find(a => a.staffId === receiver.id);

                let tempShift = dAssign.shift;
                let tempRole = dAssign.role;

                dAssign.shift = rAssign.shift;
                dAssign.role = rAssign.role;
                dAssign.isChanged = true;

                rAssign.shift = tempShift;
                rAssign.role = tempRole;
                rAssign.isChanged = true;

                staffStats[donor.id].roles[targetRole]--;
                staffStats[receiver.id].roles[targetRole]++;
                
                changesLog.push(`Ngày ${bestDay}: Chuyển ${roleName} từ ${donor.name} sang ${receiver.name} (Force Balance)`);
            } else {
                break; 
            }
        }
    });

    return { optimizedSchedule, changesLog, finalStats: Object.values(staffStats) };
}