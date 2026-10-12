<script>
  // Version 16.0 - [CodeGenesis] PWA Cache Nuke & Notification Quota Shield
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { currentUser, setUser, activeStoreId, storeList } from '../lib/stores';
  import { db } from '../lib/firebase';
  import { doc, updateDoc, collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
  import NotificationDropdown from './NotificationDropdown.svelte';
  import ShiftSwapReviewModal from './ShiftScheduleParts/ShiftSwapReviewModal.svelte';
  import { markNotificationsRead } from '../lib/notificationService.js';

  const dispatch = createEventDispatcher();
  
  // --- LOGIC PWA ---
  let deferredPrompt;
  let showInstallBtn = false;
  
  onMount(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallBtn = true;
    });

    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);
    if (isIos && !isInStandaloneMode) showInstallBtn = true;
    if ($currentUser?.role?.includes('admin')) showInstallBtn = true;
  });

  function handleInstall() {
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIos) {
      dispatch('openIosGuide');
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') showInstallBtn = false;
        deferredPrompt = null;
      });
    } else {
      if (confirm("⚠️ Trình duyệt chặn cài tự động. Xem hướng dẫn cài thủ công?")) {
          alert("👉 Hướng dẫn: Bấm menu (⋮) -> Chọn 'Thêm vào màn hình chính' (Install App).");
      }
    }
  }

  // [CodeGenesis] Diệt Cache PWA Tận Gốc
  async function handleLogout() {
    if(confirm("Đăng xuất khỏi hệ thống?")) {
        setUser(null);
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            } catch (err) { console.error("Lỗi xóa cache", err); }
        }
        
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            } catch (err) { console.error("Lỗi xóa SW", err); }
        }

        // Tải lại bằng Query param để lách cache trình duyệt
        window.location.href = window.location.pathname + "?t=" + new Date().getTime();
    }
  }

  // --- LOGIC ĐỔI MẬT KHẨU ---
  let showProfileModal = false;
  let oldPass = '';
  let newPass = ''; let changePassLoading = false;

  async function handleChangePassword() {
      if (!oldPass || !newPass) return alert("Vui lòng nhập đầy đủ thông tin!");
      if (oldPass !== $currentUser.pass) return alert("Mật khẩu cũ không chính xác!");
      if (newPass.length < 6) return alert("Mật khẩu mới phải từ 6 ký tự trở lên!");

      changePassLoading = true;
      try {
          await updateDoc(doc(db, 'users', $currentUser.username_idx || String($currentUser.username).toLowerCase()), { pass: newPass });
          const updatedUser = { ...$currentUser, pass: newPass };
          setUser(updatedUser);
          alert("✅ Đổi mật khẩu thành công!");
          showProfileModal = false;
          oldPass = ''; newPass = '';
      } catch (e) { alert("Lỗi: " + e.message); } 
      finally { changePassLoading = false; }
  }

  // --- LOGIC THÔNG BÁO ---
  let notifications = [];
  let unreadCount = 0;
  let showNotifDropdown = false;
  let unsubNotif = null;
  let notifContainer;
  
  function handleWindowClick(event) {
      if (showNotifDropdown && notifContainer && !notifContainer.contains(event.target)) showNotifDropdown = false;
      if (showStoreDropdown && storeBox && !storeBox.contains(event.target)) { showStoreDropdown = false; storeQuery = ''; }
  }

  // --- LOGIC CHỌN KHO (SUPER ADMIN, GÕ ĐỂ TÌM) ---
  let storeQuery = '';
  let showStoreDropdown = false;
  let storeBox;

  // Gộp kho trong hệ thống + kho được gán cho chính user, bỏ trùng
  $: allStoreIds = [...new Set(['908', ...$storeList.map(s => String(s.id)), ...($currentUser?.storeIds || []).map(String)])];
  $: filteredStoreIds = allStoreIds.filter(id => id.toLowerCase().includes(storeQuery.trim().toLowerCase()));

  function pickStore(id) {
      $activeStoreId = id;
      storeQuery = '';
      showStoreDropdown = false;
  }

  function handleStoreKeydown(e) {
      if (e.key === 'Enter' && filteredStoreIds.length > 0) pickStore(filteredStoreIds[0]);
      else if (e.key === 'Escape') { showStoreDropdown = false; storeQuery = ''; }
  }

  function forwardJump(event) {
      dispatch('jumpToTask', event.detail);
      showNotifDropdown = false;
  }

  // --- PHIẾU ĐỔI CA (mở từ thông báo) ---
  let swapRequestId = null;
  function openSwapRequest(event) {
      swapRequestId = event.detail.requestId;
      showNotifDropdown = false;
  }

  async function handleMarkAllRead() {
      const ids = [...notifications.filter(n => !n.isRead).map(n => n.id), ...unreadIds];
      try { await markNotificationsRead(ids); } catch (e) { console.error(e); }
  }

  // Bấm chuông lần đầu thì xin quyền hiện thông báo hệ thống (trình duyệt bắt buộc phải do người dùng bấm)
  function toggleNotifDropdown() {
      showNotifDropdown = !showNotifDropdown;
      if ('Notification' in window && Notification.permission === 'default') {
          try { Notification.requestPermission(); } catch (e) { /* trình duyệt cũ */ }
      }
  }

  // Chuông lắc 1 nhịp khi có thông báo MỚI (không lắc mãi)
  let isRinging = false;
  let ringTimer;
  function ringBell() {
      isRinging = true;
      clearTimeout(ringTimer);
      ringTimer = setTimeout(() => isRinging = false, 1500);
  }

  // App đang chạy nền (đổi tab/ẩn app) thì hiện thông báo hệ thống. Tắt hẳn app thì không nhận được.
  async function showSystemNotification(notif) {
      if (document.visibilityState !== 'hidden') return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const title = 'TaskFlow - Thông báo mới';
      const options = { body: `${notif.fromUser || ''} ${notif.content || ''}`.trim(), icon: '/logo.jpeg', tag: notif.id };
      try {
          const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
          if (reg) await reg.showNotification(title, options);
          else new Notification(title, options);
      } catch (e) { console.warn('Không hiện được thông báo hệ thống:', e); }
  }

 // [CodeGenesis] Khiên bảo vệ Quota Firebase (Đã sửa lỗi Vòng lặp vô tận)
  let activeNotifUser = null; // Biến cờ hiệu để chặn Svelte chạy lại

  $: if ($currentUser && $currentUser.username && $currentUser.username !== activeNotifUser) {
      activeNotifUser = $currentUser.username;
      setupNotificationListener(activeNotifUser);
  }

  // Đếm chưa đọc RIÊNG (không bị giới hạn 20 thông báo mới nhất). Lỗi thì quay về đếm trong danh sách.
  let unsubUnread = null;
  let unreadIds = [];
  let unreadQueryOk = false;
  $: unreadCount = unreadQueryOk ? unreadIds.length : notifications.filter(n => !n.isRead).length;

  function setupNotificationListener(username) {
      if (unsubNotif) { unsubNotif(); unsubNotif = null; }
      if (unsubUnread) { unsubUnread(); unsubUnread = null; }
      unreadQueryOk = false; unreadIds = [];

      const userVariants = [...new Set([username, username.toLowerCase()])];

      unsubUnread = onSnapshot(
          query(collection(db, 'notifications'), where('toUser', 'in', userVariants), where('isRead', '==', false), limit(50)),
          (snapshot) => { unreadIds = snapshot.docs.map(d => d.id); unreadQueryOk = true; },
          (error) => { console.error("⚠️ Firebase Error (đếm chưa đọc): ", error.message); unreadQueryOk = false; }
      );
      let isFirstSnapshot = true;
      const q = query(
          collection(db, 'notifications'), 
          where('toUser', 'in', userVariants),
          orderBy('createdAt', 'desc'),
          limit(20) // VẪN GIỮ CHỐT CHẶN CỨU MẠNG QUOTA!
      );
      
      // Chuông báo động mới: Nó sẽ chỉ kêu ĐÚNG 1 LẦN!
      console.warn("✅ ĐÃ FIX LỖI AN TOÀN: Chỉ gọi Firebase 1 lần duy nhất cho: " + username);
      
      unsubNotif = onSnapshot(q, (snapshot) => {
          notifications = snapshot.docs.map(d => ({id: d.id, ...d.data()}));

          // Lần tải đầu là thông báo cũ -> bỏ qua. Sau đó có thông báo chưa đọc mới thì lắc chuông + báo hệ thống
          if (!isFirstSnapshot) {
              const fresh = snapshot.docChanges().filter(c => c.type === 'added' && !c.doc.data().isRead);
              if (fresh.length > 0) {
                  ringBell();
                  fresh.forEach(c => showSystemNotification({ id: c.doc.id, ...c.doc.data() }));
              }
          }
          isFirstSnapshot = false;
      }, (error) => {
          console.error("⚠️ Firebase Error: ", error.message);
      });
  }

  onDestroy(() => { if (unsubNotif) unsubNotif(); if (unsubUnread) unsubUnread(); clearTimeout(ringTimer); });
