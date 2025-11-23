<script>
  import { db } from '../lib/firebase';
  import { collection, getDocs, query, where, writeBatch, doc, deleteDoc } from 'firebase/firestore';
  import { setUser, DEFAULT_TEMPLATE, taskTemplate } from '../lib/stores.js';
  import { safeString, getTodayStr } from '../lib/utils.js';

  let username = '';
  let password = '';
  let errorMsg = '';
  let isLoading = false;

  async function handleLogin() {
    isLoading = true;
    errorMsg = 'Đang kiểm tra...';
    const cleanU = safeString(username).toLowerCase();
    const cleanP = safeString(password);

    try {
      // 1. LOGIC RESET CỨU HỘ (Giữ nguyên tính năng quan trọng này)
      if (cleanU === 'reset' && cleanP === '123456') {
        if (confirm("⚠ RESET TOÀN BỘ HÔM NAY? (Xóa Template & Task)")) {
          // Xóa Template
          await deleteDoc(doc(db, 'settings', 'template'));
          
          // Xóa Task hôm nay
          const today = getTodayStr();
          const q = query(collection(db, 'tasks'), where('date', '==', today));
          const snapshot = await getDocs(q);
          const batch = writeBatch(db);
          snapshot.forEach(d => batch.delete(d.ref));
          await batch.commit();

          alert("✅ Đã Reset! Hãy đăng nhập Admin để khởi tạo lại.");
          window.location.reload();
        }
        isLoading = false;
        return;
      }

      // 2. ĐĂNG NHẬP THƯỜNG (Firestore)
      const q = query(collection(db, 'users'), where('username_idx', '==', cleanU));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        errorMsg = 'Tài khoản không tồn tại!';
        isLoading = false;
        return;
      }

      let foundUser = null;
      snapshot.forEach(doc => {
        if (safeString(doc.data().pass) === cleanP) foundUser = doc.data();
      });

      if (foundUser) {
        setUser(foundUser); // Cập nhật Store -> App tự chuyển màn hình
      } else {
        errorMsg = 'Sai mật khẩu!';
      }

    } catch (err) {
      console.error(err);
      errorMsg = 'Lỗi kết nối: ' + err.message;
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

    <h2>Xin chào!</h2>
    <p>Check List công việc 908</p>
    
    <form on:submit|preventDefault={handleLogin}>
      <div class="input-wrapper">
        <span class="material-icons-round input-icon">person</span>
        <input 
          type="text" 
          bind:value={username} 
          placeholder="Tên đăng nhập" 
          required 
          autocomplete="username"
          aria-label="Tên đăng nhập"
        >
      </div>
      <div class="input-wrapper">
        <span class="material-icons-round input-icon">lock</span>
        <input 
          type="password" 
          bind:value={password} 
          placeholder="Mật khẩu" 
          required 
          autocomplete="current-password"
          aria-label="Mật khẩu"
        >
      </div>
      
      <button type="submit" class="btn-grad" disabled={isLoading}>
        {isLoading ? 'ĐANG XỬ LÝ...' : 'VÀO CA'}
      </button>
      
      <p class="error-msg">{errorMsg}</p>
      
      <div class="login-signature">Design by 3031</div>
    </form>
  </div>
</div>

<style>
  /* CSS cô lập chỉ dành cho Login */
  .screen { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; }
  .login-card { background: #fff; width: 85%; max-width: 350px; padding: 25px; border-radius: 20px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.2); }
  .brand-logo { width: 60px; height: 60px; margin: 0 auto 15px; background: #f3f0ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #764ba2; }
  .brand-logo span { font-size: 32px; }
  .input-wrapper { position: relative; margin-bottom: 15px; }
  .input-icon { position: absolute; left: 12px; top: 12px; color: #aaa; }
  input { width: 100%; padding: 12px 12px 12px 40px; border: 2px solid #eee; border-radius: 10px; outline: none; background: #f9f9f9; box-sizing: border-box; }
  .btn-grad { width: 100%; padding: 12px; border: none; border-radius: 10px; background: linear-gradient(to right, #667eea, #764ba2); color: white; font-weight: 700; cursor: pointer; }
  .btn-grad:disabled { opacity: 0.7; cursor: not-allowed; }
  .error-msg { color: #ff4757; font-size: 0.8rem; margin-top: 10px; min-height: 20px; }
  .login-signature { margin-top: 15px; color: #888; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.5px; }
  h2 { margin: 0 0 5px; color: #333; }
  p { margin: 0 0 20px; color: #666; }
</style>