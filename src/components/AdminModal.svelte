<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { read, utils } from 'xlsx';
  import { db } from '../lib/firebase';
  import { collection, doc, setDoc, writeBatch, addDoc, serverTimestamp, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';
  import { taskTemplate, currentUser, storeList } from '../lib/stores';
  import { safeString, getTodayStr } from '../lib/utils';

  const dispatch = createEventDispatcher();
  
  // Reactive check role
  $: isSuperAdmin = $currentUser?.role === 'super_admin';
  $: myStoreId = $currentUser?.storeId; // Dùng cho Admin thường
  $: myStores = $currentUser?.storeIds || []; // Dùng cho Admin thường quản lý nhiều kho

  // STATE: Tabs
  let saTab = 'store'; // 'store' | 'account' | 'user_manage'

  // STATE: Create Store
  let newStoreId = '';
  let newStoreName = '';

  // STATE: Create Account
  let newAdminUser = '';
  let newAdminPass = '';
  let selectedStoresForAdmin = []; 

  // STATE: User Management
  let allUsers = [];
  let isEditingUser = false;
  let editingUser = null;
  let editSelectedStores = [];

  // STATE: Admin Kho
  let activeType = 'warehouse';
  let newTime = '08:00';
  let newTaskTitle = '';
  let isUploading = false;

  // --- INIT: LOAD USERS IF SUPER ADMIN ---
  onMount(() => {
    let unsubUsers = () => {};
    if ($currentUser?.role === 'super_admin') {
        unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
            const users = [];
            snap.forEach(d => users.push({ id: d.id, ...d.data() }));
            // Sắp xếp: Admin lên đầu, Staff xuống dưới
            allUsers = users.sort((a, b) => {
                if (a.role === 'admin' && b.role !== 'admin') return -1;
                if (a.role !== 'admin' && b.role === 'admin') return 1;
                return a.username.localeCompare(b.username);
            });
        });
    }
    return () => unsubUsers();
  });

  // --- LOGIC SUPER ADMIN: 1. STORE ---
  async function createStore() {
    if(!newStoreId || !newStoreName) return alert("Vui lòng nhập đủ Mã kho và Tên kho!");
    try {
        const cleanId = newStoreId.trim().toUpperCase();
        await setDoc(doc(db, 'stores', cleanId), { 
            name: newStoreName.trim(), 
            createdAt: serverTimestamp() 
        });
        alert(`✅ Đã tạo kho: ${newStoreName} (${cleanId})`);
        newStoreId = ''; 
        newStoreName = '';
    } catch(e) { 
        alert("Lỗi: " + e.message); 
    }
  }

  // --- LOGIC SUPER ADMIN: 2. CREATE ADMIN ---
  async function createAdminAccount() {
    if(!newAdminUser || !newAdminPass || selectedStoresForAdmin.length === 0) {
        return alert("Nhập đủ Username, Pass và chọn ít nhất 1 kho!");
    }
    try {
        const u = newAdminUser.trim().toLowerCase();
        await setDoc(doc(db, 'users', u), {
            username: u, 
            username_idx: u, 
            pass: newAdminPass.trim(),
            name: newAdminUser.trim(), // Tên hiển thị giống username
            role: 'admin', 
            storeIds: selectedStoresForAdmin, // Lưu mảng các kho
            createdAt: serverTimestamp()
        });
        alert(`✅ Đã tạo Admin: ${u} quản lý: ${selectedStoresForAdmin.join(', ')}`);
        newAdminUser = ''; 
        newAdminPass = ''; 
        selectedStoresForAdmin = [];
    } catch(e) { 
        alert("Lỗi: " + e.message); 
    }
  }

  // --- LOGIC SUPER ADMIN: 3. MANAGE USERS ---
  async function deleteUser(uid) {
    if(!confirm(`CẢNH BÁO: Bạn có chắc muốn XÓA vĩnh viễn user "${uid}" không?`)) return;
    try {
        await deleteDoc(doc(db, 'users', uid));
    } catch(e) { 
        alert("Lỗi xóa: " + e.message); 
    }
  }

  function openEditUser(user) {
    editingUser = user;
    // Load danh sách kho hiện tại của user đó vào mảng checkbox
    editSelectedStores = user.storeIds ? [...user.storeIds] : (user.storeId ? [user.storeId] : []);
    isEditingUser = true;
  }

  async function saveEditUser() {
    if (!editingUser) return;
    try {
        await updateDoc(doc(db, 'users', editingUser.id), {
            storeIds: editSelectedStores
        });
        alert("✅ Đã cập nhật kho cho user!");
        isEditingUser = false;
        editingUser = null;
    } catch(e) { 
        alert("Lỗi cập nhật: " + e.message); 
    }
  }

  // --- LOGIC ADMIN KHO: 1. UPLOAD EXCEL ---
  async function handleExcelUpload(event) {
    const file = event.target.files[0]; 
    if (!file) return;
    
    // Reset để chọn lại file cũ vẫn trigger change
    event.target.value = null;
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
            // Xác định Role
            const role = safeString(nRow.role).toLowerCase() === 'admin' ? 'admin' : 'staff';
            
            // Xác định Store: Ưu tiên cột 'makho'/'mã kho', nếu không thì lấy hết kho của Admin hiện tại
            let targetStores = [];
            const excelStore = safeString(nRow.makho || nRow['mã kho'] || nRow.storeid);
            
            if (excelStore) {
                targetStores = [excelStore];
            } else {
                targetStores = myStores; // Default gán hết kho của admin quản lý
            }

            batch.set(doc(db, 'users', uName.toLowerCase()), {
                username: uName, 
                username_idx: uName.toLowerCase(), 
                pass: safeString(nRow.pass || nRow.password),
                name: nRow.name ? safeString(nRow.name) : uName,
                role: role, 
                storeIds: targetStores
            }, { merge: true });
            count++;
        }
      });
      await batch.commit(); 
      alert(`✅ Đã đồng bộ ${count} tài khoản!`);
    } catch (err) { 
        alert("Lỗi upload: " + err.message); 
    } finally { 
        isUploading = false; 
    }
  }

  // --- LOGIC ADMIN KHO: 2. CHECKLIST ---
  async function addTemplateTask() {
    if (!newTaskTitle.trim()) return;

    // Lặp qua tất cả kho mà admin quản lý để thêm việc mẫu
    const storesToUpdate = myStores.length > 0 ? myStores : [];
    
    storesToUpdate.forEach(sId => {
        // 1. Lưu Template (Mẫu)
        const currentTemp = $taskTemplate; // Lưu ý: Đây là template đang hiển thị (của kho đầu tiên)
        const updated = { ...currentTemp };
        if (!updated[activeType]) updated[activeType] = [];
        updated[activeType].push({ title: newTaskTitle, time: newTime });
        updated[activeType].sort((a, b) => (a.time||"00:00").localeCompare(b.time||"00:00"));
        
        setDoc(doc(db, 'settings', `template_${sId}`), updated);

        // 2. Thêm việc NGAY vào hôm nay
        addDoc(collection(db, 'tasks'), { 
            type: activeType, 
            title: newTaskTitle, 
            timeSlot: newTime, 
            completed: false, 
            createdBy: 'Admin', 
            date: getTodayStr(), 
            storeId: sId, 
            timestamp: serverTimestamp() 
        });
    });
    
    newTaskTitle = '';
    alert("✅ Đã thêm việc vào danh sách!");
  }
  
  function removeTemplateTask(index) {
    if(!confirm('CẢNH BÁO: Việc này chỉ xóa trong MẪU (cho ngày mai).\nCông việc hôm nay giữ nguyên.\nBạn chắc chắn xóa?')) return;
    
    // Logic đơn giản: Xóa mẫu ở giao diện hiện tại, và lưu lại cho kho chính
    // (Để đồng bộ hoàn hảo cần logic phức tạp hơn, nhưng tạm thời như vầy là đủ dùng)
    taskTemplate.update(curr => {
        const up = {...curr}; 
        up[activeType].splice(index, 1);
        
        // Lưu cho kho đầu tiên (Kho chính đang hiển thị)
        if (myStores.length > 0) {
            setDoc(doc(db, 'settings', `template_${myStores[0]}`), up);
        }
        return up;
    });
  }
