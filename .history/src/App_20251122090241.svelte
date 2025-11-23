<script>
  import { onMount } from 'svelte';
  import { db } from './lib/firebase';
  import { collection, onSnapshot, query, where, doc, setDoc, writeBatch, updateDoc, serverTimestamp } from 'firebase/firestore';
  import { currentUser, currentTasks, taskTemplate, DEFAULT_TEMPLATE } from './lib/stores.js';
  import { getTodayStr } from './lib/utils.js';

  // Components
  import Login from './components/Login.svelte';
  import Header from './components/Header.svelte';
  import TaskList from './components/TaskList.svelte';
  import HandoverInput from './components/HandoverInput.svelte';
  
  // Modals (Sẽ tạo ở bước sau - tạm thời comment để không lỗi)
  // import AdminModal from './components/AdminModal.svelte';
  // import TaskModal from './components/TaskModal.svelte';

  let activeTab = 'warehouse';
  let showAdminModal = false;
  let showTaskModal = false;
  let selectedTask = null;

  // --- SYNC LOGIC ---
  onMount(() => {
    // 1. Sync Template
    const unsubTemplate = onSnapshot(doc(db, 'settings', 'template'), (docSnap) => {
      if (docSnap.exists()) {
        taskTemplate.set(docSnap.data());
      } else {
        taskTemplate.set(DEFAULT_TEMPLATE);
        if ($currentUser?.role === 'admin') {
          setDoc(doc(db, 'settings', 'template'), DEFAULT_TEMPLATE);
        }
      }
    });

    // 2. Sync Tasks Today
    const today = getTodayStr();
    const q = query(collection(db, 'tasks'), where('date', '==', today));
    const unsubTasks = onSnapshot(q, (snapshot) => {
      const tasks = [];
      snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
      currentTasks.set(tasks);

      // Auto Init Daily Tasks
      if (tasks.length === 0 && $currentUser?.role === 'admin') {
        initializeDailyTasks(today);
      }
    });

    return () => { unsubTemplate(); unsubTasks(); };
  });

  async function initializeDailyTasks(today) {
    const batch = writeBatch(db);
    const template = $taskTemplate;

    ['warehouse', 'cashier'].forEach(type => {
      if (template[type]) {
        template[type].forEach(item => {
          const title = typeof item === 'object' ? item.title : item;
          const time = typeof item === 'object' ? item.time : "00:00";
          const newRef = doc(collection(db, 'tasks'));
          batch.set(newRef, {
            type, title, timeSlot: time,
            completed: false, completedBy: null, time: null, note: '',
            createdBy: 'System', date: today, timestamp: serverTimestamp()
          });
        });
      }
    });
    await batch.commit();
  }

  // --- UI HANDLERS ---
  function handleTaskClick(event) {
    const task = event.detail;
    if (task.completed) {
      if(confirm('Hoàn tác công việc này?')) {
        updateDoc(doc(db, 'tasks', task.id), {
          completed: false, completedBy: null, time: null, note: ''
        });
      }
    } else {
      selectedTask = task;
      // showTaskModal = true; // Sẽ mở khi có modal
      // Tạm thời check luôn để test
      const now = new Date();
      const timeStr = `${now.getHours()}:${now.getMinutes()<10?'0':''}${now.getMinutes()}`;
      updateDoc(doc(db, 'tasks', task.id), {
        completed: true, 
        completedBy: $currentUser.name || $currentUser.username, 
        time: timeStr
      });
    }
  }
</script>

<main>
  {#if !$currentUser}
    <Login />
  {:else}
    <div class="app-container">
      <Header 
        on:openAdmin={() => showAdminModal = true} 
        on:openIosGuide={() => alert('Hãy bấm Chia sẻ -> Thêm vào MH chính')} 
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
        <div class="section-header {activeTab}-theme">
          <h3>
            {#if activeTab==='warehouse'}📦 Checklist Kho{/if}
            {#if activeTab==='cashier'}💰 Checklist Thu Ngân{/if}
            {#if activeTab==='handover'}📢 Bàn Giao Ca{/if}
          </h3>
          <span class="task-count">{$currentTasks.filter(t => t.type === activeTab && !t.completed).length} chưa xong</span>
        </div>

        {#if activeTab === 'handover'}
          <HandoverInput />
        {/if}

        <TaskList {activeTab} on:taskClick={handleTaskClick} />
      </div>

      <footer>Design by 3031</footer>
    </div>
  {/if}
  
  </main>

<style>
  :global(body) { margin: 0; padding: 0; background: #f4f7fc; color: #333; font-family: 'Nunito', sans-serif; height: 100dvh; width: 100vw; overflow: hidden; }
  main { height: 100%; width: 100%; }
  .app-container { display: flex; flex-direction: column; height: 100%; }
  
  .tab-nav { flex-shrink: 0; background: #fff; padding: 8px 10px; display: flex; gap: 10px; justify-content: space-between; border-bottom: 1px solid #eee; }
  .tab-btn { flex: 1; border: none; background: transparent; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; color: #bbb; }
  .icon-box { width: 40px; height: 28px; border-radius: 20px; display: flex; align-items: center; justify-content: center; transition: 0.3s; }
  .tab-btn.active { color: var(--theme-color); }
  .tab-btn.active .icon-box { background: var(--theme-color); color: white; width: 50px; box-shadow: 0 3px 8px rgba(0,0,0,0.2); }

  .content-area { flex-grow: 1; overflow: hidden; display: flex; flex-direction: column; padding: 15px; }
  
  .section-header { flex-shrink: 0; padding: 12px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .section-header h3 { margin: 0; font-size: 1rem; }
  .warehouse-theme { background: #fff3e0; color: #e65100; }
  .cashier-theme { background: #e8f5e9; color: #1b5e20; }
  .handover-theme { background: #ede7f6; color: #4527a0; }
  .task-count { background: rgba(255,255,255,0.7); padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; }

  footer { flex-shrink: 0; text-align: center; padding: 10px; color: #555; font-size: 0.75rem; font-weight: 700; background: #eef2f6; border-top: 1px solid #ddd; }
</style>