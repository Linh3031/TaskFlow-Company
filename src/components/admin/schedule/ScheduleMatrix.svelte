<script>
  // Version 52.0 - Final UI Polish & Logic Fixes
  import { createEventDispatcher } from 'svelte';
  
  export let staffStats = {}; 
  export let shiftMatrix = {};
  export let weekendMatrix = {};
  export let activeMatrixMode = 'weekday';
  export let shiftCols = [];
  export let roleRows = [];
  export let comboCols = [];
  export let activeSuggestedCombos = [];
  export let comboTotalsMap = {};
  export let isPeakMode = false;
  export let scheduleMonth;
  export let scheduleYear;
  export let genderConfig = { kho: 'none', tn: 'none' };

  const dispatch = createEventDispatcher();
  let showConfigDropdown = false;
  let configDropdownNode;
  
  const getRoleTotal = (roleId, matrix) => Object.values(matrix).reduce((sum, s) => sum + (parseInt(s[roleId])||0), 0);
  const getShiftTotal = (shiftId, matrix) => { const s = matrix[shiftId] || {}; return (parseInt(s.kho)||0) + (parseInt(s.tn)||0) + (parseInt(s.tv)||0) + (parseInt(s.gh)||0); };
  const getGrandTotal = (matrix) => Object.values(matrix).reduce((sum, s) => sum + (parseInt(s.kho)||0) + (parseInt(s.tn)||0) + (parseInt(s.tv)||0) + (parseInt(s.gh)||0), 0);
  
  // FIX LOGIC COMBO: Map hiển thị -> DB
  function getComboQty(roleLabel, comboCode) {
      const targetRoles = [roleLabel];
      if (roleLabel === 'Thu Ngân') targetRoles.push('TN', 'tn');
      if (roleLabel === 'Giao Hàng') targetRoles.push('GH', 'gh');
      if (roleLabel === 'Tư Vấn') targetRoles.push('TV', 'tv');
      if (roleLabel === 'Kho') targetRoles.push('kho');

      const found = activeSuggestedCombos.find(c => { 
          const cRole = c.role || 'TV';
          return String(c.code).trim() === String(comboCode).trim() && targetRoles.includes(cRole); 
      });
      return found ? (parseInt(found.qty) || 0) : 0;
  }

  function handleWindowClick(e) {
      if (showConfigDropdown && configDropdownNode && !configDropdownNode.contains(e.target)) {
          showConfigDropdown = false;
      }
  }
</script>

<svelte:window on:click={handleWindowClick} />

