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

export const calculateBH11 = (group, p) => {
    if (group === 'none' || p === 0) return 0;
    if (group === 'air_conditioner') return p <= 10000000 ? 250000 : 350000;
    if (group === 'fridge' || group === 'washer') return p <= 10000000 ? 400000 : (p <= 25000000 ? 700000 : 1350000);
    if (group === 'water_purifier') return p <= 8000000 ? 280000 : (p <= 11000000 ? 380000 : 460000);
    if (group === 'smartphone') { const fee = p * 0.0462; return fee < 200000 ? 200000 : fee; }
    if (group === 'laptop_tablet') { const fee = p * 0.06; return fee < 200000 ? 200000 : fee; }
    if (group === 'smart_watch') { const fee = p * 0.055; return fee < 200000 ? 200000 : fee; }
    if (group === 'tv') return p * 0.07;
    return 0;
};

// Hàm tra cứu khoảng giá cho BHMR
function getRate(price, ratesArray) {
    const tier = ratesArray.find(r => price > r.min && price <= r.max);
    return tier ? tier.fee : 0;
}

export const calculateBHMR = (category, isDMX, years, price) => {
    if (category === 'none' || !price || price <= 0) return 0;
    
    if (isDMX) {
        if (category === 'phone' || category === 'apple') { // Tạm gộp Apple và Phone, bạn có thể tách mảng giá riêng sau
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
            if (years === 1) return getRate(price, [{ min: 0, max: 5000000, fee: 190000 }, { min: 5000000, max: 10000000, fee: 340000 }, { min: 10000000, max: 20000000, fee: 750000 }, { min: 20000000, max: 40000000, fee: 1340000 }]);
            if (years === 2) return getRate(price, [{ min: 0, max: 5000000, fee: 370000 }, { min: 5000000, max: 10000000, fee: 650000 }, { min: 10000000, max: 20000000, fee: 1420000 }]);
            if (years === 3) return getRate(price, [{ min: 0, max: 5000000, fee: 590000 }, { min: 5000000, max: 10000000, fee: 1040000 }, { min: 10000000, max: 20000000, fee: 2270000 }]);
        }
    } else {
        if (category === 'phone' || category === 'apple') {
            if (years === 1) return getRate(price, [{ min: 0, max: 5000000, fee: 300000 }, { min: 5000000, max: 15000000, fee: 750000 }, { min: 15000000, max: 30000000, fee: 1450000 }]);
            if (years === 2) return getRate(price, [{ min: 0, max: 5000000, fee: 570000 }, { min: 5000000, max: 15000000, fee: 1450000 }, { min: 15000000, max: 30000000, fee: 2500000 }]);
        }
        if (category === 'laptop' || category === 'tivi') {
            if (years === 1) return getRate(price, [{ min: 0, max: 10000000, fee: 500000 }, { min: 10000000, max: 20000000, fee: 1050000 }]);
            if (years === 2) return getRate(price, [{ min: 0, max: 10000000, fee: 950000 }, { min: 10000000, max: 20000000, fee: 2000000 }]);
        }
    }
    return 0;
};