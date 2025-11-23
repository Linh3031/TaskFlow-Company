<script>
  import { onMount } from 'svelte'; // Thêm onMount
  import { db } from '../lib/firebase';
  import { collection, getDocs, query, where, writeBatch, doc, deleteDoc } from 'firebase/firestore';
  import { setUser } from '../lib/stores.js';
  import { safeString, getTodayStr } from '../lib/utils.js';

  let username = '';
  let password = '';
  let errorMsg = '';
  let isLoading = false;
  
  // --- DIAGNOSTIC LOG (KIỂM TRA LỖI) ---
  onMount(() => {
    setTimeout(() => {
      console.log('%c--- KIỂM TRA FONT ---', 'background: #222; color: #bada55; font-size:16px');
      
      // 1. Kiểm tra Font đã được trình duyệt tải chưa
      const fontCheck = document.fonts.check('1em "Material Icons Round"');
      console.log('Trạng thái tải Font "Material Icons Round":', fontCheck ? '✅ ĐÃ TẢI' : '❌ CHƯA TẢI (Lỗi mạng hoặc sai tên)');

      // 2. Kiểm tra phần tử thực tế
      const iconEl = document.querySelector('.material-icons-round');
      if (iconEl) {
        const styles = window.getComputedStyle(iconEl);
        console.log('Font-Family đang áp dụng:', styles.fontFamily);
        console.log('Font-Feature-Settings:', styles.fontFeatureSettings);
        
        if (!styles.fontFamily.includes('Material Icons Round')) {
            console.error('⚠️ CẢNH BÁO: Class CSS chưa ăn vào phần tử!');
        }
      }
    }, 1000); // Đợi 1s để đảm bảo render xong
  });

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

    <h2 class="title">Xin chào!</h2>
    <p class="subtitle">Check List công việc 908</p>
    
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

<style>
  /* Xóa bớt CSS trong này để dùng CSS chuẩn từ app.css */
  .screen { 
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; 
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
    display: flex; align-items: center; justify-content: center; 
  }
  .login-card { 
    background: #fff; width: 85%; max-width: 350px; padding: 25px; 
    border-radius: 20px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.2); 
  }
  .brand-logo { 
    width: 60px; height: 60px; margin: 0 auto 15px; background: #f3f0ff; 
    border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #764ba2; 
  }
  .brand-logo span { font-size: 32px; }
  
  .title { margin: 0; color: #333; font-weight: 800; }
  .subtitle { margin: 5px 0 20px; color: #666; font-size: 0.9rem; }

  .input-wrapper { position: relative; margin-bottom: 15px; }
  
  .input-icon { 
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%); 
    color: #aaa; font-size: 20px; pointer-events: none; z-index: 1;
  }
  
  .input-field { 
    width: 100%; 
    padding: 12px 12px 12px 45px !important; 
    border: 2px solid #eee; border-radius: 10px; outline: none; 
    background: #f9f9f9; box-sizing: border-box; font-size: 1rem; 
  }
  .input-field:focus { border-color: #667eea; background: white; }

  .btn-grad { 
    width: 100%; padding: 12px; border: none; border-radius: 10px; 
    background: linear-gradient(to right, #667eea, #764ba2); 
    color: white; font-weight: 700; cursor: pointer; font-size: 1rem; margin-top: 10px;
  }
  .btn-grad:disabled { opacity: 0.7; cursor: not-allowed; }

  .login-signature { margin-top: 20px; color: #bbb; font-size: 0.75rem; font-weight: 700; }
  .error-msg { color: #ff4757; margin-top: 10px; font-size: 0.9rem; font-weight: bold; min-height: 20px;}
</style>