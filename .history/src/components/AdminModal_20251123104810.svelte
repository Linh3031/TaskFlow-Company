<script>
  import { createEventDispatcher } from 'svelte';
  import { read, utils } from 'xlsx';
  import { db } from '../lib/firebase';
  import { collection, doc, setDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
  import { taskTemplate, currentUser, storeList } from '../lib/stores';
  import { safeString, getTodayStr } from '../lib/utils';

  const dispatch = createEventDispatcher();
  
  // Reactive variables
  $: isSuperAdmin = $currentUser?.role === 'super_admin';
  $: myStoreId = $currentUser?.storeId;

  // STATE
  let saTab = 'store';
  let newStoreId = '', newStoreName = '';
  let newAdminUser = '', newAdminPass = '', targetStoreForAdmin = '';
  let activeType = 'warehouse';
  let newTime = '08:00', newTaskTitle = '', isUploading = false;

  // --- LOGIC SUPER ADMIN (Giữ nguyên) ---
  async function createStore() {
    if(!newStoreId || !newStoreName) return alert("Thiếu thông tin!");
    try {
        await setDoc(doc(db, 'stores', newStoreId.trim().toUpperCase()), { name: newStoreName.trim(), createdAt: serverTimestamp() });
        alert(`✅ Đã tạo kho: ${newStoreName}`); newStoreId=''; newStoreName='';
    } catch(e) { alert(e.message); }
  }

  async function createAdminAccount() {
    if(!newAdminUser || !newAdminPass || !targetStoreForAdmin) return alert("Thiếu thông tin!");
    try {
        const u = newAdminUser.trim().toLowerCase();
        await setDoc(doc(db, 'users', u), {
            username: u, username_idx: u, pass: newAdminPass.trim(),
            name: newAdminUser.trim(), role: 'admin', storeId: targetStoreForAdmin, createdAt: serverTimestamp()
        });
        alert(`✅ Đã tạo Admin: ${u}`); newAdminUser=''; newAdminPass=''; targetStoreForAdmin='';
    } catch(e) { alert(e.message); }
  }

  // --- LOGIC ADMIN KHO ---
  
  // 1. UPLOAD EXCEL (Đã fix cột "Mã kho")
  async function handleExcelUpload(event) {
    const file = event.target.files[0]; 
    if (!file) return;
    
    // Reset value để chọn lại cùng file vẫn chạy
    event.target.value = null; 
    isUploading = true;

    try {
      const data = await file.arrayBuffer();
      const rawData = utils.sheet_to_json(read(data).Sheets[read(data).SheetNames[0]]);
      const batch = writeBatch(db);
      let count = 0;
      
      rawData.forEach(row => {
        // Chuẩn hóa key: bỏ khoảng trắng, chữ thường
        const nRow = {}; 
        Object.keys(row).forEach(k => nRow[k.toLowerCase().trim()] = row[k]);
        
        const uName = safeString(nRow.username || nRow.user);
        if (uName) {
            // Logic tìm mã kho: Ưu tiên cột 'mã kho' -> 'makho' -> Lấy kho hiện tại
            let targetStore = safeString(nRow['mã kho'] || nRow.makho || nRow.storeid);
            if (!targetStore) targetStore = myStoreId;

            // Logic Role
            const role = safeString(nRow.role).toLowerCase() === 'admin' ? 'admin' : 'staff';
            
            batch.set(doc(db, 'users', uName.toLowerCase()), {
                username: uName, username_idx: uName.toLowerCase(), 
                pass: safeString(nRow.pass || nRow.password),
                name: nRow.name ? safeString(nRow.name) : uName,
                role: role, 
                storeId: targetStore 
            }, { merge: true });
            count++;
        }
      });
      await batch.commit(); alert(`✅ Đã cập nhật ${count} tài khoản!`);
    } catch (err) { alert("Lỗi: " + err.message); } 
    finally { isUploading = false; }
  }

  // 2. CHECKLIST (Fix hiện ngay lập tức)
  async function addTemplateTask() {
    if (!newTaskTitle.trim()) return;

    // A. Thêm vào Mẫu (Template) cho ngày mai
    taskTemplate.update(curr => {
        const up = { ...curr }; if (!up[activeType]) up[activeType] = [];
        up[activeType].push({ title: newTaskTitle, time: newTime });
        up[activeType].sort((a, b) => (a.time||"00:00").localeCompare(b.time||"00:00"));
        setDoc(doc(db, 'settings', `template_${myStoreId}`), up); return up;
    });

    // B. Thêm NGAY vào hôm nay (Fix: Thêm storeId để hiện ngay)
    try { 
        await addDoc(collection(db, 'tasks'), { 
            type: activeType, 
            title: newTaskTitle, 
            timeSlot: newTime, 
            completed: false, 
            createdBy: 'Admin', 
            date: getTodayStr(), 
            storeId: myStoreId, // QUAN TRỌNG: Phải có storeId mới hiện
            timestamp: serverTimestamp() 
        }); 
    } catch(e) { console.error(e); }
    
    newTaskTitle = '';
  }
  
  // 3. XÓA MẪU (Logic: Xóa mẫu, nhưng không xóa task hôm nay -> Đúng ý cảnh báo)
  function removeTemplateTask(i) {
    if(!confirm('CẢNH BÁO: Việc này chỉ xóa trong mẫu (cho ngày mai).\nCông việc hôm nay vẫn giữ nguyên.\n\nBạn chắc chắn xóa?')) return;
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
              {isSuperAdmin ? 'SUPER ADMIN' : `Quản Lý Kho: ${myStoreId}`}
          </h3>
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
                    <button class="w-full py-2 bg-green-600 text-white rounded font-bold" on:click={createStore}>Tạo Kho</button>
                    <div class="mt-2 border-t pt-2 max-h-32 overflow-y-auto">
                        {#each $storeList as s}<div class="text-sm p-1 border-b">{s.name} ({s.id})</div>{/each}
                    </div>
                </div>
            {:else}
                <div class="space-y-3">
                    <input type="text" bind:value={newAdminUser} class="w-full p-2 border rounded" placeholder="User Admin">
                    <input type="text" bind:value={newAdminPass} class="w-full p-2 border rounded" placeholder="Pass">
                    <select bind:value={targetStoreForAdmin} class="w-full p-2 border rounded"><option value="">-- Chọn Kho --</option>{#each $storeList as s}<option value={s.id}>{s.name}</option>{/each}</select>
                    <button class="w-full py-2 bg-purple-600 text-white rounded font-bold" on:click={createAdminAccount}>Cấp Quyền</button>
                </div>
            {/if}
        {:else}
            <div class="mb-6 border-b pb-4">
                <h4 class="text-sm font-bold text-slate-700 uppercase mb-2">1. Cấp quyền nhân sự</h4>
                
                <label for="excel-input-file" class="flex items-center justify-center gap-2 w-full p-4 bg-blue-50 border border-dashed border-blue-300 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors text-blue-700 font-bold relative">
                    <span class="material-icons-round">upload_file</span> 
                    {isUploading ? 'Đang xử lý...' : 'Bấm để chọn file Excel'}
                    <input id="excel-input-file" type="file" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".xlsx, .xls" on:change={handleExcelUpload} disabled={isUploading} />
                </label>
                
                <p class="text-xs text-gray-500 mt-2">Cột Excel: <code>username</code>, <code>pass</code>, <code>mã kho</code>, <code>role</code></p>
            </div>

            <div>
                <h4 class="text-sm font-bold text-slate-700 uppercase mb-2">2. Cấu hình việc mẫu</h4>
                <div class="flex gap-2 mb-2">
                    <select bind:value={activeType} class="w-full p-2 border rounded"><option value="warehouse">Kho</option><option value="cashier">Thu Ngân</option></select>
                </div>
                <div class="flex gap-2 mb-3">
                    <input type="text" bind:value={newTime} class="w-20 text-center p-2 border rounded" placeholder="08:00">
                    <input type="text" bind:value={newTaskTitle} class="flex-1 p-2 border rounded" placeholder="Tên việc..." on:keydown={(e)=>e.key==='Enter'&&addTemplateTask()}>
                    <button class="w-10 bg-orange-500 text-white rounded flex items-center justify-center" on:click={addTemplateTask}>+</button>
                </div>
                <ul class="border rounded-lg divide-y max-h-48 overflow-y-auto bg-slate-50">
                    {#if $taskTemplate[activeType]}
                        {#each $taskTemplate[activeType] as item, i}
                        <li class="flex justify-between p-2 text-sm items-center hover:bg-white">
                            <span><b class="bg-gray-200 px-1 rounded text-xs mr-1">{item.time}</b> {item.title}</span> 
                            <button class="text-red-400 p-1" on:click={()=>removeTemplateTask(i)}>x</button>
                        </li>
                        {/each}
                    {/if}
                </ul>
            </div>
        {/if}
    </div>

    <div class="p-4 border-t bg-slate-50">
      <button class="w-full py-3 rounded-xl font-bold text-slate-700 bg-slate-200 hover:bg-slate-300" on:click={() => dispatch('close')}>Đóng</button>
    </div>
  </div>
</div>
<style>.animate-popIn { animation: popIn 0.2s ease-out; } @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }</style>