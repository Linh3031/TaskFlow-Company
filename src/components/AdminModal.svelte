<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { read, utils } from 'xlsx';
  import { db } from '../lib/firebase';
  import { 
    collection, 
    doc, 
    setDoc, 
    writeBatch, 
    addDoc, 
    serverTimestamp, 
    onSnapshot, 
    deleteDoc, 
    updateDoc 
  } from 'firebase/firestore';
  import { taskTemplate, currentUser, storeList } from '../lib/stores';
  import { safeString, getTodayStr } from '../lib/utils';

  const dispatch = createEventDispatcher();
  
  // --- REACTIVE VARIABLES (Tự động cập nhật khi user đổi) ---
  $: isSuperAdmin = $currentUser?.role === 'super_admin';
  $: myStoreId = $currentUser?.storeId;
  $: myStores = $currentUser?.storeIds || [];

  // --- STATE: SUPER ADMIN ---
  let saTab = 'store'; // Các tab: 'store' | 'account' | 'user_manage'
  
  // Tab 1: Tạo Kho
  let newStoreId = '';
  let newStoreName = '';

  // Tab 2: Tạo Admin
  let newAdminUser = '';
  let newAdminPass = '';
  let selectedStoresForAdmin = []; 

  // Tab 3: Quản lý User
  let allUsers = [];
  let isEditingUser = false;
  let editingUser = null;
  let editSelectedStores = []; // Danh sách kho khi đang sửa user

  // --- STATE: ADMIN KHO ---
  let activeType = 'warehouse';
  let newTime = '08:00';
  let newTaskTitle = '';
  let isImportant = false; // Checkbox Quan trọng
  let isUploading = false;
  
  // State Edit Mode (Sửa checklist)
  let editingIndex = -1; // -1: Thêm mới, >=0: Đang sửa index đó

  // --- INIT: LOAD USER LIST (CHỈ SUPER ADMIN) ---
  onMount(() => {
    let unsubUsers = () => {};
    if ($currentUser?.role === 'super_admin') {
        // Lắng nghe realtime toàn bộ user
        unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
            const users = [];
            snap.forEach(d => {
                users.push({ id: d.id, ...d.data() });
            });
            
            // Sắp xếp: Admin lên đầu, Staff xuống dưới, cùng role thì xếp theo tên
            allUsers = users.sort((a, b) => {
                if (a.role === 'admin' && b.role !== 'admin') return -1;
                if (a.role !== 'admin' && b.role === 'admin') return 1;
                return a.username.localeCompare(b.username);
            });
        });
    }
    // Cleanup khi đóng modal
    return () => unsubUsers();
  });

  // ============================================================
  // LOGIC SUPER ADMIN
  // ============================================================

  // 1. TẠO KHO MỚI
  async function createStore() {
    if (!newStoreId || !newStoreName) {
        return alert("Vui lòng nhập đủ Mã kho và Tên kho!");
    }
    try {
        const cleanId = newStoreId.trim().toUpperCase();
        await setDoc(doc(db, 'stores', cleanId), { 
            name: newStoreName.trim(), 
            createdAt: serverTimestamp() 
        });
        alert(`✅ Đã tạo kho thành công: ${newStoreName} (${cleanId})`);
        newStoreId = ''; 
        newStoreName = '';
    } catch (e) { 
        alert("Lỗi khi tạo kho: " + e.message); 
    }
  }

  // 2. TẠO TÀI KHOẢN ADMIN
  async function createAdminAccount() {
    if (!newAdminUser || !newAdminPass || selectedStoresForAdmin.length === 0) {
        return alert("Vui lòng nhập đủ Username, Password và chọn ít nhất 1 kho!");
    }
    try {
        const u = newAdminUser.trim().toLowerCase();
        await setDoc(doc(db, 'users', u), {
            username: u, 
            username_idx: u, 
            pass: newAdminPass.trim(),
            name: newAdminUser.trim(), 
            role: 'admin', 
            storeIds: selectedStoresForAdmin, 
            createdAt: serverTimestamp()
        });
        alert(`✅ Đã tạo Admin: ${u} quản lý các kho: ${selectedStoresForAdmin.join(', ')}`);
        newAdminUser = ''; 
        newAdminPass = ''; 
        selectedStoresForAdmin = [];
    } catch (e) { 
        alert("Lỗi tạo tài khoản: " + e.message); 
    }
  }

  // 3. QUẢN LÝ USER (XÓA/SỬA)
  async function deleteUser(uid) {
    if (!confirm(`CẢNH BÁO: Bạn có chắc muốn XÓA vĩnh viễn user "${uid}" không?`)) return;
    try {
        await deleteDoc(doc(db, 'users', uid));
    } catch (e) { 
        alert("Lỗi khi xóa: " + e.message); 
    }
  }

  function openEditUser(user) {
    editingUser = user;
    // Load danh sách kho hiện tại của user đó vào mảng checkbox để sửa
    // Hỗ trợ cả cấu trúc cũ (storeId string) và mới (storeIds array)
    editSelectedStores = user.storeIds ? [...user.storeIds] : (user.storeId ? [user.storeId] : []);
    isEditingUser = true;
  }

  async function saveEditUser() {
    if (!editingUser) return;
    try {
        await updateDoc(doc(db, 'users', editingUser.id), {
            storeIds: editSelectedStores
        });
        alert("✅ Đã cập nhật quyền kho cho user thành công!");
        isEditingUser = false;
        editingUser = null;
    } catch (e) { 
        alert("Lỗi cập nhật: " + e.message); 
    }
  }

  // ============================================================
  // LOGIC ADMIN KHO
  // ============================================================

  // 1. UPLOAD EXCEL
  async function handleExcelUpload(event) {
    const file = event.target.files[0]; 
    if (!file) return;
    
    // Reset giá trị input để có thể chọn lại file cũ nếu cần
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
            // Xác định Role: Nếu excel ghi 'admin' thì cấp quyền admin, ngược lại là staff
            const role = safeString(nRow.role).toLowerCase() === 'admin' ? 'admin' : 'staff';
            
            // Xác định Store: Ưu tiên cột trong excel, nếu không có thì lấy kho của người upload
            let targetStores = [];
            const excelStore = safeString(nRow.makho || nRow['mã kho'] || nRow.storeid);
            
            if (excelStore) {
                targetStores = [excelStore];
            } else {
                targetStores = myStores; // Gán tất cả kho của admin hiện tại
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
      alert(`✅ Đã đồng bộ thành công ${count} tài khoản!`);
    } catch (err) { 
        alert("Lỗi upload file: " + err.message); 
    } finally { 
        isUploading = false; 
    }
  }

  // 2. QUẢN LÝ CHECKLIST (THÊM/SỬA/XÓA)
  
  // Hàm đưa dữ liệu lên form để sửa
  function startEdit(index, item) {
      editingIndex = index;
      newTime = item.time;
      newTaskTitle = item.title;
      isImportant = item.isImportant || false;
  }

  // Hàm hủy bỏ chế độ sửa
  function cancelEdit() {
      editingIndex = -1;
      newTaskTitle = '';
      isImportant = false;
      newTime = '08:00';
  }

  // Hàm Lưu (Dùng chung cho cả Thêm Mới và Cập Nhật)
  async function saveTemplateTask() {
    if (!newTaskTitle.trim()) return;

    // Lấy danh sách các kho cần cập nhật (kho mà admin đang quản lý)
    const storesToUpdate = myStores.length > 0 ? myStores : [];
    
    storesToUpdate.forEach(sId => {
        // A. Cập nhật vào Template (Mẫu cho ngày mai)
        taskTemplate.update(curr => {
            const up = { ...$taskTemplate }; // Tạo bản sao để đảm bảo reactivity
            if (!up[activeType]) up[activeType] = [];
            
            const newItem = { 
                title: newTaskTitle, 
                time: newTime,
                isImportant: isImportant 
            };

            if (editingIndex >= 0) {
                // Nếu đang ở chế độ Sửa: Ghi đè vào vị trí cũ
                up[activeType][editingIndex] = newItem;
            } else {
                // Nếu đang ở chế độ Thêm mới: Thêm vào cuối danh sách
                up[activeType].push(newItem);
            }
            
            // Sắp xếp lại danh sách theo giờ để hiển thị đẹp
            up[activeType].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
            
            // Lưu lên Firestore
            setDoc(doc(db, 'settings', `template_${sId}`), up);
            return up;
        });

        // B. Nếu là THÊM MỚI -> Tạo ngay task cho hôm nay để thấy liền
        if (editingIndex === -1) {
            addDoc(collection(db, 'tasks'), { 
                type: activeType, 
                title: newTaskTitle, 
                timeSlot: newTime, 
                completed: false, 
                createdBy: 'Admin', 
                date: getTodayStr(), 
                storeId: sId, 
                isImportant: isImportant, 
                timestamp: serverTimestamp() 
            });
        }
    });
    
    // Thông báo
    if (editingIndex !== -1) {
        alert("✅ Đã cập nhật mẫu công việc (Sẽ áp dụng cho ngày mai)!");
    }

    cancelEdit(); // Reset form
  }
  
  // Hàm xóa mẫu công việc
  function removeTemplateTask(index) {
    if (!confirm('CẢNH BÁO: Hành động này chỉ xóa trong MẪU (cho ngày mai trở đi).\nCông việc của ngày hôm nay vẫn giữ nguyên.\n\nBạn có chắc chắn muốn xóa?')) return;
    
    taskTemplate.update(curr => {
        const up = { ...curr }; 
        up[activeType].splice(index, 1); // Xóa phần tử tại index
        
        // Cập nhật lại cho tất cả các kho
        myStores.forEach(sId => {
            setDoc(doc(db, 'settings', `template_${sId}`), up);
        });
        return up;
    });

    // Nếu đang sửa đúng cái việc vừa xóa thì hủy chế độ sửa
    if (editingIndex === index) cancelEdit();
  }
