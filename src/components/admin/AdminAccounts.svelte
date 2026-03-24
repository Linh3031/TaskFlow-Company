<script>
  import { db } from '../../lib/firebase';
  // [CodeGenesis] Thêm getDoc, setDoc
  import { query, collection, getDocs, writeBatch, doc, serverTimestamp, where, getDoc, setDoc } from 'firebase/firestore';
  import { read, utils, writeFile } from 'xlsx';
  // [CodeGenesis] Thêm getTodayStr
  import { safeString, getTodayStr } from '../../lib/utils';
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
  let userToEdit = null; 

  let searchQuery = '';
  $: filteredAccounts = accountList.filter(acc => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return acc.username.toLowerCase().includes(q) || (acc.name && acc.name.toLowerCase().includes(q));
  });

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
      if (isDemoMode) { e && e.preventDefault(); e && e.stopPropagation(); alert("Tài khoản demo không có tính năng này!"); return true; }
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
      try {
          const q = query(collection(db, 'users'), where('storeIds', 'array-contains', sid));
          const snap = await getDocs(q);
          accountList = snap.docs.map(d => ({id: d.id, ...d.data()}));
          accountList.sort((a,b) => a.role.localeCompare(b.role) || (a.orderIndex || 9999) - (b.orderIndex || 9999) || a.username.localeCompare(b.username));
      } catch(e) {
          console.error("Lỗi fetch DB, fallback:", e);
          accountList = await accountService.loadAccountList(sid);
      }
      isLoading = false;
  }

  // [CodeGenesis] Phẫu thuật hàm deleteAccount: Thêm Cascade Delete 8NTTT
  async function deleteAccount(uid) {
      if (checkDemoAndBlock() || !confirm(`Xóa tài khoản ${uid}?`)) return;
      
      isLoading = true;
      // 1. Xóa User khỏi hệ thống tài khoản
      await accountService.deleteAccount(uid);

      // 2. Dọn dẹp bóng ma trong hệ thống 8NTTT
      try {
          const templateRef = doc(db, 'stores', selectedStoreId, '8nttt_template', 'config');
          const dailyRef = doc(db, '8nttt_daily_records', `${selectedStoreId}_${getTodayStr()}`);
          
          const [tplSnap, dailySnap] = await Promise.all([getDoc(templateRef), getDoc(dailyRef)]);
          
          // Quét và xóa trong file Template
          if (tplSnap.exists()) {
              let items = tplSnap.data().items || [];
              let changed = false;
              items = items.map(item => {
                  if (item.assignees && item.assignees.some(a => a.id === uid)) {
                      changed = true;
                      return { ...item, assignees: item.assignees.filter(a => a.id !== uid) };
                  }
                  return item;
              });
              if (changed) await setDoc(templateRef, { items }, { merge: true });
          }
          
          // Quét và xóa trong file Daily Record (Ngày hiện tại)
          if (dailySnap.exists()) {
              let items = dailySnap.data().items || [];
              let changed = false;
              items = items.map(item => {
                  if (item.assignees && item.assignees.some(a => a.id === uid)) {
                      changed = true;
                      return { ...item, assignees: item.assignees.filter(a => a.id !== uid) };
                  }
                  return item;
              });
              if (changed) await setDoc(dailyRef, { items }, { merge: true });
          }
      } catch(e) { 
          console.error("Lỗi đồng bộ dọn dẹp 8NTTT:", e); 
      }

      await loadAccountList(selectedStoreId);
      isLoading = false;
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
      const wsData = [
          ["Username", "Mật_Khẩu", "Tên_Hiển_Thị", "Giới_Tính", "Quyền_Hạn(admin/staff/pg)", "Mã_Kho"], 
          [`Tam-12234`, "123456", "Nguyễn Tâm", "Nữ", "staff", selectedStoreId||'kho']
      ];
      const ws = utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{wch: 15}, {wch: 10}, {wch: 25}, {wch: 10}, {wch: 25}, {wch: 15}];
      utils.book_append_sheet(wb, ws, "Mau_Moi");
      writeFile(wb, `Mau_Tai_Khoan_${selectedStoreId}.xlsx`);
  }

  function downloadCurrentAccounts() {
      const wb = utils.book_new();
      const wsData = [
          ["Username", "Mật_Khẩu", "Tên_Hiển_Thị", "Giới_Tính", "Quyền_Hạn(admin/staff/pg)", "Mã_Kho"]
      ];
      accountList.forEach(acc => {
          if (acc.role === 'pg') return; 
          
          let displayName = acc.name || '';
          let gender = acc.gender || '';
          let stores = acc.storeIds ? acc.storeIds.join(', ') : (acc.storeId || selectedStoreId);

          wsData.push([
              acc.username,
              "*** (Giữ nguyên)", 
              displayName,
              gender,
              acc.role,
              stores
          ]);
      });

      const ws = utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{wch: 15}, {wch: 18}, {wch: 25}, {wch: 10}, {wch: 25}, {wch: 15}];
      utils.book_append_sheet(wb, ws, "DS_Hien_Tai");
      writeFile(wb, `Cap_Nhat_Nhan_Su_${selectedStoreId}.xlsx`);
  }

  function downloadCurrentPGs() {
      const wb = utils.book_new();
      const wsData = [
          ["username", "pass", "name", "gender", "brand", "category", "ma_kho"]
      ];
      accountList.forEach(acc => {
          if (acc.role !== 'pg') return; 
          
          let displayName = acc.name || '';
          let gender = acc.gender || '';
          let stores = acc.storeIds ? acc.storeIds.join(', ') : (acc.storeId || selectedStoreId);

          wsData.push([
              acc.username,
              "*** (Giữ nguyên)", 
              displayName,
              gender,
              acc.brand || '',
              acc.category || '',
              stores
          ]);
      });

      const ws = utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{wch: 15}, {wch: 18}, {wch: 25}, {wch: 10}, {wch: 15}, {wch: 15}, {wch: 15}];
      utils.book_append_sheet(wb, ws, "DS_PG_Hien_Tai");
      writeFile(wb, `Cap_Nhat_PG_${selectedStoreId}.xlsx`);
  }

  async function handleAccountUpload(e) {
      const file = e.target.files[0];
      if (!file) return;
      isLoading = true;
      setTimeout(async () => {
          try {
              const data = await file.arrayBuffer();
              const wb = read(data);
              const json = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
              const batch = writeBatch(db);
              
              let c = 0;
              json.forEach((row, index) => {
                  let u = '', p = '', n = '', g = '', s = '', r = '';
                   
                  Object.keys(row).forEach(key => {
                      const k = key.normalize('NFC').toLowerCase().replace(/\s+/g, '_');
                      if (k.includes('user') || k.includes('tai_khoan')) u = row[key];
                      if (k.includes('pass') || k.includes('mat_khau') || k.includes('mật_khẩu')) p = row[key];
                      if (k.includes('name') || k.includes('hien_thi') || k.includes('hiển_thị')) n = row[key];
                      if (k.includes('gender') || k.includes('gioi_tinh') || k.includes('giới_tính')) g = row[key];
                      if (k.includes('kho') || k.includes('store')) s = row[key];
                      if (k.includes('role') || k.includes('quyen') || k.includes('quyền') || k.includes('quyen_han')) r = row[key];
                  });

                  if (u && s) {
                      const uid = safeString(u).toLowerCase();
                      const exactUsername = String(u).trim(); 
                      const storeArray = String(s).split(/[,;]+/).map(x=>x.trim().toUpperCase()).filter(Boolean);
                      
                      let rawRole = String(r).toLowerCase();
                      let finalRole = 'staff';
                      if (rawRole.includes('admin') || rawRole.includes('ql')) finalRole = 'admin';
                      else if (rawRole.includes('pg')) finalRole = 'pg';

                      let updatePayload = {
                          username: exactUsername, 
                          username_idx: uid,
                          role: finalRole, 
                          storeId: storeArray[0], 
                          storeIds: storeArray,
                          orderIndex: index + 1,
                          updatedAt: serverTimestamp()
                      };

                      let passStr = String(p).trim();
                      if (passStr && passStr !== '*** (Giữ nguyên)' && passStr !== '***') { updatePayload.pass = passStr; }
                      
                      if (n && String(n).trim() !== '') { updatePayload.name = String(n).trim(); }
                      if (g && String(g).trim() !== '') { updatePayload.gender = String(g).toLowerCase().includes('nam') ? 'Nam' : 'Nữ'; }

                      batch.set(doc(db, 'users', uid), updatePayload, { merge: true });
                      if (isSuperAdmin) { 
                          storeArray.forEach(k => { batch.set(doc(db, 'stores', k), { id: k, name: `Kho ${k}` }, { merge: true }); });
                      }
                      c++;
                  }
              });

              if (c > 0) { 
                  await batch.commit(); 
                  alert(`Đã cập nhật/import ${c} nhân sự. Thứ tự Excel đã được bảo lưu!`);
                  await loadAccountList(selectedStoreId); 
              }
          } catch (e) { 
              alert(e.message);
          } finally { 
              isLoading = false; 
              e.target.value = null; 
          }
      }, 100);
  }

  function downloadPGSample() {
      const wb = utils.book_new();
      const wsData = [
          ["username", "pass", "name", "gender", "brand", "category", "ma_kho"], 
          [`Nghĩa-Oppo`, "123456", "Nguyễn Trọng Nghĩa", "Nam", "Oppo", "ICT", selectedStoreId||'kho']
      ];
      const ws = utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{wch: 15}, {wch: 10}, {wch: 25}, {wch: 10}, {wch: 15}, {wch: 15}, {wch: 15}];
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
              const json = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
              const batch = writeBatch(db);
              
              let c = 0;
              json.forEach((row, index) => {
                  let u = '', p = '', n = '', g = '', s = '', brand = '', category = '';
                  
                  Object.keys(row).forEach(key => {
                      const k = key.normalize('NFC').toLowerCase().replace(/\s+/g, '_');
                      if (k.includes('user') || k.includes('tai_khoan')) u = row[key];
                      if (k.includes('pass') || k.includes('mat_khau') || k.includes('mật_khẩu')) p = row[key];
                      if (k.includes('name') || k.includes('hien_thi') || k.includes('hiển_thị')) n = row[key];
                      if (k.includes('gender') || k.includes('gioi_tinh') || k.includes('giới_tính')) g = row[key];
                      if (k.includes('kho') || k.includes('store')) s = row[key];
                      if (k.includes('brand') || k.includes('hang')) brand = row[key];
                      if (k.includes('category') || k.includes('nganh')) category = row[key];
                  });

                  if (u && s) {
                      const uid = safeString(u).toLowerCase();
                      const storeArray = String(s).split(/[,;]+/).map(x=>x.trim().toUpperCase()).filter(Boolean); 

                      let payload = {
                          username: String(u).trim(), username_idx: uid,
                          role: 'pg', 
                          storeId: storeArray[0], 
                          storeIds: storeArray,
                          brand: String(brand).trim(), category: String(category).trim(),
                          orderIndex: index + 1,
                          updatedAt: serverTimestamp()
                      };

                      let passStr = String(p).trim();
                      if (passStr && passStr !== '*** (Giữ nguyên)' && passStr !== '***') payload.pass = passStr;
                      if (n && String(n).trim() !== '') payload.name = String(n).trim();
                      if (g && String(g).trim() !== '') payload.gender = String(g).toLowerCase().includes('nam') ? 'Nam' : 'Nữ';

                      batch.set(doc(db, 'users', uid), payload, { merge: true });
                      c++;
                  }
              });

              if (c > 0) { 
                  await batch.commit(); 
                  alert(`Đã cập nhật/import ${c} PG.`); 
                  await loadAccountList(selectedStoreId);
              }
          } catch (e) { 
              alert(e.message);
          } finally { 
              isLoading = false; 
              e.target.value = null; 
          }
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
                  <p class="text-xs text-gray-500">Tổng: {filteredAccounts.length} tài khoản</p>
              </div>
          </div>
          <div class="flex gap-2 items-center">
              <button id="btn-add-user" class="text-xs font-bold text-green-600 bg-green-50 px-3 py-2.5 rounded-lg border border-green-100 flex items-center gap-1 hover:bg-green-100 transition-colors" on:click={(e) => checkDemoAndBlock(e) || (userToEdit = null, showAddUserModal = true)}>
                  <span class="material-icons-round text-sm">person_add</span> Thêm Mới
              </button>
              <button class="text-gray-400 hover:text-indigo-600 ml-1 flex items-center" on:click={() => showTour = true}><span class="material-icons-round">help_outline</span></button>
          </div>
      </div>

      <div id="upload-center" class="p-3 bg-slate-50 border-b border-slate-200 shrink-0 flex flex-col xl:flex-row gap-4">
          <div class="flex-1 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
              <h4 class="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1"><span class="material-icons-round text-blue-500 text-sm">badge</span> Khai Báo / Cập Nhật Nhân Viên</h4>
              <div class="flex gap-2">
                  <button class="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-colors" on:click={(e) => checkDemoAndBlock(e) || downloadAccountSample()}>Tải Mẫu Trắng</button>
                  <button class="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-100 transition-colors flex justify-center items-center gap-1" on:click={(e) => checkDemoAndBlock(e) || downloadCurrentAccounts()}>
                      <span class="material-icons-round text-[14px]">download</span> Tải DS Hiện Tại
                  </button>
                  <label class="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold cursor-pointer text-center hover:bg-blue-700 transition-colors shadow-sm">
                      Upload Lên <input type="file" hidden accept=".xlsx" disabled={isDemoMode} on:change={handleAccountUpload}>
                  </label>
              </div>
          </div>
          <div class="flex-1 bg-pink-50/50 p-3 rounded-lg border border-pink-200 shadow-sm">
              <h4 class="text-xs font-bold text-pink-700 mb-3 flex items-center gap-1"><span class="material-icons-round text-pink-500 text-sm">face_retouching_natural</span> Danh Sách PG</h4>
              <div class="flex gap-2">
                  <button class="flex-1 bg-pink-100 text-pink-700 py-2 rounded-lg text-xs font-bold border border-pink-200 hover:bg-pink-200 transition-colors flex justify-center items-center gap-1" on:click={(e) => checkDemoAndBlock(e) || downloadCurrentPGs()}>
                      <span class="material-icons-round text-[14px]">download</span> Tải DS Hiện Tại
                  </button>
                  <label class="flex-1 bg-pink-600 text-white py-2 rounded-lg text-xs font-bold cursor-pointer text-center hover:bg-pink-700 transition-colors shadow-sm">
                      Upload PG <input type="file" hidden accept=".xlsx" disabled={isDemoMode} on:change={handlePGUpload}>
                  </label>
              </div>
          </div>
      </div>
      
      <div class="p-3 bg-white border-b border-slate-200 shrink-0">
          <div class="relative w-full max-w-md">
              <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input type="text" bind:value={searchQuery} placeholder="Tìm theo Username hoặc Tên hiển thị..." class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 focus:bg-white transition-colors">
          </div>
      </div>

      <div id="accounts-table" class="flex-1 overflow-auto relative">
          <table class="w-full text-sm text-left border-collapse">
              <thead class="bg-slate-50 text-slate-500 font-bold sticky top-0 z-10 shadow-sm">
                  <tr>
                      <th class="p-3 border-b border-slate-200 w-1/3">Tài Khoản / Tên Hiển Thị</th>
                      <th class="p-3 border-b border-slate-200 w-1/6">Giới Tính</th>
                      <th class="p-3 border-b border-slate-200 w-1/4">Quyền Hạn</th>
                      <th class="p-3 border-b border-slate-200 text-center">Thao Tác</th>
                  </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                  {#each filteredAccounts as acc}
                      <tr class="hover:bg-indigo-50/30 transition-colors group">
                          <td class="p-3">
                              <div class="font-bold text-slate-700">{acc.username}</div>
                              {#if acc.name}
                                  <div class="text-[11px] text-gray-500">{acc.name}</div>
                              {:else}
                                  <div class="text-[10px] text-red-500 font-bold bg-red-50 inline-block px-1.5 py-0.5 rounded border border-red-200 mt-0.5 animate-pulse">Chưa có tên hiển thị</div>
                              {/if}

                              {#if acc.role === 'pg'}
                                  <div class="text-[10px] text-pink-600 font-semibold mt-0.5 bg-pink-50 inline-block px-1.5 py-0.5 rounded border border-pink-100">{acc.brand} | {acc.category}</div>
                              {/if}
                              {#if acc.storeIds && acc.storeIds.length > 1}
                                  <div class="text-[10px] text-indigo-600 font-semibold mt-0.5 bg-indigo-50 inline-block px-1.5 py-0.5 rounded border border-indigo-100" title={acc.storeIds.join(', ')}>Đa kho: {acc.storeIds.length} kho</div>
                              {/if}
                          </td>
                          <td class="p-3">
                              {#if acc.gender}
                                  <span class="font-bold {acc.gender === 'Nam' ? 'text-blue-600' : 'text-pink-600'}">{acc.gender}</span>
                              {:else}
                                  <span class="inline-block bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-200 text-[10px] font-black animate-pulse">Thiếu</span>
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
                  {#if filteredAccounts.length === 0}
                      <tr><td colspan="4" class="p-8 text-center text-gray-400">Không tìm thấy tài khoản nào phù hợp.</td></tr>
                  {/if}
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