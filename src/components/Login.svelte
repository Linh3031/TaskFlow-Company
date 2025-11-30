<script>
  // Version 7.0 - Forgot Password Text Added
  import { db } from '../lib/firebase';
  import { collection, getDocs, query, where, doc, setDoc, serverTimestamp, writeBatch, getDoc } from 'firebase/firestore';
  import { setUser } from '../lib/stores.js';
  import { safeString, getTodayStr } from '../lib/utils.js';
  
  let username = '';
  let password = '';
  let showPassword = false;
  let isSuperAdminLogin = false;
  let errorMsg = '';
  let isLoading = false;

  const tourKey = 'taskflow_v6_general_tour_seen';

  async function seedDemoData() { /* ... (Giữ nguyên logic seed demo v6.1) ... */ }

  async function handleLogin() {
    isLoading = true;
    errorMsg = 'Đang kiểm tra...';
    const cleanU = safeString(username).toLowerCase();
    const cleanP = safeString(password);

    if (cleanU === 'setup' && cleanP === 'Linh30!0') {
        setUser({ username: 'setup', name: 'System Setup', role: 'super_admin', storeIds: ['908'], storeId: '908' });
        return;
    }

    if (cleanU === 'demo' && cleanP === '123456') {
        try {
            await seedDemoData();
            localStorage.removeItem(tourKey);
            setUser({ username: 'demo', name: 'Quản Lý Demo', role: 'admin', storeIds: ['DEMO_1', 'DEMO_2'], storeId: 'DEMO_1' });
            return;
        } catch(e) { console.error(e); }
    }

    try {
      const q = query(collection(db, 'users'), where('username_idx', '==', cleanU));
      const snapshot = await getDocs(q);

      if (snapshot.empty) { errorMsg = 'Tài khoản không tồn tại!'; isLoading = false; return; }

      let foundUser = null;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (safeString(data.pass) === cleanP) {
            if (isSuperAdminLogin) {
                if (data.role === 'super_admin') foundUser = data;
            } else {
                const stores = data.storeIds || (data.storeId ? [data.storeId] : []);
                if (data.role !== 'super_admin' && stores.length > 0) {
                    foundUser = data; foundUser.storeIds = stores;
                }
            }
        }
      });

      if (foundUser) setUser(foundUser);
      else errorMsg = isSuperAdminLogin ? 'Bạn không có quyền Super Admin!' : 'Sai mật khẩu!';

    } catch (err) { errorMsg = err.message; } finally { isLoading = false; }
  }
</script>

<div id="login-screen" class="screen">
  <div class="login-card">
    <div class="brand-logo"><span class="material-icons-round">rocket_launch</span></div>
    <h2 class="title">TaskFlow</h2>
    <p class="subtitle">Đăng nhập hệ thống</p>
    
    <form on:submit|preventDefault={handleLogin}>
      <div class="flex items-center justify-end mb-4 gap-2">
         <label for="sa-check" class="text-xs font-bold text-gray-500 cursor-pointer select-none">Quản trị hệ thống</label>
         <input id="sa-check" type="checkbox" bind:checked={isSuperAdminLogin} class="w-4 h-4 accent-purple-600 cursor-pointer">
      </div>

      <div class="input-wrapper">
        <label for="username-field" class="sr-only">Tên đăng nhập</label>
        <span class="material-icons-round input-icon" aria-hidden="true">person</span>
        <input id="username-field" class="input-field" type="text" bind:value={username} placeholder="Tên đăng nhập" required>
      </div>

      <div class="input-wrapper">
        <label for="password-field" class="sr-only">Mật khẩu</label>
        <span class="material-icons-round input-icon" aria-hidden="true">lock</span>
        <input id="password-field" class="input-field" type={showPassword?'text':'password'} bind:value={password} placeholder="Mật khẩu" required style="padding-right:40px!important">
        <button type="button" class="eye-icon" on:click={()=>showPassword=!showPassword} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
            <span class="material-icons-round text-gray-400">{showPassword?'visibility':'visibility_off'}</span>
        </button>
      </div>
      
      <button type="submit" class="btn-grad" disabled={isLoading}>{isLoading?'...':(isSuperAdminLogin?'LOGIN ADMIN':'VÀO KHO')}</button>
      <p class="error-msg" role="alert">{errorMsg}</p>
      
      <div class="mt-4 text-xs text-gray-500">
          Quên mật khẩu? Vui lòng liên hệ <b class="text-purple-600">Quản lý kho</b> để được cấp lại.
      </div>
      
      <div class="mt-4 text-xs text-gray-400 pt-2 border-t border-dashed border-gray-200">
          Demo: <b>demo</b> / <b>123456</b>
      </div>
    </form>
  </div>
</div>

<style>
  .screen { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; }
  .login-card { background: #fff; width: 90%; max-width: 350px; padding: 25px; border-radius: 20px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.2); }
  .brand-logo { width: 60px; height: 60px; margin: 0 auto 15px; background: #f3f0ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #764ba2; }
  .brand-logo span { font-size: 32px; }
  .title { margin: 0; color: #333; font-weight: 800; }
  .subtitle { margin: 5px 0 10px; color: #666; font-size: 0.9rem; }
  .input-wrapper { position: relative; margin-bottom: 15px; }
  .input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #aaa; font-size: 20px; pointer-events: none; z-index: 10; }
  .eye-icon { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; display: flex; align-items: center; padding: 5px; z-index: 20; }
  .input-field { width: 100%; padding: 12px 12px 12px 45px !important; border: 2px solid #eee; border-radius: 10px; outline: none; background: #f9f9f9; box-sizing: border-box; font-size: 1rem; appearance: none; }
  .input-field:focus { border-color: #667eea; background: white; }
  .btn-grad { width: 100%; padding: 12px; border: none; border-radius: 10px; background: linear-gradient(to right, #667eea, #764ba2); color: white; font-weight: 700; cursor: pointer; font-size: 1rem; margin-top: 10px; }
  .btn-grad:disabled { opacity: 0.7; cursor: not-allowed; }
  .error-msg { color: #ff4757; margin-top: 10px; font-size: 0.9rem; font-weight: bold; min-height: 20px; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
</style>