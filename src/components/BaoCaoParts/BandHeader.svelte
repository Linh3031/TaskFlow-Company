<script>
    // Dải tiêu đề nhóm 28px — một tông xám, chữ 11px viết hoa
    export let icon = '';
    export let title = '';
</script>

<div class="h-7 px-2 flex items-center justify-between gap-2 bg-slate-100 border-b border-slate-200">
    <div class="flex items-center gap-1.5 min-w-0 text-slate-600">
        {#if icon}<span class="material-icons-round text-base shrink-0">{icon}</span>{/if}
        <span class="text-[11px] font-bold uppercase tracking-wider truncate">{title}</span>
    </div>
    {#if $$slots.right}<div class="flex items-center gap-1 shrink-0"><slot name="right" /></div>{/if}
</div>
