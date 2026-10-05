// Đọc gói SKNV do dashboard-svelte đồng bộ lên Firebase qlst-9e6bd (đọc dạng khách, chỉ GET từng document):
//   sknv_app/{kho}                 tóm tắt kho: capNhatPhieuLuc, capNhatChiTietLuc, nhanVien [{maNV, hoTen, boPhan}]
//   sknv_app/{kho}/phieu/{maNV}    bảng điểm (phieu) + thi đua (thiDua)
//   sknv_app/{kho}/chitiet/{maNV}  cây ngành -> nhóm -> sản phẩm
// App KHÔNG tự tính hay phân nhóm lại — mọi số lấy nguyên từ document.
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { dbDoanhThu } from '../lib/firebase';

// Bản lưu trên máy: CHỈ số của chính người dùng, mỗi loại 1 bản (đổi kho/MSNV thì bản mới đè bản cũ).
const KHOA_LUU = { phieu: 'sknv_cua_toi_phieu', chitiet: 'sknv_cua_toi_chitiet' };

// Firestore Timestamp -> mili giây (không có thì null).
const sangMiliGiay = (v) => {
    if (!v) return null;
    if (typeof v.toMillis === 'function') return v.toMillis();
    return typeof v === 'number' && isFinite(v) ? v : null;
};

// MSNV dùng được làm đường dẫn document.
const maNVHopLe = (maNV) => {
    const s = String(maNV ?? '').trim();
    return s && !s.includes('/') ? s : '';
};

export const sknvAppService = {
    maNVHopLe,

    // Xoá bản cả kho của cách làm cũ (sknv_data_{kho}, sknv_version_{kho}).
    xoaBanCaKhoCu() {
        try {
            const canXoa = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('sknv_data_') || k.startsWith('sknv_version_'))) canXoa.push(k);
            }
            canXoa.forEach(k => localStorage.removeItem(k));
        } catch (e) { /* máy chặn bộ nhớ thì bỏ qua */ }
    },

    // Theo dõi tóm tắt kho — dashboard đồng bộ xong là báo ngay. Trả về hàm huỷ theo dõi.
    // onData(null) khi kho chưa bật đồng bộ (không có document).
    theoDoiKho(kho, onData, onError) {
        return onSnapshot(doc(dbDoanhThu, 'sknv_app', kho), (snap) => {
            if (!snap.exists()) { onData(null); return; }
            const d = snap.data();
            onData({
                maKho: d.maKho || kho,
                capNhatPhieuLuc: sangMiliGiay(d.capNhatPhieuLuc),
                capNhatChiTietLuc: sangMiliGiay(d.capNhatChiTietLuc),
                nhanVien: Array.isArray(d.nhanVien) ? d.nhanVien.filter(Boolean) : []
            });
        }, onError);
    },

    // Bảng điểm + thi đua của 1 NV. Không có document thì trả về null.
    async taiPhieu(kho, maNV) {
        const ma = maNVHopLe(maNV);
        if (!ma) return null;
        const snap = await getDoc(doc(dbDoanhThu, 'sknv_app', kho, 'phieu', ma));
        if (!snap.exists()) return null;
        const d = snap.data();
        return { ...d, maNV: ma, maKho: d.maKho || kho, dongBoLuc: sangMiliGiay(d.dongBoLuc) };
    },

    // Chi tiết sản phẩm của 1 NV. Không có document thì trả về null.
    async taiChiTiet(kho, maNV) {
        const ma = maNVHopLe(maNV);
        if (!ma) return null;
        const snap = await getDoc(doc(dbDoanhThu, 'sknv_app', kho, 'chitiet', ma));
        if (!snap.exists()) return null;
        const d = snap.data();
        return { ...d, maNV: ma, maKho: d.maKho || kho, dongBoLuc: sangMiliGiay(d.dongBoLuc) };
    },

    // loai: 'phieu' | 'chitiet'. Trả về { luc, data } nếu bản lưu đúng kho + MSNV.
    docBanLuu(loai, kho, maNV) {
        try {
            const v = JSON.parse(localStorage.getItem(KHOA_LUU[loai]) || 'null');
            if (v && v.kho === kho && v.maNV === maNV && v.data) return { luc: Number(v.luc) || 0, data: v.data };
        } catch (e) { /* bản lưu hỏng thì coi như không có */ }
        return null;
    },

    ghiBanLuu(loai, kho, maNV, luc, data) {
        try { localStorage.setItem(KHOA_LUU[loai], JSON.stringify({ kho, maNV, luc: luc || 0, data })); } catch (e) { /* đầy bộ nhớ thì bỏ qua */ }
    },

    xoaBanLuu(loai) {
        try { localStorage.removeItem(KHOA_LUU[loai]); } catch (e) { /* bỏ qua */ }
    },

    // Props cho PhieuNhanVien.svelte: boTatChiSo về lại dạng Set, kèm giờ đồng bộ cho chân phiếu.
    taoPropsPhieu(goi) {
        const phieu = goi?.phieu || {};
        return { ...phieu, boTatChiSo: new Set(Array.isArray(phieu.boTatChiSo) ? phieu.boTatChiSo : []), dongBoLuc: goi?.dongBoLuc ?? null };
    },

    // dd/MM HH:mm
    dinhDangGio(ms) {
        if (!ms) return '';
        const d = new Date(ms);
        if (isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
};
