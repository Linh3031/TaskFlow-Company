// src/lib/scheduleLogic.js

// 1. Cấu hình mặc định
export const DEFAULT_SHIFT_CONFIG = {
    shifts: [
        { code: '123', label: 'Ca 123 (Sáng)', qty: 6, hours: 8, color: 'bg-white text-gray-800 border' },
        { code: '456', label: 'Ca 456 (Chiều)', qty: 6, hours: 8, color: 'bg-gray-100 text-gray-800 border' },
        { code: '23', label: 'Ca 23 (Sáng Lửng)', qty: 5, hours: 4, color: 'bg-cyan-100 text-cyan-800' },
        { code: '45', label: 'Ca 45 (Chiều Lửng)', qty: 5, hours: 4, color: 'bg-blue-100 text-blue-800' },
        { code: '2-5', label: 'Ca 2-5 (Gãy)', qty: 3, hours: 8, color: 'bg-red-100 text-red-800' },
        { code: '2345', label: 'Ca 2345 (GH)', qty: 1, hours: 10, color: 'bg-red-600 text-white' }
    ],
    roles: { tn: 4, kho: 4 }
};

// 2. Tính toán Mode Ca từ Input C1-C6
export function calculateShiftModes(inputs, totalStaff) {
    let n123 = inputs.c1;
    let n456 = inputs.c6;
    let nGH = inputs.gh || 1;
    
    let n23 = Math.max(0, inputs.c3 - n123 - nGH);
    let n45 = Math.max(0, inputs.c4 - n456 - nGH);
    let n25 = Math.max(0, inputs.c2 - n123 - n23 - nGH);

    let totalSlots = n123 + n456 + n23 + n45 + n25 + nGH;
    let surplus = Math.max(0, totalStaff - totalSlots);
    
    // Phân bổ số dư để không ai bị OFF
    if (surplus > 0) {
        let remainder = surplus;
        while (remainder > 0) {
            n25++; remainder--; if (remainder === 0) break;
            n23++; remainder--; if (remainder === 0) break;
            n45++; remainder--; if (remainder === 0) break;
        }
    }

    return [
        { code: '123', qty: n123, hours: 8, color: 'bg-white text-gray-800 border' },
        { code: '456', qty: n456, hours: 8, color: 'bg-gray-100 text-gray-800 border' },
        { code: '23', qty: n23, hours: 4, color: 'bg-cyan-100 text-cyan-800' },
        { code: '45', qty: n45, hours: 4, color: 'bg-blue-100 text-blue-800' },
        { code: '2-5', qty: n25, hours: 8, color: 'bg-red-100 text-red-800' },
        { code: '2345', qty: nGH, hours: 10, color: 'bg-red-600 text-white' }
    ];
}

