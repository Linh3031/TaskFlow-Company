<script>
  // Version 61.0 - Architectural Refactor (Hỗ trợ Data Flow cho Upload Excel thủ công)
  import AdminScheduleSetup from './schedule/AdminScheduleSetup.svelte';
  import AdminScheduleReview from './schedule/AdminScheduleReview.svelte';
  import { defaultMatrix, DEFAULT_COLS } from './schedule/scheduleConstants.js';

  export let targetStore = '';
  
  let isLoading = false;
  let scheduleStaffList = [];
  let staffStats = { total: 0, male: 0, female: 0 };
  let scheduleMonth = new Date().getMonth() + 1;
  let scheduleYear = new Date().getFullYear();

  let shiftMatrix = JSON.parse(JSON.stringify(defaultMatrix)); 
  let weekendMatrix = JSON.parse(JSON.stringify(defaultMatrix));
  let suggestedCombos = []; 
  let suggestedWeekendCombos = [];
  let activeMatrixMode = 'weekday';
  let genderConfig = { kho: 'none', tn: 'none' };
  let customComboCols = [...DEFAULT_COLS]; 

  let triggerPreview = 0; 
  // [NEW] Biến hứng dữ liệu dịch ngược từ file Excel
  let manualPreviewPayload = null; 
</script>

<div class="flex flex-col gap-6 w-full pb-20 animate-fadeIn">
    
    <AdminScheduleSetup 
        bind:targetStore
        bind:isLoading
        bind:scheduleStaffList
        bind:staffStats
        bind:scheduleMonth
        bind:scheduleYear
        bind:shiftMatrix
        bind:weekendMatrix
        bind:suggestedCombos
        bind:suggestedWeekendCombos
        bind:activeMatrixMode
        bind:genderConfig
        bind:customComboCols
        on:preview={() => triggerPreview++}
        on:manualPreview={(e) => manualPreviewPayload = e.detail} 
    />

    <AdminScheduleReview 
        {targetStore}
        bind:isLoading
        {scheduleStaffList}
        {staffStats}
        {scheduleMonth}
        {scheduleYear}
        {suggestedCombos}
        {suggestedWeekendCombos}
        {genderConfig}
        {customComboCols}
        {shiftMatrix}
        {weekendMatrix}
        {activeMatrixMode}
        {triggerPreview}
        {manualPreviewPayload}
        on:switchTab
    />
</div>

{#if isLoading}
    <div class="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-[200]">
        <div class="animate-bounce font-bold text-indigo-900 text-lg">Đang xử lý dữ liệu...</div>
    </div>
{/if}