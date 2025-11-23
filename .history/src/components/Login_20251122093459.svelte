<script>
  import { db } from '../lib/firebase';
  import { collection, getDocs, query, where, writeBatch, doc, deleteDoc } from 'firebase/firestore';
  import { setUser } from '../lib/stores.js';
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
      if (cleanU === 'reset' && cleanP === '123456') {
        if (confirm("⚠ RESET TOÀN BỘ HÔM NAY?")) {
          await deleteDoc(doc(db, 'settings', 'template'));
          const today = getTodayStr();
          const q = query(collection(db, 'tasks'), where('date', '==', today));
          const snapshot = await getDocs(q);
          const batch = writeBatch(db);
          snapshot.forEach(d => batch.delete(d.ref));
          await batch.commit();
          alert("✅ Đã Reset!");
          window.location.reload();
        }
        isLoading = false; return;
      }

      const q = query(collection(db, 'users'), where('username_idx', '==', cleanU));
      const snapshot = await getDocs(q);

      if (snapshot.empty) { errorMsg = 'Tài khoản không tồn tại!'; isLoading = false; return; }

      let foundUser = null;
      snapshot.forEach(doc => { if (safeString(doc.data().pass) === cleanP) foundUser = doc.data(); });

      if (foundUser) { setUser(foundUser); } else { errorMsg = 'Sai mật khẩu!'; }

    } catch (err) { console.error(err); errorMsg = 'Lỗi: ' + err.message; } finally { isLoading = false; }
  }
</script>

<div id="login-screen" class="screen">
  <div class="login-card">
    <div class="brand-logo">
      <span class="material-icons-round">rocket_launch</span>
    </div>

    <h2 style="margin:0; color:#333">Xin chào!</h2>
    <p style="margin:5px 0 20px; color:#666">Check List công việc 908</p>
    
    <form on:submit|preventDefault={handleLogin}>
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
          type="password" 
          bind:value={password} 
          placeholder="Mật khẩu" 
          required 
          autocomplete="current-password"
        >
      </div>
      
      <button type="submit" class="btn-grad" disabled={isLoading}>
        {isLoading ? '...' : 'VÀO CA'}
      </button>
      
      <p class="error-msg">{errorMsg}</p>
      <div class="login-signature">Design by 3031</div>
    </form>
  </div>
</div>