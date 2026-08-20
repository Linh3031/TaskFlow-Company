<script>
    import { onMount, onDestroy } from 'svelte';
    import { currentUser } from '../lib/stores';
    
    // Import các Module Xử Lý Độc Lập
    import { exportTemplateData, exportExcelData, importExcelData } from './DailyChecklistParts/handlers/excelHandler.js';
    import { processAndUploadImages } from './DailyChecklistParts/handlers/imageHandler.js';
    import { 
        subscribeToChecklist, fetchAllStaffData, saveExcludedConfig, executeAutoRotate, 
        getMonthlyStats, saveAreaConfig, removeArea, clearAllAreas, fetchScheduleMaps 
    } from './DailyChecklistParts/handlers/dataSection.js';

    import ChecklistHeader from './DailyChecklistParts/ChecklistHeader.svelte';
    import ChecklistItem from './DailyChecklistParts/ChecklistItem.svelte';
    import AreaAdminModal from './DailyChecklistParts/AreaAdminModal.svelte';
    import LightboxModal from './DailyChecklistParts/LightboxModal.svelte';
    import ChecklistStatsModal from './DailyChecklistParts/ChecklistStatsModal.svelte';

    export let activeStoreId;
    export let dateStr;
    $: isAdmin = $currentUser?.role === 'admin' || $currentUser?.role === 'super_admin';

    // State UI
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
    let selectedStaffIds = [];
    let currentItemAssignees = []; 
    
    let showLightbox = false;
    let lightboxImages = [];
    let lightboxIndex = 0;
    
    let showStatsModal = false;
    let statsData = { matrix: [], days: [], month: '' };
    let statsLoading = false;
    let excludedStaffIds = [];

    let todayScheduleMap = {}; 
    let scheduleLoading = false;

    $: sortedChecklistData = [...checklistData].sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
    });

    $: if (activeStoreId && dateStr) {
        initChecklist();
        loadSchedules(); 
    }

    async function initChecklist() {
        if (unsubscribe) unsubscribe();
        loading = true;
        const res = await subscribeToChecklist(activeStoreId, dateStr, $currentUser, (data, recordId) => {
            checklistData = data;
            activeRecordId = recordId;
            loading = false;
        });
        if (res) {
            unsubscribe = res.unsubscribe;
            activeRecordId = res.activeRecordId;
        }
    }

    async function loadSchedules() {
        scheduleLoading = true;
        todayScheduleMap = await fetchScheduleMaps(activeStoreId, dateStr);
        scheduleLoading = false;
    }

    async function ensureStaffLoaded() {
        if (allStaff.length === 0) allStaff = await fetchAllStaffData(activeStoreId);
    }

    // --- Các Hàm Điều Phối Action ---

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

    async function handleSaveExcluded(event) {
        try {
            await saveExcludedConfig(activeStoreId, event.detail);
            excludedStaffIds = event.detail;
            alert("✅ Đã lưu cấu hình Loại Trừ nhân sự khỏi tính năng Trộn Lịch.");
        } catch (error) { alert("❌ Lỗi khi lưu cấu hình: " + error.message); }
    }

    async function handleAutoRotate() {
        if (!confirm("⚠️ TỰ ĐỘNG TRỘN LỊCH:\nHệ thống sẽ chia lại người vào các khu vực.\nLịch này sẽ được áp dụng cho ngày hôm nay và GHI ĐÈ LÊN TOÀN BỘ CÁC NGÀY TƯƠNG LAI trong tháng này.\n\nBạn có chắc chắn?")) return;
        await ensureStaffLoaded();
        const res = await executeAutoRotate(activeStoreId, dateStr, allStaff, checklistData);
        alert(res.message);
    }

    async function loadAndShowStats() {
        showStatsModal = true;
        statsLoading = true;
        await ensureStaffLoaded();
        try {
            const res = await getMonthlyStats(activeStoreId, dateStr);
            statsData = res.statsData;
            excludedStaffIds = res.excludedStaffIds;
        } catch (error) { console.error("Lỗi lấy thống kê:", error); } 
        finally { statsLoading = false; }
    }

    async function openAdminModal(event) {
        const item = event?.detail || null;
        showAdminModal = true;
        await ensureStaffLoaded();
        
        if (item) { 
            editingAreaId = item.id;
            newAreaName = item.areaName;
            newStaffLimit = item.staffLimit || 0; 
            selectedStaffIds = (item.assignees || []).map(a => a.id);
            currentItemAssignees = item.assignees || []; 
        } else { 
            editingAreaId = null;
            newAreaName = ''; 
            newStaffLimit = 0;
            selectedStaffIds = []; 
            currentItemAssignees = [];
        }
    }

    async function saveAreaToTemplate() {
        if (!newAreaName.trim()) return alert("Vui lòng nhập tên khu vực!");
        await saveAreaConfig(activeStoreId, dateStr, editingAreaId, newAreaName, newStaffLimit, selectedStaffIds, allStaff, checklistData, activeRecordId);
        showAdminModal = false;
    }

    async function deleteArea(event) {
        const { id, name } = event.detail;
        if (!confirm(`⚠️ XÁC NHẬN XÓA:\nBạn có chắc chắn muốn xóa khu vực "${name}" không?`)) return;
        await removeArea(activeStoreId, dateStr, id, activeRecordId);
    }

    async function handleDeleteAll() {
        if (!confirm(`⚠️ NGUY HIỂM TỘT ĐỘ:\nBạn đang yêu cầu XÓA TOÀN BỘ danh sách khu vực.\nThao tác này KHÔNG THỂ KHÔI PHỤC và sẽ làm mất dữ liệu đã chụp hôm nay.\n\nBạn có chắc chắn muốn tiếp tục?`)) return;
        try {
            await clearAllAreas(activeStoreId, dateStr, activeRecordId);
            alert("✅ Đã dọn dẹp trắng toàn bộ khu vực.");
        } catch (error) { alert("❌ Lỗi khi xóa: " + error.message); }
    }

    async function handleExportTemplate() {
        await ensureStaffLoaded();
        await exportTemplateData(activeStoreId, allStaff);
    }

    async function handleExportExcel() {
        await ensureStaffLoaded();
        const res = await exportExcelData(activeStoreId, dateStr, checklistData, allStaff);
        if (!res.success) alert(res.message);
    }

    async function handleImportExcel(event) {
        const file = event.detail.file;
        if (!file) return;
        await ensureStaffLoaded();
        try {
            const res = await importExcelData(file, activeStoreId, dateStr, activeRecordId, checklistData, allStaff);
            alert(res.message);
        } catch (error) { alert("Lỗi đọc file Excel: " + error.message); }
        event.target.value = null;
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
            const currentUserUsername = $currentUser.username || 'unknown';
            await processAndUploadImages(filesToProcess, activeStoreId, dateStr, itemId, checklistData, currentUserUsername, activeRecordId);
        } catch (error) { alert("Lỗi tải ảnh lên: " + error.message); } 
        finally { 
            uploadingId = null;
            event.target.value = null;
        }
    }

    function openLightbox(event) { lightboxImages = event.detail.images; lightboxIndex = event.detail.index; showLightbox = true; }
    onDestroy(() => { if (unsubscribe) unsubscribe(); });
