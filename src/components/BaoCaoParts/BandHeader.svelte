<script>
    // Dải tiêu đề nhóm 28px — chữ 11px viết hoa; mặc định tông xám, `tone` để tô màu theo nhóm
    export let icon = '';
    export let title = '';
    export let tone = 'slate';

    const TONES = {
        slate: 'bg-slate-100 border-slate-200 text-slate-600',
        sky: 'bg-sky-100 border-sky-200 text-sky-800',
        emerald: 'bg-emerald-100 border-emerald-200 text-emerald-800',
        violet: 'bg-violet-100 border-violet-200 text-violet-800',
        amber: 'bg-amber-100 border-amber-200 text-amber-800',
        rose: 'bg-rose-100 border-rose-200 text-rose-800',
        indigo: 'bg-indigo-100 border-indigo-200 text-indigo-800',
    };
</script>

<div class="h-7 px-2 flex items-center justify-between gap-2 border-b {TONES[tone] || TONES.slate}">
    <div class="flex items-center gap-1.5 min-w-0">
        {#if icon}<span class="material-icons-round text-base shrink-0">{icon}</span>{/if}
        <span class="text-[11px] font-bold uppercase tracking-wider truncate">{title}</span>
    </div>
    {#if $$slots.right}<div class="flex items-center gap-1 shrink-0"><slot name="right" /></div>{/if}
</div>
