<script>
    import { createEventDispatcher } from 'svelte';
    import { db } from '../../lib/firebase';
    import { doc, updateDoc } from 'firebase/firestore';

    const dispatch = createEventDispatcher();
    
    export let pg;
    export let isAdmin = false;
    export let currentUser = null;

    // Phân quyền: Chỉ Admin hoặc chính chủ PG đó mới có quyền sửa
    $: canEdit = isAdmin || (currentUser && currentUser.username === pg.username);
    
    let isEditing = false;
    let isSaving = false;

    // Lưu trữ state form
    let form = {
        phone: pg.phone || '',
        phoneLeader: pg.phoneLeader || '',
        shiftMorning: pg.shiftMorning || '',
        shiftAfternoon: pg.shiftAfternoon || '',
        shiftSplit: pg.shiftSplit || '',
        shiftOff: pg.shiftOff || '',
        note: pg.note || ''
    };

    async function handleSave() {
        isSaving = true;
        try {
            const ref = doc(db, 'users', pg.id);
            await updateDoc(ref, form);
            // Cập nhật lại UI lập tức sau khi lưu
            Object.assign(pg, form);
            isEditing = false;
        } catch (error) {
            alert("Lỗi khi lưu thông tin: " + error.message);
        } finally {
            isSaving = false;
        }
    }
    
    function cancelEdit() {
        // Hoàn tác lại dữ liệu gốc nếu bấm Hủy
        form = {
            phone: pg.phone || '',
            phoneLeader: pg.phoneLeader || '',
            shiftMorning: pg.shiftMorning || '',
            shiftAfternoon: pg.shiftAfternoon || '',
            shiftSplit: pg.shiftSplit || '',
            shiftOff: pg.shiftOff || '',
            note: pg.note || ''
        };
        isEditing = false;
    }
</script>

<div class="fixed inset-0 z-[70] bg-slate-900/60 flex items-center justify-center p-3 backdrop-blur-sm" on:click={() => { if(!isEditing) dispatch('close') }}>
    <div class="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-popIn" on:click|stopPropagation>
        
        <div class="p-4 border-b border-slate-100 flex justify-between items-center shrink-0">
            <div>
                <h3 class="font-bold text-lg text-indigo-700">{pg.name}</h3>
                <p class="text-[10px] text-slate-500 font-semibold uppercase">Hãng: {pg.brand} - Nhóm: {pg.category}</p>
            </div>
            {#if !isEditing}
                <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors" on:click={() => dispatch('close')}>
                    <span class="material-icons-round text-sm">close</span>
                </button>
            {/if}
        </div>
        
        <div class="overflow-y-auto p-4 space-y-3 flex-1 bg-slate-50/50">
            
            <div class="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                <h4 class="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span class="material-icons-round text-[12px]">contact_phone</span> Thông tin liên hệ
                </h4>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[9px] text-slate-400 font-semibold mb-1 block">SĐT CÁ NHÂN</label>
                        {#if isEditing}
                            <input type="text" bind:value={form.phone} class="w-full text-xs p-1.5 border border-indigo-200 rounded outline-none focus:border-indigo-500 bg-indigo-50/30" placeholder="Nhập SĐT">
                        {:else}
                            <div class="text-xs font-bold text-slate-700">{pg.phone || '---'}</div>
                        {/if}
                    </div>
                    <div>
                        <label class="text-[9px] text-slate-400 font-semibold mb-1 block">SĐT QUẢN LÝ</label>
                        {#if isEditing}
                            <input type="text" bind:value={form.phoneLeader} class="w-full text-xs p-1.5 border border-indigo-200 rounded outline-none focus:border-indigo-500 bg-indigo-50/30" placeholder="Tên - SĐT">
                        {:else}
                            <div class="text-xs font-bold text-slate-700">{pg.phoneLeader || '---'}</div>
                        {/if}
                    </div>
                </div>
            </div>

            <div class="bg-white p-3 rounded-xl border border-orange-100 shadow-sm">
                <h4 class="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span class="material-icons-round text-[12px]">schedule</span> Cấu trúc ca làm việc
                </h4>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[9px] text-slate-400 font-semibold mb-1 block">CA SÁNG</label>
                        {#if isEditing}
                            <input type="text" bind:value={form.shiftMorning} class="w-full text-xs p-1.5 border border-orange-200 rounded outline-none focus:border-orange-500 bg-orange-50/30" placeholder="VD: 08:00 - 15:00">
                        {:else}
                            <div class="text-xs font-bold text-blue-700">{pg.shiftMorning || '---'}</div>
                        {/if}
                    </div>
                    <div>
                        <label class="text-[9px] text-slate-400 font-semibold mb-1 block">CA CHIỀU</label>
                        {#if isEditing}
                            <input type="text" bind:value={form.shiftAfternoon} class="w-full text-xs p-1.5 border border-orange-200 rounded outline-none focus:border-orange-500 bg-orange-50/30" placeholder="VD: 14:00 - 21:00">
                        {:else}
                            <div class="text-xs font-bold text-orange-700">{pg.shiftAfternoon || '---'}</div>
                        {/if}
                    </div>
                    <div>
                        <label class="text-[9px] text-slate-400 font-semibold mb-1 block">CA GÃY</label>
                        {#if isEditing}
                            <input type="text" bind:value={form.shiftSplit} class="w-full text-xs p-1.5 border border-orange-200 rounded outline-none focus:border-orange-500 bg-orange-50/30" placeholder="VD: 08-12 & 17-21">
                        {:else}
                            <div class="text-xs font-bold text-purple-700">{pg.shiftSplit || '---'}</div>
                        {/if}
                    </div>
                    <div>
                        <label class="text-[9px] text-slate-400 font-semibold mb-1 block">CA OFF (NGHỈ)</label>
                        {#if isEditing}
                            <input type="text" bind:value={form.shiftOff} class="w-full text-xs p-1.5 border border-orange-200 rounded outline-none focus:border-orange-500 bg-orange-50/30" placeholder="VD: Thứ 3 hàng tuần">
                        {:else}
                            <div class="text-xs font-bold text-red-600">{pg.shiftOff || '---'}</div>
                        {/if}
                    </div>
                </div>
            </div>

            <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1 block">
                    <span class="material-icons-round text-[12px]">edit_note</span> Ghi chú thêm
                </label>
                {#if isEditing}
                    <textarea bind:value={form.note} rows="2" class="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-slate-400 bg-slate-50 resize-none" placeholder="Nhập ghi chú (nếu có)..."></textarea>
                {:else}
                    <div class="text-xs text-slate-600 whitespace-pre-wrap">{pg.note || 'Không có ghi chú.'}</div>
                {/if}
            </div>
        </div>

        <div class="p-3 border-t border-slate-100 bg-white rounded-b-2xl shrink-0 flex gap-2">
            {#if isEditing}
                <button class="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors" on:click={cancelEdit} disabled={isSaving}>Hủy Bỏ</button>
                <button class="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex justify-center items-center shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-colors" on:click={handleSave} disabled={isSaving}>
                    {#if isSaving} 
                        <span class="material-icons-round text-[14px] animate-spin mr-1">sync</span> Đang lưu... 
                    {:else} 
                        Lưu Thông Tin 
                    {/if}
                </button>
            {:else}
                {#if canEdit}
                    <button class="flex-1 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors flex justify-center items-center gap-1" on:click={() => isEditing = true}>
                        <span class="material-icons-round text-[14px]">edit</span> Chỉnh Sửa
                    </button>
                {/if}
                <button class="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors" on:click={() => dispatch('close')}>Đóng</button>
            {/if}
        </div>
    </div>
</div>