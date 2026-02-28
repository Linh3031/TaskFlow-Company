<script>
  import { db } from '../../lib/firebase';
  import { query, collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
  import { read, utils, writeFile } from 'xlsx';
  import { safeString } from '../../lib/utils';
  import { onMount } from 'svelte';
  import { accountService } from '../../services/accountService';
  import AdminAddUserModal from './accounts/AdminAddUserModal.svelte';
  import TourGuide from '../TourGuide.svelte'; 
  
  export let targetStore = '';
  export let isSuperAdmin = false;
  
  let storeList = [];
  let selectedStoreId = '';
  let accountList = [];
  let isLoading = false;
  let targetStoreInput = '';
  let showAddUserModal = false;
  let userToEdit = null; // Biến lưu data khi bấm nút Edit

  // --- TOUR GUIDE CONFIG ---
  let showTour = false;
  const tourSteps = [
      { target: '#btn-add-user', title: '1. Tạo Admin Kho Mới', content: 'Bấm vào đây. Nếu là tài khoản Setup, bạn có thể nhập Mã Kho Mới để tạo kho.' },
      { target: '#upload-center', title: '2. Upload Nhanh', content: 'Khu vực tải lên danh sách Excel riêng biệt cho Nhân viên và PG.' },
      { target: '#accounts-table', title: '3. Phân Quyền', content: 'Danh sách tài khoản hiện có. Bạn có thể xóa hoặc đổi mật khẩu tại đây.' }
  ];

  $: isDemoMode = (selectedStoreId || targetStore)?.includes('DEMO');
  
  onMount(async () => {
      if (isSuperAdmin) { await fetchAllStores(); } 
      else { selectedStoreId = targetStore; loadAccountList(targetStore); }
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
          if (storeList.length > 0 && !selectedStoreId) { selectStore(storeList[0].id); }
      } catch (e) { console.error("Lỗi tải danh sách kho:", e); }
  }

  function selectStore(sid) {
      selectedStoreId = sid;
      loadAccountList(sid);
  }

  async function loadAccountList(sid) {
      if (!sid) return;
      isLoading = true;
      accountList = await accountService.loadAccountList(sid);
      isLoading = false;
  }

  async function deleteAccount(uid) {
      if (checkDemoAndBlock() || !confirm(`Xóa tài khoản ${uid}?`)) return;
      await accountService.deleteAccount(uid);
      await loadAccountList(selectedStoreId);
  }

  async function changeRole(uid, newRole) {
      if (checkDemoAndBlock() || !confirm(`Đổi quyền tài khoản ${uid} thành ${newRole}?`)) return;
      await accountService.changeRole(uid, newRole);
      await loadAccountList(selectedStoreId);
  }

  async function resetPassword(uid) {
      if (checkDemoAndBlock() || !confirm(`Reset mật khẩu cho ${uid} về 123456?`)) return;
      await accountService.resetPassword(uid);
      alert("OK");
  }

  function downloadAccountSample() {
      const wb = utils.book_new();
      const wsData = [["username", "pass", "ma_kho", "role"], [`nv1_${selectedStoreId||'kho'}`, "123456", selectedStoreId||'kho', "staff"]];
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
                      const storeArray = String(s).split(/[,;]+/).map(x=>x.trim().toUpperCase()).filter(Boolean); // Hỗ trợ up excel đa kho
                      
                      batch.set(doc(db, 'users', uid), {
                          username: uid, username_idx: uid,
                          pass: String(p), name: uid,
                          role: safeString(r).toLowerCase(),
                          storeId: storeArray[0], 
                          storeIds: storeArray,
                          createdAt: serverTimestamp()
                      });
         
                      if (isSuperAdmin) { 
                          storeArray.forEach(k => {
                              batch.set(doc(db, 'stores', k), { id: k, name: `Kho ${k}` }, { merge: true });
                          });
                      }
                      c++;
                  }
              });
              if (c > 0) { await batch.commit(); alert(`Đã import ${c} NV.`); if(isSuperAdmin) await fetchAllStores(); await loadAccountList(selectedStoreId); }
          } catch (e) { alert(e.message);
          } finally { isLoading = false; e.target.value = null; }
      }, 100);
  }

  function downloadPGSample() {
      const wb = utils.book_new();
      const wsData = [["username", "pass", "ma_kho", "name", "brand", "category"], [`PG_01`, "123456", selectedStoreId||'kho', "Tên PG", "Brand", "ICT"]];
      const ws = utils.aoa_to_sheet(wsData);
      utils.book_append_sheet(wb, ws, "DS_PG");
      writeFile(wb, `Mau_PG_${selectedStoreId}.xlsx`);
  }

  async function handlePGUpload(e) {
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
                  const u = row['username']; const p = row['pass']; const s = row['ma_kho'];
                  if (u && p && s && row['name']) {
                      const uid = safeString(u).toLowerCase();
                      const storeArray = String(s).split(/[,;]+/).map(x=>x.trim().toUpperCase()).filter(Boolean); // Hỗ trợ up excel đa kho

                      batch.set(doc(db, 'users', uid), {
                          username: String(u), username_idx: uid,
                          pass: String(p), name: String(row['name']),
                          role: 'pg', 
                          storeId: storeArray[0], 
                          storeIds: storeArray,
                          brand: String(row['brand']||''), category: String(row['category']||''),
                          phone: String(row['phone'] || ''), phoneLeader: String(row['phone_leader'] || ''),
                          createdAt: serverTimestamp()
                      });
                      if (isSuperAdmin) {
                          storeArray.forEach(k => {
                              batch.set(doc(db, 'stores', k), { id: k, name: `Kho ${k}` }, { merge: true });
                          });
                      }
                      c++;
                  }
              });
              if (c > 0) { await batch.commit(); alert(`Đã import ${c} PG.`); await loadAccountList(selectedStoreId); }
          } catch (e) { alert(e.message);
          } finally { isLoading = false; e.target.value = null; }
      }, 100);
  }
