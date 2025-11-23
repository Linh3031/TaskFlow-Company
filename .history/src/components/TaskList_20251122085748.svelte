<script>
  import { createEventDispatcher } from 'svelte';
  import { currentTasks } from '../lib/stores';
  import { formatDateTime } from '../lib/utils';

  export let activeTab = 'warehouse';
  const dispatch = createEventDispatcher();

  // Reactive: Tự động chạy lại khi currentTasks hoặc activeTab thay đổi
  $: filteredTasks = $currentTasks.filter(t => t.type === activeTab);
  $: sortedTasks = filteredTasks.sort((a, b) => {
    if (activeTab === 'handover') {
      if (a.completed !== b.completed) return a.completed - b.completed;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && b.deadline) return 1;
      return (b.timestamp && a.timestamp) ? b.timestamp - a.timestamp : 0;
    } else {
      const timeA = a.timeSlot || "00:00";
      const timeB = b.timeSlot || "00:00";
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return a.completed - b.completed;
    }
  });

  // Hàm kiểm tra xem có cần in header giờ không
  function shouldShowHeader(task, index, allTasks) {
    if (activeTab === 'handover') return false;
    const prevTask = allTasks[index - 1];
    const currTime = task.timeSlot || "Khác";
    const prevTime = prevTask?.timeSlot || "Khác";
    return index === 0 || currTime !== prevTime;
  }

  function handleTaskClick(task) {
    dispatch('taskClick', task);
  }
</script>

<div class="task-list">
  {#each sortedTasks as task, index (task.id)}
    {#if shouldShowHeader(task, index, sortedTasks)}
      <div class="time-header">
        <span class="material-icons-round" style="font-size:16px">schedule</span> 
        {task.timeSlot || "Khác"}
      </div>
    {/if}

    <button 
      class="task-item {task.completed ? 'completed' : ''}" 
      data-type={activeTab}
      on:click={() => handleTaskClick(task)}
      aria-label={task.title}
    >
      <div class="checkbox-circle"></div>
      <div class="task-content">
        <div class="task-title">{task.title}</div>
        <div class="task-meta">
          {#if activeTab === 'handover' && task.deadline && !task.completed}
            <span class="deadline-tag">
              <span class="material-icons-round" style="font-size:12px">alarm</span> 
              Hạn: {formatDateTime(task.deadline)}
            </span>
          {/if}
          
          {#if task.createdBy && task.createdBy !== 'System'}
            <span class="creator-tag">{task.createdBy}</span>
          {/if}

          {#if task.completed}
            <span class="done-tag">
              <span class="material-icons-round" style="font-size:14px">check_circle</span> 
              {task.completedBy} • {task.time}
            </span>
          {/if}
        </div>
        
        {#if task.note}
          <div class="task-note-display">
            <span>{task.note}</span>
          </div>
        {/if}
      </div>
    </button>
  {/each}
</div>

<style>
  .task-list { flex-grow: 1; min-height: 0; overflow-y: auto; padding-bottom: 60px; -webkit-overflow-scrolling: touch; width: 100%; }
  
  .time-header { background: #e0f7fa; color: #006064; padding: 6px 15px; border-radius: 8px; margin: 15px 0 5px 0; font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; gap: 5px; }

  .task-item { width: 100%; background: #fff; padding: 14px; margin-bottom: 8px; border-radius: 12px; display: flex; align-items: flex-start; gap: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); border: none; border-left: 4px solid #ddd; cursor: pointer; text-align: left; font-family: inherit; }
  
  /* Dynamic Border Colors */
  button[data-type="warehouse"] { border-left-color: #ff9800; }
  button[data-type="cashier"] { border-left-color: #4caf50; }
  button[data-type="handover"] { border-left-color: #673ab7; }
  
  .task-item.completed { background: #f8f9fa; border-left-color: #9e9e9e !important; opacity: 0.7; }
  .task-item.completed .task-title { text-decoration: line-through; color: #999; }

  .checkbox-circle { width: 22px; height: 22px; border: 2px solid #e0e0e0; border-radius: 50%; flex-shrink: 0; margin-top: 1px; position: relative; }
  .task-item.completed .checkbox-circle { background: #9e9e9e; border-color: #9e9e9e; }
  .task-item.completed .checkbox-circle::after { content: '✓'; color: white; font-size: 14px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }

  .task-content { flex: 1; }
  .task-title { font-size: 0.95rem; font-weight: 600; line-height: 1.3; color: #333; }
  .task-meta { margin-top: 5px; font-size: 0.75rem; color: #888; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  
  .creator-tag, .deadline-tag, .done-tag { background: #e3f2fd; color: #1565c0; padding: 2px 6px; border-radius: 4px; font-weight: 700; display: flex; align-items: center; gap: 3px; }
  .deadline-tag { background: #ffebee; color: #d32f2f; }
  .done-tag { background: #eee; color: #4caf50; }
  
  .task-note-display { margin-top: 5px; font-size: 0.8rem; color: #e65100; font-style: italic; background: #fff3e0; padding: 4px 8px; border-radius: 4px; display: inline-block;}
</style>