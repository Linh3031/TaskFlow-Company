<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { read, utils } from 'xlsx';
  import { db } from '../lib/firebase';
  import { collection, doc, setDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
  import { taskTemplate, currentUser, storeList } from '../lib/stores';
  import { safeString, getTodayStr } from '../lib/utils';

  const dispatch = createEventDispatcher();
  
  // --- DEBUG LOG ---
  onMount(() => {
    console.log("=== ADMIN MODAL OPENED ===");
    console.log("User:", $currentUser);
    console.log("Role:", $currentUser?.role);
    console.log("Store:", $currentUser?.storeId);
  });

  // TỰ ĐỘNG CẬP NHẬT TRẠNG THÁI
  $: isSuperAdmin = $currentUser?.role === 'super_admin';
  $: myStoreId = $currentUser?.storeId;

  // STATE
  let saTab = 'store';
  let newStoreId = '', newStoreName = '';
  let newAdminUser = '', newAdminPass = '', targetStoreForAdmin = '';
  let activeType = 'warehouse', newTime = '08:00', newTaskTitle = '', isUploading = false;

  // --- LOGIC ---
  async function createStore() {
    if(!newStoreId || !newStoreName) return alert("Thiếu thông tin!");
    try {
        await setDoc(doc(db, 'stores', newStoreId.toUpperCase().trim()), { name: newStoreName.trim(), createdAt: serverTimestamp() });
        alert("✅ Tạo kho thành công!"); newStoreId=''; newStoreName='';
    } catch(e) { alert("Lỗi: "+e.message); }
  }

  async function createAdminAccount() {
    if(!newAdminUser || !newAdminPass || !targetStoreForAdmin) return alert("Thiếu thông tin!");
    try {
        const u = newAdminUser.trim().toLowerCase();
        await setDoc(doc(db, 'users', u), {
            username: u, username_idx: u, pass: newAdminPass.trim(),
            name: `Admin ${targetStoreForAdmin}`, role: 'admin', storeId: targetStoreForAdmin, createdAt: serverTimestamp()
        });
        alert("✅ Cấp quyền thành công!"); newAdminUser=''; newAdminPass=''; targetStoreForAdmin='';
    } catch(e) { alert("Lỗi: "+e.message); }
  }

  async function handleExcelUpload(e) { /* Giữ nguyên logic cũ cho gọn */ }
  async function addTemplateTask() { /* Giữ nguyên logic cũ cho gọn */ }
  function removeTemplateTask(i) { /* Giữ nguyên logic cũ cho gọn */ }
</script>

<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
  <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
    
    <div class="p-4 border-b bg-slate-50">
        <div class="flex items-center gap-2 mb-1">
            <span class="material-icons-round text-orange-500 text-3xl">settings</span>
            <div class="flex-1">
                <h3 class="text-lg font-bold text-slate-800">
                    {isSuperAdmin ? 'SUPER ADMIN' : `KHO: ${myStoreId}`}
                </h3>
            </div>
        </div>
        <div class="text-xs font-mono bg-red-100 text-red-600 px-2 py-1 rounded border border-red-200 text-center">
            🔴 DEBUG MODE V5 - Role: {$currentUser?.role || 'None'}
        </div>
    </div>
    
    <div class="p-4 overflow-y-auto flex-1">
        {#if isSuperAdmin}
            <div class="flex gap-2 mb-4 border-b pb-2">
                <button class="px-3 py-1 rounded text-sm font-bold {saTab==='store'?'bg-purple-600 text-white':'bg-gray-200'}" on:click={()=>saTab='store'}>1. QL Kho</button>
                <button class="px-3 py-1 rounded text-sm font-bold {saTab==='account'?'bg-purple-600 text-white':'bg-gray-200'}" on:click={()=>saTab='account'}>2. Admin Kho</button>
            </div>

            {#if saTab === 'store'}
                <div class="space-y-2">
                    <input type="text" bind:value={newStoreId} class="w-full p-2 border rounded uppercase" placeholder="Mã Kho (VD: 908)">
                    <input type="text" bind:value={newStoreName} class="w-full p-2 border rounded" placeholder="Tên Kho">
                    <button class="w-full py-2 bg-green-600 text-white rounded font-bold" on:click={createStore}>Tạo Kho</button>
                    
                    <div class="mt-2 border-t pt-2">
                        <p class="text-xs font-bold text-gray-500">DS Kho ({$storeList.length}):</p>
                        <ul class="max-h-32 overflow-y-auto bg-gray-50 p-2 text-sm">
                            {#each $storeList as s}<li>{s.name} ({s.id})</li>{/each}
                        </ul>
                    </div>
                </div>
            {:else}
                <div class="space-y-2">
                    <input type="text" bind:value={newAdminUser} class="w-full p-2 border rounded" placeholder="User Admin">
                    <input type="text" bind:value={newAdminPass} class="w-full p-2 border rounded" placeholder="Pass">
                    <select bind:value={targetStoreForAdmin} class="w-full p-2 border rounded">
                        <option value="">-- Chọn Kho --</option>
                        {#each $storeList as s}<option value={s.id}>{s.name}</option>{/each}
                    </select>
                    <button class="w-full py-2 bg-purple-600 text-white rounded font-bold" on:click={createAdminAccount}>Cấp Quyền</button>
                </div>
            {/if}

        {:else}
            <div class="text-center py-4 text-gray-500">
                <p>Bạn đang ở giao diện Admin Kho thường.</p>
                <p>Mã kho: {myStoreId}</p>
                <p class="text-xs">(Upload Excel & Checklist ở đây)</p>
            </div>
        {/if}
    </div>

    <div class="p-4 border-t bg-slate-50">
      <button class="w-full py-3 rounded-xl font-bold text-slate-700 bg-slate-200" on:click={() => dispatch('close')}>Đóng</button>
    </div>
  </div>
</div>