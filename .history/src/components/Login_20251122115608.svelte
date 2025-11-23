// Version 3.0 - Login Multi-Store & Show Password
<script>
  import { onMount } from 'svelte';
  import { db } from '../lib/firebase';
  import { collection, getDocs, query, where } from 'firebase/firestore';
  import { setUser } from '../lib/stores.js';
  import { safeString } from '../lib/utils.js';

  let storeCode = ''; // Mã kho
  let username = '';
  let password = '';
  let showPassword = false; // Trạng thái ẩn/hiện pass
  let errorMsg = '';
  let isLoading = false;

  async function handleLogin() {
    isLoading = true;
    errorMsg = 'Đang kiểm tra...';
    
    const cleanStore = safeString(storeCode).toUpperCase(); // Mã kho viết hoa
    const cleanU = safeString(username).toLowerCase();
    const cleanP = safeString(password);

    if(!cleanStore) { errorMsg = 'Vui lòng nhập Mã Kho!'; isLoading = false; return; }

    try {
      // 1. Tìm user theo tên đăng nhập
      const q = query(collection(db, 'users'), where('username_idx', '==', cleanU));
      const snapshot = await getDocs(q);

      if (snapshot.empty) { 
        errorMsg = 'Tài khoản không tồn tại!'; 
        isLoading = false; return; 
      }

      let foundUser = null;
      
      // 2. Kiểm tra mật khẩu VÀ Mã Kho
      snapshot.forEach(doc => { 
        const data = doc.data();
        // Logic cũ: check pass
        if (safeString(data.pass) === cleanP) {
            // Logic MỚI: Check xem user này có thuộc kho đang nhập không?
            // Nếu user là Super Admin thì cho qua mọi kho
            const userStore = safeString(data.storeId).toUpperCase();
            if (data.role === 'super_admin' || userStore === cleanStore) {
                foundUser = data;
                // Nếu là super admin đăng nhập vào kho cụ thể, gán tạm storeId đó để view dữ liệu
                if(data.role === 'super_admin') foundUser.storeId = cleanStore;
            }
        }
      });

      if (foundUser) { 
        setUser(foundUser); 
      } else { 
        // Nếu tìm thấy user nhưng sai pass hoặc sai kho
        errorMsg = 'Sai mật khẩu hoặc Tài khoản không thuộc kho này!'; 
      }

    } catch (err) { 
        console.error(err); errorMsg = 'Lỗi: ' + err.message; 
    } finally { 
        isLoading = false; 
    }
  }
</script>

<div id="login-screen" class="screen">
  <div class="login-card">
    <div class="brand-logo">
      <span class="material-icons-round">rocket_launch</span>
    </div>

    <h2 class="title">TaskFlow</h2>
    <p class="subtitle">Đăng nhập hệ thống</p>
    
    <form on:submit|preventDefault={handleLogin}>
      
      <div class="input-wrapper">
        <span class="material-icons-round input-icon">store</span>
        <input 
          class="input-field"
          type="text" 
          bind:value={storeCode} 
          placeholder="Mã Kho (VD: 908, KHO1...)" 
          required 
          autocomplete="off"
        >
      </div>

      <div class="input-wrapper">
        <span class="material-icons-round input-icon">person</span>
        <input 
          class="input-field"
          type="text" 
          bind:value={username} 
          placeholder="Tên đăng nhập" 
          required 
          autocomplete="username"
        >
      </div>

      <div class="input-wrapper">
        <span class="material-icons-round input-icon">lock</span>
        <input 
          class="input-field"
          type={showPassword ? 'text' : 'password'} 
          bind:value={password} 
          placeholder="Mật khẩu" 
          required 
          autocomplete="current-password"
          style="padding-right: 40px !important;" 
        >
        <button 
            type="button"
            class="eye-icon"
            on:click={() => showPassword = !showPassword}
            tabindex="-1"
        >
            <span class="material-icons-round text-gray-400">
                {showPassword ? 'visibility' : 'visibility_off'}
            </span>
        </button>
      </div>
      
      <button type="submit" class="btn-grad" disabled={isLoading}>
        {isLoading ? '...' : 'VÀO KHO'}
      </button>
      
      <p class="error-msg">{errorMsg}</p>
    </form>
  </div>
</div>

<style>
  /* Giữ nguyên CSS cũ và thêm class cho icon mắt */
  .screen { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; }
  .login-card { background: #fff; width: 85%; max-width: 350px; padding: 25px; border-radius: 20px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.2); }
  .brand-logo { width: 60px; height: 60px; margin: 0 auto 15px; background: #f3f0ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #764ba2; }
  .brand-logo span { font-size: 32px; }
  .title { margin: 0; color: #333; font-weight: 800; }
  .subtitle { margin: 5px 0 20px; color: #666; font-size: 0.9rem; }
  
  .input-wrapper { position: relative; margin-bottom: 15px; }
  .input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #aaa; font-size: 20px; pointer-events: none; z-index: 10; }
  
  /* Style cho nút Mắt */
  .eye-icon {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 5px;
  }

  .input-field { width: 100%; padding: 12px 12px 12px 45px !important; border: 2px solid #eee; border-radius: 10px; outline: none; background: #f9f9f9; box-sizing: border-box; font-size: 1rem; }
  .input-field:focus { border-color: #667eea; background: white; }
  .btn-grad { width: 100%; padding: 12px; border: none; border-radius: 10px; background: linear-gradient(to right, #667eea, #764ba2); color: white; font-weight: 700; cursor: pointer; font-size: 1rem; margin-top: 10px; }
  .btn-grad:disabled { opacity: 0.7; cursor: not-allowed; }
  .error-msg { color: #ff4757; margin-top: 10px; font-size: 0.9rem; font-weight: bold; min-height: 20px;}
</style>