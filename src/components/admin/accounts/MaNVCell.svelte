<script>
    import { onDestroy } from 'svelte';
    import { accountService } from '../../../services/accountService';

    export let account;
    export let disabled = false;

    let value = account.maNV || '';
    let status = ''; // '' | 'saving' | 'saved' | 'error'
    let errorMsg = '';
    let savedTimer;

    onDestroy(() => clearTimeout(savedTimer));

    async function save() {
        const clean = String(value || '').trim();
        const old = account.maNV || '';
        value = clean;
        if (clean === old) { status = ''; errorMsg = ''; return; }
        if (clean && !/^\d+$/.test(clean)) { status = 'error'; errorMsg = 'Chỉ nhập số'; return; }
        if (!clean && !confirm(`Xoá MSNV của tài khoản ${account.username}?`)) { value = old; status = ''; errorMsg = ''; return; }

        status = 'saving';
        errorMsg = '';
        try {
            if (clean) {
                const storeIds = account.storeIds || (account.storeId ? [account.storeId] : []);
                const conflict = await accountService.findMaNVConflict(clean, storeIds, [account.id, account.username_idx].filter(Boolean));
                if (conflict) {
                    status = 'error';
                    errorMsg = `Trùng với ${conflict.username}${conflict.name ? ` (${conflict.name})` : ''} – kho ${conflict.commonStore}`;
                    return;
                }
            }
            await accountService.updateMaNV(account.id, clean);
            account.maNV = clean;
            status = 'saved';
            clearTimeout(savedTimer);
            savedTimer = setTimeout(() => { if (status === 'saved') status = ''; }, 2000);
        } catch (e) {
            console.error("Lỗi lưu MSNV:", e);
            status = 'error';
            errorMsg = 'Chưa lưu được, thử lại';
        }
    }

    function handleKeydown(e) {
        if (e.key === 'Enter') e.target.blur();
        if (e.key === 'Escape') {
            value = account.maNV || '';
            status = ''; errorMsg = '';
            e.target.blur();
        }
    }

    function handleInput() {
        if (status === 'error') { status = ''; errorMsg = ''; }
    }

    $: inputClass = status === 'error'
        ? 'border-red-400 bg-red-50 text-red-700'
        : status === 'saved'
            ? 'border-green-500 bg-white text-slate-800'
            : !value
                ? 'border-red-200 bg-red-50 text-slate-800 placeholder:text-red-400'
                : 'border-transparent bg-transparent text-slate-800 hover:border-slate-300 focus:bg-white';
</script>

<div class="w-full">
    <div class="flex items-center gap-1">
        <input type="text" inputmode="numeric" size="7" bind:value
            class="w-full min-w-0 px-2 py-1 rounded border text-[13px] font-bold outline-none focus:border-indigo-500 disabled:cursor-not-allowed {inputClass}"
            placeholder="Thiếu"
            disabled={disabled || status === 'saving'}
            on:blur={save} on:keydown={handleKeydown} on:input={handleInput}>
        {#if status === 'saving'}
            <span class="material-icons-round text-sm text-slate-400 animate-spin shrink-0">sync</span>
        {:else if status === 'saved'}
            <span class="material-icons-round text-sm text-green-600 shrink-0">check_circle</span>
        {/if}
    </div>
    {#if status === 'error'}
        <div class="text-[10px] text-red-600 font-bold mt-0.5 leading-tight break-words">{errorMsg}</div>
    {/if}
</div>
