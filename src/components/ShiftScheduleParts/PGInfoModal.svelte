<script>
    import { createEventDispatcher } from 'svelte';
    import { db } from '../../lib/firebase';
    import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

    const dispatch = createEventDispatcher();
    
    export let pg;
    export let isAdmin = false;
    export let currentUser = null;

    $: isOwner = currentUser && pg && (
        (currentUser.username && pg.username && String(currentUser.username).trim() === String(pg.username).trim()) || 
        (currentUser.id && pg.id && currentUser.id === pg.id) ||
        (currentUser.uid && pg.id && currentUser.uid === pg.id)
    );
    $: canEdit = isAdmin || isOwner;
    
    let isEditing = false;
    let isSaving = false;

    const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    function initRoadshowMode(raw) {
        let res = {};
        DAYS.forEach(d => res[d] = 'different'); 
        if (typeof raw === 'string') {
            DAYS.forEach(d => res[d] = raw);
        } else if (typeof raw === 'object' && raw !== null) {
            DAYS.forEach(d => res[d] = raw[d] || 'different');
        }
        return res;
    }

    let form = {
        phone: pg.phone || '',
        phoneLeader: pg.phoneLeader || '',
        shiftType: pg.shiftType || 'flexible', // [CodeGenesis] Thêm phân loại ca
        shiftMorning: pg.shiftMorning || '',
        shiftAfternoon: pg.shiftAfternoon || '',
        shiftSplit: pg.shiftSplit || '',
        shiftOff: pg.shiftOff || '',
        note: pg.note || '',
        roadshowMode: initRoadshowMode(pg.roadshowMode)
    };

    function toggleDayMode(d) {
        form.roadshowMode[d] = form.roadshowMode[d] === 'same' ? 'different' : 'same';
        form.roadshowMode = { ...form.roadshowMode }; 
    }

    function syncAllMode(mode) {
        DAYS.forEach(d => form.roadshowMode[d] = mode);
        form.roadshowMode = { ...form.roadshowMode };
    }

    async function handleSave() {
        isSaving = true;
        try {
            const ref = doc(db, 'users', pg.id);
            const updatePayload = {
                ...form,
                lastModifiedBy: currentUser ? currentUser.username : 'Unknown_PGInfoModal',
                lastUpdatedAt: serverTimestamp()
            };
            await updateDoc(ref, updatePayload);
            Object.assign(pg, form);
            isEditing = false;
        } catch (error) {
            alert("Lỗi khi lưu thông tin: " + error.message);
        } finally {
            isSaving = false;
        }
    }
    
    function cancelEdit() {
        form = {
            phone: pg.phone || '',
            phoneLeader: pg.phoneLeader || '',
            shiftType: pg.shiftType || 'flexible',
            shiftMorning: pg.shiftMorning || '',
            shiftAfternoon: pg.shiftAfternoon || '',
            shiftSplit: pg.shiftSplit || '',
            shiftOff: pg.shiftOff || '',
            note: pg.note || '',
            roadshowMode: initRoadshowMode(pg.roadshowMode)
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
                <div class="grid grid-cols-2 gap-3 mb-3">
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
                <!-- [CodeGenesis] Thêm Select Box cho Loại Ca -->
                <div class="pt-2 border-t border-indigo-50">
                    <label class="text-[9px] text-slate-400 font-semibold mb-1 block">LOẠI CA LÀM VIỆC (QUOTA)</label>
                    {#if isEditing}
                        <select bind:value={form.shiftType} class="w-full text-xs p-1.5 border border-indigo-200 rounded outline-none focus:border-indigo-500 bg-indigo-50/30 cursor-pointer">
                            <option value="flexible">Linh hoạt (Sáng / Chiều / Gãy)</option>
                            <option value="morning_only">Cố định - Chỉ làm Sáng</option>
                            <option value="afternoon_only">Cố định - Chỉ làm Chiều</option>
                        </select>
                    {:else}
                        <div class="text-xs font-bold text-slate-700">
                            {#if pg.shiftType === 'morning_only'} <span class="text-blue-600">Cố định - Chỉ làm Sáng</span>
                            {:else if pg.shiftType === 'afternoon_only'} <span class="text-orange-600">Cố định - Chỉ làm Chiều</span>
                            {:else} <span class="text-teal-600">Linh hoạt (Sáng / Chiều / Gãy)</span>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>

            <div class="bg-white p-3 rounded-xl border border-orange-100 shadow-sm">
                <h4 class="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span class="material-icons-round text-[12px]">schedule</span> Cấu trúc ca chi tiết
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

            <div class="bg-white p-3 rounded-xl border border-pink-100 shadow-sm">
                <h4 class="text-[10px] font-bold text-pink-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span class="material-icons-round text-[12px]">directions_run</span> Thiết lập Roadshow
                </h4>
                
                <label class="text-[9px] text-slate-400 font-semibold mb-1 block">TÙY CHỈNH THEO NGÀY TRONG TUẦN</label>
                
                {#if isEditing}
                    <div class="flex gap-1 mt-1.5">
                        {#each DAYS as d}
                            <button type="button" class="flex-1 py-1.5 flex flex-col items-center justify-center rounded border transition-colors shadow-sm {form.roadshowMode[d] === 'same' ? 'bg-pink-50 border-pink-200 text-pink-600 hover:bg-pink-100' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}" on:click={() => toggleDayMode(d)} title="Nhấn để đổi trạng thái">
                                <span class="text-[9px] font-bold">{d}</span>
                                <span class="material-icons-round text-[14px] mt-0.5">{form.roadshowMode[d] === 'same' ? 'drag_handle' : 'swap_horiz'}</span>
                            </button>
                        {/each}
                    </div>
                    <div class="flex justify-between items-center mt-2.5 pt-2 border-t border-dashed border-slate-200">
                        <div class="text-[9px] text-slate-500 flex items-center gap-2">
                            <span class="flex items-center gap-0.5"><span class="material-icons-round text-[12px] text-slate-400">swap_horiz</span> Khác ca</span>
                            <span class="flex items-center gap-0.5 text-pink-500"><span class="material-icons-round text-[12px]">drag_handle</span> Cùng ca</span>
                        </div>
                        <div class="flex gap-1.5">
                            <button type="button" class="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-1 rounded font-bold hover:bg-slate-200" on:click={() => syncAllMode('different')}>Tất cả Khác</button>
                            <button type="button" class="text-[9px] bg-pink-100 text-pink-600 px-1.5 py-1 rounded font-bold hover:bg-pink-200" on:click={() => syncAllMode('same')}>Tất cả Cùng</button>
                        </div>
                    </div>
                {:else}
                    <div class="flex gap-1 mt-1">
                        {#each DAYS as d}
                            {@const rMode = initRoadshowMode(pg.roadshowMode)[d]}
                            <div class="flex-1 py-1 flex flex-col items-center justify-center rounded border {rMode === 'same' ? 'bg-pink-50 border-pink-100 text-pink-600' : 'bg-slate-50 border-slate-100 text-slate-400'} opacity-90">
                                <span class="text-[8px] font-bold">{d}</span>
                                <span class="material-icons-round text-[12px] mt-0.5">{rMode === 'same' ? 'drag_handle' : 'swap_horiz'}</span>
                            </div>
                        {/each}
                    </div>
                    <div class="flex justify-center items-center gap-3 mt-2 text-[9px] text-slate-500 font-medium">
                        <span class="flex items-center gap-0.5"><span class="material-icons-round text-[11px] text-slate-400">swap_horiz</span> Đảo ca (Mặc định)</span>
                        <span class="text-slate-300">|</span>
                        <span class="flex items-center gap-0.5 text-slate-600"><span class="material-icons-round text-[11px] text-pink-500">drag_handle</span> Cùng ca</span>
                    </div>
                {/if}
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