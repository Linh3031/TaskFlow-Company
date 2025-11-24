<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { read, utils } from 'xlsx';
  import { db } from '../lib/firebase';
  import { 
    collection, doc, setDoc, writeBatch, addDoc, serverTimestamp, 
    onSnapshot, deleteDoc, updateDoc, query, where, getDocs, getDoc
  } from 'firebase/firestore';
  import { taskTemplate, currentUser, storeList } from '../lib/stores';
  import { safeString, getTodayStr } from '../lib/utils';
  import { generateMonthlySchedule, calculateShiftModes } from '../lib/scheduleLogic';
  import TourGuide from './TourGuide.svelte';

  const dispatch = createEventDispatcher();
  // VARIABLES
  $: isSuperAdmin = $currentUser?.role === 'super_admin';
  $: myStoreId = $currentUser?.storeId;
  $: myStores = $currentUser?.storeIds || [];
  // STATE
  let saTab = 'store';
  let newStoreId='', newStoreName='', newAdminUser='', newAdminPass='', selectedStoresForAdmin=[], allUsers=[], isEditingUser=false, editingUser=null, editSelectedStores=[];
  let activeType = 'warehouse';
  let newTime = '08:00', newTaskTitle = '', isImportant = false, isUploading = false, editingIndex = -1;
  let authorizedUserCount = 0;

  // STATE PHÂN CA
  let scheduleStaffList = [];
  let shiftInputs = [
      { id: 'c1', label: 'Ca 1 (Sáng)', time: '08:00 - 09:00', qty: 6 },
      { id: 'c2', label: 'Ca 2 (Sáng)', time: '09:00 - 12:00', qty: 15 },
      { id: 'c3', label: 'Ca 3 (Trưa)', time: '12:00 - 15:00', qty: 12 },
      { id: 'c4', label: 'Ca 4 (Chiều)', time: '15:00 - 18:00', qty: 12 },
      { id: 'c5', label: 'Ca 5 (Tối)', time: '18:00 - 21:00', qty: 15 },
      { id: 'c6', label: 'Ca 6 (Đêm)', time: '21:00 - 21:30', qty: 6 }
  ];
  let ghQty = 1;
  let roleConfig = { tn: 4, kho: 4 };
  let scheduleMonth = new Date().getMonth() + 1;
  let scheduleYear = new Date().getFullYear();

  // TOUR GUIDE
  let showAdminTour = false;
  const adminTourKey = 'taskflow_admin_tour_seen_v7'; // Bump version
  const adminSteps = [
      { target: '.admin-header', title: 'Khu Vực Quản Trị', content: 'Nơi cấu hình toàn bộ hoạt động cho kho.' },
      { target: '#section-upload', title: '1. Cấp Quyền App', content: 'Upload danh sách nhân viên để tạo tài khoản đăng nhập.' },
      { target: '#section-template', title: '2. Việc Mẫu', content: 'Tạo các đầu việc checklist cố định hàng ngày.' },
      // Sửa lại target ID vào header để hiển thị đẹp hơn
      { target: '#section-schedule-header', title: '3. Phân Ca Tự Động', content: 'Upload nhân sự riêng, cấu hình định biên và tạo lịch công bằng tại đây.' },
      { target: '#btn-help-admin', title: 'Hỗ Trợ', content: 'Bấm nút này để xem lại hướng dẫn bất cứ lúc nào.' }
  ];

  // INIT
  onMount(async () => {
    let unsubUsers = () => {};
    if (isSuperAdmin) {
        unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
            const users = []; snap.forEach(d => users.push({ id: d.id, ...d.data() }));
            allUsers = users.sort((a, b) => (a.role === 'admin' ? -1 : 1));
        });
    } else { countAuthorizedUsers(); }
    await loadSavedData();

    if (!localStorage.getItem(adminTourKey)) {
        setTimeout(() => showAdminTour = true, 800);
    }
    return () => unsubUsers();
  });
  
  async function countAuthorizedUsers() { const targetStore = myStores[0]; if (!targetStore) return;
    try { const q = query(collection(db, 'users'), where('storeIds', 'array-contains', targetStore)); const snap = await getDocs(q); authorizedUserCount = snap.size;
    } catch (e) { console.error(e); } }
  async function loadSavedData() { const targetStore = myStores[0]; if (!targetStore) return;
    try { const configSnap = await getDoc(doc(db, 'settings', `shift_config_${targetStore}`)); if (configSnap.exists()) { const data = configSnap.data();
    if (data.shiftInputs) shiftInputs = data.shiftInputs; if (data.roleConfig) roleConfig = data.roleConfig; if (data.ghQty !== undefined) ghQty = data.ghQty;
    } const staffSnap = await getDoc(doc(db, 'settings', `staff_list_${targetStore}`)); if (staffSnap.exists() && staffSnap.data().staffList) { scheduleStaffList = staffSnap.data().staffList;
    } } catch (e) { console.error(e); } }
  async function saveShiftConfig(isSilent = false) { const targetStore = myStores[0];
    if (!targetStore) return; try { await setDoc(doc(db, 'settings', `shift_config_${targetStore}`), { shiftInputs, roleConfig, ghQty, updatedAt: serverTimestamp(), updatedBy: $currentUser.username });
    if (!isSilent) alert("✅ Đã lưu cấu hình!"); } catch (e) { if (!isSilent) alert("Lỗi: " + e.message);
    } }
  async function saveStaffList() { const targetStore = myStores[0]; if (!targetStore || scheduleStaffList.length === 0) return;
    try { await setDoc(doc(db, 'settings', `staff_list_${targetStore}`), { staffList: scheduleStaffList, updatedAt: serverTimestamp() }); } catch (e) { console.error(e);
    } }

  async function createStore() { if (!newStoreId || !newStoreName) return alert("Thiếu thông tin");
    try { await setDoc(doc(db, 'stores', newStoreId.trim().toUpperCase()), { name: newStoreName.trim(), createdAt: serverTimestamp() }); alert("✅ Đã tạo kho!"); newStoreId=''; newStoreName='';
    } catch(e){ alert(e.message); } }
  async function createAdminAccount() { if (!newAdminUser || !newAdminPass || selectedStoresForAdmin.length===0) return alert("Thiếu thông tin");
    try { await setDoc(doc(db, 'users', newAdminUser.trim().toLowerCase()), { username: newAdminUser.trim().toLowerCase(), username_idx: newAdminUser.trim().toLowerCase(), pass: newAdminPass, name: newAdminUser, role: 'admin', storeIds: selectedStoresForAdmin, createdAt: serverTimestamp() });
    alert("✅ Đã tạo Admin!"); newAdminUser=''; newAdminPass=''; selectedStoresForAdmin=[]; } catch(e){ alert(e.message);
    } }
  async function deleteUser(uid) { if(confirm("Xóa user?")) try { await deleteDoc(doc(db,'users',uid)); } catch(e){ alert(e.message);
    } }
  function openEditUser(user) { editingUser=user; editSelectedStores=user.storeIds?[...user.storeIds]:[]; isEditingUser=true; }
  async function saveEditUser() { if(!editingUser) return;
    try{ await updateDoc(doc(db,'users',editingUser.id), {storeIds:editSelectedStores}); alert("✅ Xong!"); isEditingUser=false; editingUser=null; }catch(e){alert(e.message);} }

  async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if(!file) return; event.target.value=null; isUploading=true;
    try {
      const data = await file.arrayBuffer(); const wb = read(data);
      const sheet = wb.Sheets[wb.SheetNames[0]]; const raw = utils.sheet_to_json(sheet);
      const batch = writeBatch(db); let c=0;
      raw.forEach(r => { const nR={}; Object.keys(r).forEach(k=>nR[k.toLowerCase().trim()]=r[k]); const u = safeString(nR.username||nR.user); if(u) { const role = safeString(nR.role).toLowerCase()==='admin'?'admin':'staff'; const stores = safeString(nR.makho||nR.storeid)?[safeString(nR.makho||nR.storeid)]:myStores; batch.set(doc(db,'users',u.toLowerCase()), { username: u, username_idx:u.toLowerCase(), pass: safeString(nR.pass||nR.password), name: nR.name?safeString(nR.name):u, role, storeIds: stores }, {merge:true}); c++; } });
      await batch.commit(); alert(`✅ Đồng bộ ${c} tài khoản!`); countAuthorizedUsers();
    } catch(e){alert(e.message);} finally{isUploading=false;}
  }

  function startEdit(i, item) { editingIndex=i;
    newTime=item.time; newTaskTitle=item.title; isImportant=item.isImportant||false; }
  function cancelEdit() { editingIndex=-1; newTaskTitle=''; isImportant=false; newTime='08:00'; }
  async function saveTemplateTask() {
      if(!newTaskTitle.trim()) return;
      myStores.forEach(sId => { taskTemplate.update(curr => { const up={...$taskTemplate}; if(!up[activeType]) up[activeType]=[]; const item={title:newTaskTitle, time:newTime, isImportant}; if(editingIndex>=0) up[activeType][editingIndex]=item; else up[activeType].push(item); up[activeType].sort((a,b)=>(a.time||"00:00").localeCompare(b.time||"00:00")); setDoc(doc(db,'settings',`template_${sId}`), up); return up; }); if(editingIndex===-1) addDoc(collection(db,'tasks'),{type:activeType, title:newTaskTitle, timeSlot:newTime, completed:false, createdBy:'Admin', date:getTodayStr(), storeId:sId, isImportant, timestamp:serverTimestamp()}); });
      if(editingIndex!==-1) alert("✅ Đã cập nhật!"); cancelEdit();
  }
  function removeTemplateTask(i) { if(!confirm("Xóa mẫu?")) return;
    taskTemplate.update(curr => { const up={...curr}; up[activeType].splice(i,1); myStores.forEach(sId => setDoc(doc(db,'settings',`template_${sId}`), up)); return up; }); if(editingIndex===i) cancelEdit();
    }

  async function handleScheduleExcel(event) {
      const file = event.target.files[0]; if(!file) return; event.target.value = null;
    try { const data = await file.arrayBuffer(); const wb = read(data); const ws = wb.Sheets[wb.SheetNames[0]]; const json = utils.sheet_to_json(ws);
    let count = 0; let newStaff = []; json.forEach(row => { let name = '', gender = 'Nữ'; Object.keys(row).forEach(key => { let k = key.toLowerCase(); if(k.includes('tên')||k.includes('nhân viên')||k.includes('name')) name=row[key]; if(k.includes('giới')||k.includes('nữ')||k.includes('gender')) gender=row[key]; }); if(name) { newStaff.push({ id: String(count+1), name, gender: String(gender).toLowerCase().includes('nam')?'Nam':'Nữ' }); count++; } });
    scheduleStaffList = newStaff; await saveStaffList(); alert(`✅ Đã tải ${count} nhân sự!`); } catch(e) { alert("Lỗi đọc file: " + e.message);
    }
  }

  async function handleGenerateSchedule() {
      if(scheduleStaffList.length === 0) return alert("Chưa có nhân viên!");
      const inputs = { c1: shiftInputs[0].qty, c2: shiftInputs[1].qty, c3: shiftInputs[2].qty, c4: shiftInputs[3].qty, c5: shiftInputs[4].qty, c6: shiftInputs[5].qty, gh: ghQty };
      try {
          const targetStore = myStores[0];
          if (!targetStore) throw new Error("Lỗi kho!");
          const computedShifts = calculateShiftModes(inputs, scheduleStaffList.length);
          let prevScheduleData = null;
          let prevMonth = scheduleMonth - 1; let prevYear = scheduleYear; if(prevMonth === 0) { prevMonth = 12; prevYear--; }
          const prevSnap = await getDoc(doc(db, 'stores', targetStore, 'schedules', `${prevYear}-${String(prevMonth).padStart(2,'0')}`));
          if(prevSnap.exists()) prevScheduleData = prevSnap.data();
          const result = generateMonthlySchedule(scheduleStaffList, computedShifts, roleConfig, scheduleMonth, scheduleYear, prevScheduleData);
          const scheduleId = `${scheduleYear}-${String(scheduleMonth).padStart(2,'0')}`;
          await setDoc(doc(db, 'stores', targetStore, 'schedules', scheduleId), { config: { shiftInputs, roleConfig, computed: computedShifts }, data: result.schedule, stats: result.staffStats.map(s=>({id:s.id, name:s.name, ...s.stats})), endOffset: result.endOffset, updatedAt: serverTimestamp(), updatedBy: $currentUser.username });
          await saveShiftConfig(true);
          alert(`✅ Đã tạo lịch T${scheduleMonth} thành công!`); dispatch('close');
      } catch(e) { alert("Lỗi: " + e.message); }
  }
  
  function startTour() { showAdminTour = true; }
