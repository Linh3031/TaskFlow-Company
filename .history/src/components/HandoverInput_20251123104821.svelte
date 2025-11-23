<script>
  import { db } from '../lib/firebase';
  import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
  import { currentUser } from '../lib/stores';
  import { getTodayStr } from '../lib/utils';

  let taskTitle = '';
  let deadline = '';

  async function addTask() {
    if (!taskTitle.trim()) return;

    try {
      await addDoc(collection(db, 'tasks'), {
        type: 'handover',
        title: taskTitle,
        completed: false,
        completedBy: null,
        time: null,
        note: '',
        createdBy: $currentUser?.name || $currentUser?.username,
        deadline: deadline,
        date: getTodayStr(),
        
        // --- SỬA LỖI QUAN TRỌNG TẠI ĐÂY ---
        storeId: $currentUser?.storeId, // Gắn mã kho để hiện ngay lập tức
        // ----------------------------------
        
        timestamp: serverTimestamp()
      });

      // Reset form
      taskTitle = '';
      deadline = '';
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  }
</script>

<div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-2 mb-4 items-center animate-popIn">
  <div class="relative">
      <span class="absolute left-2 top-1/2 -translate-y-1/2 material-icons-round text-gray-400 text-sm">alarm</span>
      <input 
        type="datetime-local" 
        bind:value={deadline} 
        class="pl-7 pr-2 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-200 transition-all"
        title="Hạn chót"
      >
  </div>
  
  <input 
    type="text" 
    bind:value={taskTitle} 
    placeholder="Nhập việc cần bàn giao..." 
    class="flex-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-200 outline-none transition-all"
    on:keydown={(e) => e.key === 'Enter' && addTask()}
  >
  
  <button 
    class="w-10 h-10 bg-purple-600 text-white rounded-lg flex items-center justify-center hover:bg-purple-700 active:scale-95 transition-all shadow-md" 
    on:click={addTask}
  >
    <span class="material-icons-round">send</span>
  </button>
</div>

<style>
    @keyframes popIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    .animate-popIn { animation: popIn 0.3s ease-out; }
</style>