<script>
    import { db } from '../../lib/firebase';
    import { collection, writeBatch, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

    export let faqData = [];
    
    let adminTab = 'import'; 
    let isUpdating = false;
    let jsonInput = '';
    
    // Nâng cấp Tab Import
    let masterCategory = ''; 
    let subCategoryPrefix = ''; // UX: Tiền tố tự động gắn vào chủ đề con

    // State Single Form
    let showEditForm = false;
    let editingId = null;
    let form = { master_category: '', category: '', keywords: '', answer: '' };

    // UX: State quản lý thẻ thu gọn (Accordion)
    let expandedGroups = {};

    // Nâng cấp Tab Manual: State cho Bulk Edit (Sửa hàng loạt)
    let showGroupEditForm = false;
    let editingGroupMc = '';
    let groupForm = { newMc: '', findCat: '', replaceCat: '' };

    $: groupedFaq = faqData.reduce((acc, item) => {
        const mc = item.master_category || 'Chung';
        if (!acc[mc]) acc[mc] = [];
        acc[mc].push(item);
        return acc;
    }, {});

    function toggleGroup(mc) {
        expandedGroups[mc] = !expandedGroups[mc];
    }

    function parseJSON(input) {
        try {
            let preProcessed = input.replace(/[\n\r\t]+/g, ' ');
            const data = JSON.parse(input);
            if (!Array.isArray(data)) throw new Error("Dữ liệu phải là mảng bắt đầu bằng [ và kết thúc bằng ].");
            return data;
        } catch (error) {
            alert("❌ Lỗi cấu trúc JSON: " + error.message);
            return null;
        }
    }

    // Xử lý Gắn tiền tố khi import
    function formatImportCategory(originalCategory) {
        const prefix = subCategoryPrefix.trim();
        if (!prefix) return originalCategory || 'Chung';
        return `${prefix} ${originalCategory || ''}`.trim();
    }

    async function handleReplaceJSON() {
        if (!jsonInput.trim()) return alert("Vui lòng dán dữ liệu JSON!");
        const parsedData = parseJSON(jsonInput);
        if (!parsedData) return;

        if (!confirm(`⚠️ GHI ĐÈ: Sẽ XÓA SẠCH câu hỏi cũ và thay bằng ${parsedData.length} câu mới. Tiếp tục?`)) return;
        isUpdating = true;
        try {
            const oldDocs = await getDocs(collection(db, 'faq_bot'));
            const batch = writeBatch(db);
            oldDocs.forEach(d => batch.delete(d.ref));

            parsedData.forEach(item => {
                const newDocRef = doc(collection(db, 'faq_bot'));
                batch.set(newDocRef, {
                    master_category: masterCategory.trim() || 'Chung',
                    category: formatImportCategory(item.category),
                    keywords: item.keywords || [],
                    answer: item.answer || ''
                });
            });
            await batch.commit();
            alert("✅ Đã GHI ĐÈ thành công! Tải lại trang để thấy dữ liệu.");
            jsonInput = '';
            masterCategory = '';
            subCategoryPrefix = '';
        } catch (error) { alert("❌ Lỗi cập nhật: " + error.message);
        } finally { isUpdating = false; }
    }

    async function handleAppendJSON() {
        if (!jsonInput.trim()) return alert("Vui lòng dán dữ liệu JSON!");
        const parsedData = parseJSON(jsonInput);
        if (!parsedData) return;

        if (!confirm(`➕ NHẬP THÊM: Sẽ cộng thêm ${parsedData.length} câu mới. Tiếp tục?`)) return;
        isUpdating = true;
        try {
            const batch = writeBatch(db);
            parsedData.forEach(item => {
                const newDocRef = doc(collection(db, 'faq_bot'));
                batch.set(newDocRef, {
                    master_category: masterCategory.trim() || 'Chung',
                    category: formatImportCategory(item.category),
                    keywords: item.keywords || [],
                    answer: item.answer || ''
                });
            });
            await batch.commit();
            alert("✅ Đã THÊM MỚI thành công! Tải lại trang để thấy dữ liệu.");
            jsonInput = '';
            masterCategory = '';
            subCategoryPrefix = '';
        } catch (error) { alert("❌ Lỗi cập nhật: " + error.message);
        } finally { isUpdating = false; }
    }

    // --- LOGIC SINGLE EDIT ---
    function openAddForm() {
        editingId = null;
        form = { master_category: '', category: '', keywords: '', answer: '' };
        showEditForm = true;
        showGroupEditForm = false;
    }

    function openEditForm(item) {
        editingId = item.id;
        form = { 
            master_category: item.master_category || 'Chung',
            category: item.category || '', 
            keywords: (item.keywords || []).join(', '), 
            answer: item.answer || '' 
        };
        showEditForm = true;
        showGroupEditForm = false;
    }

    async function saveManualForm() {
        if (!form.category || !form.answer) return alert("Vui lòng nhập Chủ đề con và Câu trả lời!");
        isUpdating = true;
        const keywordsArray = form.keywords.split(',').map(k => k.trim()).filter(Boolean);
        const payload = { 
            master_category: form.master_category.trim() || 'Chung',
            category: form.category.trim(), 
            keywords: keywordsArray, 
            answer: form.answer.trim() 
        };
        try {
            if (editingId) {
                await updateDoc(doc(db, 'faq_bot', editingId), payload);
                const index = faqData.findIndex(f => f.id === editingId);
                if(index !== -1) faqData[index] = { id: editingId, ...payload };
            } else {
                const docRef = await addDoc(collection(db, 'faq_bot'), payload);
                faqData = [...faqData, { id: docRef.id, ...payload }];
            }
            showEditForm = false;
        } catch (error) { alert("Lỗi: " + error.message);
        } finally { isUpdating = false; }
    }

    async function deleteManualFaq(id) {
        if (!confirm("Bạn có chắc chắn muốn xóa câu hỏi này?")) return;
        try { 
            await deleteDoc(doc(db, 'faq_bot', id)); 
            faqData = faqData.filter(f => f.id !== id);
        } catch (error) { alert("Lỗi xóa: " + error.message); }
    }

    // --- LOGIC BULK EDIT & DELETE (SỬA/XÓA NHÓM) ---
    function openGroupEdit(mc) {
        editingGroupMc = mc;
        groupForm = { newMc: mc, findCat: '', replaceCat: '' };
        showGroupEditForm = true;
        showEditForm = false;
    }

    async function saveGroupEdit() {
        if (!groupForm.newMc.trim()) return alert("Tên nhóm chủ đề gốc không được để trống!");
        if (!confirm(`Áp dụng thay đổi cho TOÀN BỘ nhóm "${editingGroupMc}"?`)) return;
        
        isUpdating = true;
        try {
            const batch = writeBatch(db);
            const q = query(collection(db, 'faq_bot'), where('master_category', '==', editingGroupMc));
            const snapshot = await getDocs(q);

            snapshot.docs.forEach(d => {
                const data = d.data();
                let newCat = data.category || '';

                // Thuật toán Find & Replace hoặc Prepend
                if (groupForm.findCat) {
                    newCat = newCat.replaceAll(groupForm.findCat, groupForm.replaceCat);
                } else if (groupForm.replaceCat) {
                    newCat = `${groupForm.replaceCat.trim()} ${newCat}`.trim();
                }

                batch.update(d.ref, {
                    master_category: groupForm.newMc.trim(),
                    category: newCat
                });
            });

            await batch.commit();

            // Cập nhật mảng local để UI đổi ngay lập tức
            faqData = faqData.map(f => {
                if ((f.master_category || 'Chung') === editingGroupMc) {
                    let updatedCat = f.category;
                    if (groupForm.findCat) updatedCat = updatedCat.replaceAll(groupForm.findCat, groupForm.replaceCat);
                    else if (groupForm.replaceCat) updatedCat = `${groupForm.replaceCat.trim()} ${updatedCat}`.trim();
                    
                    return { ...f, master_category: groupForm.newMc.trim(), category: updatedCat };
                }
                return f;
            });

            alert(`✅ Đã cập nhật xong nhóm ${editingGroupMc}`);
            showGroupEditForm = false;
            // Cập nhật lại key Accordion nếu đổi tên
            if (editingGroupMc !== groupForm.newMc.trim()) {
                expandedGroups[groupForm.newMc.trim()] = expandedGroups[editingGroupMc];
                delete expandedGroups[editingGroupMc];
            }
        } catch (error) { alert("Lỗi cập nhật nhóm: " + error.message);
        } finally { isUpdating = false; }
    }

    async function deleteMasterCategoryGroup(mc) {
        if (!confirm(`⚠️ NGUY HIỂM: Bạn có chắc chắn muốn xóa TOÀN BỘ nhóm "${mc}" không?`)) return;
        isUpdating = true;
        try {
            const q = query(collection(db, 'faq_bot'), where('master_category', '==', mc));
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            
            faqData = faqData.filter(f => (f.master_category || 'Chung') !== mc);
            alert(`✅ Đã xóa nhóm ${mc}`);
            showGroupEditForm = false;
        } catch (error) { alert("Lỗi xóa nhóm: " + error.message);
        } finally { isUpdating = false; }
    }
</script>

<div class="flex-1 flex flex-col overflow-hidden bg-slate-50">
    <div class="flex bg-white border-b border-slate-200 shrink-0">
        <button class="flex-1 py-2 text-xs font-bold transition-colors {adminTab === 'import' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}" on:click={() => adminTab = 'import'}>🤖 Nạp JSON</button>
        <button class="flex-1 py-2 text-xs font-bold transition-colors {adminTab === 'manual' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}" on:click={() => adminTab = 'manual'}>✍️ Chỉnh Sửa Tay</button>
    </div>

    {#if adminTab === 'import'}
        <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div class="bg-indigo-50 border border-indigo-200 p-3 rounded-xl shadow-sm flex flex-col gap-2">
                <div>
                    <label class="block text-[11px] font-bold text-indigo-800 mb-1">1. Nhóm chủ đề gốc (Master Category)</label>
                    <input type="text" bind:value={masterCategory} placeholder="VD: Chính sách Bao giá..." class="w-full bg-white border border-indigo-200 rounded-lg p-2 text-xs outline-none focus:border-indigo-500 shadow-inner">
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-indigo-800 mb-1">2. Tiền tố Chủ đề con (Tùy chọn)</label>
                    <input type="text" bind:value={subCategoryPrefix} placeholder="VD: Bao giá -" class="w-full bg-white border border-indigo-200 rounded-lg p-2 text-xs outline-none focus:border-indigo-500 shadow-inner">
                    <p class="text-[10px] text-indigo-500 mt-1">Sẽ tự động gắn vào đầu mọi câu hỏi trong JSON.</p>
                </div>
            </div>
            <textarea bind:value={jsonInput} class="flex-1 w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-mono outline-none focus:border-indigo-500 resize-none shadow-inner" placeholder={`[\n  {\n    "category": "Truyền thông",\n    "keywords": ["khach hang"],\n    "answer": "Nội dung..."\n  }\n]`}></textarea>
            <div class="flex gap-2 shrink-0">
                <button class="flex-[1.5] py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition-colors text-xs flex items-center justify-center gap-1" on:click={handleReplaceJSON} disabled={isUpdating}>
                    <span class="material-icons-round text-sm">warning</span> Ghi đè
                </button>
                <button class="flex-[2] py-2 bg-indigo-600 text-white font-bold rounded-lg shadow hover:bg-indigo-700 transition-colors text-xs flex items-center justify-center gap-1" on:click={handleAppendJSON} disabled={isUpdating}>
                    <span class="material-icons-round text-sm">add_circle</span> Nhập Thêm
                </button>
            </div>
        </div>
    {/if}

    {#if adminTab === 'manual'}
        <div class="flex-1 overflow-y-auto p-3 flex flex-col">
            
            {#if showEditForm}
                <div class="bg-white p-3 rounded-xl border border-indigo-200 shadow-sm animate-popIn flex-1 flex flex-col mb-3">
                    <h4 class="font-bold text-sm text-indigo-800 mb-3 border-b pb-2">{editingId ? 'Sửa Câu Hỏi' : 'Thêm Câu Mới'}</h4>
                    <div class="space-y-3 flex-1 overflow-y-auto pr-1">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chủ đề Gốc</label>
                            <input type="text" bind:value={form.master_category} class="w-full border rounded p-2 text-xs outline-none focus:border-indigo-500">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chủ đề Con</label>
                            <input type="text" bind:value={form.category} class="w-full border rounded p-2 text-xs outline-none focus:border-indigo-500">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Từ khóa</label>
                            <textarea bind:value={form.keywords} rows="2" class="w-full border rounded p-2 text-xs outline-none focus:border-indigo-500 resize-none"></textarea>
                        </div>
                        <div class="flex-1 flex flex-col">
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Câu trả lời (HTML)</label>
                            <textarea bind:value={form.answer} class="flex-1 min-h-[100px] w-full border rounded p-2 text-xs outline-none focus:border-indigo-500 resize-none"></textarea>
                        </div>
                    </div>
                    <div class="flex gap-2 mt-3 pt-3 border-t">
                        <button class="flex-1 py-2 bg-slate-100 text-slate-600 font-bold text-xs rounded-lg hover:bg-slate-200" on:click={() => showEditForm = false}>Hủy</button>
                        <button class="flex-1 py-2 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700" on:click={saveManualForm} disabled={isUpdating}>{isUpdating ? 'Đang lưu...' : 'Lưu lại'}</button>
                    </div>
                </div>
            {/if}

            {#if showGroupEditForm}
                <div class="bg-orange-50 p-3 rounded-xl border border-orange-200 shadow-sm animate-popIn mb-3 shrink-0">
                    <h4 class="font-bold text-sm text-orange-800 mb-2 border-b border-orange-200 pb-2 flex items-center gap-1">
                        <span class="material-icons-round text-[16px]">edit_note</span> Sửa Hàng Loạt Nhóm "{editingGroupMc}"
                    </h4>
                    <div class="space-y-3">
                        <div>
                            <label class="block text-[10px] font-bold text-orange-700 uppercase mb-1">Tên Nhóm Gốc Mới</label>
                            <input type="text" bind:value={groupForm.newMc} class="w-full border border-orange-200 rounded p-2 text-xs outline-none focus:border-orange-500">
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[10px] font-bold text-orange-700 uppercase mb-1">Tìm Chủ đề con (Từ cũ)</label>
                                <input type="text" bind:value={groupForm.findCat} placeholder="Để trống nếu muốn thêm tiền tố" class="w-full border border-orange-200 rounded p-2 text-xs outline-none focus:border-orange-500">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-orange-700 uppercase mb-1">Thay bằng (Từ mới)</label>
                                <input type="text" bind:value={groupForm.replaceCat} placeholder="VD: Chiến giá -" class="w-full border border-orange-200 rounded p-2 text-xs outline-none focus:border-orange-500">
                            </div>
                        </div>
                        <p class="text-[10px] text-orange-600 italic">Mẹo: Nhập "Thay bằng" nhưng bỏ trống "Tìm", hệ thống sẽ tự gắn thêm "Thay bằng" vào đầu mọi câu hỏi.</p>
                    </div>
                    <div class="flex gap-2 mt-3 pt-3 border-t border-orange-200">
                        <button class="flex-1 py-2 bg-orange-100 text-orange-700 font-bold text-xs rounded-lg hover:bg-orange-200" on:click={() => showGroupEditForm = false}>Hủy</button>
                        <button class="flex-[2] py-2 bg-orange-600 text-white font-bold text-xs rounded-lg hover:bg-orange-700" on:click={saveGroupEdit} disabled={isUpdating}>{isUpdating ? 'Đang áp dụng...' : 'Áp dụng cho toàn bộ nhóm'}</button>
                    </div>
                </div>
            {/if}

            {#if !showEditForm && !showGroupEditForm}
                <div class="flex justify-between items-center mb-3 px-1">
                    <span class="text-xs font-bold text-slate-500">Tổng: {faqData.length} câu</span>
                    <button class="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-200 flex items-center gap-1" on:click={openAddForm}>
                        <span class="material-icons-round text-[14px]">add</span> Thêm Mới
                    </button>
                </div>
                
                <div class="space-y-3">
                    {#each Object.entries(groupedFaq) as [mc, items]}
                        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                            <div 
                                class="w-full flex justify-between items-center p-3 bg-slate-50 hover:bg-indigo-50 transition-colors border-b border-transparent cursor-pointer select-none {expandedGroups[mc] ? '!border-slate-200' : ''}" 
                                on:click={() => toggleGroup(mc)}
                                on:keydown={(e) => e.key === 'Enter' && toggleGroup(mc)}
                                role="button"
                                tabindex="0"
                            >
                                <div class="flex items-center gap-2">
                                    <span class="material-icons-round text-[18px] {expandedGroups[mc] ? 'text-indigo-600' : 'text-slate-400'}">
                                        {expandedGroups[mc] ? 'folder_open' : 'folder'}
                                    </span>
                                    <h3 class="font-bold text-xs text-slate-800 flex items-center gap-1">
                                        {mc} <span class="text-[10px] font-normal text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-full ml-1">{items.length}</span>
                                    </h3>
                                </div>
                                <div class="flex items-center gap-1">
                                    <button class="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 px-2 py-1 rounded transition-colors" on:click|stopPropagation={() => openGroupEdit(mc)} disabled={isUpdating}>Sửa nhóm</button>
                                    <button class="text-[10px] font-bold text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors" on:click|stopPropagation={() => deleteMasterCategoryGroup(mc)} disabled={isUpdating}>Xóa</button>
                                    <span class="material-icons-round text-slate-400 transition-transform duration-200 ml-1 {expandedGroups[mc] ? 'rotate-180' : ''}">expand_more</span>
                                </div>
                            </div>
                            
                            {#if expandedGroups[mc]}
                                <div class="p-2 space-y-2 bg-slate-50/50">
                                    {#each items as item}
                                        <div class="bg-white border border-slate-200 p-2 rounded-lg hover:border-indigo-300 transition-colors">
                                            <div class="flex justify-between items-start gap-2">
                                                <div class="flex-1 min-w-0">
                                                    <div class="text-[10px] font-bold text-indigo-500 bg-indigo-50 inline-block px-1.5 py-0.5 rounded mb-1">{item.category}</div>
                                                    <div class="text-xs text-slate-700 font-semibold truncate">{@html item.answer}</div>
                                                </div>
                                                <div class="flex items-center gap-1 shrink-0">
                                                    <button class="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" on:click={() => openEditForm(item)}><span class="material-icons-round text-[14px]">edit</span></button>
                                                    <button class="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded" on:click={() => deleteManualFaq(item.id)}><span class="material-icons-round text-[14px]">delete</span></button>
                                                </div>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/each}
                    
                    {#if faqData.length === 0}
                        <p class="text-center text-xs text-slate-400 py-10">Chưa có dữ liệu nào.</p>
                    {/if}
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .animate-popIn { animation: popIn 0.2s ease-out; }
    @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    .overflow-y-auto::-webkit-scrollbar { width: 5px; }
    .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
    .overflow-y-auto::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
</style>