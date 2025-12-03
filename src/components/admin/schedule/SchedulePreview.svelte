<script>
  // Version 1.0 - Preview UI Component
  import { createEventDispatcher } from 'svelte';
  
  export let previewScheduleData = null;
  export let previewStats = [];
  export let optimizationLogs = [];
  export let inspectionMode = 'none';
  export let INSPECTION_OPTIONS = [];
  
  // Callbacks for validation & styling
  export let checkInspectionError = (d, assign, mode) => false;
  export let getWeekendFairnessStatus = (staffId) => 0;
  export let getWeekendHardRoleCount = (staffId) => 0;
  export let getWeekday = (day) => '';
  export let getShiftColor = (code) => '';
  export let getRoleBadge = (role) => null;
  export let isCellRelevant = (d, assign, mode) => true;

  const dispatch = createEventDispatcher();

  function onInspectionChange(e) {
      dispatch('inspectionChange', e.target.value);
  }
</script>

<div class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-fadeIn scroll-mt-20 min-h-[500px]">
  <div class="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center bg-slate-50/50 gap-4">
      <div class="flex items-center gap-4">
           <div><h3 class="font-bold text-slate-800 text-lg">Xem Trước & Tối Ưu Lịch</h3><p class="text-xs text-slate-400">Kiểm tra kỹ trước khi Áp dụng</p></div>
          
          <div class="relative group">
              <label for="inspection-select" class="sr-only">Chế độ soi lỗi</label>
              <div class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors select-none">
                  <span class="material-icons-round text-sm {inspectionMode!=='none' ? 'animate-pulse' : 'text-slate-400'} {INSPECTION_OPTIONS.find(o=>o.val===inspectionMode)?.color}">
                      {INSPECTION_OPTIONS.find(o=>o.val===inspectionMode)?.icon}
                  </span>
                  <select id="inspection-select" value={inspectionMode} on:change={onInspectionChange} class="bg-transparent font-bold text-xs text-slate-700 outline-none cursor-pointer appearance-none pr-4">
                      {#each INSPECTION_OPTIONS as opt}
                          <option value={opt.val}>{opt.label}</option>
                      {/each}
                  </select>
                  <span class="material-icons-round text-xs text-slate-400 absolute right-2 pointer-events-none">expand_more</span>
              </div>
          </div>

          {#if inspectionMode === 'rotation'}
              <button class="px-3 py-1.5 bg-orange-100 text-orange-700 font-bold rounded-lg hover:bg-orange-200 text-xs flex items-center gap-1 animate-pulse" on:click={() => dispatch('fixRotation')}>
                  <span class="material-icons-round text-sm">build</span> Sửa Nhịp Tự Động
              </button>
          {/if}
          {#if inspectionMode === 'weekend'}
              <button class="px-3 py-1.5 bg-indigo-100 text-indigo-700 font-bold rounded-lg hover:bg-indigo-200 text-xs flex items-center gap-1 animate-pulse" on:click={() => dispatch('fixWeekend')}>
                  <span class="material-icons-round text-sm">balance</span> Cân Bằng Tự Động
              </button>
          {/if}
          {#if inspectionMode === 'gender'}
              <button class="px-3 py-1.5 bg-pink-100 text-pink-700 font-bold rounded-lg hover:bg-pink-200 text-xs flex items-center gap-1 animate-pulse" on:click={() => dispatch('fixGender')}>
                  <span class="material-icons-round text-sm">wc</span> Cân Bằng Nam/Nữ
              </button>
          {/if}
      </div>
      <div class="flex gap-3">
          <button id="btn-optimize" disabled={!previewScheduleData} class="px-4 py-2 bg-yellow-500 text-white font-bold rounded-lg shadow hover:bg-yellow-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" on:click={() => dispatch('optimize')}><span class="material-icons-round text-sm">auto_fix_high</span> Tối Ưu</button>
          <button id="btn-reset" disabled={!previewScheduleData} class="px-4 py-2 bg-gray-500 text-white font-bold rounded-lg shadow hover:bg-gray-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" on:click={() => dispatch('reset')}><span class="material-icons-round text-sm">restart_alt</span> Reset</button>
          <button id="btn-apply" disabled={!previewScheduleData} class="px-6 py-2 bg-green-600 text-white font-bold rounded-lg shadow hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" on:click={() => dispatch('apply')}><span class="material-icons-round text-sm">check_circle</span> ÁP DỤNG</button>
      </div>
  </div>
  {#if !previewScheduleData}
      <div class="p-10 text-center text-gray-400 flex flex-col items-center">
          <span class="material-icons-round text-4xl mb-2 opacity-30">visibility_off</span>
          <p class="text-sm">Chưa có dữ liệu xem trước.</p>
      </div>
  {:else}
      {#if optimizationLogs.length > 0} <div class="bg-yellow-50 p-3 text-xs text-yellow-800 border-b border-yellow-100 max-h-32 overflow-y-auto"> <div class="font-bold mb-1">Đã thực hiện tối ưu:</div> {#each optimizationLogs as log}<div>• {log}</div>{/each} </div> {/if}
      <div class="flex-1 overflow-x-auto p-4 max-h-[600px] relative scroll-smooth"> 
          <table class="w-full text-xs text-center border-collapse min-w-[1500px]"> 
              <thead class="bg-amber-400 text-slate-900 sticky top-0 z-[60] shadow-md"> 
                  <tr> 
                      <th rowspan="2" class="p-2 sticky left-0 bg-white border-r border-amber-200 z-[70] min-w-[140px] text-left pl-3 shadow">NHÂN SỰ</th> 
                      {#each Object.keys(previewScheduleData).sort((a,b)=>Number(a)-Number(b)) as d} 
                          <th class="p-1 border-l border-amber-500/30 min-w-[40px] text-xs font-black cursor-pointer hover:bg-amber-500 transition-colors select-none {['T7','CN'].includes(getWeekday(d))?'bg-amber-300':''} relative group" on:click={()=>dispatch('headerClick', d)}>
                              {d}
                              {#if inspectionMode !== 'none'}
                                  {@const hasError = previewScheduleData[d].some(assign => checkInspectionError(d, assign, inspectionMode))}
                                  {#if hasError}
                                      <span class="absolute top-0 right-0 w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                                      <span class="absolute top-0 right-0 w-2 h-2 bg-red-600 rounded-full"></span>
                                  {/if}
                              {/if}
                              <div class="absolute bottom-full mb-1 hidden group-hover:flex bg-black text-white text-[9px] p-1 rounded whitespace-nowrap z-50 left-1/2 -translate-x-1/2">
                                  {inspectionMode!=='none'?'Xem lỗi':'Chi tiết'}
                              </div>
                          </th> 
                      {/each} 
                      <th rowspan="2" class="p-2 w-12 bg-white border-l border-amber-300 z-[70] font-bold text-[10px] text-slate-600">GIỜ</th>
                      <th rowspan="2" class="p-2 w-10 bg-blue-100 text-[10px] border-l border-amber-300 font-bold text-blue-800">GH</th> 
                      <th rowspan="2" class="p-2 w-10 bg-purple-100 text-[10px] border-l border-amber-300 font-bold text-purple-800">TN</th> 
                      <th rowspan="2" class="p-2 w-10 bg-orange-100 text-[10px] border-l border-amber-300 font-bold text-orange-800">K</th> 
                      <th rowspan="2" class="p-2 w-14 bg-indigo-100 text-[10px] border-l border-amber-300 font-bold text-indigo-800" title="Số ca nghiệp vụ T7/CN">WE<br>Ops</th>
                  </tr> 
                  <tr>
                      {#each Object.keys(previewScheduleData).sort((a,b)=>Number(a)-Number(b)) as d}
                          <th class="p-0.5 border-l border-amber-500/30 text-[9px] {['T7','CN'].includes(getWeekday(d))?'bg-amber-300/80 text-amber-900':'bg-amber-200/50 text-slate-700'}">{getWeekday(d)}</th>
                      {/each}
                  </tr>
              </thead> 
              <tbody class="divide-y text-xs"> 
                  {#each previewStats as staff} 
                      {@const weekendStatus = getWeekendFairnessStatus(staff.id)}
                      {@const weCount = getWeekendHardRoleCount(staff.id)}
                      <tr class="transition-colors"> 
                          <td class="p-2 border font-bold text-left sticky left-0 z-[50] shadow-r cursor-pointer hover:text-indigo-600 transition-all {staff.gender==='Nam'?'text-blue-700':'text-pink-600'} {weekendStatus !== 0 && inspectionMode==='weekend' ? (weekendStatus===1?'bg-red-100 ring-inset ring-2 ring-red-400 z-[60]':'bg-green-100 ring-inset ring-2 ring-green-400 z-[60]') : 'bg-white'}" on:click={() => dispatch('staffClick', {id: staff.id, name: staff.name})}>
                              {staff.name}
                              {#if weekendStatus === 1}<span class="block text-[8px] text-red-500 font-normal animate-pulse">Quá tải cuối tuần</span>{/if}
                              {#if weekendStatus === -1}<span class="block text-[8px] text-green-600 font-normal animate-pulse">Thiếu ca cuối tuần</span>{/if}
                          </td> 
                          
                          {#each Object.keys(previewScheduleData).sort((a,b)=>Number(a)-Number(b)) as d} 
                              {@const assign = previewScheduleData[d].find(x => x.staffId === staff.id)} 
                              {@const errorMsg = checkInspectionError(d, assign, inspectionMode)}
                              {@const isError = !!errorMsg}
                              {@const relevant = isCellRelevant(d, assign, inspectionMode)}

                              <td class="p-0.5 border-l border-gray-100 h-10 align-middle transition-all duration-300 
                                  {assign?.isChanged ? 'bg-yellow-100' : ''} 
                                  {['T7','CN'].includes(getWeekday(d))?'bg-amber-50/50':''} 
                                  cursor-pointer 
                                  {isError ? 'opacity-100 bg-white ring-4 ring-red-500 z-[60] scale-110 shadow-lg font-black' : (inspectionMode !== 'none' && !relevant ? 'opacity-25 grayscale blur-[0.5px]' : 'opacity-100 hover:bg-gray-100')}" 
                                  on:click={()=>dispatch('cellClick', {day: d, staffId: staff.id, assign})}
                                  title={isError ? errorMsg : ''}> 
                                  {#if assign && assign.shift !== 'OFF'} 
                                      {@const badge = getRoleBadge(assign.role)}
                                      <div class="w-full h-full rounded py-1 font-bold text-[10px] flex flex-col items-center justify-center shadow-sm {getShiftColor(assign.shift)}">
                                          <span>{assign.shift}</span>
                                          {#if badge}<span class="text-[8px] leading-none px-1 py-0.5 rounded mt-0.5 {badge.class}">{badge.text}</span>{/if}
                                      </div> 
                                  {/if} 
                              </td> 
                          {/each} 
                          
                          <td class="p-2 border font-bold text-center bg-white text-slate-700 border-l {inspectionMode!=='none'?'opacity-100':''}">{Math.round(staff.totalHours)||0}</td>
                          <td class="p-2 border font-bold text-center bg-blue-50 text-blue-600 {inspectionMode!=='none'?'opacity-100':''}">{staff.gh||'-'}</td> 
                          <td class="p-2 border font-bold text-center bg-purple-50 text-purple-600 {inspectionMode!=='none'?'opacity-100':''}">{staff.tn||0}</td> 
                          <td class="p-2 border font-bold text-center bg-orange-50 text-orange-600 {inspectionMode!=='none'?'opacity-100':''}">{staff.kho||0}</td> 
                          <td class="p-2 border font-bold text-center border-l {inspectionMode==='weekend' ? 'opacity-100' : 'opacity-100'} 
                              {weekendStatus===1?'text-red-600 bg-red-50':(weekendStatus===-1?'text-green-600 bg-green-50':'text-slate-600')}">
                              {weCount}
                          </td>
                      </tr> 
                  {/each} 
              </tbody> 
          </table> 
      </div>
  {/if}
</div>