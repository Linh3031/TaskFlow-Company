<script>
    // Thẻ chỉ số của tab Biểu đồ: icon · tiêu đề · số lớn · dòng phụ (nhãn + giá trị)
    export let icon = '';
    export let title = '';
    export let value = '';
    export let unit = '';
    export let subLabel = '';
    export let subValue = '';
    export let tone = 'sky'; // sky | emerald | rose

    const TONES = {
        sky: { icon: 'bg-sky-50 text-sky-700', value: 'text-sky-700', chip: 'bg-sky-50 text-sky-700 border-sky-200' },
        emerald: { icon: 'bg-emerald-50 text-emerald-700', value: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        rose: { icon: 'bg-rose-50 text-rose-700', value: 'text-rose-700', chip: 'bg-rose-50 text-rose-700 border-rose-200' },
        violet: { icon: 'bg-violet-50 text-violet-700', value: 'text-violet-700', chip: 'bg-violet-50 text-violet-700 border-violet-200' },
        slate: { icon: 'bg-sky-50 text-sky-700', value: 'text-slate-900', chip: 'bg-sky-50 text-sky-700 border-sky-200' },
    };
    $: t = TONES[tone] || TONES.sky;
</script>

<div class="border border-slate-200 bg-white rounded-lg p-2.5 flex flex-col gap-1.5 min-w-0 overflow-hidden">
    <div class="flex items-center gap-1.5 min-w-0">
        <span class="w-6 h-6 rounded-md flex items-center justify-center shrink-0 {t.icon}"><span class="material-icons-round text-base">{icon}</span></span>
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">{title}</span>
    </div>
    <div class="flex items-baseline justify-center gap-1 w-full overflow-hidden">
        <span class="text-[22px] sm:text-[26px] font-black leading-none tracking-tight tabular-nums truncate {t.value}">{value}</span>
        <span class="text-[12px] sm:text-[14px] font-extrabold text-slate-400 shrink-0">{unit}</span>
    </div>
    <div class="flex items-center justify-between gap-1 text-[11px] text-slate-500 min-w-0">
        <span class="truncate">{subLabel}</span>
        <span class="inline-flex items-center px-1.5 py-0.5 rounded-md font-bold border tabular-nums shrink-0 {t.chip}">{subValue}</span>
    </div>
</div>
