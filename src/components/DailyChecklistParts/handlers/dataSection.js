import { collection, doc, getDoc, getDocs, setDoc, onSnapshot, query, where, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase.js';
import { getTodayStr } from '../../../lib/utils.js';

// --- LOGIC TIỆN ÍCH ---
async function writeDebugLog(action, reason, activeStoreId, dateStr, currentUser) { 
    try { await addDoc(collection(db, 'debug_8nttt_logs'), { action, storeId: activeStoreId, dateStr, reason, user: currentUser?.username || 'unknown', timestamp: serverTimestamp() }); } catch (e) { } 
}

function getOldFormatDate(dStr) { 
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length !== 3) return dStr; 
    return `${parts[0]}-${parseInt(parts[1], 10)}-${parseInt(parts[2], 10)}`;
}

export function getDailyRecordRef(activeStoreId, dateStr, activeRecordId) { 
    const recordId = activeRecordId || `${activeStoreId}_${dateStr}`; 
    return doc(db, '8nttt_daily_records', recordId);
}

// --- LOGIC LẮNG NGHE LỊCH TRÌNH REALTIME ---
export async function subscribeToChecklist(activeStoreId, dateStr, currentUser, onDataUpdate) {
    const standardRecordId = `${activeStoreId}_${dateStr}`;
    const oldRecordId = `${activeStoreId}_${getOldFormatDate(dateStr)}`;

    let dailyRef = doc(db, '8nttt_daily_records', standardRecordId);
    let dailySnap = await getDoc(dailyRef);
    let activeRecordId = standardRecordId;

    if (!dailySnap.exists() && standardRecordId !== oldRecordId) {
        const oldDailyRef = doc(db, '8nttt_daily_records', oldRecordId);
        const oldDailySnap = await getDoc(oldDailyRef);
        if (oldDailySnap.exists()) { dailyRef = oldDailyRef; dailySnap = oldDailySnap; activeRecordId = oldRecordId; }
    }

    const todayStr = getTodayStr();
    const isPastDate = dateStr < todayStr;

    if (!dailySnap.exists()) {
        if (isPastDate) await writeDebugLog('DETECTED_MISSING', 'Load template mặc định', activeStoreId, dateStr, currentUser);
        const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
        const templateSnap = await getDoc(templateRef);
        let defaultData = templateSnap.exists() && templateSnap.data().items ?
        templateSnap.data().items.map(item => ({ ...item, completed: false, imageUrls: [], uploaders: [], completedBy: null, completedAt: null })) : [];
        
        if (!isPastDate) { 
            await setDoc(dailyRef, { items: defaultData, createdAt: serverTimestamp() }); 
        } else { 
            onDataUpdate(defaultData, activeRecordId); 
            return null; 
        }
    }

    const unsubscribe = onSnapshot(dailyRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().items) {
            const data = docSnap.data().items.map(i => ({ ...i, imageUrls: i.imageUrls || (i.imageUrl ? [i.imageUrl] : []), uploaders: i.uploaders || [] }));
            onDataUpdate(data, activeRecordId);
        } else { 
            onDataUpdate([], activeRecordId); 
        }
    });

    return { unsubscribe, activeRecordId };
}

export async function fetchAllStaffData(activeStoreId) {
    const q = query(collection(db, 'users'), where('storeIds', 'array-contains', activeStoreId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, username: d.data().username, role: d.data().role }))
        .filter(s => s.role !== 'admin' && s.role !== 'super_admin' && s.username)
        .sort((a, b) => a.username.localeCompare(b.username));
}

// --- LOGIC CẤU HÌNH & TRỘN LỊCH ---
export async function saveExcludedConfig(activeStoreId, newExcludedIds) {
    const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
    await setDoc(templateRef, { excludedStaffIds: newExcludedIds }, { merge: true });
}

