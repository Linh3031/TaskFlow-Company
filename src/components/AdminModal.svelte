<script>
  // Version 49.0 - [CodeGenesis] Thêm Tab Khai báo trả góp (Chỉ dành cho Super Admin)
  import { createEventDispatcher } from 'svelte';
  import { currentUser } from '../lib/stores';
  import { db } from '../lib/firebase';
  
  import AdminTemplate from './admin/AdminTemplate.svelte';
  import AdminAccounts from './admin/AdminAccounts.svelte';
  import AdminSchedule from './admin/AdminSchedule.svelte';
  // ĐÃ PHẪU THUẬT: Import Component mới
  import AdminInstallmentConfig from './admin/AdminInstallmentConfig.svelte';
  import AdminTabConfig from './admin/AdminTabConfig.svelte';

  export let allTabs = [];

  const dispatch = createEventDispatcher();
  $: isSuperAdmin = $currentUser?.role === 'super_admin';
  $: myStores = $currentUser?.storeIds || [];
  let targetStore = '';
  $: if (myStores.length > 0 && !targetStore) { targetStore = myStores[0]; }
  
  $: isDemoMode = targetStore?.includes('DEMO');
  let activeSection = 'schedule';

  const adminTabs = [
      { id: 'schedule', label: 'Phân Ca', icon: 'calendar_month', color: '#378ADD', bg: '#E6F1FB', text: '#0C447C' },
      { id: 'accounts', label: 'Nhân Sự', icon: 'groups', color: '#1D9E75', bg: '#E1F5EE', text: '#085041' },
      { id: 'template', label: 'Mẫu Việc', icon: 'checklist', color: '#D85A30', bg: '#FAECE7', text: '#712B13' },
      { id: 'ui', label: 'Giao Diện', icon: 'palette', color: '#D4537E', bg: '#FBEAF0', text: '#72243E' },
      { id: 'installment', label: 'Khai Báo Trả Góp', icon: 'credit_card', color: '#BA7517', bg: '#FAEEDA', text: '#633806', superOnly: true }
  ];

  function handleSwitchTab(e) {
      dispatch('switchTab', e.detail);
      dispatch('close');
  }
</script>

<div class="fixed inset-0 z-50 bg-slate-100 flex flex-col animate-fadeIn">
    <div class="shrink-0 z-20 px-3 lg:px-6 pt-3 lg:pt-4">
        <div class="w-full bg-white border border-slate-200 rounded-[12px] px-2 py-1.5 flex items-center gap-2 min-w-0">
            <button class="shrink-0 w-[38px] h-[38px] rounded-[10px] hover:bg-slate-100 flex items-center justify-center transition-all text-slate-500 hover:text-slate-800" on:click={() => dispatch('close')} aria-label="Đóng"><span class="material-icons-round">arrow_back</span></button>
            <h2 class="text-lg font-bold text-slate-800 tracking-tight hidden lg:block shrink-0 pr-1">Quản Trị</h2>

            <div id="store-select-container" class="relative shrink-0">
                <select bind:value={targetStore} class="h-[38px] pl-3 pr-8 bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-[10px] text-[14px] outline-none appearance-none cursor-pointer hover:bg-slate-100 transition-colors">
                    {#each myStores as s}<option value={s}>{s}</option>{/each}
                </select>
                <span class="material-icons-round absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
            </div>

            <div class="w-px h-6 bg-slate-200 shrink-0 mx-1"></div>

            <div class="flex flex-wrap items-center gap-1 min-w-0">
                {#each adminTabs as tab (tab.id)}
                    {#if !tab.superOnly || isSuperAdmin}
                        <button
                            class="h-[38px] px-3 rounded-[10px] text-[14px] font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 {activeSection === tab.id ? '' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'}"
                            style={activeSection === tab.id ? `background:${tab.bg};color:${tab.text};box-shadow:inset 0 -2px 0 ${tab.color};` : ''}
                            on:click={() => activeSection = tab.id}
                        >
                            <span class="material-icons-round text-[18px]" style="color:{tab.color}">{tab.icon}</span>{tab.label}
                        </button>
                    {/if}
                {/each}
            </div>
        </div>
    </div>

    <div class="flex-1 overflow-auto p-3 lg:p-6 relative">
        {#if activeSection === 'schedule'}
            <AdminSchedule {targetStore} on:switchTab={handleSwitchTab} />
        {/if}
        
        {#if activeSection === 'accounts'} 
            <AdminAccounts {targetStore} {isSuperAdmin} />
        {/if}

        {#if activeSection === 'template'}
            <AdminTemplate {targetStore} />
        {/if}

        {#if activeSection === 'ui'}
            <AdminTabConfig {targetStore} {allTabs} />
        {/if}

        {#if activeSection === 'installment'}
            <AdminInstallmentConfig />
        {/if}
    </div>
</div>

<style>
    .animate-fadeIn { animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); } 
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
</style>