// Bộ màu pastel theo thứ hạng — dùng chung cho thẻ ngoài (EmployeeCard) và đầu phiếu trang chi
// tiết (DauPhieu), trước đây 2 nơi khai báo trùng lặp hoàn toàn.
export const TIERS = {
    r1: { bg: '#FFE9AE', ink: '#5A3D00', ring: '#E39B0B' },
    r2: { bg: '#E6EAF1', ink: '#2E3645', ring: '#7D889C' },
    r3: { bg: '#FBD9C8', ink: '#6B2C10', ring: '#D2642F' },
    tA: { bg: '#CDF1E4', ink: '#0B4F40', ring: '#13A07F' },
    tB: { bg: '#D6E6FB', ink: '#173E78', ring: '#2F6FD1' },
    tC: { bg: '#E5DEFB', ink: '#3A2A86', ring: '#6A56D6' },
};

/**
 * @param {number} rank - hạng của nhân viên (1-based)
 * @param {number} phanTram - tỉ lệ đạt (0-1)
 */
export function getHeadStyle(rank, phanTram) {
    if (rank === 1) return { ...TIERS.r1, icon: 'trophy' };
    if (rank === 2) return { ...TIERS.r2, icon: 'medal' };
    if (rank === 3) return { ...TIERS.r3, icon: 'medal' };
    const tier = phanTram >= 0.7 ? TIERS.tA : phanTram >= 0.63 ? TIERS.tB : TIERS.tC;
    return { ...tier, icon: '' };
}
