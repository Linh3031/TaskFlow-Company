<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    
    export let staffList = [];
    export let fullStoreStaff = []; // Danh sách nhân sự gốc từ DB
    export let scheduleData = null; // Object lịch hiện tại
    
    // Tạo bản sao thao tác cục bộ
    let workingList = JSON.parse(JSON.stringify(staffList || []));
    
    // Tìm nhân sự chưa có trong lịch
    $: missingStaff = fullStoreStaff && fullStoreStaff.length > 0 
        ? fullStoreStaff.filter(fs => !workingList.some(ws => ws.id === fs.id))
        : [];

    function injectNewStaff(staff) {
        workingList = [...workingList, {
            ...staff,
            totalHours: 0,
            gh: 0, tn: 0, kho: 0,
            weekendHardRoles: 0,
            isNewInjected: true 
        }];
    }

    let draggedIndex = null;
    let hoveredIndex = null;

    // --- LOGIC KÉO THẢ ---
    function dragStart(event, index) {
        draggedIndex = index;
        event.dataTransfer.effectAllowed = 'move';
        let dragIcon = document.createElement('div');
        event.dataTransfer.setDragImage(dragIcon, 0, 0);
    }

    function dragEnter(index) { hoveredIndex = index; }
    function dragOver(event) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }

    function drop(event, index) {
        event.preventDefault();
        if (draggedIndex !== null && draggedIndex !== index) {
            const item = workingList[draggedIndex];
            workingList.splice(draggedIndex, 1);
            workingList.splice(index, 0, item);
            workingList = [...workingList];
        }
        draggedIndex = null; hoveredIndex = null;
    }

    // --- LOGIC NÚT BẤM ---
    function moveUp(index) {
        if (index > 0) {
            const temp = workingList[index];
            workingList[index] = workingList[index - 1];
            workingList[index - 1] = temp;
            workingList = [...workingList];
        }
    }

    function moveDown(index) {
        if (index < workingList.length - 1) {
            const temp = workingList[index];
            workingList[index] = workingList[index + 1];
            workingList[index + 1] = temp;
            workingList = [...workingList];
        }
    }

    function handleSave() {
        // Tự động tiêm ca OFF vào Ma trận data thật
        if (scheduleData && scheduleData.data) {
            const newStaffs = workingList.filter(s => s.isNewInjected);
            newStaffs.forEach(ns => {
                Object.keys(scheduleData.data).forEach(day => {
                    if (!scheduleData.data[day].some(a => a.staffId === ns.id)) {
                        scheduleData.data[day].push({
                            staffId: ns.id, name: ns.name, gender: ns.gender || 'Nữ',
                            shift: 'OFF', role: '', originalShift: 'OFF', originalRole: '', rawRole: ''
                        });
                    }
                });
            });
        }

        // Dọn dẹp cờ trước khi xuất
        let finalStats = workingList.map(w => {
            let clone = {...w}; delete clone.isNewInjected; return clone;
        });

        dispatch('save', finalStats);
    }
</script>

<div class="fixed inset-0 z-[200] bg-slate-900/70 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-popIn" on:click|stopPropagation>
        
        <div class="p-4 border-b flex justify-between items-center bg-indigo-50 rounded-t-2xl shrink-0">
            <div>
                <h3 class="text-lg font-black text-indigo-900 flex items-center gap-2">
                    <span class="material-icons-round text-indigo-600">format_list_numbered</span> Sắp Xếp Nhân Sự
                </h3>
                <p class="text-[11px] text-slate-500 mt-0.5 font-bold italic">Sửa lại vị trí hiển thị lịch từng bạn cho khớp với BCNB.</p>
            </div>
            <button on:click={() => dispatch('close')} class="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors">
                <span class="material-icons-round">close</span>
            </button>
        </div>
        
        <!-- KHU VỰC BÁO ĐỘNG NGƯỜI MỚI -->
        {#if missingStaff.length > 0}
            <div class="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl shrink-0">
                <div class="text-xs font-black text-amber-800 mb-2 flex items-center gap-1">
                    <span class="material-icons-round text-[16px]">notification_important</span> Phát hiện {missingStaff.length} nhân sự mới:
                </div>
                <div class="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                    {#each missingStaff as ms}
                        <div class="flex items-center justify-between bg-white p-2 border border-amber-200 rounded-lg shadow-sm">
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                    <span class="material-icons-round text-slate-400 text-sm">person</span>
                                </div>
                                <div>
                                    <div class="font-bold text-sm text-slate-800">{ms.name}</div>
                                    <div class="text-[10px] font-bold text-slate-500">{ms.gender || 'Nữ'}</div>
                                </div>
                            </div>
                            <button class="px-3 py-1.5 bg-amber-500 text-white text-[11px] font-bold rounded-lg hover:bg-amber-600 shadow-sm transition-colors active:scale-95" on:click={() => injectNewStaff(ms)}>
                                Thêm Vào Lịch
                            </button>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <div class="flex-1 overflow-y-auto p-4 bg-slate-50">
            <div class="space-y-2">
                {#each workingList as staff, index (staff.id)}
                    <div class="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm transition-all {draggedIndex === index ? 'opacity-50 scale-95 border-indigo-400' : ''} {hoveredIndex === index && draggedIndex !== index ? 'border-t-4 border-t-indigo-500 pb-2 mt-4' : 'border-slate-200'} {staff.isNewInjected ? 'border-amber-400 bg-amber-50/50' : ''}" draggable="true" on:dragstart={(e) => dragStart(e, index)} on:dragenter={() => dragEnter(index)} on:dragover={dragOver} on:drop={(e) => drop(e, index)} on:dragend={() => { draggedIndex = null; hoveredIndex = null; }}>
                        <div class="flex items-center gap-3">
                            <span class="material-icons-round text-slate-300 cursor-grab active:cursor-grabbing hover:text-indigo-500">drag_indicator</span>
                            <div>
                                <div class="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    {staff.name}
                                    {#if staff.isNewInjected}<span class="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-black uppercase">Mới thêm</span>{/if}
                                </div>
                                <div class="text-[10px] font-bold text-slate-400">{staff.gender || 'Nữ'}</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button class="w-7 h-7 flex items-center justify-center rounded-md bg-white shadow-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30" disabled={index === 0} on:click={() => moveUp(index)}><span class="material-icons-round text-[16px]">arrow_upward</span></button>
                            <button class="w-7 h-7 flex items-center justify-center rounded-md bg-white shadow-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30" disabled={index === workingList.length - 1} on:click={() => moveDown(index)}><span class="material-icons-round text-[16px]">arrow_downward</span></button>
                        </div>
                    </div>
                {/each}
                {#if workingList.length === 0}
                    <div class="text-center p-8 text-slate-400 text-sm font-bold border-2 border-dashed border-slate-200 rounded-xl">Chưa có nhân sự trong danh sách</div>
                {/if}
            </div>
        </div>

        <div class="p-4 border-t bg-white shrink-0">
            <button class="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2" on:click={handleSave}>
                <span class="material-icons-round">save</span> LƯU LẠI & ÁP DỤNG
            </button>
        </div>
    </div>
</div>