</script>

<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
  <div class="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-popIn">
    
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
                <button 
                    class="px-4 py-2 rounded-lg text-sm font-bold transition-all {saTab==='store'?'bg-indigo-600 text-white shadow-lg':'bg-white text-gray-600 border'}" 
                    on:click={()=>saTab='store'}
                >
                    1. Quản lý Kho
                </button>
                <button 
                    class="px-4 py-2 rounded-lg text-sm font-bold transition-all {saTab==='account'?'bg-indigo-600 text-white shadow-lg':'bg-white text-gray-600 border'}" 
                    on:click={()=>saTab='account'}
                >
                    2. Cấp Admin Mới
                </button>
                <button 
                    class="px-4 py-2 rounded-lg text-sm font-bold transition-all {saTab==='user_manage'?'bg-indigo-600 text-white shadow-lg':'bg-white text-gray-600 border'}" 
                    on:click={()=>saTab='user_manage'}
                >
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
                                <thead class="bg-gray-100 text-gray-600 font-bold sticky top-0">
                                    <tr>
                                        <th class="p-2">Mã</th>
                                        <th class="p-2">Tên</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y">
                                    {#each $storeList as s}
                                        <tr class="hover:bg-white">
                                            <td class="p-2 font-mono font-bold text-indigo-700">{s.id}</td>
                                            <td class="p-2">{s.name}</td>
                                        </tr>
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
                        <div class="mb-4 bg-yellow-50 p-4 rounded border border-yellow-200 animate-popIn">
                            <h4 class="font-bold text-yellow-800 mb-2">Đang chỉnh sửa quyền: <span class="text-black">{editingUser.username}</span></h4>
                            <p class="text-xs text-yellow-600 mb-2">Tick chọn các kho mà user này được phép truy cập:</p>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 max-h-40 overflow-y-auto p-1 border rounded bg-white">
                                {#each $storeList as s}
                                    <label class="flex items-center gap-2 bg-white p-2 rounded cursor-pointer hover:bg-gray-50">
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

                    <div class="overflow-x-auto border rounded bg-white shadow-sm max-h-[500px]">
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
                
                <div class="flex gap-2 mb-3">
                    <select bind:value={activeType} class="w-full p-2 border rounded bg-gray-50 font-medium focus:ring-2 focus:ring-orange-200 outline-none" on:change={cancelEdit}>
                        <option value="warehouse">📦 Kho</option>
                        <option value="cashier">💰 Thu Ngân</option>
                    </select>
                </div>

                <div class="flex flex-col gap-2 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div class="flex gap-2">
                        <input type="text" bind:value={newTime} class="w-24 text-center p-2 border rounded font-mono" placeholder="08:00">
                        <input type="text" bind:value={newTaskTitle} class="flex-1 p-2 border rounded" placeholder="Tên công việc..." on:keydown={(e)=>e.key==='Enter'&&saveTemplateTask()}>
                    </div>
                    
                    <div class="flex justify-between items-center">
                        <label class="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-1.5 rounded border hover:bg-red-50 transition-colors">
                            <input type="checkbox" bind:checked={isImportant} class="w-4 h-4 accent-red-500 cursor-pointer">
                            <span class="text-sm font-bold {isImportant ? 'text-red-600' : 'text-gray-500'}">
                                Công việc quan trọng {isImportant ? '⭐' : ''}
                            </span>
                        </label>
                        
                        <div class="flex gap-2">
                            {#if editingIndex >= 0}
                                <button class="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm font-bold hover:bg-gray-400" on:click={cancelEdit}>Hủy</button>
                            {/if}
                            <button 
                                class="px-4 py-1 rounded text-sm font-bold text-white shadow-md transition-all {editingIndex >= 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'}" 
                                on:click={saveTemplateTask}
                            >
                                {editingIndex >= 0 ? 'Lưu Sửa' : 'Thêm Mới'}
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="border rounded-lg overflow-hidden bg-white flex flex-col">
                    <div class="bg-gray-100 p-2 text-xs font-bold text-gray-500 flex justify-between border-b">
                        <span>DANH SÁCH ({$taskTemplate[activeType]?.length || 0})</span>
                        <span>Thao tác</span>
                    </div>
                    
                    <ul class="divide-y overflow-y-auto max-h-[60vh] overscroll-contain">
                        {#if $taskTemplate[activeType]}
                            {#each $taskTemplate[activeType] as item, i}
                            <li class="flex justify-between p-3 text-sm items-center hover:bg-blue-50 transition-colors group {editingIndex === i ? 'bg-blue-100' : ''}">
                                <div class="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                                    <b class="bg-gray-200 px-1.5 py-0.5 rounded text-xs text-gray-700 font-mono flex-shrink-0">{item.time}</b> 
                                    <span class="truncate block {item.isImportant ? 'font-bold text-red-600' : 'text-gray-700'}">
                                        {item.isImportant ? '⭐ ' : ''}{item.title}
                                    </span>
                                </div>
                                
                                <div class="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button class="p-1.5 text-blue-500 bg-white hover:bg-blue-100 rounded border border-gray-200 shadow-sm" title="Sửa" on:click={()=>startEdit(i, item)}>
                                        <span class="material-icons-round text-base">edit</span>
                                    </button>
                                    <button class="p-1.5 text-red-500 bg-white hover:bg-red-100 rounded border border-gray-200 shadow-sm" title="Xóa" on:click={()=>removeTemplateTask(i)}>
                                        <span class="material-icons-round text-base">delete</span>
                                    </button>
                                </div>
                            </li>
                            {/each}
                        {/if}
                    </ul>
                </div>
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