</script>

<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
  <div class="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-popIn relative">
    
    <div class="p-4 border-b flex items-center gap-2 bg-slate-50 admin-header">
      <span class="material-icons-round text-orange-500 text-3xl">settings</span>
      <div class="flex-1 flex items-center gap-2">
          <h3 class="text-lg font-bold text-slate-800">
              {isSuperAdmin ? 'SUPER ADMIN' : `Quản Lý Kho: ${myStores.join(', ')}`}
          </h3>
          <button id="btn-help-admin" class="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center hover:bg-purple-200 transition-colors" title="Xem hướng dẫn Admin" on:click={startTour}>
              <span class="material-icons-round text-sm">help</span>
          </button>
      </div>
      <button class="p-2 hover:bg-gray-200 rounded-full" on:click={() => dispatch('close')}><span class="material-icons-round">close</span></button>
    </div>
    
    <div class="p-4 overflow-y-auto flex-1 bg-slate-50">
        {#if isSuperAdmin}
            <div class="flex flex-wrap gap-2 mb-4 border-b pb-2"><button class="btn-tab {saTab==='store'?'active':''}" on:click={()=>saTab='store'}>1. Kho</button><button class="btn-tab {saTab==='account'?'active':''}" on:click={()=>saTab='account'}>2. Admin</button><button class="btn-tab {saTab==='user_manage'?'active':''}" on:click={()=>saTab='user_manage'}>3. User</button></div>
            {#if saTab === 'store'}
                <div class="section-box">
                    <h4 class="title-label">Thêm Kho</h4>
                    <div class="flex gap-2">
                        <label for="new-store-id" class="sr-only">Mã Kho</label>
                        <input id="new-store-id" class="input-std uppercase" placeholder="Mã" bind:value={newStoreId}>
                        <label for="new-store-name" class="sr-only">Tên Kho</label>
                        <input id="new-store-name" class="input-std" placeholder="Tên" bind:value={newStoreName}>
                        <button class="btn-primary bg-green-600" on:click={createStore}>Thêm</button>
                    </div>
                    <div class="mt-2 h-40 overflow-y-auto border rounded bg-white p-2">{#each $storeList as s}<div class="text-sm border-b py-1"><b>{s.id}</b> - {s.name}</div>{/each}</div>
                </div>
            {:else if saTab === 'account'}
                <div class="section-box">
                    <h4 class="title-label">Cấp Admin</h4>
                    <label for="new-admin-user" class="sr-only">Username</label>
                    <input id="new-admin-user" class="input-std w-full mb-2" placeholder="User" bind:value={newAdminUser}>
                    <label for="new-admin-pass" class="sr-only">Password</label>
                    <input id="new-admin-pass" class="input-std w-full mb-2" placeholder="Pass" bind:value={newAdminPass}>
                    <div class="h-32 overflow-y-auto border p-2 mb-2 bg-white grid grid-cols-2">{#each $storeList as s}<label class="flex gap-2"><input type="checkbox" bind:group={selectedStoresForAdmin} value={s.id}>{s.name}</label>{/each}</div>
                    <button class="btn-primary w-full" on:click={createAdminAccount}>Tạo</button>
                </div>
            {:else}
                <div class="section-box h-96 overflow-y-auto bg-white"><table class="w-full text-sm"><thead><tr><th>User</th><th>Role</th><th>Kho</th><th>Act</th></tr></thead><tbody>{#each allUsers as u}<tr class="border-b hover:bg-gray-50"><td class="p-2 font-bold">{u.username}</td><td class="p-2">{u.role}</td><td class="p-2">{u.storeIds?.join(', ')}</td><td class="p-2">{#if u.role!=='super_admin'}<button class="text-blue-500" on:click={()=>openEditUser(u)}>Sửa</button> <button class="text-red-500" on:click={()=>deleteUser(u.id)}>Xóa</button>{/if}</td></tr>{/each}</tbody></table>{#if isEditingUser}<div class="fixed inset-0 bg-black/50 flex items-center justify-center"><div class="bg-white p-4 rounded"><h4>Sửa {editingUser.username}</h4><div class="h-40 overflow-y-auto border p-2 my-2">{#each $storeList as s}<label class="block"><input type="checkbox" bind:group={editSelectedStores} value={s.id}>{s.name}</label>{/each}</div><button class="btn-primary" on:click={saveEditUser}>Lưu</button> <button class="btn-std ml-2" on:click={()=>isEditingUser=false}>Hủy</button></div></div>{/if}</div>
            {/if}
        {:else}
            <div id="section-upload" class="mb-6 border-b pb-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="header-icon text-blue-600"><span class="material-icons-round">group_add</span> 1. Cấp quyền nhân sự (App Login)</h4>
                    <span class="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg border border-blue-200">Đã cấp: {authorizedUserCount} User</span>
                </div>
                <label class="flex flex-col items-center justify-center gap-2 w-full p-6 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors text-blue-700 font-bold">
                    <span class="material-icons-round text-4xl">upload_file</span> 
                    <span>{isUploading?'Đang tải...':'Chọn file Excel danh sách'}</span>
                    <input type="file" class="hidden" accept=".xlsx" on:change={handleExcelUpload}>
                </label>
                <div class="mt-2 text-[10px] text-gray-400 italic pl-2">* File Excel cần có cột: <code>username</code>, <code>pass</code>.</div>
            </div>

            <div id="section-template" class="mb-6 border-b pb-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <h4 class="header-icon text-orange-500"><span class="material-icons-round">playlist_add_check</span> 2. Cấu hình việc mẫu</h4>
                <div class="flex gap-2 mb-3"><select bind:value={activeType} class="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:ring-2 focus:ring-orange-200" on:change={cancelEdit} aria-label="Chọn loại việc"><option value="warehouse">📦 Kho</option><option value="cashier">💰 Thu Ngân</option></select></div>
                <div class="flex flex-col gap-2 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div class="flex gap-2">
                        <label for="task-time" class="sr-only">Giờ thực hiện</label>
                        <input id="task-time" type="text" bind:value={newTime} class="w-24 text-center p-2 border rounded font-mono" placeholder="08:00">
                        <label for="task-title" class="sr-only">Tên công việc</label>
                        <input id="task-title" type="text" bind:value={newTaskTitle} class="flex-1 p-2 border rounded" placeholder="Tên công việc..." on:keydown={(e)=>e.key==='Enter'&&saveTemplateTask()}>
                    </div>
                    <div class="flex justify-between items-center">
                        <label class="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-1.5 rounded border hover:bg-red-50"><input type="checkbox" bind:checked={isImportant} class="w-4 h-4 accent-red-500 cursor-pointer"><span class="text-sm {isImportant ? 'font-bold text-red-600' : 'text-gray-500'}">Quan trọng {isImportant ? '⭐' : ''}</span></label>
                        <div class="flex gap-2">{#if editingIndex >= 0}<button class="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm font-bold hover:bg-gray-400" on:click={cancelEdit}>Hủy</button>{/if}<button class="px-4 py-1 rounded text-sm font-bold text-white shadow-md {editingIndex >= 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'}" on:click={saveTemplateTask}>{editingIndex >= 0 ? 'Lưu Sửa' : 'Thêm Mới'}</button></div>
                    </div>
                </div>
                <div class="border rounded-lg overflow-hidden bg-white flex flex-col"><ul class="divide-y overflow-y-auto max-h-[40vh]">{#if $taskTemplate[activeType]}{#each $taskTemplate[activeType] as item, i}<li class="flex justify-between p-3 text-sm items-center hover:bg-blue-50 transition-colors group {editingIndex === i ? 'bg-blue-100' : ''}"><div class="flex items-center gap-2 flex-1 mr-2"><b class="bg-gray-200 px-1.5 py-0.5 rounded text-xs text-gray-700 font-mono">{item.time}</b><span class="{item.isImportant ? 'font-bold text-red-600' : 'text-gray-700'}">{item.isImportant ? '⭐ ' : ''}{item.title}</span></div><div class="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><button class="p-1.5 text-blue-500 bg-white border rounded shadow-sm" on:click={()=>startEdit(i, item)}>🖊️</button><button class="p-1.5 text-red-500 bg-white border rounded shadow-sm" on:click={()=>removeTemplateTask(i)}>🗑️</button></div></li>{/each}{/if}</ul></div>
            </div>

            <div id="section-schedule" class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mt-6">
                <div id="section-schedule-header" class="flex justify-between items-center mb-3">
                    <h4 class="header-icon text-pink-600"><span class="material-icons-round">calendar_month</span> 3. Phân Ca Tự Động</h4>
                </div>
                
                <div class="space-y-4">
                    <div id="sch-step-1" class="bg-white p-3 rounded-lg border shadow-sm"><div class="flex justify-between items-center"><span class="text-sm font-bold text-gray-700">Nhân sự sẵn sàng: <span class="text-lg text-blue-600 font-mono">{scheduleStaffList.length}</span></span><label class="cursor-pointer bg-blue-50 text-blue-700 text-xs font-bold px-3 py-2 rounded hover:bg-blue-100 flex items-center gap-1 border border-blue-200"><span class="material-icons-round text-sm">upload_file</span> Upload Excel<input type="file" class="hidden" accept=".xlsx" on:change={handleScheduleExcel}></label></div>{#if scheduleStaffList.length===0}<p class="text-[10px] text-gray-400 mt-1 italic">* File: Cột Tên nhân viên, Giới tính.</p>{/if}</div>
                    
                    <div id="sch-step-2" class="bg-white rounded-lg border shadow-sm overflow-hidden"><table class="w-full text-sm text-left"><thead class="bg-gray-100 text-gray-600 font-bold text-xs uppercase"><tr><th class="p-3 border-b">Tên Ca</th><th class="p-3 border-b w-32 text-center">Khung Giờ</th><th class="p-3 border-b w-24 text-center">Số Lượng</th></tr></thead><tbody class="divide-y">{#each shiftInputs as shift}<tr class="hover:bg-gray-50"><td class="p-2 pl-3 font-bold text-gray-700 align-middle"><span class="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] mr-2 border">{shift.id.toUpperCase()}</span>{shift.label}</td><td class="p-2 align-middle"><input type="text" bind:value={shift.time} class="w-full border-b border-gray-300 focus:border-indigo-500 outline-none bg-transparent text-center font-mono text-xs py-1 text-gray-600" aria-label={`Thời gian ${shift.label}`}></td><td class="p-2 align-middle text-center pr-3"><div class="flex items-center justify-center gap-1"><input type="number" bind:value={shift.qty} class="w-14 border rounded p-1 text-center font-bold text-indigo-600 bg-indigo-50 outline-none focus:ring-1 focus:ring-indigo-500" aria-label={`Số lượng ${shift.label}`}><span class="text-[10px] text-gray-400">NS</span></div></td></tr>{/each}</tbody></table></div>
                    
                    <div id="sch-step-3" class="grid grid-cols-3 gap-3">
                        <div class="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-col items-center shadow-sm"><span class="material-icons-round text-red-500 mb-1">local_shipping</span><label for="gh-qty" class="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">Giao Hàng</label><input id="gh-qty" type="number" bind:value={ghQty} class="w-16 border border-red-300 rounded p-1 text-center font-bold text-red-800 bg-white outline-none focus:ring-2 focus:ring-red-400"></div>
                        <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 flex flex-col items-center shadow-sm"><span class="material-icons-round text-purple-500 mb-1">point_of_sale</span><label for="tn-qty" class="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">Thu Ngân</label><input id="tn-qty" type="number" bind:value={roleConfig.tn} class="w-16 border border-purple-300 rounded p-1 text-center font-bold text-purple-800 bg-white outline-none focus:ring-2 focus:ring-purple-400"></div>
                        <div class="bg-green-50 border border-green-200 rounded-lg p-3 flex flex-col items-center shadow-sm"><span class="material-icons-round text-green-500 mb-1">inventory_2</span><label for="kho-qty" class="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1">Kho</label><input id="kho-qty" type="number" bind:value={roleConfig.kho} class="w-16 border border-green-300 rounded p-1 text-center font-bold text-green-800 bg-white outline-none focus:ring-2 focus:ring-green-400"></div>
                    </div>
                     
                    <div id="sch-step-4" class="flex items-center gap-3 mt-2">
                        <button id="btn-save-config" class="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold shadow-sm hover:bg-blue-600 transition-colors flex items-center gap-2" on:click={()=>saveShiftConfig(false)}><span class="material-icons-round text-sm">save</span> Lưu Cài Đặt</button>
                        <div class="flex-1 flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg border border-gray-200"><span class="text-xs font-bold text-gray-500">Tháng:</span><input type="number" bind:value={scheduleMonth} class="w-8 bg-transparent text-center font-bold outline-none" aria-label="Tháng"><span class="text-gray-400">/</span><input type="number" bind:value={scheduleYear} class="w-12 bg-transparent text-center font-bold outline-none" aria-label="Năm"></div>
                        <button class="flex-[2] bg-pink-600 text-white py-2.5 rounded-lg font-bold hover:bg-pink-700 shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" on:click={handleGenerateSchedule} disabled={scheduleStaffList.length===0}><span class="material-icons-round">auto_awesome</span> TẠO LỊCH TỰ ĐỘNG</button>
                    </div>
                </div>
            </div>
        {/if}
    </div>
    <div class="p-4 border-t bg-slate-50"><button class="w-full py-3 rounded-xl font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors" on:click={()=>dispatch('close')}>Đóng Cài Đặt</button></div>
  </div>
  
  {#if showAdminTour}
      <TourGuide steps={adminSteps} on:complete={() => { showAdminTour = false; localStorage.setItem(adminTourKey, 'true'); }} />
  {/if}
</div>

<style>
    .animate-popIn { animation: popIn 0.2s ease-out; } 
    @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .btn-tab { @apply px-4 py-2 rounded-lg text-sm font-bold bg-white text-gray-600 border hover:bg-gray-50 transition-colors; }
    .btn-tab.active { @apply bg-indigo-600 text-white shadow-md border-transparent; }
    .section-box { @apply bg-white p-4 rounded-xl border border-gray-200 shadow-sm; }
    .title-label { @apply text-sm font-bold text-gray-500 uppercase mb-3; }
    .header-icon { @apply text-sm font-bold uppercase mb-3 flex items-center gap-2; }
    .input-std { @apply p-2 border rounded outline-none focus:ring-2 focus:ring-indigo-100 transition-all; }
    .btn-primary { @apply px-4 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 shadow-sm transition-transform active:scale-95; }
    .btn-std { @apply px-3 py-2 bg-white border rounded text-gray-700 font-bold hover:bg-gray-50; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
</style>