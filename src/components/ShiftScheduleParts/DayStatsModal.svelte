<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    export let selectedDayStats;
</script>

<div class="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" on:click|stopPropagation>
        
        <div class="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
            <h3 class="font-bold text-lg text-slate-800">Ngày {selectedDayStats.day} ({selectedDayStats.weekday})</h3>
             <button on:click={() => dispatch('close')} class="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center"><span class="material-icons-round text-slate-500">close</span></button>
        </div>

        <div class="overflow-y-auto p-4 bg-white">
            <div class="mb-6 overflow-x-auto">
                 <h4 class="text-xs font-bold text-gray-400 uppercase mb-2">Tổng quan số lượng</h4>
                <table class="w-full text-sm border-separate border-spacing-0 rounded-xl overflow-hidden border border-slate-200">
                    <thead class="bg-slate-50 text-slate-500">
                        <tr>
                            <th class="p-2 text-left font-bold border-b border-r border-slate-200 text-xs">Bộ Phận</th>
                            {#each selectedDayStats.cols as col}<th class="p-2 text-center border-b border-slate-200 border-l border-white min-w-[40px] text-xs"><div class="font-black text-slate-700">{col}</div></th>{/each}
                            <th class="p-2 text-center font-bold bg-slate-100 border-b border-l border-slate-200 text-slate-700 text-xs">Tổng</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each selectedDayStats.roles as role}
                            <tr class="hover:bg-slate-50 transition-colors">
                                <td class="p-2 font-bold border-r border-slate-100 text-xs {role==='GH'?'text-blue-600':(role==='Thu Ngân'?'text-purple-600':(role==='Kho'?'text-orange-600':'text-gray-600'))}">{role}</td>
                                {#each selectedDayStats.cols as col}<td class="p-2 border-r border-slate-100 text-center font-mono text-xs {selectedDayStats.matrix[role][col]>0?'font-bold text-slate-800':'text-gray-300'}">{selectedDayStats.matrix[role][col] || '-'}</td>{/each}
                                <td class="p-2 text-center font-black text-slate-700 bg-slate-50 border-l border-slate-100 text-xs">{selectedDayStats.matrix[role]['Total']}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            <h4 class="text-xs font-bold text-gray-400 uppercase mb-3 sticky top-0 bg-white py-2 z-10 border-b">Chi tiết nhân sự</h4>
            <div class="space-y-4">
                
                <div class="rounded-xl border border-orange-100 bg-orange-50/30 overflow-hidden">
                    <div class="bg-orange-100 px-3 py-2 flex items-center justify-between">
                        <span class="font-bold text-orange-700 text-sm flex items-center gap-2">
                            <span class="material-icons-round text-base">inventory_2</span> KHO
                        </span>
                        <span class="bg-white text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-200">{selectedDayStats.matrix['Kho']['Total']} người</span>
                    </div>
                    <div class="p-3 grid gap-3">
                        {#each Object.keys(selectedDayStats.details['Kho']).sort() as shift}
                            <div class="flex items-start gap-2 text-sm border-b border-orange-100 last:border-0 pb-2 last:pb-0">
                                <div class="font-bold text-orange-600 bg-white border border-orange-200 px-2 py-1 rounded text-xs min-w-[40px] text-center shrink-0">{shift}</div>
                                <div class="flex flex-wrap gap-1.5 pt-0.5">
                                    {#each selectedDayStats.details['Kho'][shift] as name}
                                        <span class="text-slate-700 font-bold">{name}{#if name !== selectedDayStats.details['Kho'][shift][selectedDayStats.details['Kho'][shift].length - 1]}, {/if}</span>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                        {#if Object.keys(selectedDayStats.details['Kho']).length === 0}
                            <span class="text-xs text-gray-400 italic">Không có nhân sự</span>
                        {/if}
                    </div>
                </div>

                <div class="rounded-xl border border-purple-100 bg-purple-50/30 overflow-hidden">
                    <div class="bg-purple-100 px-3 py-2 flex items-center justify-between">
                        <span class="font-bold text-purple-700 text-sm flex items-center gap-2">
                            <span class="material-icons-round text-base">point_of_sale</span> THU NGÂN
                        </span>
                         <span class="bg-white text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200">{selectedDayStats.matrix['Thu Ngân']['Total']} người</span>
                    </div>
                    <div class="p-3 grid gap-3">
                        {#each Object.keys(selectedDayStats.details['Thu Ngân']).sort() as shift}
                            <div class="flex items-start gap-2 text-sm border-b border-purple-100 last:border-0 pb-2 last:pb-0">
                                <div class="font-bold text-purple-600 bg-white border border-purple-200 px-2 py-1 rounded text-xs min-w-[40px] text-center shrink-0">{shift}</div>
                                <div class="flex flex-wrap gap-1.5 pt-0.5">
                                     {#each selectedDayStats.details['Thu Ngân'][shift] as name}
                                        <span class="text-slate-700 font-bold">{name}{#if name !== selectedDayStats.details['Thu Ngân'][shift][selectedDayStats.details['Thu Ngân'][shift].length - 1]}, {/if}</span>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                         {#if Object.keys(selectedDayStats.details['Thu Ngân']).length === 0}
                            <span class="text-xs text-gray-400 italic">Không có nhân sự</span>
                        {/if}
                    </div>
                </div>

                <div class="rounded-xl border border-blue-100 bg-blue-50/30 overflow-hidden">
                    <div class="bg-blue-100 px-3 py-2 flex items-center justify-between">
                        <span class="font-bold text-blue-700 text-sm flex items-center gap-2">
                            <span class="material-icons-round text-base">local_shipping</span> GIAO HÀNG
                        </span>
                         <span class="bg-white text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">{selectedDayStats.matrix['GH']['Total']} người</span>
                    </div>
                    <div class="p-3 grid gap-3">
                        {#each Object.keys(selectedDayStats.details['GH']).sort() as shift}
                            <div class="flex items-start gap-2 text-sm border-b border-blue-100 last:border-0 pb-2 last:pb-0">
                                <div class="font-bold text-blue-600 bg-white border border-blue-200 px-2 py-1 rounded text-xs min-w-[40px] text-center shrink-0">{shift}</div>
                                <div class="flex flex-wrap gap-1.5 pt-0.5">
                                    {#each selectedDayStats.details['GH'][shift] as name}
                                        <span class="text-slate-700 font-bold">{name}{#if name !== selectedDayStats.details['GH'][shift][selectedDayStats.details['GH'][shift].length - 1]}, {/if}</span>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                         {#if Object.keys(selectedDayStats.details['GH']).length === 0}
                            <span class="text-xs text-gray-400 italic">Không có nhân sự</span>
                         {/if}
                    </div>
                </div>

            </div>
        </div>
         
    </div>
</div>