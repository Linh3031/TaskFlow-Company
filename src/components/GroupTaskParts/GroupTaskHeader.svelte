<script>
  import { createEventDispatcher } from 'svelte';
  export let isAdmin = false;
  export let targetFilter = 'ALL'; 
  export let searchQuery = '';

  const dispatch = createEventDispatcher();
</script>

<div class="w-full bg-white p-3 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
  <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-auto overflow-x-auto">
    <button type="button" class="flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all {targetFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}" on:click={() => targetFilter = 'ALL'}>
      Tất Cả Kho
    </button>
    <button type="button" class="flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all {targetFilter === 'STAFF' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}" on:click={() => targetFilter = 'STAFF'}>
      Nhân Viên
    </button>
    <button type="button" class="flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all {targetFilter === 'PG' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}" on:click={() => targetFilter = 'PG'}>
      Nhóm PG
    </button>
  </div>

  <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
    <div class="relative flex-1 sm:w-48">
      <span class="material-icons-round absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
      <input type="text" bind:value={searchQuery} placeholder="Tìm công việc..." class="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-500 transition-colors">
    </div>

    {#if isAdmin}
      <button type="button" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1 shrink-0 transition-all" on:click={() => dispatch('openCreate')}>
        <span class="material-icons-round text-sm">add_task</span>
        <span>Tạo Việc</span>
      </button>
    {/if}
  </div>
</div>