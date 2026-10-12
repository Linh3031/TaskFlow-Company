<script>
    // Popup NV tự đăng ký đổi ca: bấm ô lịch của mình -> Đăng ký đổi ca -> chọn người khác ca -> Lưu
    import { createEventDispatcher, onMount } from 'svelte';
    import { currentUser } from '../../lib/stores';
    import { getRoleBadge, getShiftColor } from '../../lib/shiftUtils.js';
    import {
        getSwapCandidates, loadOpenSwapRequests, findOpenRequestFor, createSwapRequest,
        roleLabel, dayLabel, SWAP_STATUS_LABEL
    } from '../../lib/shiftSwapRequest.js';

    export let scheduleData;
    export let day;
    export let myStaffId;
    export let storeId;
    export let monthStr;

    const dispatch = createEventDispatcher();

    let openRequests = [];
    let loadingRequests = true;
    let showForm = false;
    let selectedId = null;
    let saving = false;

    $: myAssign = (scheduleData?.data?.[String(day)] || []).find(a => a.staffId === myStaffId);
    $: myStat = (scheduleData?.stats || []).find(s => s.id === myStaffId);
    $: myOpenRequest = findOpenRequestFor(openRequests, day, myStaffId);
    $: candidates = getSwapCandidates(scheduleData, day, myStaffId);
    $: selected = candidates.find(c => c.staffId === selectedId) || null;

    onMount(async () => {
        try { openRequests = await loadOpenSwapRequests(storeId, monthStr); }
        catch (e) { console.error('Lỗi tải phiếu đổi ca:', e); }
        finally { loadingRequests = false; }
    });

    async function handleSave() {
        if (!selected || !myAssign || saving) return;
        saving = true;
        try {
            await createSwapRequest({
                storeId, monthStr, day,
                requester: { staffId: myStaffId, username: $currentUser.username, name: myStat?.name || $currentUser.name, gender: myStat?.gender || '', shift: myAssign.shift, role: myAssign.role },
                target: selected
            });
            alert(`✅ Đã gửi đăng ký đổi ca. Chờ ${selected.name} xác nhận, sau đó quản lý duyệt.`);
            dispatch('close');
        } catch (e) { alert('Lỗi: ' + e.message); }
        finally { saving = false; }
    }
</script>

<div class="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-sm rounded-xl p-5 shadow-2xl flex flex-col max-h-[90vh]" on:click|stopPropagation>
        <div class="flex justify-between items-start mb-4 shrink-0">
            <div class="overflow-hidden">
                <h3 class="font-bold text-lg text-slate-800 truncate">Ngày {dayLabel(day, monthStr)}</h3>
                {#if myAssign}
                    <p class="text-xs text-gray-500">Ca của bạn: <span class="font-bold">{myAssign.shift}</span> ({roleLabel(myAssign.role)})</p>
                {/if}
            </div>
            <button class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 shrink-0" on:click={() => dispatch('close')}>
                <span class="material-icons-round text-[18px]">close</span>
            </button>
        </div>

        {#if loadingRequests}
            <div class="py-6 text-center text-gray-400 text-sm"><span class="material-icons-round animate-spin">sync</span></div>
        {:else if myOpenRequest}
            <div class="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <p class="font-bold mb-1">Bạn đang có phiếu đổi ca ngày này</p>
                <p class="truncate">{myOpenRequest.requester.name} ⇄ {myOpenRequest.target.name}</p>
                <p>Trạng thái: <span class="font-bold">{SWAP_STATUS_LABEL[myOpenRequest.status] || myOpenRequest.status}</span></p>
            </div>
        {:else if !showForm}
            <button class="w-full py-2.5 rounded-xl border-2 border-indigo-400 text-indigo-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors" on:click={() => showForm = true}>
                <span class="material-icons-round text-base">swap_horiz</span> Đăng ký đổi ca
            </button>
        {:else}
            <p class="text-[11px] font-bold text-slate-500 uppercase mb-2 shrink-0">Chọn người muốn đổi (khác ca{scheduleData?.config?.byGender ? ', cùng giới' : ''}, không tính người OFF)</p>
            <div class="flex-1 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50 min-h-0">
                {#each candidates as c (c.staffId)}
                    {@const busy = findOpenRequestFor(openRequests, day, c.staffId)}
                    {@const badge = getRoleBadge(c.role)}
                    <button
                        class="w-full text-left p-2 flex items-center gap-2 transition-colors {selectedId === c.staffId ? 'bg-indigo-50' : 'hover:bg-slate-50'} disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={!!busy}
                        on:click={() => selectedId = c.staffId}
                    >
                        <span class="material-icons-round text-[18px] shrink-0 {selectedId === c.staffId ? 'text-indigo-600' : 'text-slate-300'}">{selectedId === c.staffId ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
                        <div class="flex-1 overflow-hidden">
                            <p class="text-sm font-bold truncate capitalize {c.gender === 'Nam' ? 'text-blue-700' : 'text-pink-600'}">{c.name}</p>
                            {#if busy}<p class="text-[10px] text-amber-600">Đang có phiếu đổi ca khác</p>{/if}
                        </div>
                        <div class="w-12 shrink-0 rounded py-1 font-bold text-[10px] flex flex-col items-center justify-center border {getShiftColor(c.shift)}">
                            <span>{c.shift}</span>
                            {#if badge}<span class="text-[8px] leading-none px-1 py-0.5 rounded mt-0.5 {badge.class}">{badge.text}</span>{/if}
                        </div>
                    </button>
                {:else}
                    <div class="p-6 text-center text-xs text-slate-400">Không có ai{scheduleData?.config?.byGender ? ' cùng giới' : ''} khác ca để đổi trong ngày này.</div>
                {/each}
            </div>

            {#if selected && myAssign}
                <div class="mt-3 p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 shrink-0">
                    Sau khi duyệt: bạn làm <span class="font-bold">{selected.shift} ({roleLabel(selected.role)})</span>, <span class="font-bold">{selected.name}</span> làm <span class="font-bold">{myAssign.shift} ({roleLabel(myAssign.role)})</span>.
                </div>
            {/if}

            <div class="flex gap-2 mt-4 shrink-0">
                <button class="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200" on:click={() => dispatch('close')}>Hủy</button>
                <button class="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!selected || saving} on:click={handleSave}>
                    {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
            </div>
        {/if}
    </div>
</div>
