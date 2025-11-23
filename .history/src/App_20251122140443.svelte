<script>
  import { onMount } from 'svelte';
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

  let activeTab = 'warehouse';
  let showAdminModal = false;
  let showTaskModal = false;
  let selectedTask = null;
  let noteInput = '';

  onMount(() => {
    // 1. LUÔN LUÔN TẢI DANH SÁCH KHO (Cho Dropdown ở Login)
    const unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
        const stores = [];
        snapshot.forEach(doc => {
            stores.push({ id: doc.id, ...doc.data() });
        });
        storeList.set(stores);
    });

    // 2. LOGIC DỮ LIỆU NGƯỜI DÙNG
    let unsubTemplate = () => {};
    let unsubTasks = () => {};

    if ($currentUser) {
        const myStoreId = $currentUser.storeId;
        
        // Nếu là Super Admin, ta chưa load task cụ thể (vì Super Admin quản lý chung)
        // Nếu là Admin Kho hoặc Staff, ta load dữ liệu của kho đó
        if ($currentUser.role !== 'super_admin' && myStoreId) {
            
            // A. Đồng bộ Template riêng của Kho
            const templateDocId = `template_${myStoreId}`;
            unsubTemplate = onSnapshot(doc(db, 'settings', templateDocId), (docSnap) => {
                if (docSnap.exists()) {
                    taskTemplate.set(docSnap.data());
                } else {
                    taskTemplate.set(DEFAULT_TEMPLATE);
                    // Tự động tạo template mặc định cho kho mới nếu là Admin kho
                    if ($currentUser.role === 'admin') {
                        setDoc(doc(db, 'settings', templateDocId), DEFAULT_TEMPLATE);
                    }
                }
            });

            // B. Đồng bộ Task hôm nay của Kho
            const today = getTodayStr();
            const q = query(
                collection(db, 'tasks'), 
                where('date', '==', today),
                where('storeId', '==', myStoreId)
            );

            unsubTasks = onSnapshot(q, (snapshot) => {
                const tasks = [];
                snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
                currentTasks.set(tasks);

                // Tự động tạo task ngày mới nếu chưa có (Chỉ Admin kho kích hoạt)
                if (tasks.length === 0 && $currentUser.role === 'admin') {
                    initializeDailyTasks(today, myStoreId);
                }
            });
        }
    }

    // Cleanup khi thoát
    return () => {
        unsubStores();
        unsubTemplate();
        unsubTasks();
    };
  });

  async function initializeDailyTasks(today, storeId) {
    const batch = writeBatch(db);
    const template = $taskTemplate;

    ['warehouse', 'cashier'].forEach(type => {
      if (template[type]) {
        template[type].forEach(item => {
          const title = typeof item === 'object' ? item.title : item;
          const time = typeof item === 'object' ? item.time : "00:00";
          
          const newRef = doc(collection(db, 'tasks'));
          batch.set(newRef, {
            type, 
            title, 
            timeSlot: time,
            completed: false, 
            completedBy: null, 
            time: null, 
            note: '',
            createdBy: 'System', 
            date: today, 
            storeId: storeId, // GẮN MÃ KHO
            timestamp: serverTimestamp()
          });
        });
      }
    });
    await batch.commit();
  }

  function handleTaskClick(event) {
    const task = event.detail;
    if (task.completed) {
      if(confirm('Hoàn tác (Undo) công việc này?')) {
        updateDoc(doc(db, 'tasks', task.id), {
          completed: false, completedBy: null, time: null, note: ''
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
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes()<10?'0':''}${now.getMinutes()}`;
    
    updateDoc(doc(db, 'tasks', selectedTask.id), {
      completed: true, 
      completedBy: $currentUser.name || $currentUser.username, 
      time: timeStr,
      note: noteInput
    });
    showTaskModal = false;
    selectedTask = null;
  }
</script>

<main>
  {#if !$currentUser}
    <Login />
  {:else}
    <div class="app-container">
      <Header 
        on:openAdmin={() => showAdminModal = true} 
        on:openIosGuide={() => alert('Trên iPhone: Bấm nút Chia sẻ -> Thêm vào MH chính')} 
      />

      <nav class="tab-nav">
        <button class="tab-btn {activeTab==='warehouse'?'active':''}" on:click={() => activeTab='warehouse'} style="--theme-color: #ff9800;">
          <div class="icon-box"><span class="material-icons-round">inventory_2</span></div>
          <small>Kho</small>
        </button>
        <button class="tab-btn {activeTab==='cashier'?'active':''}" on:click={() => activeTab='cashier'} style="--theme-color: #4caf50;">
          <div class="icon-box"><span class="material-icons-round">point_of_sale</span></div>
          <small>Thu Ngân</small>
        </button>
        <button class="tab-btn {activeTab==='handover'?'active':''}" on:click={() => activeTab='handover'} style="--theme-color: #673ab7;">
          <div class="icon-box"><span class="material-icons-round">campaign</span></div>
          <small>Bàn Giao</small>
        </button>
      </nav>

      <div class="content-area">
        <div class="section-header {activeTab}-theme">
          <h3>
            {#if $currentUser.role === 'super_admin'}
                🛡️ Super Admin View
            {:else}
                {#if activeTab==='warehouse'}📦 Checklist Kho{/if}
                {#if activeTab==='cashier'}💰 Checklist Thu Ngân{/if}
                {#if activeTab==='handover'}📢 Bàn Giao Ca{/if}
            {/if}
          </h3>
          <span class="task-count">{$currentTasks.filter(t => t.type === activeTab && !t.completed).length} chưa xong</span>
        </div>

        {#if activeTab === 'handover'}
          <HandoverInput />
        {/if}

        <TaskList {activeTab} on:taskClick={handleTaskClick} />
      </div>

      <footer>
        Design by 3031 | 
        {#if $currentUser.role === 'super_admin'}
             Super Admin
        {:else}
             Kho: {$currentUser.storeId}
        {/if}
      </footer>
    </div>
  {/if}
  
  {#if showAdminModal} 
    <AdminModal on:close={() => showAdminModal = false} /> 
  {/if}

  {#if showTaskModal && selectedTask}
    <TaskModal 
      taskTitle={selectedTask.title} 
      bind:note={noteInput}
      on:cancel={() => showTaskModal = false}
      on:confirm={confirmComplete}
    />
  {/if}
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
  .section-header { flex-shrink: 0; padding: 10px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .section-header h3 { font-size: 1rem; margin: 0; font-weight: 700; }
  .task-count { background: rgba(0,0,0,0.05); padding: 4px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 800; color: #555; }
  footer { flex-shrink: 0; text-align: center; padding: 10px; color: #999; font-size: 0.75rem; font-weight: 700; background: #f4f7fc; }
</style>