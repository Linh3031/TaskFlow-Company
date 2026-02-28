<script>
    import { onMount, onDestroy } from 'svelte';
    import { db, storage } from '../lib/firebase';
    import { collection, doc, getDoc, getDocs, setDoc, onSnapshot, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
    import { currentUser } from '../lib/stores';
    import { getCurrentTimeShort, getTodayStr } from '../lib/utils';
    import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

    export let activeStoreId;
    export let dateStr;

    $: isAdmin = $currentUser?.role === 'admin' || $currentUser?.role === 'super_admin';

    let checklistData = [];
    let loading = true;
    let uploadingId = null;
    let unsubscribe = null;

    // State cho Modal Admin
    let showAdminModal = false;
    let editingAreaId = null;
    let allStaff = [];
    let newAreaName = '';
    let selectedStaffIds = [];
    let searchStaffQuery = '';

    // State cho Lightbox (Trình chiếu ảnh Slider)
    let showLightbox = false;
    let lightboxImages = [];
    let lightboxIndex = 0;

    $: filteredStaff = allStaff.filter(s => 
        s.username.toLowerCase().includes(searchStaffQuery.toLowerCase())
    );

    // Sắp xếp: Chưa làm nằm trên, làm rồi trôi xuống dưới
    $: sortedChecklistData = [...checklistData].sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
    });

    $: if (activeStoreId && dateStr) {
        initAndLoadChecklist();
    }

    async function initAndLoadChecklist() {
        if (unsubscribe) unsubscribe();
        loading = true;

        const dailyRef = doc(db, 'stores', activeStoreId, '8nttt_daily', dateStr);
        const dailySnap = await getDoc(dailyRef);

        if (!dailySnap.exists()) {
            const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
            const templateSnap = await getDoc(templateRef);
            let defaultData = [];
            if (templateSnap.exists() && templateSnap.data().items) {
                defaultData = templateSnap.data().items.map(item => ({
                    id: item.id,
                    areaName: item.areaName,
                    assignees: item.assignees || [],
                    completed: false,
                    imageUrls: [],
                    completedBy: null,
                    completedAt: null
                }));
            }
            await setDoc(dailyRef, { items: defaultData, createdAt: serverTimestamp() });
        }

        unsubscribe = onSnapshot(dailyRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().items) {
                checklistData = docSnap.data().items.map(i => ({
                    ...i,
                    imageUrls: i.imageUrls || (i.imageUrl ? [i.imageUrl] : [])
                }));
            } else {
                checklistData = [];
            }
            loading = false;
        });
    }

    async function openAdminModal(item = null) {
        showAdminModal = true;
        searchStaffQuery = '';

        if (allStaff.length === 0) {
            const q = query(collection(db, 'users'), where('storeIds', 'array-contains', activeStoreId));
            const snap = await getDocs(q);
            allStaff = snap.docs
                .map(d => ({ id: d.id, username: d.data().username, role: d.data().role }))
                .filter(s => s.role !== 'admin' && s.role !== 'super_admin' && s.username)
                .sort((a, b) => a.username.localeCompare(b.username));
        }

        if (item) {
            editingAreaId = item.id;
            newAreaName = item.areaName;
            selectedStaffIds = (item.assignees || []).map(a => a.id);
        } else {
            editingAreaId = null;
            newAreaName = '';
            selectedStaffIds = [];
        }
    }

    async function saveAreaToTemplate() {
        if (!newAreaName.trim() || selectedStaffIds.length === 0) {
            return alert("Vui lòng nhập tên khu vực và chọn ít nhất 1 người phụ trách!");
        }
        
        const assigneesData = allStaff
            .filter(s => selectedStaffIds.includes(s.id))
            .map(s => ({ id: s.id, username: s.username }));

        const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
        const snap = await getDoc(templateRef);
        let currentItems = snap.exists() ? (snap.data().items || []) : [];

        let newItemData = null;

        if (editingAreaId) {
            currentItems = currentItems.map(i => i.id === editingAreaId ? { ...i, areaName: newAreaName.trim(), assignees: assigneesData } : i);
        } else {
            newItemData = {
                id: 'area_' + Date.now(),
                areaName: newAreaName.trim(),
                assignees: assigneesData
            };
            currentItems.push(newItemData);
        }

        await setDoc(templateRef, { items: currentItems }, { merge: true });

        const dailyRef = doc(db, 'stores', activeStoreId, '8nttt_daily', dateStr);
        const dailySnap = await getDoc(dailyRef);
        if (dailySnap.exists()) {
            let dailyItems = dailySnap.data().items || [];
            if (editingAreaId) {
                dailyItems = dailyItems.map(i => i.id === editingAreaId ? { ...i, areaName: newAreaName.trim(), assignees: assigneesData } : i);
            } else {
                dailyItems.push({ ...newItemData, completed: false, imageUrls: [], completedBy: null, completedAt: null });
            }
            await updateDoc(dailyRef, { items: dailyItems });
        } else {
            if (!editingAreaId && newItemData) {
                await setDoc(dailyRef, { items: [{ ...newItemData, completed: false, imageUrls: [], completedBy: null, completedAt: null }], createdAt: serverTimestamp() });
            }
        }
        
        showAdminModal = false;
    }

    async function deleteArea(areaId, areaName) {
        if (!confirm(`⚠️ XÁC NHẬN XÓA:\nBạn có chắc chắn muốn xóa khu vực "${areaName}" không?\nKhu vực này sẽ bị xóa khỏi ngày hiện tại và các ngày sau.`)) return;

        const templateRef = doc(db, 'stores', activeStoreId, '8nttt_template', 'config');
        const snap = await getDoc(templateRef);
        if (snap.exists()) {
            let currentItems = snap.data().items || [];
            currentItems = currentItems.filter(i => i.id !== areaId);
            await setDoc(templateRef, { items: currentItems }, { merge: true });
        }

        const dailyRef = doc(db, 'stores', activeStoreId, '8nttt_daily', dateStr);
        const dailySnap = await getDoc(dailyRef);
        if (dailySnap.exists()) {
            let dailyItems = dailySnap.data().items || [];
            dailyItems = dailyItems.filter(i => i.id !== areaId);
            await updateDoc(dailyRef, { items: dailyItems });
        }
    }

    // ĐÃ FIX LỖI ẢNH ĐEN: Thêm nền trắng (fillRect) trước khi vẽ ảnh
    function compressImage(file, maxWidth = 1000, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
                    canvas.width = width; 
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    // Tạo lớp nền trắng tinh để lót cho các ảnh PNG trong suốt
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    }

    // ĐÃ FIX UP CHẬM: Dùng Promise.all() để tải lên song song nhiều ảnh cùng lúc
    async function handleUploadImage(event, itemId) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const item = checklistData.find(i => i.id === itemId);
        const currentCount = item.imageUrls ? item.imageUrls.length : 0;
        const remainingSlots = 4 - currentCount;
        
        const filesToProcess = Array.from(files).slice(0, remainingSlots);
        if (filesToProcess.length === 0) return;

        uploadingId = itemId;

        try {
            // TẠO MẢNG CHỨA CÁC TÁC VỤ UPLOAD SONG SONG
            const uploadPromises = filesToProcess.map(async (file) => {
                const compressedBlob = await compressImage(file);
                const fileName = `8nttt_${activeStoreId}_${dateStr}_${itemId}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                const imageRef = ref(storage, `8nttt_images/${fileName}`);
                await uploadBytes(imageRef, compressedBlob);
                return await getDownloadURL(imageRef);
            });

            // CHỜ TẤT CẢ CÁC ẢNH CÙNG UPLOAD XONG (Tốc độ x4 lần)
            const newUploadedUrls = await Promise.all(uploadPromises);

            const dailyRef = doc(db, 'stores', activeStoreId, '8nttt_daily', dateStr);
            const updatedItems = checklistData.map(i => {
                if (i.id === itemId) {
                    const mergedUrls = [...(i.imageUrls || []), ...newUploadedUrls];
                    const isNowCompleted = mergedUrls.length >= 4;
                    
                    return {
                        ...i,
                        imageUrls: mergedUrls,
                        completed: isNowCompleted,
                        completedBy: isNowCompleted ? ($currentUser.name || $currentUser.username) : i.completedBy,
                        completedAt: isNowCompleted ? getCurrentTimeShort() : i.completedAt
                    };
                }
                return i;
            });

            await updateDoc(dailyRef, { items: updatedItems });

        } catch (error) {
            console.error("Upload error: ", error);
            alert("Lỗi tải ảnh lên: " + error.message);
        } finally {
            uploadingId = null;
            event.target.value = null; 
        }
    }

    // --- LOGIC LIGHTBOX (TRÌNH CHIẾU ẢNH) ---
    function openLightbox(images, index) {
        lightboxImages = images;
        lightboxIndex = index;
        showLightbox = true;
    }
    
    function closeLightbox() {
        showLightbox = false;
        lightboxImages = [];
    }

    function nextLightboxImage() {
        if (lightboxIndex < lightboxImages.length - 1) lightboxIndex++;
    }

    function prevLightboxImage() {
        if (lightboxIndex > 0) lightboxIndex--;
    }

    // Xử lý phím tắt cho Lightbox
    function handleKeydown(e) {
        if (!showLightbox) return;
        if (e.key === 'ArrowRight') nextLightboxImage();
        if (e.key === 'ArrowLeft') prevLightboxImage();
        if (e.key === 'Escape') closeLightbox();
    }

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
    });
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="w-full h-full flex flex-col bg-slate-50 rounded-xl border border-cyan-200 shadow-sm overflow-hidden relative">
    
    <div class="p-3 bg-white border-b border-cyan-200 flex justify-between items-center shrink-0 shadow-sm z-10">
        <div class="flex items-center gap-2">
            <span class="material-icons-round text-cyan-600 text-xl">fact_check</span>
            <div>
                <h3 class="font-bold text-slate-800 text-sm">Tuân thủ 8NTTT</h3>
                <p class="text-[10px] text-slate-500">Yêu cầu 4 ảnh / khu vực</p>
            </div>
        </div>
        
        {#if isAdmin}
            <button class="bg-cyan-50 border border-cyan-200 text-cyan-700 hover:bg-cyan-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm" on:click={() => openAdminModal(null)}>
                <span class="material-icons-round text-[14px]">add_circle</span> <span class="hidden sm:inline">Thêm Khu Vực</span>
            </button>
        {/if}
    </div>

    <div class="flex-1 overflow-y-auto p-2 sm:p-3 bg-slate-50 space-y-3">
        {#if loading}
            <div class="flex justify-center py-10"><span class="material-icons-round animate-spin text-cyan-500 text-3xl">sync</span></div>
        {:else if sortedChecklistData.length === 0}
            <div class="text-center py-10 text-slate-400">
                <span class="material-icons-round text-5xl opacity-50 mb-2">assignment_turned_in</span>
                <p class="font-bold text-sm">Chưa có khu vực nào cần kiểm tra.</p>
            </div>
        {:else}
            {#each sortedChecklistData as item (item.id)}
                <div class="bg-white p-3 rounded-xl border-y border-r shadow-sm flex flex-col gap-2 transition-all duration-300 
                    {item.completed ? 'bg-slate-50 border-l-4 border-l-green-500 border-y-slate-200 border-r-slate-200 opacity-70 hover:opacity-100' : 'border-l-4 border-l-orange-500 border-y-slate-200 border-r-slate-200 hover:border-cyan-400'}">
                    
                    <div class="flex justify-between items-start">
                        <div class="flex-1 pr-2">
                            <div class="flex items-center gap-2">
                                <div class="font-bold text-slate-800 text-sm {item.completed ? 'line-through decoration-green-400' : ''}">{item.areaName}</div>
                                
                                {#if isAdmin}
                                    <div class="flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                                        <button class="text-slate-500 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-100" on:click={() => openAdminModal(item)} title="Sửa khu vực">
                                            <span class="material-icons-round text-[14px]">edit</span>
                                        </button>
                                        <button class="text-slate-500 hover:text-red-500 p-0.5 rounded hover:bg-slate-100" on:click={() => deleteArea(item.id, item.areaName)} title="Xóa khu vực">
                                            <span class="material-icons-round text-[14px]">delete</span>
                                        </button>
                                    </div>
                                {/if}
                            </div>
                            
                            <div class="text-[11px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
                                <span class="material-icons-round text-[14px] text-indigo-400">groups</span>
                                {(item.assignees || []).map(a => a.username).join(', ') || 'Chưa gán người'}
                            </div>
                        </div>
                        
                        {#if item.completed}
                            <div class="text-right shrink-0">
                                <div class="inline-flex items-center gap-1 text-green-700 font-bold text-[10px] bg-green-100 px-2 py-0.5 rounded-full border border-green-300 mb-0.5 shadow-sm">
                                    <span class="material-icons-round text-[12px]">check_circle</span> Hoàn tất
                                </div>
                                <div class="text-[9px] text-slate-500">
                                    ✍️ {item.completedBy} • {item.completedAt}
                                </div>
                            </div>
                        {:else}
                            <div class="text-[10px] shrink-0 font-bold px-2 py-1 rounded bg-orange-100 text-orange-600 border border-orange-300 shadow-sm">
                                Chưa đạt ({(item.imageUrls || []).length}/4)
                            </div>
                        {/if}
                    </div>

                    <div class="flex flex-wrap gap-2 mt-1">
                        {#each (item.imageUrls || []) as url, index}
                            <button class="w-14 h-14 sm:w-16 sm:h-16 rounded-lg border border-slate-200 shadow-sm overflow-hidden bg-black flex items-center justify-center group relative outline-none" on:click={() => openLightbox(item.imageUrls, index)}>
                                <img src={url} alt="Checklist pic" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity">
                                <span class="material-icons-round text-white absolute text-sm drop-shadow-md opacity-0 group-hover:opacity-100">zoom_in</span>
                            </button>
                        {/each}

                        {#if (item.imageUrls || []).length < 4}
                            <label class="w-14 h-14 sm:w-16 sm:h-16 border-2 border-dashed border-orange-300 rounded-lg flex flex-col items-center justify-center text-orange-500 cursor-pointer hover:bg-orange-50 transition-colors bg-orange-50/30 relative shadow-inner">
                                <input type="file" multiple accept="image/*" class="absolute w-0 h-0 opacity-0" on:change={(e) => handleUploadImage(e, item.id)} disabled={uploadingId === item.id}>
                                {#if uploadingId === item.id}
                                    <span class="material-icons-round text-lg animate-spin">sync</span>
                                {:else}
                                    <span class="material-icons-round text-lg mb-0.5">add_a_photo</span>
                                    <span class="text-[8px] font-bold uppercase tracking-tighter text-orange-500 leading-none">Thêm</span>
                                {/if}
                            </label>
                        {/if}
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>

{#if showLightbox}
    <div class="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-2 backdrop-blur-md animate-fadeIn" on:click={closeLightbox}>
        
        <div class="absolute top-4 right-4 z-10 flex gap-4 text-white">
            <span class="text-sm font-bold bg-black/50 px-3 py-1 rounded-full">{lightboxIndex + 1} / {lightboxImages.length}</span>
            <button class="hover:text-red-400 transition-colors" on:click={closeLightbox}><span class="material-icons-round text-3xl drop-shadow-lg">close</span></button>
        </div>

        <div class="w-full h-full max-w-4xl max-h-[85vh] flex items-center justify-center relative" on:click|stopPropagation>
            <img src={lightboxImages[lightboxIndex]} alt="Phóng to" class="max-w-full max-h-full object-contain rounded-md shadow-2xl animate-popIn">
            
            {#if lightboxIndex > 0}
                <button class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-all" on:click|stopPropagation={prevLightboxImage}>
                    <span class="material-icons-round text-3xl">chevron_left</span>
                </button>
            {/if}

            {#if lightboxIndex < lightboxImages.length - 1}
                <button class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-all" on:click|stopPropagation={nextLightboxImage}>
                    <span class="material-icons-round text-3xl">chevron_right</span>
                </button>
            {/if}
        </div>
    </div>
{/if}

{#if showAdminModal}
    <div class="fixed inset-0 z-[70] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => showAdminModal = false}>
        <div class="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-popIn max-h-[90vh]" on:click|stopPropagation>
            <div class="p-4 bg-cyan-50 border-b border-cyan-100 flex justify-between items-center shrink-0">
                <h3 class="font-bold text-cyan-800">{editingAreaId ? 'Sửa Khu Vực' : 'Thêm Khu Vực 8NTTT'}</h3>
                <button class="text-slate-400 hover:text-red-500" on:click={() => showAdminModal = false}><span class="material-icons-round">close</span></button>
            </div>
            
            <div class="p-4 flex-1 overflow-y-auto space-y-4 bg-white">
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">Tên Khu Vực / Quầy Kệ</label>
                    <input type="text" bind:value={newAreaName} placeholder="Vd: Quầy Tivi Sony..." class="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-semibold focus:border-cyan-500 focus:ring-1 focus:ring-cyan-200 outline-none">
                </div>
                
                <div class="flex flex-col h-full">
                    <label class="block text-xs font-bold text-slate-500 mb-2">Người Phụ Trách (Chọn nhiều)</label>
                    
                    <div class="relative mb-2">
                        <span class="material-icons-round absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[16px]">search</span>
                        <input type="text" bind:value={searchStaffQuery} placeholder="Tìm nhân viên..." class="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-cyan-500">
                    </div>

                    <div class="max-h-56 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-1.5 space-y-0.5">
                        {#each filteredStaff as s}
                            <label class="flex items-center gap-3 p-2 hover:bg-cyan-100 rounded-md cursor-pointer transition-colors border border-transparent hover:border-cyan-200 {selectedStaffIds.includes(s.id) ? 'bg-cyan-50 border-cyan-200' : ''}">
                                <input type="checkbox" bind:group={selectedStaffIds} value={s.id} class="w-4 h-4 accent-cyan-600 rounded">
                                <span class="text-sm font-semibold text-slate-700">{s.username}</span>
                            </label>
                        {/each}
                        {#if filteredStaff.length === 0}
                            <div class="text-xs text-center text-slate-400 py-4 font-bold">Không tìm thấy nhân sự phù hợp</div>
                        {/if}
                    </div>
                </div>
            </div>

            <div class="p-3 bg-slate-50 border-t flex gap-2 shrink-0">
                <button class="flex-1 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100" on:click={() => showAdminModal = false}>Hủy</button>
                <button class="flex-[2] py-2 rounded-xl bg-cyan-600 text-white font-bold text-sm shadow-md hover:bg-cyan-700 transition-colors" on:click={saveAreaToTemplate}>
                    {editingAreaId ? 'Cập Nhật' : 'Lưu Khu Vực'}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
    .animate-popIn { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
</style>