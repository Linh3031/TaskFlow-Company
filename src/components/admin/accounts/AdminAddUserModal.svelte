<script>
  import { db } from '../../../lib/firebase';
  import { doc, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
  import { safeString } from '../../../lib/utils';
  import { createEventDispatcher } from 'svelte';
  import { currentUser } from '../../../lib/stores'; // Import để lấy danh sách kho của Admin

  export let show = false;
  export let isSuperAdmin = false;
  export let selectedStoreId = '';
  export let targetStoreInput = '';
  export let editUser = null; // Props mới để nhận data sửa
  
  let singleUsername = '';
  let singlePass = '123456'; 
  let singleRole = 'admin';
  let isLoading = false;
  
  let selectedStoreIdsForAdmin = []; // Mảng chứa các kho mà Admin thường tick chọn

  const dispatch = createEventDispatcher();

  // Theo dõi khi mở Modal hoặc đổi User Edit
  $: if (show) {
      if (editUser) {
          singleUsername = editUser.username || '';
          singleRole = editUser.role || 'staff';
          singlePass = ''; // Để trống là không đổi mật khẩu
          if (isSuperAdmin) {
              targetStoreInput = (editUser.storeIds || []).join(', ');
          } else {
              selectedStoreIdsForAdmin = [...(editUser.storeIds || [])];
          }
      } else {
          singleUsername = '';
          singlePass = '123456';
          singleRole = 'staff';
          if (!isSuperAdmin) {
              selectedStoreIdsForAdmin = [selectedStoreId];
          }
      }
  }

  async function handleSaveUser() {
      if (!singleUsername) return alert("Thiếu tên đăng nhập!");
      
      let finalStoreIds = [];
      if (isSuperAdmin) {
          finalStoreIds = targetStoreInput.split(/[,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
          if (finalStoreIds.length === 0) return alert("Chưa nhập Mã Kho!");
      } else {
          finalStoreIds = selectedStoreIdsForAdmin;
          if (finalStoreIds.length === 0) return alert("Phải chọn ít nhất 1 kho!");
      }

      const uid = safeString(singleUsername).toLowerCase();
      isLoading = true;
      
      try {
          if (editUser) {
              // LOGIC CẬP NHẬT (EDIT)
              const updateData = {
                  role: singleRole,
                  storeIds: finalStoreIds,
                  storeId: finalStoreIds[0] // Lấy kho đầu tiên làm kho hiển thị chính
              };
              if (singlePass.trim()) {
                  updateData.pass = singlePass.trim();
              }
              await updateDoc(doc(db, 'users', uid), updateData);
              
              if (isSuperAdmin) {
                  const batch = writeBatch(db);
                  finalStoreIds.forEach(s => {
                      batch.set(doc(db, 'stores', s), { id: s, name: `Kho ${s}` }, { merge: true });
                  });
                  await batch.commit();
              }
              alert(`✅ Đã cập nhật ${uid}!`);
              dispatch('success', finalStoreIds[0]);
          } else {
              // LOGIC TẠO MỚI (CREATE)
              if (!singlePass) return alert("Thiếu mật khẩu!");
              const batch = writeBatch(db);
              
              batch.set(doc(db, 'users', uid), {
                  username: uid, username_idx: uid,
                  pass: singlePass,
                  name: uid,
                  role: singleRole,
                  storeId: finalStoreIds[0],
                  storeIds: finalStoreIds,
                  createdAt: serverTimestamp()
              });
              
              if (isSuperAdmin) {
                  finalStoreIds.forEach(s => {
                      batch.set(doc(db, 'stores', s), { id: s, name: `Kho ${s}`, createdAt: serverTimestamp() }, { merge: true });
                  });
              }
              await batch.commit();
              alert(`✅ Đã thêm ${uid} vào ${finalStoreIds.join(', ')}!`);
              dispatch('success', finalStoreIds[0]);
          }
      } catch (e) { 
          alert(e.message);
      } finally { 
          isLoading = false;
      }
  }
</script>

{#if show}
  <div class="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
      <div class="bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl animate-popIn" on:click|stopPropagation>
          <h3 class="font-bold text-lg text-slate-800 mb-1">{editUser ? 'Chỉnh Sửa Nhân Sự' : 'Thêm Nhân Sự'}</h3>
          
          {#if isSuperAdmin}
              <div class="mb-4">
                  <label for="store-input" class="text-[10px] font-bold text-slate-400 uppercase">Danh Sách Kho (Cách nhau bằng dấu phẩy)</label>
                  <input id="store-input" type="text" bind:value={targetStoreInput} class="w-full mt-1 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-200 uppercase" placeholder="VD: KHO_01, KHO_02">
              </div>
          {:else}
              <div class="mb-4">
                  <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Chọn Kho Cấp Quyền</label>
                  <div class="space-y-1 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      {#each ($currentUser?.storeIds || [selectedStoreId]) as sid}
                          <label class="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" bind:group={selectedStoreIdsForAdmin} value={sid} class="accent-indigo-600 w-4 h-4 rounded">
                              <span class="text-sm font-bold text-slate-700">{sid}</span>
                          </label>
                      {/each}
                  </div>
              </div>
          {/if}
          
          <div class="space-y-3">
              <div>
                  <label for="single-role" class="text-[10px] font-bold text-slate-400 uppercase">Quyền hạn</label>
                  <select id="single-role" bind:value={singleRole} class="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                      <option value="staff">Nhân viên</option>
                      <option value="admin">Quản lý</option>
                      <option value="pg">PG</option>
                  </select>
              </div>
              
              <div>
                  <label for="single-user" class="text-[10px] font-bold text-slate-400 uppercase">Tên đăng nhập</label>
                  <div class="relative mt-1">
                      <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">person</span>
                      <input id="single-user" type="text" bind:value={singleUsername} disabled={!!editUser} class="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 disabled:opacity-60 disabled:bg-gray-100" placeholder="VD: nv_moi">
                  </div>
              </div>
              
              <div>
                  <label for="single-pass" class="text-[10px] font-bold text-slate-400 uppercase">Mật khẩu</label>
                  <div class="relative mt-1">
                      <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">lock</span>
                      <input id="single-pass" type="text" bind:value={singlePass} class="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-gray-500 outline-none focus:border-indigo-500" placeholder={editUser ? "Bỏ trống để giữ nguyên mật khẩu" : "123456"}>
                  </div>
              </div>

              <div class="flex gap-3 pt-3 mt-2">
                  <button class="flex-1 py-2.5 bg-gray-100 rounded-lg text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors" on:click={() => dispatch('close')}>Hủy</button>
                  <button class="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all" on:click={handleSaveUser} disabled={isLoading}>
                      {isLoading ? 'Đang lưu...' : (editUser ? 'Cập Nhật' : 'Lưu Lại')}
                  </button>
              </div>
          </div>
      </div>
  </div>
{/if}