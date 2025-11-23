// src/lib/stores.js
import { writable } from 'svelte/store';

// User hiện tại (null nếu chưa đăng nhập)
// Khởi tạo từ localStorage nếu có để giữ trạng thái đăng nhập khi F5
const storedUser = localStorage.getItem('taskflow_user');
export const currentUser = writable(storedUser ? JSON.parse(storedUser) : null);

// Danh sách công việc hôm nay
export const currentTasks = writable([]);

// Mẫu Checklist (Template)
export const taskTemplate = writable({});

// Trạng thái Loading toàn ứng dụng
export const isLoading = writable(false);

// Hàm helper để cập nhật User và lưu vào LocalStorage cùng lúc
export const setUser = (user) => {
    currentUser.set(user);
    if (user) {
        localStorage.setItem('taskflow_user', JSON.stringify(user));
    } else {
        localStorage.removeItem('taskflow_user');
    }
};

// Dữ liệu mẫu mặc định (Dùng khi khởi tạo lần đầu hoặc Reset)
export const DEFAULT_TEMPLATE = {
    warehouse: [
        { time: "08:00", title: "Báo cáo Online (ERP + GHQĐT) BC Group Kho" },
        { time: "08:00", title: "Chụp hình 8NTTT BC Group Kho" },
        { time: "08:00", title: "Lấy ĐT trong tủ đem ra tủ Phone (IP và SS)" },
        { time: "08:00", title: "In Popup (Trên Group in giá PG gửi)" },
        { time: "08:00", title: "Kiểm tra phiếu chuyển kho/ nhập đổi" },
        { time: "08:00", title: "Xử lý CVST quản lý yêu cầu" },
        { time: "09:00", title: "Báo cáo Online (ERP + GHQĐT) BC Group Kho" },
        { time: "09:00", title: "Nhập hàng NCC" },
        { time: "09:00", title: "Chuyển hàng lỗi (Nhận chuyển luôn không bàn giao)" },
        { time: "11:00", title: "Báo cáo Online (ERP + GHQĐT) BC Group Kho" },
        { time: "11:00", title: "Trưng bày Laptop Full" },
        { time: "11:00", title: "Kiểm tra và check nhận hàng kho khác chuyển về" },
        { time: "14:00", title: "Báo cáo Online (ERP + GHQĐT) BC Group Kho" },
        { time: "14:00", title: "Dọn dẹp khu vực sau lưng HTKT (Hàng NCC)" },
        { time: "15:00", title: "Báo cáo Online (ERP + GHQĐT) BC Group Kho (Ca chiều)" },
        { time: "15:00", title: "Đồng kiểm hàng NCC (Nhất Tín), check nhận" },
        { time: "15:00", title: "Chuyển phụ kiện lỗi (T2, T5)" },
        { time: "15:00", title: "Khui hàng trưng bày khu vực hàng ĐSĐ" },
        { time: "15:00", title: "Check mail xử lý công việc (nếu có)" },
        { time: "15:00", title: "Up hình máy cũ điện thoại + Table" },
        { time: "15:00", title: "Dọn dẹp khu vực sau lưng HTKT" },
        { time: "21:30", title: "Báo cáo Online (ERP + GHQĐT) BC Group Kho" },
        { time: "21:30", title: "Lấy ĐT trong tủ SS và IP cất vào tủ bí mật" },
        { time: "21:30", title: "Niêm phong tủ Phone và Đồng hồ" },
        { time: "21:30", title: "Niêm phong và khóa 3 cửa kho điện máy" },
        { time: "21:30", title: "Tắt đèn nhà vệ sinh" }
    ],
    cashier: [
        { time: "08:00", title: "Kiểm đếm tiền mặt đầu ca" },
        { time: "12:00", title: "Nộp tiền về ngân hàng" },
        { time: "21:30", title: "Chốt ca, in báo cáo kết toán" }
    ]
};