</script>

<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
  <div class="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-popIn">
    
    <div class="p-4 border-b flex items-center gap-2 bg-slate-50">
      <span class="material-icons-round text-orange-500 text-3xl">settings</span>
      <div class="flex-1">
          <h3 class="text-lg font-bold text-slate-800">
              {isSuperAdmin ? 'SUPER ADMIN DASHBOARD' : `Quản Lý Kho: ${myStores.join(', ')}`}
          </h3>
          {#if isSuperAdmin}
            <p class="text-xs text-purple-600 font-bold">Quản trị viên cấp cao</p>
          {/if}
      </div>
    </div>
    
    <div class="p-4 overflow-y-auto flex-1 bg-slate-50">
        
        {#if isSuperAdmin}
            <div class="flex flex-wrap gap-2 mb-4 border-b border-gray-200 pb-2">
                <button class="px-4 py-2 rounded-lg text-sm font-bold transition-all {saTab==='store'?'bg-indigo-600 text-white shadow-lg':'bg-white text-gray-600 border'}" on:click={()=>saTab='store'}>
                    1. Quản lý Kho
                </button>
                <button class="px-4 py-2 rounded-lg text-sm font-bold transition-all {saTab==='account'?'bg-indigo-600 text-white shadow-lg':'bg-white text-gray-600 border'}" on:click={()=>saTab='account'}>
                    2. Cấp Admin Mới
                </button>
                <button class="px-4 py-2 rounded-lg text-sm font-bold transition-all {saTab==='user_manage'?'bg-indigo-600 text-white shadow-lg':'bg-white text-gray-600 border'}" on:click={()=>saTab='user_manage'}>
                    3. Danh Sách User ({allUsers.length})
                </button>
            </div>

            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 min-h-[300px]">
                
                {#if saTab === 'store'}
                    <h4 class="text-sm font-bold text-gray-500 uppercase mb-3">Thêm Kho Mới</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                        <input type="text" bind:value={newStoreId} class="p-2 border rounded uppercase font-mono" placeholder="Mã (VD: 908)">
                        <input type="text" bind:value={newStoreName} class="p-2 border rounded" placeholder="Tên hiển thị">
                        <button class="bg-green-600 text-white rounded font-bold hover:bg-green-700" on:click={createStore}>Thêm</button>
                    </div>
                    <div class="mt-4 border-t pt-2">
                        <h4 class="text-xs font-bold text-gray-500 uppercase mb-2">Kho hiện có:</h4>
                        <div class="max-h-60 overflow-y-auto border rounded bg-gray-50">
                            <table class="w-full text-sm text-left">
                                <thead class="bg-gray-100 text-gray-600 font-bold sticky top-0"><tr><th class="p-2">Mã</th><th class="p-2">Tên</th></tr></thead>
                                <tbody class="divide-y">
                                    {#each $storeList as s}
                                        <tr class="hover:bg-white"><td class="p-2 font-mono font-bold text-indigo-700">{s.id}</td><td class="p-2">{s.name}</td></tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    </div>

                {:else if saTab === 'account'}
                    <h4 class="text-sm font-bold text-gray-500 uppercase mb-3">Tạo Tài Khoản Admin</h4>
                    <div class="space-y-3 max-w-md mx-auto">
                        <input type="text" bind:value={newAdminUser} class="w-full p-2 border rounded" placeholder="Tên đăng nhập (VD: linh-3031)">
                        <input type="text" bind:value={newAdminPass} class="w-full p-2 border rounded" placeholder="Mật khẩu">
                        
                        <p class="text-xs font-bold text-gray-500">Chọn kho quản lý:</p>
                        <div class="max-h-48 overflow-y-auto border rounded p-2 bg-slate-50 grid grid-cols-2 gap-2">
                            {#each $storeList as s}
                                <label class="flex items-center gap-2 p-2 bg-white border rounded cursor-pointer hover:bg-indigo-50">
                                    <input type="checkbox" bind:group={selectedStoresForAdmin} value={s.id} class="accent-indigo-600 w-4 h-4">
                                    <span class="text-xs font-bold text-gray-700">{s.name}</span>
                                </label>
                            {/each}
                        </div>
                        <button class="w-full py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 shadow-md" on:click={createAdminAccount}>Tạo User Admin</button>
                    </div>

                {:else if saTab === 'user_manage'}
                    
                    {#if isEditingUser}
                        <div class="mb-4 bg-yellow-50 p-4 rounded border border-yellow-200">
                            <h4 class="font-bold text-yellow-800 mb-2">Đang chỉnh sửa quyền: <span class="text-black">{editingUser.username}</span></h4>
                            <p class="text-xs text-yellow-600 mb-2">Tick chọn các kho mà user này được phép truy cập:</p>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 max-h-40 overflow-y-auto p-1">
                                {#each $storeList as s}
                                    <label class="flex items-center gap-2 bg-white p-2 rounded border cursor-pointer hover:border-indigo-300">
                                        <input type="checkbox" bind:group={editSelectedStores} value={s.id} class="accent-indigo-600">
                                        <span class="text-xs font-bold">{s.name}</span>
                                    </label>
                                {/each}
                            </div>
                            <div class="flex gap-2">
                                <button class="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow-sm" on:click={saveEditUser}>Lưu Cập Nhật</button>
                                <button class="px-4 py-2 bg-gray-400 text-white rounded text-sm font-bold shadow-sm" on:click={()=>isEditingUser=false}>Hủy</button>
                            </div>
                        </div>
                    {/if}

                    <div class="overflow-x-auto border rounded bg-white shadow-sm max-h-[400px]">
                        <table class="w-full text-sm text-left relative">
                            <thead class="bg-gray-100 text-gray-600 uppercase text-xs font-bold sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th class="p-3">User</th>
                                    <th class="p-3">Role</th>
                                    <th class="p-3">Kho phụ trách</th>
                                    <th class="p-3 text-center">Hành động</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                {#each allUsers as user}
                                    <tr class="hover:bg-gray-50 transition-colors">
                                        <td class="p-3 font-bold text-indigo-700">{user.username}</td>
                                        <td class="p-3">
                                            <span class="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider {user.role==='admin'?'bg-purple-100 text-purple-700':'bg-gray-100 text-gray-600'}">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td class="p-3">
                                            {#if user.role === 'super_admin'}
                                                <span class="text-gray-400 italic text-xs">Full Access</span>
                                            {:else}
                                                <div class="flex flex-wrap gap-1">
                                                    {#if user.storeIds && user.storeIds.length > 0}
                                                        {#each user.storeIds as sid}
                                                            <span class="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border border-orange-200">{sid}</span>
                                                        {/each}
                                                    {:else}
                                                        <span class="text-red-400 italic text-xs">Chưa gán kho</span>
                                                    {/if}
                                                </div>
                                            {/if}
                                        </td>
                                        <td class="p-3 flex justify-center gap-2">
                                            {#if user.role !== 'super_admin'}
                                                <button class="p-1.5 text-blue-500 bg-blue-50 hover:bg-blue-100 rounded transition-colors" title="Sửa quyền kho" on:click={()=>openEditUser(user)}>
                                                    <span class="material-icons-round text-base">edit</span>
                                                </button>
                                                <button class="p-1.5 text-red-500 bg-red-50 hover:bg-red-100 rounded transition-colors" title="Xóa user" on:click={()=>deleteUser(user.id)}>
                                                    <span class="material-icons-round text-base">delete</span>
                                                </button>
                                            {/if}
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {/if}
            </div>

        {:else}
            <div class="mb-6 border-b pb-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <h4 class="text-sm font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                    <span class="material-icons-round text-blue-500">group_add</span>
                    1. Cấp quyền nhân sự
                </h4>
                
                <label for="excel-upload-btn" class="flex flex-col items-center justify-center gap-2 w-full p-6 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors text-blue-700 font-bold relative group">
                    <span class="material-icons-round text-4xl group-hover:scale-110 transition-transform">upload_file</span> 
                    <span>{isUploading ? 'Đang tải lên...' : 'Bấm để chọn file Excel danh sách'}</span>
                    <input id="excel-upload-btn" type="file" class="hidden" accept=".xlsx, .xls" on:change={handleExcelUpload} disabled={isUploading} />
                </label>
                
                <div class="mt-3 text-xs text-gray-500 bg-gray-50 p-2 rounded border">
                    <p><b>Yêu cầu file Excel:</b> Cần có các cột <code>username</code>, <code>pass</code>.</p>
                    <p>Tùy chọn: <code>name</code> (Tên hiển thị), <code>role</code> (nhập 'admin' để cấp quyền quản lý), <code>makho</code> (nếu muốn gán kho khác).</p>
                </div>
            </div>

            <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <h4 class="text-sm font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                    <span class="material-icons-round text-orange-500">playlist_add_check</span> 
                    2. Cấu hình việc mẫu
                </h4>
                <div class="flex gap-2 mb-2">
                    <select bind:value={activeType} class="w-full p-2 border rounded bg-gray-50 font-medium focus:ring-2 focus:ring-orange-200 outline-none">
                        <option value="warehouse">📦 Kho</option>
                        <option value="cashier">💰 Thu Ngân</option>
                    </select>
                </div>
                <div class="flex gap-2 mb-3">
                    <input type="text" bind:value={newTime} class="w-24 text-center p-2 border rounded font-mono" placeholder="08:00">
                    <input type="text" bind:value={newTaskTitle} class="flex-1 p-2 border rounded" placeholder="Nhập tên công việc mẫu..." on:keydown={(e)=>e.key==='Enter'&&addTemplateTask()}>
                    <button class="w-12 bg-orange-500 text-white rounded flex items-center justify-center shadow-md hover:bg-orange-600 active:scale-95 transition-all" on:click={addTemplateTask}>
                        <span class="material-icons-round">add</span>
                    </button>
                </div>
                
                <ul class="border rounded-lg divide-y max-h-56 overflow-y-auto bg-slate-50">
                    {#if $taskTemplate[activeType]}
                        {#each $taskTemplate[activeType] as item, i}
                        <li class="flex justify-between p-3 text-sm items-center hover:bg-white transition-colors group">
                            <span class="flex items-center gap-2">
                                <b class="bg-gray-200 px-1.5 py-0.5 rounded text-xs text-gray-700 font-mono">{item.time}</b> 
                                {item.title}
                            </span> 
                            <button class="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors" on:click={()=>removeTemplateTask(i)}>
                                <span class="material-icons-round text-base">delete</span>
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

<style>
    .animate-popIn { animation: popIn 0.2s ease-out; } 
    @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>