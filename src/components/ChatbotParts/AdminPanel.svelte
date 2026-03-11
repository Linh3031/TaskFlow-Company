<script>
    import { db } from '../../lib/firebase';
    import { collection, writeBatch, doc, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

    export let faqData = [];
    
    let adminTab = 'import'; // 'import' | 'manual'
    let isUpdating = false;
    let jsonInput = '';
    let masterCategory = ''; // [CodeGenesis] State cho Nhóm chủ đề gốc

    // State Manual Form
    let showEditForm = false;
    let editingId = null;
    let form = { category: '', keywords: '', answer: '' };

    function parseJSON(input) {
        try {
            // Tiền xử lý: Cố gắng bọc các dấu Enter thực tế thành thẻ <br> hoặc khoảng trắng để cứu lỗi "Bad control character"
            let preProcessed = input.replace(/[\n\r\t]+/g, ' '); 
            
            // Nhưng cách an toàn nhất vẫn là parse chuẩn
            const data = JSON.parse(input);
            if (!Array.isArray(data)) throw new Error("Dữ liệu phải là một mảng bắt đầu bằng [ và kết thúc bằng ].");
            return data;
        } catch (error) {
            if (error.message.includes("control character")) {
                alert("❌ LỖI DẤU ENTER: Dữ liệu AI tạo ra có chứa dấu 'Enter xuống dòng' bên trong đoạn chữ. Hãy dặn AI: 'Tuyệt đối không gõ Enter trong nội dung, chỉ dùng thẻ <br>'.");
            } else {
                alert("❌ Lỗi cấu trúc JSON: " + error.message);
            }
            return null;
        }
    }

    async function handleReplaceJSON() {
        if (!jsonInput.trim()) return alert("Vui lòng dán dữ liệu JSON vào ô trống!");
        const parsedData = parseJSON(jsonInput);
        if (!parsedData) return;

        if (!confirm(`⚠️ GHI ĐÈ: Hệ thống sẽ XÓA SẠCH câu hỏi cũ và thay bằng ${parsedData.length} câu hỏi mới. Tiếp tục?`)) return;

        isUpdating = true;
        try {
            const oldDocs = await getDocs(collection(db, 'faq_bot'));
            const batch = writeBatch(db);
            oldDocs.forEach(d => batch.delete(d.ref));

            parsedData.forEach(item => {
                const newDocRef = doc(collection(db, 'faq_bot'));
                // [CodeGenesis] Nối Master Category vào nếu có
                const finalCategory = masterCategory.trim() 
                    ? `${masterCategory.trim()} - ${item.category}` 
                    : (item.category || 'Chung');

                batch.set(newDocRef, {
                    category: finalCategory,
                    keywords: item.keywords || [],
                    answer: item.answer || ''
                });
            });
            await batch.commit();
            
            alert("✅ Đã GHI ĐÈ thành công!");
            jsonInput = '';
            masterCategory = '';
        } catch (error) { alert("❌ Lỗi cập nhật: " + error.message); } 
        finally { isUpdating = false; }
    }

    async function handleAppendJSON() {
        if (!jsonInput.trim()) return alert("Vui lòng dán dữ liệu JSON vào ô trống!");
        const parsedData = parseJSON(jsonInput);
        if (!parsedData) return;

        if (!confirm(`➕ NHẬP THÊM: Hệ thống sẽ GIỮ NGUYÊN câu hỏi cũ và cộng thêm ${parsedData.length} câu hỏi mới. Tiếp tục?`)) return;

        isUpdating = true;
        try {
            const batch = writeBatch(db);
            parsedData.forEach(item => {
                const newDocRef = doc(collection(db, 'faq_bot'));
                // [CodeGenesis] Nối Master Category vào nếu có
                const finalCategory = masterCategory.trim() 
                    ? `${masterCategory.trim()} - ${item.category}` 
                    : (item.category || 'Chung');

                batch.set(newDocRef, {
                    category: finalCategory,
                    keywords: item.keywords || [],
                    answer: item.answer || ''
                });
            });
            await batch.commit();
            
            alert("✅ Đã THÊM MỚI thành công!");
            jsonInput = '';
            masterCategory = '';
        } catch (error) { alert("❌ Lỗi cập nhật: " + error.message); } 
        finally { isUpdating = false; }
    }

    function openAddForm() {
        editingId = null;
        form = { category: '', keywords: '', answer: '' };
        showEditForm = true;
    }

    function openEditForm(item) {
        editingId = item.id;
        form = { category: item.category, keywords: (item.keywords || []).join(', '), answer: item.answer };
        showEditForm = true;
    }

    async function saveManualForm() {
        if (!form.category || !form.answer) return alert("Vui lòng nhập Chủ đề và Câu trả lời!");
        isUpdating = true;
        const keywordsArray = form.keywords.split(',').map(k => k.trim()).filter(Boolean);
        const payload = { category: form.category.trim(), keywords: keywordsArray, answer: form.answer.trim() };

        try {
            if (editingId) await updateDoc(doc(db, 'faq_bot', editingId), payload);
            else await addDoc(collection(db, 'faq_bot'), payload);
            showEditForm = false;
        } catch (error) { alert("Lỗi: " + error.message); }
        finally { isUpdating = false; }
    }

    async function deleteManualFaq(id) {
        if (!confirm("Bạn có chắc chắn muốn xóa câu hỏi này?")) return;
        try { await deleteDoc(doc(db, 'faq_bot', id)); } 
        catch (error) { alert("Lỗi xóa: " + error.message); }
    }
</script>

<div class="flex-1 flex flex-col overflow-hidden bg-slate-50">
    <div class="flex bg-white border-b border-slate-200 shrink-0">
        <button class="flex-1 py-2 text-xs font-bold transition-colors {adminTab === 'import' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}" on:click={() => adminTab = 'import'}>🤖 Nạp JSON</button>
        <button class="flex-1 py-2 text-xs font-bold transition-colors {adminTab === 'manual' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}" on:click={() => adminTab = 'manual'}>✍️ Chỉnh Sửa Tay</button>
    </div>

    {#if adminTab === 'import'}
        <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div class="bg-indigo-50 border border-indigo-200 p-3 rounded-xl shadow-sm">
                <label class="block text-xs font-bold text-indigo-800 mb-1">Nhóm chủ đề gốc (Tùy chọn)</label>
                <input 
                    type="text" 
                    bind:value={masterCategory} 
                    placeholder="VD: Chính sách Thưởng 2026..." 
                    class="w-full bg-white border border-indigo-200 rounded-lg p-2 text-xs outline-none focus:border-indigo-500 shadow-inner"
                >
                <p class="text-[10px] text-indigo-500 mt-1">Sẽ tự động ghép vào trước các category con trong file JSON.</p>
            </div>

            <textarea 
                bind:value={jsonInput} 
                class="flex-1 w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-mono outline-none focus:border-indigo-500 resize-none shadow-inner"
                placeholder={`[\n  {\n    "category": "Trả góp",\n    "keywords": ["lai suat"],\n    "answer": "Nội dung..."\n  }\n]`}
            ></textarea>
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
                <div class="bg-white p-3 rounded-xl border border-indigo-200 shadow-sm animate-popIn flex-1 flex flex-col">
                    <h4 class="font-bold text-sm text-indigo-800 mb-3 border-b pb-2">{editingId ? 'Sửa Câu Hỏi' : 'Thêm Câu Mới'}</h4>
                    <div class="space-y-3 flex-1 overflow-y-auto pr-1">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chủ đề (Category)</label>
                            <input type="text" bind:value={form.category} class="w-full border rounded p-2 text-xs outline-none focus:border-indigo-500" placeholder="VD: Chính sách Thưởng - K1">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Từ khóa (Cách nhau bằng dấu phẩy)</label>
                            <textarea bind:value={form.keywords} rows="2" class="w-full border rounded p-2 text-xs outline-none focus:border-indigo-500 resize-none" placeholder="VD: he so k1, k1, he so vung"></textarea>
                        </div>
                        <div class="flex-1 flex flex-col">
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Câu trả lời (Hỗ trợ HTML)</label>
                            <textarea bind:value={form.answer} class="flex-1 min-h-[100px] w-full border rounded p-2 text-xs outline-none focus:border-indigo-500 resize-none" placeholder="Nhập câu trả lời..."></textarea>
                        </div>
                    </div>
                    <div class="flex gap-2 mt-3 pt-3 border-t">
                        <button class="flex-1 py-2 bg-slate-100 text-slate-600 font-bold text-xs rounded-lg hover:bg-slate-200" on:click={() => showEditForm = false}>Hủy</button>
                        <button class="flex-1 py-2 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700" on:click={saveManualForm} disabled={isUpdating}>
                            {isUpdating ? 'Đang lưu...' : 'Lưu lại'}
                        </button>
                    </div>
                </div>
            {:else}
                <div class="flex justify-between items-center mb-3 px-1">
                    <span class="text-xs font-bold text-slate-500">Tổng: {faqData.length} câu</span>
                    <button class="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-200 flex items-center gap-1" on:click={openAddForm}>
                        <span class="material-icons-round text-[14px]">add</span> Thêm Mới
                    </button>
                </div>
                <div class="space-y-2">
                    {#each faqData as item}
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