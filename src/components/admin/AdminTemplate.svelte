<script>
  // Version 6.1 - Auto-Create Always & User Tracking + Tour Guide
  import { onMount } from 'svelte';
  import { db } from '../../lib/firebase';
  import { doc, setDoc, addDoc, collection, serverTimestamp, onSnapshot } from 'firebase/firestore';
  import { getTodayStr } from '../../lib/utils';
  import { currentUser } from '../../lib/stores';
  import TourGuide from '../TourGuide.svelte'; // Import TourGuide

  export let targetStore = ''; 

  let activeTemplateType = 'warehouse';
  let newTemplateTime = '08:00';
  let newTemplateTitle = '';
  let newTemplateImportant = false;
  let selectedDays = [0, 1, 2, 3, 4, 5, 6];
  let editingTemplateIndex = -1;
  
  let localTemplateData = {};
  let unsub = () => {};

  // --- TOUR GUIDE CONFIG ---
  let showTour = false;
  const tourSteps = [
      { target: '#dept-select-container', title: '1. Chọn Bộ Phận', content: 'Chọn tab mà công việc này sẽ xuất hiện (Kho, Thu Ngân hay Bàn Giao).' },
      { target: '#time-input', title: '2. Chọn Giờ', content: 'Công việc sẽ được sắp xếp theo thời gian này trong ngày.' },
      { target: '#weekdays-container', title: '3. Chọn Ngày Lặp', content: 'Chọn các thứ trong tuần mà công việc này cần làm (Màu xanh là được chọn).' },
      { target: '#btn-save-template', title: '4. Thêm/Lưu', content: 'Bấm vào đây để lưu mẫu. Nếu ngày lặp trùng hôm nay, công việc sẽ tự động hiện ra ngoài trang chủ.' }
  ];
  // -------------------------

  const weekDays = [
      { val: 1, label: 'T2' }, { val: 2, label: 'T3' }, { val: 3, label: 'T4' },
      { val: 4, label: 'T5' }, { val: 5, label: 'T6' }, { val: 6, label: 'T7' }, { val: 0, label: 'CN' }
  ];

  $: if (targetStore) loadTemplateForStore(targetStore);

  function loadTemplateForStore(sid) {
      if (unsub) unsub();
      localTemplateData = {};
      unsub = onSnapshot(doc(db, 'settings', `template_${sid}`), (docSnap) => {
          if (docSnap.exists()) localTemplateData = docSnap.data();
          else localTemplateData = {};
      });
  }

  function toggleDay(d) {
      if (selectedDays.includes(d)) {
          if (selectedDays.length > 1) selectedDays = selectedDays.filter(x => x !== d);
      } else selectedDays = [...selectedDays, d];
  }

  function editTemplate(idx, item) {
      editingTemplateIndex = idx;
      newTemplateTitle = item.title;
      newTemplateTime = item.time;
      newTemplateImportant = item.isImportant || false;
      selectedDays = item.days || [0, 1, 2, 3, 4, 5, 6];
  }

  async function deleteTemplate(idx) {
      if (!confirm("Xóa mẫu này?")) return;
      const up = { ...localTemplateData };
      if (!up[activeTemplateType]) return;
      up[activeTemplateType].splice(idx, 1);
      try {
          await setDoc(doc(db, 'settings', `template_${targetStore}`), up);
          if (editingTemplateIndex === idx) { editingTemplateIndex = -1; newTemplateTitle = ''; }
      } catch (e) { alert(e.message); }
  }

  async function saveTemplate() {
      if (!targetStore) return alert("Chưa chọn kho!");
      if (!newTemplateTitle.trim()) return alert("Nhập tên công việc!");
      
      const up = { ...localTemplateData };
      if (!up[activeTemplateType]) up[activeTemplateType] = [];
      
      const newItem = { 
          title: newTemplateTitle, 
          time: newTemplateTime, 
          isImportant: newTemplateImportant, 
          days: selectedDays 
      };

      if (editingTemplateIndex >= 0) up[activeTemplateType][editingTemplateIndex] = newItem;
      else up[activeTemplateType].push(newItem);

      up[activeTemplateType].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));

      try {
          await setDoc(doc(db, 'settings', `template_${targetStore}`), up);
          
          const today = new Date().getDay();
          if (selectedDays.includes(today)) {
              const creatorName = $currentUser?.name || $currentUser?.username || 'Quản lý';
              await addDoc(collection(db, 'tasks'), {
                  type: activeTemplateType,
                  title: newTemplateTitle,
                  timeSlot: newTemplateTime,
                  isImportant: newTemplateImportant,
                  completed: false, 
                  completedBy: null, 
                  time: null, 
                  note: '',
                  createdBy: creatorName,
                  date: getTodayStr(),
                  storeId: targetStore,
                  timestamp: serverTimestamp()
              });
          }

          newTemplateTitle = ''; 
          newTemplateImportant = false; 
          editingTemplateIndex = -1; 
          selectedDays = [0, 1, 2, 3, 4, 5, 6];
          
      } catch (e) { alert(e.message); }
  }
