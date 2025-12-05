
<script>
  // Version 55.0 - Remove Debugger & Resize Edit Icon
  import { createEventDispatcher, tick } from 'svelte';
  export let staffStats = {};
  export let shiftMatrix = {};
  export let weekendMatrix = {};
  export let activeMatrixMode = 'weekday';
  export let shiftCols = [];
  export let roleRows = [];
  export let comboCols = []; 
  export let activeSuggestedCombos = [];
  export let comboTotalsMap = {};
  export let scheduleMonth;
  export let scheduleYear;
  export let genderConfig = { kho: 'none', tn: 'none' };

  const dispatch = createEventDispatcher();
  let showConfigDropdown = false;
  let configDropdownNode;
  
  const getRoleTotal = (roleId, matrix) => Object.values(matrix).reduce((sum, s) => sum + (parseInt(s[roleId])||0), 0);
  const getShiftTotal = (shiftId, matrix) => { const s = matrix[shiftId] || {};
  return (parseInt(s.kho)||0) + (parseInt(s.tn)||0) + (parseInt(s.tv)||0) + (parseInt(s.gh)||0); };
  const getGrandTotal = (matrix) => Object.values(matrix).reduce((sum, s) => sum + (parseInt(s.kho)||0) + (parseInt(s.tn)||0) + (parseInt(s.tv)||0) + (parseInt(s.gh)||0), 0);
  
  function standardizeRole(val) {
      const s = String(val || '').toLowerCase().trim();
      if (s === 'kho' || s === 'k') return 'kho';
      if (s.includes('thu ngân') || s.includes('tn')) return 'tn';
      if (s.includes('giao') || s.includes('gh')) return 'gh';
      if (s.includes('tư vấn') || s === 'tv') return 'tv';
      return 'tv';
  }

  let displayGrid = {};
  $: {
      const grid = {};
      roleRows.forEach(r => {
          grid[r.id] = {};
          comboCols.forEach(code => {
              grid[r.id][code] = 0;
          });
      });
      if (Array.isArray(activeSuggestedCombos)) {
          activeSuggestedCombos.forEach(c => {
              const rId = standardizeRole(c.role);
              const code = String(c.code).trim();
              const qty = parseInt(c.qty) || 0;

              if (grid[rId] && grid[rId][code] !== undefined) {
                  grid[rId][code] = qty;
              }
          });
      }
      displayGrid = grid;
  }

  function handleWindowClick(e) {
      if (showConfigDropdown && configDropdownNode && !configDropdownNode.contains(e.target)) {
          showConfigDropdown = false;
      }
  }

  // --- LOGIC: KIỂM TRA TRÙNG LẶP ---
  let tempColValue = '';

  function handleColFocus(e) {
      tempColValue = e.target.value;
  }

  function handleColInput(e, index) {
      let val = e.target.value;
      val = val.replace(/[^0-9]/g, '');
      e.target.value = val;
      const newCols = [...comboCols];
      newCols[index] = val;
      dispatch('updateCols', newCols);
  }

  function handleColChange(e, index) {
      const val = e.target.value;
      if (!val) return; 

      const isDuplicate = comboCols.some((code, idx) => code === val && idx !== index);

      if (isDuplicate) {
          alert(`⚠️ Mã cột "${val}" đã tồn tại! Vui lòng chọn mã khác.`);
          e.target.value = tempColValue;
          const newCols = [...comboCols];
          newCols[index] = tempColValue;
          dispatch('updateCols', newCols);
      }
  }

  function handleQtyFocus(e) {
      e.target.select();
  }
  
  function formatQtyDisplay(val) {
      return (val === 0 || val === '0') ? '-' : val;
  }
</script>

<svelte:window on:click={handleWindowClick} />