export async function executeAutoRotate(activeStoreId, dateStr, allStaff, checklistData) {
    const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
    const snap = await getDoc(templateRef);
    let currentTemplateItems = snap.exists() ? (snap.data().items || []) : [];
    let currentExcludedIds = snap.exists() ? (snap.data().excludedStaffIds || []) : [];

    let totalNeeded = currentTemplateItems.reduce((sum, item) => sum + (item.staffLimit || 0), 0);
    if (totalNeeded === 0) {
        totalNeeded = checklistData.reduce((sum, item) => sum + (item.assignees ? item.assignees.length : 0), 0);
        if (totalNeeded === 0) {
            return { success: false, message: "❌ THẤT BẠI: Bạn chưa cài đặt số lượng người cần thiết (Định Mức) cho bất kỳ khu vực nào.\nVui lòng bấm 'Thêm Khu Vực' để điền, hoặc Import File Mẫu có ĐỊNH MỨC ở Dòng Số 2 để hệ thống tự nhận diện." };
        }
    }

    let listStaff = allStaff.filter(s => !currentExcludedIds.includes(s.id)).sort((a,b) => a.username.localeCompare(b.username));
    if (listStaff.length === 0) {
        return { success: false, message: "❌ THẤT BẠI: Không có nhân sự nào hợp lệ để trộn (có thể tất cả đã bị đưa vào danh sách Loại Trừ)." };
    }

    const randomOffset = Math.floor(Math.random() * (listStaff.length - 1)) + 1;
    const rotateArray = (arr, steps) => {
        if (arr.length === 0) return [];
        const offset = steps % arr.length;
        return [...arr.slice(offset), ...arr.slice(0, offset)];
    };

    const rotatedStaff = rotateArray(listStaff, randomOffset);
    let staffIndex = 0;

    const newDailyItems = checklistData.map(item => {
        let areaAssignees = [];
        const templateItem = currentTemplateItems.find(i => i.id === item.id);
        const limitStaff = templateItem?.staffLimit || (item.assignees && item.assignees.length > 0 ? item.assignees.length : 1); 

        for (let i = 0; i < limitStaff; i++) {
            if (rotatedStaff.length > 0) {
                areaAssignees.push(rotatedStaff[staffIndex % rotatedStaff.length]);
                staffIndex++;
            }
        }
        return { ...item, assignees: areaAssignees.map(a => ({ id: a.id, username: a.username })) };
    });

    const dailyRef = getDailyRecordRef(activeStoreId, dateStr, null);
    await updateDoc(dailyRef, { items: newDailyItems });
    
    const updatedTemplateItems = currentTemplateItems.map(tItem => {
        const dailyItem = newDailyItems.find(d => d.id === tItem.id);
        if (dailyItem) {
            return { ...tItem, assignees: dailyItem.assignees, staffLimit: tItem.staffLimit || dailyItem.assignees.length };
        }
        return tItem;
    });
    await setDoc(templateRef, { items: updatedTemplateItems }, { merge: true });

    // Cập nhật tương lai
    const [year, month, day] = dateStr.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const currentDayNumber = parseInt(day, 10);
    const futureItems = newDailyItems.map(i => ({ ...i, completed: false, imageUrls: [], uploaders: [], completedBy: null, completedAt: null }));
    const batchPromises = [];
    
    for (let i = currentDayNumber + 1; i <= daysInMonth; i++) {
        const paddedDay = i.toString().padStart(2, '0');
        const futureDateStr = `${year}-${month}-${paddedDay}`;
        const fRef = doc(db, '8nttt_daily_records', `${activeStoreId}_${futureDateStr}`);
        batchPromises.push(setDoc(fRef, { items: futureItems, createdAt: serverTimestamp() }, { merge: true }));
        
        const oldFutureDateStr = `${year}-${parseInt(month, 10)}-${i}`;
        if (oldFutureDateStr !== futureDateStr) {
            const oldFRef = doc(db, '8nttt_daily_records', `${activeStoreId}_${oldFutureDateStr}`);
            batchPromises.push(setDoc(oldFRef, { items: futureItems, createdAt: serverTimestamp() }, { merge: true }));
        }
    }
    await Promise.all(batchPromises);

    return { success: true, message: "✅ Đã Trộn Lịch! Lịch này đã được tự động chép đè cho TOÀN BỘ các ngày còn lại trong tháng." };
}

// --- LOGIC THỐNG KÊ ---
export async function getMonthlyStats(activeStoreId, dateStr) {
    const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
    const snap = await getDoc(templateRef);
    const excludedStaffIds = snap.exists() ? (snap.data().excludedStaffIds || []) : [];

    const [year, month] = dateStr.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysArray = Array.from({length: daysInMonth}, (_, i) => i + 1);
    
    let usersStats = {};
    const fetchPromises = [];
    
    for(let i = 1; i <= daysInMonth; i++) {
        const paddedMonth = month.toString().padStart(2, '0');
        const paddedDay = i.toString().padStart(2, '0');
        const standardRecordId = `${activeStoreId}_${year}-${paddedMonth}-${paddedDay}`;
        const oldRecordId = `${activeStoreId}_${year}-${parseInt(month, 10)}-${i}`;

        fetchPromises.push(
            Promise.all([
                getDoc(doc(db, '8nttt_daily_records', standardRecordId)),
                getDoc(doc(db, '8nttt_daily_records', oldRecordId))
            ]).then(([snapNew, snapOld]) => {
                const finalSnap = snapNew.exists() ? snapNew : (snapOld.exists() ? snapOld : null);
                return { day: i, snap: finalSnap };
            })
        );
    }
    
    const results = await Promise.all(fetchPromises);
    results.forEach(({day, snap}) => {
        if(snap && snap.data().items) {
            snap.data().items.forEach(item => {
                if(item.uploaders && item.uploaders.length > 0) {
                    item.uploaders.forEach(username => {
                        if(!username) return;
                        if(!usersStats[username]) usersStats[username] = { name: username, total: 0, days: {} };
                        usersStats[username].total++;
                        usersStats[username].days[day] = (usersStats[username].days[day] || 0) + 1;
                    });
                }
                else if (item.completedBy && item.completed) {
                    const username = item.completedBy;
                    if(!usersStats[username]) usersStats[username] = { name: username, total: 0, days: {} };
                    usersStats[username].total += 4;
                    usersStats[username].days[day] = (usersStats[username].days[day] || 0) + 4;
                }
            });
        }
    });
    
    return {
        statsData: { month: `${month}/${year}`, days: daysArray, matrix: Object.values(usersStats) },
        excludedStaffIds
    };
}

