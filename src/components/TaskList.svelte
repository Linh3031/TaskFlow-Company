<script>
  // Version 44.0 - [CodeGenesis] Ẩn tiêu đề "Khác" cho tab Bàn Giao
  import { createEventDispatcher } from 'svelte';
  import { currentTasks, currentUser } from '../lib/stores';
  import { formatDateTime, getCurrentTimeShort } from '../lib/utils';
  
  import { db } from '../lib/firebase';
  import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
  import LightboxModal from './DailyChecklistParts/LightboxModal.svelte';
  
  export let activeTab = 'warehouse';
  const dispatch = createEventDispatcher();

  $: myStores = $currentUser?.storeIds || [];
  $: showStoreBadge = myStores.length > 1;
  
  let expandedHistoryTaskId = null;
  let editingTaskId = null;
  let editTitle = '';
  let editDeadline = '';
  let editLoading = false;

  let showLightbox = false;
  let lightboxImages = [];
  let lightboxIndex = 0;

  $: filteredTasks = $currentTasks.filter(t => t.type === activeTab);

  $: groupedTasks = (() => {
      const groups = {};
      
      filteredTasks.forEach(task => {
          const timeKey = task.timeSlot || "Khác";
          if (!groups[timeKey]) {
              groups[timeKey] = { timeSlot: timeKey, tasks: [], allDone: true };
          }
          groups[timeKey].tasks.push(task);
          if (!task.completed && task.status !== 'failed') groups[timeKey].allDone = false;
      });

      const groupArray = Object.values(groups);

      groupArray.sort((a, b) => {
          if (a.allDone !== b.allDone) return a.allDone - b.allDone;
          return a.timeSlot.localeCompare(b.timeSlot);
      });

      groupArray.forEach(group => {
          group.tasks.sort((a, b) => {
             const statusScoreA = a.completed ? 2 : (a.status === 'failed' ? 1 : 0);
             const statusScoreB = b.completed ? 2 : (b.status === 'failed' ? 1 : 0);
             if (statusScoreA !== statusScoreB) return statusScoreA - statusScoreB; 
             
             const impA = a.isImportant ? 1 : 0;
             const impB = b.isImportant ? 1 : 0;
             if (impA !== impB) return impB - impA;
             return (a.storeId||"").localeCompare(b.storeId||"");
          });
      });

      return groupArray;
  })();

  function toggleHistory(e, taskId) {
      e.stopPropagation();
      if (expandedHistoryTaskId === taskId) expandedHistoryTaskId = null;
      else expandedHistoryTaskId = taskId;
  }

  function handleTaskClick(task) { 
      if (editingTaskId === task.id) return; 
      dispatch('taskClick', task);
  }

  function handleKeydown(e, task) {
      if (e.key === 'Enter' || e.key === ' ') { 
          e.preventDefault();
          handleTaskClick(task); 
      }
  }

  function formatTaskTitle(title) {
      const regex = /@([^\s]+)/g;
      const matches = title.match(regex) || [];
      const mainText = title.replace(regex, '').replace(/\s+/g, ' ').trim();
      return { mainText, tags: matches };
  }

  function startEdit(e, task) {
      e.stopPropagation(); 
      editingTaskId = task.id;
      editTitle = task.title;
      editDeadline = task.deadline || '';
  }

  function cancelEdit(e) {
      e.stopPropagation();
      editingTaskId = null;
  }

  async function saveEdit(e, task) {
      e.stopPropagation();
      if (!editTitle.trim()) return;
      
      editLoading = true;
      try {
          const user = $currentUser.name || $currentUser.username;
          const time = getCurrentTimeShort();
          
          let updateData = {
              title: editTitle.trim(),
              history: arrayUnion({ action: 'edit', user, time, fullTime: new Date().toISOString() })
          };

          if (activeTab === 'handover') {
              updateData.deadline = editDeadline;
          }

          await updateDoc(doc(db, 'tasks', task.id), updateData);
          editingTaskId = null; 
      } catch (error) {
          alert("Lỗi khi lưu chỉnh sửa: " + error.message);
      } finally {
          editLoading = false;
      }
  }

  function openLightbox(e, images, index) {
      e.stopPropagation();
      lightboxImages = images;
      lightboxIndex = index;
      showLightbox = true;
  }
</script>

