<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentUser, setUser } from '../lib/stores';

  const dispatch = createEventDispatcher();
  
  // LOGIC PWA
  let deferredPrompt;
  let showInstallBtn = false;

  onMount(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallBtn = true;
      console.log("✅ PWA Ready: Event fired");
    });

    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);
    
    // iOS: Luôn hiện nếu chưa cài
    if (isIos && !isInStandaloneMode) {
      showInstallBtn = true;
    }
    
    // Admin: Luôn hiện nút để test bất chấp trạng thái
    if ($currentUser?.role?.includes('admin')) {
      showInstallBtn = true;
    }
  });

  function handleInstall() {
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    
    if (isIos) {
      dispatch('openIosGuide');
    } else if (deferredPrompt) {
      // TRƯỜNG HỢP 1: Trình duyệt cho phép cài (Lần đầu hoặc đã Clear cache)
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        // Không ẩn nút ngay, để người dùng có thể bấm lại nếu lỡ tay hủy
        if (choiceResult.outcome === 'accepted') {
            showInstallBtn = false; // Chỉ ẩn khi đã chấp nhận cài
        }
        deferredPrompt = null; // Sự kiện chỉ dùng được 1 lần, phải reload mới có lại
      });
    } else {
      // TRƯỜNG HỢP 2: Trình duyệt chặn (Do vừa xóa App hoặc Cache cũ)
      // Thay vì báo lỗi, ta hướng dẫn cách "Ép cài"
      if (confirm("⚠️ Trình duyệt đang chặn Popup cài đặt tự động (do bạn vừa xóa App).\n\nBạn có muốn xem cách cài đặt thủ công không?")) {
          alert("👉 Hướng dẫn Cài lại:\n\n1. Bấm vào dấu 3 chấm (⋮) ở góc phải trên trình duyệt Chrome.\n2. Chọn dòng 'Cài đặt ứng dụng' (Install App) hoặc 'Thêm vào màn hình chính'.\n\n(Nếu không thấy, hãy Xóa lịch sử duyệt web và thử lại)");
      }
    }
  }

  function handleLogout() {
    setUser(null);
    window.location.reload();
  }
</script>

<header class="app-header bg-white shadow-sm px-4 py-3 flex justify-between items-center z-10 shrink-0 sticky top-0">
  <div class="flex items-center gap-3">
    <div class="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm border border-indigo-200 shadow-sm">
      {$currentUser?.name?.charAt(0).toUpperCase() || 'U'}
    </div>
    <div class="flex flex-col justify-center">
      <span class="font-bold text-gray-800 text-sm leading-tight">{$currentUser?.name || 'User'}</span>
      <span class="text-[10px] font-bold text-green-600 flex items-center gap-1">
        <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Online
      </span>
    </div>
  </div>
  
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