// src/lib/installmentUtils.js

export const parseNumber = (str) => Number(String(str).replace(/[^0-9]/g, '')) || 0;

export const formatFull = (val) => {
    if (!val || isNaN(val)) return '0';
    return Math.round(val).toLocaleString('vi-VN');
};

export const formatCompact = (val) => {
    if (!val || isNaN(val) || val === 0) return '0đ';
    if (val < 1000000) {
        return Math.round(val / 1000) + 'K';
    } else {
        const tr = Math.floor(val / 1000000);
        const rem = Math.round((val % 1000000) / 1000);
        return rem > 0 ? `${tr} tr ${rem}` : `${tr} tr`;
    }
};

// ĐÃ PHẪU THUẬT: Cập nhật lại logic tính BH 1-1 theo chuẩn mới
export const calculateBH11 = (group, p) => {
    if (group === 'none' || p === 0) return 0;
    
    // Nhóm phí Min 200.000đ
    if (group === 'phone') { 
        const fee = p * 0.0462; 
        return fee < 200000 ? 200000 : fee; 
    }
    if (group === 'laptop_tablet') { 
        const fee = p * 0.06; 
        return fee < 200000 ? 200000 : fee; 
    }
    
    // Nhóm phí Min 100.000đ
    if (['water_purifier', 'home_appliances', 'speaker'].includes(group)) {
        const fee = p * 0.06;
        return fee < 100000 ? 100000 : fee;
    }
    
    // Nhóm KHÔNG có phí Min
    if (['fridge_freezer', 'washer_dryer', 'ac'].includes(group)) {
        return p * 0.06;
    }
    if (group === 'tv') return p * 0.07;
    
    return 0;
};

// Hàm tra cứu khoảng giá cho BHMR
function getRate(price, ratesArray) {
    const tier = ratesArray.find(r => price > r.min && price <= r.max);
    return tier ? tier.fee : 0;
}

