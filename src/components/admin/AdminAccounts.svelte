<script>
  import { db } from '../../lib/firebase';
  import { query, collection, getDocs, doc, setDoc, getDoc, deleteDoc, where } from 'firebase/firestore';
  import { getTodayStr } from '../../lib/utils';
  import { onMount } from 'svelte';
  import { accountService } from '../../services/accountService';
  import { currentUser } from '../../lib/stores';

  import StoreSidebar from './accounts/StoreSidebar.svelte';
  import AccountControlBar from './accounts/AccountControlBar.svelte';
  import ExcelManager from './accounts/ExcelManager.svelte';
  import AccountTable from './accounts/AccountTable.svelte';
  import AdminAddUserModal from './accounts/AdminAddUserModal.svelte';
  import TourGuide from '../TourGuide.svelte';
  
  export let targetStore = '';
  export let isSuperAdmin = false;
  
  $: activeSuperAdmin = isSuperAdmin || ($currentUser?.username === 'linh-3031');
  
  let storeList = [];
  let selectedStoreId = '';
  let accountList = [];
  let isLoading = false;
  let targetStoreInput = '';
  let showAddUserModal = false;
  let userToEdit = null;

  let systemMode = 'STORE'; 
  let roleTab = 'ALL';      
  let searchQuery = '';
  let showImportExport = false;
  let storeCountMap = {};   

  $: filteredAccounts = accountList.filter(acc => {
      if (roleTab !== 'ALL' && acc.role !== roleTab) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return acc.username.toLowerCase().includes(q) || (acc.name && acc.name.toLowerCase().includes(q));
  });

  let showTour = false;
  const tourSteps = [ { target: '#btn-add-user', title: '1. Tạo Admin Kho Mới', content: 'Thêm tài khoản.' } ];
  $: isDemoMode = (selectedStoreId || targetStore)?.includes('DEMO');

  let hasInitialized = false;
  $: if ($currentUser && !hasInitialized) {
      hasInitialized = true;
      if (activeSuperAdmin) { fetchAllStores(); } 
      else { selectedStoreId = targetStore; loadAccountList(targetStore); }
  }

  $: if (!activeSuperAdmin && targetStore && targetStore !== selectedStoreId) {
      selectedStoreId = targetStore;
      loadAccountList(targetStore);
  }

  function checkDemoAndBlock(e) {
      if (isDemoMode) { e && e.preventDefault(); e && e.stopPropagation(); alert("Tài khoản demo không có tính năng này!"); return true; }
      return false;
  }

  async function fetchAllStores() {
      isLoading = true;
      try {
          const q = query(collection(db, 'stores'));
          const snap = await getDocs(q);
          storeList = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => a.id.localeCompare(b.id));

          const uSnap = await getDocs(collection(db, 'users'));
          const allUsers = uSnap.docs.map(d => d.data());
          const counts = {};
          allUsers.forEach(u => {
              const sids = u.storeIds || (u.storeId ? [u.storeId] : []);
              sids.forEach(sid => counts[sid] = (counts[sid] || 0) + 1);
          });
          storeCountMap = counts;

          if (storeList.length > 0 && !selectedStoreId && systemMode === 'STORE') { selectStore(storeList[0].id); }
      } catch (e) { console.error("Lỗi tải danh sách kho:", e); }
      isLoading = false;
  }

  function selectStore(sid) {
      selectedStoreId = sid;
      loadAccountList(sid);
  }

  function setSystemMode(mode) {
      systemMode = mode;
      if (mode === 'ALL') { selectedStoreId = 'ALL'; loadAccountList('ALL'); } 
      else { if (storeList.length > 0) selectStore(storeList[0].id); }
  }

  async function loadAccountList(sid) {
      if (!sid) return;
      isLoading = true;
      try {
          if (sid === 'ALL') {
              const snap = await getDocs(collection(db, 'users'));
              accountList = snap.docs.map(d => ({id: d.id, ...d.data()}));
          } else {
              accountList = await accountService.loadAccountList(sid);
          }
      } catch(e) { console.error("Lỗi fetch DB, fallback:", e); }
      isLoading = false;
  }

  // [SURGICAL FIX] Thêm biến skipConfirm để chạy Xóa hàng loạt không bị spam Hỏi
  async function deleteAccount(uid, skipConfirm = false) {
      if (!skipConfirm && (checkDemoAndBlock() || !confirm(`Xóa tài khoản ${uid}?`))) return;
      if (!skipConfirm) isLoading = true;
      
      await accountService.deleteAccount(uid);
      try {
          const actualStoreId = selectedStoreId === 'ALL' ? targetStore : selectedStoreId; 
          const templateRef = doc(db, 'stores', actualStoreId, '8nttt_template', 'config');
          const dailyRef = doc(db, '8nttt_daily_records', `${actualStoreId}_${getTodayStr()}`);
          const [tplSnap, dailySnap] = await Promise.all([getDoc(templateRef), getDoc(dailyRef)]);
          
          if (tplSnap.exists()) {
              let items = tplSnap.data().items || [];
              let changed = false;
              items = items.map(item => {
                  if (item.assignees && item.assignees.some(a => a.id === uid)) { changed = true; return { ...item, assignees: item.assignees.filter(a => a.id !== uid) }; }
                  return item;
              });
              if (changed) await setDoc(templateRef, { items }, { merge: true });
          }
          if (dailySnap.exists()) {
              let items = dailySnap.data().items || [];
              let changed = false;
              items = items.map(item => {
                  if (item.assignees && item.assignees.some(a => a.id === uid)) { changed = true; return { ...item, assignees: item.assignees.filter(a => a.id !== uid) }; }
                  return item;
              });
              if (changed) await setDoc(dailyRef, { items }, { merge: true });
          }
      } catch(e) { console.error("Lỗi đồng bộ dọn dẹp 8NTTT:", e); }

      if (!skipConfirm) {
          await loadAccountList(selectedStoreId);
          isLoading = false;
      }
  }

  // [NEW] Logic Hủy Diệt Mã Kho và User bên trong
  async function handleDeleteStore(storeId) {
      if (checkDemoAndBlock()) return;
      
      // Quét tìm tất cả nhân sự thuộc kho này trong Database (không chỉ accountList đang hiển thị)
      isLoading = true;
      let usersToDelete = [];
      try {
          const snap = await getDocs(query(collection(db, 'users'), where('storeIds', 'array-contains', storeId)));
          usersToDelete = snap.docs.map(d => ({id: d.id, ...d.data()}));
      } catch(e) {
          alert("Lỗi quét dữ liệu: " + e.message); isLoading = false; return;
      }
      isLoading = false;

      if (!confirm(`⚠️ CẢNH BÁO ĐỎ: BẠN ĐANG XÓA MÃ KHO [${storeId}]!\n\nHành động này sẽ XÓA VĨNH VIỄN mã kho và TOÀN BỘ ${usersToDelete.length} NHÂN SỰ trực thuộc kho này khỏi hệ thống.\n\nKhông thể khôi phục. Bạn có chắc chắn muốn tiếp tục?`)) return;

      isLoading = true;
      try {
          // 1. Dùng vòng lặp gọi deleteAccount (skipConfirm = true) để dọn dẹp từng User an toàn
          for (const u of usersToDelete) {
              await deleteAccount(u.id, true);
          }
          // 2. Tiêu diệt Document của kho trong collection 'stores'
          await deleteDoc(doc(db, 'stores', storeId));

          alert(`✅ Đã xóa thành công kho ${storeId} và ${usersToDelete.length} tài khoản.`);
          await fetchAllStores();
          if (selectedStoreId === storeId) setSystemMode('ALL');
      } catch(e) {
          alert("Lỗi quá trình xóa: " + e.message);
      }
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

</script>

<div class="h-full flex flex-col md:flex-row gap-4 animate-fadeIn overflow-hidden" style="height: calc(100vh - 140px);">
  
  {#if activeSuperAdmin && systemMode === 'STORE'}
      <StoreSidebar {storeList} {selectedStoreId} {storeCountMap} on:select={(e) => selectStore(e.detail)} on:deleteStore={(e) => handleDeleteStore(e.detail)} />
  {/if}

  <div class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
      
      {#if activeSuperAdmin}
      <div class="flex bg-slate-100 p-1 shrink-0 border-b border-slate-200 z-20">
          <button class="flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 {systemMode === 'STORE' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}" on:click={() => setSystemMode('STORE')}><span class="material-icons-round text-sm">view_list</span> Quản lý theo Kho</button>
          <button class="flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 {systemMode === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}" on:click={() => setSystemMode('ALL')}><span class="material-icons-round text-sm">public</span> Toàn Hệ Thống</button>
      </div>
      {/if}

      <div class="p-3 border-b border-slate-100 flex justify-between items-center bg-white z-10 shrink-0">
          <div class="flex items-center gap-2">
              <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  {systemMode === 'ALL' ? 'ALL' : (selectedStoreId ? selectedStoreId.substring(0,2).toUpperCase() : '?')}
              </div>
              <div>
                  <h3 class="font-bold text-slate-800">{systemMode === 'ALL' ? 'Danh Sách Tổng' : `Nhân sự Kho ${selectedStoreId || '...'}`}</h3>
                  <p class="text-xs text-gray-500">Đang hiển thị: {filteredAccounts.length} tài khoản</p>
              </div>
          </div>
          <div class="flex gap-2 items-center">
              <button id="btn-import" class="text-xs font-bold px-3 py-2.5 rounded-lg border flex items-center gap-1 transition-colors {showImportExport ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-inner' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}" on:click={() => showImportExport = !showImportExport}>
                  <span class="material-icons-round text-sm">swap_vert</span> Dữ Liệu Excel
              </button>
              <button id="btn-add-user" class="text-xs font-bold text-green-600 bg-green-50 px-3 py-2.5 rounded-lg border border-green-100 flex items-center gap-1 hover:bg-green-100 transition-colors shadow-sm" on:click={(e) => checkDemoAndBlock(e) || (userToEdit = null, showAddUserModal = true)}>
                  <span class="material-icons-round text-sm">person_add</span> Thêm Mới
              </button>
              <button class="text-gray-400 hover:text-indigo-600 ml-1 flex items-center" on:click={() => showTour = true}><span class="material-icons-round">help_outline</span></button>
          </div>
      </div>

      {#if showImportExport}
          <ExcelManager {selectedStoreId} {accountList} {isDemoMode} {activeSuperAdmin} on:loading={(e) => isLoading = e.detail} on:reload={() => { if (activeSuperAdmin) fetchAllStores(); loadAccountList(selectedStoreId); }} />
      {/if}
      
      <AccountControlBar bind:roleTab bind:searchQuery />

      <AccountTable {filteredAccounts} {activeSuperAdmin} 
          on:edit={(e) => { userToEdit = e.detail; showAddUserModal = true; }} 
          on:resetPass={(e) => resetPassword(e.detail)} 
          on:delete={(e) => deleteAccount(e.detail)} 
          on:changeRole={(e) => changeRole(e.detail.id, e.detail.role)} 
      />
  </div>
</div>

<AdminAddUserModal 
    bind:show={showAddUserModal} 
    isSuperAdmin={activeSuperAdmin} 
    {selectedStoreId} 
    bind:targetStoreInput 
    editUser={userToEdit}
    on:close={() => { showAddUserModal = false; userToEdit = null; }}
    on:success={(e) => { 
        showAddUserModal = false; userToEdit = null; 
        if(activeSuperAdmin) fetchAllStores().then(() => selectStore(e.detail)); 
        else loadAccountList(selectedStoreId); 
    }}
/>

{#if showTour} <TourGuide steps={tourSteps} on:complete={() => showTour = false} /> {/if}

{#if isLoading}
  <div class="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-[60]">
      <div class="animate-spin text-indigo-600 bg-white p-3 rounded-xl shadow-lg border border-indigo-100"><span class="material-icons-round text-3xl">sync</span></div>
  </div>
{/if}