<script>
  // Version 6.3 - [CodeGenesis] Tuyệt chủng công việc Demo - Làm sạch hệ thống
  import { onMount, onDestroy } from 'svelte';
  import { db } from '../../lib/firebase';
  import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
  import { currentUser } from '../../lib/stores'; 

  export let targetStore = ''; 

  let activeTemplateType = 'warehouse';
  let newTemplateTime = '08:00';
  let newTemplateTitle = '';
  let newTemplateImportant = false;
  let selectedDays = [0, 1, 2, 3, 4, 5, 6];
  let editingTemplateIndex = -1;
  
  let localTemplateData = { warehouse: [], cashier: [], handover: [] };
  let unsub = () => {};

  const weekDays = [
      { label: 'T2', val: 1 }, { label: 'T3', val: 2 }, { label: 'T4', val: 3 },
      { label: 'T5', val: 4 }, { label: 'T6', val: 5 }, { label: 'T7', val: 6 }, { label: 'CN', val: 0 }
  ];

  $: if (targetStore) {
      if (unsub) unsub();
      unsub = onSnapshot(doc(db, 'settings', `template_${targetStore}`), (docSnap) => {
          if (docSnap.exists()) {
              localTemplateData = docSnap.data();
          } else {
              localTemplateData = { warehouse: [], cashier: [], handover: [] };
          }
      });
  }

  onDestroy(() => { if (unsub) unsub(); });

  async function saveTemplate() {
      if (!newTemplateTitle.trim()) return;
      
      const newItem = {
          title: newTemplateTitle.trim(),
          time: newTemplateTime,
          days: [...selectedDays],
          isImportant: newTemplateImportant,
          createdBy: $currentUser.name || $currentUser.username,
          updatedAt: new Date().toISOString()
      };

      if (editingTemplateIndex > -1) {
          localTemplateData[activeTemplateType][editingTemplateIndex] = newItem;
      } else {
          if (!localTemplateData[activeTemplateType]) localTemplateData[activeTemplateType] = [];
          localTemplateData[activeTemplateType] = [...localTemplateData[activeTemplateType], newItem];
      }

      await setDoc(doc(db, 'settings', `template_${targetStore}`), localTemplateData);
      resetForm();
  }

  function resetForm() {
      newTemplateTitle = '';
      newTemplateTime = '08:00';
      newTemplateImportant = false;
      editingTemplateIndex = -1;
  }

  function editTemplate(index, item) {
      editingTemplateIndex = index;
      newTemplateTitle = item.title;
      newTemplateTime = item.time;
      newTemplateImportant = item.isImportant || false;
      selectedDays = [...(item.days || [])];
  }

  async function deleteTemplate(index) {
      if (!confirm('Xóa mẫu việc này?')) return;
      localTemplateData[activeTemplateType].splice(index, 1);
      localTemplateData[activeTemplateType] = [...localTemplateData[activeTemplateType]];
      await setDoc(doc(db, 'settings', `template_${targetStore}`), localTemplateData);
  }

  function toggleDay(val) {
      if (selectedDays.includes(val)) {
          selectedDays = selectedDays.filter(d => d !== val);
      } else {
          selectedDays = [...selectedDays, val];
      }
  }
</script>

<div class="flex flex-col h-full animate-fadeIn">
  <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4">
      <div id="dept-select-container" class="flex bg-slate-100 p-1 rounded-lg mb-4">
          <button class="flex-1 py-2 text-xs font-bold rounded-md transition-all {activeTemplateType==='warehouse'?'bg-white text-indigo-700 shadow-sm':'text-slate-500'}" on:click={() => {activeTemplateType='warehouse'; resetForm();}}>KHO</button>
          <button class="flex-1 py-2 text-xs font-bold rounded-md transition-all {activeTemplateType==='cashier'?'bg-white text-indigo-700 shadow-sm':'text-slate-500'}" on:click={() => {activeTemplateType='cashier'; resetForm();}}>THU NGÂN</button>
          <button class="flex-1 py-2 text-xs font-bold rounded-md transition-all {activeTemplateType==='handover'?'bg-white text-indigo-700 shadow-sm':'text-slate-500'}" on:click={() => {activeTemplateType='handover'; resetForm();}}>BÀN GIAO</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-3">
              <div>
                  <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tên công việc</label>
                  <input type="text" bind:value={newTemplateTitle} placeholder="Nhập tên việc cần làm..." class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 transition-all">
              </div>
              <div class="flex gap-3">
                  <div class="flex-1">
                      <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Thời gian</label>
                      <input id="time-input" type="time" bind:value={newTemplateTime} class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none">
                  </div>
                  <div class="flex-1 flex flex-col justify-end">
                      <label class="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                          <input type="checkbox" bind:checked={newTemplateImportant} class="w-4 h-4 accent-red-500">
                          <span class="text-xs font-bold text-slate-600">Việc quan trọng</span>
                      </label>
                  </div>
              </div>
          </div>

          <div>
              <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Các ngày lặp lại</label>
              <div id="weekdays-container" class="flex flex-wrap gap-1.5">
                  {#each weekDays as d}
                      <button class="flex-1 min-w-[40px] py-2 rounded-lg text-xs font-bold border transition-all {selectedDays.includes(d.val) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}" on:click={() => toggleDay(d.val)}>{d.label}</button>
                  {/each}
              </div>
              <button class="w-full mt-4 py-3 {editingTemplateIndex > -1 ? 'bg-orange-500' : 'bg-indigo-600'} text-white rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-all" on:click={saveTemplate}>
                  {editingTemplateIndex > -1 ? 'CẬP NHẬT MẪU VIỆC' : 'THÊM VÀO DANH SÁCH MẪU'}
              </button>
          </div>
      </div>
  </div>

  <div class="flex-1 overflow-y-auto pr-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {#each (localTemplateData[activeTemplateType] || []) as item, i}
              <div class="group relative bg-white p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all {item.isImportant ? 'border-l-4 border-l-red-500' : ''}">
                  <div class="pr-8">
                      <div class="flex items-center gap-2 mb-1">
                          <span class="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{item.time}</span>
                          {#if item.isImportant}<span class="text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded">QUAN TRỌNG</span>{/if}
                      </div>
                      <h4 class="text-sm font-bold text-slate-700 mb-2 line-clamp-2">{item.title}</h4>
                      
                      <div class="text-[10px] text-indigo-400 font-bold mb-1.5 flex items-center gap-1">
                          <span class="material-icons-round text-[12px]">account_circle</span> 
                          {item.createdBy || 'Hệ thống'}
                      </div>

                      <div class="flex gap-1 flex-wrap">
                          {#each weekDays as d}
                              {#if item.days && item.days.includes(d.val)}
                                  <span class="text-[10px] font-bold border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded">{d.label}</span>
                              {/if}
                          {/each}
                      </div>
                  </div>
                  <div class="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2">
                      <button class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center" on:click={() => editTemplate(i, item)}><span class="material-icons-round text-sm">edit</span></button>
                      <button class="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center" on:click={() => deleteTemplate(i)}><span class="material-icons-round text-sm">delete</span></button>
                  </div>
              </div>
          {:else}
              <div class="col-span-full py-12 text-center text-slate-400">
                  <span class="material-icons-round text-4xl mb-2 opacity-20">assignment_late</span>
                  <p class="text-sm font-bold italic">Chưa có mẫu việc nào. Hãy thêm công việc đầu tiên!</p>
              </div>
          {/each}
      </div>
  </div>
</div>