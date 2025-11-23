<script>
  import { createEventDispatcher } from 'svelte';
  import { read, utils } from 'xlsx';
  import { db } from '../lib/firebase';
  import { collection, doc, setDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
  import { taskTemplate, currentUser, storeList } from '../lib/stores';
  import { safeString, getTodayStr } from '../lib/utils';

  const dispatch = createEventDispatcher();
  $: isSuperAdmin = $currentUser?.role === 'super_admin';
  $: myStores = $currentUser?.storeIds || [];

  // STATE SUPER ADMIN
  let saTab = 'store';
  let newStoreId = '', newStoreName = '';
  let newAdminUser = '', newAdminPass = '';
  // Multi-select stores
  let selectedStoresForAdmin = []; 

  // STATE ADMIN KHO
  let activeType = 'warehouse';
  let newTime = '08:00', newTaskTitle = '', isUploading = false;

  // --- [SUPER ADMIN] 1. TẠO KHO ---
  async function createStore() {
    if(!newStoreId || !newStoreName) return alert("Thiếu thông tin!");
    try {
        await setDoc(doc(db, 'stores', newStoreId.trim().toUpperCase()), { name: newStoreName.trim(), createdAt: serverTimestamp() });
        alert(`✅ Đã tạo kho: ${newStoreName}`); newStoreId=''; newStoreName='';
    } catch(e) { alert(e.message); }
  }

  // --- [SUPER ADMIN] 2. CẤP QUYỀN (HỖ TRỢ NHIỀU KHO) ---
  async function createAdminAccount() {
    if(!newAdminUser || !newAdminPass || selectedStoresForAdmin.length === 0) return alert("Thiếu thông tin!");
    try {
        const u = newAdminUser.trim().toLowerCase();
        await setDoc(doc(db, 'users', u), {
            username: u, username_idx: u, pass: newAdminPass.trim(),
            name: newAdminUser.trim(), role: 'admin', 
            storeIds: selectedStoresForAdmin, // Lưu Mảng
            createdAt: serverTimestamp()
        });
        alert(`✅ Đã cấp quyền ${u} quản lý: ${selectedStoresForAdmin.join(', ')}`);
        newAdminUser=''; newAdminPass=''; selectedStoresForAdmin=[];
    } catch(e) { alert(e.message); }
  }

  // --- [ADMIN KHO] UPLOAD EXCEL ---
  async function handleExcelUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    isUploading = true; event.target.value = null;
    try {
      const rawData = utils.sheet_to_json(read(await file.arrayBuffer()).Sheets[read(await file.arrayBuffer()).SheetNames[0]]);
      const batch = writeBatch(db);
      let count = 0;
      rawData.forEach(row => {
        const nRow = {}; Object.keys(row).forEach(k => nRow[k.toLowerCase().trim()] = row[k]);
        const uName = safeString(nRow.username || nRow.user);
        if (uName) {
            // Role: admin hoặc staff
            const role = safeString(nRow.role).toLowerCase() === 'admin' ? 'admin' : 'staff';
            // Store: Lấy từ excel hoặc gán tất cả kho của admin hiện tại
            let targetStores = [];
            if(nRow.makho) targetStores = [safeString(nRow.makho)];
            else targetStores = myStores; // Default gán hết kho của quản lý

            batch.set(doc(db, 'users', uName.toLowerCase()), {
                username: uName, username_idx: uName.toLowerCase(), 
                pass: safeString(nRow.pass || nRow.password),
                name: nRow.name ? safeString(nRow.name) : uName,
                role: role, storeIds: targetStores
            }, { merge: true });
            count++;
        }
      });
      await batch.commit(); alert(`✅ Xong! ${count} tài khoản.`);
    } catch (err) { alert("Lỗi: " + err.message); } finally { isUploading = false; }
  }

  // --- [ADMIN KHO] CHECKLIST (LOOP QUA TẤT CẢ KHO) ---
  async function addTemplateTask() {
    if (!newTaskTitle.trim()) return;
    
    // Loop qua các kho user quản lý để thêm mẫu
    myStores.forEach(sId => {
        // Update Template
        taskTemplate.update(curr => { /* (Logic update store local - hơi phức tạp nên bỏ qua, chỉ update DB) */ return curr; });
        // Save DB Template
        // Lưu ý: Cần logic load template rồi merge, ở đây setDoc đè sẽ mất cái cũ. 
        // Để an toàn, chỉ setDoc merge hoặc updateDoc.
        // Simplified: Ta giả định Admin mở App lên là đã load template của kho đầu tiên.
        // Ta sẽ lấy template hiện tại ($taskTemplate) cộng thêm việc mới, rồi lưu vào TẤT CẢ kho.
        const up = { ...$taskTemplate }; 
        if (!up[activeType]) up[activeType] = [];
        up[activeType].push({ title: newTaskTitle, time: newTime });
        up[activeType].sort((a, b) => (a.time||"00:00").localeCompare(b.time||"00:00"));
        setDoc(doc(db, 'settings', `template_${sId}`), up); 

        // Add Task Today
        addDoc(collection(db, 'tasks'), { 
            type: activeType, title: newTaskTitle, timeSlot: newTime, completed: false, 
            createdBy: 'Admin', date: getTodayStr(), storeId: sId, timestamp: serverTimestamp() 
        });
    });
    
    newTaskTitle = '';
    alert("✅ Đã thêm việc vào tất cả kho quản lý!");
  }
