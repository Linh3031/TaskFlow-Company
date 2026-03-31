<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import { db } from '../../../lib/firebase';
    import { doc, getDoc, setDoc } from 'firebase/firestore';

    export let storeId;
    export let masterStaffList = [];

    const dispatch = createEventDispatcher();

    let roster = [];
    let loading = true;
    let saving = false;

    // Computed: Lọc những ai chưa có mặt trong đội hình để đưa vào dropdown thêm mới
    $: availableToAdd = masterStaffList.filter(u => !roster.some(r => r.id === u.id));

    onMount(async () => {
        try {
            const rosterRef = doc(db, 'stores', storeId, 'config', 'roster');
            const rosterSnap = await getDoc(rosterRef);
            
            if (rosterSnap.exists() && rosterSnap.data().list) {
                let savedList = rosterSnap.data().list;
                
                roster = savedList
                    .filter(s => masterStaffList.some(m => m.id === s.id))
                    .map(s => {
                        const info = masterStaffList.find(m => m.id === s.id);
                        return { id: s.id, name: info.name, gender: info.gender };
                    });
            } else {
                roster = masterStaffList.map(m => ({ id: m.id, name: m.name, gender: m.gender }));
            }
        } catch (error) {
            console.error(error);
            alert("Lỗi tải lịch sử đội hình từ Cloud!");
        } finally {
            loading = false;
        }
    });

    // Hàm xử lý "Nhảy cóc" vị trí khi Admin gõ số trực tiếp
    function handlePositionChange(oldIndex, newValue) {
        let newTarget = parseInt(newValue, 10);
        
        // Chống lỗi nhập bậy
        if (isNaN(newTarget) || newTarget < 1) newTarget = 1;
        if (newTarget > roster.length) newTarget = roster.length;
        
        let newIndex = newTarget - 1; // Đổi từ số thứ tự (1-based) sang mảng (0-based)
        
        if (newIndex !== oldIndex) {
            const item = roster[oldIndex];
            let newList = [...roster];
            newList.splice(oldIndex, 1);         // Rút ra khỏi vị trí cũ
            newList.splice(newIndex, 0, item);   // Nhét vào vị trí mới
            roster = newList;
        } else {
            // Trick ép Svelte render lại UI nếu người dùng nhập số cũ hoặc số sai
            roster = [...roster]; 
        }
    }

    // Giữ lại 2 nút lên xuống cho nhu cầu xê dịch 1 bậc
    function moveUp(index) {
        if (index === 0) return;
        const temp = roster[index];
        roster[index] = roster[index - 1];
        roster[index - 1] = temp;
    }

    function moveDown(index) {
        if (index === roster.length - 1) return;
        const temp = roster[index];
        roster[index] = roster[index + 1];
        roster[index + 1] = temp;
    }

    function removeStaff(id) {
        roster = roster.filter(r => r.id !== id);
    }

    function addStaff(e) {
        const id = e.target.value;
        if (!id) return;
        const staff = availableToAdd.find(s => s.id === id);
        if (staff) {
            roster = [...roster, { id: staff.id, name: staff.name, gender: staff.gender }];
        }
        e.target.value = ""; 
    }

    async function saveRoster() {
        saving = true;
        try {
            await setDoc(doc(db, 'stores', storeId, 'config', 'roster'), { list: roster });
            alert("✅ Đã chốt Đội Hình Phân Ca!\nThuật toán Tự Động (AI) sẽ bốc theo đúng thứ tự này.");
            dispatch('close');
        } catch (error) {
            alert("Lỗi lưu lên Cloud: " + error.message);
        } finally {
            saving = false;
        }
    }
</script>

