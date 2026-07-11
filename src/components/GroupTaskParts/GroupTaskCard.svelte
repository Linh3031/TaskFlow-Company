<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { db } from '../../lib/firebase';
  import { doc, getDoc } from 'firebase/firestore';
  import { compressImage, uploadTaskImage } from '../../lib/imageUtils';
  import { formatDateTime } from '../../lib/utils';
  
  export let task;
  export let currentUser;
  export let isAdmin = false;

  const dispatch = createEventDispatcher();
  let fileInput;
  let isUploading = false;
  let mySubmission = null; // Trạng thái chứa data điểm danh của cá nhân

  $: currentUid = currentUser?.username ? String(currentUser.username).toLowerCase() : '';
  $: hasSubmitted = (task.submittedUids || []).includes(currentUid);
  $: progressPercent = task.totalStaff > 0 ? Math.min(100, Math.round(((task.submittedCount || 0) / task.totalStaff) * 100)) : 0;
  
  $: progressColor = progressPercent === 100 ? 'bg-green-500' : progressPercent >= 50 ? 'bg-blue-500' : 'bg-orange-500';
  $: requireImage = task.requireImage !== false; 
  $: isClosed = task.status === 'completed';

  // [CodeGenesis] Lấy chi tiết lịch sử nộp của chính mình để hiện giờ/ảnh
  $: if (hasSubmitted && !mySubmission) {
    fetchMySubmission();
  }

  async function fetchMySubmission() {
    try {
      const snap = await getDoc(doc(db, 'group_tasks', task.id, 'submissions', currentUid));
      if (snap.exists()) {
        mySubmission = snap.data();
      }
    } catch (e) { console.error("Lỗi tải chi tiết điểm danh:", e); }
  }

  function formatSubmitTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    isUploading = true;
    try {
      const blob = await compressImage(file);
      const url = await uploadTaskImage(blob, task.storeId || 'GROUP', `${task.id}_${currentUid}_${Date.now()}`);
      
      // Update UI lập tức để trải nghiệm mượt mà, không cần đợi Firebase fetch lại
      if (mySubmission) {
        mySubmission.imageUrl = url;
        mySubmission.submittedAt = new Date().toISOString();
      } else {
        mySubmission = { imageUrl: url, submittedAt: new Date().toISOString() };
      }

      dispatch('submitProof', { taskId: task.id, imageUrl: url, username: currentUser.username || 'Unknown', name: currentUser.name || currentUser.username });
    } catch (err) {
      alert("Lỗi tải ảnh lên: " + err.message);
    } finally {
      isUploading = false;
      e.target.value = null;
    }
  }

  function handleQuickComplete() {
    mySubmission = { imageUrl: null, submittedAt: new Date().toISOString() };
    dispatch('submitProof', { taskId: task.id, imageUrl: null, username: currentUser.username || 'Unknown', name: currentUser.name || currentUser.username });
  }
</script>

