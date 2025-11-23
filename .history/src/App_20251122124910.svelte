<script>
  import { onMount } from 'svelte';
  import { db } from './lib/firebase';
  import { collection, onSnapshot, query, where, doc, setDoc, writeBatch, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
  import { currentUser, currentTasks, taskTemplate, DEFAULT_TEMPLATE, storeList } from './lib/stores.js'; // Import storeList
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

  onMount(async () => {
    // 1. MỚI: Luôn tải danh sách kho (cho Dropdown Login)
    const unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
        const stores = [];
        snapshot.forEach(doc => stores.push({ id: doc.id, ...doc.data() }));
        storeList.set(stores);
    });

    // 2. Logic User (Giữ nguyên logic cũ nhưng thêm check null)
    if ($currentUser) {
        const myStoreId = $currentUser.storeId;
        
        // Nếu là Super Admin thì không cần load template/task theo kho cụ thể ở App chính
        // (Hoặc có thể load mặc định cái gì đó, ở đây ta tạm bỏ qua để tránh lỗi)
        if($currentUser.role === 'super_admin') {
            // Super Admin Logic (Optional)
        } else if (myStoreId) {
            // Logic Admin/Staff Kho
            const templateDocId = `template_${myStoreId}`;
            const unsubTemplate = onSnapshot(doc(db, 'settings', templateDocId), (docSnap) => {
                if (docSnap.exists()) taskTemplate.set(docSnap.data());
                else taskTemplate.set(DEFAULT_TEMPLATE);
            });

            const today = getTodayStr();
            const q = query(collection(db, 'tasks'), where('date', '==', today), where('storeId', '==', myStoreId));
            const unsubTasks = onSnapshot(q, (snapshot) => {
                const tasks = [];
                snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
                currentTasks.set(tasks);
                if (tasks.length === 0 && $currentUser.role.includes('admin')) {
                    initializeDailyTasks(today, myStoreId);
                }
            });
        }
    }
  });

  // ... (Giữ nguyên các hàm initializeDailyTasks, handleTaskClick, confirmComplete từ phiên bản trước)
  // Chú ý: Copy lại hàm initializeDailyTasks từ phản hồi trước của tôi vào đây
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
            type, title, timeSlot: time, completed: false, completedBy: null, time: null, note: '',
            createdBy: 'System', date: today, storeId: storeId, timestamp: serverTimestamp()
          });
        });
      }
    });
    await batch.commit();
  }

  function handleTaskClick(event) { /* ...code cũ... */ 
    const task = event.detail;
    if (task.completed) {
      if(confirm('Hoàn tác?')) updateDoc(doc(db, 'tasks', task.id), { completed: false, completedBy: null, time: null, note: '' });
    } else {
      selectedTask = task; noteInput = ''; showTaskModal = true;
    }
  }
  
  function confirmComplete() { /* ...code cũ... */ 
    if (!selectedTask) return;
    const now = new Date();
    updateDoc(doc(db, 'tasks', selectedTask.id), {
      completed: true, completedBy: $currentUser.name, time: `${now.getHours()}:${now.getMinutes()}`, note: noteInput
    });
    showTaskModal = false; selectedTask = null;
  }
</script>

<main>
  {#if !$currentUser}
    <Login />
  {:else}
    <div class="app-container">
      <Header on:openAdmin={() => showAdminModal = true} on:openIosGuide={() => alert('Hướng dẫn...')} />
      <div class="content-area">
         <div class="section-header {activeTab}-theme">
            <h3>Checklist {$currentUser.role === 'super_admin' ? '(Super Admin View)' : ''}</h3>
            <span class="task-count">{$currentTasks.filter(t => t.type === activeTab && !t.completed).length} chưa xong</span>
         </div>
         {#if activeTab === 'handover'} <HandoverInput /> {/if}
         <TaskList {activeTab} on:taskClick={handleTaskClick} />
      </div>

      <footer>Design by 3031 | Kho: {$currentUser.storeId || 'Super Admin'}</footer>
    </div>
  {/if}
  
  {#if showAdminModal} <AdminModal on:close={() => showAdminModal = false} /> {/if}
  {#if showTaskModal && selectedTask} <TaskModal taskTitle={selectedTask.title} bind:note={noteInput} on:cancel={() => showTaskModal = false} on:confirm={confirmComplete} /> {/if}
</main>

<style>
  main { width: 100%; height: 100%; }
  .app-container { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-body); }
  .content-area { flex-grow: 1; overflow: hidden; position: relative; display: flex; flex-direction: column; padding: 10px; }
  /* ... Copy lại style cũ ... */
</style>