// 3. Hàm tạo lịch (Có tham số prevScheduleData để tiếp nối)
export function generateMonthlySchedule(staffList, computedShifts, roleConfig, month, year, prevScheduleData = null) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const schedule = {}; 
    
    // A. Tạo Pool Ca
    let masterPool = [];
    computedShifts.forEach(s => { for(let i=0; i<s.qty; i++) masterPool.push(s.code); });
    while(masterPool.length < staffList.length) masterPool.push('2-5'); // Fallback
    masterPool = masterPool.slice(0, staffList.length);

    // Sắp xếp MasterPool để tạo chuỗi Gen
    const order = ['123', '456', '23', '45', '2-5', '2345'];
    masterPool.sort((a,b) => order.indexOf(a) - order.indexOf(b));
    
    // Shuffle nhẹ để tránh cụm
    let half = Math.ceil(masterPool.length / 2);
    let firstHalf = masterPool.slice(0, half);
    let secondHalf = masterPool.slice(half);
    let shuffledPool = [];
    while(firstHalf.length > 0 || secondHalf.length > 0) {
        if(firstHalf.length) shuffledPool.push(firstHalf.shift());
        if(secondHalf.length) shuffledPool.push(secondHalf.shift());
    }
    masterPool = shuffledPool;

    // B. Xác định điểm xuất phát (Offset) & Stats Tích Lũy
    let startOffset = 0;
    let accumulatedStats = {}; // { staffId: { gh, tn, kho } }

    if (prevScheduleData) {
        // Tiếp nối offset
        startOffset = prevScheduleData.endOffset || 0;
        // Cộng dồn stats cũ để cân bằng
        if (prevScheduleData.stats) {
            prevScheduleData.stats.forEach(s => {
                accumulatedStats[s.id] = {
                    gh: s.gh || 0,
                    tn: s.tn || 0,
                    kho: s.kho || 0
                };
            });
        }
    }

    // Init Stats hiện tại
    staffList.forEach(s => {
        s.stats = { gh: 0, tn: 0, kho: 0, totalHours: 0 };
        if (!accumulatedStats[s.id]) accumulatedStats[s.id] = { gh:0, tn:0, kho:0 };
    });

    // C. Vòng lặp ngày
    for (let d = 1; d <= daysInMonth; d++) {
        // Logic tiếp nối: (StartOffset + CurrentDay)
        let currentOffset = (startOffset + d) % staffList.length;
        
        let dayShifts = [
            ...masterPool.slice(masterPool.length - currentOffset),
            ...masterPool.slice(0, masterPool.length - currentOffset)
        ];

        let dailyAssign = staffList.map((s, i) => ({
            staffId: s.id, name: s.name, gender: s.gender,
            shift: dayShifts[i], role: '', hours: 0
        }));

        // Logic GH (Ưu tiên Nam + Cân bằng tích lũy)
        let ghIndex = dailyAssign.findIndex(x => x.shift === '2345');
        if(ghIndex !== -1) {
            let holder = dailyAssign[ghIndex];
            let males = dailyAssign.filter(x => x.gender === 'Nam');
            
            // Sort theo tổng (Quá khứ + Hiện tại)
            males.sort((a,b) => {
                let sA = staffList.find(s=>s.id===a.staffId);
                let sB = staffList.find(s=>s.id===b.staffId);
                let totalA = accumulatedStats[a.staffId].gh + sA.stats.gh;
                let totalB = accumulatedStats[b.staffId].gh + sB.stats.gh;
                return totalA - totalB;
            });
            
            let bestMale = males[0];
            if (bestMale && holder.staffId !== bestMale.staffId) {
                let temp = bestMale.shift; bestMale.shift = '2345'; dailyAssign[ghIndex].shift = temp;
            }
            if (bestMale) {
                bestMale.role = 'GH'; 
                staffList.find(s=>s.id===bestMale.staffId).stats.gh++;
            } else { holder.role = 'GH'; }
        }

        // Logic Role (TN/Kho) - Cân bằng tích lũy
        let tnS = Math.ceil(roleConfig.tn / 2), tnC = roleConfig.tn - tnS;
        let khoS = Math.ceil(roleConfig.kho / 2), khoC = roleConfig.kho - khoS;

        assignRole(dailyAssign, ['123', '23'], 'TN', tnS, staffList, accumulatedStats);
        assignRole(dailyAssign, ['123', '23'], 'Kho', khoS, staffList, accumulatedStats);
        assignRole(dailyAssign, ['456', '45'], 'TN', tnC, staffList, accumulatedStats);
        assignRole(dailyAssign, ['456', '45'], 'Kho', khoC, staffList, accumulatedStats);

        // Tính giờ
        dailyAssign.forEach(item => {
            const sInfo = computedShifts.find(s => s.code === item.shift);
            if(sInfo) {
                item.hours = sInfo.hours;
                staffList.find(s=>s.id === item.staffId).stats.totalHours += sInfo.hours;
            }
        });
        schedule[d] = dailyAssign;
    }

    // D. Anti-Duplicate (Chống lặp ca 2 ngày)
    for(let d=2; d<=daysInMonth; d++) {
        let today = schedule[d];
        let yesterday = schedule[d-1];
        today.forEach(curr => {
            if (curr.shift === '2345') return;
            let prev = yesterday.find(x => x.staffId === curr.staffId);
            if (prev && prev.shift === curr.shift) {
                let candidate = today.find(c => c.shift !== curr.shift && c.shift !== '2345' && c.staffId !== curr.staffId);
                if (candidate) {
                    let temp = curr.shift; curr.shift = candidate.shift; candidate.shift = temp;
                }
            }
        });
    }

    // Tính điểm kết thúc để lưu cho tháng sau
    const endOffset = (startOffset + daysInMonth) % staffList.length;

    return { schedule, staffStats: staffList, endOffset };
}

function assignRole(dayList, shiftCodes, role, count, globalStaff, accStats) {
    let candidates = dayList.filter(x => shiftCodes.includes(x.shift) && x.role === '');
    candidates.sort((a,b) => {
        let k = role.toLowerCase();
        let totalA = (accStats[a.staffId][k] || 0) + globalStaff.find(s=>s.id===a.staffId).stats[k];
        let totalB = (accStats[b.staffId][k] || 0) + globalStaff.find(s=>s.id===b.staffId).stats[k];
        return totalA - totalB;
    });
    for(let i=0; i<count && i<candidates.length; i++) {
        candidates[i].role = role;
        globalStaff.find(s=>s.id===candidates[i].staffId).stats[role.toLowerCase()]++;
    }
}