<script>
    import { onMount, onDestroy } from 'svelte';
    import { db, storage } from '../lib/firebase';
    // [CodeGenesis] Đã thêm getDocs vào import
    import { collection, doc, getDoc, getDocs, setDoc, onSnapshot, query, where, updateDoc, serverTimestamp, addDoc, runTransaction } from 'firebase/firestore';
    import { currentUser } from '../lib/stores';
    import { getCurrentTimeShort, getTodayStr } from '../lib/utils';
    import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
    let selectedStaffIds = [];
    
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

    async function writeDebugLog(action, reason) { try { await addDoc(collection(db, 'debug_8nttt_logs'), { action, storeId: activeStoreId, dateStr, reason, user: $currentUser?.username || 'unknown', timestamp: serverTimestamp() });
    } catch (e) { } }
    function getOldFormatDate(dStr) { if (!dStr) return ''; const parts = dStr.split('-');
    if (parts.length !== 3) return dStr; return `${parts[0]}-${parseInt(parts[1], 10)}-${parseInt(parts[2], 10)}`;
    }
    function getDailyRecordRef() { const recordId = activeRecordId || `${activeStoreId}_${dateStr}`; return doc(db, '8nttt_daily_records', recordId);
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
            if (oldDailySnap.exists()) { dailyRef = oldDailyRef; dailySnap = oldDailySnap; activeRecordId = oldRecordId;
            }
        }

        const todayStr = getTodayStr();
        const isPastDate = dateStr < todayStr;

        if (!dailySnap.exists()) {
            if (isPastDate) await writeDebugLog('DETECTED_MISSING', 'Load template mặc định');
            const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
            const templateSnap = await getDoc(templateRef);
            
            let defaultData = templateSnap.exists() && templateSnap.data().items ?
            templateSnap.data().items.map(item => ({ ...item, completed: false, imageUrls: [], uploaders: [], completedBy: null, completedAt: null })) : [];
            if (!isPastDate) { await setDoc(dailyRef, { items: defaultData, createdAt: serverTimestamp() });
            } 
            else { checklistData = defaultData;
            loading = false; return; }
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
            } else { alert("Đã tìm thấy khu vực nhưng giao diện chưa tải kịp!");
            }
        } else { alert("Hôm nay bạn chưa được phân công!");
        }
    }

    async function loadAndShowStats() {
        showStatsModal = true;
        statsLoading = true;
        
        const [year, month] = dateStr.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        const daysArray = Array.from({length: daysInMonth}, (_, i) => i + 1);
        try {
            const monthlyStatsRef = doc(db, '8nttt_monthly_stats', `${activeStoreId}_${year}-${month}`);
            const snap = await getDoc(monthlyStatsRef);
            
            let matrix = [];
            if (snap.exists() && snap.data().users) {
                matrix = Object.values(snap.data().users);
            }
            statsData = { month: `${month}/${year}`, days: daysArray, matrix: matrix };
        } catch (error) {
            console.error("Lỗi lấy thống kê tháng:", error);
        } finally {
            statsLoading = false;
        }
    }

    async function openAdminModal(event) {
        const item = event?.detail || null;
        showAdminModal = true;
        
        // [CodeGenesis] Bây giờ getDocs đã được import, phần này sẽ chạy mượt mà
        if (allStaff.length === 0) {
            const q = query(collection(db, 'users'), where('storeIds', 'array-contains', activeStoreId));
            const snap = await getDocs(q);
            allStaff = snap.docs.map(d => ({ id: d.id, username: d.data().username, role: d.data().role })).filter(s => s.role !== 'admin' && s.role !== 'super_admin' && s.username).sort((a, b) => a.username.localeCompare(b.username));
        }
        
        if (item) { editingAreaId = item.id; newAreaName = item.areaName;
        selectedStaffIds = (item.assignees || []).map(a => a.id); } 
        else { editingAreaId = null;
        newAreaName = ''; selectedStaffIds = []; }
    }

    async function saveAreaToTemplate() {
        if (!newAreaName.trim() || selectedStaffIds.length === 0) return alert("Vui lòng nhập tên và chọn người phụ trách!");
        const assigneesData = allStaff.filter(s => selectedStaffIds.includes(s.id)).map(s => ({ id: s.id, username: s.username }));
        const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
        const snap = await getDoc(templateRef);
        let currentItems = snap.exists() ?
        (snap.data().items || []) : [];
        let newItemData = null;

        if (editingAreaId) { currentItems = currentItems.map(i => i.id === editingAreaId ? { ...i, areaName: newAreaName.trim(), assignees: assigneesData } : i);
        } 
        else { newItemData = { id: 'area_' + Date.now(), areaName: newAreaName.trim(), assignees: assigneesData };
        currentItems.push(newItemData); }
        await setDoc(templateRef, { items: currentItems }, { merge: true });
        const dailyRef = getDailyRecordRef();
        const dailySnap = await getDoc(dailyRef);
        if (dailySnap.exists()) {
            let dailyItems = dailySnap.data().items || [];
            if (editingAreaId) dailyItems = dailyItems.map(i => i.id === editingAreaId ? { ...i, areaName: newAreaName.trim(), assignees: assigneesData } : i);
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
        if (snap.exists()) { let currentItems = snap.data().items || []; await setDoc(templateRef, { items: currentItems.filter(i => i.id !== id) }, { merge: true });
        }
        
        const dailyRef = getDailyRecordRef();
        const dailySnap = await getDoc(dailyRef);
        if (dailySnap.exists()) { let dailyItems = dailySnap.data().items || [];
        await updateDoc(dailyRef, { items: dailyItems.filter(i => i.id !== id) });
        }
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
                        return { ...i, imageUrls: mergedUrls, uploaders: mergedUploaders, completed: 
                        isNowCompleted, completedBy: isNowCompleted ? currentUserUsername : i.completedBy, completedAt: isNowCompleted ? getCurrentTimeShort() : i.completedAt };
                    }
                    return i;
                });

                let monthlyData = monthlyDoc.exists() ?
                monthlyDoc.data() : { users: {} };
                let usersStats = monthlyData.users || {};
                if (!usersStats[currentUserUsername]) {
                    usersStats[currentUserUsername] = { name: currentUserUsername, total: 0, days: {} };
                }
                
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

    function openLightbox(event) { lightboxImages = event.detail.images; lightboxIndex = event.detail.index;
        showLightbox = true; }
    onDestroy(() => { if (unsubscribe) unsubscribe(); });
</script>

<div class="w-full h-full flex flex-col bg-slate-50 rounded-xl border border-cyan-200 shadow-sm overflow-hidden relative">
    <ChecklistHeader {isAdmin} on:openAdmin={() => openAdminModal(null)} on:openStats={loadAndShowStats} on:locate={scrollToMyArea} />
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
<AreaAdminModal show={showAdminModal} {editingAreaId} {allStaff} bind:newAreaName bind:selectedStaffIds on:close={() => showAdminModal = false} on:save={saveAreaToTemplate} />
<ChecklistStatsModal show={showStatsModal} {statsData} {statsLoading} on:close={() => showStatsModal = false} />