// --- LOGIC CRUD KHU VỰC ---
export async function saveAreaConfig(activeStoreId, dateStr, editingAreaId, newAreaName, newStaffLimit, selectedStaffIds, allStaff, checklistData, activeRecordId) {
    const assigneesData = allStaff.filter(s => selectedStaffIds.includes(s.id)).map(s => ({ id: s.id, username: s.username }));
    const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
    const snap = await getDoc(templateRef);
    let currentItems = snap.exists() ? (snap.data().items || []) : [];
    let newItemData = null;
    
    if (editingAreaId) { 
        currentItems = currentItems.map(i => i.id === editingAreaId ? { ...i, areaName: newAreaName.trim(), staffLimit: newStaffLimit, assignees: assigneesData } : i); 
    } else { 
        newItemData = { id: 'area_' + Date.now(), areaName: newAreaName.trim(), staffLimit: newStaffLimit, assignees: assigneesData };
        currentItems.push(newItemData); 
    }
    await setDoc(templateRef, { items: currentItems }, { merge: true });
    
    const dailyRef = getDailyRecordRef(activeStoreId, dateStr, activeRecordId);
    const dailySnap = await getDoc(dailyRef);
    if (dailySnap.exists()) {
        let dailyItems = dailySnap.data().items || [];
        if (editingAreaId) dailyItems = dailyItems.map(i => i.id === editingAreaId ? { ...i, areaName: newAreaName.trim(), staffLimit: newStaffLimit, assignees: assigneesData } : i);
        else dailyItems.push({ ...newItemData, completed: false, imageUrls: [], uploaders: [], completedBy: null, completedAt: null });
        await updateDoc(dailyRef, { items: dailyItems });
    } else if (!editingAreaId && newItemData) {
        await setDoc(dailyRef, { items: [{ ...newItemData, completed: false, imageUrls: [], uploaders: [], completedBy: null, completedAt: null }], createdAt: serverTimestamp() });
    }
}

export async function removeArea(activeStoreId, dateStr, id, activeRecordId) {
    const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
    const snap = await getDoc(templateRef);
    if (snap.exists()) { 
        let currentItems = snap.data().items || []; 
        await setDoc(templateRef, { items: currentItems.filter(i => i.id !== id) }, { merge: true });
    }
    const dailyRef = getDailyRecordRef(activeStoreId, dateStr, activeRecordId);
    const dailySnap = await getDoc(dailyRef);
    if (dailySnap.exists()) { 
        let dailyItems = dailySnap.data().items || [];
        await updateDoc(dailyRef, { items: dailyItems.filter(i => i.id !== id) });
    }
}

export async function clearAllAreas(activeStoreId, dateStr, activeRecordId) {
    const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
    await setDoc(templateRef, { items: [] }, { merge: true });
    
    const dailyRef = getDailyRecordRef(activeStoreId, dateStr, activeRecordId);
    const dailySnap = await getDoc(dailyRef);
    if (dailySnap.exists()) { 
        await updateDoc(dailyRef, { items: [] });
    }
}

export async function fetchScheduleMaps(activeStoreId, dateStr) {
    const todayScheduleMap = {};
    const targetDate = new Date(dateStr);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();

    const monthStrPadded = `${year}-${String(month).padStart(2, '0')}`;
    const monthStrNormal = `${year}-${month}`;
    
    let staffSnap = await getDoc(doc(db, 'stores', activeStoreId, 'schedules', monthStrPadded));
    if (!staffSnap.exists() && monthStrPadded !== monthStrNormal) {
        staffSnap = await getDoc(doc(db, 'stores', activeStoreId, 'schedules', monthStrNormal));
    }
    
    if (staffSnap.exists()) {
        const scheduleData = staffSnap.data().data || {};
        const dayAssignments = scheduleData[String(day)] || scheduleData[day] || [];
        dayAssignments.forEach(assign => {
            if (assign && assign.staffId) todayScheduleMap[String(assign.staffId).toLowerCase()] = assign.shift;
            if (assign && assign.username) todayScheduleMap[String(assign.username).toLowerCase()] = assign.shift;
        });
    }

    const d = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    const weekId = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    const daysMap = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dayStr = daysMap[targetDate.getDay()];

    const pgSnap = await getDoc(doc(db, 'stores', activeStoreId, 'pg_schedules', weekId));
    if (pgSnap.exists()) {
        const pgData = pgSnap.data().data || {};
        for (const [pgId, shifts] of Object.entries(pgData)) {
            if (shifts && shifts[dayStr]) {
                todayScheduleMap[String(pgId).toLowerCase()] = shifts[dayStr];
            }
        }
    }
    return todayScheduleMap;
}