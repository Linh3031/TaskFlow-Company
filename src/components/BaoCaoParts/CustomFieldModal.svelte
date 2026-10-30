<script>
    // Thêm mục tuỳ chỉnh vào một nhóm — đếm số lượng (cái) hoặc nhập tiền (Tr)
    import { createEventDispatcher } from 'svelte';
    import { GROUP_META } from '../../lib/baocao/catalog.js';
    const dispatch = createEventDispatcher();

    export let group;
    // Admin thêm → áp dụng cho cả kho; nhân viên thêm → chỉ lưu trên máy
    export let scopeNote = '';

    let name = '';
    let type = 'count';

    $: canSave = !!group && name.trim().length > 0;

    function submit() {
        if (!canSave) return;
        dispatch('save', { name: name.trim(), group, type });
        dispatch('close');
    }
</script>

<div class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" on:click|self={() => dispatch('close')} role="presentation">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100">
            <h3 class="text-base font-bold text-slate-800">Thêm mục mới</h3>
            <p class="text-xs text-slate-500 truncate">Nhóm {GROUP_META[group].label}</p>
            {#if scopeNote}<p class="text-xs font-semibold text-sky-700 truncate">{scopeNote}</p>{/if}
        </div>
        <div class="p-4 space-y-3">
            <div>
                <label for="bc-field-name" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Tên mục / sản phẩm</label>
                <!-- svelte-ignore a11y_autofocus -->
                <input id="bc-field-name" autofocus placeholder="VD: Ốp lưng, Mở thẻ…" bind:value={name}
                    on:keydown={(e) => { if (e.key === 'Enter') submit(); }}
                    class="w-full h-10 rounded border border-slate-200 px-3 text-base outline-none focus:border-sky-500" />
            </div>
            <div>
                <span class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Cách nhập</span>
                <div class="grid grid-cols-2 gap-2">
                    <button class="h-9 rounded text-sm font-bold border {type === 'count' ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-200 text-slate-600'}" on:click={() => type = 'count'}>Đếm số lượng (cái)</button>
                    <button class="h-9 rounded text-sm font-bold border {type === 'revenue' ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-200 text-slate-600'}" on:click={() => type = 'revenue'}>Tiền (Tr)</button>
                </div>
            </div>
        </div>
        <div class="flex gap-2 px-4 py-3 border-t border-slate-100">
            <button class="flex-1 h-10 rounded border border-slate-200 bg-white text-slate-600 font-bold text-sm" on:click={() => dispatch('close')}>Bỏ qua</button>
            <button class="flex-1 h-10 rounded bg-sky-600 text-white font-bold text-sm disabled:opacity-40" disabled={!canSave} on:click={submit}>Lưu</button>
        </div>
    </div>
</div>
