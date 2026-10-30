<script>
    // Ô nhập tiền (Tr) — một dòng như CounterRow: nhãn trái, ô nhập phải.
    // Input text-base (16px) trên mobile để trình duyệt không tự zoom.
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    export let icon = '';
    export let label = '';
    export let value = '';
    export let deletable = false;

    $: active = parseFloat(value) > 0;

    function blockNonNumericKeys(e) {
        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
    }
</script>

<div class="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2 h-11 lg:h-[34px] border-b border-slate-100 {active ? 'bg-emerald-50/60' : 'bg-white'}">
    <div class="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
        <span class="material-icons-round text-lg hidden sm:inline-flex shrink-0 {active ? 'text-emerald-700' : 'text-slate-400'}">{icon}</span>
        <span class="min-w-0 truncate text-[13px] {active ? 'font-semibold text-slate-900' : 'text-slate-700'}" title={label}>{label}</span>
    </div>
    <div class="flex items-center gap-0.5 sm:gap-1 shrink-0">
        {#if deletable}
            <button class="h-6 w-6 flex items-center justify-center text-slate-300 hover:text-rose-600" title="Xoá mục này" aria-label="Xoá {label}" on:click={() => dispatch('delete')}>
                <span class="material-icons-round text-sm">delete</span>
            </button>
        {/if}
        <input type="number" inputmode="decimal" min="0" step="0.1" placeholder="0" aria-label={label}
            {value} on:input={(e) => dispatch('change', e.target.value)} on:keydown={blockNonNumericKeys}
            class="h-8 lg:h-6 w-16 sm:w-[88px] lg:w-20 rounded border border-slate-200 px-2 text-base sm:text-[13px] tabular-nums text-right outline-none focus:border-sky-500" />
    </div>
</div>

<style>
    input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
</style>
