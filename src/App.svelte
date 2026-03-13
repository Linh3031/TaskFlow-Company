<script>
  // Version 16.0 - [CodeGenesis] Cache-First Stores, Dual-Channel Tasks & Force Update PWA
  import { onMount, onDestroy, tick } from 'svelte';
  import { db } from './lib/firebase';
  import { collection, onSnapshot, query, where, doc, updateDoc, arrayUnion, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
  import { currentUser, currentTasks, taskTemplate, DEFAULT_TEMPLATE, storeList, activeStoreId } from './lib/stores.js';
  import { getTodayStr, getCurrentTimeShort } from './lib/utils.js';
  
  import Login from './components/Login.svelte';
  import Header from './components/Header.svelte';
  import TaskList from './components/TaskList.svelte';
  import InstallmentCalc from './components/InstallmentCalc.svelte'; 
  import AdminModal from './components/AdminModal.svelte';
  import TaskModal from './components/TaskModal.svelte';
  import TourGuide from './components/TourGuide.svelte';
  import ShiftSchedule from './components/ShiftSchedule.svelte';
  import DailyChecklist from './components/DailyChecklist.svelte'; 
  import HandoverInput from './components/HandoverInput.svelte';
  import Chatbot from './components/Chatbot.svelte';

  // [CodeGenesis] Quản lý Phiên bản PWA
  const APP_VERSION = 4; // Tăng số này lên khi bạn có bản cập nhật mới
  let showUpdatePrompt = false;

  let activeTab = '8nttt';
  let showAdminModal = false;
  let showTaskModal = false;
  let selectedTask = null;
  let noteInput = '';
  let selectedDate = getTodayStr();
  let showTour = false;
  const tourKey = 'taskflow_v6_general_tour_seen';
  
  const tourSteps = [
      { target: '.app-header', title: '1. Xin chào!', content: 'Chào mừng bạn đến với TaskFlow. Giao diện đã được nâng cấp.' },
      { target: '#store-selector-tour', title: '2. Chọn Kho', content: 'Chuyển đổi dữ liệu giữa các siêu thị.' },
      { target: '#tab-nav-container', title: '3. Chức Năng', content: 'Chuyển đổi cực nhanh giữa các bộ phận.' },
      { target: '#date-navigator', title: '4. Ngày tháng', content: 'Bấm mũi tên hoặc chọn ngày để xem quá khứ/tương lai.' },
      { target: '#btn-notif', title: '5. Thông Báo', content: 'Nhắc nhở, tag tên sẽ báo đỏ tại đây.' },
      { target: '#btn-help', title: '6. Hướng Dẫn', content: 'Xem lại hướng dẫn bất cứ lúc nào.' }
  ];

  let unsubTemplate = () => {};
  let unsubTasks = () => {};
  let unsubHandover = () => {}; 
  
  let hasCheckedInit = false; 
  let isTasksLoaded = false;
  
  $: displayDateLabel = (() => {
      if (!selectedDate) return '';
      const [y, m, d] = selectedDate.split('-');
      return `${d}/${m}`;
  })();
  
  $: displayDayOfWeek = (() => {
      if (!selectedDate) return '';
      const date = new Date(selectedDate);
      const days = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      return days[date.getDay()];
  })();
  
  function changeDate(offset) {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + offset);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      selectedDate = `${year}-${month}-${day}`;
  }
  
  function openDatePicker() {
      try { document.getElementById('hidden-date-input').showPicker(); } 
      catch (e) { document.getElementById('hidden-date-input').click(); }
  }

  $: if ($activeStoreId || selectedDate) {
      hasCheckedInit = false;
      isTasksLoaded = false; 
  }

  onMount(async () => {
    // [CodeGenesis] CACHE-FIRST LOGIC CHO CỬA HÀNG (Cứu hàng ngàn lượt Reads)
    const cachedStores = localStorage.getItem('taskflow_stores_list');
    if (cachedStores) {
        storeList.set(JSON.parse(cachedStores));
    } else {
        try {
            const snap = await getDocs(collection(db, 'stores'));
            const stores = snap.docs.map(d => ({id:d.id, ...d.data()}));
            storeList.set(stores);
            localStorage.setItem('taskflow_stores_list', JSON.stringify(stores));
        } catch (e) { console.error("Lỗi tải danh sách cửa hàng", e); }
    }

    // [CodeGenesis] Lắng nghe Công tắc Phiên bản từ Firebase
    onSnapshot(doc(db, 'settings', 'app_config'), (docSnap) => {
        if (docSnap.exists()) {
            const serverVersion = docSnap.data().currentVersion || 1;
            // Nếu Server có số lớn hơn Code hiện tại -> Bật còi báo động!
            if (serverVersion > APP_VERSION) {
                showUpdatePrompt = true;
            }
        }
    });

    if ($currentUser && !localStorage.getItem(tourKey)) showTour = true;
  });
  
  onDestroy(() => { unsubTemplate(); unsubTasks(); unsubHandover(); });

  $: if ($currentUser && !$activeStoreId) {
      if ($currentUser.storeIds && $currentUser.storeIds.length > 0) {
          $activeStoreId = $currentUser.storeIds[0];
      } else if ($currentUser.role === 'super_admin') {
          $activeStoreId = '908';
      }
  }

  $: if ($currentUser && $activeStoreId) loadDataForUser($activeStoreId, selectedDate);
  
  $: if ($currentUser && $activeStoreId && selectedDate === getTodayStr() && $taskTemplate && $currentTasks && isTasksLoaded) {
       if (!hasCheckedInit) {
           initDailyTasksSafe($activeStoreId, selectedDate, $currentTasks, $taskTemplate);
       }
  }

  function generateFixedID(storeId, dateStr, type, title) {
      const cleanTitle = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      return `${storeId}_${dateStr}_${type}_${cleanTitle}`;
  }

  async function initDailyTasksSafe(storeId, dateStr, currentTasks, template) {
      if (dateStr !== getTodayStr()) return;
      hasCheckedInit = true;

      const dayOfWeek = new Date().getDay();
      const batch = writeBatch(db);
      let hasUpdates = false;
      const types = ['warehouse', 'cashier']; 

      types.forEach(type => {
          const templateItems = template[type] || [];
          templateItems.forEach(tpl => {
              if (tpl.days && tpl.days.includes(dayOfWeek)) {
                  const fixedID = generateFixedID(storeId, dateStr, type, tpl.title);
                  const existsByID = currentTasks.some(t => t.id === fixedID);
                  const existsByTitle = currentTasks.some(t => 
                      t.title.trim().toLowerCase() === tpl.title.trim().toLowerCase() && t.type === type
                  );

                  if (!existsByID && !existsByTitle) {
                      const docRef = doc(db, 'tasks', fixedID);
                      batch.set(docRef, {
                          title: tpl.title.trim(), timeSlot: tpl.time, isImportant: tpl.isImportant || false,
                          type: type, storeId: storeId, date: dateStr, completed: false, createdBy: 'System',
                          timestamp: serverTimestamp()
                      });
                      hasUpdates = true;
                  }
              }
          });
      });

      if (hasUpdates) {
          try { await batch.commit(); } catch(e) { console.error(e); }
      }
  }

  function loadDataForUser(storeId, dateStr) {
      if(unsubTemplate) unsubTemplate();
      if(unsubTasks) unsubTasks();
      if(unsubHandover) unsubHandover();

      unsubTemplate = onSnapshot(doc(db, 'settings', `template_${storeId}`), (docSnap) => {
          taskTemplate.set(docSnap.exists() ? docSnap.data() : DEFAULT_TEMPLATE);
      });

      let dailyTasks = [];
      let handoverTasks = [];

      const updateStore = () => {
          const allTasks = [...dailyTasks, ...handoverTasks];
          const uniqueMap = new Map();
          allTasks.forEach(t => uniqueMap.set(t.id, t));
          currentTasks.set(Array.from(uniqueMap.values()));
          isTasksLoaded = true; 
      };

      const qDaily = query(collection(db, 'tasks'), where('date', '==', dateStr), where('storeId', '==', storeId));
      unsubTasks = onSnapshot(qDaily, (snapshot) => {
          dailyTasks = [];
          snapshot.forEach(doc => { const data = doc.data(); if (data.type) dailyTasks.push({ id: doc.id, ...data }); });
          updateStore();
      });

      const qHandover = query(collection(db, 'tasks'), where('storeId', '==', storeId), where('type', '==', 'handover'), where('completed', '==', false));
      unsubHandover = onSnapshot(qHandover, (snapshot) => {
          handoverTasks = [];
          snapshot.forEach(doc => { const data = doc.data(); if (data.type) handoverTasks.push({ id: doc.id, ...data }); });
          updateStore();
      });
  }

  function handleTaskClick(event) {
    const task = event.detail;
    if (task.completed) {
      if(confirm('Hoàn tác (Undo)?')) {
          const user = $currentUser.name || $currentUser.username;
          updateDoc(doc(db, 'tasks', task.id), { 
              completed: false, history: arrayUnion({ action: 'undo', user, time: getCurrentTimeShort(), fullTime: new Date().toISOString() })
          });
      }
    } else {
      selectedTask = task; noteInput = ''; showTaskModal = true;
    }
  }

  function confirmComplete() {
    if (!selectedTask) return;
    const user = $currentUser.name || $currentUser.username;
    const time = getCurrentTimeShort();
    updateDoc(doc(db, 'tasks', selectedTask.id), {
      completed: true, completedBy: user, time: time, note: noteInput,
      history: arrayUnion({ action: 'done', user, time, fullTime: new Date().toISOString() })
    });
    showTaskModal = false; selectedTask = null;
  }

  async function handleJumpToTask(event) {
      const { taskId, tab } = event.detail;
      if (tab) activeTab = tab;
      await tick();
      const el = document.getElementById("task-" + taskId);
      if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.transition = "background-color 0.5s";
          el.style.backgroundColor = "#fff9c4"; 
          setTimeout(() => { el.style.backgroundColor = ""; }, 2000);
      } else { alert("Không tìm thấy công việc này!"); }
  }

  // [CodeGenesis] Hàm ép cập nhật PWA
  async function forceUpdateApp() {
      if ('caches' in window) {
          try {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map(name => caches.delete(name)));
          } catch (err) { console.error(err); }
      }
      if ('serviceWorker' in navigator) {
          try {
              const regs = await navigator.serviceWorker.getRegistrations();
              for (let reg of regs) await reg.unregister();
          } catch (err) { console.error(err); }
      }
      window.location.href = window.location.pathname + "?v=" + new Date().getTime();
  }
