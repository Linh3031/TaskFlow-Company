export const tourSteps = [
    { target: '#toolbar-actions', title: '1. Công Cụ Đầu Vào', content: 'Nơi tải danh sách nhân viên từ Excel và Cấu hình khung giờ hoạt động.' },
    { target: '#month-navigator', title: '2. Chọn Tháng & Chế Độ', content: 'Chọn tháng cần làm lịch. Chuyển đổi qua lại giữa <b>Thứ 2-6</b> và <b>T7-CN</b> để nhập định mức riêng.' },
    { target: '#matrix-header-target', title: '3. Nhập Định Mức', content: 'Nhập số lượng nhân viên cần thiết cho từng bộ phận (Kho, Thu Ngân...) tại các khung giờ bên dưới.' },
    { target: '#btn-calculate', title: '4. Tính Toán Tự Động', content: 'Bấm nút này để hệ thống quy đổi nhu cầu lẻ thành các Combo ca làm việc.' },
    { target: '#combo-header-target', title: '5. Tinh Chỉnh Combo', content: 'Xem kết quả quy đổi bên dưới. Bạn có thể sửa trực tiếp số lượng hoặc Thêm cột ca mới.' },
    { target: '#btn-preview-schedule', title: '6. Tạo & Xem Trước', content: 'Bước cuối: Tạo bảng phân ca chi tiết để kiểm tra và áp dụng.' }
];

export const defaultMatrix = { c1: { kho: 0, tn: 0, tv: 0, gh: 0 }, c2: { kho: 0, tn: 0, tv: 0, gh: 0 }, c3: { kho: 0, tn: 0, tv: 0, gh: 0 }, c4: { kho: 0, tn: 0, tv: 0, gh: 0 }, c5: { kho: 0, tn: 0, tv: 0, gh: 0 }, c6: { kho: 0, tn: 0, tv: 0, gh: 0 } };

export const DEFAULT_COLS = ['123', '456', '23', '45', '2-5', '2345', '123456', '12-56'];

export const shiftCols = [ { id: 'c1', label: 'C1 (08-09h)' }, { id: 'c2', label: 'C2 (09-12h)' }, { id: 'c3', label: 'C3 (12-15h)' }, { id: 'c4', label: 'C4 (15-18h)' }, { id: 'c5', label: 'C5 (18-21h)' }, { id: 'c6', label: 'C6 (21-21h30)' } ];

export const roleRows = [ { id: 'kho', label: 'Kho', color: 'text-orange-600 bg-orange-50 border-orange-100' }, { id: 'tn', label: 'Thu Ngân', color: 'text-purple-600 bg-purple-50 border-purple-100' }, { id: 'gh', label: 'Giao Hàng', color: 'text-blue-600 bg-blue-50 border-blue-100' }, { id: 'tv', label: 'Tư Vấn', color: 'text-gray-600 bg-gray-50 border-gray-200' } ];

export const INSPECTION_OPTIONS = [ { val: 'none', label: 'Tắt soi lỗi', icon: 'visibility_off', color: 'text-gray-400' }, { val: 'gender', label: 'Soi Giới Tính', icon: 'wc', color: 'text-pink-500' }, { val: 'weekend', label: 'Công Bằng Cuối Tuần', icon: 'balance', color: 'text-indigo-600' }, { val: 'rotation', label: 'Soi Nhịp Sáng/Chiều', icon: 'sync_problem', color: 'text-orange-500' }, { val: 'fatigue', label: 'Soi Trùng Nghiệp Vụ', icon: 'battery_alert', color: 'text-red-600' } ];

export function getShiftColor(code) { 
    if (code === 'OFF') return 'bg-slate-100 text-slate-400 border-slate-200 font-bold tracking-wider text-[10px]';
    const map = { '123': 'bg-green-50 text-green-700 border-green-100', '456': 'bg-orange-50 text-orange-700 border-orange-100', '23': 'bg-cyan-50 text-cyan-700 border-cyan-100', '45': 'bg-blue-50 text-blue-700 border-blue-100', '2-5': 'bg-pink-50 text-pink-700 border-pink-100', '2345': 'bg-red-50 text-red-700 border-red-100', '12-56': 'bg-purple-100 text-purple-700 border-purple-200' };
    return map[code] || 'bg-white text-gray-800 border-gray-200'; 
}

export function getRoleBadge(role) { 
    if (!role || role === 'TV') return null;
    if (role === 'GH' || role === 'Giao Hàng') return { text: 'GH', class: 'bg-blue-600 text-white' };
    if (role === 'Thu Ngân' || role === 'TN') return { text: 'TN', class: 'bg-purple-600 text-white' };
    if (role === 'Kho') return { text: 'K', class: 'bg-orange-500 text-white' }; return { text: role.charAt(0), class: 'bg-gray-500 text-white' };
}

export function isHardRole(roleName) { 
    return ['Kho', 'Thu Ngân', 'Giao Hàng', 'GH', 'TN', 'K'].includes(roleName);
}

export function getShiftGroup(code) { 
    return 'OFF';
}