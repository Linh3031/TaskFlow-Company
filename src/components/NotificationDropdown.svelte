<script>
  import { db } from '../lib/firebase';
  import { doc, updateDoc } from 'firebase/firestore';
  import { createEventDispatcher } from 'svelte';
  import { formatDateTime } from '../lib/utils'; // Sử dụng hàm có sẵn

  export let notifications = [];
  const dispatch = createEventDispatcher();

  async function handleRead(notif) {
      if (!notif.isRead) {
          try {
              // Đánh dấu đã đọc trên Firebase
              await updateDoc(doc(db, 'notifications', notif.id), { isRead: true });
          } catch (e) { console.error(e); }
      }
      // Có thể thêm logic cuộn tới công việc (nếu cần)
      dispatch('close');
  }
</script>

<div class="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-popIn origin-top-right">
    <div class="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
        <h4 class="font-bold text-slate-700 text-sm">Thông báo</h4>
        {#if notifications.length > 0}
            <span class="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
                {notifications.filter(n => !n.isRead).length} mới
            </span>
        {/if}
    </div>
    
    <div class="max-h-80 overflow-y-auto">
        {#each notifications as notif}
            <button class="w-full text-left p-3 border-b border-slate-50 hover:bg-indigo-50 transition-colors flex gap-3 relative {notif.isRead ? 'opacity-60' : 'bg-white'}" on:click={() => handleRead(notif)}>
                <div class="w-8 h-8 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {notif.fromUser?.charAt(0).toUpperCase() || 'S'}
                </div>
                
                <div class="flex-1">
                    <p class="text-xs text-slate-800 leading-snug">
                        <span class="font-bold">{notif.fromUser}</span> 
                        {notif.content}
                    </p>
                    <span class="text-[10px] text-slate-400 mt-1 block">
                        {formatDateTime(notif.createdAt?.toDate())}
                    </span>
                </div>

                {#if !notif.isRead}
                    <div class="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full"></div>
                {/if}
            </button>
        {/each}

        {#if notifications.length === 0}
            <div class="p-8 text-center text-slate-400 text-xs">
                <span class="material-icons-round text-3xl mb-2 opacity-30">notifications_off</span>
                <p>Chưa có thông báo nào</p>
            </div>
        {/if}
    </div>
</div>

<style>
    .animate-popIn { animation: popIn 0.2s ease-out; }
    @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>