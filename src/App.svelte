<script>
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

  let activeTab = 'warehouse';
  let showAdminModal = false;
  let showTaskModal = false;
  let selectedTask = null;
  let noteInput = '';
  
  // --- LOGIC LỊCH SỬ ---
  let selectedDate = getTodayStr(); 

  // --- LOGIC TOUR GUIDE (KỊCH BẢN ĐẦY ĐỦ) ---
  let showTour = false;
  const tourKey = 'taskflow_v6_tour_seen'; // Đổi key để user cũ cũng thấy lại tour mới
  
  const tourSteps = [
    { target: '.app-header', title: 'Xin chào!', content: 'Chào mừng bạn đến với TaskFlow. Đây là trung tâm điều khiển của bạn.' },
    { target: '#btn-install', title: 'Cài đặt App', content: 'Bấm vào đây để tải App về máy, giúp truy cập nhanh và mượt mà hơn.' },
    { target: '#date-picker-container', title: 'Xem Lịch Sử', content: 'Bạn có thể chọn ngày quá khứ tại đây để xem lại ai đã làm gì vào ngày hôm đó.' },
    { target: '.tab-nav', title: 'Chọn Khu Vực', content: 'Chuyển đổi giữa danh sách việc Kho, Thu Ngân và Bàn Giao ca.' },
    { target: '#demo-task', title: 'Thao tác', content: 'Đây là ví dụ. Hãy BẤM VÀO DÒNG NÀY để xác nhận hoàn thành hoặc hoàn tác.' },
    { target: '#btn-admin', title: 'Quản trị', content: 'Dành cho Quản lý: Tạo công việc mẫu, cấp tài khoản nhân viên và cấu hình kho.' },
    { target: 'footer', title: 'Thông tin Kho', content: 'Hiển thị mã kho hiện tại. Nếu quản lý nhiều kho, mã sẽ hiện cạnh tên công việc.' },
    { target: '#btn-help', title: 'Xem lại', content: 'Quên cách dùng? Bấm vào dấu chấm hỏi này để xem lại hướng dẫn nhé!' }
  ];

  // Variables for unsubscribing
  let unsubStores = () => {};
  let unsubTemplate = () => {};
  let unsubTasks = () => {};

  // 1. INIT
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

  // 2. REACTIVE DATA LOADING
  $: if ($currentUser) {
      loadDataForUser($currentUser, selectedDate);
  }

  function loadDataForUser(user, dateStr) {
      unsubTemplate(); unsubTasks();

      const myStores = user.storeIds || (user.storeId ? [user.storeId] : []);
      const isSuperAdmin = user.role === 'super_admin';

      if (!isSuperAdmin && myStores.length > 0) {
          unsubTemplate = onSnapshot(doc(db, 'settings', `template_${myStores[0]}`), (docSnap) => {
              taskTemplate.set(docSnap.exists() ? docSnap.data() : DEFAULT_TEMPLATE);
          });

          const q = query(collection(db, 'tasks'), where('date', '==', dateStr), where('storeId', 'in', myStores));
          
          unsubTasks = onSnapshot(q, (snapshot) => {
              const tasks = [];
              snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
              currentTasks.set(tasks);

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
    storeIds.forEach(storeId => {
        ['warehouse', 'cashier'].forEach(type => {
            if (template[type]) {
                template[type].forEach(item => {
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
  {#if !$currentUser}
    <Login />
  {:else}
    <div class="app-container">
      <Header 
        on:openAdmin={() => showAdminModal = true} 
        on:openTour={() => showTour = true} 
        on:openIosGuide={() => alert('Trên iPhone: Bấm nút Chia sẻ -> Chọn "Thêm vào MH chính"')} 
      />

      <nav class="tab-nav">
        <button class="tab-btn {activeTab==='warehouse'?'active':''}" on:click={() => activeTab='warehouse'} style="--theme-color: #ff9800;">
          <div class="icon-box"><span class="material-icons-round">inventory_2</span></div><small>Kho</small>
        </button>
        <button class="tab-btn {activeTab==='cashier'?'active':''}" on:click={() => activeTab='cashier'} style="--theme-color: #4caf50;">
          <div class="icon-box"><span class="material-icons-round">point_of_sale</span></div><small>Thu Ngân</small>
        </button>
        <button class="tab-btn {activeTab==='handover'?'active':''}" on:click={() => activeTab='handover'} style="--theme-color: #673ab7;">
          <div class="icon-box"><span class="material-icons-round">campaign</span></div><small>Bàn Giao</small>
        </button>
      </nav>

      <div class="content-area">
        <div class="section-header {activeTab}-theme flex flex-col gap-2 items-start sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center justify-between w-full sm:w-auto">
              <h3>
                {#if $currentUser.role === 'super_admin'}🛡️ Super Admin View
                {:else}
                    {#if activeTab==='warehouse'}📦 Checklist Kho{/if}
                    {#if activeTab==='cashier'}💰 Checklist Thu Ngân{/if}
                    {#if activeTab==='handover'}📢 Bàn Giao Ca{/if}
                {/if}
              </h3>
              <span class="task-count ml-2">{$currentTasks.filter(t => t.type === activeTab && !t.completed).length} chưa xong</span>
          </div>
          
          <div id="date-picker-container" class="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded-lg border border-gray-200 w-full sm:w-auto">
              <span class="material-icons-round text-gray-500 text-sm">calendar_today</span>
              <input type="date" bind:value={selectedDate} class="bg-transparent border-none outline-none text-sm font-bold text-gray-700 w-full sm:w-auto">
          </div>
        </div>

        {#if activeTab === 'handover' && selectedDate === getTodayStr()} <HandoverInput /> {/if}
        
        {#if showTour}
            <div id="demo-task" class="w-full bg-white p-4 mb-4 rounded-xl flex items-start gap-3 shadow-lg border-l-4 border-l-orange-500 animate-pulse relative z-10 cursor-pointer">
                <div class="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0 mt-0.5"></div>
                <div class="flex-1 text-left">
                    <div class="text-sm font-semibold text-gray-800 leading-snug">
                        <span class="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded mr-1 font-bold">[DEMO]</span>
                        Ví dụ: Kiểm tra hàng hóa đầu ca
                    </div>
                    <div class="flex flex-wrap gap-2 mt-2">
                        <span class="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                            <span class="material-icons-round text-[10px]">schedule</span> 08:00
                        </span>
                    </div>
                </div>
            </div>
        {/if}

        <TaskList {activeTab} on:taskClick={handleTaskClick} />
      </div>

      <footer>
        Design by 3031 | 
        {#if $currentUser.role === 'super_admin'} Super Admin
        {:else} Kho: {$currentUser.storeIds?.join(', ')}
        {/if}
      </footer>
    </div>
  {/if}
  
  {#if showAdminModal} <AdminModal on:close={() => showAdminModal = false} /> {/if}
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