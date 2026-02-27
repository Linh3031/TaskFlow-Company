// src/lib/comboCalculator.js

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