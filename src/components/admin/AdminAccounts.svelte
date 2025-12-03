<script>
  // Version 4.2 - Fix ID for Tour Guide (No Freeze)
  import { db } from '../../lib/firebase';
  import { doc, deleteDoc, updateDoc, writeBatch, query, collection, where, getDocs, serverTimestamp } from 'firebase/firestore';
  import { read, utils, writeFile } from 'xlsx';
  import { safeString } from '../../lib/utils';
  import { onMount } from 'svelte';
  import TourGuide from '../TourGuide.svelte'; 
  
  export let targetStore = ''; 
  export let isSuperAdmin = false;
  
  let storeList = []; 
  let selectedStoreId = '';
  let accountList = [];
  let isLoading = false;
  
  let newAdminUser = ''; let newAdminPass = ''; 
  let singleUsername = ''; let singlePass = '123456'; let singleRole = 'staff';
  let showAddUserModal = false;
  
  // --- TOUR GUIDE (Sử dụng ID) ---
  let showTour = false;
  const tourSteps = [
      { target: '#btn-add-user', title: '1. Thêm Nhân Sự', content: 'Tạo tài khoản đăng nhập mới cho nhân viên.' },
      { target: '#btn-upload-acc', title: '2. Upload Nhanh', content: 'Tải danh sách Excel để tạo hàng loạt tài khoản cùng lúc.' },
      { target: '#accounts-table', title: '3. Phân Quyền', content: 'Bạn có thể đổi mật khẩu, xóa hoặc đổi quyền (Nhân viên/Quản lý) trực tiếp tại danh sách này.' }
  ];
  // ------------------------------

  $: isDemoMode = (selectedStoreId || targetStore)?.includes('DEMO');

  onMount(async () => {
      if (isSuperAdmin) {
          await fetchAllStores();
      } else {
          selectedStoreId = targetStore;
          loadAccountList(targetStore);
      }
  });

  $: if (targetStore && targetStore !== selectedStoreId) {
      selectedStoreId = targetStore;
      loadAccountList(targetStore);
  }

  function checkDemoAndBlock(e) {
      if (isDemoMode) {
          e && e.preventDefault();
          e && e.stopPropagation();
          alert("Tài khoản demo không có tính năng này!");
          return true;
      }
      return false;
  }

  async function fetchAllStores() {
      try {
          const q = query(collection(db, 'stores'));
          const snap = await getDocs(q);
          storeList = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => a.id.localeCompare(b.id));
          if (storeList.length > 0 && !selectedStoreId) {
              selectedStoreId = storeList[0].id;
              loadAccountList(selectedStoreId);
          }
      } catch (e) { console.error("Lỗi tải danh sách kho:", e); }
  }

  function selectStore(sid) {
      selectedStoreId = sid;
      loadAccountList(sid);
  }

  async function loadAccountList(sid) {
      if (!sid) return;
      isLoading = true;
      accountList = [];
      try {
          const q = query(collection(db, 'users'), where('storeIds', 'array-contains', sid));
          const snap = await getDocs(q);
          const list = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
          const roleOrder = { 'super_admin': 0, 'admin': 1, 'staff': 2 };
          list.sort((a, b) => {
              const rA = roleOrder[a.role] ?? 99;
              const rB = roleOrder[b.role] ?? 99;
              if (rA !== rB) return rA - rB;
              return a.username.localeCompare(b.username);
          });
          accountList = list;
      } catch (e) { console.error("Load accounts failed:", e); } 
      finally { isLoading = false; }
  }

  async function handleCreateSingleUser() {
      if (checkDemoAndBlock()) return;
      if (!singleUsername || !singlePass) return alert("Thiếu thông tin!");
      
      const uid = safeString(singleUsername).toLowerCase();
      const storeToAssign = selectedStoreId;
      
      if (!storeToAssign) return alert("Chưa chọn kho nào!");
      isLoading = true;
      const batch = writeBatch(db);
      try {
          batch.set(doc(db, 'users', uid), {
              username: uid, username_idx: uid,
              pass: singlePass,
              name: uid,
              role: singleRole,
              storeId: storeToAssign,
              storeIds: [storeToAssign],
              createdAt: serverTimestamp()
          });
          await batch.commit();
          alert(`✅ Đã thêm ${uid} vào kho ${storeToAssign}!`);
          showAddUserModal = false;
          singleUsername = '';
          await loadAccountList(selectedStoreId);
      } catch (e) { alert(e.message); }
      finally { isLoading = false; }
  }

  async function deleteAccount(uid) {
      if (checkDemoAndBlock()) return;
      if (!confirm(`Xóa tài khoản ${uid}?`)) return;
      try {
          await deleteDoc(doc(db, 'users', uid));
          await loadAccountList(selectedStoreId);
      } catch (e) { alert("Lỗi xóa: " + e.message); }
  }

  async function changeRole(uid, newRole) {
      if (checkDemoAndBlock()) return;
      if (!confirm(`Đổi quyền tài khoản ${uid} thành ${newRole}?`)) return;
      try {
          await updateDoc(doc(db, 'users', uid), { role: newRole });
          await loadAccountList(selectedStoreId);
      } catch (e) { alert("Lỗi đổi quyền: " + e.message); }
  }

  async function resetPassword(uid) {
      if (checkDemoAndBlock()) return;
      if (!confirm(`Reset mật khẩu cho ${uid} về 123456?`)) return;
      try {
          await updateDoc(doc(db, 'users', uid), { pass: '123456' });
          alert("OK");
      } catch (e) { alert("Lỗi: " + e.message); }
  }

  function downloadAccountSample() {
      const wb = utils.book_new();
      const wsData = [
          ["username", "pass", "ma_kho", "role"],
          [`nv1_${selectedStoreId||'kho'}`, "123456", selectedStoreId||'kho', "staff"],
          [`quanly_${selectedStoreId||'kho'}`, "123456", selectedStoreId||'kho', "admin"]
      ];
      const ws = utils.aoa_to_sheet(wsData);
      utils.book_append_sheet(wb, ws, "DS_Cap_Quyen");
      writeFile(wb, `Mau_Tai_Khoan_${selectedStoreId}.xlsx`);
  }

  async function handleAccountUpload(e) {
      const file = e.target.files[0];
      if (!file) return;
      isLoading = true;
      setTimeout(async () => {
          try {
              const data = await file.arrayBuffer();
              const wb = read(data);
              const json = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
              const batch = writeBatch(db);
              let c = 0;
              json.forEach(row => {
                  const u = row['username']; const p = row['pass']; const s = row['ma_kho']; const r = row['role'];
                  if (u && p && s && r) {
                      const uid = safeString(u).toLowerCase();
                      batch.set(doc(db, 'users', uid), {
                          username: uid, username_idx: uid,
                          pass: String(p), name: uid,
                          role: safeString(r).toLowerCase(),
                          storeId: String(s), storeIds: [String(s)],
                          createdAt: serverTimestamp()
                      });
                      c++;
                  }
              });
              if (c > 0) {
                  await batch.commit();
                  alert(`Đã import ${c} tài khoản.`);
                  await loadAccountList(selectedStoreId);
              }
          } catch (e) { alert(e.message); }
          finally { isLoading = false; e.target.value = null; }
      }, 100);
  }
