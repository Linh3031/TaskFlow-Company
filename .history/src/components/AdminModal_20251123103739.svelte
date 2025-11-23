<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { read, utils } from 'xlsx';
  import { db } from '../lib/firebase';
  import { collection, doc, setDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
  import { taskTemplate, currentUser, storeList } from '../lib/stores';
  import { safeString, getTodayStr } from '../lib/utils';

  const dispatch = createEventDispatcher();
  
  // Tự động nhận diện quyền
  $: isSuperAdmin = $currentUser?.role === 'super_admin';
  $: myStoreId = $currentUser?.storeId;

  // STATE SUPER ADMIN
  let saTab = 'store';
  let newStoreId = '', newStoreName = '';
  let newAdminUser = '', newAdminPass = '', targetStoreForAdmin = '';

  // STATE ADMIN KHO
  let activeType = 'warehouse';
  let newTime = '08:00', newTaskTitle = '', isUploading = false;

  // --- [SUPER ADMIN] 1. TẠO KHO ---
  async function createStore() {
    if(!newStoreId || !newStoreName) return alert("Thiếu thông tin kho!");
    try {
        await setDoc(doc(db, 'stores', newStoreId.trim().toUpperCase()), { 
            name: newStoreName.trim(), createdAt: serverTimestamp() 
        });
        alert(`✅ Đã tạo kho: ${newStoreName}`); newStoreId=''; newStoreName='';
    } catch(e) { alert(e.message); }
  }

  // --- [SUPER ADMIN] 2. TẠO ADMIN ĐẦU TIÊN (SỬA LỖI TÊN HIỂN THỊ) ---
  async function createAdminAccount() {
    if(!newAdminUser || !newAdminPass || !targetStoreForAdmin) return alert("Thiếu thông tin!");
    try {
        const u = newAdminUser.trim().toLowerCase(); // VD: linh-3031
        await setDoc(doc(db, 'users', u), {
            username: u, username_idx: u, pass: newAdminPass.trim(),
            name: newAdminUser.trim(), // SỬA: Lấy đúng tên nhập vào làm tên hiển thị
            role: 'admin', 
            storeId: targetStoreForAdmin, 
            createdAt: serverTimestamp()
        });
        alert(`✅ Đã cấp quyền Admin kho ${targetStoreForAdmin} cho user: ${u}`);
        newAdminUser=''; newAdminPass=''; targetStoreForAdmin='';
    } catch(e) { alert(e.message); }
  }

  // --- [ADMIN KHO] 1. UPLOAD EXCEL (HỖ TRỢ TẠO ADMIN ĐỒNG CẤP) ---
  async function handleExcelUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    isUploading = true;
    try {
      const data = await file.arrayBuffer();
      const rawData = utils.sheet_to_json(read(data).Sheets[read(data).SheetNames[0]]);
      const batch = writeBatch(db);
      let count = 0;
      
      rawData.forEach(row => {
        const nRow = {}; Object.keys(row).forEach(k => nRow[k.toLowerCase().trim()] = row[k]);
        const uName = safeString(nRow.username || nRow.user);
        
        if (uName) {
            // Logic Role: Nếu excel ghi 'admin' -> tạo admin, ngược lại là staff
            // Chỉ tạo user cho KHO HIỆN TẠI (myStoreId)
            const role = safeString(nRow.role).toLowerCase() === 'admin' ? 'admin' : 'staff';
            
            batch.set(doc(db, 'users', uName.toLowerCase()), {
                username: uName, username_idx: uName.toLowerCase(), 
                pass: safeString(nRow.pass || nRow.password),
                name: nRow.name ? safeString(nRow.name) : uName,
                role: role, 
                storeId: myStoreId // Luôn gán vào kho hiện tại
            }, { merge: true });
            count++;
        }
      });
      await batch.commit(); alert(`✅ Đã đồng bộ ${count} tài khoản vào kho ${myStoreId}!`);
    } catch (err) { alert("Lỗi: " + err.message); } 
    finally { isUploading = false; event.target.value = ''; }
  }

  // --- [ADMIN KHO] 2. CHECKLIST (Giữ nguyên) ---
  async function addTemplateTask() {
    if (!newTaskTitle.trim()) return;
    taskTemplate.update(curr => {
        const up = { ...curr }; if (!up[activeType]) up[activeType] = [];
        up[activeType].push({ title: newTaskTitle, time: newTime });
        up[activeType].sort((a, b) => (a.time||"00:00").localeCompare(b.time||"00:00"));
        setDoc(doc(db, 'settings', `template_${myStoreId}`), up); return up;
    });
    try { await addDoc(collection(db, 'tasks'), { 
        type: activeType, title: newTaskTitle, timeSlot: newTime, completed: false, 
        createdBy: $currentUser.name, date: getTodayStr(), storeId: myStoreId, timestamp: serverTimestamp() 
    }); } catch(e){}
    newTaskTitle = '';
  }
  
  function removeTemplateTask(i) {
    if(!confirm('Xóa mẫu?')) return;
    taskTemplate.update(curr => {
        const up = {...curr}; up[activeType].splice(i, 1);
        setDoc(doc(db, 'settings', `template_${myStoreId}`), up); return up;
    });
  }
</script>

