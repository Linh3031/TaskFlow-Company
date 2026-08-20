import * as XLSX from 'xlsx';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase.js';

/**
 * Xuất file Excel mẫu để người dùng điền phân công
 */
export async function exportTemplateData(activeStoreId, allStaff) {
    const wsData = [];
    
    wsData.push({ 
        'Tên Nhân Sự': '👉 HƯỚNG DẪN SỬ DỤNG:',
        'Quầy Mẫu 1 (Đổi Tên Tùy Ý)': "Gõ chữ 'x' vào ô này",
        'Quầy Mẫu 2 (Đổi Tên Tùy Ý)': "để phân công người.",
        'Quầy Mẫu 3 (Đổi Tên Tùy Ý)': "Thêm/Xóa cột tùy ý."
    });

    wsData.push({
        'Tên Nhân Sự': '⚙️ SỐ LƯỢNG CẦN (Nhập số):',
        'Quầy Mẫu 1 (Đổi Tên Tùy Ý)': 1,
        'Quầy Mẫu 2 (Đổi Tên Tùy Ý)': 1,
        'Quầy Mẫu 3 (Đổi Tên Tùy Ý)': 1
    });

    allStaff.forEach(staff => {
        wsData.push({ 
            'Tên Nhân Sự': staff.username,
            'Quầy Mẫu 1 (Đổi Tên Tùy Ý)': '',
            'Quầy Mẫu 2 (Đổi Tên Tùy Ý)': '',
            'Quầy Mẫu 3 (Đổi Tên Tùy Ý)': ''
        });
    });

    const ws = XLSX.utils.json_to_sheet(wsData);
    const colWidths = [{ wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 25 }];
    ws['!cols'] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FileMau_8NTTT");
    XLSX.writeFile(wb, `FileMau_8NTTT_${activeStoreId}.xlsx`);
}

/**
 * Xuất file Excel chứa dữ liệu phân công hiện tại
 */
export async function exportExcelData(activeStoreId, dateStr, checklistData, allStaff) {
    if (checklistData.length === 0) {
        // Tự động chuyển sang file mẫu nếu không có data
        await exportTemplateData(activeStoreId, allStaff);
        return { success: false, message: "⚠️ CẢNH BÁO: Chưa có khu vực nào để xuất. Đang tự động chuyển sang chế độ Xuất File Mẫu." };
    }

    const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
    const snap = await getDoc(templateRef);
    let currentTemplateItems = snap.exists() ? (snap.data().items || []) : [];

    const wsData = [];
    
    const quotaRow = { 'Tên Nhân Sự': '⚙️ SỐ LƯỢNG CẦN (Nhập số):' };
    checklistData.forEach(item => {
        const tItem = currentTemplateItems.find(i => i.id === item.id);
        quotaRow[item.areaName] = tItem ? (tItem.staffLimit || 0) : 0;
    });
    wsData.push(quotaRow);

    allStaff.forEach(staff => {
        const row = { 'Tên Nhân Sự': staff.username };
        checklistData.forEach(item => {
            const isAssigned = (item.assignees || []).some(a => a.id === staff.id);
            row[item.areaName] = isAssigned ? 'x' : '';
        });
        wsData.push(row);
    });

    const ws = XLSX.utils.json_to_sheet(wsData);
    const colWidths = [{ wch: 30 }]; 
    checklistData.forEach(() => colWidths.push({ wch: 20 })); 
    ws['!cols'] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PhanCong_8NTTT");
    XLSX.writeFile(wb, `PhanCong_8NTTT_${dateStr}.xlsx`);
    
    return { success: true, message: null };
}

/**
 * Nạp dữ liệu phân công từ file Excel và cập nhật vào Firebase
 */
