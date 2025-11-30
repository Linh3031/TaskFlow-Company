<script>
  // Version 5.0 - Multi-Store & Full Features Integration
  import { onMount, onDestroy } from 'svelte';
  import { db } from './lib/firebase';
  import { collection, onSnapshot, query, where, doc, setDoc, writeBatch, updateDoc, serverTimestamp } from 'firebase/firestore';
  import { currentUser, currentTasks, taskTemplate, DEFAULT_TEMPLATE, storeList } from './lib/stores.js';
  import { getTodayStr } from './lib/utils.js';

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
  
  let showTour = false;
  const tourKey = 'taskflow_v6_general_tour_seen';
  
  // TOUR 1: GIAO DIỆN TỔNG QUAN
  const tourSteps = [
    { 
        target: '.app-header', 
        title: '1. Trung Tâm Điều Khiển', 
        content: 'Chào mừng! Đây là nơi hiển thị thông tin User, trạng thái Online và các công cụ hỗ trợ nhanh.',
        action: () => { 
            activeTab = 'warehouse'; 
            showAdminModal = false; 
        }
    },
    { 
        target: '#tab-nav-container', 
        title: '2. Khu Vực Làm Việc', 
        content: 'Thanh điều hướng chính. Bạn có thể chuyển đổi linh hoạt giữa: Kho, Thu Ngân, Bàn Giao và Lịch Ca.' 
    },
    { 
        target: '#btn-admin', 
        title: '3. Nút Quản Trị', 
        content: 'Khu vực cấu hình hệ thống (Phân ca, Tạo user, Việc mẫu). <br><b>Lưu ý:</b> Chỉ tài khoản được cấp quyền <b>Admin</b> mới truy cập được.' 
    }
  ];

  let unsubStores = () => {};
  let unsubTemplate = () => {};
  let unsubTasks = () => {};

  onMount(() => {
    unsubStores = onSnapshot(collection(db, 'stores'), (snap) => {
        storeList.set(snap.docs.map(d => ({id:d.id, ...d.data()})));
    });

    if ($currentUser && !localStorage.getItem(tourKey)) {
        showTour = true;
    }
  });

  onDestroy(() => {
    unsubStores(); unsubTemplate(); unsubTasks();
  });

  $: if ($currentUser) {
      loadDataForUser($currentUser, selectedDate);
  }

  function loadDataForUser(user, dateStr) {
      unsubTemplate(); unsubTasks();
      const myStores = user.storeIds || (user.storeId ? [user.storeId] : []);
      const isSuperAdmin = user.role === 'super_admin';

      if (!isSuperAdmin && myStores.length > 0) {
          // Load template của kho đầu tiên (thường dùng chung logic) hoặc có thể cải tiến sau
          unsubTemplate = onSnapshot(doc(db, 'settings', `template_${myStores[0]}`), (docSnap) => {
              taskTemplate.set(docSnap.exists() ? docSnap.data() : DEFAULT_TEMPLATE);
          });

          // Load Task của TẤT CẢ các kho user quản lý
          const q = query(collection(db, 'tasks'), where('date', '==', dateStr), where('storeId', 'in', myStores));
          unsubTasks = onSnapshot(q, (snapshot) => {
              const tasks = [];
              snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
              currentTasks.set(tasks);

              // Logic tạo task tự động đầu ngày
              const isToday = dateStr === getTodayStr();
              if (isToday && tasks.length === 0 && user.role.includes('admin')) {
                  initializeDailyTasks(dateStr, myStores);
              }
          });
      } else {
          currentTasks.set([]);
      }
  }

  async function initializeDailyTasks(dateStr, storeIds) {
    const batch = writeBatch(db);
    const template = $taskTemplate;
    const currentDayOfWeek = new Date().getDay();

    storeIds.forEach(storeId => {
        ['warehouse', 'cashier'].forEach(type => {
            if (template[type]) {
                template[type].forEach(item => {
                   if (item.days && item.days.length > 0 && !item.days.includes(currentDayOfWeek)) {
                        return;
                    }
                    const newRef = doc(collection(db, 'tasks'));
                    const title = typeof item === 'object' ? item.title : item;
                    const time = typeof item === 'object' ? item.time : "00:00";
                    const isImportant = typeof item === 'object' ? (item.isImportant || false) : false;

                    batch.set(newRef, {
                        type, title, timeSlot: time, completed: false, completedBy: null, time: null, note: '',
                        createdBy: 'System', date: dateStr, storeId: storeId, isImportant: isImportant, timestamp: serverTimestamp()
                    });
                });
            }
        });
    });
    try { await batch.commit(); } catch(e) {}
  }

  function handleTaskClick(event) {
    const task = event.detail;
    if (task.completed) {
      if(confirm('Hoàn tác (Undo)?')) updateDoc(doc(db, 'tasks', task.id), { completed: false, completedBy: null, time: null, note: '' });
    } else {
      selectedTask = task; noteInput = ''; showTaskModal = true;
    }
  }

  function confirmComplete() {
    if (!selectedTask) return;
    const now = new Date();
    updateDoc(doc(db, 'tasks', selectedTask.id), {
      completed: true, completedBy: $currentUser.name || $currentUser.username, 
      time: `${now.getHours()}:${now.getMinutes()<10?'0':''}${now.getMinutes()}`, note: noteInput
    });
    showTaskModal = false; selectedTask = null;
  }
