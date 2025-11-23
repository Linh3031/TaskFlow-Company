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
        timestamp: serverTimestamp()
      });

      // Reset form
      taskTitle = '';
      deadline = '';
    } catch (err) {
      alert('Lỗi khi thêm việc: ' + err.message);
    }
  }
</script>

<div class="input-card">
  <label for="deadline-input" class="sr-only">Hạn chót</label>
  <input 
    id="deadline-input"
    type="datetime-local" 
    bind:value={deadline} 
    title="Hạn chót hoàn thành"
  >
  
  <label for="task-input" class="sr-only">Nội dung công việc</label>
  <input 
    id="task-input"
    type="text" 
    bind:value={taskTitle} 
    placeholder="Nhập việc cần bàn giao..." 
    autocomplete="off"
    on:keydown={(e) => e.key === 'Enter' && addTask()}
  >
  
  <button 
    class="btn-circle" 
    on:click={addTask}
    aria-label="Gửi công việc"
  >
    <span class="material-icons-round">send</span>
  </button>
</div>

<style>
  .input-card { flex-shrink: 0; background: #fff; padding: 8px; border-radius: 12px; display: flex; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 15px; align-items: center; flex-wrap: wrap; }
  input { border: 1px solid #eee; padding: 10px; outline: none; font-size: 0.9rem; border-radius: 8px; background: #fcfcfc; }
  input[type="datetime-local"] { width: 135px; font-size: 0.85rem; color: #555; }
  input[type="text"] { flex: 1; min-width: 150px; }
  .btn-circle { width: 40px; height: 40px; border-radius: 8px; background: #673ab7; color: white; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
</style>