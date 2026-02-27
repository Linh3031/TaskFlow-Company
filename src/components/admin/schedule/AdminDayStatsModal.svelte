<script>
    import { createEventDispatcher } from 'svelte';

    export let selectedDayStats;

    const dispatch = createEventDispatcher();

    function getDayColTotal(col) { 
        return selectedDayStats ? selectedDayStats.roles.reduce((sum, r) => sum + (selectedDayStats.matrix[r][col]||0), 0) : 0; 
    }
    
    function getDayGrandTotal() { 
        return selectedDayStats ? selectedDayStats.roles.reduce((sum, r) => sum + selectedDayStats.matrix[r]['Total'], 0) : 0; 
    }
</script>

<div class="fixed inset-0 z-[90] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}> 
    <div class="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" on:click|stopPropagation> 
        <div class="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center"> 
            <h3 class="font-bold text-lg text-slate-800"> Chi Tiết Ngày {selectedDayStats.day} ({selectedDayStats.weekday}) <span class="ml-2 text-sm text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">Tổng công: {selectedDayStats.totalHours} giờ</span> </h3> 
            <button on:click={() => dispatch('close')} class="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center"><span class="material-icons-round text-slate-500">close</span></button> 
        </div> 
        <div class="p-5 overflow-x-auto"> 
            <table class="w-full text-sm border-separate border-spacing-0 rounded-xl overflow-hidden border border-slate-200"> 
                <thead class="bg-slate-50 text-slate-500"><tr><th class="p-3 text-left font-bold border-b border-r border-slate-200">Bộ Phận</th>{#each selectedDayStats.cols as col}<th class="p-2 text-center border-b border-slate-200 border-l border-white min-w-[50px]"><div class="font-black text-slate-700">{col}</div></th>{/each}<th class="p-3 text-center font-bold bg-slate-100 border-b border-l border-slate-200 text-slate-700">Tổng</th></tr></thead> 
                <tbody> 
                    {#each selectedDayStats.roles as role} 
                        <tr class="hover:bg-slate-50 transition-colors"> 
                            <td class="p-3 font-bold border-r border-slate-100 {role==='GH'?'text-blue-600':(role==='Thu Ngân'?'text-purple-600':(role==='Kho'?'text-orange-600':'text-gray-600'))}">{role}</td> 
                            {#each selectedDayStats.cols as col}<td class="p-2 border-r border-slate-100 text-center font-mono {selectedDayStats.matrix[role][col]>0?'font-bold text-slate-800':'text-gray-300'}">{selectedDayStats.matrix[role][col] || '-'}</td>{/each} 
                            <td class="p-3 text-center font-black text-slate-700 bg-slate-50 border-l border-slate-100">{selectedDayStats.matrix[role]['Total']}</td> 
                        </tr> 
                    {/each} 
                </tbody> 
                <tfoot class="bg-slate-800 text-slate-300 font-bold"><tr><td class="p-3 text-right text-xs uppercase tracking-wider">Tổng Cộng</td>{#each selectedDayStats.cols as col}<td class="p-3 text-center text-yellow-400 font-mono text-lg">{getDayColTotal(col)}</td>{/each}<td class="p-3 text-center text-white text-xl bg-slate-900">{getDayGrandTotal()}</td></tr></tfoot> 
            </table> 
        </div> 
    </div> 
</div>