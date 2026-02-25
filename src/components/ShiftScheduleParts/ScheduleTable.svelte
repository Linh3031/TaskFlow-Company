<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    // Dữ liệu từ cha truyền xuống
    export let scheduleData;
    export let showPastDays;
    export let highlightedDay;
    export let isAdmin;

    // Các hàm tính toán từ cha truyền xuống để dùng chung, không code lặp lại
    export let isPastDay;
    export let getWeekday;
    export let getShiftColor;
    export let getRoleBadge;
    export let getWeekendHardRoleCount;
</script>

<div class="overflow-x-auto border rounded-xl bg-white shadow-sm max-h-[75vh] relative scroll-smooth">
    <table class="w-full min-w-max text-sm text-center border-collapse">
        <thead class="bg-amber-400 text-slate-900 sticky top-0 z-30 shadow-md">
            <tr>
                <th rowspan="2" class="p-2 sticky left-0 bg-white border-r border-amber-200 z-[60] min-w-[140px] max-w-[140px] text-left pl-3 shadow">NHÂN SỰ</th>
                
                {#each Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b)) as d}
                    {#if showPastDays || !isPastDay(d)}
                        <th class="p-1 border-l border-amber-500/30 min-w-[40px] text-xs font-black cursor-pointer hover:bg-amber-500 transition-colors select-none {['T7','CN'].includes(getWeekday(d)) ? 'bg-amber-300' : ''} {highlightedDay === d ? '!bg-indigo-300 !text-indigo-900 ring-2 ring-indigo-500 z-50 relative' : ''}" title="Click để tô màu cột" on:click={() => dispatch('clickHighlight', d)}>{d}</th>
                    {/if}
                {/each}
                
                <th rowspan="2" class="p-2 w-12 bg-amber-100 text-[10px] border-l border-amber-300 font-bold">Giờ</th>
                <th rowspan="2" class="p-2 w-10 bg-blue-100 text-[10px] border-l border-amber-300 font-bold text-blue-800">GH</th>
                <th rowspan="2" class="p-2 w-10 bg-purple-100 text-[10px] border-l border-amber-300 font-bold text-purple-800">TN</th>
                <th rowspan="2" class="p-2 w-10 bg-orange-100 text-[10px] border-l border-amber-300 font-bold text-orange-800">K</th>
                <th rowspan="2" class="p-2 w-14 bg-indigo-100 text-[10px] border-l border-amber-300 font-bold text-indigo-800" title="Số ca nghiệp vụ T7/CN">Ca<br>cuối tuần</th>
            </tr>
            <tr>
                {#each Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b)) as d}
                    {#if showPastDays || !isPastDay(d)}
                        <th class="p-0.5 border-l border-amber-500/30 text-[9px] cursor-pointer hover:bg-amber-400 transition-colors {['T7','CN'].includes(getWeekday(d))?'bg-amber-300/80 text-amber-900':'bg-amber-200/50 text-slate-700'} {highlightedDay === d ? '!bg-indigo-200 !text-indigo-900 border-x-2 border-indigo-400 relative z-40' : ''}" title="Click để xem phân ca trong ngày" on:click={() => dispatch('clickDayStats', d)}>
                            <div class="flex items-center justify-center relative">
                                <span>{getWeekday(d)}</span>
                                <span class="absolute -top-1 -right-1.5 flex h-3 w-3">
                                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span class="relative flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white italic font-serif">i</span>
                                </span>
                            </div>
                        </th>
                    {/if}
                {/each}
            </tr>
        </thead>
        <tbody class="divide-y text-xs">
            {#each scheduleData.stats as staff, i}
                {@const weCount = getWeekendHardRoleCount(staff.id)}
                <tr class="hover:bg-blue-50 transition-colors">
                    <td id={i===0 ? 'tour-staff-name' : ''} class="p-2 font-bold text-left sticky left-0 bg-white border-r z-20 cursor-pointer hover:text-indigo-600 hover:underline underline-offset-2 shadow pl-3 truncate min-w-[140px] max-w-[140px] {staff.gender==='Nam'?'text-blue-700':'text-pink-600'}" title="Click để xem lịch cá nhân" on:click={() => dispatch('clickStaff', { id: staff.id, name: staff.name })}>{staff.name}</td>
                    {#each Object.keys(scheduleData.data).sort((a,b)=>Number(a)-Number(b)) as d}
                        {#if showPastDays || !isPastDay(d)}
                            {@const assign = (scheduleData.data[d]||[]).find(x => x.staffId === staff.id)}
                            <td class="p-0.5 border-l border-gray-100 h-10 align-middle {isAdmin ? 'cursor-pointer hover:bg-gray-100' : ''} {['T7','CN'].includes(getWeekday(d)) ? 'bg-amber-50/50' : ''} {highlightedDay === d ? '!bg-indigo-50 border-x-2 border-indigo-300 relative z-10' : ''}" on:click={() => dispatch('clickCell', { day: d, staffId: staff.id, assign })}>
                                {#if assign}
                                    {@const badge = getRoleBadge(assign.role)}
                                    <div class="w-full h-full rounded py-1 font-bold text-[10px] flex flex-col items-center justify-center shadow-sm {getShiftColor(assign.shift)}">
                                        <span>{assign.shift}</span>
                                        {#if badge}<span class="text-[8px] leading-none px-1 py-0.5 rounded mt-0.5 {badge.class}">{badge.text}</span>{/if}
                                    </div>
                                {:else}<div class="text-gray-200">.</div>{/if}
                            </td>
                        {/if}
                    {/each}
                    <td class="p-2 font-bold text-center bg-amber-50 text-gray-700 border-l">{Math.round(staff.totalHours) || 0}</td>
                    <td class="p-2 font-bold text-center bg-blue-50 text-blue-600 border-l">{staff.gh || '-'}</td>
                    <td class="p-2 font-bold text-center bg-purple-50 text-purple-600 border-l">{staff.tn || 0}</td>
                    <td id={i===0 ? 'tour-total-col' : ''} class="p-2 font-bold text-center bg-orange-50 text-orange-600 border-l">{staff.kho || 0}</td>
                    <td class="p-2 font-bold text-center bg-indigo-50 text-indigo-700 border-l">{weCount}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>