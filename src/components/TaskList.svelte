<script>
  import { createEventDispatcher } from 'svelte';
  import { currentTasks, currentUser } from '../lib/stores';
  import { formatDateTime } from '../lib/utils';
  export let activeTab = 'warehouse';
  const dispatch = createEventDispatcher();

  $: myStores = $currentUser?.storeIds || [];
  $: showStoreBadge = myStores.length > 1; // Chỉ hiện badge nếu quản lý > 1 kho

  $: filteredTasks = $currentTasks.filter(t => t.type === activeTab);
  
  $: sortedTasks = filteredTasks.sort((a, b) => {
      const timeA = a.timeSlot || "00:00";
      const timeB = b.timeSlot || "00:00";
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      const storeA = a.storeId || "";
      const storeB = b.storeId || "";
      if (storeA !== storeB) return storeA.localeCompare(storeB);
      return a.completed - b.completed;
  });

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
      class="w-full bg-white p-4 mb-2 rounded-xl flex items-start gap-3 shadow-sm border-l-4 transition-all active:scale-[0.99] {task.completed ? 'bg-gray-50 opacity-60' : ''}"
      class:border-l-orange-500={activeTab==='warehouse'}
      class:border-l-green-500={activeTab==='cashier'}
      class:border-l-purple-500={activeTab==='handover'}
      class:border-l-gray-400={task.completed}
      on:click={() => dispatch('taskClick', task)}
    >
      <div class="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0 mt-0.5 flex items-center justify-center {task.completed ? 'bg-gray-400 border-gray-400' : ''}">
          {#if task.completed}<span class="text-white text-sm font-bold">✓</span>{/if}
      </div>

      <div class="flex-1 text-left">
        <div class="text-sm font-semibold text-gray-800 leading-snug">
            {#if showStoreBadge && task.storeId}
                <span class="inline-block bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded mr-1 font-bold tracking-wider align-middle border border-indigo-200 font-mono">
                    [{task.storeId}]
                </span>
            {/if}
            <span class:line-through={task.completed} class:text-gray-500={task.completed}>
                {task.title}
            </span>
        </div>
        
        <div class="flex flex-wrap gap-2 mt-2">
            {#if activeTab === 'handover' && task.deadline}
                <span class="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                    <span class="material-icons-round text-[10px]">alarm</span> {formatDateTime(task.deadline)}
                </span>
            {/if}
            {#if task.createdBy && task.createdBy !== 'System'}
                <span class="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded">{task.createdBy}</span>
            {/if}
            {#if task.completed}
                <span class="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                    <span class="material-icons-round text-[10px]">check_circle</span> {task.completedBy} • {task.time}
                </span>
            {/if}
        </div>
        {#if task.note}
            <div class="mt-2 bg-yellow-50 text-yellow-800 text-xs p-2 rounded border border-yellow-100 italic">
                {task.note}
            </div>
        {/if}
      </div>
    </button>
  {/each}
</div>