<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    export let selectedDayStats;

    // Trạng thái Tab: ROLE (Nghiệp vụ) | SHIFT (Ca làm việc)
    let viewMode = 'ROLE'; 

    function getRoleBadgeColor(role) {
        if (role === 'GH') return 'bg-blue-600 text-white';
        if (role === 'Thu Ngân') return 'bg-purple-600 text-white';
        if (role === 'Kho') return 'bg-orange-500 text-white';
        return 'bg-gray-400 text-white'; 
    }
</script>

<div class="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" on:click|stopPropagation>
        
        <div class="p-4 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
            <h3 class="font-bold text-lg text-slate-800 flex items-center gap-2">
                <span class="material-icons-round text-indigo-500">today</span> 
                Ngày {selectedDayStats.day} ({selectedDayStats.weekday})
            </h3>
             <button on:click={() => dispatch('close')} class="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
                 <span class="material-icons-round text-slate-500">close</span>
             </button>
        </div>

        <div class="bg-slate-50 px-4 pt-3 pb-3 border-b border-slate-200 flex justify-center shrink-0">
            <div class="flex bg-slate-200/80 p-1 rounded-lg shadow-inner">
                <button class="px-5 py-1.5 text-xs font-bold rounded-md transition-all {viewMode === 'ROLE' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}" on:click={() => viewMode = 'ROLE'}>
                    Nghiệp Vụ
                </button>
                <button class="px-5 py-1.5 text-xs font-bold rounded-md transition-all {viewMode === 'SHIFT' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}" on:click={() => viewMode = 'SHIFT'}>
                    Ca Làm Việc
                </button>
            </div>
        </div>

        <div class="overflow-y-auto p-4 bg-slate-50 flex-1">
            
            {#if viewMode === 'ROLE'}
                <div class="mb-6 overflow-x-auto bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <h4 class="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1"><span class="material-icons-round text-sm">grid_on</span> Ma trận số lượng</h4>
                    <table class="w-full text-sm border-separate border-spacing-0 rounded-lg overflow-hidden border border-slate-200">
                        <thead class="bg-slate-50 text-slate-600 font-bold">
                            <tr>
                                <th class="p-2 border-b border-r border-slate-200 text-left">Nghiệp Vụ</th>
                                {#each selectedDayStats.cols as c}
                                    <th class="p-2 border-b border-r border-slate-200 text-center">{c}</th>
                                {/each}
                                <th class="p-2 border-b border-slate-200 text-center text-indigo-600 bg-indigo-50">Tổng</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each selectedDayStats.roles as r}
                                <tr>
                                    <td class="p-2 border-b border-r border-slate-200 font-bold {r==='Kho'?'text-orange-600':(r==='Thu Ngân'?'text-purple-600':(r==='GH'?'text-blue-600':'text-gray-600'))}">{r}</td>
                                    {#each selectedDayStats.cols as c}
                                        <td class="p-2 border-b border-r border-slate-200 text-center {selectedDayStats.matrix[r][c] > 0 ? 'font-bold text-slate-800' : 'text-gray-300'}">{selectedDayStats.matrix[r][c] || '-'}</td>
                                    {/each}
                                    <td class="p-2 border-b border-slate-200 text-center font-bold text-indigo-600 bg-indigo-50/30">{selectedDayStats.matrix[r]['Total']}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <div>
                    <h4 class="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1"><span class="material-icons-round text-sm">assignment_ind</span> Chi tiết Hỗ trợ / Nghiệp vụ</h4>
                    <div class="grid gap-4">
                        <div class="border border-orange-200 rounded-xl bg-orange-50/30 overflow-hidden shadow-sm">
                            <div class="bg-orange-100 p-2 font-bold text-orange-800 text-sm flex justify-between items-center border-b border-orange-200">
                                <span><span class="material-icons-round text-sm align-middle mr-1">inventory_2</span>Kho</span>
                                <span class="bg-white text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-200">{selectedDayStats.matrix['Kho']['Total']} người</span>
                            </div>
                            <div class="p-3 grid gap-3 bg-white">
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

                        <div class="border border-purple-200 rounded-xl bg-purple-50/30 overflow-hidden shadow-sm">
                            <div class="bg-purple-100 p-2 font-bold text-purple-800 text-sm flex justify-between items-center border-b border-purple-200">
                                <span><span class="material-icons-round text-sm align-middle mr-1">point_of_sale</span>Thu Ngân</span>
                                <span class="bg-white text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200">{selectedDayStats.matrix['Thu Ngân']['Total']} người</span>
                            </div>
                            <div class="p-3 grid gap-3 bg-white">
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

                        <div class="border border-blue-200 rounded-xl bg-blue-50/30 overflow-hidden shadow-sm">
                            <div class="bg-blue-100 p-2 font-bold text-blue-800 text-sm flex justify-between items-center border-b border-blue-200">
                                <span><span class="material-icons-round text-sm align-middle mr-1">local_shipping</span>Giao Hàng</span>
                                <span class="bg-white text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">{selectedDayStats.matrix['GH']['Total']} người</span>
                            </div>
                            <div class="p-3 grid gap-3 bg-white">
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

            {:else}
                <div class="space-y-4">
                    {#each selectedDayStats.shiftDetails as { shift, people }}
                        <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            
                            <div class="p-2 border-b flex justify-between items-center {shift === 'OFF' ? 'bg-red-50 border-red-100' : 'bg-indigo-50/50 border-indigo-100'}">
                                <span class="font-bold text-sm {shift === 'OFF' ? 'text-red-600' : 'text-indigo-800'}">
                                    {shift === 'OFF' ? 'Nghỉ (OFF)' : `Ca ${shift}`}
                                </span>
                                <span class="text-[10px] font-bold bg-white border px-2 py-0.5 rounded-full shadow-sm {shift === 'OFF' ? 'text-red-500 border-red-200' : 'text-indigo-600 border-indigo-200'}">
                                    {people.length} nhân sự
                                </span>
                            </div>
                            
                            <div class="p-3 flex flex-wrap gap-2">
                                {#each people as p}
                                    <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100 transition-colors">
                                        {p.name}
                                        {#if p.role && p.role !== 'TV'}
                                            <span class="text-[9px] px-1.5 py-0.5 rounded leading-none shadow-sm {getRoleBadgeColor(p.role)}">
                                                {p.role === 'Thu Ngân' ? 'TN' : (p.role === 'Kho' ? 'K' : 'GH')}
                                            </span>
                                        {/if}
                                    </div>
                                {/each}
                            </div>

                        </div>
                    {/each}
                    
                    {#if selectedDayStats.shiftDetails.length === 0}
                        <div class="text-center p-8 text-slate-400 font-bold text-sm border-2 border-dashed border-slate-200 rounded-xl">
                            Không có dữ liệu ca làm việc trong ngày này.
                        </div>
                    {/if}
                </div>
            {/if}

        </div>
    </div>
</div>