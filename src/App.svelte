<script>
  // Version 10.4 - CLEAN & STABLE (Fixed ID logic kept, Debug tools removed)
  import { onMount, onDestroy, tick } from 'svelte';
  import { db } from './lib/firebase';
  import { collection, onSnapshot, query, where, doc, updateDoc, arrayUnion, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore'; 
  import { currentUser, currentTasks, taskTemplate, DEFAULT_TEMPLATE, storeList } from './lib/stores.js';
  import { getTodayStr, getCurrentTimeShort } from './lib/utils.js';

  import Login from './components/Login.svelte';
  import Header from './components/Header.svelte';
  import TaskList from './components/TaskList.svelte';
  import HandoverInput from './components/HandoverInput.svelte';
  import AdminModal from './components/AdminModal.svelte';
  import TaskModal from './components/TaskModal.svelte';
  import TourGuide from './components/TourGuide.svelte';
  import ShiftSchedule from './components/ShiftSchedule.svelte';

  let activeTab = 'warehouse';
  let showAdminModal = false;
  let showTaskModal = false;
  let selectedTask = null;
  let noteInput = '';
  let selectedDate = getTodayStr();
  
  let activeStoreId = '';
  let showTour = false;
  const tourKey = 'taskflow_v6_general_tour_seen';

  const tourSteps = [
      { target: '.app-header', title: 'Xin chào!', content: 'Chào mừng bạn đến với TaskFlow.' },
      { target: '#tab-nav-container', title: 'Chuyển Đổi Bộ Phận', content: 'Chuyển giữa: Kho, Thu Ngân, Bàn Giao, Lịch Ca.' },
      { target: '#date-navigator', title: 'Chọn Ngày', content: 'Bấm < hoặc > để chuyển ngày.' },
      { target: '#btn-notif', title: 'Thông Báo', content: 'Xem ai nhắc tên bạn.' },
      { target: '#btn-admin', title: 'Cài Đặt', content: 'Cấu hình hệ thống.' }
  ];

  let unsubStores = () => {};
  let unsubTemplate = () => {};
  let unsubTasks = () => {};
  
  let hasCheckedInit = false; 

  // --- LOGIC HIỂN THỊ NGÀY THÁNG ---
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

  // Reset cờ khi đổi kho hoặc đổi ngày
  $: if (activeStoreId || selectedDate) {
      hasCheckedInit = false;
  }

  onMount(() => {
    unsubStores = onSnapshot(collection(db, 'stores'), (snap) => {
        storeList.set(snap.docs.map(d => ({id:d.id, ...d.data()})));
    });
    if ($currentUser && !localStorage.getItem(tourKey)) showTour = true;
  });

  onDestroy(() => { unsubStores(); unsubTemplate(); unsubTasks(); });

  $: if ($currentUser && !activeStoreId) {
      if ($currentUser.storeIds && $currentUser.storeIds.length > 0) {
          activeStoreId = $currentUser.storeIds[0];
      } else if ($currentUser.role === 'super_admin') {
          activeStoreId = '908';
      }
  }

  $: if ($currentUser && activeStoreId) loadDataForUser(activeStoreId, selectedDate);

  // TỰ ĐỘNG KHỞI TẠO (CHẠY NGẦM AN TOÀN)
  $: if ($currentUser && activeStoreId && selectedDate === getTodayStr() && $taskTemplate && $currentTasks) {
       if (!hasCheckedInit) {
           initDailyTasksSafe(activeStoreId, selectedDate, $currentTasks, $taskTemplate);
       }
  }

  // === HÀM SINH ID CỐ ĐỊNH (CỐT LÕI CỦA VIỆC CHỐNG TRÙNG) ===
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
                  
                  // Kiểm tra trùng lặp
                  const existsByID = currentTasks.some(t => t.id === fixedID);
                  const existsByTitle = currentTasks.some(t => 
                      t.title.trim().toLowerCase() === tpl.title.trim().toLowerCase() && 
                      t.type === type
                  );

                  if (!existsByID && !existsByTitle) {
                      const docRef = doc(db, 'tasks', fixedID);
                      batch.set(docRef, {
                          title: tpl.title.trim(),
                          timeSlot: tpl.time,
                          isImportant: tpl.isImportant || false,
                          type: type,
                          storeId: storeId,
                          date: dateStr,
                          completed: false,
                          createdBy: 'System',
                          timestamp: serverTimestamp()
                      });
                      hasUpdates = true;
                  }
              }
          });
      });

      if (hasUpdates) {
          console.log("⚡ Đang đồng bộ công việc thiếu...");
          try { await batch.commit(); } catch(e) { console.error(e); }
      }
  }

  function loadDataForUser(storeId, dateStr) {
      if(unsubTemplate) unsubTemplate(); 
      if(unsubTasks) unsubTasks();

      unsubTemplate = onSnapshot(doc(db, 'settings', `template_${storeId}`), (docSnap) => {
          taskTemplate.set(docSnap.exists() ? docSnap.data() : DEFAULT_TEMPLATE);
      });

      const q = query(collection(db, 'tasks'), where('date', '==', dateStr), where('storeId', '==', storeId));
      unsubTasks = onSnapshot(q, (snapshot) => {
          const tasks = [];
          snapshot.forEach(doc => {
              const data = doc.data();
              if (data.type) tasks.push({ id: doc.id, ...data });
          });
          currentTasks.set(tasks);
      });
  }

  function handleTaskClick(event) {
    const task = event.detail;
    if (task.completed) {
      if(confirm('Hoàn tác (Undo)?')) {
          const user = $currentUser.name || $currentUser.username;
          const time = getCurrentTimeShort();
          updateDoc(doc(db, 'tasks', task.id), { 
              completed: false, 
              history: arrayUnion({ action: 'undo', user, time, fullTime: new Date().toISOString() })
          });
      }
    } else {
      selectedTask = task;
      noteInput = '';
      showTaskModal = true;
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
</script>

<main>
  {#if !$currentUser} <Login /> {:else}
    <div class="app-container">
      <Header on:openAdmin={() => showAdminModal = true} on:openTour={() => showTour = true} on:openIosGuide={() => alert('Trên iPhone: Bấm nút Chia sẻ -> Chọn "Thêm vào MH chính"')} on:jumpToTask={handleJumpToTask} />
      
      <nav id="tab-nav-container" class="tab-nav">
        {#each [
            {id:'warehouse', icon:'inventory_2', label:'Kho', color:'#ff9800'},
            {id:'cashier', icon:'point_of_sale', label:'Thu Ngân', color:'#4caf50'},
            {id:'handover', icon:'campaign', label:'Bàn Giao', color:'#673ab7'},
            {id:'schedule', icon:'calendar_month', label:'Lịch Ca', color:'#e91e63'}
        ] as t}
            <button class="tab-btn {activeTab===t.id?'active':''}" on:click={() => activeTab=t.id} style="--theme-color: {t.color};">
                <div class="icon-box"><span class="material-icons-round">{t.icon}</span></div><small>{t.label}</small>
            </button>
        {/each}
      </nav>

      <div id="main-content" class="content-area">
        <div class="section-header {activeTab}-theme flex flex-col gap-2 items-start sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center justify-between w-full sm:w-auto">
              <h3>
                 {#if $currentUser.role === 'super_admin'}
                    🛡️ View: <select bind:value={activeStoreId} class="ml-1 bg-transparent border-none font-bold text-indigo-600 outline-none cursor-pointer"><option value="908">Kho 908</option>{#each $storeList as s}{#if s.id !== '908'} <option value={s.id}>{s.id}</option> {/if}{/each}</select>
                 {:else}
                    {#if activeTab==='warehouse'}📦 Checklist Kho{/if}
                    {#if activeTab==='cashier'}💰 Checklist Thu Ngân{/if}
                    {#if activeTab==='handover'}📢 Bàn Giao Ca{/if}
                    {#if activeTab==='schedule'}📅 Lịch Phân Ca{/if}
                 {/if}
              </h3>
              {#if activeTab !== 'schedule'}
                   <span class="task-count ml-2">{$currentTasks.filter(t => t.type === activeTab && !t.completed).length} chưa xong</span>
               {/if}
           </div>
           
           {#if activeTab !== 'schedule'}
            <div id="date-navigator" class="flex items-center gap-1 w-full sm:w-auto bg-gray-100 p-1 rounded-lg border border-gray-200 shadow-sm">
                <button class="w-8 h-8 flex items-center justify-center bg-white rounded-md text-gray-500 hover:text-indigo-600 hover:shadow-sm transition-all active:scale-95" on:click={() => changeDate(-1)}>
                    <span class="material-icons-round text-lg">chevron_left</span>
                </button>
                <button class="relative flex-1 sm:flex-none flex flex-col items-center justify-center px-3 cursor-pointer group min-w-[70px] bg-transparent border-none" on:click={openDatePicker}>
                    <span class="text-[10px] font-bold text-gray-400 leading-none uppercase">{displayDayOfWeek}</span>
                    <span class="text-sm font-black text-gray-800 leading-tight group-hover:text-indigo-600 transition-colors">{displayDateLabel}</span>
                </button>
                <input id="hidden-date-input" type="date" bind:value={selectedDate} class="absolute opacity-0 pointer-events-none w-0 h-0">
                <button class="w-8 h-8 flex items-center justify-center bg-white rounded-md text-gray-500 hover:text-indigo-600 hover:shadow-sm transition-all active:scale-95" on:click={() => changeDate(1)}>
                    <span class="material-icons-round text-lg">chevron_right</span>
                </button>
             </div>
          {/if}
        </div>

        {#if activeTab === 'handover' && selectedDate === getTodayStr()} <HandoverInput /> {/if}
        {#if activeTab === 'schedule'} <ShiftSchedule {activeTab} /> {:else} <TaskList {activeTab} on:taskClick={handleTaskClick} /> {/if}
      </div>
      <footer>Design by 3031 | Kho đang xem: {activeStoreId}</footer>
    </div>
  {/if}
  
  {#if showAdminModal} <AdminModal on:close={() => showAdminModal = false} on:switchTab={(e) => { activeTab = e.detail; showAdminModal = false; }} /> {/if}
  {#if showTaskModal && selectedTask} <TaskModal taskTitle={selectedTask.title} bind:note={noteInput} on:cancel={() => showTaskModal = false} on:confirm={confirmComplete} /> {/if}
  {#if showTour} <TourGuide steps={tourSteps} on:complete={() => { showTour = false; localStorage.setItem(tourKey, 'true'); }} /> {/if}
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
</style>