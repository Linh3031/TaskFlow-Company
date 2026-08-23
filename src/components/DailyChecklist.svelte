<script>
    import { onMount, onDestroy } from 'svelte';
    import { currentUser } from '../lib/stores';
    
    import { exportTemplateData, exportExcelData, importExcelData } from './DailyChecklistParts/handlers/excelHandler.js';
    import { processAndUploadImages } from './DailyChecklistParts/handlers/imageHandler.js';
    import { 
        subscribeToChecklist, fetchAllStaffData, saveExcludedConfig, executeAutoRotate, 
        getMonthlyStats, saveAreaConfig, removeArea, clearAllAreas, 
        fetchScheduleMaps, subscribeToScheduleMaps // [PHẪU THUẬT LOGIC]: Import hàm Realtime mới
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
    let unsubSchedules = null; // [PHẪU THUẬT LOGIC]: Biến dọn dẹp bộ nhớ cho lịch Realtime
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

    let searchQuery = '';

    $: sortedChecklistData = [...checklistData].sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
    });

    $: filteredChecklistData = sortedChecklistData.filter(item => 
        item.areaName.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    $: if (activeStoreId && dateStr) {
        initChecklist();
        loadSchedulesRealtime(); // [PHẪU THUẬT LOGIC]: Gọi hàm Realtime thay vì hàm một lần
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

    async function ensureStaffLoaded() {
        if (allStaff.length === 0) allStaff = await fetchAllStaffData(activeStoreId);
    }

    // [PHẪU THUẬT LOGIC]: Hàm quản lý Lịch Realtime mới
    async function loadSchedulesRealtime() {
        if (unsubSchedules) {
            unsubSchedules();
            unsubSchedules = null;
        }
        scheduleLoading = true;
        await ensureStaffLoaded();
        unsubSchedules = subscribeToScheduleMaps(activeStoreId, dateStr, allStaff, (mapData) => {
            todayScheduleMap = mapData;
            scheduleLoading = false;
        });
    }

    // --- Các Hàm Điều Phối Action ---
    function scrollToMyArea() {
        if (!$currentUser) return;
        const myArea = sortedChecklistData.find(item => (item.assignees || []).some(a => a.id === $currentUser.id || (a.username && a.username.toLowerCase() === $currentUser.username?.toLowerCase())));
        if (myArea) {
            searchQuery = ''; 
            setTimeout(() => {
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
            }, 50);
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
            const res = await getMonthlyStats(activeStoreId, dateStr, allStaff);
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
    
    // [PHẪU THUẬT LOGIC]: Hủy lắng nghe 2 đường để dọn rác bộ nhớ
    onDestroy(() => { 
        if (unsubscribe) unsubscribe(); 
        if (unsubSchedules) unsubSchedules();
    });
</script>

<div class="w-full h-full flex flex-col bg-slate-50 rounded-xl border border-cyan-200 shadow-sm overflow-hidden relative">
    <ChecklistHeader {isAdmin} on:autoRotate={handleAutoRotate} on:openAdmin={() => openAdminModal(null)} on:openStats={loadAndShowStats} on:locate={scrollToMyArea} />
    
    {#if scheduleLoading}
        <div class="bg-indigo-50 border-b border-indigo-100 p-1.5 flex justify-center items-center gap-2">
            <span class="material-icons-round text-[12px] text-indigo-500 animate-spin">sync</span>
            <span class="text-[10px] text-indigo-600 font-bold">Đang đồng bộ Lịch làm việc Realtime...</span>
        </div>
    {/if}

    <div class="px-3 pt-3 pb-0 shrink-0">
        <div class="relative flex items-center bg-white rounded-lg border border-slate-300 focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-200 transition-all shadow-sm">
            <span class="material-icons-round absolute left-2.5 text-slate-400 text-[18px]">search</span>
            <input 
                type="text" 
                bind:value={searchQuery} 
                placeholder="Tìm / Lọc tên khu vực (VD: Vách tivi...)" 
                class="w-full pl-9 pr-10 py-2 bg-transparent text-sm font-semibold text-slate-700 outline-none"
            >
            {#if searchQuery}
                <button 
                    class="absolute right-2 text-slate-400 hover:text-red-500 bg-slate-100 hover:bg-red-50 w-6 h-6 rounded-full transition-colors flex items-center justify-center" 
                    on:click={() => searchQuery = ''}
                    title="Xóa bộ lọc"
                >
                    <span class="material-icons-round text-[14px]">close</span>
                </button>
            {/if}
        </div>
    </div>

    <div class="flex-1 overflow-y-auto p-2 sm:p-3 bg-slate-50 space-y-3">
        {#if loading}
            <div class="flex justify-center py-10"><span class="material-icons-round animate-spin text-cyan-500 text-3xl">sync</span></div>
        {:else if sortedChecklistData.length === 0}
            <div class="text-center py-10 text-slate-400">
                <span class="material-icons-round text-5xl opacity-50 mb-2">assignment_turned_in</span>
                <p class="font-bold text-sm">Chưa có dữ liệu hoặc đã bị xóa.</p>
            </div>
        {:else if filteredChecklistData.length === 0}
            <div class="text-center py-10 text-slate-400 animate-pulse">
                <span class="material-icons-round text-5xl opacity-50 mb-2">search_off</span>
                <p class="font-bold text-sm">Không tìm thấy khu vực nào khớp với "{searchQuery}"</p>
            </div>
        {:else}
            {#each filteredChecklistData as item (item.id)}
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