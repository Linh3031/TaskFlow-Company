<script>
  import { db } from '../lib/firebase';
  import { collection, getDocs, query, where, doc, setDoc, serverTimestamp, writeBatch, getDoc } from 'firebase/firestore';
  import { setUser } from '../lib/stores.js';
  import { safeString, getTodayStr } from '../lib/utils.js';
  // Import logic thật để sinh dữ liệu Demo xịn
  import { generateMonthlySchedule, calculateShiftModes } from '../lib/scheduleLogic';

  let username = '';
  let password = '';
  let showPassword = false;
  let isSuperAdminLogin = false;
  let errorMsg = '';
  let isLoading = false;

  // --- LOGIC SEED DATA (TẠO DỮ LIỆU DEMO NHƯ THẬT) ---
  async function seedDemoData() {
      const demoStoreId = 'DEMO';
      const batch = writeBatch(db);
      
      // 1. Kiểm tra xem đã có dữ liệu chưa
      const checkRef = doc(db, 'settings', `template_${demoStoreId}`);
      const checkSnap = await getDoc(checkRef);
      if (checkSnap.exists()) return; // Đã có thì thôi

      console.log("⏳ Đang khởi tạo dữ liệu Demo Chất Lượng Cao...");

      // 2. Tạo 10 Nhân Sự Ảo
      const demoStaff = [
          { u: 'nv_a', n: 'Nguyễn Văn An', g: 'Nam' }, { u: 'nv_b', n: 'Trần Thị Bình', g: 'Nữ' },
          { u: 'nv_c', n: 'Lê Văn Cường', g: 'Nam' }, { u: 'nv_d', n: 'Phạm Thị Dung', g: 'Nữ' },
          { u: 'nv_e', n: 'Hoàng Văn Em', g: 'Nam' }, { u: 'nv_f', n: 'Vũ Thị Hoa', g: 'Nữ' },
          { u: 'nv_g', n: 'Đặng Văn Giang', g: 'Nam' }, { u: 'nv_h', n: 'Bùi Thị Huệ', g: 'Nữ' },
          { u: 'nv_i', n: 'Ngô Văn Ích', g: 'Nam' }, { u: 'nv_k', n: 'Dương Thị Kim', g: 'Nữ' }
      ];

      // Tạo User Login giả
      demoStaff.forEach(s => {
          const userRef = doc(db, 'users', s.u);
          batch.set(userRef, {
              username: s.u, username_idx: s.u, pass: '123', name: s.n, gender: s.g,
              role: 'staff', storeIds: [demoStoreId]
          });
      });

      // Lưu danh sách nhân viên vào settings
      batch.set(doc(db, 'settings', `staff_list_${demoStoreId}`), {
          staffList: demoStaff.map(s => ({ id: s.u, name: s.n, gender: s.g })),
          updatedAt: serverTimestamp()
      });

      // 3. Tạo Việc Mẫu (Template)
      batch.set(doc(db, 'settings', `template_${demoStoreId}`), {
          warehouse: [
              { time: '08:00', title: 'Kiểm tra hàng nhập đầu ngày', isImportant: true },
              { time: '17:00', title: 'Vệ sinh kho bãi & Sắp xếp kệ', isImportant: false }
          ],
          cashier: [
              { time: '08:00', title: 'Kiểm quỹ đầu ca & Vệ sinh quầy', isImportant: true },
              { time: '14:00', title: 'Nộp tiền doanh thu sáng', isImportant: false },
              { time: '21:30', title: 'Chốt ca & In báo cáo', isImportant: true }
          ]
      });

      // 4. Tạo Task Thực Tế
      const today = getTodayStr();
      const tasks = [
          { type: 'warehouse', time: '08:00', title: 'Kiểm tra hàng nhập đầu ngày', imp: true, comp: true },
          { type: 'warehouse', time: '17:00', title: 'Vệ sinh kho bãi', imp: false, comp: false },
          { type: 'cashier', time: '08:00', title: 'Kiểm quỹ đầu ca', imp: true, comp: true },
          { type: 'cashier', time: '21:30', title: 'Chốt ca', imp: true, comp: false },
          { type: 'handover', time: '22:00', title: 'Giao chìa khóa kho cho bảo vệ', imp: true, comp: false, deadline: new Date().toISOString() }
      ];

      tasks.forEach(t => {
          const tRef = doc(collection(db, 'tasks'));
          batch.set(tRef, {
              type: t.type, title: t.title, timeSlot: t.time || '00:00', completed: t.comp,
              isImportant: t.imp, createdBy: 'System', date: today, storeId: demoStoreId,
              deadline: t.deadline || null, timestamp: serverTimestamp(),
              completedBy: t.comp ? 'Nguyễn Văn An' : null, time: t.comp ? '08:15' : null
          });
      });

      // 5. TẠO LỊCH PHÂN CA THẬT (3 Tháng liên tiếp)
      // Sử dụng chính thuật toán generateMonthlySchedule để lịch Demo nhìn xịn như thật
      const demoStaffList = demoStaff.map(s => ({ id: s.u, name: s.n, gender: s.g }));
      
      // Cấu hình giả lập
      const demoInputs = { c1: 1, c2: 3, c3: 2, c4: 2, c5: 3, c6: 1, gh: 1 }; // Tổng ~13 slots cho 10 người
      const computedShifts = calculateShiftModes(demoInputs, demoStaffList.length);
      const demoRoleConfig = { tn: 2, kho: 2 };

      const now = new Date();
      let prevScheduleData = null; // Dữ liệu tháng trước để nối

      // Tạo ngược từ T-2 đến T (Để tháng T là mới nhất)
      // Logic loop: i=2 (T-2), i=1 (T-1), i=0 (T)
      const monthsToGen = [];
      for (let i = 2; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthsToGen.push({ m: d.getMonth() + 1, y: d.getFullYear() });
      }

      for (const t of monthsToGen) {
          const result = generateMonthlySchedule(
              demoStaffList, 
              computedShifts, 
              demoRoleConfig, 
              t.m, t.y, 
              prevScheduleData // Nối tiếp tháng trước
          );

          const mStr = `${t.y}-${String(t.m).padStart(2, '0')}`;
          
          // Lưu lịch vào batch
          const schedDoc = doc(db, 'stores', demoStoreId, 'schedules', mStr);
          batch.set(schedDoc, {
              config: { 
                  shiftInputs: [
                      { id: 'c1', label: 'Ca 1', time: '08:00-09:00', qty: 1 },
                      { id: 'c2', label: 'Ca 2', time: '09:00-12:00', qty: 3 },
                      { id: 'c3', label: 'Ca 3', time: '12:00-15:00', qty: 2 },
                      { id: 'c4', label: 'Ca 4', time: '15:00-18:00', qty: 2 },
                      { id: 'c5', label: 'Ca 5', time: '18:00-21:00', qty: 3 },
                      { id: 'c6', label: 'Ca 6', time: '21:00-21:30', qty: 1 }
                  ],
                  roleConfig: demoRoleConfig, 
                  computed: computedShifts 
              },
              data: result.schedule,
              stats: result.staffStats.map(s => ({id: s.id, name: s.name, ...s.stats})),
              endOffset: result.endOffset,
              updatedAt: serverTimestamp(),
              updatedBy: 'System'
          });

          // Cập nhật prevData cho vòng lặp sau
          prevScheduleData = {
              endOffset: result.endOffset,
              stats: result.staffStats.map(s => ({id: s.id, ...s.stats}))
          };
      }
      
      // Lưu config Demo để lần sau load lại
      batch.set(doc(db, 'settings', `shift_config_${demoStoreId}`), {
          shiftInputs: [
              { id: 'c1', label: 'Ca 1 (Sáng)', time: '08:00 - 09:00', qty: 1 },
              { id: 'c2', label: 'Ca 2 (Sáng)', time: '09:00 - 12:00', qty: 3 },
              { id: 'c3', label: 'Ca 3 (Trưa)', time: '12:00 - 15:00', qty: 2 },
              { id: 'c4', label: 'Ca 4 (Chiều)', time: '15:00 - 18:00', qty: 2 },
              { id: 'c5', label: 'Ca 5 (Tối)', time: '18:00 - 21:00', qty: 3 },
              { id: 'c6', label: 'Ca 6 (Đêm)', time: '21:00 - 21:30', qty: 1 }
          ],
          roleConfig: demoRoleConfig,
          ghQty: 1,
          updatedAt: serverTimestamp()
      });

      await batch.commit();
      console.log("✅ Đã bơm dữ liệu Demo Xịn thành công!");
  }

  // --- LOGIN HANDLER ---
  async function handleLogin() {
    isLoading = true; errorMsg = 'Đang kiểm tra...';
    const cleanU = safeString(username).toLowerCase();
    const cleanP = safeString(password);

    // XỬ LÝ ĐĂNG NHẬP DEMO
    if (cleanU === 'demo' && cleanP === '123456') {
        try {
            await seedDemoData();
            
            // CẤP QUYỀN ADMIN CHO DEMO (Để trải nghiệm full tính năng)
            const demoUser = {
                username: 'demo', name: 'Quản Lý Demo',
                role: 'admin', // Role thật để mở khóa tính năng
                storeIds: ['DEMO'], storeId: 'DEMO'
            };
            setUser(demoUser);
            return; 
        } catch (e) {
            console.error(e);
            errorMsg = "Lỗi khởi tạo Demo: " + e.message;
            isLoading = false;
            return;
        }
    }

    // LOGIN THƯỜNG
    if (cleanU === 'setup' && cleanP === 'Linh30!0') {
        try {
            await setDoc(doc(db, 'users', 'admin'), {
                username: 'admin', username_idx: 'admin', pass: 'Linh30!0', name: 'Super Admin', 
                role: 'super_admin', storeIds: [], createdAt: serverTimestamp()
            });
            alert("✅ Đã tạo User: admin / Linh30!0"); username = 'admin'; password = '123456'; isSuperAdminLogin = true; handleLogin(); return;
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
                const stores = data.storeIds || (data.storeId ? [data.storeId] : []);
                if (data.role !== 'super_admin' && stores.length > 0) {
                    foundUser = data;
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
      
      <div class="mt-4 text-xs text-gray-400">
          TK Demo: <b>demo</b> / <b>123456</b> (Full Quyền)
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
</style>