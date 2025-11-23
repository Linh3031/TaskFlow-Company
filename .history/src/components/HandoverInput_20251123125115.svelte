<script>
  import { db } from '../lib/firebase';
  import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
  import { currentUser } from '../lib/stores';
  import { getTodayStr } from '../lib/utils';

  let taskTitle = '', deadline = '';
  // Mặc định chọn kho đầu tiên
  let selectedTargetStore = $currentUser?.storeIds?.[0] || ''; 
  $: myStores = $currentUser?.storeIds || [];

  async function addTask() {
    if (!taskTitle.trim()) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        type: 'handover', title: taskTitle, completed: false, createdBy: $currentUser?.name,
        deadline: deadline, date: getTodayStr(),
        storeId: selectedTargetStore, // Gán kho được chọn
        timestamp: serverTimestamp()
      });
      taskTitle = ''; deadline = '';
    } catch (err) { alert(err.message); }
  }
</script>

<div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-2 mb-4 items-center animate-popIn">
  {#if myStores.length > 1}
    <select bind:value={selectedTargetStore} class="p-2 border rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 outline-none cursor-pointer">
        {#each myStores as s}<option value={s}>{s}</option>{/each}
    </select>
  {/if}

  <div class="relative">
      <span class="absolute left-2 top-1/2 -translate-y-1/2 material-icons-round text-gray-400 text-sm">alarm</span>
      <input type="datetime-local" bind:value={deadline} class="pl-7 pr-2 py-2 border rounded-lg text-sm bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-purple-200 transition-all">
  </div>
  <input type="text" bind:value={taskTitle} placeholder="Nhập việc bàn giao..." class="flex-1 p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-200 transition-all" on:keydown={(e) => e.key === 'Enter' && addTask()}>
  <button class="w-10 h-10 bg-purple-600 text-white rounded-lg flex items-center justify-center shadow-md hover:bg-purple-700 active:scale-95 transition-all" on:click={addTask}><span class="material-icons-round">send</span></button>
</div>
<style>.animate-popIn { animation: popIn 0.3s ease-out; } @keyframes popIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }</style>