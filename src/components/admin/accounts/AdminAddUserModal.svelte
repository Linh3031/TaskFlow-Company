<script>
  import { db } from '../../../lib/firebase';
  import { doc, writeBatch, serverTimestamp, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
  import { safeString } from '../../../lib/utils';
  import { createEventDispatcher } from 'svelte';
  import { currentUser } from '../../../lib/stores'; 

  export let show = false;
  export let isSuperAdmin = false;
  export let selectedStoreId = '';
  export let targetStoreInput = '';
  export let editUser = null; 
  
  let singleUsername = '';
  let singlePass = '123456';
  let singleRole = 'admin';
  let isLoading = false;
  
  let singleName = '';
  let singleGender = 'Nữ';
  
  let singleBrand = '';
  let singleCategory = '';
  
  let selectedStoreIdsForAdmin = [];

  const dispatch = createEventDispatcher();

  $: if (show) {
      if (editUser) {
          singleUsername = editUser.username || '';
          singleRole = editUser.role || 'staff';
          singlePass = ''; 
          
          // [SURGICAL FIX] Tên có sao hiện vậy, không đắp Username vào nữa!
          singleName = editUser.name || '';
          singleGender = editUser.gender || 'Nữ';
          
          singleBrand = editUser.brand || '';
          singleCategory = editUser.category || '';

          if (isSuperAdmin) {
              targetStoreInput = (editUser.storeIds || []).join(', ');
          } else {
              selectedStoreIdsForAdmin = [...(editUser.storeIds || [])];
          }
      } else {
          singleUsername = '';
          singlePass = '123456';
          singleRole = 'staff';
          singleName = '';
          singleGender = 'Nữ';
          singleBrand = '';
          singleCategory = '';

          if (!isSuperAdmin) { selectedStoreIdsForAdmin = [selectedStoreId]; }
      }
  }

  async function handleSaveUser() {
      if (!singleUsername) return alert("Thiếu tên đăng nhập!");
      if (!singleName.trim()) return alert("Thiếu tên hiển thị!");
      
      let finalStoreIds = [];
      if (isSuperAdmin) {
          finalStoreIds = targetStoreInput.split(/[,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
          if (finalStoreIds.length === 0) return alert("Chưa nhập Mã Kho!");
      } else {
          finalStoreIds = selectedStoreIdsForAdmin;
          if (finalStoreIds.length === 0) return alert("Phải chọn ít nhất 1 kho!");
      }

      const exactUsername = singleUsername.trim();
      const newUid = safeString(exactUsername).toLowerCase();
      
      isLoading = true;

      try {
          if (editUser) {
              const oldUid = safeString(editUser.username).toLowerCase();

              if (newUid !== oldUid) {
                  if (!confirm(`⚠️ BẠN ĐANG ĐỔI TÊN ĐĂNG NHẬP!\n\nHệ thống sẽ chuyển từ [${editUser.username}] sang [${exactUsername}]. Bạn có chắc chắn?`)) {
                      isLoading = false; return;
                  }
              }

              const updateData = {
                  username: exactUsername,
                  name: singleName.trim(), 
                  gender: singleGender,    
                  role: singleRole,
                  storeIds: finalStoreIds,
                  storeId: finalStoreIds[0] 
              };

              if (singlePass.trim()) updateData.pass = singlePass.trim();
              if (singleRole === 'pg') { updateData.brand = singleBrand.trim(); updateData.category = singleCategory.trim(); }

              if (newUid !== oldUid) {
                  const fullNewData = { ...editUser, ...updateData };
                  fullNewData.username_idx = newUid;

                  const batch = writeBatch(db);
                  batch.set(doc(db, 'users', newUid), fullNewData);
                  batch.delete(doc(db, 'users', oldUid));
                  if (isSuperAdmin) { finalStoreIds.forEach(s => { batch.set(doc(db, 'stores', s), { id: s, name: `Kho ${s}` }, { merge: true }); }); }
                  await batch.commit();
              } else {
                  await updateDoc(doc(db, 'users', oldUid), updateData);
                  if (isSuperAdmin) {
                      const batch = writeBatch(db);
                      finalStoreIds.forEach(s => { batch.set(doc(db, 'stores', s), { id: s, name: `Kho ${s}` }, { merge: true }); });
                      await batch.commit();
                  }
              }
              alert(`✅ Đã cập nhật thành công tài khoản [${exactUsername}]!`);
              dispatch('success', finalStoreIds[0]);
              
          } else {
              if (!singlePass) return alert("Thiếu mật khẩu!");
              const batch = writeBatch(db);
              
              const payload = {
                  username: exactUsername, 
                  username_idx: newUid,
                  pass: singlePass,
                  name: singleName.trim(), 
                  gender: singleGender,    
                  role: singleRole,
                  storeId: finalStoreIds[0],
                  storeIds: finalStoreIds,
                  // [NEW] Default index cho người tạo lẻ (đẩy xuống cuối)
                  orderIndex: 9999, 
                  createdAt: serverTimestamp()
              };

              if (singleRole === 'pg') { payload.brand = singleBrand.trim(); payload.category = singleCategory.trim(); }

              batch.set(doc(db, 'users', newUid), payload);
              if (isSuperAdmin) { finalStoreIds.forEach(s => { batch.set(doc(db, 'stores', s), { id: s, name: `Kho ${s}`, createdAt: serverTimestamp() }, { merge: true }); }); }
              await batch.commit();
              alert(`✅ Đã thêm [${exactUsername}] vào ${finalStoreIds.join(', ')}!`);
              dispatch('success', finalStoreIds[0]);
          }
      } catch (e) { alert(e.message); } finally { isLoading = false; }
  }
</script>

{#if show}
  <div class="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
      <div class="bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl animate-popIn" on:click|stopPropagation>
          <h3 class="font-bold text-lg text-slate-800 mb-1">{editUser ? 'Chỉnh Sửa Nhân Sự' : 'Thêm Nhân Sự'}</h3>
          
          {#if isSuperAdmin}
              <div class="mb-4">
                  <label for="store-input" class="text-[10px] font-bold text-slate-400 uppercase">Danh Sách Kho</label>
                  <input id="store-input" type="text" bind:value={targetStoreInput} class="w-full mt-1 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-bold text-indigo-700 outline-none uppercase" placeholder="VD: KHO_01, KHO_02">
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
              
              <div class="grid grid-cols-2 gap-3">
                  <div class="col-span-2">
                      <label for="single-user" class="text-[10px] font-bold text-slate-400 uppercase">Tên đăng nhập (Username)</label>
                      <div class="relative mt-1">
                          <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">person</span>
                          <input id="single-user" type="text" bind:value={singleUsername} class="w-full pl-9 p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-indigo-500" placeholder="VD: quoc-pana">
                      </div>
                  </div>
              </div>

              <div class="grid grid-cols-3 gap-3">
                  <div class="col-span-2">
                      <label for="single-name" class="text-[10px] font-bold text-slate-400 uppercase">Tên hiển thị</label>
                      <input id="single-name" type="text" bind:value={singleName} class="w-full mt-1 p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-indigo-500" placeholder="VD: Trần Quốc">
                  </div>
                  <div>
                      <label for="single-gender" class="text-[10px] font-bold text-slate-400 uppercase">Giới tính</label>
                      <select id="single-gender" bind:value={singleGender} class="w-full mt-1 p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                          <option value="Nữ">Nữ</option>
                          <option value="Nam">Nam</option>
                      </select>
                  </div>
              </div>
              
              <div>
                  <label for="single-pass" class="text-[10px] font-bold text-slate-400 uppercase">Mật khẩu</label>
                  <div class="relative mt-1">
                      <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">lock</span>
                      <input id="single-pass" type="text" bind:value={singlePass} class="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-gray-500 outline-none focus:border-indigo-500" placeholder={editUser ? "Bỏ trống để giữ nguyên" : "123456"}>
                  </div>
              </div>

              {#if singleRole === 'pg'}
                  <div class="space-y-3 p-3 bg-pink-50 border border-pink-100 rounded-lg mt-2">
                      <h4 class="text-[10px] font-bold text-pink-600 uppercase flex items-center gap-1"><span class="material-icons-round text-sm">face_retouching_natural</span> Bộ phận PG</h4>
                      <div class="grid grid-cols-2 gap-3">
                          <div>
                              <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Hãng (Brand)</label>
                              <input type="text" bind:value={singleBrand} class="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-pink-500" placeholder="VD: Oppo">
                          </div>
                          <div>
                              <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nhóm (Category)</label>
                              <input type="text" bind:value={singleCategory} class="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-pink-500" placeholder="VD: ICT">
                          </div>
                      </div>
                  </div>
              {/if}

              <div class="flex gap-3 pt-3 mt-2">
                  <button class="flex-1 py-2.5 bg-gray-100 rounded-lg text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors" on:click={() => dispatch('close')}>Hủy</button>
                  <button class="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-lg hover:bg-indigo-700 transition-all" on:click={handleSaveUser} disabled={isLoading}>
                      {isLoading ? 'Đang lưu...' : (editUser ? 'Cập Nhật' : 'Lưu Lại')}
                  </button>
              </div>
          </div>
      </div>
  </div>
{/if}