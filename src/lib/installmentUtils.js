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

// Hàm nội bộ giải mã cấu trúc Phí Min (VD: "300000_600000")
function getMinFee(phiMinStr, yearIndex) {
    if (!phiMinStr || phiMinStr === '0' || phiMinStr === 'KHÔNG') return 0;
    const parts = String(phiMinStr).split('_');
    if (parts.length === 1) return Number(parts[0]) || 0; // Áp dụng chung
    return Number(parts[yearIndex - 1]) || 0; // Lấy theo năm (1, 2, 3)
}

// Tính BH 1-1 từ Dữ liệu động
export const calculateBH11 = (group, price, ratesData = []) => {
    if (group === 'none' || price === 0 || ratesData.length === 0) return 0;
    
    const tier = ratesData.find(r => r.LoaiBaoHiem === 'BH11' && r.NhomHang === group && price > r.GiaTu && price <= r.GiaDen);
    if (!tier) return 0;

    let fee = tier.DonVi === '%' ? price * (tier.GiaGoi1 / 100) : tier.GiaGoi1;
    const minFee = getMinFee(tier.PhiMin, 1);
    
    return fee < minFee ? minFee : fee;
};

// Tính BHMR từ Dữ liệu động
export const calculateBHMR = (category, isDMX, years, price, ratesData = []) => {
    if (category === 'none' || !price || price <= 0 || ratesData.length === 0) return 0;
    
    const loaiBH = isDMX ? 'BHMR_DMX' : 'BHMR';
    const tier = ratesData.find(r => r.LoaiBaoHiem === loaiBH && r.NhomHang === category && price > r.GiaTu && price <= r.GiaDen);
    
    if (!tier) return 0;

    let baseFee = 0;
    if (years === 1) baseFee = tier.GiaGoi1;
    else if (years === 2) baseFee = tier.GiaGoi2;
    else if (years === 3) baseFee = tier.GiaGoi3;

    if (baseFee === 0) return 0; // Gói này không bán cho số năm tương ứng

    let finalFee = tier.DonVi === '%' ? price * (baseFee / 100) : baseFee;
    const minFee = getMinFee(tier.PhiMin, years);
    
    return finalFee < minFee ? minFee : finalFee;
};