<div class="grid grid-cols-1 xl:grid-cols-2 gap-6 shrink-0 h-auto">
  
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-full">
      <div class="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div class="flex flex-col items-start gap-1">
                  <h3 class="font-bold text-slate-800 text-lg leading-tight">Định Mức Nhân Sự</h3>
                  {#if staffStats.total > 0}
                      <div class="flex items-center gap-2 text-[10px] font-bold text-slate-500 opacity-80 select-none">
                          <div class="flex items-center gap-1"><span class="material-icons-round text-[10px]">groups</span> <span>{staffStats.total}</span></div>
                          <div class="w-px h-2 bg-slate-300"></div>
                          <div class="flex items-center gap-1 text-blue-600"><span class="material-icons-round text-[10px]">male</span> <span>{staffStats.male}</span></div>
                          <div class="w-px h-2 bg-slate-300"></div>
                          <div class="flex items-center gap-1 text-pink-600"><span class="material-icons-round text-[10px]">female</span> <span>{staffStats.female}</span></div>
                      </div>
                  {/if}
              </div>

              <div class="flex items-center gap-2">
                  <div class="bg-slate-200 p-1 rounded-lg flex">
                      <button class="px-3 py-1.5 rounded-md text-xs font-bold transition-all {activeMatrixMode==='weekday'?'bg-white text-indigo-600 shadow-sm':'text-slate-500 hover:text-slate-700'}" on:click={() => dispatch('modeChange', 'weekday')}>
                          Thứ 2 - 6
                      </button>
                      <button class="px-3 py-1.5 rounded-md text-xs font-bold transition-all {activeMatrixMode==='weekend'?'bg-orange-100 text-orange-600 shadow-sm':'text-slate-500 hover:text-slate-700'}" on:click={() => dispatch('modeChange', 'weekend')}>
                          T7 & CN 🔥
                      </button>
                  </div>
                  <div class="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                      <button class="w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded text-slate-500" on:click={() => dispatch('monthChange', -1)}>
                          <span class="material-icons-round text-sm">chevron_left</span>
                      </button>
                      <span class="font-bold text-slate-800 text-sm px-2 min-w-[70px] text-center">
                          T{scheduleMonth}/{scheduleYear}
                      </span>
                      <button class="w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded text-slate-500" on:click={() => dispatch('monthChange', 1)}>
                          <span class="material-icons-round text-sm">chevron_right</span>
                      </button>
                  </div>
              </div>
          </div>
      </div>
      
      <div class="flex-1 overflow-auto p-4 relative h-[500px] {activeMatrixMode==='weekend'?'bg-orange-50/30':''}">
           <table class="w-full text-sm border-separate border-spacing-0 rounded-xl border border-slate-200">
              <thead id="table-left-head" class="bg-slate-50 text-slate-500 sticky top-0 z-10">
                  <tr>
                    <th class="p-3 text-left font-bold border-b border-r border-slate-200 bg-slate-50 h-12 box-border min-w-[100px] whitespace-nowrap">Bộ Phận</th>
                    {#each shiftCols as col}
                        <th class="p-2 text-center border-b border-slate-200 border-l border-white min-w-[60px] bg-slate-50 h-12 box-border">
                            <div class="flex items-center justify-center h-8 font-black text-slate-700">{col.id.toUpperCase()}</div>
                        </th>
                    {/each}
                    <th class="p-3 text-center font-bold bg-slate-100 border-b border-l border-slate-200 text-slate-700 sticky right-0 h-12 box-border whitespace-nowrap">Tổng</th>
                  </tr>
              </thead>
              <tbody id="table-left-body">
                  {#each roleRows as role}
                      <tr class="group hover:bg-slate-50/50 transition-colors">
                          <td class="p-3 font-bold border-r border-slate-100 {role.color} border-l-4 h-12 box-border whitespace-nowrap">{role.label}</td>
                          {#each shiftCols as shift}
                              <td class="p-1 border-r border-slate-100 text-center h-12 box-border">
                                  {#if activeMatrixMode === 'weekday'}
                                      <input type="number" min="0" bind:value={shiftMatrix[shift.id][role.id]} class="w-full h-8 text-center font-bold outline-none rounded focus:bg-indigo-50 hover:bg-white text-slate-700 bg-transparent transition-all border border-transparent focus:border-indigo-200">
                                   {:else}
                                      <input type="number" min="0" bind:value={weekendMatrix[shift.id][role.id]} class="w-full h-8 text-center font-bold outline-none rounded focus:bg-orange-100 hover:bg-white text-orange-800 bg-transparent transition-all border border-transparent focus:border-orange-200">
                                  {/if}
                              </td>
                          {/each}
                          <td class="p-3 text-center font-black text-slate-700 bg-slate-50 border-l border-slate-100 sticky right-0 h-12 box-border">{getRoleTotal(role.id, activeMatrixMode==='weekday'?shiftMatrix:weekendMatrix)}</td>
                      </tr>
                  {/each}
              </tbody>
              <tfoot class="bg-slate-800 text-slate-300 font-bold sticky bottom-0 z-10 shadow-lg">
                  <tr>
                      <td class="p-3 text-right text-xs uppercase tracking-wider bg-slate-800 h-12 box-border whitespace-nowrap">Tổng</td>
                      {#each shiftCols as shift}
                          <td class="p-3 text-center text-yellow-400 font-mono text-sm font-bold bg-slate-800 h-12 box-border">{getShiftTotal(shift.id, activeMatrixMode==='weekday'?shiftMatrix:weekendMatrix)}</td>
                      {/each}
                      <td class="p-3 text-center text-white text-sm font-bold bg-slate-900 sticky right-0 h-12 box-border">{getGrandTotal(activeMatrixMode==='weekday'?shiftMatrix:weekendMatrix)}</td>
                  </tr>
              </tfoot>
          </table>
      </div>
      <div class="p-4 border-t bg-white shrink-0">
          <button id="btn-calculate" class="w-full h-12 bg-green-600 text-white font-bold rounded-xl shadow hover:bg-green-700 flex justify-center items-center gap-2 transition-transform active:scale-[0.98]" on:click={() => dispatch('calculate')}>
              <span class="material-icons-round">calculate</span> TÍNH TOÁN & QUY ĐỔI
          </button>
      </div>
  </div>

  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full relative">
      <div class="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0 flex items-center"> 
           <div class="flex justify-between items-center w-full">
               <div class="flex flex-col justify-center">
                   <h3 class="font-bold text-slate-800 text-lg">Combo Gợi Ý</h3>
                   <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">Tùy chỉnh cột & số lượng</span>
               </div>
               
               <div class="flex items-center gap-2">
                   <button class="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-100 transition-colors" on:click={() => dispatch('addCol')}>
                      <span class="material-icons-round text-sm">add</span> Thêm Cột
                  </button>
               </div>
           </div>
      </div>
       
      <div class="flex-1 overflow-auto p-4 relative h-[500px] {activeMatrixMode==='weekend'?'bg-orange-50/30':''}">
           <table class="w-full text-sm border-separate border-spacing-0 rounded-xl border border-slate-200">
               <thead id="table-right-head" class="bg-slate-50 text-slate-500 sticky top-0 z-10">
                   <tr>
                       <th class="p-3 text-left font-bold border-b border-r border-slate-200 bg-slate-50 min-w-[100px] h-12 box-border whitespace-nowrap">Bộ Phận</th>
                       {#each comboCols as code, i}
                           <th class="p-2 text-center border-b border-slate-200 border-l border-white min-w-[70px] bg-slate-50 group relative h-12 box-border">
                               <div class="flex items-center justify-center relative h-8">
                                   <input 
                                       type="text" 
                                       value={code} 
                                       on:focus={handleColFocus} 
                                       on:input={(e) => handleColInput(e, i)}
                                       on:change={(e) => handleColChange(e, i)}
                                       class="w-full h-full bg-transparent text-center font-black text-slate-700 outline-none border-b border-transparent focus:border-indigo-500 focus:bg-white text-xs py-1"
                                       placeholder="..."
                                   />
                                   <span class="material-icons-round text-[8px] text-slate-300 absolute right-0 pointer-events-none opacity-50">edit</span>
                               </div>
                           </th>
                       {/each}
                   </tr>
               </thead>
              <tbody id="table-right-body">
                  {#each roleRows as role}
                      <tr class="group hover:bg-slate-50/50 transition-colors">
                          <td class="p-3 font-bold border-r border-slate-100 {role.color} border-l-4 h-12 box-border whitespace-nowrap">{role.label}</td>
                          {#each comboCols as code}
                              <td class="p-1 border-r border-slate-100 text-center h-12 box-border">
                                  <input 
                                      type="text" 
                                      inputmode="numeric"
                                      value={formatQtyDisplay(displayGrid[role.id] ? displayGrid[role.id][code] : 0)}
                                      on:focus={handleQtyFocus}
                                      on:change={(e) => dispatch('updateCombo', { role: role.label, code, qty: e.target.value === '-' ? 0 : e.target.value })} 
                                      class="w-full h-8 text-center font-bold outline-none rounded focus:bg-indigo-50 hover:bg-white text-indigo-600 bg-transparent transition-all border border-transparent focus:border-indigo-200"
                                  >
                              </td>
                          {/each}
                      </tr>
                  {/each}
              </tbody>
              
              <tfoot class="bg-slate-800 text-slate-300 font-bold sticky bottom-0 z-10 shadow-lg">
                  <tr>
                      <td class="p-3 text-right text-xs uppercase tracking-wider bg-slate-800 h-12 box-border whitespace-nowrap">Tổng</td>
                      {#each comboCols as code}
                          <td class="p-3 text-center text-white text-sm font-bold bg-slate-900 border-l border-slate-700 h-12 box-border">{comboTotalsMap[code] || 0}</td>
                      {/each}
                  </tr>
              </tfoot>
          </table>
      </div>

      <div class="p-4 bg-white border-t border-slate-100 flex gap-2 shrink-0 relative items-center">
            <div class="relative" bind:this={configDropdownNode}>
              <button class="h-12 px-4 flex items-center justify-center bg-slate-100 text-slate-600 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors border border-slate-200 gap-2 font-bold text-xs" on:click={()=>showConfigDropdown=!showConfigDropdown}>
                  <span class="material-icons-round">wc</span> <span>Giới tính</span>
              </button>
              {#if showConfigDropdown}
                  <div class="absolute bottom-full left-0 mb-3 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-50 animate-fadeIn arrow-bottom">
                      <h4 class="text-xs font-bold text-slate-800 mb-3 border-b pb-2">TÙY CHỌN GIỚI TÍNH</h4>
                      <div class="space-y-4">
                          <div>
                              <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Yêu cầu Kho</label>
                              <div class="flex bg-slate-50 rounded-lg border border-slate-200 p-1">
                                  {#each ['none', 'male_only', 'mixed'] as opt}
                                      <button class="flex-1 py-1.5 text-[10px] font-bold rounded capitalize {genderConfig.kho===opt?'bg-white shadow text-indigo-700':'text-slate-400 hover:text-slate-600'}" on:click={()=>dispatch('configChange', {type:'kho', val: opt})}>
                                          {opt==='none'?'Thoải mái':(opt==='male_only'?'Chỉ Nam':'Cặp Đôi')}
                                      </button>
                                  {/each}
                              </div>
                          </div>
                          <div>
                              <label class="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Yêu cầu Thu Ngân</label>
                              <div class="flex bg-slate-50 rounded-lg border border-slate-200 p-1">
                                  {#each ['none', 'female_only', 'mixed'] as opt}
                                      <button class="flex-1 py-1.5 text-[10px] font-bold rounded capitalize {genderConfig.tn===opt?'bg-white shadow text-purple-700':'text-slate-400 hover:text-slate-600'}" on:click={()=>dispatch('configChange', {type:'tn', val: opt})}>
                                          {opt==='none'?'Thoải mái':(opt==='female_only'?'Chỉ Nữ':'Cặp Đôi')}
                                      </button>
                                  {/each}
                              </div>
                          </div>
                      </div>
                  </div>
              {/if}
           </div>

           <button id="btn-preview-schedule" class="flex-1 h-12 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 active:scale-[0.98]" on:click={() => dispatch('preview')}>
               <span class="material-icons-round">calendar_view_month</span><span>XEM TRƯỚC LỊCH</span>
           </button>
      </div>
  </div>
</div>