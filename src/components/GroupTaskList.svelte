<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { db } from '../lib/firebase';
  import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, setDoc, getDocs, getDoc, deleteField } from 'firebase/firestore';
  import { currentUser, activeStoreId, storeUsersCache } from '../lib/stores';
  import { getTodayStr } from '../lib/utils'; 
  
  import GroupTaskHeader from './GroupTaskParts/GroupTaskHeader.svelte';
  import GroupTaskCard from './GroupTaskParts/GroupTaskCard.svelte';
  import GroupTaskCreateModal from './GroupTaskParts/GroupTaskCreateModal.svelte';
  import GroupTaskStatsModal from './GroupTaskParts/GroupTaskStatsModal.svelte';
  import LightboxModal from './DailyChecklistParts/LightboxModal.svelte';

  export let selectedDate; 

  const dispatch = createEventDispatcher();

  let tasks = [];
  let storeUsers = [];
  let activeUnsub = null;
  let completedUnsub = null;

  let targetFilter = 'ALL';
  let searchQuery = '';
  
  let showCreateModal = false;
  let editTaskData = null; 
  let showStatsModal = false;
  let selectedTaskForStats = null;
  
  let showLightbox = false;
  let lightboxImages = [];
  let lightboxIndex = 0;

  let activeTasksData = [];
  let completedTasksData = [];

  let undoData = null;
  let undoTimeout = null;

  $: currentStore = $activeStoreId || $currentUser?.storeIds?.[0] || '';
  $: isAdmin = $currentUser?.role === 'admin' || $currentUser?.role === 'super_admin';
  $: userRole = $currentUser?.role || 'staff';
  $: currentUid = $currentUser?.username ? String($currentUser.username).toLowerCase() : '';

  $: if (currentStore) { loadUsers(currentStore); }
  async function loadUsers(sid) {
    if ($storeUsersCache[sid]) { storeUsers = $storeUsersCache[sid]; return; }
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('storeIds', 'array-contains', String(sid))));
      const list = snap.docs.map(d => d.data());
      storeUsers = list;
      storeUsersCache.update(c => ({ ...c, [sid]: list }));
    } catch (e) { console.error("Lỗi kéo user kho:", e); }
  }

  $: if (currentStore && selectedDate) { setupRealtimeTasks(String(currentStore), selectedDate); }
  function setupRealtimeTasks(sid, dateStr) {
    if (activeUnsub) { activeUnsub(); activeUnsub = null; }
    if (completedUnsub) { completedUnsub(); completedUnsub = null; }
    
    const todayStr = getTodayStr();
    
    if (dateStr === todayStr) {
      const qActive = query(collection(db, 'group_tasks'), where('storeId', '==', sid), where('status', '==', 'active'));
      activeUnsub = onSnapshot(qActive, (snap) => {
        activeTasksData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateTasksList();
      });
    } else {
      activeTasksData = []; 
    }

    const qCompleted = query(collection(db, 'group_tasks'), where('storeId', '==', sid), where('status', '==', 'completed'), where('completedDate', '==', dateStr));
    completedUnsub = onSnapshot(qCompleted, (snap) => {
      completedTasksData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateTasksList();
    });
    
    updateTasksList();
  }

  function updateTasksList() {
    tasks = [...activeTasksData, ...completedTasksData]
      .filter(t => t.status !== 'deleted')
      .sort((a,b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
      });
  }

  $: myRelevantTasks = tasks.filter(t => {
    if (isAdmin) return true; 
    if (t.targetRole === 'ALL') return true;
    if (t.targetRole === 'PG' && userRole === 'pg') return true;
    if (t.targetRole === 'STAFF' && userRole !== 'pg') return true;
    return false;
  });

  $: filteredTasks = myRelevantTasks.filter(t => {
    if (targetFilter !== 'ALL' && t.targetRole !== targetFilter) return false;
    if (!searchQuery) return true;
    return t.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  $: {
    if (isAdmin) {
      dispatch('updateBadge', tasks.filter(t => t.status === 'active' && (t.submittedCount || 0) < t.totalStaff).length);
    } else {
      const unsubmitted = myRelevantTasks.filter(t => t.status === 'active' && !(t.submittedUids || []).includes(currentUid));
      dispatch('updateBadge', unsubmitted.length);
    }
  }

  async function handleCreateTask(e) {
    const { title, deadline, targetRole, totalStaff, requireImage } = e.detail;
    try {
      await addDoc(collection(db, 'group_tasks'), {
        storeId: String(currentStore),
        title,
        deadline,
        targetRole,
        totalStaff,
        requireImage: requireImage,
        submittedCount: 0,
        submittedUids: [],
        status: 'active',
        createdBy: $currentUser?.name || $currentUser?.username || 'Admin',
        createdAt: serverTimestamp()
      });
      showCreateModal = false;
    } catch (err) { alert("Lỗi tạo việc: " + err.message); }
  }

  async function handleUpdateTask(e) {
    const { id, title, deadline, targetRole, totalStaff, requireImage } = e.detail;
    try {
      await updateDoc(doc(db, 'group_tasks', id), {
        title, deadline, targetRole, totalStaff, requireImage
      });
      showCreateModal = false;
      editTaskData = null;
    } catch (err) { alert("Lỗi cập nhật: " + err.message); }
  }

  async function handleDeleteTask(taskId) {
    if (!confirm("Xác nhận xóa công việc này?")) return;
    const targetTask = tasks.find(t => t.id === taskId);
    undoData = { id: taskId, status: targetTask.status };
    try {
      await updateDoc(doc(db, 'group_tasks', taskId), { status: 'deleted' });
      if (undoTimeout) clearTimeout(undoTimeout);
      undoTimeout = setTimeout(() => { undoData = null; }, 6000);
    } catch (err) { alert("Lỗi xóa: " + err.message); }
  }

  async function handleUndoDelete() {
    if (!undoData) return;
    try {
      await updateDoc(doc(db, 'group_tasks', undoData.id), { status: undoData.status });
      undoData = null;
      if (undoTimeout) clearTimeout(undoTimeout);
    } catch (err) { alert("Lỗi hoàn tác: " + err.message); }
  }

  async function handleSubmitProof(e) {
    const { taskId, imageUrl, username, name } = e.detail;
    try {
      const uid = String(username).toLowerCase();
      const subRef = doc(db, 'group_tasks', taskId, 'submissions', uid);
      
      const subSnap = await getDoc(subRef);
      let history = [];
      if (subSnap.exists()) {
          const oldData = subSnap.data();
          history = oldData.history || [];
          if (oldData.imageUrl || oldData.submittedAt) {
              history.push({
                  imageUrl: oldData.imageUrl || null,
                  submittedAt: oldData.submittedAt || new Date().toISOString()
              });
          }
      }

      await setDoc(subRef, {
        imageUrl: imageUrl || null,
        username,
        name,
        submittedAt: new Date().toISOString(),
        history: history
      });

      const taskRef = doc(db, 'group_tasks', taskId);
      const targetTask = tasks.find(t => t.id === taskId);
      const newUids = Array.from(new Set([...(targetTask?.submittedUids || []), uid]));
      const newCount = newUids.length;
      
      const updateData = { submittedUids: newUids, submittedCount: newCount };
      if (targetTask && newCount >= targetTask.totalStaff) {
        updateData.status = 'completed'; 
        updateData.completedDate = getTodayStr(); 
        
        // [CodeGenesis] Chống hố đen khi auto-complete
        activeTasksData = activeTasksData.filter(t => t.id !== taskId);
        completedTasksData = [{ ...targetTask, ...updateData }, ...completedTasksData];
        updateTasksList();
      }
      await updateDoc(taskRef, updateData);
    } catch (err) { alert("Lỗi ghi nhận điểm danh: " + err.message); }
  }

  async function handleForceClose(taskId) {
    if (!confirm("Bạn có chắc muốn chốt kết thúc công việc này?")) return;
    
    // [CodeGenesis] Bốc task thẳng từ mảng Active sang mảng Completed ngay lập tức
    const target = activeTasksData.find(t => t.id === taskId) || tasks.find(t => t.id === taskId);
    if (target) {
        activeTasksData = activeTasksData.filter(t => t.id !== taskId);
        completedTasksData = [{ ...target, status: 'completed', completedDate: getTodayStr() }, ...completedTasksData];
        updateTasksList();
    }

    try { 
      await updateDoc(doc(db, 'group_tasks', taskId), { status: 'completed', completedDate: getTodayStr() }); 
    } catch (err) { alert("Lỗi đóng việc: " + err.message); }
  }

  async function handleUndoClose(taskId) {
    if (!confirm("Bạn muốn mở lại công việc này để nhân viên tiếp tục điểm danh?")) return;
    
    // [CodeGenesis] Cứu task khỏi "hố đen" bằng cách ném thẳng nó vào mảng Active trước cả khi Firebase kịp báo
    const target = completedTasksData.find(t => t.id === taskId) || tasks.find(t => t.id === taskId);
    if (target) {
        completedTasksData = completedTasksData.filter(t => t.id !== taskId);
        activeTasksData = [{ ...target, status: 'active', completedDate: null }, ...activeTasksData];
        updateTasksList();
    }

    try {
      await updateDoc(doc(db, 'group_tasks', taskId), { status: 'active', completedDate: deleteField() });
    } catch (err) { alert("Lỗi mở lại: " + err.message); }
  }

  function openLightboxHandler(e) {
    lightboxImages = e.detail.images;
    lightboxIndex = e.detail.index || 0;
    showLightbox = true;
  }

  onDestroy(() => { 
    if (activeUnsub) activeUnsub(); 
    if (completedUnsub) completedUnsub(); 
    if (undoTimeout) clearTimeout(undoTimeout);
  });
</script>

<div class="w-full h-full flex flex-col bg-slate-50 overflow-hidden relative">
  <GroupTaskHeader {isAdmin} bind:targetFilter bind:searchQuery on:openCreate={() => { editTaskData = null; showCreateModal = true; }} />

  <div class="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
    {#each filteredTasks as task (task.id)}
      <GroupTaskCard {task} currentUser={$currentUser} {isAdmin} 
        on:submitProof={handleSubmitProof} 
        on:openStats={(e) => { selectedTaskForStats = e.detail; showStatsModal = true; }}
        on:forceClose={(e) => handleForceClose(e.detail)}
        on:undoClose={(e) => handleUndoClose(e.detail)}
        on:editTask={(e) => { editTaskData = e.detail; showCreateModal = true; }}
        on:deleteTask={(e) => handleDeleteTask(e.detail)}
        on:openLightbox={openLightboxHandler}
      />
    {/each}

    {#if filteredTasks.length === 0}
      <div class="text-center py-16 flex flex-col items-center justify-center text-slate-400">
        <span class="material-icons-round text-5xl mb-2 opacity-30">task_alt</span>
        <p class="font-bold text-sm">Không có công việc tập thể nào đang cần điểm danh.</p>
      </div>
    {/if}
  </div>

  {#if undoData}
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-6 z-50 animate-slideUp">
      <span class="text-sm font-bold flex items-center gap-2"><span class="material-icons-round text-red-400 text-[18px]">delete_sweep</span> Đã xóa công việc</span>
      <button class="text-purple-400 hover:text-purple-300 font-bold text-sm uppercase tracking-wider hover:underline transition-all" on:click={handleUndoDelete}>Hoàn tác</button>
    </div>
  {/if}
</div>

<GroupTaskCreateModal bind:show={showCreateModal} {storeUsers} {editTaskData} 
  on:create={handleCreateTask} 
  on:update={handleUpdateTask} 
  on:close={() => { showCreateModal = false; editTaskData = null; }} />
<GroupTaskStatsModal bind:show={showStatsModal} task={selectedTaskForStats} {storeUsers} on:close={() => { showStatsModal = false; selectedTaskForStats = null; }} on:openLightbox={openLightboxHandler} />
<LightboxModal show={showLightbox} images={lightboxImages} currentIndex={lightboxIndex} on:close={() => showLightbox = false} on:updateIndex={(e) => lightboxIndex = e.detail} />

<style>
  .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
  @keyframes slideUp { from { opacity: 0; transform: translateY(100%) translateX(-50%); } to { opacity: 1; transform: translateY(0) translateX(-50%); } }
</style>