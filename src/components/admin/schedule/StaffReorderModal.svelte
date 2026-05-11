<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    
    export let staffList = [];
    
    // Tạo một bản sao để thao tác cục bộ
    let workingList = JSON.parse(JSON.stringify(staffList));
    
    let draggedIndex = null;
    let hoveredIndex = null;

    // --- LOGIC KÉO THẢ (MƯỢT MÀ BẰNG HTML5 THUẦN) ---
    function dragStart(event, index) {
        draggedIndex = index;
        event.dataTransfer.effectAllowed = 'move';
        // Xóa hình ảnh bóng mờ mặc định của trình duyệt để nhìn UI sạch hơn
        let dragIcon = document.createElement('div');
        event.dataTransfer.setDragImage(dragIcon, 0, 0);
    }

    function dragEnter(index) {
        hoveredIndex = index;
    }

    function dragOver(event) {
        event.preventDefault(); // Cần thiết để cho phép drop
        event.dataTransfer.dropEffect = 'move';
    }

    function drop(event, index) {
        event.preventDefault();
        if (draggedIndex !== null && draggedIndex !== index) {
            const item = workingList[draggedIndex];
            workingList.splice(draggedIndex, 1);
            workingList.splice(index, 0, item);
            workingList = [...workingList]; // Kích hoạt Svelte reactivity
        }
        draggedIndex = null;
        hoveredIndex = null;
    }

    // --- LOGIC NÚT BẤM (FAIL-SAFE CHO MOBILE/TRACKPAD) ---
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
        dispatch('save', workingList);
    }
</script>

<div class="fixed inset-0 z-[200] bg-slate-900/70 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-popIn" on:click|stopPropagation>
        
        <div class="p-4 border-b flex justify-between items-center bg-indigo-50 rounded-t-2xl shrink-0">
            <div>
                <h3 class="text-lg font-black text-indigo-900 flex items-center gap-2">
                    <span class="material-icons-round text-indigo-600">format_list_numbered</span> Sắp Xếp Nhân Sự
                </h3>
                <p class="text-[11px] text-slate-500 mt-0.5">Kéo thả để di chuyển, hoặc dùng nút mũi tên.</p>
            </div>
            <button on:click={() => dispatch('close')} class="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors">
                <span class="material-icons-round">close</span>
            </button>
        </div>
        
        <div class="flex-1 overflow-y-auto p-4 bg-slate-50">
            <div class="space-y-2">
                {#each workingList as staff, index (staff.id)}
                    <div 
                        class="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm transition-all {draggedIndex === index ? 'opacity-50 scale-95 border-indigo-400' : ''} {hoveredIndex === index && draggedIndex !== index ? 'border-t-4 border-t-indigo-500 pb-2 mt-4' : 'border-slate-200'}"
                        draggable="true"
                        on:dragstart={(e) => dragStart(e, index)}
                        on:dragenter={() => dragEnter(index)}
                        on:dragover={dragOver}
                        on:drop={(e) => drop(e, index)}
                        on:dragend={() => { draggedIndex = null; hoveredIndex = null; }}
                    >
                        <div class="flex items-center gap-3">
                            <span class="material-icons-round text-slate-300 cursor-grab active:cursor-grabbing hover:text-indigo-500">drag_indicator</span>
                            <div>
                                <div class="font-bold text-slate-800 text-sm">{staff.name}</div>
                                <div class="text-[10px] font-bold text-slate-400">{staff.gender || 'Nữ'}</div>
                            </div>
                        </div>

                        <div class="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button 
                                class="w-7 h-7 flex items-center justify-center rounded-md bg-white shadow-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 transition-colors" 
                                disabled={index === 0} 
                                on:click={() => moveUp(index)}
                                title="Lên 1 bậc"
                            >
                                <span class="material-icons-round text-[16px]">arrow_upward</span>
                            </button>
                            <button 
                                class="w-7 h-7 flex items-center justify-center rounded-md bg-white shadow-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 transition-colors" 
                                disabled={index === workingList.length - 1} 
                                on:click={() => moveDown(index)}
                                title="Xuống 1 bậc"
                            >
                                <span class="material-icons-round text-[16px]">arrow_downward</span>
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        </div>

        <div class="p-4 border-t bg-white shrink-0">
            <button class="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2" on:click={handleSave}>
                <span class="material-icons-round">save</span> LƯU THỨ TỰ MỚI
            </button>
        </div>
    </div>
</div>

<style>
    .animate-popIn { animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes popIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
</style>