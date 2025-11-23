<script>
  import { createEventDispatcher } from 'svelte';
  import { currentTasks, currentUser } from '../lib/stores';
  import { formatDateTime } from '../lib/utils';
  export let activeTab = 'warehouse';
  const dispatch = createEventDispatcher();

  // Kiểm tra xem User có quản lý nhiều kho không để hiện Badge
  $: myStores = $currentUser?.storeIds || [];
  $: showStoreBadge = myStores.length > 1;

  // Lọc danh sách theo Tab hiện tại
  $: filteredTasks = $currentTasks.filter(t => t.type === activeTab);
  
  // Sắp xếp danh sách
  $: sortedTasks = filteredTasks.sort((a, b) => {
      // 1. Ưu tiên sắp xếp theo giờ
      const timeA = a.timeSlot || "00:00";
      const timeB = b.timeSlot || "00:00";
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      
      // 2. Nếu cùng giờ, sắp xếp theo Mã kho (nếu có)
      const storeA = a.storeId || "";
      const storeB = b.storeId || "";
      if (storeA !== storeB) return storeA.localeCompare(storeB);
      
      // 3. Cuối cùng sắp xếp theo trạng thái (Chưa xong lên trước)
      return a.completed - b.completed;
  });

  // Hàm kiểm tra để hiển thị Header giờ (ví dụ: nhóm các việc 08:00 lại)
  function shouldShowHeader(task, index, allTasks) {
    if (activeTab === 'handover') return false;
    const prevTask = allTasks[index - 1];
    const currTime = task.timeSlot || "Khác";
    const prevTime = prevTask?.timeSlot || "Khác";
    return index === 0 || currTime !== prevTime;
  }
</script>

<div class="flex-1 overflow-y-auto pb-20 w-full px-1">
  {#each sortedTasks as task, index (task.id)}
    
    {#if shouldShowHeader(task, index, sortedTasks)}
      <div class="flex items-center gap-2 bg-cyan-50 text-cyan-800 px-4 py-2 rounded-lg mt-4 mb-2 font-bold text-sm shadow-sm border border-cyan-100">
        <span class="material-icons-round text-base">schedule</span> 
        {task.timeSlot || "Khác"}
      </div>
    {/if}

    <button 
      class="w-full p-4 mb-2 rounded-xl flex items-start gap-3 shadow-sm border-l-4 transition-all active:scale-[0.99] 
      {task.completed ? 'bg-gray-50 opacity-60 border-l-gray-400' : (task.isImportant ? 'bg-red-50 border-l-red-500' : 'bg-white')}
      {!task.completed && !task.isImportant && activeTab==='warehouse' ? 'border-l-orange-500' : ''}
      {!task.completed && !task.isImportant && activeTab==='cashier' ? 'border-l-green-500' : ''}
      {!task.completed && !task.isImportant && activeTab==='handover' ? 'border-l-purple-500' : ''}"
      on:click={() => dispatch('taskClick', task)}
    >
      <div class="w-6 h-6 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center 
        {task.completed ? 'bg-gray-400 border-gray-400' : (task.isImportant ? 'border-red-400 bg-red-100' : 'border-gray-300')}">
          {#if task.completed}<span class="text-white text-sm font-bold">✓</span>{/if}
          {#if !task.completed && task.isImportant}<span class="text-red-500 text-[10px]">★</span>{/if}
      </div>

      <div class="flex-1 text-left">
        <div class="text-sm leading-snug {task.isImportant ? 'font-bold text-red-800' : 'font-semibold text-gray-800'}">
            
            {#if showStoreBadge && task.storeId}
                <span class="inline-block bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded mr-1 font-bold tracking-wider align-middle border border-indigo-200 font-mono">
                    [{task.storeId}]
                </span>
            {/if}

            {#if task.isImportant}
                <span class="material-icons-round text-sm text-red-500 align-middle mr-1">star</span>
            {/if}

            <span class:line-through={task.completed} class:text-gray-500={task.completed}>
                {task.title}
            </span>
        </div>
        
        <div class="flex flex-wrap gap-2 mt-2">
            {#if activeTab === 'handover' && task.deadline}
                <span class="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded flex items-center gap-1 border border-red-100">
                    <span class="material-icons-round text-[10px]">alarm</span> {formatDateTime(task.deadline)}
                </span>
            {/if}
            {#if task.createdBy && task.createdBy !== 'System'}
                <span class="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded border border-blue-100">{task.createdBy}</span>
            {/if}
            {#if task.completed}
                <span class="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded flex items-center gap-1 border border-gray-200">
                    <span class="material-icons-round text-[10px]">check_circle</span> {task.completedBy} • {task.time}
                </span>
            {/if}
        </div>
        
        {#if task.note}
            <div class="mt-2 bg-yellow-50 text-yellow-800 text-xs p-2 rounded border border-yellow-100 italic flex gap-1">
                <span class="material-icons-round text-[10px] mt-0.5">sticky_note_2</span>
                {task.note}
            </div>
        {/if}
      </div>
    </button>
  {/each}
  
  {#if sortedTasks.length === 0}
    <div class="text-center py-10 text-gray-400 flex flex-col items-center">
        <span class="material-icons-round text-4xl mb-2 opacity-30">assignment_turned_in</span>
        <p class="text-sm">Chưa có công việc nào</p>
    </div>
  {/if}
</div>