</script>

<main>
  {#if !$currentUser} <Login /> {:else}
    <div class="app-container">
      <Header on:openAdmin={() => showAdminModal = true} on:openTour={() => showTour = true} on:openIosGuide={() => alert('Trên iPhone: Bấm nút Chia sẻ -> Chọn "Thêm vào MH chính"')} />
      
      <nav id="tab-nav-container" class="tab-nav">
        <button class="tab-btn {activeTab==='warehouse'?'active':''}" on:click={() => activeTab='warehouse'} style="--theme-color: #ff9800;">
          <div class="icon-box"><span class="material-icons-round">inventory_2</span></div><small>Kho</small>
        </button>
        <button class="tab-btn {activeTab==='cashier'?'active':''}" on:click={() => activeTab='cashier'} style="--theme-color: #4caf50;">
          <div class="icon-box"><span class="material-icons-round">point_of_sale</span></div><small>Thu Ngân</small>
        </button>
        <button class="tab-btn {activeTab==='handover'?'active':''}" on:click={() => activeTab='handover'} style="--theme-color: #673ab7;">
          <div class="icon-box"><span class="material-icons-round">campaign</span></div><small>Bàn Giao</small>
        </button>
        <button id="tab-schedule" class="tab-btn {activeTab==='schedule'?'active':''}" on:click={() => activeTab='schedule'} style="--theme-color: #e91e63;">
            <div class="icon-box"><span class="material-icons-round">calendar_month</span></div><small>Lịch Ca</small>
        </button>
      </nav>

      <div id="main-content" class="content-area">
        <div class="section-header {activeTab}-theme flex flex-col gap-2 items-start sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center justify-between w-full sm:w-auto">
              <h3>
                 {#if $currentUser.role === 'super_admin'}🛡️ Super Admin View
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
            <div id="date-picker-container" class="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded-lg border border-gray-200 w-full sm:w-auto">
                <span class="material-icons-round text-gray-500 text-sm">calendar_today</span>
                <input type="date" bind:value={selectedDate} class="bg-transparent border-none outline-none text-sm font-bold text-gray-700 w-full sm:w-auto">
            </div>
          {/if}
        </div>

        {#if activeTab === 'handover' && selectedDate === getTodayStr()} <HandoverInput /> {/if}
        
        {#if activeTab === 'schedule'} <ShiftSchedule {activeTab} /> {:else} <TaskList {activeTab} on:taskClick={handleTaskClick} /> {/if}
      </div>
      <footer>Design by 3031 | {#if $currentUser.role === 'super_admin'} Super Admin {:else} Kho: {$currentUser.storeIds?.join(', ')} {/if}</footer>
    </div>
  {/if}
  
  {#if showAdminModal} 
    <AdminModal 
        on:close={() => showAdminModal = false} 
        on:switchTab={(e) => {
             activeTab = e.detail;
             showAdminModal = false;
        }}
    /> 
  {/if}
  
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