</script>

<main>
  {#if !$currentUser} <Login /> {:else}
    <div class="app-container">
      <Header on:openAdmin={() => showAdminModal = true} on:openTour={() => showTour = true} on:openIosGuide={() => alert('Trên iPhone: Bấm nút Chia sẻ -> Chọn "Thêm vào MH chính"')} on:jumpToTask={handleJumpToTask} />
      
      <nav id="tab-nav-container" class="tab-nav">
        {#each [
            {id:'8nttt', icon:'fact_check', label:'8NTTT', color:'#00bcd4'},
            {id:'installment', icon:'calculate', label:'Trả Góp', color:'#673ab7'}, 
            {id:'schedule', icon:'calendar_month', label:'Lịch Ca', color:'#e91e63'},
            {id:'handover', icon:'assignment_ind', label:'Bàn Giao', color:'#9c27b0'}
        ] as t}
            <button class="tab-btn {activeTab===t.id?'active':''}" on:click={() => activeTab=t.id} style="--theme-color: {t.color};">
                <div class="icon-box"><span class="material-icons-round">{t.icon}</span></div><small>{t.label}</small>
            </button>
        {/each}
      </nav>

      <div id="main-content" class="content-area">
        <div class="section-header theme-{activeTab} flex flex-col gap-2 items-start sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center justify-between w-full sm:w-auto">
              <h3>
                 {#if $currentUser.role === 'super_admin'}
                    🛡️ View: <span class="text-indigo-600 font-bold ml-1">{$activeStoreId}</span>
                 {:else}
                    {#if activeTab==='warehouse'}📦 Checklist Kho{/if}
                    {#if activeTab==='cashier'}💰 Checklist Thu Ngân{/if}
                    {#if activeTab==='8nttt'}📋 Kiểm tra 8NTTT{/if}
                    {#if activeTab==='installment'}🧮 Tính Trả Góp{/if} 
                    {#if activeTab==='schedule'}📅 Lịch Phân Ca{/if}
                    {#if activeTab==='handover'}🤝 Bàn Giao{/if}
                 {/if}
               </h3>
              {#if activeTab === 'warehouse' || activeTab === 'cashier' || activeTab === 'handover'}
                <span class="task-count ml-2">{$currentTasks.filter(t => t.type === activeTab && !t.completed).length} chưa xong</span>
               {/if}
           </div>
           
           {#if activeTab !== 'schedule' && activeTab !== 'installment'}
            <div id="date-navigator" class="flex items-center gap-1 w-full sm:w-auto bg-gray-100 p-1 rounded-lg border border-gray-200 shadow-sm">
                <button class="w-8 h-8 flex items-center justify-center bg-white rounded-md text-gray-500 hover:text-indigo-600 hover:shadow-sm transition-all active:scale-95" on:click={() => changeDate(-1)}>
                    <span class="material-icons-round text-lg">chevron_left</span>
                </button>
                <button class="relative flex-1 sm:flex-none flex flex-col items-center justify-center px-3 cursor-pointer group min-w-[70px] bg-transparent border-none" on:click={openDatePicker}>
                    <span class="text-[10px] font-bold text-gray-400 leading-none uppercase">{displayDayOfWeek}</span>
                    <span class="text-sm font-black text-gray-800 leading-tight group-hover:text-indigo-600 transition-colors">{displayDateLabel}</span>
                </button>
                <input id="hidden-date-input" type="date" bind:value={selectedDate} class="absolute opacity-0 pointer-events-none w-0 h-0" />
                <button class="w-8 h-8 flex items-center justify-center bg-white rounded-md text-gray-500 hover:text-indigo-600 hover:shadow-sm transition-all active:scale-95" on:click={() => changeDate(1)}>
                    <span class="material-icons-round text-lg">chevron_right</span>
                </button>
             </div>
          {/if}
        </div>

        {#if activeTab === 'installment'} <InstallmentCalc /> 
        {:else if activeTab === 'schedule'} <ShiftSchedule {activeTab} /> 
        {:else if activeTab === '8nttt'} <DailyChecklist activeStoreId={$activeStoreId} dateStr={selectedDate} />
        {:else} 
            {#if activeTab === 'handover'} <HandoverInput /> {/if}
            <TaskList {activeTab} on:taskClick={handleTaskClick} /> 
        {/if}
      </div>
      <footer>Design by 3031 | Kho đang xem: {$activeStoreId}</footer>
    </div>
  {/if}
  
  {#if showAdminModal} <AdminModal on:close={() => showAdminModal = false} on:switchTab={(e) => { activeTab = e.detail; showAdminModal = false; }} /> {/if}
  {#if showTaskModal && selectedTask} <TaskModal taskTitle={selectedTask.title} bind:note={noteInput} on:cancel={() => showTaskModal = false} on:confirm={confirmComplete} /> {/if}
  {#if showTour} <TourGuide steps={tourSteps} on:complete={() => { showTour = false; localStorage.setItem(tourKey, 'true'); }} /> {/if}
  
  {#if showUpdatePrompt}
  <div class="fixed inset-0 z-[9999] bg-slate-900/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-white p-6 rounded-2xl shadow-2xl text-center max-w-sm w-full animate-popIn">
          <div class="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span class="material-icons-round text-3xl">system_update</span>
          </div>
          <h3 class="text-xl font-black text-slate-800 mb-2">Đã có bản cập nhật mới!</h3>
          <p class="text-sm text-slate-500 mb-6">Hệ thống vừa được nâng cấp tính năng và sửa lỗi. Vui lòng cập nhật để sử dụng ổn định nhất.</p>
          <button class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-colors" on:click={forceUpdateApp}>
              Tải Cập Nhật Ngay
          </button>
      </div>
  </div>
  {/if}

  <Chatbot />
</main>

<style>
  main { width: 100%; height: 100%; }
  .app-container { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-body); }
  .tab-nav { flex-shrink: 0; background: #ffffff; padding: 5px 10px; display: flex; gap: 5px; justify-content: space-between; border-bottom: 1px solid #eee; }
  .tab-btn { flex: 1; border: none; background: transparent; padding: 5px; display: flex; flex-direction: column; align-items: center; color: #bbb; cursor: pointer; transition: all 0.2s ease; }
  .icon-box { width: 36px; height: 24px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 2px; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  .tab-btn small { font-size: 0.7rem; font-weight: 700; }
  .tab-btn.active { color: var(--theme-color); }
  .tab-btn.active .icon-box { background: var(--theme-color); color: white; width: 45px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
  .content-area { flex-grow: 1; overflow: hidden; position: relative; display: flex; flex-direction: column; padding: 10px; }
  .section-header { flex-shrink: 0; padding: 10px; border-radius: 10px; margin-bottom: 10px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .section-header h3 { font-size: 1rem; margin: 0; font-weight: 700; }
  .task-count { background: rgba(0,0,0,0.05); padding: 4px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 800; color: #555; }
  footer { flex-shrink: 0; text-align: center; padding: 10px; color: #999; font-size: 0.75rem; font-weight: 700; background: #f4f7fc; }
  .theme-8nttt h3 { color: #00bcd4; }
  .theme-handover h3 { color: #9c27b0; }
  
  .animate-popIn { animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
  @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>