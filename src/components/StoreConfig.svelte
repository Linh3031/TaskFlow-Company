<script>
  // Version 25.1 - Instant Calculation Fix
  import { createEventDispatcher, onMount } from 'svelte';
  import { db } from '../lib/firebase';
  import { doc, getDoc, setDoc } from 'firebase/firestore';
  import { storeList, currentUser } from '../lib/stores';

  export let storeId;
  const dispatch = createEventDispatcher();
  
  let loading = false;
  let currentStoreId = storeId;
  let timeConfig = {};

  // DANH SÁCH CA CƠ BẢN
  const BASE_SHIFTS = [
      { code: 'c1', label: 'Ca 1 (Sáng sớm)' },
      { code: 'c2', label: 'Ca 2 (Sáng)' },
      { code: 'c3', label: 'Ca 3 (Trưa)' },
      { code: 'c4', label: 'Ca 4 (Chiều)' },
      { code: 'c5', label: 'Ca 5 (Tối)' },
      { code: 'c6', label: 'Ca 6 (Đêm)' }
  ];

  // Mặc định
  const DEFAULT_TIMES = {
      'c1': { start: '08:00', end: '09:00' },
      'c2': { start: '09:00', end: '12:00' },
      'c3': { start: '12:00', end: '15:00' },
      'c4': { start: '15:00', end: '18:00' },
      'c5': { start: '18:00', end: '21:00' },
      'c6': { start: '21:00', end: '22:00' }
  };

  $: myStores = $storeList.filter(s => 
      $currentUser.role === 'super_admin' || 
      ($currentUser.storeIds && $currentUser.storeIds.includes(s.id))
  );

  async function loadStoreConfig(sid) {
      if (!sid) return;
      loading = true;
      timeConfig = JSON.parse(JSON.stringify(DEFAULT_TIMES));
      
      try {
          const docSnap = await getDoc(doc(db, 'stores', sid, 'settings', 'timeConfig'));
          if (docSnap.exists()) {
              timeConfig = { ...timeConfig, ...docSnap.data() };
          }
      } catch (e) { console.error(e); }
      finally { loading = false; }
  }

  $: if (currentStoreId) loadStoreConfig(currentStoreId);

  // HÀM TÍNH TOÁN (Được gọi ngay khi nhập liệu)
  function getDuration(cCode) {
      const sVal = timeConfig[cCode]?.start;
      const eVal = timeConfig[cCode]?.end;
      if (!sVal || !eVal) return 0;

      const d1 = new Date(`2000-01-01T${sVal}`);
      const d2 = new Date(`2000-01-01T${eVal}`);
      let diff = (d2 - d1) / 1000 / 60 / 60; // Giờ
      if (diff < 0) diff += 24; // Qua đêm
      
      return parseFloat(diff.toFixed(1));
  }

  // Force Update UI khi nhập liệu
  function handleTimeChange() {
      timeConfig = { ...timeConfig }; // Trigger reactivity
  }

  async function saveConfig() {
      loading = true;
      try {
          const dataToSave = {};
          BASE_SHIFTS.forEach(s => {
              dataToSave[s.code] = {
                  start: timeConfig[s.code].start,
                  end: timeConfig[s.code].end
              };
          });

          await setDoc(doc(db, 'stores', currentStoreId, 'settings', 'timeConfig'), dataToSave);
          alert(`✅ Đã lưu cấu hình giờ cho Kho ${currentStoreId}!`);
          dispatch('close');
      } catch (e) { alert(e.message); }
      finally { loading = false; }
  }
</script>

<div class="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" on:click|stopPropagation>
        <div class="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 class="font-bold text-slate-800 flex items-center gap-2">
                <span class="material-icons-round text-indigo-500">access_time_filled</span> Cấu Hình Giờ Gốc
            </h3>
            <button on:click={() => dispatch('close')} class="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500">
                <span class="material-icons-round">close</span>
            </button>
        </div>
        
        <div class="px-4 pt-4 pb-2 bg-white">
            <label class="block text-xs font-bold text-slate-400 mb-1 uppercase">Đang áp dụng cho kho</label>
            <div class="relative">
                <select bind:value={currentStoreId} class="w-full p-3 bg-indigo-50 border border-indigo-100 rounded-xl font-bold text-indigo-700 outline-none appearance-none cursor-pointer hover:bg-indigo-100 transition-colors">
                    {#each myStores as s}
                        <option value={s.id}>{s.id} - {s.name || 'Kho'}</option>
                    {/each}
                    {#if myStores.length === 0}
                         <option value={currentStoreId}>{currentStoreId}</option>
                    {/if}
                </select>
                <span class="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none">expand_more</span>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-2">
            {#if loading}
                <div class="text-center py-4 text-slate-400 text-xs">Đang tải dữ liệu...</div>
            {:else}
                {#each BASE_SHIFTS as shift}
                    <div class="flex items-center gap-3 p-3 border border-slate-100 rounded-xl hover:border-indigo-200 transition-colors group">
                        <div class="w-14">
                            <div class="font-black text-slate-700 text-lg leading-none uppercase">{shift.code}</div>
                            <div class="text-[9px] font-bold text-slate-400 mt-1 truncate">{shift.label}</div>
                        </div>

                        <div class="flex-1 flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200 group-hover:bg-white group-hover:shadow-sm transition-all">
                            <input type="time" bind:value={timeConfig[shift.code].start} on:input={handleTimeChange} class="w-full bg-transparent text-center font-bold text-slate-700 outline-none text-sm cursor-pointer">
                            <span class="text-slate-300 font-bold">-</span>
                            <input type="time" bind:value={timeConfig[shift.code].end} on:input={handleTimeChange} class="w-full bg-transparent text-center font-bold text-slate-700 outline-none text-sm cursor-pointer">
                        </div>

                        <div class="w-12 text-right">
                            <div class="text-sm font-black text-indigo-600">{getDuration(shift.code)}h</div>
                        </div>
                    </div>
                {/each}
            {/if}
        </div>

        <div class="p-4 border-t border-slate-100 bg-white flex gap-2">
            <div class="text-[10px] text-slate-400 flex-1 pr-2">
                *Hệ thống sẽ tự động cộng giờ của C1-C6 để tính công cho các Combo (123, 456...)
            </div>
            <button class="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 text-sm whitespace-nowrap" on:click={saveConfig} disabled={loading}>
                {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
            </button>
        </div>
    </div>
</div>