<div class="fixed inset-0 z-[150] bg-slate-900/70 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" on:click|stopPropagation>
        
        <div class="p-4 border-b bg-slate-50 flex justify-between items-center shrink-0">
            <div>
                <h3 class="font-black text-slate-800 flex items-center gap-2">
                    <span class="material-icons-round text-indigo-600">format_list_numbered</span> Đội Hình Phân Ca
                </h3>
                <p class="text-xs text-slate-500 mt-1">Gõ trực tiếp vào số thứ tự để nhảy hạng nhanh chóng.</p>
            </div>
            <button class="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" on:click={() => dispatch('close')}>
                <span class="material-icons-round">close</span>
            </button>
        </div>

        <div class="p-4 bg-indigo-50/50 border-b flex gap-2 items-center shrink-0">
            <span class="material-icons-round text-indigo-400">person_add</span>
            <select class="flex-1 p-2 text-sm font-bold text-indigo-800 bg-white border border-indigo-200 rounded outline-none shadow-sm cursor-pointer" on:change={addStaff}>
                <option value="">-- Bổ sung nhân sự vào đội hình --</option>
                {#each availableToAdd as staff}
                    <option value={staff.id}>{staff.name} ({staff.gender})</option>
                {/each}
            </select>
        </div>

        <div class="flex-1 overflow-y-auto p-4 bg-slate-100/50">
            {#if loading}
                <div class="text-center py-10 flex flex-col items-center">
                    <span class="material-icons-round animate-spin text-indigo-400 text-3xl mb-2">sync</span>
                    <span class="text-slate-500 font-bold text-sm">Đang đồng bộ dữ liệu Cloud...</span>
                </div>
            {:else if roster.length === 0}
                <div class="text-center py-10 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold">
                    Chưa có nhân sự nào trong đội hình.
                </div>
            {:else}
                <div class="space-y-2">
                    {#each roster as staff, i (staff.id)}
                        <div class="flex items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:border-indigo-400 group">
                            
                            <input 
                                type="number" 
                                value={i + 1} 
                                min="1" 
                                max={roster.length}
                                on:change={(e) => handlePositionChange(i, e.target.value)}
                                class="w-10 h-8 font-black text-indigo-700 text-center bg-indigo-50 border border-indigo-200 rounded outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all hide-arrows"
                                title="Nhập số hạng để nhảy nhanh"
                            />
                            
                            <div class="flex-1 px-3 font-bold text-slate-700 text-sm">
                                {staff.name} <span class="text-[10px] text-slate-400 font-normal">({staff.gender})</span>
                            </div>

                            <div class="flex items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                <button class="w-7 h-7 flex items-center justify-center rounded bg-slate-100 hover:bg-indigo-100 hover:text-indigo-600 text-slate-500 transition-colors disabled:opacity-30" disabled={i === 0} on:click={() => moveUp(i)}>
                                    <span class="material-icons-round text-sm">arrow_upward</span>
                                </button>
                                <button class="w-7 h-7 flex items-center justify-center rounded bg-slate-100 hover:bg-indigo-100 hover:text-indigo-600 text-slate-500 transition-colors disabled:opacity-30" disabled={i === roster.length - 1} on:click={() => moveDown(i)}>
                                    <span class="material-icons-round text-sm">arrow_downward</span>
                                </button>
                                <button class="w-7 h-7 flex items-center justify-center rounded bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-500 transition-colors ml-2" on:click={() => removeStaff(staff.id)} title="Loại khỏi đội hình tháng này">
                                    <span class="material-icons-round text-sm">person_remove</span>
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>

        <div class="p-4 border-t bg-white flex gap-3 shrink-0">
            <button class="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors" on:click={() => dispatch('close')}>Hủy</button>
            <button class="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 shadow flex justify-center items-center gap-2 transition-all" disabled={saving || loading} on:click={saveRoster}>
                {#if saving}<span class="material-icons-round animate-spin text-sm">sync</span>{:else}<span class="material-icons-round text-sm">save</span>{/if}
                Chốt Đội Hình Cloud
            </button>
        </div>
    </div>
</div>

<style>
    /* CSS ẩn 2 mũi tên tăng/giảm mặc định của ô input type="number" cho giao diện gọn gàng */
    .hide-arrows::-webkit-outer-spin-button,
    .hide-arrows::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    .hide-arrows[type=number] {
        -moz-appearance: textfield;
    }
</style>