import { utils, writeFile } from 'xlsx';

export function exportScheduleToExcel({
    scheduleData,
    viewMonth,
    viewYear,
    selectedViewStore,
    getWeekday,
    getWeekendHardRoleCount
}) {
    if (!scheduleData) return;
    
    const wb = utils.book_new();
    const days = Object.keys(scheduleData.data).sort((a, b) => Number(a) - Number(b));
    const wsData = [];
    
    // Dòng 1: Tiêu đề ngày và các cột tổng kết
    const row1 = ["NHÂN SỰ"]; 
    days.forEach(d => row1.push(d)); 
    row1.push("Tổng Giờ", "GH", "TN", "K", "Ca cuối tuần"); 
    wsData.push(row1);
    
    // Dòng 2: Thứ trong tuần
    const row2 = [""]; 
    days.forEach(d => row2.push(getWeekday(d))); 
    row2.push("", "", "", "", ""); 
    wsData.push(row2);
    
    // Các dòng dữ liệu nhân sự
    scheduleData.stats.forEach(staff => {
        const row = [staff.name];
        days.forEach(d => {
            const assign = scheduleData.data[d].find(x => x.staffId === staff.id);
            if (assign) { 
                let cell = assign.shift; 
                if (assign.role && assign.role !== 'TV') cell += ` (${assign.role})`; 
                row.push(cell); 
            } else { 
                row.push(""); 
            }
        });
        row.push(
            Math.round(staff.totalHours), 
            staff.gh, 
            staff.tn, 
            staff.kho, 
            getWeekendHardRoleCount(staff.id)
        );
        wsData.push(row);
    });
    
    // Tạo sheet và xuất file
    const ws = utils.aoa_to_sheet(wsData);
    utils.book_append_sheet(wb, ws, `Lich_T${viewMonth}`);
    writeFile(wb, `Lich_Lam_Viec_Kho_${selectedViewStore}_T${viewMonth}_${viewYear}.xlsx`);
}