<div class="flex-1 overflow-y-auto pb-20 w-full px-1 scroll-smooth" id="task-list-container">
  {#each groupedTasks as group (group.timeSlot)}
    
    {#if group.timeSlot !== 'Khác'}
        <div class="flex items-center gap-2 px-4 py-2 rounded-lg mt-4 mb-2 font-bold text-sm shadow-sm border sticky top-0 z-10 backdrop-blur-sm transition-all duration-500 {group.allDone ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-cyan-50 text-cyan-800 border-cyan-100 bg-cyan-50/90'}">
            <span class="material-icons-round text-base">schedule</span> 
            {group.timeSlot}
            {#if group.allDone}
                <span class="ml-auto text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Hoàn tất</span>
            {/if}
        </div>
    {/if}

    <div class="flex flex-col gap-2 {group.timeSlot === 'Khác' ? 'mt-2' : ''}">
        {#each group.tasks as task (task.id)}
            {@const titleData = formatTaskTitle(task.title || "")}
            
            <div class="relative group-task"> 
                <div 
                  role="button"
                  tabindex="0"
                  id={"task-" + task.id}
                  class="w-full p-4 rounded-xl flex items-start gap-3 shadow-sm border-l-4 transition-all active:scale-[0.99] duration-300 relative overflow-hidden cursor-pointer select-none
                  {task.status === 'failed' ? 'bg-orange-50 opacity-90 border-l-orange-500' : (task.completed ? 'bg-gray-50 opacity-60 border-l-gray-400' : (task.isImportant ? 'bg-red-50 border-l-red-500' : 'bg-white'))}
                  {!task.completed && task.status !== 'failed' && !task.isImportant && activeTab==='warehouse' ? 'border-l-orange-500' : ''}
                  {!task.completed && task.status !== 'failed' && !task.isImportant && activeTab==='cashier' ? 'border-l-green-500' : ''}
                  {!task.completed && task.status !== 'failed' && !task.isImportant && activeTab==='handover' ? 'border-l-purple-500' : ''}"
                  on:click={() => handleTaskClick(task)}
                  on:keydown={(e) => handleKeydown(e, task)}
                >
                  <div class="w-6 h-6 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors
                    {task.status === 'failed' ? 'bg-orange-400 border-orange-400' : (task.completed ? 'bg-gray-400 border-gray-400' : (task.isImportant ? 'border-red-400 bg-red-100' : 'border-gray-300'))}">
                      {#if task.completed}<span class="text-white text-sm font-bold">✓</span>{/if}
                      {#if task.status === 'failed'}<span class="text-white text-[14px] font-black">!</span>{/if}
                      {#if !task.completed && task.status !== 'failed' && task.isImportant}<span class="text-red-500 text-[10px]">★</span>{/if}
                  </div>

                  {#if editingTaskId === task.id}
                      <div class="flex-1 text-left pr-20 py-1" on:click|stopPropagation>
                          <input type="text" bind:value={editTitle} class="w-full p-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm mb-2 font-bold text-gray-800 shadow-inner" placeholder="Nội dung công việc...">
                          
                          {#if activeTab === 'handover'}
                              <input type="datetime-local" bind:value={editDeadline} class="w-full p-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm mb-2 text-gray-700 shadow-inner">
                          {/if}
                          
                          <div class="flex gap-2 mt-1">
                              <button class="flex-1 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300 transition-colors" on:click={cancelEdit}>Hủy</button>
                              <button class="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold shadow hover:bg-blue-700 transition-colors" on:click={(e) => saveEdit(e, task)} disabled={editLoading}>
                                  {editLoading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                              </button>
                          </div>
                      </div>
                  {:else}
                      <div class="flex-1 text-left pr-20"> 
                          <div class="text-sm leading-snug">
                               {#if showStoreBadge && task.storeId}
                                  <span class="inline-block bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded mr-1 font-bold tracking-wider align-middle border border-indigo-200 font-mono">[{task.storeId}]</span>
                              {/if}
                        
                              {#if task.isImportant}
                                   <span class="material-icons-round text-sm text-red-500 align-middle mr-1">star</span>
                              {/if}
                              
                              <span class="{task.isImportant ? 'font-bold text-red-800' : 'font-bold text-gray-800'} {task.completed ? 'line-through text-gray-500' : ''}">
                                  {titleData.mainText || task.title}
                              </span>

                              {#if titleData.tags.length > 0}
                                   <span class="inline-flex gap-1 ml-1">
                                      {#each titleData.tags as tag}
                                          <span class="text-xs font-normal {task.completed ? 'text-gray-300' : 'text-gray-400'}">
                                              — {tag.replace('@', '')}
                                          </span>
                                      {/each}
                                   </span>
                              {/if}
                          </div>
                          
                          <div class="flex flex-wrap gap-2 mt-2 items-center">
                              {#if activeTab === 'handover' && task.deadline}
                                    <span class="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded flex items-center gap-1 border border-red-100">
                                      <span class="material-icons-round text-[10px]">alarm</span> {formatDateTime(task.deadline)}
                                  </span>
                              {/if}
                   
                              {#if task.createdBy && task.createdBy !== 'System'}
                                    <span class="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded border border-blue-100" title="Người tạo">{task.createdBy}</span>
                              {/if}
                            
                              {#if task.completed}
                                  <span class="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded flex items-center gap-1 border border-gray-200">
                                      <span class="material-icons-round text-[10px]">check_circle</span> {task.completedBy} • {task.time}
                                  </span>
                              {/if}
                          </div>
                          
                          {#if task.status === 'failed'}
                               <div class="mt-2 bg-orange-100 text-orange-800 text-xs p-2 rounded border border-orange-200 italic flex gap-1 font-bold">
                                  <span class="material-icons-round text-[14px] mt-0.5">warning</span> Lỗi: {task.note}
                              </div>
                          {:else if task.note}
                               <div class="mt-2 bg-yellow-50 text-yellow-800 text-xs p-2 rounded border border-yellow-100 italic flex gap-1">
                                  <span class="material-icons-round text-[10px] mt-0.5">sticky_note_2</span>{task.note}
                              </div>
                          {/if}

                          {#if task.imageLinks && task.imageLinks.length > 0}
                              <div class="flex gap-2 mt-2 overflow-x-auto pb-1">
                                  {#each task.imageLinks as img, index}
                                      <button type="button" class="outline-none" on:click={(e) => openLightbox(e, task.imageLinks, index)} title="Phóng to hình ảnh">
                                          <img src={img} class="w-10 h-10 object-cover rounded shadow-sm border border-gray-200 hover:scale-110 transition-transform" alt="Task img">
                                      </button>
                                  {/each}
                              </div>
                          {/if}
                      </div>
                  {/if}
                </div>
                
                <div class="absolute top-3 right-3 flex gap-1 z-20">
                    {#if !task.completed && activeTab === 'handover' && editingTaskId !== task.id}
                        <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors" on:click={(e) => startEdit(e, task)} title="Chỉnh sửa">
                            <span class="material-icons-round text-base">edit</span>
                        </button>
                    {/if}
                    <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-indigo-500 transition-colors" on:click={(e) => toggleHistory(e, task.id)} title="Lịch sử">
                        <span class="material-icons-round text-base">history</span>
                    </button>
                </div>

                {#if expandedHistoryTaskId === task.id}
                    <div class="bg-gray-50 border-x border-b border-gray-200 rounded-b-xl mx-2 p-3 text-xs text-gray-600 animate-fadeIn shadow-inner mb-2 -mt-2 relative z-30">
                        <div class="font-bold mb-2 text-gray-400 uppercase text-[10px]">Nhật ký hoạt động</div>
                        {#if task.history && task.history.length > 0}
                            <div class="space-y-2">
                                {#each task.history.slice().reverse() as log}
                                    <div class="flex justify-between items-center border-b border-gray-200 pb-1 last:border-0">
                                        <div class="flex items-center gap-2">
                                            <span class="material-icons-round text-[14px] {log.action==='done'?'text-green-600':log.action==='edit'?'text-blue-500':log.action==='failed'?'text-red-500':'text-orange-500'}">
                                                {log.action==='done'?'check_circle':log.action==='edit'?'edit':log.action==='failed'?'warning':'undo'}
                                            </span>
                                            <span class="font-bold {log.action==='done'?'text-green-700':log.action==='edit'?'text-blue-700':log.action==='failed'?'text-red-700':'text-orange-700'}">
                                                {log.action==='done'?'Hoàn thành':log.action==='edit'?'Chỉnh sửa':log.action==='failed'?'Báo lỗi':'Hoàn tác'}
                                            </span>
                                            <span>bởi <b>{log.user}</b></span>
                                        </div>
                                        <span class="font-mono text-[10px] text-gray-400">{log.time}</span>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <div class="text-center italic text-gray-400">Chưa có lịch sử ghi lại.</div>
                        {/if}
                    </div>
                {/if}
            </div>
        {/each}
    </div>
  {/each}
  
  {#if groupedTasks.length === 0}
    <div class="text-center py-10 text-gray-400 flex flex-col items-center"><span class="material-icons-round text-4xl mb-2 opacity-30">assignment_turned_in</span><p class="text-sm">Chưa có công việc nào</p></div>
  {/if}
</div>

<LightboxModal 
    show={showLightbox} 
    images={lightboxImages} 
    currentIndex={lightboxIndex} 
    on:close={() => showLightbox = false} 
    on:updateIndex={(e) => lightboxIndex = e.detail} 
/>

<style>
  .animate-fadeIn { animation: fadeIn 0.2s ease-out; } 
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
</style>