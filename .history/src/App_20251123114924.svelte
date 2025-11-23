<script>
  import { onMount } from 'svelte';
  // ... imports cũ ...
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
  import TourGuide from './components/TourGuide.svelte'; // Import mới

  // State cũ
  let activeTab = 'warehouse';
  let showAdminModal = false;
  let showTaskModal = false;
  let selectedTask = null;
  let noteInput = '';
  
  // State Tour Guide
  let showTour = false;
  let tourKey = 'taskflow_tour_completed_v1'; // Key lưu trạng thái đã xem

  // Cấu hình các bước Tour
  const tourSteps = [
    { target: '.app-header', title: 'Xin chào!', content: 'Chào mừng bạn đến với TaskFlow. Đây là thanh công cụ chính để cài đặt và xem thông tin cá nhân.' },
    { target: '.tab-nav', title: 'Khu vực làm việc', content: 'Chuyển đổi giữa các bộ phận: Kho, Thu Ngân và Bàn Giao ca tại đây.' },
    { target: '.content-area', title: 'Danh sách việc', content: 'Các công việc cần làm sẽ hiện ở đây. Bấm vào để xác nhận hoàn thành.' },
    { target: 'footer', title: 'Thông tin kho', content: 'Xem bạn đang làm việc tại kho nào ở đây.' }
  ];

  onMount(() => {
    // Logic tải dữ liệu cũ...
    const unsubStores = onSnapshot(collection(db, 'stores'), (snap) => storeList.set(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    
    // Logic User...
    if ($currentUser) {
        // Kiểm tra xem user đã xem tour chưa
        const hasSeenTour = localStorage.getItem(tourKey);
        if (!hasSeenTour) {
            showTour = true;
        }
        // ... Logic tải Template/Task cũ giữ nguyên ...
        // (Tôi rút gọn để bạn dễ nhìn, hãy giữ nguyên logic cũ của bạn ở đây)
        // ...
    }
    // ... Cleanup
  });

  // Hàm kích hoạt lại tour từ Header
  function restartTour() {
    showTour = true;
  }

  function finishTour() {
    showTour = false;
    localStorage.setItem(tourKey, 'true');
  }

  // ... Các hàm handleTaskClick, confirmComplete giữ nguyên ...
</script>

<main>
  {#if !$currentUser}
    <Login />
  {:else}
    <div class="app-container">
      <Header 
        on:openAdmin={() => showAdminModal = true} 
        on:openIosGuide={() => alert('...')} 
        on:openTour={restartTour} 
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
            <h3>Checklist</h3>
            <span class="task-count">...</span>
         </div>
         {#if activeTab === 'handover'} <HandoverInput /> {/if}
         <TaskList {activeTab} on:taskClick={handleTaskClick} />
      </div>

      <footer>Design by 3031 | Kho: {$currentUser.storeIds?.join(', ')}</footer>
    </div>
  {/if}
  
  {#if showAdminModal} <AdminModal on:close={() => showAdminModal = false} /> {/if}
  {#if showTaskModal} <TaskModal taskTitle={selectedTask.title} bind:note={noteInput} on:cancel={() => showTaskModal = false} on:confirm={confirmComplete} /> {/if}
  
  {#if showTour}
    <TourGuide steps={tourSteps} on:complete={finishTour} />
  {/if}
</main>