export function importExcelData(file, activeStoreId, dateStr, activeRecordId, checklistData, allStaff) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                let unfoundUsers = [];
                let updatedCount = 0;
                
                const staffMap = new Map(allStaff.map(s => [s.username.toLowerCase().trim(), s]));
                const newAreaAssigneesMap = new Map();
                const quotaMap = new Map(); 
                let hasQuotaRow = false;

                // Quét danh sách các quầy/khu vực
                for (let row of jsonData) {
                    for (const key of Object.keys(row)) {
                        if (key !== 'Tên Nhân Sự' && !key.includes('(Đổi Tên Tùy Ý)')) {
                            const areaName = key.trim();
                            const areaNameLower = areaName.toLowerCase();
                            if (!newAreaAssigneesMap.has(areaNameLower)) {
                                newAreaAssigneesMap.set(areaNameLower, { areaName: areaName, assignees: [] });
                            }
                        }
                    }
                }

                // Xử lý dữ liệu từng dòng
                for (let row of jsonData) {
                    const staffNameRaw = String(row['Tên Nhân Sự'] || '').trim();
                    
                    if (staffNameRaw.includes('SỐ LƯỢNG CẦN') || staffNameRaw.includes('ĐỊNH MỨC')) {
                        hasQuotaRow = true;
                        for (const [key, value] of Object.entries(row)) {
                            if (key !== 'Tên Nhân Sự' && !key.includes('(Đổi Tên Tùy Ý)')) {
                                quotaMap.set(key.trim().toLowerCase(), parseInt(value) || 0);
                            }
                        }
                        continue; 
                    }

                    if (!staffNameRaw || staffNameRaw.includes('HƯỚNG DẪN')) continue; 
                    
                    const staff = staffMap.get(staffNameRaw.toLowerCase());
                    if (!staff) {
                        unfoundUsers.push(staffNameRaw);
                        continue;
                    }

                    for (const [key, value] of Object.entries(row)) {
                        if (key !== 'Tên Nhân Sự' && !key.includes('(Đổi Tên Tùy Ý)') && (value === 'x' || value === 'X' || value === 1)) {
                            const areaNameLower = key.trim().toLowerCase();
                            newAreaAssigneesMap.get(areaNameLower).assignees.push({ id: staff.id, username: staff.username });
                        }
                    }
                }

                // Lưu dữ liệu vào Template
                const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
                const snap = await getDoc(templateRef);
                let currentTemplateItems = snap.exists() ? (snap.data().items || []) : [];
                
                // Lưu dữ liệu vào Record hằng ngày
                const targetRecordId = activeRecordId || `${activeStoreId}_${dateStr}`;
                const dailyRef = doc(db, '8nttt_daily_records', targetRecordId);
                const dailySnap = await getDoc(dailyRef);
                let currentDailyItems = dailySnap.exists() ? (dailySnap.data().items || []) : checklistData;

                let areaMapTemplate = new Map(currentTemplateItems.map(i => [i.areaName.toLowerCase().trim(), i]));
                let areaMapDaily = new Map(currentDailyItems.map(i => [i.areaName.toLowerCase().trim(), i]));

                for (const [areaNameLower, data] of newAreaAssigneesMap.entries()) {
                    let fallbackCount = data.assignees.length; 
                    let finalLimit = hasQuotaRow && quotaMap.has(areaNameLower) ? quotaMap.get(areaNameLower) : fallbackCount;

                    if (areaMapTemplate.has(areaNameLower)) {
                        let existing = areaMapTemplate.get(areaNameLower);
                        existing.assignees = data.assignees;
                        existing.staffLimit = finalLimit; 
                    } else {
                        const newItem = { 
                            id: 'area_' + Date.now() + Math.random().toString(36).substring(2,9), 
                            areaName: data.areaName, 
                            assignees: data.assignees,
                            staffLimit: finalLimit
                        };
                        currentTemplateItems.push(newItem);
                        areaMapTemplate.set(areaNameLower, newItem);
                    }

                    if (areaMapDaily.has(areaNameLower)) {
                        areaMapDaily.get(areaNameLower).assignees = data.assignees;
                    } else {
                        const newId = areaMapTemplate.get(areaNameLower).id; 
                        currentDailyItems.push({ id: newId, areaName: data.areaName, assignees: data.assignees, completed: false, imageUrls: [], uploaders: [], completedBy: null, completedAt: null });
                    }
                    updatedCount++;
                }

                // Thực thi Update DB
                await setDoc(templateRef, { items: currentTemplateItems }, { merge: true });
                if (dailySnap.exists()) {
                    await updateDoc(dailyRef, { items: currentDailyItems });
                } else {
                    await setDoc(dailyRef, { items: currentDailyItems, createdAt: serverTimestamp() });
                }

                let msg = `✅ Đã nạp và cập nhật thành công ${updatedCount} khu vực!\n💡 Hệ thống đã tự cập nhật định mức số lượng cho lần Trộn Lịch sau.\n`;
                if (unfoundUsers.length > 0) {
                    const uniqueUnfound = [...new Set(unfoundUsers)];
                    msg += `\n⚠️ CẢNH BÁO: Phát hiện nhân sự không tồn tại (đã bỏ qua):\n- ${uniqueUnfound.join('\n- ')}\n\nVui lòng không sửa tên nhân sự trên dòng Excel.`;
                }
                
                resolve({ success: true, message: msg });
                
            } catch (error) {
                reject(error);
            }
        };
        
        reader.readAsArrayBuffer(file);
    });
}