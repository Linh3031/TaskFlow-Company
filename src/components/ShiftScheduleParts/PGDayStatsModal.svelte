<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    
    export let day;
    export let pgList = [];
    export let pgScheduleData = {};

    const SHIFTS_CONFIG = [
        { id: 'Sáng', title: 'Ca Sáng', classes: 'bg-blue-50 border-blue-200 text-blue-700', badge: 'bg-blue-600 text-white' },
        { id: 'Chiều', title: 'Ca Chiều', classes: 'bg-orange-50 border-orange-200 text-orange-700', badge: 'bg-orange-600 text-white' },
        { id: 'Gãy', title: 'Ca Gãy', classes: 'bg-purple-50 border-purple-200 text-purple-700', badge: 'bg-purple-600 text-white' },
        { id: 'OFF', title: 'Nghỉ (OFF)', classes: 'bg-red-50 border-red-200 text-red-700', badge: 'bg-red-600 text-white' },
        { id: '', title: 'Chưa xếp ca (Trống)', classes: 'bg-slate-50 border-slate-200 text-slate-600', badge: 'bg-slate-500 text-white' }
    ];

    $: stats = SHIFTS_CONFIG.map(config => {
        const people = pgList.filter(pg => (pgScheduleData[pg.id]?.[day] || '') === config.id).map(pg => pg.username);
        return { ...config, count: people.length, people };
    });
</script>

<div class="fixed inset-0 z-[70] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[85vh] flex flex-col animate-popIn" on:click|stopPropagation>
        
        <div class="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl shrink-0">
            <h3 class="font-bold text-lg text-slate-800 flex items-center gap-2">
                <span class="material-icons-round text-indigo-500">pie_chart</span> Thống kê PG Ngày {day}
            </h3>
            <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-500" on:click={() => dispatch('close')}>
                <span class="material-icons-round text-sm">close</span>
            </button>
        </div>

        <div class="overflow-y-auto p-4 space-y-4 flex-1">
            {#each stats as st}
                {#if st.count > 0}
                    <div class="border rounded-xl p-3 {st.classes}">
                        <div class="flex justify-between items-center mb-3 border-b border-current pb-2 border-opacity-20">
                            <span class="font-black text-sm uppercase">{st.title}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm {st.badge}">{st.count} người</span>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            {#each st.people as p}
                                <span class="bg-white/80 backdrop-blur-sm border border-current border-opacity-30 text-xs px-2.5 py-1 rounded-md font-bold shadow-sm">{p}</span>
                            {/each}
                        </div>
                    </div>
                {/if}
            {/each}
        </div>
    </div>
</div>