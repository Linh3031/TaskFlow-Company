<script>
    // Một mục đếm số lượng: icon · tên · [−] số [+] — luôn trên một dòng. Số khác 0 tô màu nhấn.
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    export let icon = '';
    export let label = '';
    export let value = 0;
    export let deletable = false;

    $: active = value > 0;
</script>

<div class="flex items-center gap-0.5 sm:gap-2 px-1.5 sm:px-2 h-11 lg:h-[34px] border-b border-slate-100 {active ? 'bg-sky-50/60' : 'bg-white'}">
    <div class="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
        <span class="material-icons-round text-lg hidden sm:inline-flex shrink-0 {active ? 'text-sky-700' : 'text-slate-400'}">{icon}</span>
        <span class="min-w-0 truncate text-[13px] {active ? 'font-semibold text-slate-900' : 'text-slate-700'}" title={label}>{label}</span>
    </div>
    <div class="flex items-center gap-0.5 sm:gap-1 shrink-0">
        {#if deletable}
            <button class="h-6 w-6 flex items-center justify-center text-slate-300 hover:text-rose-600" title="Xoá mục này" aria-label="Xoá {label}" on:click={() => dispatch('delete')}>
                <span class="material-icons-round text-base">delete</span>
            </button>
        {/if}
        <button class="h-8 w-7 sm:w-9 lg:h-6 lg:w-6 rounded border border-slate-200 bg-white text-slate-600 flex items-center justify-center active:bg-slate-100" aria-label="Giảm {label}" on:click={() => dispatch('change', Math.max(0, value - 1))}>
            <span class="material-icons-round text-base">remove</span>
        </button>
        <span class="w-5 sm:w-6 text-center text-[13px] tabular-nums font-semibold {active ? 'text-sky-700' : 'text-slate-400'}">{value}</span>
        <button class="h-8 w-7 sm:w-9 lg:h-6 lg:w-6 rounded border border-slate-200 bg-white text-slate-600 flex items-center justify-center active:bg-slate-100" aria-label="Tăng {label}" on:click={() => dispatch('change', value + 1)}>
            <span class="material-icons-round text-base">add</span>
        </button>
    </div>
</div>
