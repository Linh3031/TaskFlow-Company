<script>
  // Version 11.1 - FULL CODE (Restored Profile Logic + Fixes)
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { currentUser, setUser } from '../lib/stores';
  import { db } from '../lib/firebase';
  import { doc, updateDoc, collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
  import NotificationDropdown from './NotificationDropdown.svelte';
  
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
    
    if (isIos && !isInStandaloneMode) {
      showInstallBtn = true;
    }
    if ($currentUser?.role?.includes('admin')) {
      showInstallBtn = true;
    }
  });

  function handleInstall() {
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIos) {
      dispatch('openIosGuide');
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            showInstallBtn = false;
        }
        deferredPrompt = null;
      });
    } else {
      if (confirm("⚠️ Trình duyệt chặn cài tự động. Xem hướng dẫn cài thủ công?")) {
          alert("👉 Hướng dẫn: Bấm menu (⋮) -> Chọn 'Thêm vào màn hình chính' (Install App).");
      }
    }
  }

  function handleLogout() {
    if(confirm("Đăng xuất khỏi hệ thống?")) {
        setUser(null);
        window.location.reload();
    }
  }

  // --- LOGIC ĐỔI MẬT KHẨU (Đã khôi phục đầy đủ) ---
  let showProfileModal = false;
  let oldPass = '';
  let newPass = '';
  let changePassLoading = false;

  async function handleChangePassword() {
      if (!oldPass || !newPass) return alert("Vui lòng nhập đầy đủ thông tin!");
      if (oldPass !== $currentUser.pass) return alert("Mật khẩu cũ không chính xác!");
      if (newPass.length < 6) return alert("Mật khẩu mới phải từ 6 ký tự trở lên!");

      changePassLoading = true;
      try {
          await updateDoc(doc(db, 'users', $currentUser.username), { pass: newPass });
          const updatedUser = { ...$currentUser, pass: newPass };
          setUser(updatedUser);
          alert("✅ Đổi mật khẩu thành công!");
          showProfileModal = false;
          oldPass = ''; newPass = '';
      } catch (e) { 
          alert("Lỗi: " + e.message); 
      } finally { 
          changePassLoading = false;
      }
  }

  // --- LOGIC THÔNG BÁO (Tối ưu Performance & Fix Leak) ---
  let notifications = [];
  let unreadCount = 0;
  let showNotifDropdown = false;
  let unsubNotif = null; // Khởi tạo null để quản lý state
  let notifContainer;

  // Hàm xử lý click ra ngoài để đóng dropdown
  function handleWindowClick(event) {
      if (showNotifDropdown && notifContainer && !notifContainer.contains(event.target)) {
          showNotifDropdown = false;
      }
  }

  // Chuyển tiếp sự kiện nhảy tới task từ Dropdown lên App
  function forwardJump(event) {
      dispatch('jumpToTask', event.detail);
      showNotifDropdown = false;
  }

  // Reactive Statement: Quản lý kết nối Firebase an toàn
  $: if ($currentUser) {
      // 1. Dọn dẹp listener cũ nếu có (Quan trọng để tránh đơ máy)
      if (unsubNotif) {
          unsubNotif();
          unsubNotif = null;
      }

      // 2. Tạo biến thể tên user (Hoa/Thường) để bắt mọi thông báo
      const username = $currentUser.username;
      const userVariants = [...new Set([username, username.toLowerCase()])];
      
      const q = query(
          collection(db, 'notifications'), 
          where('toUser', 'in', userVariants),
          orderBy('createdAt', 'desc'),
          limit(20)
      );
      
      // 3. Khởi tạo listener mới
      unsubNotif = onSnapshot(q, (snapshot) => {
          notifications = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
          unreadCount = notifications.filter(n => !n.isRead).length;
      }, (error) => {
          console.error("Lỗi tải thông báo:", error);
          if (error.message.includes("indexes")) {
              console.log("%c👇 BẤM VÀO ĐÂY TẠO INDEX 👇", "color: red; font-size: 16px; font-weight: bold;");
              // Link index sẽ hiện trong console trình duyệt
          }
      });
  }

  // Dọn dẹp khi component bị hủy
  onDestroy(() => {
      if (unsubNotif) unsubNotif();
  });
</script>

<svelte:window on:click={handleWindowClick} />

<header class="app-header bg-white shadow-sm px-4 py-3 flex justify-between items-center z-50 shrink-0 sticky top-0">
  <button class="flex items-center gap-3 hover:bg-gray-50 p-1 rounded-lg transition-colors text-left max-w-[50%]" on:click={() => showProfileModal = true}>
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
    {#if showInstallBtn}
      <button 
        id="btn-install"
        class="w-8 h-8 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors animate-bounce border border-blue-200" 
        on:click={handleInstall}
        title="Cài đặt App"
      >
        <span class="material-icons-round text-xl">download</span>
      </button>
    {/if}

    <button 
      id="btn-help"
      class="w-8 h-8 flex items-center justify-center text-purple-500 bg-purple-50 hover:bg-purple-100 rounded-full transition-colors" 
      on:click={() => dispatch('openTour')} 
      title="Xem hướng dẫn"
    >
      <span class="material-icons-round text-xl">help_outline</span>
    </button>

    <div class="relative" bind:this={notifContainer}>
        <button 
            id="btn-notif"
            class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-all {unreadCount > 0 ? 'animate-wiggle' : ''}" 
            on:click={() => showNotifDropdown = !showNotifDropdown} 
            title="Thông báo"
        >
            <span class="material-icons-round text-xl">notifications</span>
            {#if unreadCount > 0}
                <span class="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            {/if}
        </button>
        {#if showNotifDropdown}
            <NotificationDropdown {notifications} on:close={() => showNotifDropdown = false} on:jumpToTask={forwardJump} />
        {/if}
    </div>

    {#if $currentUser?.role === 'admin' || $currentUser?.role === 'super_admin'}
      <button 
        id="btn-admin"
        class="w-8 h-8 flex items-center justify-center text-orange-500 bg-orange-50 hover:bg-orange-100 rounded-full transition-colors" 
        on:click={() => dispatch('openAdmin')} 
        title="Cài đặt"
      >
        <span class="material-icons-round text-xl">settings</span>
      </button>
    {/if}
  </div>
</header>

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