</script>

<div class="h-full flex flex-col md:flex-row gap-4 animate-fadeIn overflow-hidden" style="height: calc(100vh - 140px);">
  {#if isSuperAdmin}
      <div class="w-full md:w-64 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col shrink-0">
          <div class="p-3 border-b border-slate-100 bg-slate-50">
              <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <span class="material-icons-round text-indigo-500 text-base">store</span> Danh Sách Kho ({storeList.length})
              </h3>
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-1">
              {#each storeList as store}
                  <button class="w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all flex justify-between items-center {selectedStoreId === store.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}" on:click={() => selectStore(store.id)}>
                      <span>{store.id}</span>
                      {#if selectedStoreId === store.id}<span class="material-icons-round text-xs">chevron_right</span>{/if}
                  </button>
              {/each}
          </div>
      </div>
  {/if}

  <div class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
      <div class="p-3 border-b border-slate-100 flex justify-between items-center bg-white z-10 shrink-0">
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
              <button id="btn-add-user" class="text-xs font-bold text-green-600 bg-green-50 px-3 py-2.5 rounded-lg border border-green-100" on:click={(e) => checkDemoAndBlock(e) || (userToEdit = null, showAddUserModal = true)}>
                  <span class="material-icons-round text-sm">person_add</span> Thêm Mới
              </button>
              <button class="text-gray-400 hover:text-indigo-600 ml-2" on:click={() => showTour = true}><span class="material-icons-round">help_outline</span></button>
          </div>
      </div>

      <div id="upload-center" class="p-3 bg-slate-50 border-b border-slate-200 shrink-0 flex flex-col xl:flex-row gap-4">
          <div class="flex-1 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
              <h4 class="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1"><span class="material-icons-round text-blue-500 text-sm">badge</span> Nhân Viên Nội Bộ</h4>
              <div class="flex gap-2">
                  <button class="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg text-xs font-bold" on:click={(e) => checkDemoAndBlock(e) || downloadAccountSample()}>Tải Mẫu NV</button>
                  <label class="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold cursor-pointer text-center">
                      Upload NV <input type="file" hidden accept=".xlsx" disabled={isDemoMode} on:change={handleAccountUpload}>
                  </label>
              </div>
          </div>
          <div class="flex-1 bg-pink-50/50 p-3 rounded-lg border border-pink-200 shadow-sm">
              <h4 class="text-xs font-bold text-pink-700 mb-3 flex items-center gap-1"><span class="material-icons-round text-pink-500 text-sm">face_retouching_natural</span> Danh Sách PG</h4>
              <div class="flex gap-2">
                  <button class="flex-1 bg-pink-50 text-pink-600 py-2 rounded-lg text-xs font-bold" on:click={(e) => checkDemoAndBlock(e) || downloadPGSample()}>Tải Mẫu PG</button>
                  <label class="flex-1 bg-pink-600 text-white py-2 rounded-lg text-xs font-bold cursor-pointer text-center">
                      Upload PG <input type="file" hidden accept=".xlsx" disabled={isDemoMode} on:change={handlePGUpload}>
                  </label>
              </div>
          </div>
      </div>
      
      <div id="accounts-table" class="flex-1 overflow-auto relative">
          <table class="w-full text-sm text-left border-collapse">
              <thead class="bg-slate-50 text-slate-500 font-bold sticky top-0 z-10 shadow-sm">
                  <tr>
                      <th class="p-3 border-b border-slate-200">Thông Tin Tài Khoản</th>
                      <th class="p-3 border-b border-slate-200">Quyền Hạn</th>
                      <th class="p-3 border-b border-slate-200 text-center">Thao Tác</th>
                  </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                  {#each accountList as acc}
                      <tr class="hover:bg-indigo-50/30 transition-colors group">
                          <td class="p-3">
                              <div class="font-bold text-slate-700">{acc.username}</div>
                              {#if acc.name && acc.name !== acc.username}<div class="text-[10px] text-gray-500">{acc.name}</div>{/if}
                              {#if acc.role === 'pg'}
                                  <div class="text-[10px] text-pink-600 font-semibold mt-0.5 bg-pink-50 inline-block px-1.5 py-0.5 rounded border border-pink-100">{acc.brand} | {acc.category}</div>
                              {/if}
                              {#if acc.storeIds && acc.storeIds.length > 1}
                                  <div class="text-[10px] text-indigo-600 font-semibold mt-0.5 bg-indigo-50 inline-block px-1.5 py-0.5 rounded border border-indigo-100" title={acc.storeIds.join(', ')}>Đa kho: {acc.storeIds.length} kho</div>
                              {/if}
                          </td>
                          <td class="p-3">
                              <select class="bg-transparent text-xs font-bold py-1 px-2 rounded border border-transparent hover:border-slate-300 {acc.role==='admin'?'text-purple-600 bg-purple-50':(acc.role==='super_admin'?'text-red-600 bg-red-50':(acc.role==='pg'?'text-pink-600 bg-pink-50':'text-slate-600 bg-slate-100'))}" value={acc.role} on:change={(e) => changeRole(acc.id, e.target.value)}>
                                  <option value="staff">Nhân viên</option>
                                  <option value="admin">Quản lý</option>
                                  <option value="pg">PG</option>
                                  {#if isSuperAdmin}<option value="super_admin">Super Admin</option>{/if}
                              </select>
                          </td>
                          <td class="p-3 text-center">
                              <div class="flex justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600" on:click={() => { userToEdit = acc; showAddUserModal = true; }} title="Sửa tài khoản"><span class="material-icons-round text-sm">edit</span></button>
                                  
                                  <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-yellow-50 text-slate-400 hover:text-yellow-600" on:click={() => resetPassword(acc.id)} title="Reset Mật khẩu"><span class="material-icons-round text-sm">lock_reset</span></button>
                                  <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600" on:click={() => deleteAccount(acc.id)} title="Xóa tài khoản"><span class="material-icons-round text-sm">delete</span></button>
                              </div>
                          </td>
                      </tr>
                  {/each}
              </tbody>
          </table>
      </div>
  </div>
</div>

<AdminAddUserModal 
    bind:show={showAddUserModal} 
    {isSuperAdmin} 
    {selectedStoreId} 
    bind:targetStoreInput 
    editUser={userToEdit}
    on:close={() => { showAddUserModal = false; userToEdit = null; }}
    on:success={(e) => { 
        showAddUserModal = false; 
        userToEdit = null; 
        if(isSuperAdmin) fetchAllStores().then(() => selectStore(e.detail)); 
        else loadAccountList(selectedStoreId); 
    }}
/>

{#if showTour} <TourGuide steps={tourSteps} on:complete={() => showTour = false} /> {/if}

{#if isLoading}
  <div class="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-[60]">
      <div class="animate-spin text-indigo-600"><span class="material-icons-round text-3xl">sync</span></div>
  </div>
{/if}