</script>

<div class="flex flex-col lg:flex-row gap-6 h-full animate-fadeIn">
  <div class="w-full lg:w-[35%] bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-fit">
      <div class="flex justify-between items-center mb-4 border-b pb-2">
          <h4 class="font-bold text-slate-700 flex items-center gap-2 text-lg">
              <span class="material-icons-round text-orange-500 bg-orange-50 p-1 rounded-lg">edit_note</span>
              {editingTemplateIndex >= 0 ? 'Chỉnh Sửa' : 'Thêm Mới'}
          </h4>
          <button class="text-gray-400 hover:text-indigo-600" on:click={() => showTour = true} title="Hướng dẫn"><span class="material-icons-round">help_outline</span></button>
      </div>

      <div class="text-xs font-bold text-gray-400 mb-2">Kho: <b class="text-indigo-600 text-sm">{targetStore}</b> | Người tạo: <b class="text-green-600">{$currentUser?.name}</b></div>
      
      <div class="space-y-4">
          <div id="dept-select-container">
              <label for="dept-select" class="text-xs font-bold text-slate-500 uppercase">Bộ phận</label>
              <select id="dept-select" bind:value={activeTemplateType} class="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none">
                  <option value="warehouse">Kho</option>
                  <option value="cashier">Thu Ngân</option>
                  <option value="handover">Bàn Giao</option>
              </select>
          </div>
          
          <div class="flex gap-3">
              <div class="w-24">
                  <label for="time-input" class="text-xs font-bold text-slate-500 uppercase">Giờ</label>
                  <input id="time-input" type="time" bind:value={newTemplateTime} class="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold">
              </div>
              <div class="flex-1">
                  <label for="title-input" class="text-xs font-bold text-slate-500 uppercase">Tên công việc</label>
                  <input id="title-input" type="text" bind:value={newTemplateTitle} class="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none" placeholder="Nhập tên việc...">
              </div>
          </div>

          <div id="weekdays-container">
              <label class="text-xs font-bold text-slate-500 uppercase mb-2 block">Lặp lại</label>
              <div class="flex gap-1 flex-wrap">
                  {#each weekDays as d}
                      <button class="w-8 h-8 rounded-lg text-xs font-bold border transition-all {selectedDays.includes(d.val)?'bg-indigo-600 text-white border-indigo-600 shadow-md':'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}" on:click={() => toggleDay(d.val)}>{d.label}</button>
                  {/each}
              </div>
          </div>

          <label class="flex items-center gap-3 p-3 rounded-lg border border-red-100 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors mt-1">
              <input type="checkbox" bind:checked={newTemplateImportant} class="w-5 h-5 accent-red-600 rounded">
              <span class="text-sm font-bold text-red-700">Quan Trọng</span>
          </label>

          <div class="flex gap-2 pt-2 border-t">
              {#if editingTemplateIndex >= 0}
                  <button class="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl" on:click={() => { editingTemplateIndex = -1; newTemplateTitle = ''; }}>Hủy</button>
              {/if}
              <button id="btn-save-template" class="flex-[2] py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700" on:click={saveTemplate}>
                  {editingTemplateIndex >= 0 ? 'Lưu & Áp Dụng Ngay' : 'Thêm & Áp Dụng Ngay'}
              </button>
          </div>
      </div>
  </div>

  <div class="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-full max-h-[600px]">
      <div class="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-2 shrink-0">
          <span class="font-bold text-slate-700">Danh sách mẫu kho {targetStore} ({localTemplateData[activeTemplateType]?.length || 0})</span>
      </div>
      
      <div class="flex-1 overflow-y-auto p-3 space-y-2">
          {#each (localTemplateData[activeTemplateType] || []) as item, i}
              <div class="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-white group relative">
                  <div class="font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm">{item.time}</div>
                  <div class="flex-1">
                      <div class="font-bold text-slate-800 text-base mb-1 {item.isImportant?'text-red-600':''}">{item.isImportant ? '★ ' : ''}{item.title}</div>
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
          {/each}
      </div>
  </div>
</div>

{#if showTour} <TourGuide steps={tourSteps} on:complete={() => showTour = false} /> {/if}