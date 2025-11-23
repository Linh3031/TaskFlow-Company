<script>
  import { createEventDispatcher } from 'svelte';
  export let taskTitle = '';
  export let note = ''; // Bind dữ liệu ghi chú vào đây

  const dispatch = createEventDispatcher();
</script>

<div class="modal-overlay" role="dialog" aria-modal="true">
  <div class="modal-box text-center">
    <div class="modal-icon mb-2">
      <span class="material-icons-round text-4xl text-green-500">check_circle</span>
    </div>
    <h3 class="text-lg font-bold mb-1">Xác nhận hoàn thành</h3>
    <p class="text-gray-500 mb-4 text-sm">{taskTitle}</p>
    
    <div class="note-area mb-4">
      <label for="note-input" class="sr-only">Ghi chú công việc</label>
      <textarea 
        id="note-input"
        bind:value={note} 
        rows="3" 
        placeholder="Ghi chú (Không bắt buộc)..."
        class="w-full p-2 border rounded-lg resize-none"
      ></textarea>
    </div>
    
    <div class="flex gap-2">
      <button 
        class="flex-1 py-2 rounded-lg bg-gray-100 font-bold text-gray-600" 
        on:click={() => dispatch('cancel')}
      >
        Hủy
      </button>
      <button 
        class="flex-1 py-2 rounded-lg bg-purple-600 text-white font-bold shadow-md" 
        on:click={() => dispatch('confirm')}
      >
        Hoàn Tất
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
  .modal-box { background: white; width: 85%; max-width: 350px; padding: 20px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: popIn 0.2s ease; }
  
  .modal-icon span { font-size: 48px; color: #4caf50; }
  .bg-purple-600 { background-color: #667eea; }
  
  @keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
</style>