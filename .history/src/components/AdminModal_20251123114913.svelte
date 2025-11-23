<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { read, utils } from 'xlsx';
  import { db } from '../lib/firebase';
  import { collection, doc, setDoc, writeBatch, addDoc, serverTimestamp, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';
  import { taskTemplate, currentUser, storeList } from '../lib/stores';
  import { safeString, getTodayStr } from '../lib/utils';

  const dispatch = createEventDispatcher();
  $: isSuperAdmin = $currentUser?.role === 'super_admin';
  $: myStoreId = $currentUser?.storeId;

  // TABS
  let saTab = 'store'; // 'store' | 'account' | 'user_manage' (Mới)

  // STATE CREATE
  let newStoreId = '', newStoreName = '';
  let newAdminUser = '', newAdminPass = '';
  let selectedStoresForAdmin = []; 

  // STATE USER MANAGEMENT (MỚI)
  let allUsers = [];
  let isEditingUser = false;
  let editingUser = null; // User đang được sửa
  let editSelectedStores = []; // List kho đang tick khi sửa

  // STATE ADMIN KHO
  let activeType = 'warehouse';
  let newTime = '08:00', newTaskTitle = '', isUploading = false;

  // --- INIT: LOAD USER LIST NẾU LÀ SUPER ADMIN ---
  onMount(() => {
    if (isSuperAdmin) {
        // Lắng nghe realtime danh sách user
        const unsub = onSnapshot(collection(db, 'users'), (snap) => {
            const users = [];
            snap.forEach(d => users.push({ id: d.id, ...d.data() }));
            // Sắp xếp: Admin lên đầu
            allUsers = users.sort((a, b) => (a.role === 'admin' ? -1 : 1));
        });
        return () => unsub();
    }
  });

  // --- LOGIC SUPER ADMIN ---
  async function createStore() { /* ... Giữ nguyên ... */
    if(!newStoreId || !newStoreName) return alert("Thiếu thông tin!");
    try {
        await setDoc(doc(db, 'stores', newStoreId.trim().toUpperCase()), { name: newStoreName.trim(), createdAt: serverTimestamp() });
        alert(`✅ Đã tạo kho: ${newStoreName}`); newStoreId=''; newStoreName='';
    } catch(e) { alert(e.message); }
  }

  async function createAdminAccount() { /* ... Giữ nguyên ... */
    if(!newAdminUser || !newAdminPass || selectedStoresForAdmin.length === 0) return alert("Thiếu thông tin!");
    try {
        const u = newAdminUser.trim().toLowerCase();
        await setDoc(doc(db, 'users', u), {
            username: u, username_idx: u, pass: newAdminPass.trim(), name: newAdminUser.trim(),
            role: 'admin', storeIds: selectedStoresForAdmin, createdAt: serverTimestamp()
        });
        alert(`✅ Đã tạo Admin: ${u}`); newAdminUser=''; newAdminPass=''; selectedStoresForAdmin=[];
    } catch(e) { alert(e.message); }
  }

  // --- LOGIC QUẢN LÝ USER (MỚI) ---
  async function deleteUser(uid) {
    if(!confirm(`XÓA user "${uid}"? Hành động này không thể hoàn tác!`)) return;
    try {
        await deleteDoc(doc(db, 'users', uid));
    } catch(e) { alert("Lỗi: " + e.message); }
  }

  function openEditUser(user) {
    editingUser = user;
    // Load các kho hiện tại của user đó vào mảng checkbox
    editSelectedStores = user.storeIds || (user.storeId ? [user.storeId] : []);
    isEditingUser = true;
  }

  async function saveEditUser() {
    if (!editingUser) return;
    try {
        await updateDoc(doc(db, 'users', editingUser.id), {
            storeIds: editSelectedStores
        });
        isEditingUser = false;
        editingUser = null;
    } catch(e) { alert("Lỗi cập nhật: " + e.message); }
  }

  // --- LOGIC ADMIN KHO ---
  async function handleExcelUpload(event) { /* ... Giữ nguyên ... */ 
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
            const role = safeString(nRow.role).toLowerCase() === 'admin' ? 'admin' : 'staff';
            let targetStores = [];
            if(nRow.makho) targetStores = [safeString(nRow.makho)];
            else targetStores = $currentUser?.storeIds || []; 

            batch.set(doc(db, 'users', uName.toLowerCase()), {
                username: uName, username_idx: uName.toLowerCase(), pass: safeString(nRow.pass || nRow.password),
                name: nRow.name ? safeString(nRow.name) : uName, role: role, storeIds: targetStores
            }, { merge: true });
            count++;
        }
      });
      await batch.commit(); alert(`✅ Xong! ${count} User.`);
    } catch (err) { alert("Lỗi: " + err.message); } finally { isUploading = false; }
  }

  async function addTemplateTask() { /* ... Giữ nguyên ... */
    if (!newTaskTitle.trim()) return;
    ($currentUser?.storeIds || []).forEach(sId => {
        const up = { ...$taskTemplate }; if (!up[activeType]) up[activeType] = [];
        up[activeType].push({ title: newTaskTitle, time: newTime });
        up[activeType].sort((a, b) => (a.time||"00:00").localeCompare(b.time||"00:00"));
        setDoc(doc(db, 'settings', `template_${sId}`), up); 
        addDoc(collection(db, 'tasks'), { 
            type: activeType, title: newTaskTitle, timeSlot: newTime, completed: false, createdBy: 'Admin', date: getTodayStr(), storeId: sId, timestamp: serverTimestamp() 
        });
    });
    newTaskTitle = '';
  }
  
  function removeTemplateTask(i) { /* ... Giữ nguyên ... */
    if(!confirm('Xóa mẫu?')) return;
    taskTemplate.update(curr => {
        const up = {...curr}; up[activeType].splice(i, 1);
        ($currentUser?.storeIds || []).forEach(sId => setDoc(doc(db, 'settings', `template_${sId}`), up)); 
        return up;
    });
  }
