<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { read, utils } from 'xlsx';
  import { db } from '../lib/firebase';
  import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
  import { taskTemplate, DEFAULT_TEMPLATE } from '../lib/stores';
  import { safeString } from '../lib/utils';

  const dispatch = createEventDispatcher();
  
  let activeType = 'warehouse';
  let newTime = '08:00';
  let newTaskTitle = '';
  let isUploading = false;

  // --- LOGIC UPLOAD EXCEL ---
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
      event.target.value = ''; // Reset input
    }
  }

  // --- LOGIC TEMPLATE ---
  function addTemplateTask() {
    if (!newTaskTitle.trim()) return;

    taskTemplate.update(current => {
      const updated = { ...current };
      if (!updated[activeType]) updated[activeType] = [];
      
      updated[activeType].push({ 
        title: newTaskTitle, 
        time: newTime 
      });
      
      // Sắp xếp lại theo giờ
      updated[activeType].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
      
      // Lưu lên Cloud
      setDoc(doc(db, 'settings', 'template'), updated);
      
      return updated;
    });

    newTaskTitle = ''; // Reset ô nhập
  }

  function removeTemplateTask(index) {
    if (!confirm('Xóa mẫu này?')) return;

    taskTemplate.update(current => {
      const updated = { ...current };
      updated[activeType].splice(index, 1);
      setDoc(doc(db, 'settings', 'template'), updated);
      return updated;
    });
  }
</script>

<div class="modal-overlay" role="dialog" aria-modal="true">
  <div class="modal-box text-left">
    <h3 class="flex items-center gap-2 mb-4">
      <span class="material-icons-round text-orange">settings</span> 
      Admin Setup
    </h3>
    
    <div class="section border-b mb-4 pb-4">
      <h4 class="mb-2 text-sm font-bold">1. Nhân viên</h4>
      <label for="excel-upload" class="btn-secondary w-full flex justify-center items-center gap-2 cursor-pointer">
        <span class="material-icons-round">cloud_upload</span> 
        {isUploading ? 'Đang xử lý...' : 'Nạp Excel Nhân viên'}
      </label>
      <input 
        id="excel-upload" 
        type="file" 
        hidden 
        accept=".xlsx, .xls" 
        on:change={handleExcelUpload}
        disabled={isUploading}
      />
    </div>

    <div class="section">
      <h4 class="mb-2 text-sm font-bold">2. Mẫu Checklist</h4>
      
      <div class="flex gap-2 mb-2">
        <select bind:value={activeType} class="w-full p-2 border rounded">
          <option value="warehouse">Kho</option>
          <option value="cashier">Thu Ngân</option>
        </select>
      </div>

      <div class="input-card flex gap-2 p-2 bg-gray-50 rounded mb-2">
        <input 
          type="text" 
          bind:value={newTime} 
          class="w-16 text-center border rounded" 
          placeholder="08:00"
          aria-label="Giờ thực hiện"
        >
        <input 
          type="text" 
          bind:value={newTaskTitle} 
          class="flex-1 border rounded px-2" 
          placeholder="Tên việc..."
          aria-label="Tên công việc mẫu"
          on:keydown={(e) => e.key === 'Enter' && addTemplateTask()}
        >
        <button 
          class="btn-circle bg-orange text-white w-8 h-8 flex items-center justify-center rounded"
          on:click={addTemplateTask}
          aria-label="Thêm mẫu"
        >
          <span class="material-icons-round text-sm">add</span>
        </button>
      </div>

      <ul class="task-list-preview">
        {#if $taskTemplate[activeType]}
          {#each $taskTemplate[activeType] as item, i}
            <li class="flex justify-between items-center p-2 border-b text-sm">
              <div class="flex gap-2 items-center">
                <span class="bg-gray-200 px-1 rounded text-xs font-bold">{item.time || '--:--'}</span>
                <span>{item.title}</span>
              </div>
              <button 
                class="text-red-500 hover:bg-red-50 rounded p-1" 
                on:click={() => removeTemplateTask(i)}
                aria-label="Xóa mẫu này"
              >
                <span class="material-icons-round text-sm">delete</span>
              </button>
            </li>
          {/each}
        {/if}
      </ul>
    </div>

    <button 
      class="btn-secondary w-full mt-4 bg-gray-800 text-white" 
      on:click={() => dispatch('close')}
    >
      Đóng
    </button>
  </div>
</div>

<style>
  /* Tận dụng lại các class global hoặc define lại scope */
  .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
  .modal-box { background: white; width: 90%; max-width: 450px; padding: 20px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-height: 90vh; display: flex; flex-direction: column; }
  .task-list-preview { overflow-y: auto; flex: 1; max-height: 200px; border: 1px solid #eee; border-radius: 8px; list-style: none; padding: 0; margin: 0; }
  
  .btn-secondary { padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; border: 1px solid #ddd; background: #f0f0f0; }
  .text-orange { color: #ff9800; }
  .bg-orange { background-color: #ff9800; }
  .text-white { color: white; }
  
  input, select { outline: none; }
</style>