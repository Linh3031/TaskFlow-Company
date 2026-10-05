// Chép nguyên hàm evaluateCriterion từ dashboard-svelte (src/lib/sknv/tinhDiemNhanVien.js) — file gốc
// kéo theo nhiều phụ thuộc nên chỉ lấy riêng hàm này. Các khối bảng điểm dùng để tô màu đúng với số đếm
// đạt/tổng mà dashboard đã gửi sẵn. App KHÔNG tự tính điểm.
//   - nhân viên chưa có số thì coi giá trị = 0 rồi so với mốc;
//   - mốc không có (= 0) thì tính là đạt;
//   - "Đạt" là giá trị >= mốc; riêng % Target cá nhân dùng mốc cố định 100%.
export function evaluateCriterion({ rawValue, rawMoc, hasData = true, isPercentTarget = false, khongBanCungDat = false } = {}) {
    if (isPercentTarget) return { counted: true, achieved: !hasData || (Number(rawValue) || 0) >= 100 };
    const val = hasData ? (Number(rawValue) || 0) : 0;
    const moc = Number(rawMoc) || 0;
    return { counted: true, achieved: val >= moc };
}
