<script>
  // Version 8.0 - [CodeGenesis] Thêm tính năng Tự Đăng Ký (Self-Registration) & Nhớ mật khẩu
  import { onMount } from 'svelte';
  import { db } from '../lib/firebase';
  import { collection, getDocs, query, where, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
  import { setUser, DEFAULT_TEMPLATE } from '../lib/stores.js';
  import { safeString, getTodayStr } from '../lib/utils.js';
  
  // --- STATE ĐĂNG NHẬP ---
  let username = '';
  let password = '';
  let showPassword = false;
  let isSuperAdminLogin = false;
  let rememberMe = false;
  
  // --- STATE ĐĂNG KÝ ---
  let isRegisterMode = false;
  let regUsername = '';
  let regPassword = '';
  let regName = '';
  let regStoreId = '';
  let regRole = 'staff';

  let errorMsg = '';
  let isLoading = false;

  const tourKey = 'taskflow_v6_general_tour_seen';

  onMount(() => {
      const savedCreds = localStorage.getItem('taskflow_saved_creds');
      if (savedCreds) {
          try {
              const parsed = JSON.parse(savedCreds);
              if (parsed.u && parsed.p) {
                  username = parsed.u;
                  password = parsed.p;
                  rememberMe = true;
              }
          } catch (e) { console.error("Lỗi đọc cache đăng nhập", e); }
      }
  });

  // --- HÀM TẠO DỮ LIỆU DEMO ---
  async function seedDemoData() {
      const demoStoreId = 'DEMO_1';
      const todayStr = getTodayStr();
      const dateObj = new Date();
      const monthStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      const batch = writeBatch(db);

      const types = ['warehouse', 'cashier'];
      types.forEach(type => {
          (DEFAULT_TEMPLATE[type] || []).forEach(tpl => {
              const cleanTitle = tpl.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
              const taskId = `${demoStoreId}_${todayStr}_${type}_${cleanTitle}`;
              batch.set(doc(db, 'tasks', taskId), {
                  title: tpl.title, timeSlot: tpl.time, isImportant: tpl.isImportant || false,
                  type: type, storeId: demoStoreId, date: todayStr, completed: false, createdBy: 'System Demo', timestamp: serverTimestamp()
              });
          });
      });

      const handovers = [ { t: "Giao chìa khóa tủ két cho ca sau", time: "12:00" }, { t: "Lưu ý: Khách VIP cọc đơn hàng #999", time: "14:30" } ];
      handovers.forEach((h, i) => {
          const hId = `${demoStoreId}_${todayStr}_handover_demo_${i}`;
          batch.set(doc(db, 'tasks', hId), { title: h.t, deadline: `${todayStr}T${h.time}`, type: 'handover', storeId: demoStoreId, date: todayStr, completed: false, createdBy: 'Quản Lý Demo', timestamp: serverTimestamp() });
      });

      const demoStaff = [
          { id: 'demo_nv1', name: 'Nguyễn Văn An', gender: 'Nam' }, { id: 'demo_nv2', name: 'Trần Thị Bích', gender: 'Nữ' },
          { id: 'demo_nv3', name: 'Lê Hoàng Cường', gender: 'Nam' }, { id: 'demo_nv4', name: 'Phạm Thu Dung', gender: 'Nữ' }, { id: 'demo_nv5', name: 'Vũ Minh Em', gender: 'Nam' }
      ];
      batch.set(doc(db, 'settings', `staff_list_${demoStoreId}`), { staffList: demoStaff, updatedAt: serverTimestamp() });

      batch.set(doc(db, 'settings', `shift_matrix_${demoStoreId}`), { genderConfig: { kho: 'mixed', tn: 'mixed' }, comboCols: ['123', '456', '23', '45', '2-5'], matrix: {}, updatedAt: serverTimestamp() });

      const daysInMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();
      const scheduleData = {};
      for (let d = 1; d <= daysInMonth; d++) {
          const dayData = demoStaff.map((s, idx) => {
              const pattern = (d + idx) % 3; 
              let shift = 'OFF', role = '';
              if (pattern === 0) { shift = '123'; role = (idx % 2 === 0) ? 'Kho' : 'Thu Ngân'; }
              else if (pattern === 1) { shift = '456'; role = (idx % 2 !== 0) ? 'Kho' : 'Thu Ngân'; }
              return { staffId: s.id, name: s.name, gender: s.gender, shift: shift, role: role, originalShift: shift, originalRole: role };
          });
          scheduleData[d] = dayData;
      }

      const stats = demoStaff.map(s => ({ id: s.id, name: s.name, gender: s.gender, totalHours: 150, gh: 5, tn: 10, kho: 10 }));
      batch.set(doc(db, 'stores', demoStoreId, 'schedules', monthStr), { data: scheduleData, stats: stats, config: { matrix: {}, approvedCombos: [] }, updatedAt: serverTimestamp() });

      try { await batch.commit(); } catch (e) { throw e; }
  }

  // --- HÀM XỬ LÝ ĐĂNG NHẬP ---
  async function handleLogin() {
    isLoading = true;
    errorMsg = 'Đang kiểm tra...';
    const cleanU = safeString(username).toLowerCase();
    const cleanP = safeString(password);

    if (cleanU === 'setup' && cleanP === 'Linh30!0') {
        setUser({ username: 'setup', name: 'System Setup', role: 'super_admin', storeIds: [], storeId: '' });
        return;
    }

    if (cleanU === 'demo' && cleanP === '123456') {
        try {
            await seedDemoData();
            localStorage.removeItem(tourKey);
            setUser({ username: 'demo', name: 'Quản Lý Demo', role: 'admin', storeIds: ['DEMO_1'], storeId: 'DEMO_1' });
            return;
        } catch(e) { 
            errorMsg = "Lỗi khởi tạo Demo: " + e.message;
            isLoading = false;
            return;
        }
    }

    try {
      const q = query(collection(db, 'users'), where('username_idx', '==', cleanU));
      const snapshot = await getDocs(q);

      if (snapshot.empty) { 
          errorMsg = 'Tài khoản không tồn tại!';
          isLoading = false; 
          return;
      }

      let foundUser = null;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (safeString(data.pass) === cleanP) {
            if (isSuperAdminLogin) {
                if (data.role === 'super_admin') foundUser = data;
            } else {
                const stores = data.storeIds || (data.storeId ? [data.storeId] : []);
                if (data.role !== 'super_admin' && stores.length > 0) {
                    foundUser = data; 
                    foundUser.storeIds = stores;
                }
            }
        }
      });

      if (foundUser) {
          if (rememberMe) { localStorage.setItem('taskflow_saved_creds', JSON.stringify({ u: username, p: password })); } 
          else { localStorage.removeItem('taskflow_saved_creds'); }
          setUser(foundUser);
      } else {
          errorMsg = isSuperAdminLogin ? 'Bạn không có quyền Super Admin!' : 'Sai mật khẩu!';
      }
    } catch (err) { errorMsg = err.message; } finally { isLoading = false; }
  }

  // --- HÀM XỬ LÝ ĐĂNG KÝ (TỰ ĐỘNG) ---
  async function handleRegister() {
      isLoading = true;
      errorMsg = 'Đang xử lý đăng ký...';

      const cleanU = safeString(regUsername).toLowerCase();
      const cleanP = safeString(regPassword).trim();
      const cleanStore = String(regStoreId).trim();
      const cleanName = String(regName).trim();

      if (!cleanU || !cleanP || !cleanStore || !cleanName) {
          errorMsg = 'Vui lòng điền đầy đủ thông tin!';
          isLoading = false; return;
      }

      // Kiểm tra chỉ cho phép nhập SỐ ở mã kho
      if (!/^\d+$/.test(cleanStore)) {
          errorMsg = 'Mã kho chỉ được phép nhập SỐ!';
          isLoading = false; return;
      }

      try {
          // 1. Kiểm tra tài khoản đã tồn tại chưa
          const qUser = query(collection(db, 'users'), where('username_idx', '==', cleanU));
          const snapUser = await getDocs(qUser);
          if (!snapUser.empty) {
              errorMsg = 'Tên đăng nhập này đã có người sử dụng!';
              isLoading = false; return;
          }

          // 2. Logic "Chủ quyền": Kiểm tra xem Kho đã có Admin chưa (Nếu chọn quyền Admin)
          if (regRole === 'admin') {
              const qAdmin = query(collection(db, 'users'), where('storeIds', 'array-contains', cleanStore), where('role', '==', 'admin'));
              const snapAdmin = await getDocs(qAdmin);
              if (!snapAdmin.empty) {
                  errorMsg = `Kho ${cleanStore} đã có Quản lý. Vui lòng chọn quyền Nhân viên hoặc liên hệ Quản lý của bạn!`;
                  isLoading = false; return;
              }
          }

          // 3. Tiến hành ghi dữ liệu
          const batch = writeBatch(db);
          
          // Tạo User
          batch.set(doc(db, 'users', cleanU), {
              username: regUsername.trim(),
              username_idx: cleanU,
              pass: cleanP,
              name: cleanName,
              role: regRole,
              storeId: cleanStore,
              storeIds: [cleanStore],
              orderIndex: 9999, // Đẩy xuống cuối danh sách cho an toàn
              createdAt: serverTimestamp()
          });

          // Ghi nhận Kho vào hệ thống để Super Admin thấy
          batch.set(doc(db, 'stores', cleanStore), {
              id: cleanStore,
              name: `Kho ${cleanStore}`,
              createdAt: serverTimestamp()
          }, { merge: true });

          await batch.commit();

          alert('🎉 Đăng ký thành công! Vui lòng đăng nhập.');
          
          // Reset form và chuyển về trang đăng nhập
          isRegisterMode = false;
          username = regUsername.trim();
          password = cleanP;
          errorMsg = '';
          
      } catch (err) {
          errorMsg = err.message;
      } finally {
          isLoading = false;
      }
  }
