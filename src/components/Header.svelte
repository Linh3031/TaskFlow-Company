<script>
  // Version 7.0 - Change Password Feature (User Self-Service)
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentUser, setUser } from '../lib/stores';
  import { db } from '../lib/firebase';
  import { doc, updateDoc } from 'firebase/firestore';

  const dispatch = createEventDispatcher();
  
  // LOGIC PWA
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

  // --- LOGIC ĐỔI MẬT KHẨU ---
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
          // Cập nhật trên Firebase
          await updateDoc(doc(db, 'users', $currentUser.username), {
              pass: newPass
          });

          // Cập nhật Local Store
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
</script>

<header class="app-header bg-white shadow-sm px-4 py-3 flex justify-between items-center z-10 shrink-0 sticky top-0">
  <button class="flex items-center gap-3 hover:bg-gray-50 p-1 rounded-lg transition-colors text-left" on:click={() => showProfileModal = true}>
    <div class="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm border border-indigo-200 shadow-sm">
      {$currentUser?.name?.charAt(0).toUpperCase() || 'U'}
    </div>
    <div class="flex flex-col justify-center">
      <span class="font-bold text-gray-800 text-sm leading-tight">{$currentUser?.name || 'User'}</span>
      <span class="text-[10px] font-bold text-green-600 flex items-center gap-1">
        <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Online
      </span>
    </div>
  </button>
  
  <div class="flex items-center gap-2">
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
    
    <button 
      class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" 
      on:click={handleLogout} 
      title="Đăng xuất"
    >
      <span class="material-icons-round text-xl">logout</span>
    </button>
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
            <div>
                <label class="text-xs font-bold text-slate-500 uppercase">Mật khẩu cũ</label>
                <input type="password" bind:value={oldPass} class="w-full mt-1 p-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-sm">
            </div>
            <div>
                <label class="text-xs font-bold text-slate-500 uppercase">Mật khẩu mới</label>
                <input type="password" bind:value={newPass} class="w-full mt-1 p-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-sm">
            </div>
            <button class="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 mt-2 disabled:opacity-50" on:click={handleChangePassword} disabled={changePassLoading}>
                {changePassLoading ? 'Đang lưu...' : 'Đổi Mật Khẩu'}
            </button>
        </div>
    </div>
</div>
{/if}

<style>
    .animate-popIn { animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); } 
    @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>