<script>
  // Version 47.0 - Clean Header (Moved Config to Schedule)
  import { createEventDispatcher } from 'svelte';
  import { currentUser } from '../lib/stores';
  import { db } from '../lib/firebase';
  
  import AdminTemplate from './admin/AdminTemplate.svelte';
  import AdminAccounts from './admin/AdminAccounts.svelte';
  import AdminSchedule from './admin/AdminSchedule.svelte';
  // StoreConfig được chuyển vào trong AdminSchedule nên không cần import ở đây nữa, 
  // trừ khi bạn muốn giữ nó như một modal toàn cục. Nhưng theo yêu cầu, tôi sẽ ẩn nút kích hoạt ở header.

  const dispatch = createEventDispatcher();
  
  $: isSuperAdmin = $currentUser?.role === 'super_admin';
  $: myStores = $currentUser?.storeIds || [];
  
  let targetStore = '';
  $: if (myStores.length > 0 && !targetStore) { targetStore = myStores[0]; }
  
  $: isDemoMode = targetStore?.includes('DEMO');

  let activeSection = 'schedule'; 
  // let showStoreConfig = false; // Moved to AdminSchedule

  function handleSwitchTab(e) {
      dispatch('switchTab', e.detail);
      dispatch('close');
  }
</script>

<div class="fixed inset-0 z-50 bg-slate-100 flex flex-col animate-fadeIn">
    <div class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-20">
        <div class="flex items-center gap-4 lg:gap-6">
            <button class="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-all text-slate-500 hover:text-indigo-600" on:click={() => dispatch('close')} aria-label="Đóng"><span class="material-icons-round">arrow_back</span></button>
            <h2 class="text-xl font-bold text-slate-800 tracking-tight hidden lg:block">Quản Trị</h2>
            
            <div class="flex items-center gap-2">
                <div id="store-select-container" class="relative">
                    <select bind:value={targetStore} class="pl-3 pr-8 py-1.5 bg-indigo-50 border-indigo-100 text-indigo-700 font-bold rounded-lg text-sm outline-none appearance-none cursor-pointer hover:bg-indigo-100 transition-colors">
                        {#each myStores as s}<option value={s}>{s}</option>{/each}
                    </select>
                    <span class="material-icons-round absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 text-sm pointer-events-none">expand_more</span>
                </div>

                <div class="flex bg-slate-100 p-1 rounded-lg ml-2">
                    <button class="px-4 py-1.5 rounded-md text-sm font-bold transition-all {activeSection==='schedule'?'bg-white text-indigo-600 shadow-sm':'text-slate-500 hover:text-slate-700'}" on:click={() => activeSection = 'schedule'}>Phân Ca</button>
                    <button class="px-4 py-1.5 rounded-md text-sm font-bold transition-all {activeSection==='template'?'bg-white text-orange-600 shadow-sm':'text-slate-500 hover:text-slate-700'}" on:click={() => activeSection = 'template'}>Tạo công việc</button>
                    <button class="px-4 py-1.5 rounded-md text-sm font-bold transition-all {activeSection==='accounts'?'bg-white text-blue-600 shadow-sm':'text-slate-500 hover:text-slate-700'}" on:click={() => activeSection = 'accounts'}>Nhân Sự</button>
                </div>
            </div>
        </div>
    </div>

    <div class="flex-1 overflow-auto p-4 lg:p-6 relative">
        {#if activeSection === 'schedule'}
            <AdminSchedule {targetStore} on:switchTab={handleSwitchTab} />
        {/if}
        
        {#if activeSection === 'template'} 
            <AdminTemplate {targetStore} /> 
        {/if}
        
        {#if activeSection === 'accounts'} 
            <AdminAccounts {targetStore} {isSuperAdmin} />
        {/if}
    </div>
</div>

<style>
    .animate-fadeIn { animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); } 
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
</style>