<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
  <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-popIn">
    
    <div class="p-4 border-b flex items-center gap-2 bg-slate-50">
      <span class="material-icons-round text-orange-500 text-3xl">settings</span>
      <div class="flex-1">
          <h3 class="text-lg font-bold text-slate-800">
              {isSuperAdmin ? 'SUPER ADMIN (Setup)' : `Quản Lý Kho: ${myStoreId}`}
          </h3>
          <p class="text-xs text-gray-500">
              {isSuperAdmin ? 'Khởi tạo kho & Cấp Admin đầu tiên' : 'Quản lý nhân sự & Checklist'}
          </p>
      </div>
    </div>
    
    <div class="p-4 overflow-y-auto flex-1">
        
        {#if isSuperAdmin}
            <div class="flex gap-2 mb-4 border-b pb-2">
                <button class="px-3 py-1 rounded text-sm font-bold {saTab==='store'?'bg-purple-600 text-white':'bg-gray-100 text-gray-600'}" on:click={()=>saTab='store'}>1. Tạo Kho</button>
                <button class="px-3 py-1 rounded text-sm font-bold {saTab==='account'?'bg-purple-600 text-white':'bg-gray-100 text-gray-600'}" on:click={()=>saTab='account'}>2. Cấp Admin</button>
            </div>

            {#if saTab === 'store'}
                <div class="space-y-3">
                    <input type="text" bind:value={newStoreId} class="w-full p-2 border rounded uppercase" placeholder="Mã Kho (VD: 908)">
                    <input type="text" bind:value={newStoreName} class="w-full p-2 border rounded" placeholder="Tên hiển thị">
                    <button class="w-full py-2 bg-green-600 text-white rounded font-bold" on:click={createStore}>Thêm Kho Mới</button>
                    
                    <div class="mt-4">
                        <p class="text-xs font-bold text-gray-500 uppercase mb-2">Kho hiện có:</p>
                        <ul class="bg-gray-50 rounded border divide-y max-h-32 overflow-y-auto">
                            {#each $storeList as store}
                                <li class="p-2 text-sm flex justify-between"><span>{store.name}</span> <span class="font-mono font-bold">{store.id}</span></li>
                            {/each}
                        </ul>
                    </div>
                </div>
            {:else}
                <div class="space-y-3">
                    <input type="text" bind:value={newAdminUser} class="w-full p-2 border rounded" placeholder="Tên đăng nhập (VD: Linh-3031)">
                    <input type="text" bind:value={newAdminPass} class="w-full p-2 border rounded" placeholder="Mật khẩu">
                    <select bind:value={targetStoreForAdmin} class="w-full p-2 border rounded bg-white">
                        <option value="" disabled selected>-- Chọn Kho quản lý --</option>
                        {#each $storeList as store}<option value={store.id}>{store.name} ({store.id})</option>{/each}
                    </select>
                    <button class="w-full py-2 bg-purple-600 text-white rounded font-bold" on:click={createAdminAccount}>Cấp Quyền Admin</button>
                </div>
            {/if}

        {:else}
            <div class="mb-6 border-b pb-4">
                <h4 class="text-sm font-bold text-slate-700 uppercase mb-2 flex items-center gap-2">
                    <span class="material-icons-round text-blue-500 text-base">group_add</span> 
                    1. Cấp quyền nhân sự
                </h4>
                <label class="flex items-center justify-center gap-2 w-full p-4 bg-blue-50 border border-dashed border-blue-300 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors text-blue-700 font-bold">
                    <span class="material-icons-round">upload_file</span> 
                    {isUploading ? 'Đang xử lý...' : 'Upload Excel Danh sách'}
                </label>
                <input type="file" hidden accept=".xlsx, .xls" on:change={handleExcelUpload} disabled={isUploading} />
                <div class="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    <p><b>Cấu trúc Excel:</b> Cột <code>user</code>, <code>pass</code>, <code>name</code>, <code>role</code></p>
                    <p>Nhập <code>role</code> = <b>admin</b> để tạo Admin đồng cấp.</p>
                </div>
            </div>

            <div>
                <h4 class="text-sm font-bold text-slate-700 uppercase mb-2 flex items-center gap-2">
                    <span class="material-icons-round text-orange-500 text-base">playlist_add_check</span> 
                    2. Cấu hình việc mẫu
                </h4>
                <div class="flex gap-2 mb-2">
                    <select bind:value={activeType} class="w-full p-2 border rounded bg-white font-medium">
                        <option value="warehouse">📦 Kho</option>
                        <option value="cashier">💰 Thu Ngân</option>
                    </select>
                </div>
                <div class="flex gap-2 mb-3">
                    <input type="text" bind:value={newTime} class="w-20 text-center p-2 border rounded" placeholder="08:00">
                    <input type="text" bind:value={newTaskTitle} class="flex-1 p-2 border rounded" placeholder="Tên việc..." on:keydown={(e)=>e.key==='Enter'&&addTemplateTask()}>
                    <button class="w-10 bg-orange-500 text-white rounded flex items-center justify-center shadow-md active:scale-95 transition-transform" on:click={addTemplateTask}>
                        <span class="material-icons-round">add</span>
                    </button>
                </div>
                
                <ul class="border rounded-lg divide-y max-h-48 overflow-y-auto bg-slate-50">
                    {#if $taskTemplate[activeType]}
                        {#each $taskTemplate[activeType] as item, i}
                        <li class="flex justify-between p-2 text-sm items-center hover:bg-white transition-colors">
                            <span class="flex items-center gap-2">
                                <b class="bg-gray-200 px-1.5 py-0.5 rounded text-xs text-gray-600">{item.time}</b> 
                                {item.title}
                            </span> 
                            <button class="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50" on:click={()=>removeTemplateTask(i)}>
                                <span class="material-icons-round text-base">close</span>
                            </button>
                        </li>
                        {/each}
                    {/if}
                </ul>
            </div>
        {/if}
    </div>

    <div class="p-4 border-t bg-slate-50">
      <button class="w-full py-3 rounded-xl font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors" on:click={() => dispatch('close')}>Đóng</button>
    </div>
  </div>
</div>

<style>.animate-popIn { animation: popIn 0.2s ease-out; } @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }</style>