</script>

<div id="login-screen" class="screen">
  <div class="login-card">
    <div class="brand-logo"><span class="material-icons-round">rocket_launch</span></div>
    <h2 class="title">TaskFlow</h2>
    <p class="subtitle">{isRegisterMode ? 'Đăng ký tài khoản mới' : 'Đăng nhập hệ thống'}</p>
    
    {#if !isRegisterMode}
        <form on:submit|preventDefault={handleLogin} class="animate-fadeIn">
          
          <div class="flex items-center justify-between mb-4 gap-2 px-1">
             <label class="flex items-center gap-1.5 cursor-pointer">
                 <input type="checkbox" bind:checked={rememberMe} class="w-4 h-4 accent-purple-600 cursor-pointer rounded">
                 <span class="text-xs font-bold text-gray-500 select-none hover:text-purple-600 transition-colors">Nhớ mật khẩu</span>
             </label>
    
             <label class="flex items-center gap-1.5 cursor-pointer">
                 <span class="text-xs font-bold text-gray-500 select-none hover:text-purple-600 transition-colors">Quản trị viên</span>
                 <input type="checkbox" bind:checked={isSuperAdminLogin} class="w-4 h-4 accent-purple-600 cursor-pointer rounded">
             </label>
          </div>
    
          <div class="input-wrapper">
            <span class="material-icons-round input-icon" aria-hidden="true">person</span>
            <input class="input-field" type="text" bind:value={username} placeholder="Tên đăng nhập" required>
          </div>
    
          <div class="input-wrapper">
            <span class="material-icons-round input-icon" aria-hidden="true">lock</span>
            <input class="input-field" type={showPassword?'text':'password'} bind:value={password} placeholder="Mật khẩu" required style="padding-right:40px!important">
            <button type="button" class="eye-icon" on:click={()=>showPassword=!showPassword}>
                <span class="material-icons-round text-gray-400">{showPassword?'visibility':'visibility_off'}</span>
            </button>
          </div>
          
          <button type="submit" class="btn-grad" disabled={isLoading}>{isLoading?'...':(isSuperAdminLogin?'LOGIN ADMIN':'VÀO KHO')}</button>
          
          <div class="mt-4 flex flex-col gap-2">
              <button type="button" class="text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors underline" on:click={() => {isRegisterMode = true; errorMsg = '';}}>
                  Chưa có tài khoản? Đăng ký ngay
              </button>
          </div>

          <p class="error-msg" role="alert">{errorMsg}</p>
          
          <div class="mt-4 text-xs text-gray-400 pt-2 border-t border-dashed border-gray-200">
              Đăng nhập xem Demo : <b>demo</b>/<b>123456</b>
          </div>
        </form>

    {:else}
        <form on:submit|preventDefault={handleRegister} class="animate-fadeIn">
            
            <div class="input-wrapper">
                <span class="material-icons-round input-icon" aria-hidden="true">storefront</span>
                <input class="input-field" type="text" bind:value={regStoreId} placeholder="Mã Kho (Chỉ ghi số, VD: 908)" required>
            </div>

            <div class="input-wrapper">
                <span class="material-icons-round input-icon" aria-hidden="true">badge</span>
                <input class="input-field" type="text" bind:value={regName} placeholder="Tên hiển thị (VD: Nguyễn Văn A)" required>
            </div>

            <div class="input-wrapper">
                <span class="material-icons-round input-icon" aria-hidden="true">person_add</span>
                <input class="input-field" type="text" bind:value={regUsername} placeholder="Tên đăng nhập (viết liền không dấu)" required>
            </div>
      
            <div class="input-wrapper">
                <span class="material-icons-round input-icon" aria-hidden="true">lock</span>
                <input class="input-field" type={showPassword?'text':'password'} bind:value={regPassword} placeholder="Mật khẩu" required style="padding-right:40px!important">
                <button type="button" class="eye-icon" on:click={()=>showPassword=!showPassword}>
                    <span class="material-icons-round text-gray-400">{showPassword?'visibility':'visibility_off'}</span>
                </button>
            </div>

            <div class="input-wrapper mb-2 text-left">
                <label class="text-xs font-bold text-gray-500 ml-1 mb-1 block">Quyền hạn:</label>
                <div class="flex gap-2">
                    <label class="flex-1 flex items-center justify-center gap-1 bg-gray-50 border border-gray-200 p-2 rounded-lg cursor-pointer hover:bg-purple-50 transition-colors {regRole === 'staff' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'text-gray-600'}">
                        <input type="radio" bind:group={regRole} value="staff" class="hidden">
                        <span class="material-icons-round text-[18px]">person</span>
                        <span class="text-sm font-bold">Nhân Viên</span>
                    </label>
                    <label class="flex-1 flex items-center justify-center gap-1 bg-gray-50 border border-gray-200 p-2 rounded-lg cursor-pointer hover:bg-purple-50 transition-colors {regRole === 'admin' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'text-gray-600'}">
                        <input type="radio" bind:group={regRole} value="admin" class="hidden">
                        <span class="material-icons-round text-[18px]">admin_panel_settings</span>
                        <span class="text-sm font-bold">Quản Lý</span>
                    </label>
                </div>
            </div>
            
            <button type="submit" class="btn-grad" disabled={isLoading}>{isLoading?'Đang xử lý...':'HOÀN TẤT ĐĂNG KÝ'}</button>
            <button type="button" class="w-full mt-2 py-2 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors" disabled={isLoading} on:click={() => {isRegisterMode = false; errorMsg = '';}}>
                Quay lại đăng nhập
            </button>
            
            <p class="error-msg" role="alert">{errorMsg}</p>
        </form>
    {/if}
  </div>
</div>

<style>
  .screen { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; overflow-y: auto; padding: 20px 0; }
  .login-card { background: #fff; width: 90%; max-width: 350px; padding: 25px; border-radius: 20px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.2); margin: auto; }
  .brand-logo { width: 60px; height: 60px; margin: 0 auto 15px; background: #f3f0ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #764ba2; }
  .brand-logo span { font-size: 32px; }
  .title { margin: 0; color: #333; font-weight: 800; }
  .subtitle { margin: 5px 0 15px; color: #666; font-size: 0.9rem; }
  .input-wrapper { position: relative; margin-bottom: 15px; }
  .input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #aaa; font-size: 20px; pointer-events: none; z-index: 10; }
  .eye-icon { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; display: flex; align-items: center; padding: 5px; z-index: 20; }
  .input-field { width: 100%; padding: 12px 12px 12px 45px !important; border: 2px solid #eee; border-radius: 10px; outline: none; background: #f9f9f9; box-sizing: border-box; font-size: 1rem; appearance: none; transition: all 0.2s; }
  .input-field:focus { border-color: #667eea; background: white; }
  .btn-grad { width: 100%; padding: 12px; border: none; border-radius: 10px; background: linear-gradient(to right, #667eea, #764ba2); color: white; font-weight: 700; cursor: pointer; font-size: 1rem; margin-top: 10px; transition: opacity 0.2s; }
  .btn-grad:disabled { opacity: 0.7; cursor: not-allowed; }
  .error-msg { color: #ff4757; margin-top: 10px; font-size: 0.85rem; font-weight: bold; min-height: 20px; }
  
  .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>