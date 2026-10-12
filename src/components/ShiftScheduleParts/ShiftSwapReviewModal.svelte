<script>
    // Popup xử lý phiếu đổi ca (mở từ cái chuông): NV được đổi Đồng ý/Từ chối, Quản lý Duyệt/Từ chối
    import { createEventDispatcher, onMount } from 'svelte';
    import { currentUser } from '../../lib/stores';
    import { getRoleBadge, getShiftColor } from '../../lib/shiftUtils.js';
    import {
        getSwapRequest, respondSwapAsTarget, respondSwapAsManager, getSwapGenderWarning,
        isSwapTarget, isSwapManager, roleLabel, dayLabel, SWAP_STATUS, SWAP_STATUS_LABEL
    } from '../../lib/shiftSwapRequest.js';

    export let requestId;

    const dispatch = createEventDispatcher();

    let request = null;
    let loading = true;
    let busy = false;

    $: canTargetRespond = request?.status === SWAP_STATUS.PENDING_TARGET && isSwapTarget($currentUser, request);
    $: canManagerRespond = request?.status === SWAP_STATUS.PENDING_MANAGER && isSwapManager($currentUser, request?.storeId);

    onMount(async () => {
        try { request = await getSwapRequest(requestId); }
        catch (e) { console.error('Lỗi tải phiếu đổi ca:', e); }
        finally { loading = false; }
    });

    async function respond(accept) {
        if (!request || busy) return;
        if (canManagerRespond && accept) {
            const warning = getSwapGenderWarning(request);
            if (warning && !confirm(warning)) return;
        }
        if (!accept && !confirm('Xác nhận TỪ CHỐI phiếu đổi ca này?')) return;

        busy = true;
        try {
            const actor = { username: $currentUser.username, name: $currentUser.name || $currentUser.username };
            if (canTargetRespond) {
                await respondSwapAsTarget(request.id, accept, actor);
                alert(accept ? '✅ Đã đồng ý. Phiếu đã chuyển cho quản lý duyệt.' : 'Đã từ chối phiếu đổi ca.');
            } else if (canManagerRespond) {
                await respondSwapAsManager(request.id, accept, actor);
                alert(accept ? '✅ Đã duyệt. Lịch chính thức đã được đổi ca.' : 'Đã từ chối phiếu đổi ca.');
            }
            dispatch('close');
        } catch (e) { alert('Lỗi: ' + e.message); }
        finally { busy = false; }
    }
</script>

<div class="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-sm rounded-xl p-5 shadow-2xl flex flex-col max-h-[90vh]" on:click|stopPropagation>
        <div class="flex justify-between items-center mb-4 shrink-0">
            <h3 class="font-bold text-lg text-slate-800 flex items-center gap-2"><span class="material-icons-round text-indigo-500">swap_horiz</span> Phiếu đổi ca</h3>
            <button class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 shrink-0" on:click={() => dispatch('close')}>
                <span class="material-icons-round text-[18px]">close</span>
            </button>
        </div>

        {#if loading}
            <div class="py-6 text-center text-gray-400 text-sm"><span class="material-icons-round animate-spin">sync</span></div>
        {:else if !request}
            <div class="py-6 text-center text-slate-400 text-sm">Không tìm thấy phiếu đổi ca này.</div>
        {:else}
            <p class="text-xs text-slate-500 mb-2">Kho <span class="font-bold">{request.storeId}</span> - Ngày <span class="font-bold">{dayLabel(request.day, request.monthStr)}</span></p>

            <div class="flex flex-col gap-2 mb-3">
                {#each [{ p: request.requester, label: 'Người xin đổi' }, { p: request.target, label: 'Người được đổi' }] as row}
                    {@const badge = getRoleBadge(row.p.role)}
                    <div class="flex items-center gap-2 p-2 rounded-lg border border-slate-100">
                        <div class="flex-1 overflow-hidden">
                            <p class="text-[10px] text-slate-400 uppercase font-bold">{row.label}</p>
                            <p class="text-sm font-bold truncate capitalize {row.p.gender === 'Nam' ? 'text-blue-700' : 'text-pink-600'}">{row.p.name}</p>
                        </div>
                        <div class="w-12 shrink-0 rounded py-1 font-bold text-[10px] flex flex-col items-center justify-center border {getShiftColor(row.p.shift)}">
                            <span>{row.p.shift}</span>
                            {#if badge}<span class="text-[8px] leading-none px-1 py-0.5 rounded mt-0.5 {badge.class}">{badge.text}</span>{/if}
                        </div>
                    </div>
                {/each}
            </div>

            <div class="p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 mb-3">
                Sau khi duyệt: <span class="font-bold">{request.requester.name}</span> làm {request.target.shift} ({roleLabel(request.target.role)}), <span class="font-bold">{request.target.name}</span> làm {request.requester.shift} ({roleLabel(request.requester.role)}).
            </div>

            <p class="text-xs mb-4">Trạng thái: <span class="font-bold text-indigo-700">{SWAP_STATUS_LABEL[request.status] || request.status}</span>{#if request.managerName} ({request.managerName}){/if}</p>

            {#if canTargetRespond || canManagerRespond}
                <div class="flex gap-2 shrink-0">
                    <button class="flex-1 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 font-bold text-sm hover:bg-red-100 disabled:opacity-50" disabled={busy} on:click={() => respond(false)}>Từ chối</button>
                    <button class="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm shadow hover:bg-green-700 disabled:opacity-50" disabled={busy} on:click={() => respond(true)}>
                        {busy ? 'Đang xử lý...' : (canManagerRespond ? 'Duyệt' : 'Đồng ý')}
                    </button>
                </div>
            {/if}
        {/if}
    </div>
</div>
