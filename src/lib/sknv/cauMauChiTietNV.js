// Câu mẫu "Khen" / "Góp ý" cho tab Sức khỏe nhân viên — dùng CHUNG cho cả thẻ ngoài (bảng tổng)
// và trang chi tiết dạng phiếu điểm. KHÔNG dùng AI — tự tạo câu từ số liệu 4 nhóm KPI (Doanh thu,
// Năng suất, Hiệu quả, Đơn giá) đã tính sẵn bởi src/lib/sknv/tinhDiemNhanVien.js (nguồn duy nhất
// quyết định đạt/chưa đạt), xét tới TỪNG TIÊU CHÍ trong nhóm để chọn ra tiêu chí vượt/thiếu nhiều nhất.
const THU_TU_NHOM = ['doanhThu', 'nangSuat', 'hieuQua', 'donGia'];

// Chữ viết tắt giữ nguyên IN HOA khi đưa tên tiêu chí vào giữa câu khen/góp ý (xem hàm
// tenTieuChiTrongCau). Muốn thêm chữ viết tắt mới thì bổ sung trực tiếp vào danh sách này.
const CHU_VIET_TAT = ['DTQĐ', 'DT', 'QĐ', 'SIM', 'VAS', 'MLN', 'PK', 'BH', 'ĐMX', 'TGDĐ', 'CE', 'GD', 'TV'];
const TAP_CHU_VIET_TAT = new Set(CHU_VIET_TAT.map((tu) => tu.toUpperCase()));

// Đưa tên tiêu chí (ví dụ "% Phụ kiện", "DTQĐ/giờ công") vào giữa câu: bỏ ký hiệu "%" ở đầu, viết
// thường chữ cái đầu của từ thường, riêng các chữ trong CHU_VIET_TAT giữ IN HOA.
function tenTieuChiTrongCau(ten) {
    if (!ten) return '';
    const boPhanTram = ten.replace(/^%\s*/, '');
    return boPhanTram
        .split(/([^\p{L}\p{N}]+)/gu)
        .map((token) => {
            if (!token || !/[\p{L}\p{N}]/u.test(token)) return token;
            return TAP_CHU_VIET_TAT.has(token.toUpperCase()) ? token.toUpperCase() : token.toLocaleLowerCase('vi');
        })
        .join('');
}

function tyLeNhom(g) {
    return g.tongTieuChi > 0 ? g.soDat / g.tongTieuChi : 0;
}

// Tiêu chí "được tính" = đã loại "khongTinh" (đúng quy tắc chung đã áp dụng ở tinhDiemNhanVien()),
// để không lệch với số đếm đạt/tổng đã hiển thị ở các khối phía trên.
function tieuChiDuocTinh(nhom) {
    return (nhom.tieuChi || []).filter((c) => c.ketQua !== 'khongTinh');
}

// % vượt/thiếu so với mốc (TB siêu thị hoặc mục tiêu). null nếu mốc = 0 (không tính được %).
function phanTramVuot(c) {
    if (!c.moc) return null;
    return ((c.giaTri - c.moc) / c.moc) * 100;
}

function chonNhomCaoNhat(danhSachNhom) {
    let best = danhSachNhom[0];
    for (const n of danhSachNhom) {
        if (tyLeNhom(n) > tyLeNhom(best)) best = n;
    }
    return best;
}

function chonNhomThapNhat(danhSachNhom) {
    let worst = danhSachNhom[0];
    for (const n of danhSachNhom) {
        if (tyLeNhom(n) < tyLeNhom(worst)) worst = n;
    }
    return worst;
}

/**
 * @param {Array} nhomList - đúng field `nhom` trong kết quả tinhDiemNhanVien():
 *   [{ key, ten, tieuChi: [{ten, giaTri, moc, loaiMoc, hasMocTarget, ketQua}], soDat, tongTieuChi }, ...]
 *   Thứ tự phải đúng THU_TU_NHOM: doanhThu, nangSuat, hieuQua, donGia (đúng thứ tự tinhDiemNhanVien trả về).
 */
export function taoKhenGopYChiTiet(nhomList) {
    const danhSachNhom = THU_TU_NHOM.map((key) => nhomList.find((n) => n.key === key)).filter(Boolean);

    // ----- KHEN -----
    const nhomManh = chonNhomCaoNhat(danhSachNhom);
    const tronDiem = nhomManh.tongTieuChi > 0 && nhomManh.soDat === nhomManh.tongTieuChi;
    const ungVienKhen = tieuChiDuocTinh(nhomManh)
        .map((c) => ({ ...c, pct: phanTramVuot(c) }))
        .filter((c) => c.pct !== null)
        .sort((a, b) => b.pct - a.pct);

    let khenText;
    if (ungVienKhen.length > 0) {
        const top = ungVienKhen[0];
        const xVuot = Math.round(top.pct);
        khenText = tronDiem
            ? `${nhomManh.ten} đạt trọn điểm, ${tenTieuChiTrongCau(top.ten)} vượt TB ${xVuot}%.`
            : `${nhomManh.ten} là điểm mạnh nhất (${nhomManh.soDat}/${nhomManh.tongTieuChi}), ${tenTieuChiTrongCau(top.ten)} vượt TB ${xVuot}%.`;
    } else {
        khenText = tronDiem
            ? `${nhomManh.ten} đạt trọn điểm.`
            : `${nhomManh.ten} là điểm mạnh nhất (${nhomManh.soDat}/${nhomManh.tongTieuChi}).`;
    }

    // ----- GÓP Ý -----
    const nhomYeu = chonNhomThapNhat(danhSachNhom);
    const tyLeYeu = tyLeNhom(nhomYeu);
    const ca4NhomTron = danhSachNhom.every((n) => n.tongTieuChi > 0 && n.soDat === n.tongTieuChi);

    let gopYText, gopYBg, gopYColor;
    if (ca4NhomTron) {
        gopYText = 'Giữ vững phong độ ở cả 4 nhóm.';
        gopYBg = '#EAF8F2'; gopYColor = '#0C7A5E';
    } else {
        const chuaDat = tieuChiDuocTinh(nhomYeu)
            .filter((c) => c.ketQua === 'chuaDat')
            .map((c) => ({ ...c, pct: phanTramVuot(c) }))
            .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))
            .slice(0, 3);

        const danhSachTen = chuaDat.map((c) => tenTieuChiTrongCau(c.ten)).join(', ');
        const chiMotTieuChi = chuaDat.length === 1 ? chuaDat[0] : null;
        const tuMoc = chiMotTieuChi && chiMotTieuChi.hasMocTarget ? 'mục tiêu' : 'TB';

        if (tyLeYeu < 0.5) {
            gopYText = `Cần tập trung ${nhomYeu.ten.toLowerCase()}: ${danhSachTen} đang dưới ${tuMoc}.`;
            gopYBg = '#FDEAEA'; gopYColor = '#E03E3E';
        } else {
            gopYText = `Nâng thêm ${nhomYeu.ten.toLowerCase()}: ${danhSachTen} còn dưới ${tuMoc}.`;
            gopYBg = '#FFF3D9'; gopYColor = '#98620A';
        }
    }

    return {
        khen: { text: khenText, bg: '#EAF8F2', color: '#0C7A5E' },
        gopY: { text: gopYText, bg: gopYBg, color: gopYColor }
    };
}