<div class="grid grid-cols-1 xl:grid-cols-2 gap-6 shrink-0 h-auto">
  
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-full">
      <div class="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              
              <div class="flex items-center gap-3">
                  <h3 id="matrix-header-target" class="font-bold text-slate-800 text-lg leading-tight">Định Mức Nhân Sự</h3>
                  
                  {#if staffStats.total > 0}
                      <div class="flex items-center gap-2 text-[11px] font-bold bg-white text-slate-600 px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                          <div class="flex items-center gap-1" title="Tổng"><span class="material-icons-round text-xs text-slate-400">groups</span> <span class="text-xs">{staffStats.total}</span></div>
                          <div class="w-px h-3 bg-slate-200"></div>
                          <div class="flex items-center gap-1 text-blue-600" title="Nam"><span class="material-icons-round text-xs">male</span> <span class="text-xs">{staffStats.male}</span></div>
                          <div class="w-px h-3 bg-slate-200"></div>
                          <div class="flex items-center gap-1 text-pink-600" title="Nữ"><span class="material-icons-round text-xs">female</span> <span class="text-xs">{staffStats.female}</span></div>
                      </div>
                  {/if}
              </div>

              <div id="month-navigator" class="flex items-center gap-2">
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
      
      <div class="flex-1 overflow-auto p-4 relative {activeMatrixMode==='weekend'?'bg-orange-50/30':''}">
           <table class="w-full text-sm border-separate border-spacing-0 rounded-xl border border-slate-200">
              <thead class="bg-slate-50 text-slate-500 sticky top-0 z-10"><tr><th class="p-3 text-left font-bold border-b border-r border-slate-200 bg-slate-50">Bộ Phận</th>{#each shiftCols as col}<th class="p-2 text-center border-b border-slate-200 border-l border-white min-w-[60px] bg-slate-50"><div class="font-black text-slate-700">{col.id.toUpperCase()}</div></th>{/each}<th class="p-3 text-center font-bold bg-slate-100 border-b border-l border-slate-200 text-slate-700 sticky right-0">Tổng</th></tr></thead>
              <tbody>
                  {#each roleRows as role}
                      <tr class="group hover:bg-slate-50/50 transition-colors">
                          <td class="p-3 font-bold border-r border-slate-100 {role.color} border-l-4">{role.label}</td>
                          {#each shiftCols as shift}
                              <td class="p-1 border-r border-slate-100 text-center">
                                  {#if activeMatrixMode === 'weekday'}
                                       <input type="number" min="0" bind:value={shiftMatrix[shift.id][role.id]} class="w-full h-8 text-center font-bold outline-none rounded focus:bg-indigo-50 hover:bg-white text-slate-700 bg-transparent transition-all">
                                  {:else}
                                       <input type="number" min="0" bind:value={weekendMatrix[shift.id][role.id]} class="w-full h-8 text-center font-bold outline-none rounded focus:bg-orange-100 hover:bg-white text-orange-800 bg-transparent transition-all">
                                  {/if}
                              </td>
                          {/each}
                          <td class="p-3 text-center font-black text-slate-700 bg-slate-50 border-l border-slate-100 sticky right-0">{getRoleTotal(role.id, activeMatrixMode==='weekday'?shiftMatrix:weekendMatrix)}</td>
                      </tr>
                  {/each}
              </tbody>
              <tfoot class="bg-slate-800 text-slate-300 font-bold sticky bottom-0 z-10 shadow-lg">
                  <tr>
                      <td class="p-3 text-right text-xs uppercase tracking-wider bg-slate-800">Tổng</td>
                      {#each shiftCols as shift}
                          <td class="p-3 text-center text-yellow-400 font-mono text-sm font-bold bg-slate-800">{getShiftTotal(shift.id, activeMatrixMode==='weekday'?shiftMatrix:weekendMatrix)}</td>
                      {/each}
                       <td class="p-3 text-center text-white text-sm font-bold bg-slate-900 sticky right-0">{getGrandTotal(activeMatrixMode==='weekday'?shiftMatrix:weekendMatrix)}</td>
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

  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full">
      <div class="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0 flex items-center"> 
           <div class="flex justify-between items-center w-full">
               <div class="flex flex-col justify-center">
                   <h3 id="combo-header-target" class="font-bold text-slate-800 text-lg">Combo Gợi Ý</h3>
                   <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">Có thể chỉnh sửa</span>
               </div>
               
               <div class="flex items-center gap-2">
                  <label id="peak-mode-toggle" class="flex items-center gap-2 cursor-pointer select-none bg-white px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
                      <div class="relative">
                          <input type="checkbox" class="sr-only" checked={isPeakMode} on:change={() => dispatch('togglePeak')}>
                          <div class="block bg-slate-200 w-9 h-5 rounded-full transition-colors {isPeakMode ? 'bg-red-500' : ''}"></div>
                          <div class="dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition {isPeakMode ? 'translate-x-full' : ''}"></div>
                      </div>
                      <span class="text-xs font-bold {isPeakMode ? 'text-red-600' : 'text-slate-500'}">Cao Điểm 🔥</span>
                  </label>
               </div>
           </div>
      </div>
       
      <div class="flex-1 overflow-auto p-4 relative {activeMatrixMode==='weekend'?'bg-orange-50/30':''}">
           <table class="w-full text-sm border-separate border-spacing-0 rounded-xl border border-slate-200">
               <thead class="bg-slate-50 text-slate-500 sticky top-0 z-10"><tr><th class="p-3 text-left font-bold border-b border-r border-slate-200 bg-slate-50">Bộ Phận</th>{#each comboCols as code}<th class="p-2 text-center border-b border-slate-200 border-l border-white min-w-[60px] bg-slate-50"><div class="font-black text-slate-700">{code}</div></th>{/each}</tr></thead>
              <tbody>
                  {#each roleRows as role}
                      <tr class="group hover:bg-slate-50/50 transition-colors">
                          <td class="p-3 font-bold border-r border-slate-100 {role.color} border-l-4">{role.label}</td>
                          {#each comboCols as code}
                              <td class="p-1 border-r border-slate-100 text-center">
                                  <input 
                                      type="number" min="0" 
                                      value={getComboQty(role.label, code)} 
                                      on:change={(e) => dispatch('updateCombo', { role: role.label, code, qty: e.target.value })} 
                                      class="w-full h-8 text-center font-bold outline-none rounded focus:bg-indigo-50 hover:bg-white text-indigo-600 bg-transparent transition-all"
                                  >
                              </td>
                          {/each}
                      </tr>
                  {/each}
              </tbody>
              <tfoot class="bg-slate-800 text-slate-300 font-bold sticky bottom-0 z-10 shadow-lg">
                  <tr>
                      <td class="p-3 text-right text-xs uppercase tracking-wider bg-slate-800">Tổng</td>
                      {#each comboCols as code}
                          <td class="p-3 text-center text-white text-sm font-bold bg-slate-900 border-l border-slate-700">{comboTotalsMap[code] || 0}</td>
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