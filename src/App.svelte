<script>
  // Version 7.0 - Group Logic & History Log Support
  import { onMount, onDestroy, tick } from 'svelte';
  import { db } from './lib/firebase';
  import { collection, onSnapshot, query, where, doc, updateDoc, arrayUnion } from 'firebase/firestore'; // Added arrayUnion
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
  
  let showTour = false;
  const tourKey = 'taskflow_v6_general_tour_seen';
  const tourSteps = [];

  let unsubStores = () => {};
  let unsubTemplate = () => {};
  let unsubTasks = () => {};

  onMount(() => {
    unsubStores = onSnapshot(collection(db, 'stores'), (snap) => {
        storeList.set(snap.docs.map(d => ({id:d.id, ...d.data()})));
    });
    if ($currentUser && !localStorage.getItem(tourKey)) showTour = true;
  });

  onDestroy(() => { unsubStores(); unsubTemplate(); unsubTasks(); });

  $: if ($currentUser) loadDataForUser($currentUser, selectedDate);

  function loadDataForUser(user, dateStr) {
      unsubTemplate(); unsubTasks();
      const myStores = user.storeIds || (user.storeId ? [user.storeId] : []);
      
      if (myStores.length > 0) {
          unsubTemplate = onSnapshot(doc(db, 'settings', `template_${myStores[0]}`), (docSnap) => {
              taskTemplate.set(docSnap.exists() ? docSnap.data() : DEFAULT_TEMPLATE);
          });
          
          const q = query(collection(db, 'tasks'), where('date', '==', dateStr), where('storeId', 'in', myStores));
          unsubTasks = onSnapshot(q, (snapshot) => {
              const tasks = [];
              snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
              currentTasks.set(tasks);
          });
      } else { currentTasks.set([]); }
  }

  // UPDATE 1: Ghi log khi Hoàn tác (Undo)
  function handleTaskClick(event) {
    const task = event.detail;
    if (task.completed) {
      if(confirm('Hoàn tác (Undo)?')) {
          const user = $currentUser.name || $currentUser.username;
          const time = getCurrentTimeShort();
          updateDoc(doc(db, 'tasks', task.id), { 
              completed: false, 
              // completedBy: null, // Không xóa người làm cũ để giữ dấu vết nếu cần (hoặc xóa tùy bạn)
              // time: null,
              history: arrayUnion({ action: 'undo', user, time, fullTime: new Date().toISOString() })
          });
      }
    } else {
      selectedTask = task; noteInput = ''; showTaskModal = true;
    }
  }

  // UPDATE 2: Ghi log khi Hoàn thành (Done)
  function confirmComplete() {
    if (!selectedTask) return;
    const user = $currentUser.name || $currentUser.username;
    const time = getCurrentTimeShort();
    
    updateDoc(doc(db, 'tasks', selectedTask.id), {
      completed: true, 
      completedBy: user, 
      time: time, 
      note: noteInput,
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
      } else {
          alert("Không tìm thấy công việc này trong ngày hiện tại!");
      }
  }
</script>

<main>
  {#if !$currentUser} <Login /> {:else}
    <div class="app-container">
      <Header on:openAdmin={() => showAdminModal = true} on:openTour={() => showTour = true} on:openIosGuide={() => alert('Trên iPhone: Bấm nút Chia sẻ -> Chọn "Thêm vào MH chính"')} 
              on:jumpToTask={handleJumpToTask} />
      
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
    <AdminModal on:close={() => showAdminModal = false} on:switchTab={(e) => { activeTab = e.detail; showAdminModal = false; }} /> 
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