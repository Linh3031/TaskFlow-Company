<script>
  import { createEventDispatcher } from 'svelte';
  import { read, utils } from 'xlsx';
  import { db } from '../lib/firebase';
  import { collection, doc, setDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
  import { taskTemplate, currentUser, storeList } from '../lib/stores';
  import { safeString, getTodayStr } from '../lib/utils';

  const dispatch = createEventDispatcher();
  
  // Xác định quyền
  const isSuperAdmin = $currentUser?.role === 'super_admin';
  const myStoreId = $currentUser?.storeId;

  // STATE CHO SUPER ADMIN
  let saTab = 'store'; // 'store' | 'account'
  let newStoreId = '';
  let newStoreName = '';
  let newAdminUser = '';
  let newAdminPass = '';
  let targetStoreForAdmin = ''; // Kho gán cho admin mới

  // STATE CHO ADMIN KHO
  let activeType = 'warehouse';
  let newTime = '08:00';
  let newTaskTitle = '';
  let isUploading = false;

  // --- [SUPER ADMIN] 1. TẠO KHO MỚI ---
  async function createStore() {
    if(!newStoreId || !newStoreName) return alert("Vui lòng nhập đủ Mã kho và Tên kho!");
    
    const cleanId = newStoreId.trim().toUpperCase();
    try {
        await setDoc(doc(db, 'stores', cleanId), {
            name: newStoreName.trim(),
            createdAt: serverTimestamp()
        });
        alert(`✅ Đã tạo kho mới: ${newStoreName} (${cleanId})`);
        newStoreId = '';
        newStoreName = '';
    } catch(e) { 
        alert("Lỗi: " + e.message); 
    }
  }

  // --- [SUPER ADMIN] 2. TẠO TÀI KHOẢN ADMIN CHO KHO ---
  async function createAdminAccount() {
    if(!newAdminUser || !newAdminPass || !targetStoreForAdmin) {
        return alert("Vui lòng nhập đủ Username, Password và chọn Kho!");
    }

    try {
        const cleanUser = newAdminUser.trim().toLowerCase();
        await setDoc(doc(db, 'users', cleanUser), {
            username: cleanUser,
            username_idx: cleanUser,
            pass: newAdminPass.trim(),
            name: `Admin Kho ${targetStoreForAdmin}`,
            role: 'admin', // Cấp quyền Admin kho
            storeId: targetStoreForAdmin, // Gán vào kho đã chọn
            createdAt: serverTimestamp()
        });
        alert(`✅ Đã tạo Admin: ${cleanUser} quản lý kho ${targetStoreForAdmin}`);
        newAdminUser = '';
        newAdminPass = '';
        targetStoreForAdmin = '';
    } catch(e) { 
        alert("Lỗi: " + e.message); 
    }
  }

  // --- [ADMIN KHO] 1. UPLOAD EXCEL (Chỉ nạp cho kho của mình) ---
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
        // Chuẩn hóa key về chữ thường
        Object.keys(row).forEach(k => nRow[k.toLowerCase().trim()] = row[k]);
        
        const uName = safeString(nRow.username || nRow.user);
        if (uName) {
          const userRef = doc(db, 'users', uName.toLowerCase());
          
          batch.set(userRef, {
            username: uName,
            username_idx: uName.toLowerCase(),
            pass: safeString(nRow.pass || nRow.password),
            name: nRow.name ? safeString(nRow.name) : uName,
            role: 'staff', // Mặc định là nhân viên
            storeId: myStoreId // TỰ ĐỘNG GÁN VÀO KHO CỦA ADMIN
          }, { merge: true });
          
          count++;
        }
      });
      
      await batch.commit();
      alert(`✅ Đã tạo/cập nhật ${count} nhân viên cho kho ${myStoreId}!`);
    } catch (err) { 
        alert("Lỗi upload: " + err.message); 
    } finally { 
        isUploading = false; 
        event.target.value = ''; 
    }
  }

  // --- [ADMIN KHO] 2. QUẢN LÝ CHECKLIST (Giữ nguyên logic) ---
  async function addTemplateTask() {
    if (!newTaskTitle.trim()) return;

    taskTemplate.update(current => {
        const updated = { ...current };
        if (!updated[activeType]) updated[activeType] = [];
        updated[activeType].push({ title: newTaskTitle, time: newTime });
        updated[activeType].sort((a, b) => (a.time||"00:00").localeCompare(b.time||"00:00"));
        
        // Lưu vào settings/template_{myStoreId}
        setDoc(doc(db, 'settings', `template_${myStoreId}`), updated);
        return updated;
    });

    // Thêm ngay vào việc hôm nay
    try {
        await addDoc(collection(db, 'tasks'), {
            type: activeType,
            title: newTaskTitle,
            timeSlot: newTime,
            completed: false,
            completedBy: null,
            time: null,
            note: '',
            createdBy: 'Admin Add',
            date: getTodayStr(),
            storeId: myStoreId,
            timestamp: serverTimestamp()
        });
    } catch(e) { console.error(e); }

    newTaskTitle = '';
  }
  
  function removeTemplateTask(index) {
    if(!confirm('Xóa mẫu này?')) return;
    taskTemplate.update(curr => {
        const updated = {...curr}; 
        updated[activeType].splice(index, 1);
        setDoc(doc(db, 'settings', `template_${myStoreId}`), updated); 
        return updated;
    });
  }
</script>

