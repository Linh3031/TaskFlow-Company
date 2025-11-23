<script>
  import { db } from '../lib/firebase';
  import { collection, getDocs, query, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';
  import { setUser } from '../lib/stores.js';
  import { safeString } from '../lib/utils.js';

  let username = '';
  let password = '';
  let showPassword = false;
  let isSuperAdminLogin = false;
  let errorMsg = '';
  let isLoading = false;

  async function handleLogin() {
    isLoading = true; errorMsg = 'Đang kiểm tra...';
    const cleanU = safeString(username).toLowerCase();
    const cleanP = safeString(password);

    // BACKDOOR
    if (cleanU === 'setup' && cleanP === '123456') {
        try {
            await setDoc(doc(db, 'users', 'admin'), {
                username: 'admin', username_idx: 'admin', pass: '123456', name: 'Super Admin', 
                role: 'super_admin', storeIds: [], createdAt: serverTimestamp()
            });
            alert("✅ Đã tạo User: admin / 123456"); username = 'admin'; password = '123456'; isSuperAdminLogin = true; handleLogin(); return;
        } catch (e) { alert(e.message); isLoading = false; return; }
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
                // User thường: Kiểm tra xem có kho nào để vào không
                // Hỗ trợ cả trường cũ storeId (string) và trường mới storeIds (array)
                const stores = data.storeIds || (data.storeId ? [data.storeId] : []);
                if (data.role !== 'super_admin' && stores.length > 0) {
                    foundUser = data;
                    // Chuẩn hóa dữ liệu ngay khi login
                    foundUser.storeIds = stores;
                }
            }
        }
      });

      if (foundUser) setUser(foundUser);
      else errorMsg = isSuperAdminLogin ? 'Bạn không có quyền Super Admin!' : 'Sai mật khẩu hoặc Tài khoản chưa được gán kho!';

    } catch (err) { console.error(err); errorMsg = err.message; } 
    finally { isLoading = false; }
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
        <span class="material-icons-round input-icon">person</span>
        <input class="input-field" type="text" bind:value={username} placeholder="Tên đăng nhập" required>
      </div>

      <div class="input-wrapper">
        <span class="material-icons-round input-icon">lock</span>
        <input class="input-field" type={showPassword?'text':'password'} bind:value={password} placeholder="Mật khẩu" required style="padding-right:40px!important">
        <button type="button" class="eye-icon" on:click={()=>showPassword=!showPassword}>
            <span class="material-icons-round text-gray-400">{showPassword?'visibility':'visibility_off'}</span>
        </button>
      </div>
      
      <button type="submit" class="btn-grad" disabled={isLoading}>{isLoading?'...':(isSuperAdminLogin?'LOGIN ADMIN':'VÀO KHO')}</button>
      <p class="error-msg">{errorMsg}</p>
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
</style>