<div class="w-full bg-white border border-slate-200 rounded-xl p-4 shadow-sm transition-all duration-300 flex flex-col gap-3 {hasSubmitted || isClosed ? 'bg-slate-50/80 opacity-75 border-slate-200 order-last' : 'hover:border-indigo-300 order-first'}">
  <div class="flex justify-between items-start gap-2">
    <div class="flex-1 overflow-hidden">
      <div class="flex items-center gap-1.5 flex-wrap mb-1">
        <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider {task.targetRole === 'PG' ? 'bg-pink-100 text-pink-700 border border-pink-200' : task.targetRole === 'STAFF' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'}">
          {task.targetRole === 'PG' ? 'Nhóm PG' : task.targetRole === 'STAFF' ? 'Nhân viên' : 'Toàn bộ kho'}
        </span>
        {#if task.deadline}
          <span class="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-0.5">
            <span class="material-icons-round text-[12px] text-red-500">alarm</span> {formatDateTime(task.deadline)}
          </span>
        {/if}
      </div>
      <h4 class="font-bold text-sm text-slate-800 break-words {hasSubmitted || isClosed ? 'line-through text-slate-500' : ''}">{task.title}</h4>
      <p class="text-[11px] text-slate-400 mt-0.5">Tạo bởi: {task.createdBy || 'Admin'}</p>
    </div>

    <div class="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
      {#if isAdmin}
        {#if !isClosed}
          <button type="button" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-[11px] rounded-lg border border-blue-200 transition-colors flex items-center gap-1" title="Sửa" on:click={() => dispatch('editTask', task)}>
            <span class="material-icons-round text-sm">edit</span>
          </button>
          <button type="button" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] rounded-lg border border-red-200 transition-colors flex items-center gap-1" title="Xóa" on:click={() => dispatch('deleteTask', task.id)}>
            <span class="material-icons-round text-sm">delete</span>
          </button>
        {/if}
        <button type="button" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 transition-colors flex items-center gap-1" on:click={() => dispatch('openStats', task)}>
          <span class="material-icons-round text-sm text-indigo-600">bar_chart</span> Thống Kê
        </button>
        
        <!-- [CodeGenesis] Nút Hoàn Tác và Chốt Sớm -->
        {#if isClosed}
          <button type="button" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 font-bold text-[11px] rounded-lg border border-amber-200 transition-colors flex items-center gap-1" title="Mở lại công việc" on:click={() => dispatch('undoClose', task.id)}>
            <span class="material-icons-round text-sm">settings_backup_restore</span> Mở lại
          </button>
        {:else}
          <button type="button" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] rounded-lg border border-red-200 transition-colors flex items-center gap-1" title="Chốt & Kết Thúc sớm" on:click={() => dispatch('forceClose', task.id)}>
            <span class="material-icons-round text-sm">check_circle_outline</span> Chốt Sớm
          </button>
        {/if}
      {/if}
    </div>
  </div>

  <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/60 p-0.5">
    <div class="h-full rounded-full transition-all duration-500 {progressColor}" style="width: {progressPercent}%"></div>
  </div>

  <div class="flex justify-between items-center text-xs font-bold pt-1 border-t border-slate-100">
    <span class="text-slate-500">
      Tiến độ: <strong class="text-slate-800">{task.submittedCount || 0}/{task.totalStaff}</strong> người ({progressPercent}%)
    </span>

    <div>
      {#if hasSubmitted}
        <div class="flex items-center gap-2">
          <!-- [CodeGenesis] Giao diện nộp hoàn chỉnh với Thumbnail và Thời gian -->
          <div class="flex items-center gap-1.5 bg-green-50 px-2 py-1 rounded-lg border border-green-200 shadow-sm">
            {#if mySubmission?.imageUrl}
              <img src={mySubmission.imageUrl} alt="Proof" class="w-7 h-7 rounded object-cover cursor-pointer hover:scale-110 transition-transform shadow-[0_0_2px_rgba(0,0,0,0.2)]" on:click={() => dispatch('openLightbox', { images: [mySubmission.imageUrl], index: 0 })} title="Bấm để xem ảnh phóng to" />
            {/if}
            <div class="flex flex-col">
              <span class="text-[10px] text-green-700 font-black leading-tight flex items-center gap-0.5"><span class="material-icons-round text-[12px]">check_circle</span> Đã điểm danh</span>
              {#if mySubmission?.submittedAt}
                <span class="text-[9px] text-green-600 font-medium leading-tight">vào {formatSubmitTime(mySubmission.submittedAt)}</span>
              {/if}
            </div>
          </div>

          {#if !isClosed && requireImage}
            <input type="file" hidden accept="image/*" bind:this={fileInput} on:change={handleFileSelect}>
            <button type="button" class="text-[11px] px-2 py-1 bg-white border border-indigo-200 rounded-lg font-bold text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50 flex items-center gap-1" disabled={isUploading} on:click={() => fileInput.click()}>
              {#if isUploading}
                <span class="material-icons-round text-[12px] animate-spin">sync</span> Đang tải
              {:else}
                <span class="material-icons-round text-[12px]">flip_camera_ios</span> Sửa ảnh
              {/if}
            </button>
          {/if}
        </div>
      {:else}
        {#if isClosed}
          <span class="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg text-[11px] border border-slate-200 font-bold">
            <span class="material-icons-round text-sm">lock</span> Đã chốt kết thúc
          </span>
        {:else}
          {#if requireImage}
            <input type="file" hidden accept="image/*" bind:this={fileInput} on:change={handleFileSelect}>
            <button type="button" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1 transition-all" disabled={isUploading} on:click={() => fileInput.click()}>
              {#if isUploading}
                <span class="material-icons-round text-sm animate-spin">sync</span> Đang tải...
              {:else}
                <span class="material-icons-round text-sm">add_a_photo</span> Gửi hình ảnh
              {/if}
            </button>
          {:else}
            <button type="button" class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1 transition-all" on:click={handleQuickComplete}>
              <span class="material-icons-round text-sm">check_circle</span> Điểm danh ngay
            </button>
          {/if}
        {/if}
      {/if}
    </div>
  </div>
</div>