</script>

<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
  <div class="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-popIn">
    
    <div class="p-4 border-b flex items-center gap-2 bg-slate-50">
      <span class="material-icons-round text-orange-500 text-3xl">settings</span>
      <div class="flex-1">
          <h3 class="text-lg font-bold text-slate-800">{isSuperAdmin ? 'SUPER ADMIN DASHBOARD' : `QUẢN LÝ KHO: ${($currentUser?.storeIds||[]).join(', ')}`}</h3>
      </div>
    </div>
    
    <div class="p-4 overflow-y-auto flex-1 bg-slate-50">
        {#if isSuperAdmin}
            <div class="flex flex-wrap gap-2 mb-4 border-b border-gray-200 pb-2">
                <button class="px-4 py-2 rounded-lg text-sm font-bold transition-all {saTab==='store'?'bg-indigo-600 text-white shadow-lg':'bg-white text-gray-600 border'}" on:click={()=>saTab='store'}>
                    1. Tạo Kho
                </button>
                <button class="px-4 py-2 rounded-lg text-sm font-bold transition-all {saTab==='account'?'bg-indigo-600 text-white shadow-lg':'bg-white text-gray-600 border'}" on:click={()=>saTab='account'}>
                    2. Cấp Admin Mới
                </button>
                <button class="px-4 py-2 rounded-lg text-sm font-bold transition-all {saTab==='user_manage'?'bg-indigo-600 text-white shadow-lg':'bg-white text-gray-600 border'}" on:click={()=>saTab='user_manage'}>
                    3. Danh Sách User ({allUsers.length})
                </button>
            </div>

            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                {#if saTab === 'store'}
                    <h4 class="text-sm font-bold text-gray-500 uppercase mb-3">Thêm Kho Mới</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                        <input type="text" bind:value={newStoreId} class="p-2 border rounded uppercase font-mono" placeholder="Mã (VD: 908)">
                        <input type="text" bind:value={newStoreName} class="p-2 border rounded" placeholder="Tên hiển thị">
                        <button class="bg-green-600 text-white rounded font-bold hover:bg-green-700" on:click={createStore}>Thêm</button>
                    </div>
                    <div class="max-h-60 overflow-y-auto border rounded">
                         <table class="w-full text-sm text-left">
                            <thead class="bg-gray-100 text-gray-600 font-bold"><tr><th class="p-2">Mã</th><th class="p-2">Tên</th></tr></thead>
                            <tbody class="divide-y">{#each $storeList as s}<tr><td class="p-2 font-mono">{s.id}</td><td class="p-2">{s.name}</td></tr>{/each}</tbody>
                         </table>
                    </div>

                {:else if saTab === 'account'}
                    <h4 class="text-sm font-bold text-gray-500 uppercase mb-3">Tạo Tài Khoản Mới</h4>
                    <div class="space-y-3 max-w-md mx-auto">
                        <input type="text" bind:value={newAdminUser} class="w-full p-2 border rounded" placeholder="Tên đăng nhập">
                        <input type="text" bind:value={newAdminPass} class="w-full p-2 border rounded" placeholder="Mật khẩu">
                        <p class="text-xs font-bold text-gray-500">Phân quyền kho:</p>
                        <div class="max-h-40 overflow-y-auto border rounded p-2 bg-slate-50 grid grid-cols-2 gap-2">
                            {#each $storeList as s}
                                <label class="flex items-center gap-2 p-1 hover:bg-white cursor-pointer rounded">
                                    <input type="checkbox" bind:group={selectedStoresForAdmin} value={s.id} class="accent-indigo-600">
                                    <span class="text-xs font-medium">{s.name}</span>
                                </label>
                            {/each}
                        </div>
                        <button class="w-full py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700" on:click={createAdminAccount}>Tạo User</button>
                    </div>

                {:else if saTab === 'user_manage'}
                    {#if isEditingUser}
                        <div class="mb-4 bg-yellow-50 p-3 rounded border border-yellow-200">
                            <h4 class="font-bold text-yellow-800 mb-2">Đang sửa: {editingUser.username}</h4>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                                {#each $storeList as s}
                                    <label class="flex items-center gap-1 bg-white p-2 rounded border cursor-pointer">
                                        <input type="checkbox" bind:group={editSelectedStores} value={s.id} class="accent-indigo-600">
                                        <span class="text-xs">{s.name}</span>
                                    </label>
                                {/each}
                            </div>
                            <div class="flex gap-2">
                                <button class="px-4 py-1 bg-blue-600 text-white rounded text-sm font-bold" on:click={saveEditUser}>Lưu thay đổi</button>
                                <button class="px-4 py-1 bg-gray-400 text-white rounded text-sm font-bold" on:click={()=>isEditingUser=false}>Hủy</button>
                            </div>
                        </div>
                    {/if}

                    <div class="overflow-x-auto border rounded bg-white shadow-sm">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-gray-100 text-gray-600 uppercase text-xs">
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
                                        <td class="p-3 font-medium text-indigo-700">{user.username}</td>
                                        <td class="p-3">
                                            <span class="px-2 py-0.5 rounded text-xs font-bold {user.role==='admin'?'bg-purple-100 text-purple-700':'bg-gray-100 text-gray-600'}">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td class="p-3">
                                            {#if user.role === 'super_admin'}
                                                <span class="text-gray-400 italic">Toàn quyền</span>
                                            {:else}
                                                <div class="flex flex-wrap gap-1">
                                                    {#each (user.storeIds || []) as sid}
                                                        <span class="bg-orange-100 text-orange-700 px-1.5 rounded text-xs font-mono">{sid}</span>
                                                    {/each}
                                                </div>
                                            {/if}
                                        </td>
                                        <td class="p-3 flex justify-center gap-2">
                                            {#if user.role !== 'super_admin'}
                                                <button class="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Sửa kho" on:click={()=>openEditUser(user)}>
                                                    <span class="material-icons-round text-base">edit</span>
                                                </button>
                                                <button class="p-1 text-red-500 hover:bg-red-50 rounded" title="Xóa user" on:click={()=>deleteUser(user.id)}>
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
            <div class="space-y-6">
                <div class="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                     <h4 class="text-sm font-bold text-slate-700 uppercase mb-2">1. Cấp quyền nhân sự</h4>
                     <label class="flex items-center justify-center gap-2 w-full p-4 bg-blue-50 border border-dashed border-blue-300 rounded-xl cursor-pointer hover:bg-blue-100 text-blue-700 font-bold">
                        <span class="material-icons-round">upload_file</span> {isUploading ? '...' : 'Upload Excel'}
                        <input type="file" hidden accept=".xlsx, .xls" on:change={handleExcelUpload} disabled={isUploading} />
                    </label>
                </div>
                </div>
        {/if}
    </div>

    <div class="p-4 border-t bg-slate-50">
      <button class="w-full py-3 rounded-xl font-bold text-slate-700 bg-slate-200 hover:bg-slate-300" on:click={() => dispatch('close')}>Đóng</button>
    </div>
  </div>
</div>
<style>.animate-popIn { animation: popIn 0.2s ease-out; } @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }</style>