// MA TRẬN TÍNH GIÁ BẢO HIỂM MỞ RỘNG (Đồng bộ 100% từ CSV)
export const calculateBHMR = (category, isDMX, years, price) => {
    if (category === 'none' || !price || price <= 0) return 0;
    
    if (isDMX) {
        // [FIXED] Tách riêng nhóm Apple khi chọn gói ĐMX, áp dụng giá chung 590k
        if (category === 'apple') {
            return 590000;
        }
        
        // Nhóm smartphone khác vẫn tính theo khung giá cũ
        if (category === 'phone') {
            if (years === 1) return getRate(price, [
                { min: 0, max: 3000000, fee: 80000 },
                { min: 3000000, max: 5000000, fee: 260000 },
                { min: 5000000, max: 10000000, fee: 470000 },
                { min: 10000000, max: 15000000, fee: 640000 },
                { min: 15000000, max: 20000000, fee: 900000 },
                { min: 20000000, max: 30000000, fee: 1330000 },
                { min: 30000000, max: 50000000, fee: 2140000 }
            ]);
            return 0; 
        }
        if (['tivi', 'fridge', 'ac', 'washer'].includes(category)) {
            if (years === 1) return getRate(price, [
                { min: 0, max: 5000000, fee: 190000 }, { min: 5000000, max: 10000000, fee: 340000 },
                { min: 10000000, max: 15000000, fee: 520000 }, { min: 15000000, max: 20000000, fee: 750000 },
                { min: 20000000, max: 25000000, fee: 930000 }, { min: 25000000, max: 30000000, fee: 1050000 },
                { min: 30000000, max: 40000000, fee: 1340000 }, { min: 40000000, max: 50000000, fee: 1700000 },
                { min: 50000000, max: 100000000, fee: 2590000 }
            ]);
            if (years === 2) return getRate(price, [
                { min: 0, max: 5000000, fee: 370000 }, { min: 5000000, max: 10000000, fee: 650000 },
                { min: 10000000, max: 15000000, fee: 1010000 }, { min: 15000000, max: 20000000, fee: 1420000 },
                { min: 20000000, max: 25000000, fee: 1860000 }, { min: 25000000, max: 30000000, fee: 2030000 },
                { min: 30000000, max: 40000000, fee: 2550000 }, { min: 40000000, max: 50000000, fee: 3240000 }
            ]);
            if (years === 3) return getRate(price, [
                { min: 0, max: 5000000, fee: 590000 }, { min: 5000000, max: 10000000, fee: 1040000 },
                { min: 10000000, max: 15000000, fee: 1620000 }, { min: 15000000, max: 20000000, fee: 2270000 },
                { min: 20000000, max: 25000000, fee: 2980000 }, { min: 25000000, max: 30000000, fee: 3250000 },
                { min: 30000000, max: 40000000, fee: 4080000 }, { min: 40000000, max: 50000000, fee: 5190000 }
            ]);
        }
    } 
    else {
        if (category === 'phone' || category === 'apple') {
            if (years === 1) return getRate(price, [
                { min: 0, max: 2000000, fee: 90000 }, { min: 2000000, max: 5000000, fee: 300000 },
                { min: 5000000, max: 10000000, fee: 550000 }, { min: 10000000, max: 15000000, fee: 750000 },
                { min: 15000000, max: 20000000, fee: 1050000 }, { min: 20000000, max: 25000000, fee: 1250000 }
            ]);
            if (years === 2) return getRate(price, [
                { min: 0, max: 2000000, fee: 170000 }, { min: 2000000, max: 5000000, fee: 570000 },
                { min: 5000000, max: 10000000, fee: 1050000 }, { min: 10000000, max: 15000000, fee: 1450000 },
                { min: 15000000, max: 20000000, fee: 2000000 }, { min: 20000000, max: 25000000, fee: 2380000 }
            ]);
        }
        if (category === 'laptop' || category === 'tivi') {
            if (years === 1) return getRate(price, [
                { min: 0, max: 5000000, fee: 280000 }, { min: 5000000, max: 10000000, fee: 500000 },
                { min: 10000000, max: 15000000, fee: 700000 }, { min: 15000000, max: 20000000, fee: 1050000 },
                { min: 20000000, max: 25000000, fee: 1250000 }, { min: 25000000, max: 30000000, fee: 1550000 },
                { min: 30000000, max: 40000000, fee: 1850000 }
            ]);
            if (years === 2) return getRate(price, [
                { min: 0, max: 5000000, fee: 530000 }, { min: 5000000, max: 10000000, fee: 950000 },
                { min: 10000000, max: 15000000, fee: 1350000 }, { min: 15000000, max: 20000000, fee: 2000000 },
                { min: 20000000, max: 25000000, fee: 2380000 }, { min: 25000000, max: 30000000, fee: 2950000 },
                { min: 30000000, max: 40000000, fee: 3500000 }
            ]);
        }
        // [FIXED] ĐÃ BỔ SUNG MÁY LẠNH
        if (category === 'ac') { 
            if (years === 1) return getRate(price, [
                { min: 0, max: 5000000, fee: 240000 }, { min: 5000000, max: 10000000, fee: 420000 },
                { min: 10000000, max: 15000000, fee: 640000 }, { min: 15000000, max: 20000000, fee: 920000 },
                { min: 20000000, max: 25000000, fee: 1150000 }, { min: 25000000, max: 30000000, fee: 1350000 },
                { min: 30000000, max: 40000000, fee: 1650000 }
            ]);
            if (years === 2) return getRate(price, [
                { min: 0, max: 5000000, fee: 460000 }, { min: 5000000, max: 10000000, fee: 800000 },
                { min: 10000000, max: 15000000, fee: 1250000 }, { min: 15000000, max: 20000000, fee: 1750000 },
                { min: 20000000, max: 25000000, fee: 2150000 }, { min: 25000000, max: 30000000, fee: 2500000 },
                { min: 30000000, max: 40000000, fee: 3100000 }
            ]);
        }
        // [FIXED] ĐÃ BỔ SUNG TỦ LẠNH, MÁY GIẶT
        if (category === 'fridge' || category === 'washer') {
            if (years === 1) return getRate(price, [
                { min: 0, max: 5000000, fee: 220000 }, { min: 5000000, max: 10000000, fee: 390000 },
                { min: 10000000, max: 15000000, fee: 600000 }, { min: 15000000, max: 20000000, fee: 880000 },
                { min: 20000000, max: 25000000, fee: 1100000 }
            ]);
            if (years === 2) return getRate(price, [
                { min: 0, max: 5000000, fee: 420000 }, { min: 5000000, max: 10000000, fee: 740000 },
                { min: 10000000, max: 15000000, fee: 1150000 }, { min: 15000000, max: 20000000, fee: 1680000 },
                { min: 20000000, max: 25000000, fee: 2100000 }
            ]);
        }
    }
    return 0;
};