<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
  <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-popIn">
    
    <div class="p-4 border-b flex items-center gap-2 bg-slate-50">
      <span class="material-icons-round text-orange-500 text-3xl">settings</span>
      <div class="flex-1">
          <h3 class="text-lg font-bold text-slate-800">
              {isSuperAdmin ? 'SUPER ADMIN' : `Admin Kho: ${myStoreId}`}
          </h3>
          {#if isSuperAdmin}
            <p class="text-xs text-gray-500">Quản trị hệ thống toàn cục</p>
          {/if}
      </div>
    </div>
    
    <div class="p-4 overflow-y-auto flex-1">
        
        {#if isSuperAdmin}
            <div class="flex gap-2 mb-4 border-b pb-2">
                <button 
                    class="px-3 py-1 rounded-lg text-sm font-bold transition-colors {saTab==='store'?'bg-purple-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}" 
                    on:click={()=>saTab='store'}
                >
                    1. Quản lý Kho
                </button>
                <button 
                    class="px-3 py-1 rounded-lg text-sm font-bold transition-colors {saTab==='account'?'bg-purple-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}" 
                    on:click={()=>saTab='account'}
                >
                    2. Tạo Admin Kho
                </button>
            </div>

            {#if saTab === 'store'}
                <div class="space-y-3">
                    <h4 class="text-xs font-bold text-gray-500 uppercase">Thêm Kho Mới</h4>
                    <input type="text" bind:value={newStoreId} class="w-full p-2 border rounded uppercase" placeholder="Mã Kho (VD: 908)">
                    <input type="text" bind:value={newStoreName} class="w-full p-2 border rounded" placeholder="Tên hiển thị (VD: Kho Nguyễn Văn Linh)">
                    <button class="w-full py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 transition-colors" on:click={createStore}>
                        Tạo Kho
                    </button>
                    
                    <div class="mt-4">
                        <h4 class="text-xs font-bold text-gray-500 uppercase mb-2">Danh sách Kho hiện có:</h4>
                        <ul class="bg-gray-50 rounded border divide-y max-h-40 overflow-y-auto">
                            {#each $storeList as store}
                                <li class="p-2 text-sm flex justify-between items-center">
                                    <span>{store.name}</span> 
                                    <span class="font-mono font-bold bg-gray-200 px-2 py-1 rounded text-xs">{store.id}</span>
                                </li>
                            {/each}
                        </ul>
                    </div>
                </div>
            {:else}
                <div class="space-y-3">
                    <h4 class="text-xs font-bold text-gray-500 uppercase">Cấp quyền Admin cho Kho</h4>
                    <input type="text" bind:value={newAdminUser} class="w-full p-2 border rounded" placeholder="Username Admin (VD: admin_908)">
                    <input type="text" bind:value={newAdminPass} class="w-full p-2 border rounded" placeholder="Mật khẩu">
                    
                    <select bind:value={targetStoreForAdmin} class="w-full p-2 border rounded bg-white">
                        <option value="" disabled selected>-- Chọn Kho quản lý --</option>
                        {#each $storeList as store}
                            <option value={store.id}>{store.name} ({store.id})</option>
                        {/each}
                    </select>
                    
                    <button class="w-full py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition-colors" on:click={createAdminAccount}>
                        Cấp Quyền Admin
                    </button>
                </div>
            {/if}

        {:else}
            <div class="mb-6">
                <h4 class="text-xs font-bold text-slate-500 uppercase mb-2">1. Nhân viên (Kho {myStoreId})</h4>
                <label for="excel-upload" class="flex items-center justify-center gap-2 w-full p-3 bg-slate-100 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors text-slate-600 font-semibold">
                    <span class="material-icons-round">cloud_upload</span> 
                    {isUploading ? 'Đang xử lý...' : 'Nạp Excel Nhân viên'}
                </label>
                <input id="excel-upload" type="file" hidden accept=".xlsx, .xls" on:change={handleExcelUpload} disabled={isUploading} />
                <p class="text-xs text-gray-400 mt-1 italic">*Excel chỉ cần cột: user, pass, name</p>
            </div>

            <div>
                <h4 class="text-xs font-bold text-slate-500 uppercase mb-2">2. Mẫu Checklist</h4>
                <div class="flex gap-2 mb-2">
                     <select bind:value={activeType} class="w-full p-2 border rounded">
                         <option value="warehouse">Kho</option>
                         <option value="cashier">Thu Ngân</option>
                     </select>
                </div>
                <div class="flex gap-2 mb-3">
                    <input type="text" bind:value={newTime} class="w-20 text-center p-2 border rounded" placeholder="08:00">
                    <input type="text" bind:value={newTaskTitle} class="flex-1 p-2 border rounded" placeholder="Tên việc..." on:keydown={(e)=>e.key==='Enter'&&addTemplateTask()}>
                    <button class="w-10 bg-orange-500 text-white rounded flex items-center justify-center" on:click={addTemplateTask}>
                        <span class="material-icons-round">add</span>
                    </button>
                </div>
                
                <ul class="border rounded-lg divide-y max-h-40 overflow-y-auto bg-slate-50">
                    {#if $taskTemplate[activeType]}
                        {#each $taskTemplate[activeType] as item, i}
                        <li class="flex justify-between p-2 text-sm items-center">
                            <span><b class="bg-slate-200 px-1 rounded text-xs mr-1">{item.time}</b> {item.title}</span> 
                            <button class="text-red-500 hover:bg-red-50 p-1 rounded" on:click={()=>removeTemplateTask(i)}>
                                <span class="material-icons-round text-sm">close</span>
                            </button>
                        </li>
                        {/each}
                    {/if}
                </ul>
            </div>
        {/if}
    </div>

    <div class="p-4 border-t bg-slate-50">
      <button class="w-full py-3 rounded-xl font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors" on:click={() => dispatch('close')}>
        Đóng
      </button>
    </div>
  </div>
</div>

<style>
  .animate-popIn { animation: popIn 0.2s ease-out; }
  @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>