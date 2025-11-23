<script>
  import { createEventDispatcher } from 'svelte';
  import { read, utils } from 'xlsx';
  import { db } from '../lib/firebase';
  // Thêm addDoc, serverTimestamp để tạo việc ngay lập tức
  import { collection, doc, setDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
  import { taskTemplate } from '../lib/stores';
  import { safeString, getTodayStr } from '../lib/utils';

  const dispatch = createEventDispatcher();
  let activeType = 'warehouse';
  let newTime = '08:00';
  let newTaskTitle = '';
  let isUploading = false;

  // --- LOGIC UPLOAD EXCEL (Giữ nguyên) ---
  async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    isUploading = true;

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = utils.sheet_to_json(sheet);

      const batch = writeBatch(db);
      let count = 0;
      rawData.forEach(row => {
        const nRow = {};
        Object.keys(row).forEach(k => nRow[k.toLowerCase().trim()] = row[k]);
        
        const uName = safeString(nRow.username || nRow.user);
        if (uName) {
          const userRef = doc(collection(db, 'users'), uName.toLowerCase());
          batch.set(userRef, {
            username: uName,
            username_idx: uName.toLowerCase(),
            pass: safeString(nRow.pass || nRow.password),
            role: safeString(nRow.role).toLowerCase() || 'staff',
            name: nRow.name ? safeString(nRow.name) : uName
          });
          count++;
        }
      });
      await batch.commit();
      alert(`✅ Đã đồng bộ ${count} nhân viên thành công!`);
    } catch (err) {
      alert("Lỗi upload: " + err.message);
    } finally {
      isUploading = false;
      event.target.value = '';
    }
  }

  // --- LOGIC TEMPLATE (NÂNG CẤP) ---
  async function addTemplateTask() {
    if (!newTaskTitle.trim()) return;

    // 1. Cập nhật vào Store & Firestore (Mẫu cho tương lai)
    taskTemplate.update(current => {
      const updated = { ...current };
      if (!updated[activeType]) updated[activeType] = [];
      
      updated[activeType].push({ 
        title: newTaskTitle, 
        time: newTime 
      });
      
      // Sắp xếp lại theo giờ
      updated[activeType].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
      
      // Lưu Mẫu lên Cloud
      setDoc(doc(db, 'settings', 'template'), updated);
      
      return updated;
    });

    // 2. QUAN TRỌNG: Thêm NGAY vào danh sách hôm nay (Current Tasks)
    try {
      await addDoc(collection(db, 'tasks'), {
        type: activeType,
        title: newTaskTitle,
        timeSlot: newTime,
        completed: false,
        completedBy: null,
        time: null,
        note: '',
        createdBy: 'Admin Add', // Đánh dấu do Admin thêm tay
        date: getTodayStr(),
        timestamp: serverTimestamp()
      });
      // Không cần alert, danh sách bên ngoài tự cập nhật nhờ onSnapshot
    } catch (err) {
      console.error("Lỗi thêm việc vào hôm nay:", err);
    }

    newTaskTitle = ''; // Reset ô nhập
  }

  function removeTemplateTask(index) {
    if (!confirm('LƯU Ý: Hành động này chỉ xóa trong MẪU (cho ngày mai). Việc của hôm nay vẫn giữ nguyên để đảm bảo lịch sử.\n\nBạn có chắc muốn xóa mẫu này?')) return;
    
    taskTemplate.update(current => {
      const updated = { ...current };
      updated[activeType].splice(index, 1);
      setDoc(doc(db, 'settings', 'template'), updated);
      return updated;
    });
  }
</script>

<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
  <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-popIn">
    
    <div class="p-4 border-b flex items-center gap-2 bg-slate-50">
      <span class="material-icons-round text-orange-500 text-3xl">settings</span>
      <h3 class="text-lg font-bold text-slate-800">Admin Setup</h3>
    </div>
    
    <div class="p-4 overflow-y-auto flex-1">
      
      <div class="mb-6">
        <h4 class="text-xs font-bold text-slate-500 uppercase mb-2">1. Nhân viên</h4>
        <label for="excel-upload" class="flex items-center justify-center gap-2 w-full p-3 bg-slate-100 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors text-slate-600 font-semibold">
          <span class="material-icons-round">cloud_upload</span> 
          {isUploading ? 'Đang xử lý...' : 'Nạp Excel Nhân viên'}
        </label>
        <input id="excel-upload" type="file" hidden accept=".xlsx, .xls" on:change={handleExcelUpload} disabled={isUploading} />
      </div>

      <div>
        <h4 class="text-xs font-bold text-slate-500 uppercase mb-2">2. Mẫu Checklist</h4>
        
        <select bind:value={activeType} class="w-full p-2 mb-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 outline-none font-medium">
          <option value="warehouse">Kho</option>
          <option value="cashier">Thu Ngân</option>
        </select>

        <div class="flex gap-2 mb-3">
          <input 
            type="text" 
            bind:value={newTime} 
            class="w-20 text-center p-2 border border-slate-200 rounded-lg focus:border-orange-500 outline-none" 
            placeholder="08:00"
          >
          <input 
            type="text" 
            bind:value={newTaskTitle} 
            class="flex-1 p-2 border border-slate-200 rounded-lg focus:border-orange-500 outline-none" 
            placeholder="Tên việc..."
            on:keydown={(e) => e.key === 'Enter' && addTemplateTask()}
          >
          <button 
            class="w-10 h-10 flex items-center justify-center bg-orange-500 text-white rounded-lg hover:bg-orange-600 active:scale-95 transition-all shadow-md disabled:opacity-50"
            on:click={addTemplateTask}
            disabled={!newTaskTitle.trim()}
          >
            <span class="material-icons-round">add</span>
          </button>
        </div>

        <ul class="border rounded-lg divide-y max-h-60 overflow-y-auto bg-slate-50">
          {#if $taskTemplate[activeType]}
            {#each $taskTemplate[activeType] as item, i}
              <li class="flex justify-between items-center p-3 bg-white hover:bg-slate-50 transition-colors">
                <div class="flex gap-3 items-center overflow-hidden">
                  <span class="bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-bold">{item.time || '--:--'}</span>
                  <span class="text-sm text-slate-700 truncate">{item.title}</span>
                </div>
                <button 
                  class="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                  on:click={() => removeTemplateTask(i)}
                >
                  <span class="material-icons-round text-xl">delete</span>
                </button>
              </li>
            {/each}
          {/if}
        </ul>
      </div>
    </div>

    <div class="p-4 border-t bg-slate-50">
      <button 
        class="w-full py-3 rounded-xl font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 transition-colors" 
        on:click={() => dispatch('close')}
      >
        Đóng
      </button>
    </div>
  </div>
</div>

<style>
  @keyframes popIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .animate-popIn { animation: popIn 0.2s ease-out; }
</style>