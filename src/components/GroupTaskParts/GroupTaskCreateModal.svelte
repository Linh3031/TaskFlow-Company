<script>
  import { createEventDispatcher } from 'svelte';
  export let show = false;
  export let storeUsers = [];
  export let editTaskData = null; 

  const dispatch = createEventDispatcher();
  let title = '';
  let deadline = '';
  let targetRole = 'ALL'; 
  let requireImage = true; 
  let isSubmitting = false;

  $: if (show) {
    if (editTaskData) {
      title = editTaskData.title || '';
      deadline = editTaskData.deadline || '';
      targetRole = editTaskData.targetRole || 'ALL';
      requireImage = editTaskData.requireImage !== false;
    } else {
      title = ''; deadline = ''; targetRole = 'ALL'; requireImage = true;
    }
  }

  $: estimatedCount = targetRole === 'ALL' 
    ? storeUsers.length 
    : storeUsers.filter(u => targetRole === 'PG' ? u.role === 'pg' : u.role !== 'pg').length;

  function handleSubmit() {
    if (!title.trim()) return alert("Vui lòng nhập nội dung công việc!");
    if (estimatedCount === 0) return alert("Không có nhân viên nào thuộc nhóm đối tượng này!");

    isSubmitting = true;
    const payload = {
      title: title.trim(),
      deadline: deadline || null,
      targetRole,
      totalStaff: estimatedCount,
      requireImage
    };

    if (editTaskData) {
      dispatch('update', { id: editTaskData.id, ...payload });
    } else {
      dispatch('create', payload);
    }
    isSubmitting = false;
  }
</script>

{#if show}
  <div class="fixed inset-0 z-[80] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:mousedown={() => dispatch('close')}>
    <div class="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col gap-4 animate-popIn" on:mousedown|stopPropagation>
      <div class="flex justify-between items-center border-b border-slate-100 pb-3">
        <h3 class="font-bold text-lg text-slate-800 flex items-center gap-1.5">
          <span class="material-icons-round text-indigo-600">{editTaskData ? 'edit' : 'add_task'}</span> 
          {editTaskData ? 'Cập Nhật Công Việc' : 'Tạo Việc Tập Thể'}
        </h3>
        <button type="button" class="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center" on:click={() => dispatch('close')}>
          <span class="material-icons-round text-sm">close</span>
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nội dung công việc</label>
          <input type="text" bind:value={title} placeholder="VD: Chụp ảnh kệ quầy sạch sẽ trước khi về..." class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-colors">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Bộ phận áp dụng</label>
            <select bind:value={targetRole} class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer">
              <option value="ALL">Toàn Bộ Kho</option>
              <option value="STAFF">Nhân Viên Kho</option>
              <option value="PG">Nhóm PG</option>
            </select>
          </div>

          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Hạn chót (Tùy chọn)</label>
            <input type="datetime-local" bind:value={deadline} class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500">
          </div>
        </div>
        
        <label class="flex items-center gap-2 mt-1 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-100">
          <input type="checkbox" bind:checked={requireImage} class="w-4 h-4 accent-indigo-600 rounded cursor-pointer">
          <span class="text-xs font-bold text-slate-700 select-none">Bắt buộc điểm danh bằng Hình Ảnh minh chứng</span>
        </label>

        <div class="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex justify-between items-center text-xs">
          <span class="text-slate-600 font-semibold">Số nhân sự cần điểm danh:</span>
          <span class="font-black text-indigo-700 bg-white px-2.5 py-0.5 rounded-lg border border-indigo-200 shadow-sm">{estimatedCount} người</span>
        </div>
      </div>

      <div class="flex gap-2 pt-2 border-t border-slate-100">
        <button type="button" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-colors" on:click={() => dispatch('close')}>Hủy</button>
        <button type="button" class="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1" disabled={isSubmitting} on:click={handleSubmit}>
          {isSubmitting ? 'Đang lưu...' : (editTaskData ? 'Lưu Thay Đổi' : 'Xác Nhận Tạo')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .animate-popIn { animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>