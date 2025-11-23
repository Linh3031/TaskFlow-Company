<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentUser, setUser } from '../lib/stores';

  const dispatch = createEventDispatcher();
  
  let deferredPrompt;
  let showInstallBtn = false;

  // Logic PWA (Cài đặt App)
  onMount(() => {
    // 1. Android/PC
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallBtn = true;
    });

    // 2. iOS Check
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);
    if (isIos && !isInStandaloneMode) {
      showInstallBtn = true;
    }
    
    // 3. Admin luôn thấy để test
    if ($currentUser?.role === 'admin') {
      showInstallBtn = true;
    }
  });

  function handleInstall() {
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIos) {
      // Báo lên cha (App.svelte) để mở Modal hướng dẫn iOS
      dispatch('openIosGuide');
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted install');
        }
        deferredPrompt = null;
        showInstallBtn = false;
      });
    }
  }

  function handleLogout() {
    setUser(null);
    window.location.reload();
  }
</script>

<header class="app-header">
  <div class="header-left">
    <div class="user-avatar">
      {$currentUser?.name?.charAt(0).toUpperCase() || 'U'}
    </div>
    <div class="user-details">
      <span class="user-name">{$currentUser?.name || 'User'}</span>
      <span class="sync-status">● Online</span>
    </div>
  </div>
  
  <div class="header-actions">
    {#if showInstallBtn}
      <button 
        class="btn-icon install-anim" 
        on:click={handleInstall}
        aria-label="Cài đặt ứng dụng"
        title="Cài đặt App"
      >
        <span class="material-icons-round" style="color: #2196f3;">download</span>
      </button>
    {/if}

    {#if $currentUser?.role === 'admin'}
      <button 
        class="btn-icon" 
        on:click={() => dispatch('openAdmin')}
        aria-label="Cài đặt quản trị"
      >
        <span class="material-icons-round" style="color: #ff9800;">settings</span>
      </button>
    {/if}
    
    <button class="btn-icon" on:click={handleLogout} aria-label="Đăng xuất">
      <span class="material-icons-round">logout</span>
    </button>
  </div>
</header>

<style>
  .app-header { flex-shrink: 0; background: #fff; padding: 8px 15px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 5px rgba(0,0,0,0.05); z-index: 10; }
  .header-left { display: flex; align-items: center; gap: 8px; }
  .user-avatar { width: 32px; height: 32px; background: #e0e7ff; color: #4338ca; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; }
  .user-details { display: flex; flex-direction: column; justify-content: center; }
  .user-name { font-weight: 700; font-size: 0.85rem; line-height: 1.1; color: #333; }
  .sync-status { font-size: 10px; color: #4caf50; display: flex; align-items: center; gap: 3px; font-weight: bold; }
  .header-actions { display: flex; gap: 5px; align-items: center; }
  .btn-icon { background: none; border: none; color: #888; padding: 5px; cursor: pointer; display: flex; align-items: center; }
  .btn-icon span { font-size: 24px; }

  /* Animation cho nút cài đặt */
  .install-anim { animation: pulse 2s infinite; }
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.8; }
    100% { transform: scale(1); opacity: 1; }
  }
</style>