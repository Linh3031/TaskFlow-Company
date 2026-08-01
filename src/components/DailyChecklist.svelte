<script>
    import { onMount, onDestroy } from 'svelte';
    import { db, storage } from '../lib/firebase';
    import { collection, doc, getDoc, getDocs, setDoc, onSnapshot, query, where, updateDoc, serverTimestamp, addDoc, runTransaction } from 'firebase/firestore';
    import { currentUser } from '../lib/stores';
    import { getCurrentTimeShort, getTodayStr } from '../lib/utils';
    import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
    import * as XLSX from 'xlsx';

    import ChecklistHeader from './DailyChecklistParts/ChecklistHeader.svelte';
    import ChecklistItem from './DailyChecklistParts/ChecklistItem.svelte';
    import AreaAdminModal from './DailyChecklistParts/AreaAdminModal.svelte';
    import LightboxModal from './DailyChecklistParts/LightboxModal.svelte';
    import ChecklistStatsModal from './DailyChecklistParts/ChecklistStatsModal.svelte';

    export let activeStoreId;
    export let dateStr;
    $: isAdmin = $currentUser?.role === 'admin' || $currentUser?.role === 'super_admin';

    let checklistData = [];
    let loading = true;
    let uploadingId = null;
    let unsubscribe = null;
    let activeRecordId = '';
    
    let showAdminModal = false;
    let editingAreaId = null;
    let allStaff = [];
    let newAreaName = '';
    let newStaffLimit = 0;
    let newPgLimit = 0;   
    let selectedStaffIds = [];
    let currentItemAssignees = []; 
    
    let showLightbox = false;
    let lightboxImages = [];
    let lightboxIndex = 0;
    
    let showStatsModal = false;
    let statsData = { matrix: [], days: [], month: '' };
    let statsLoading = false;

    $: sortedChecklistData = [...checklistData].sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
    });

    $: if (activeStoreId && dateStr) {
        activeRecordId = '';
        initAndLoadChecklist();
    }

    async function writeDebugLog(action, reason) { 
        try { await addDoc(collection(db, 'debug_8nttt_logs'), { action, storeId: activeStoreId, dateStr, reason, user: $currentUser?.username || 'unknown', timestamp: serverTimestamp() }); } catch (e) { } 
    }
    
    function getOldFormatDate(dStr) { 
        if (!dStr) return '';
        const parts = dStr.split('-');
        if (parts.length !== 3) return dStr; 
        return `${parts[0]}-${parseInt(parts[1], 10)}-${parseInt(parts[2], 10)}`;
    }
    
    function getDailyRecordRef() { 
        const recordId = activeRecordId || `${activeStoreId}_${dateStr}`; 
        return doc(db, '8nttt_daily_records', recordId);
    }

    async function initAndLoadChecklist() {
        if (unsubscribe) unsubscribe();
        loading = true;

        const standardRecordId = `${activeStoreId}_${dateStr}`;
        const oldRecordId = `${activeStoreId}_${getOldFormatDate(dateStr)}`;

        let dailyRef = doc(db, '8nttt_daily_records', standardRecordId);
        let dailySnap = await getDoc(dailyRef);
        activeRecordId = standardRecordId;

        if (!dailySnap.exists() && standardRecordId !== oldRecordId) {
            const oldDailyRef = doc(db, '8nttt_daily_records', oldRecordId);
            const oldDailySnap = await getDoc(oldDailyRef);
            if (oldDailySnap.exists()) { dailyRef = oldDailyRef; dailySnap = oldDailySnap; activeRecordId = oldRecordId; }
        }

        const todayStr = getTodayStr();
        const isPastDate = dateStr < todayStr;

        if (!dailySnap.exists()) {
            if (isPastDate) await writeDebugLog('DETECTED_MISSING', 'Load template mặc định');
            const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
            const templateSnap = await getDoc(templateRef);
            let defaultData = templateSnap.exists() && templateSnap.data().items ?
            templateSnap.data().items.map(item => ({ ...item, completed: false, imageUrls: [], uploaders: [], completedBy: null, completedAt: null })) : [];
            
            if (!isPastDate) { await setDoc(dailyRef, { items: defaultData, createdAt: serverTimestamp() }); } 
            else { checklistData = defaultData; loading = false; return; }
        }

        unsubscribe = onSnapshot(dailyRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().items) {
                checklistData = docSnap.data().items.map(i => ({ ...i, imageUrls: i.imageUrls || (i.imageUrl ? [i.imageUrl] : []), uploaders: i.uploaders || [] }));
            } else { checklistData = []; }
            loading = false;
        });
    }

    function scrollToMyArea() {
        if (!$currentUser) return;
        const myArea = sortedChecklistData.find(item => (item.assignees || []).some(a => a.id === $currentUser.id || (a.username && a.username.toLowerCase() === $currentUser.username?.toLowerCase())));
        if (myArea) {
            const wrapper = document.getElementById('area-' + myArea.id);
            if (wrapper) {
                wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const target = wrapper.querySelector('div.bg-white') || wrapper.querySelector('div.bg-slate-50') || wrapper.firstElementChild;
                if (target) {
                    const originalTransition = target.style.transition;
                    target.style.transition = "all 0.5s ease"; target.classList.add('!bg-yellow-200', '!border-yellow-400', 'shadow-lg');
                    setTimeout(() => { target.classList.remove('!bg-yellow-200', '!border-yellow-400', 'shadow-lg'); target.style.transition = originalTransition; }, 2000);
                }
            } else { alert("Đã tìm thấy khu vực nhưng giao diện chưa tải kịp!"); }
        } else { alert("Hôm nay bạn chưa được phân công!"); }
    }

    async function fetchAllStaff() {
        if (allStaff.length === 0) {
            const q = query(collection(db, 'users'), where('storeIds', 'array-contains', activeStoreId));
            const snap = await getDocs(q);
            allStaff = snap.docs.map(d => ({ id: d.id, username: d.data().username, role: d.data().role })).filter(s => s.role !== 'admin' && s.role !== 'super_admin' && s.username).sort((a, b) => a.username.localeCompare(b.username));
        }
    }

    async function handleAutoRotate() {
        if (!confirm("⚠️ TỰ ĐỘNG TRỘN LỊCH:\nHệ thống sẽ chia lại toàn bộ người vào các khu vực theo định mức đã cài. Quá trình này sẽ GHI ĐÈ dữ liệu hôm nay.\n\nBạn có chắc chắn?")) return;

        await fetchAllStaff();

        const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
        const snap = await getDoc(templateRef);
        let currentTemplateItems = snap.exists() ? (snap.data().items || []) : [];

        const totalNeeded = currentTemplateItems.reduce((sum, item) => sum + (item.staffLimit || 0) + (item.pgLimit || 0), 0);
        if (totalNeeded === 0) {
            alert("❌ THẤT BẠI: Bạn chưa cài đặt số lượng người cần thiết (Định Mức) cho bất kỳ khu vực nào.\nVui lòng bấm 'Thêm Khu Vực' hoặc 'Sửa' khu vực hiện tại để điền số Nhân Viên / PG, hoặc Import bằng file Excel để hệ thống tự học định mức.");
            return;
        }

        let listStaff = allStaff.filter(s => !(s.role || '').toLowerCase().includes('pg')).sort((a,b) => a.username.localeCompare(b.username));
        let listPG = allStaff.filter(s => (s.role || '').toLowerCase().includes('pg')).sort((a,b) => a.username.localeCompare(b.username));

        const dayNumber = parseInt(dateStr.split('-')[2], 10) || 1;
        
        const rotateArray = (arr, steps) => {
            if (arr.length === 0) return [];
            const offset = steps % arr.length;
            return [...arr.slice(offset), ...arr.slice(0, offset)];
        };

        const rotatedStaff = rotateArray(listStaff, dayNumber);
        const rotatedPG = rotateArray(listPG, dayNumber);

        let staffIndex = 0;
        let pgIndex = 0;

        const newDailyItems = checklistData.map(item => {
            let areaAssignees = [];
            const templateItem = currentTemplateItems.find(i => i.id === item.id);
            const limitStaff = templateItem?.staffLimit || 0;
            const limitPG = templateItem?.pgLimit || 0;

            for (let i = 0; i < limitStaff; i++) {
                if (rotatedStaff.length > 0) {
                    areaAssignees.push(rotatedStaff[staffIndex % rotatedStaff.length]);
                    staffIndex++;
                }
            }
            for (let i = 0; i < limitPG; i++) {
                if (rotatedPG.length > 0) {
                    areaAssignees.push(rotatedPG[pgIndex % rotatedPG.length]);
                    pgIndex++;
                }
            }

            return { ...item, assignees: areaAssignees.map(a => ({ id: a.id, username: a.username })) };
        });

        const dailyRef = getDailyRecordRef();
        await updateDoc(dailyRef, { items: newDailyItems });
        
        alert("✅ Đã hoàn tất Trộn Lịch xoay vòng!");
    }

    async function loadAndShowStats() {
        showStatsModal = true;
        statsLoading = true;
        await fetchAllStaff();

        console.warn("====== 🚀 BẮT ĐẦU CÀO DATA THỐNG KÊ (DEBUG MODE) ======");
        const [year, month] = dateStr.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        const daysArray = Array.from({length: daysInMonth}, (_, i) => i + 1);
        
        try {
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
            
            statsData = { month: `${month}/${year}`, days: daysArray, matrix: Object.values(usersStats) };
        } catch (error) {
            console.error("Lỗi lấy thống kê tháng:", error);
        } finally { statsLoading = false; }
    }

    async function openAdminModal(event) {
        const item = event?.detail || null;
        showAdminModal = true;
        
        await fetchAllStaff();
        
        if (item) { 
            editingAreaId = item.id;
            newAreaName = item.areaName;
            
            const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
            const snap = await getDoc(templateRef);
            let currentTemplateItems = snap.exists() ? (snap.data().items || []) : [];
            const tItem = currentTemplateItems.find(i => i.id === item.id);
            newStaffLimit = tItem?.staffLimit || 0;
            newPgLimit = tItem?.pgLimit || 0;

            selectedStaffIds = (item.assignees || []).map(a => a.id);
            currentItemAssignees = item.assignees || []; 
        } else { 
            editingAreaId = null;
            newAreaName = ''; 
            newStaffLimit = 0;
            newPgLimit = 0;
            selectedStaffIds = []; 
            currentItemAssignees = [];
        }
    }

    async function saveAreaToTemplate() {
        if (!newAreaName.trim()) return alert("Vui lòng nhập tên khu vực!");
        
        const assigneesData = allStaff.filter(s => selectedStaffIds.includes(s.id)).map(s => ({ id: s.id, username: s.username }));
        
        const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
        const snap = await getDoc(templateRef);
        let currentItems = snap.exists() ? (snap.data().items || []) : [];
        let newItemData = null;
        
        if (editingAreaId) { 
            currentItems = currentItems.map(i => i.id === editingAreaId ? { ...i, areaName: newAreaName.trim(), staffLimit: newStaffLimit, pgLimit: newPgLimit, assignees: assigneesData } : i); 
        } else { 
            newItemData = { id: 'area_' + Date.now(), areaName: newAreaName.trim(), staffLimit: newStaffLimit, pgLimit: newPgLimit, assignees: assigneesData };
            currentItems.push(newItemData); 
        }
        await setDoc(templateRef, { items: currentItems }, { merge: true });
        
        const dailyRef = getDailyRecordRef();
        const dailySnap = await getDoc(dailyRef);
        if (dailySnap.exists()) {
            let dailyItems = dailySnap.data().items || [];
            if (editingAreaId) dailyItems = dailyItems.map(i => i.id === editingAreaId ? { ...i, areaName: newAreaName.trim(), staffLimit: newStaffLimit, pgLimit: newPgLimit, assignees: assigneesData } : i);
            else dailyItems.push({ ...newItemData, completed: false, imageUrls: [], uploaders: [], completedBy: null, completedAt: null });
            await updateDoc(dailyRef, { items: dailyItems });
        } else if (!editingAreaId && newItemData) {
            await setDoc(dailyRef, { items: [{ ...newItemData, completed: false, imageUrls: [], uploaders: [], completedBy: null, completedAt: null }], createdAt: serverTimestamp() });
        }
        showAdminModal = false;
    }

    async function deleteArea(event) {
        const { id, name } = event.detail;
        if (!confirm(`⚠️ XÁC NHẬN XÓA:\nBạn có chắc chắn muốn xóa khu vực "${name}" không?`)) return;
        const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
        const snap = await getDoc(templateRef);
        if (snap.exists()) { 
            let currentItems = snap.data().items || []; 
            await setDoc(templateRef, { items: currentItems.filter(i => i.id !== id) }, { merge: true });
        }
        const dailyRef = getDailyRecordRef();
        const dailySnap = await getDoc(dailyRef);
        if (dailySnap.exists()) { 
            let dailyItems = dailySnap.data().items || [];
            await updateDoc(dailyRef, { items: dailyItems.filter(i => i.id !== id) });
        }
    }

    async function handleDeleteAll() {
        if (!confirm(`⚠️ NGUY HIỂM TỘT ĐỘ:\nBạn đang yêu cầu XÓA TOÀN BỘ danh sách khu vực.\nThao tác này KHÔNG THỂ KHÔI PHỤC và sẽ làm mất dữ liệu đã chụp hôm nay.\n\nBạn có chắc chắn muốn tiếp tục?`)) return;
        
        try {
            const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
            await setDoc(templateRef, { items: [] }, { merge: true });
            
            const dailyRef = getDailyRecordRef();
            const dailySnap = await getDoc(dailyRef);
            if (dailySnap.exists()) { 
                await updateDoc(dailyRef, { items: [] });
            }
            alert("✅ Đã dọn dẹp trắng toàn bộ khu vực.");
        } catch (error) {
            alert("❌ Lỗi khi xóa: " + error.message);
        }
    }

    // --- LOGIC XUẤT FILE MẪU CÓ HƯỚNG DẪN TRỰC QUAN ---
    async function handleExportTemplate() {
        await fetchAllStaff();
        
        const wsData = [];
        
        // 1. Dòng Mock Data Hướng Dẫn (Sẽ bị bỏ qua khi Import)
        wsData.push({ 
            'Tên Nhân Sự': '👉 HƯỚNG DẪN SỬ DỤNG:',
            'Quầy Mẫu 1 (Đổi Tên Tùy Ý)': "Gõ chữ 'x' vào ô này",
            'Quầy Mẫu 2 (Đổi Tên Tùy Ý)': "để phân công người.",
            'Quầy Mẫu 3 (Đổi Tên Tùy Ý)': "Thêm/Xóa cột tùy ý."
        });

        // 2. Dữ liệu thật
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

    async function handleExportExcel() {
        await fetchAllStaff();
        
        if (checklistData.length === 0) {
            alert("⚠️ CẢNH BÁO: Chưa có khu vực nào để xuất. Đang tự động chuyển sang chế độ Xuất File Mẫu.");
            return handleExportTemplate();
        }

        const wsData = allStaff.map(staff => {
            const row = { 'Tên Nhân Sự': staff.username };
            checklistData.forEach(item => {
                const isAssigned = (item.assignees || []).some(a => a.id === staff.id);
                row[item.areaName] = isAssigned ? 'x' : '';
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(wsData);
        const colWidths = [{ wch: 30 }]; 
        checklistData.forEach(() => colWidths.push({ wch: 20 })); 
        ws['!cols'] = colWidths;
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "PhanCong_8NTTT");
        XLSX.writeFile(wb, `PhanCong_8NTTT_${dateStr}.xlsx`);
    }

    // --- LOGIC NẠP EXCEL & TỰ ĐỘNG TÍNH ĐỊNH MỨC ---
    async function handleImportExcel(event) {
        const file = event.detail.file;
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                await fetchAllStaff();
                let unfoundUsers = [];
                let updatedCount = 0;
                
                const staffMap = new Map(allStaff.map(s => [s.username.toLowerCase().trim(), s]));
                const newAreaAssigneesMap = new Map();

                // Quét 1: Tạo Map các khu vực từ header của Excel
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

                // Quét 2: Gắn user vào khu vực (Bỏ qua dòng hướng dẫn)
                for (let row of jsonData) {
                    const staffNameRaw = row['Tên Nhân Sự'] || '';
                    if (!staffNameRaw || staffNameRaw.includes('HƯỚNG DẪN')) continue; // Bỏ qua Mock Data
                    
                    const staff = staffMap.get(staffNameRaw.toLowerCase().trim());
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

                const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
                const snap = await getDoc(templateRef);
                let currentTemplateItems = snap.exists() ? (snap.data().items || []) : [];
                
                const dailyRef = getDailyRecordRef();
                const dailySnap = await getDoc(dailyRef);
                let currentDailyItems = dailySnap.exists() ? (dailySnap.data().items || []) : checklistData;

                let areaMapTemplate = new Map(currentTemplateItems.map(i => [i.areaName.toLowerCase().trim(), i]));
                let areaMapDaily = new Map(currentDailyItems.map(i => [i.areaName.toLowerCase().trim(), i]));

                for (const [areaNameLower, data] of newAreaAssigneesMap.entries()) {
                    // Logic Auto-learn: Tự động tính toán định mức (Capacity) từ danh sách được gán
                    let staffCount = 0;
                    let pgCount = 0;
                    
                    data.assignees.forEach(a => {
                        const staffInfo = staffMap.get(a.username.toLowerCase().trim());
                        if (staffInfo && (staffInfo.role || '').toLowerCase().includes('pg')) {
                            pgCount++;
                        } else {
                            staffCount++;
                        }
                    });

                    // Cập nhật hoặc tạo mới Area
                    if (areaMapTemplate.has(areaNameLower)) {
                        let existing = areaMapTemplate.get(areaNameLower);
                        existing.assignees = data.assignees;
                        existing.staffLimit = staffCount; // Máy tự học định mức
                        existing.pgLimit = pgCount;       // Máy tự học định mức
                    } else {
                        const newItem = { 
                            id: 'area_' + Date.now() + Math.random().toString(36).substring(2,9), 
                            areaName: data.areaName, 
                            assignees: data.assignees,
                            staffLimit: staffCount,   // Ghi lại định mức để sau này Auto-Rotate
                            pgLimit: pgCount 
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

                await setDoc(templateRef, { items: currentTemplateItems }, { merge: true });
                if (dailySnap.exists()) {
                    await updateDoc(dailyRef, { items: currentDailyItems });
                } else {
                    await setDoc(dailyRef, { items: currentDailyItems, createdAt: serverTimestamp() });
                }

                let msg = `✅ Đã nạp và cập nhật thành công ${updatedCount} khu vực!\n💡 Hệ thống đã tự động tính toán định mức cho nút "Trộn Lịch".\n`;
                if (unfoundUsers.length > 0) {
                    const uniqueUnfound = [...new Set(unfoundUsers)];
                    msg += `\n⚠️ CẢNH BÁO: Phát hiện nhân sự không tồn tại (đã bỏ qua):\n- ${uniqueUnfound.join('\n- ')}\n\nVui lòng không sửa tên nhân sự trên dòng Excel.`;
                }
                alert(msg);
                
            } catch (error) {
                alert("Lỗi đọc file Excel: " + error.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function compressImage(file, maxEdge = 800, quality = 0.5) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image(); img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width; let height = img.height;
                    if (width > height) { if (width > maxEdge) { height = Math.round((height * maxEdge) / width); width = maxEdge; } } 
                    else { if (height > maxEdge) { width = Math.round((width * maxEdge) / height); height = maxEdge; } }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    }

    async function handleUploadImage(eventObj) {
        const { event, itemId } = eventObj.detail;
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const item = checklistData.find(i => i.id === itemId);
        const remainingSlots = 4 - (item.imageUrls ? item.imageUrls.length : 0);
        const filesToProcess = Array.from(files).slice(0, remainingSlots);
        if (filesToProcess.length === 0) return;
        uploadingId = itemId;

        try {
            const uploadPromises = filesToProcess.map(async (file) => {
                const compressedBlob = await compressImage(file);
                const fileName = `8nttt_${activeStoreId}_${dateStr}_${itemId}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                const imageRef = ref(storage, `8nttt_images/${activeStoreId}/${dateStr}/${fileName}`);
                await uploadBytes(imageRef, compressedBlob);
                return await getDownloadURL(imageRef);
            });
            const newUploadedUrls = await Promise.all(uploadPromises);
            const currentUserUsername = $currentUser.username || 'unknown';
            const newUploaders = newUploadedUrls.map(() => currentUserUsername);
            const dailyRef = getDailyRecordRef();
            const yyyyMM = dateStr.substring(0, 7);
            const currentDayNumber = parseInt(dateStr.split('-')[2], 10);
            const monthlyStatsRef = doc(db, '8nttt_monthly_stats', `${activeStoreId}_${yyyyMM}`);
            
            await runTransaction(db, async (transaction) => {
                const dailyDoc = await transaction.get(dailyRef);
                const monthlyDoc = await transaction.get(monthlyStatsRef);
                let serverItems = dailyDoc.exists() ? (dailyDoc.data().items || []) : checklistData;
                const updatedItems = serverItems.map(i => {
                    if (i.id === itemId) {
                        const mergedUrls = [...(i.imageUrls || []), ...newUploadedUrls];
                        const mergedUploaders = [...(i.uploaders || []), ...newUploaders];
                        const isNowCompleted = mergedUrls.length >= 4;
                        return { ...i, imageUrls: mergedUrls, uploaders: mergedUploaders, completed: isNowCompleted, completedBy: isNowCompleted ? currentUserUsername : i.completedBy, completedAt: isNowCompleted ? getCurrentTimeShort() : i.completedAt };
                    }
                    return i;
                });

                let monthlyData = monthlyDoc.exists() ? monthlyDoc.data() : { users: {} };
                let usersStats = monthlyData.users || {};
                if (!usersStats[currentUserUsername]) { usersStats[currentUserUsername] = { name: currentUserUsername, total: 0, days: {} }; }
                
                const addedCount = newUploadedUrls.length;
                usersStats[currentUserUsername].total += addedCount;
                usersStats[currentUserUsername].days[currentDayNumber] = (usersStats[currentUserUsername].days[currentDayNumber] || 0) + addedCount;
                transaction.set(dailyRef, { items: updatedItems, createdAt: dailyDoc.exists() ? dailyDoc.data().createdAt : serverTimestamp() }, { merge: true });
                transaction.set(monthlyStatsRef, { users: usersStats }, { merge: true });
            });
        } catch (error) { 
            alert("Lỗi tải ảnh lên: " + error.message);
        } finally { 
            uploadingId = null;
            event.target.value = null;
        }
    }

    function openLightbox(event) { lightboxImages = event.detail.images; lightboxIndex = event.detail.index; showLightbox = true; }
    onDestroy(() => { if (unsubscribe) unsubscribe(); });
</script>

<div class="w-full h-full flex flex-col bg-slate-50 rounded-xl border border-cyan-200 shadow-sm overflow-hidden relative">
    <ChecklistHeader {isAdmin} on:autoRotate={handleAutoRotate} on:openAdmin={() => openAdminModal(null)} on:openStats={loadAndShowStats} on:locate={scrollToMyArea} />
    <div class="flex-1 overflow-y-auto p-2 sm:p-3 bg-slate-50 space-y-3">
        {#if loading}
            <div class="flex justify-center py-10"><span class="material-icons-round animate-spin text-cyan-500 text-3xl">sync</span></div>
        {:else if sortedChecklistData.length === 0}
            <div class="text-center py-10 text-slate-400">
                <span class="material-icons-round text-5xl opacity-50 mb-2">assignment_turned_in</span>
                <p class="font-bold text-sm">Chưa có dữ liệu hoặc đã bị xóa.</p>
            </div>
        {:else}
            {#each sortedChecklistData as item (item.id)}
                <div id="area-{item.id}">
                    <ChecklistItem {item} {isAdmin} {uploadingId} on:edit={openAdminModal} on:delete={deleteArea} on:upload={handleUploadImage} on:openLightbox={openLightbox} />
                </div>
            {/each}
        {/if}
    </div>
</div>

<LightboxModal show={showLightbox} images={lightboxImages} currentIndex={lightboxIndex} on:close={() => showLightbox = false} on:updateIndex={(e) => lightboxIndex = e.detail} />

<AreaAdminModal show={showAdminModal} {editingAreaId} {allStaff} {currentItemAssignees} bind:newAreaName bind:newStaffLimit bind:newPgLimit bind:selectedStaffIds on:close={() => showAdminModal = false} on:save={saveAreaToTemplate} />

<ChecklistStatsModal 
    show={showStatsModal} 
    {statsData} 
    {statsLoading} 
    {allStaff} 
    checklistData={sortedChecklistData} 
    on:close={() => showStatsModal = false} 
    on:editArea={(e) => openAdminModal({detail: e.detail})} 
    on:exportExcel={handleExportExcel}
    on:importExcel={handleImportExcel}
    on:deleteAll={handleDeleteAll}
    on:exportTemplate={handleExportTemplate}
/>