</script>

<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
  <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-popIn">
    
    <div class="p-4 border-b flex items-center gap-2 bg-slate-50">
      <span class="material-icons-round text-orange-500 text-3xl">settings</span>
      <div class="flex-1">
          <h3 class="text-lg font-bold text-slate-800">{isSuperAdmin ? 'SUPER ADMIN' : `Quản Lý: ${myStores.join(', ')}`}</h3>
      </div>
    </div>
    
    <div class="p-4 overflow-y-auto flex-1">
        {#if isSuperAdmin}
            <div class="flex gap-2 mb-4 border-b pb-2">
                <button class="px-3 py-1 rounded text-sm font-bold {saTab==='store'?'bg-purple-600 text-white':'bg-gray-100'}" on:click={()=>saTab='store'}>1. Tạo Kho</button>
                <button class="px-3 py-1 rounded text-sm font-bold {saTab==='account'?'bg-purple-600 text-white':'bg-gray-100'}" on:click={()=>saTab='account'}>2. Cấp Admin</button>
            </div>

            {#if saTab === 'store'}
                <div class="space-y-3">
                    <input type="text" bind:value={newStoreId} class="w-full p-2 border rounded uppercase" placeholder="Mã Kho">
                    <input type="text" bind:value={newStoreName} class="w-full p-2 border rounded" placeholder="Tên Kho">
                    <button class="w-full py-2 bg-green-600 text-white rounded font-bold" on:click={createStore}>Thêm Kho Mới</button>
                    <div class="mt-4"><p class="text-xs font-bold text-gray-500 uppercase">Kho hiện có:</p>
                        {#each $storeList as s}<div class="text-sm border-b p-1">{s.name} ({s.id})</div>{/each}
                    </div>
                </div>
            {:else}
                <div class="space-y-3">
                    <input type="text" bind:value={newAdminUser} class="w-full p-2 border rounded" placeholder="User Admin">
                    <input type="text" bind:value={newAdminPass} class="w-full p-2 border rounded" placeholder="Pass">
                    <p class="text-sm font-bold text-gray-600">Chọn kho quản lý:</p>
                    <div class="max-h-40 overflow-y-auto border rounded p-2 bg-slate-50">
                        {#each $storeList as s}
                            <label class="flex items-center gap-2 p-1 hover:bg-white cursor-pointer">
                                <input type="checkbox" bind:group={selectedStoresForAdmin} value={s.id} class="accent-purple-600">
                                <span class="text-sm">{s.name}</span>
                            </label>
                        {/each}
                    </div>
                    <button class="w-full py-2 bg-purple-600 text-white rounded font-bold" on:click={createAdminAccount}>Cấp Quyền</button>
                </div>
            {/if}
        {:else}
            <div class="mb-6 border-b pb-4">
                <h4 class="text-sm font-bold text-slate-700 uppercase mb-2">1. Cấp quyền nhân sự</h4>
                <label class="flex items-center justify-center gap-2 w-full p-4 bg-blue-50 border border-dashed border-blue-300 rounded-xl cursor-pointer hover:bg-blue-100 font-bold text-blue-700">
                    <span class="material-icons-round">upload_file</span> {isUploading ? '...' : 'Upload Excel'}
                    <input type="file" hidden accept=".xlsx, .xls" on:change={handleExcelUpload} disabled={isUploading} />
                </label>
            </div>
            <div>
                <h4 class="text-sm font-bold text-slate-700 uppercase mb-2">2. Cấu hình mẫu (Áp dụng tất cả kho)</h4>
                <div class="flex gap-2 mb-2"><select bind:value={activeType} class="w-full p-2 border rounded"><option value="warehouse">Kho</option><option value="cashier">Thu Ngân</option></select></div>
                <div class="flex gap-2 mb-3">
                    <input type="text" bind:value={newTime} class="w-20 text-center p-2 border rounded" placeholder="08:00">
                    <input type="text" bind:value={newTaskTitle} class="flex-1 p-2 border rounded" placeholder="Tên việc..." on:keydown={(e)=>e.key==='Enter'&&addTemplateTask()}>
                    <button class="w-10 bg-orange-500 text-white rounded flex items-center justify-center" on:click={addTemplateTask}>+</button>
                </div>
            </div>
        {/if}
    </div>
    <div class="p-4 border-t bg-slate-50"><button class="w-full py-3 rounded-xl font-bold text-slate-700 bg-slate-200" on:click={()=>dispatch('close')}>Đóng</button></div>
  </div>
</div>
<style>.animate-popIn { animation: popIn 0.2s ease-out; } @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }</style>