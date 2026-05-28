// src/lib/smartCover.js

export function buildSmartCover(target, scheduleData) {
    // Helper nhận diện ca nghiệp vụ (Hard Role)
    const isHardRole = (r) => {
        if (!r) return false;
        let norm = r.toLowerCase();
        return norm.includes('gh') || norm.includes('giao') || 
               norm.includes('tn') || norm.includes('thu') || 
               norm.includes('k'); // Bao gồm 'kho', 'k'
    };

    // [YÊU CẦU 1] Chặn tự động nếu nhân viên OFF đang nắm ca Nghiệp vụ (để Admin tự làm tay)
    if (isHardRole(target.originalRole)) {
        return []; 
    }

    // Loại bỏ nhân viên OFF, nhân viên hiện tại, VÀ nhân viên đang nắm ca Nghiệp Vụ trong ngày đó
    let dayAssigns = scheduleData.data[target.day].filter(a => 
        a.staffId !== target.staffId && 
        a.shift !== 'OFF' &&
        !isHardRole(a.role)
    );
    
    let stats = scheduleData.stats;

    // [YÊU CẦU 4] Ưu tiên người đang có tổng giờ công thấp nhất lên đầu
    dayAssigns.sort((a, b) => {
        let hA = stats.find(s => s.id === a.staffId)?.totalHours || 0;
        let hB = stats.find(s => s.id === b.staffId)?.totalHours || 0;
        return hA - hB;
    });

    let suggestions = [];
    
    // Truy thẳng vào dữ liệu thật của ngày hôm đó để xem ca NGAY TRƯỚC KHI BẤM OFF là gì
    let realAssignInDB = scheduleData.data[target.day].find(a => a.staffId === target.staffId);
    let offShift = realAssignInDB ? realAssignInDB.shift : target.originalShift;

    if (offShift === 'OFF') return []; 

    const addSugg = (type, title, acts) => suggestions.push({ type, title, actions: acts });

    // [YÊU CẦU 2 & 3] Bẻ ca 123
    if (offShift === '123') {
        // Tìm người đang làm 23 để nhận cục 1 (Thành 123)
        let takeOneList = dayAssigns.filter(a => a.shift === '23'); 
        // Tìm người đang làm 45 để nhận cục 23 (Thành 2345)
        let takeTwentyThreeList = dayAssigns.filter(a => a.shift === '45'); 

        takeOneList.forEach(taker1 => {
            takeTwentyThreeList.forEach(taker23 => {
                if (taker1.staffId !== taker23.staffId) {
                    addSugg('chain', `Ghép ca 1 cho ${taker1.name}, ghép ca 23 cho ${taker23.name}`, [
                        { staffId: taker1.staffId, name: taker1.name, oldShift: taker1.shift, newShift: '123', role: taker1.role },
                        { staffId: taker23.staffId, name: taker23.name, oldShift: taker23.shift, newShift: '2345', role: target.originalRole }
                    ]);
                }
            });
        });
    }
    // [YÊU CẦU 2 & 3] Bẻ ca 456
    else if (offShift === '456') {
        // Tìm người đang làm 45 để nhận cục 6 (Thành 456)
        let takeSixList = dayAssigns.filter(a => a.shift === '45');
        // Tìm người đang làm 23 để nhận cục 45 (Thành 2345)
        let takeFortyFiveList = dayAssigns.filter(a => a.shift === '23'); 
        
        takeSixList.forEach(taker6 => {
            takeFortyFiveList.forEach(taker45 => {
                if (taker6.staffId !== taker45.staffId) {
                    addSugg('chain', `Ghép ca 6 cho ${taker6.name}, ghép ca 45 cho ${taker45.name}`, [
                        { staffId: taker6.staffId, name: taker6.name, oldShift: taker6.shift, newShift: '456', role: taker6.role },
                        { staffId: taker45.staffId, name: taker45.name, oldShift: taker45.shift, newShift: '2345', role: target.originalRole }
                    ]);
                }
            });
        });
    }
    // Logic ghép thẳng khi OFF ca ngắn (23 hoặc 45) -> Ghép thành 2345 (Không tạo 12345 hay 23456)
    else if (offShift === '23') {
        let takers = dayAssigns.filter(a => a.shift === '45');
        takers.forEach(taker => addSugg('direct', `Ghép ca 23 cho ${taker.name}`, [
            { staffId: taker.staffId, name: taker.name, oldShift: taker.shift, newShift: '2345', role: target.originalRole }
        ]));
    }
    else if (offShift === '45') {
        let takers = dayAssigns.filter(a => a.shift === '23');
        takers.forEach(taker => addSugg('direct', `Ghép ca 45 cho ${taker.name}`, [
            { staffId: taker.staffId, name: taker.name, oldShift: taker.shift, newShift: '2345', role: target.originalRole }
        ]));
    }
    
    return suggestions.slice(0, 5);
}

export function applySmartCoverActions(actions, scheduleData, editingShift) {
    const dayKey = String(editingShift.day);
    const dayList = [...scheduleData.data[dayKey]];
    const newStats = [...scheduleData.stats];

    const tIdx = dayList.findIndex(x => x.staffId === editingShift.staffId);
    if (tIdx > -1) {
        const oldRole = dayList[tIdx].role;
        dayList[tIdx] = { ...dayList[tIdx], shift: 'OFF', role: '' };

        let rOld = ['GH', 'Giao Hàng'].includes(oldRole) ? 'gh' : (['TN', 'Thu Ngân'].includes(oldRole) ? 'tn' : (['K', 'Kho'].includes(oldRole) ? 'kho' : ''));
        const sIdx = newStats.findIndex(s => s.id === editingShift.staffId);
        if (rOld && sIdx > -1) newStats[sIdx][rOld] = Math.max(0, (newStats[sIdx][rOld]||0) - 1);
    }

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

    return { dayKey, dayList, newStats };
}