</script>

<svelte:window on:click={handleWindowClick} />

<header class="app-header bg-white shadow-sm px-4 py-3 flex justify-between items-center z-50 shrink-0 sticky top-0">
  <button class="flex items-center gap-3 hover:bg-gray-50 p-1 rounded-lg transition-colors text-left max-w-[40%]" on:click={() => showProfileModal = true}>
    <div class="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm border border-indigo-200 shadow-sm shrink-0">
      {$currentUser?.name?.charAt(0).toUpperCase() || 'U'}
    </div>
    <div class="flex flex-col justify-center overflow-hidden">
      <span class="font-bold text-gray-800 text-sm leading-tight truncate w-full">{$currentUser?.name || 'User'}</span>
      <span class="text-[10px] font-bold text-green-600 flex items-center gap-1">
        <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Online
      </span>
    </div>
  </button>
  
  <div class="flex items-center gap-2 relative">
    
    {#if $currentUser?.role === 'super_admin'}
        <div id="store-selector-tour" class="relative mr-1" bind:this={storeBox}>
            <input
                type="text"
                inputmode="numeric"
                bind:value={storeQuery}
                on:focus={() => showStoreDropdown = true}
                on:input={() => showStoreDropdown = true}
                on:keydown={handleStoreKeydown}
                placeholder={$activeStoreId === '908' ? 'Kho 908' : $activeStoreId}
                class="w-24 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold py-1.5 pl-3 pr-7 rounded-lg text-sm outline-none cursor-pointer shadow-sm placeholder:text-indigo-700 focus:placeholder:text-indigo-300"
            />
            <span class="material-icons-round absolute right-1.5 top-1/2 -translate-y-1/2 text-indigo-400 text-sm pointer-events-none">{showStoreDropdown ? 'search' : 'expand_more'}</span>
            {#if showStoreDropdown}
                <div class="absolute right-0 top-full mt-1 w-32 max-h-60 overflow-y-auto overflow-x-hidden bg-white border border-indigo-100 rounded-lg shadow-lg z-50">
                    {#each filteredStoreIds as id (id)}
                        <button
                            type="button"
                            on:click={() => pickStore(id)}
                            class="w-full text-left px-3 py-1.5 text-sm truncate hover:bg-indigo-50 {id === $activeStoreId ? 'text-indigo-700 font-bold bg-indigo-50' : 'text-slate-700'}"
                        >{id === '908' ? 'Kho 908' : id}</button>
                    {:else}
                        <div class="px-3 py-2 text-xs text-slate-400">Không tìm thấy kho</div>
                    {/each}
                </div>
            {/if}
        </div>
    {:else if ($currentUser?.storeIds || []).length > 1}
        <div id="store-selector-tour" class="relative mr-1">
            <select bind:value={$activeStoreId} class="appearance-none bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold py-1.5 pl-3 pr-7 rounded-lg text-sm outline-none cursor-pointer shadow-sm">
                {#each $currentUser.storeIds as s}
                    <option value={s}>{s}</option>
                {/each}
            </select>
            <span class="material-icons-round absolute right-1.5 top-1/2 -translate-y-1/2 text-indigo-400 text-sm pointer-events-none">expand_more</span>
        </div>
    {/if}

    {#if showInstallBtn}
      <button 
        id="btn-install"
        class="w-8 h-8 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors animate-bounce border border-blue-200" 
        on:click={handleInstall} title="Cài đặt App"
      >
        <span class="material-icons-round text-xl">download</span>
      </button>
    {/if}

    <div class="relative" bind:this={notifContainer}>
        <button 
            id="btn-notif"
            class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-all {isRinging ? 'animate-wiggle' : ''}"
            on:click={toggleNotifDropdown} title="Thông báo"
        >
            <span class="material-icons-round text-xl">notifications</span>
            {#if unreadCount > 0}
                <span class="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            {/if}
        </button>
        {#if showNotifDropdown}
            <NotificationDropdown {notifications} on:close={() => showNotifDropdown = false} on:jumpToTask={forwardJump} on:openSwapRequest={openSwapRequest} on:markAllRead={handleMarkAllRead} />
        {/if}
    </div>

    {#if $currentUser?.role === 'admin' || $currentUser?.role === 'super_admin'}
      <button 
        id="btn-admin"
        class="w-8 h-8 flex items-center justify-center text-orange-500 bg-orange-50 hover:bg-orange-100 rounded-full transition-colors" 
        on:click={() => dispatch('openAdmin')} title="Cài đặt"
      >
        <span class="material-icons-round text-xl">settings</span>
      </button>
    {/if}
  </div>
</header>

{#if swapRequestId}
    <ShiftSwapReviewModal requestId={swapRequestId} on:close={() => swapRequestId = null} />
{/if}

{#if showProfileModal}
<div class="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => showProfileModal = false}>
    <div class="bg-white w-full max-w-xs rounded-2xl p-5 shadow-2xl animate-popIn" on:click|stopPropagation>
        <div class="text-center mb-4">
            <div class="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl font-bold border-2 border-indigo-200">
                {$currentUser?.name?.charAt(0).toUpperCase()}
            </div>
            <h3 class="font-bold text-lg text-slate-800">{$currentUser?.name}</h3>
            <p class="text-xs text-gray-500">{$currentUser?.username}</p>
        </div>
        
        <div class="space-y-3">
            <div class="pt-2 border-t border-dashed border-slate-200">
                <h4 class="text-xs font-bold text-slate-400 uppercase mb-2">Đổi mật khẩu</h4>
                <div>
                    <input type="password" bind:value={oldPass} placeholder="Mật khẩu cũ" class="w-full mb-2 p-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-sm">
                </div>
                <div>
                    <input type="password" bind:value={newPass} placeholder="Mật khẩu mới (6+ ký tự)" class="w-full mb-2 p-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-sm">
                </div>
                <button class="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl shadow hover:bg-indigo-700 disabled:opacity-50 text-sm" on:click={handleChangePassword} disabled={changePassLoading}>
                    {changePassLoading ? 'Đang lưu...' : 'Xác nhận đổi'}
                </button>
            </div>

            <button class="w-full py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 flex items-center justify-center gap-2 mt-4 text-sm" on:click={handleLogout}>
                <span class="material-icons-round text-lg">logout</span> Đăng Xuất
            </button>
        </div>
    </div>
</div>
{/if}

<style>
    .animate-popIn { animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); } 
    @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    @keyframes wiggle { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(10deg); } 75% { transform: rotate(-10deg); } }
    .animate-wiggle { animation: wiggle 0.5s ease-in-out infinite; }
</style>