<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { db } from '../../lib/firebase';
  import { collection, getDocs } from 'firebase/firestore';
  import { formatDateTime } from '../../lib/utils';
  
  export let show = false;
  export let task = null;
  export let storeUsers = [];

  const dispatch = createEventDispatcher();
  let activeTab = 'DONE'; 
  let submissions = [];
  let loading = false;

  $: targetUsers = storeUsers.filter(u => {
    if (!task) return false;
    if (task.targetRole === 'PG') return u.role === 'pg';
    if (task.targetRole === 'STAFF') return u.role !== 'pg';
    return true;
  });

  $: submittedUids = submissions.map(s => s.id);
  $: missingUsers = targetUsers.filter(u => !submittedUids.includes(String(u.username).toLowerCase()));

  async function loadSubmissions() {
    if (!task) return;
    loading = true;
    try {
      const snap = await getDocs(collection(db, 'group_tasks', task.id, 'submissions'));
      submissions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error("Lỗi tải danh sách nộp:", e); } 
    finally { loading = false; }
  }

  $: if (show && task) { loadSubmissions(); }
</script>

{#if show && task}
  <div class="fixed inset-0 z-[80] bg-slate-900/70 flex items-center justify-center p-4 backdrop-blur-sm" on:mousedown={() => dispatch('close')}>
    <div class="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[80vh] animate-popIn" on:mousedown|stopPropagation>
      <div class="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center shrink-0">
        <div>
          <h3 class="font-bold text-base text-indigo-900">{task.title}</h3>
          <p class="text-[11px] text-indigo-600 font-semibold">Tiến độ: {submissions.length}/{task.totalStaff} nhân viên</p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class="p-1.5 bg-white hover:bg-indigo-100 text-indigo-600 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1 text-xs font-bold shadow-sm" on:click={loadSubmissions} title="Làm mới dữ liệu">
            <span class="material-icons-round text-sm {loading ? 'animate-spin' : ''}">refresh</span>
          </button>
          <button type="button" class="w-8 h-8 rounded-full bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center shadow-sm transition-colors" on:click={() => dispatch('close')}>
            <span class="material-icons-round text-sm">close</span>
          </button>
        </div>
      </div>

      <div class="flex border-b border-slate-200 bg-slate-50 shrink-0">
        <button type="button" class="flex-1 py-3 font-bold text-xs border-b-2 transition-colors flex items-center justify-center gap-1 {activeTab === 'DONE' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}" on:click={() => activeTab = 'DONE'}>
          <span class="material-icons-round text-sm text-green-600">check_circle</span>
          <span>Đã Điểm Danh ({submissions.length})</span>
        </button>
        <button type="button" class="flex-1 py-3 font-bold text-xs border-b-2 transition-colors flex items-center justify-center gap-1 {activeTab === 'MISSING' ? 'border-red-600 text-red-600 bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}" on:click={() => activeTab = 'MISSING'}>
          <span class="material-icons-round text-sm text-red-500">warning</span>
          <span>Chưa Hoàn Tất ({missingUsers.length})</span>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 bg-slate-50/50 relative">
        {#if loading}
          <div class="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <span class="material-icons-round animate-spin text-indigo-600 text-3xl">sync</span>
          </div>
        {/if}

        {#if activeTab === 'DONE'}
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {#each submissions as sub, index}
              <div class="bg-white p-2 border border-slate-200 rounded-xl shadow-sm flex flex-col gap-1.5">
                <div class="w-full h-28 rounded-lg overflow-hidden bg-slate-100 relative group border border-slate-100">
                  {#if sub.imageUrl}
                    <img src={sub.imageUrl} alt="Proof" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer" on:click={() => dispatch('openLightbox', { images: submissions.map(s => s.imageUrl).filter(Boolean), index })} on:error={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/200x200/e2e8f0/64748b?text=Loi+Anh'; }}>
                    <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                      <span class="material-icons-round text-white text-xl">zoom_in</span>
                    </div>
                  {:else}
                    <!-- Hiển thị Icon nếu công việc không yêu cầu ảnh -->
                    <div class="flex flex-col items-center justify-center h-full text-slate-300 bg-slate-50">
                      <span class="material-icons-round text-3xl text-green-400">task_alt</span>
                      <span class="text-[9px] font-bold mt-1 uppercase tracking-wider text-slate-400">Không dùng ảnh</span>
                    </div>
                  {/if}
                </div>
                <div class="truncate">
                  <p class="font-bold text-xs text-slate-800 truncate">{sub.name || sub.id}</p>
                  <p class="text-[9px] font-mono text-slate-400">{formatDateTime(sub.submittedAt)}</p>
                </div>
              </div>
            {/each}
            {#if submissions.length === 0}
              <div class="col-span-full text-center py-10 text-slate-400 font-bold text-xs">Chưa có nhân viên nào điểm danh.</div>
            {/if}
          </div>
        {:else}
          <div class="space-y-2">
            {#each missingUsers as u}
              <div class="p-2.5 bg-red-50/50 border border-red-100 rounded-xl flex justify-between items-center">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-full bg-red-100 text-red-600 font-bold text-xs flex items-center justify-center">{String(u.name || u.username).charAt(0)}</div>
                  <div>
                    <p class="font-bold text-xs text-slate-800">{u.name || u.username}</p>
                    <p class="text-[10px] text-slate-400 uppercase">@{u.username} • {u.role}</p>
                  </div>
                </div>
                <span class="text-[10px] font-bold text-red-600 bg-white px-2 py-0.5 rounded border border-red-200 shadow-sm">Chưa điểm danh</span>
              </div>
            {/each}
            {#if missingUsers.length === 0}
              <div class="text-center py-10 text-green-600 font-bold text-xs bg-green-50 rounded-xl border border-green-200">
                🎉 Tất cả nhân viên thuộc nhóm này đều đã hoàn tất điểm danh!
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .animate-popIn { animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>