</script>

<div class="h-full flex flex-col md:flex-row gap-4 animate-fadeIn overflow-hidden" style="height: calc(100vh - 140px);">
  
  {#if isSuperAdmin}
      <div class="w-full md:w-64 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col shrink-0">
          <div class="p-3 border-b border-slate-100 bg-slate-50">
              <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <span class="material-icons-round text-indigo-500 text-base">store</span> 
                  Danh Sách Kho ({storeList.length})
              </h3>
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-1">
              {#each storeList as store}
                  <button 
                      class="w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all flex justify-between items-center
                      {selectedStoreId === store.id 
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                          : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600'}"
                      on:click={() => selectStore(store.id)}
                  >
                      <span>{store.id}</span>
                      {#if selectedStoreId === store.id}
                          <span class="material-icons-round text-xs">chevron_right</span>
                      {/if}
                  </button>
              {/each}
              {#if storeList.length === 0}
                  <div class="text-center p-4 text-xs text-gray-400">Đang tải hoặc chưa có kho nào.</div>
              {/if}
          </div>
      </div>
  {/if}

  <div class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
      <div class="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3 shrink-0 bg-white z-10">
          <div class="flex items-center gap-2">
              <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  {selectedStoreId ? selectedStoreId.substring(0,2).toUpperCase() : '?'}
              </div>
              <div>
                  <h3 class="font-bold text-slate-800">Nhân sự Kho {selectedStoreId || '...'}</h3>
                  <p class="text-xs text-gray-500">Tổng: {accountList.length} tài khoản</p>
              </div>
          </div>

          <div class="flex gap-2 items-center">
              <button 
                  id="btn-add-user"
                  class="text-xs font-bold text-green-600 bg-green-50 px-3 py-2.5 rounded-lg hover:bg-green-100 flex items-center gap-1 transition-colors border border-green-100 mr-2" 
                  on:click={(e) => checkDemoAndBlock(e) || (showAddUserModal = true)}
                  disabled={!selectedStoreId}
              >
                  <span class="material-icons-round text-sm">person_add</span> Thêm Mới
              </button>
              
              <button class="bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold py-2 px-3 rounded-lg text-xs transition-colors border border-blue-100" on:click={(e) => checkDemoAndBlock(e) || downloadAccountSample()}>
                  Tải Mẫu
              </button>
              
              <label id="btn-upload-acc" class="bg-blue-600 text-white hover:bg-blue-700 font-bold py-2 px-3 rounded-lg text-xs cursor-pointer flex items-center gap-1 transition-colors shadow-sm">
                  <span class="material-icons-round text-sm">upload</span> Upload
                  <input type="file" hidden accept=".xlsx" disabled={isDemoMode} on:change={handleAccountUpload}>
              </label>

              <button id="btn-help-accounts" class="text-gray-400 hover:text-indigo-600 ml-2" on:click={() => showTour = true}><span class="material-icons-round">help_outline</span></button>
          </div>
      </div>
      
      <div id="accounts-table" class="flex-1 overflow-auto relative">
          <table class="w-full text-sm text-left border-collapse">
              <thead class="bg-slate-50 text-slate-500 font-bold sticky top-0 z-10 shadow-sm">
                  <tr>
                      <th class="p-3 border-b border-slate-200">Tên Đăng Nhập</th>
                      <th class="p-3 border-b border-slate-200">Quyền Hạn</th>
                      <th class="p-3 border-b border-slate-200 text-center">Thao Tác</th>
                  </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                  {#each accountList as acc}
                      <tr class="hover:bg-indigo-50/30 transition-colors group">
                          <td class="p-3">
                              <div class="font-bold text-slate-700">{acc.username}</div>
                              {#if acc.name && acc.name !== acc.username}
                                  <div class="text-[10px] text-gray-400">{acc.name}</div>
                              {/if}
                          </td>
                          <td class="p-3">
                              <select 
                                  class="bg-transparent text-xs font-bold outline-none cursor-pointer py-1 px-2 rounded border border-transparent hover:border-slate-300 transition-colors
                                  {acc.role==='admin'?'text-purple-600 bg-purple-50':(acc.role==='super_admin'?'text-red-600 bg-red-50':'text-slate-600 bg-slate-100')}" 
                                  value={acc.role} 
                                  on:change={(e) => changeRole(acc.id, e.target.value)}
                              >
                                  <option value="staff">Nhân viên</option>
                                  <option value="admin">Quản lý</option>
                                  {#if isSuperAdmin}<option value="super_admin">Super Admin</option>{/if}
                              </select>
                          </td>
                          <td class="p-3 text-center">
                              <div class="flex justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-yellow-50 text-slate-400 hover:text-yellow-600 transition-colors" on:click={() => resetPassword(acc.id)} title="Reset Mật khẩu về 123456">
                                       <span class="material-icons-round text-sm">lock_reset</span>
                                  </button>
                                  <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" on:click={() => deleteAccount(acc.id)} title="Xóa tài khoản">
                                      <span class="material-icons-round text-sm">delete</span>
                                  </button>
                              </div>
                          </td>
                      </tr>
                  {/each}
                  {#if accountList.length === 0}
                      <tr>
                          <td colspan="3" class="p-8 text-center text-gray-400 flex flex-col items-center">
                              <span class="material-icons-round text-4xl mb-2 opacity-20">no_accounts</span>
                              <span class="text-xs">Chưa có nhân sự nào trong kho {selectedStoreId}.</span>
                          </td>
                      </tr>
                  {/if}
              </tbody>
          </table>
      </div>
  </div>
</div>

{#if showAddUserModal}
  <div class="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => showAddUserModal = false}>
      <div class="bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl animate-popIn" on:click|stopPropagation>
          <h3 class="font-bold text-lg text-slate-800 mb-1">Thêm Nhân Sự</h3>
          <p class="text-xs text-gray-500 mb-4">Thêm vào kho: <b class="text-indigo-600">{selectedStoreId}</b></p>
          
          <div class="space-y-3">
              <div>
                  <label for="single-role" class="text-[10px] font-bold text-slate-400 uppercase">Quyền hạn</label>
                  <select id="single-role" bind:value={singleRole} class="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                      <option value="staff">Nhân viên</option>
                      <option value="admin">Quản lý</option>
                  </select>
              </div>
              
              <div>
                  <label for="single-user" class="text-[10px] font-bold text-slate-400 uppercase">Tên đăng nhập</label>
                  <div class="relative mt-1">
                      <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">person</span>
                      <input id="single-user" type="text" bind:value={singleUsername} class="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" placeholder="VD: nv_moi">
                  </div>
              </div>
              
              <div>
                  <label for="single-pass" class="text-[10px] font-bold text-slate-400 uppercase">Mật khẩu</label>
                  <div class="relative mt-1">
                      <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">lock</span>
                      <input id="single-pass" type="text" bind:value={singlePass} class="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-gray-500 outline-none focus:border-indigo-500" placeholder="123456">
                  </div>
              </div>

              <div class="flex gap-3 pt-3 mt-2">
                  <button class="flex-1 py-2.5 bg-gray-100 rounded-lg text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors" on:click={() => showAddUserModal = false}>Hủy</button>
                  <button class="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all" on:click={handleCreateSingleUser}>Lưu Lại</button>
              </div>
          </div>
      </div>
  </div>
{/if}

{#if showTour} <TourGuide steps={tourSteps} on:complete={() => showTour = false} /> {/if}

{#if isLoading}
  <div class="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-[60]">
      <div class="animate-spin text-indigo-600"><span class="material-icons-round text-3xl">sync</span></div>
  </div>
{/if}