// src/lib/smartCover.js

export function buildSmartCover(target, scheduleData) {
    let dayAssigns = scheduleData.data[target.day].filter(a => a.staffId !== target.staffId && a.shift !== 'OFF');
    let stats = scheduleData.stats;

    // Sắp xếp ưu tiên người đang có tổng giờ công thấp nhất (Đói ca)
    dayAssigns.sort((a, b) => {
        let hA = stats.find(s => s.id === a.staffId)?.totalHours || 0;
        let hB = stats.find(s => s.id === b.staffId)?.totalHours || 0;
        return hA - hB;
    });

    let suggestions = [];
    
    // [CodeGenesis] Phẫu Thuật Trực Tiếp: 
    // Truy thẳng vào dữ liệu thật của ngày hôm đó để xem ca NGAY TRƯỚC KHI BẤM OFF là gì.
    let realAssignInDB = scheduleData.data[target.day].find(a => a.staffId === target.staffId);
    let offShift = realAssignInDB ? realAssignInDB.shift : target.originalShift;

    if (offShift === 'OFF') return []; 

    const addSugg = (type, title, acts) => suggestions.push({ type, title, actions: acts });

    if (offShift === '123') {
        let bList = dayAssigns.filter(a => a.shift === '23');
        let cList = dayAssigns.filter(a => ['45', '456'].includes(a.shift));
        bList.forEach(b => {
            cList.forEach(c => {
                if (b.staffId !== c.staffId) {
                    addSugg('chain', `Đẩy ca 1 cho ${b.name}, ghép ${c.shift} cho ${c.name}`, [
                        { staffId: b.staffId, name: b.name, oldShift: b.shift, newShift: '123', role: target.originalRole },
                        { staffId: c.staffId, name: c.name, oldShift: c.shift, newShift: c.shift === '45' ? '2345' : '23456', role: b.role }
                    ]);
                }
            });
        });
        let dList = dayAssigns.filter(a => ['45', '456'].includes(a.shift));
        dList.forEach(d => {
            addSugg('direct', `Ghép thẳng 123 cho ${d.name}`, [
                { staffId: d.staffId, name: d.name, oldShift: d.shift, newShift: d.shift === '45' ? '12345' : '123456', role: target.originalRole }
            ]);
        });
    }
    else if (offShift === '456') {
        let bList = dayAssigns.filter(a => a.shift === '45');
        let cList = dayAssigns.filter(a => ['23', '123'].includes(a.shift));
        bList.forEach(b => {
            cList.forEach(c => {
                if (b.staffId !== c.staffId) {
                    addSugg('chain', `Đẩy ca 6 cho ${b.name}, ghép ${c.shift} cho ${c.name}`, [
                        { staffId: b.staffId, name: b.name, oldShift: b.shift, newShift: '456', role: target.originalRole },
                        { staffId: c.staffId, name: c.name, oldShift: c.shift, newShift: c.shift === '23' ? '2345' : '12345', role: b.role }
                    ]);
                }
            });
        });
        let dList = dayAssigns.filter(a => ['23', '123'].includes(a.shift));
        dList.forEach(d => {
            addSugg('direct', `Ghép thẳng 456 cho ${d.name}`, [
                { staffId: d.staffId, name: d.name, oldShift: d.shift, newShift: d.shift === '23' ? '23456' : '123456', role: target.originalRole }
            ]);
        });
    }
    else if (offShift === '23') {
        let dList = dayAssigns.filter(a => ['45', '456'].includes(a.shift));
        dList.forEach(d => addSugg('direct', `Ghép ca 23 cho ${d.name}`, [{ staffId: d.staffId, name: d.name, oldShift: d.shift, newShift: d.shift === '45' ? '2345' : '23456', role: target.originalRole }]));
    }
    else if (offShift === '45') {
        let dList = dayAssigns.filter(a => ['23', '123'].includes(a.shift));
        dList.forEach(d => addSugg('direct', `Ghép ca 45 cho ${d.name}`, [{ staffId: d.staffId, name: d.name, oldShift: d.shift, newShift: d.shift === '23' ? '2345' : '12345', role: target.originalRole }]));
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