</script>

<div class="w-full h-full flex flex-col bg-slate-50 rounded-xl border border-cyan-200 shadow-sm overflow-hidden relative">
    <ChecklistHeader {isAdmin} on:autoRotate={handleAutoRotate} on:openAdmin={() => openAdminModal(null)} on:openStats={loadAndShowStats} on:locate={scrollToMyArea} />
    
    {#if scheduleLoading}
        <div class="bg-indigo-50 border-b border-indigo-100 p-1.5 flex justify-center items-center gap-2">
            <span class="material-icons-round text-[12px] text-indigo-500 animate-spin">sync</span>
            <span class="text-[10px] text-indigo-600 font-bold">Đang đồng bộ Lịch làm việc để xét trạng thái OFF...</span>
        </div>
    {/if}

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
                    <ChecklistItem 
                        {item} 
                        {isAdmin} 
                        {uploadingId}
                        {todayScheduleMap} 
                        {dateStr}
                        on:edit={openAdminModal} 
                        on:delete={deleteArea} 
                        on:upload={handleUploadImage} 
                        on:openLightbox={openLightbox} 
                    />
                </div>
            {/each}
        {/if}
    </div>
</div>

<LightboxModal show={showLightbox} images={lightboxImages} currentIndex={lightboxIndex} on:close={() => showLightbox = false} on:updateIndex={(e) => lightboxIndex = e.detail} />

<AreaAdminModal show={showAdminModal} {editingAreaId} {allStaff} {currentItemAssignees} bind:newAreaName bind:newStaffLimit bind:selectedStaffIds on:close={() => showAdminModal = false} on:save={saveAreaToTemplate} />

<ChecklistStatsModal 
    show={showStatsModal} 
    {statsData} 
    {statsLoading} 
    {allStaff} 
    checklistData={sortedChecklistData} 
    {excludedStaffIds}
    on:close={() => showStatsModal = false} 
    on:editArea={(e) => openAdminModal({detail: e.detail})} 
    on:exportExcel={handleExportExcel}
    on:importExcel={handleImportExcel}
    on:deleteAll={handleDeleteAll}
    on:exportTemplate={handleExportTemplate}
    on:saveExcluded={handleSaveExcluded}
/>