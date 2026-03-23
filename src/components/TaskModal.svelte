<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { db } from '../lib/firebase';
  import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
  import { currentUser, storeUsersCache, activeStoreId } from '../lib/stores'; 
  import { compressImage, uploadTaskImage } from '../lib/imageUtils'; // [CodeGenesis]
  
  export let taskTitle = '';
  export let note = ''; 
  export let taskId = ''; // [CodeGenesis]

  const dispatch = createEventDispatcher();
  let storeUsers = [];
  let showSuggestions = false;
  let suggestionList = [];
  let cursorPosition = 0;
  
  // State xử lý Ảnh
  let imageLinks = [];
  let isUploading = false;
  let fileInput;

  onMount(async () => {
      const currentStoreId = $currentUser.storeIds?.[0] || '';
      if (currentStoreId) {
          if ($storeUsersCache[currentStoreId]) { storeUsers = $storeUsersCache[currentStoreId]; return; }
          try {
              const q = query(collection(db, 'users'), where('storeIds', 'array-contains', currentStoreId));
              const snap = await getDocs(q);
              const users = snap.docs.map(d => ({ username: d.data().username, name: d.data().name }));
              storeUsers = users;
              storeUsersCache.update(c => ({ ...c, [currentStoreId]: users }));
          } catch (e) { console.error(e); }
      }
  });

  function handleInput(e) { /* ... Logic tag tên nguyên bản giữ nguyên ... */
      const val = e.target.value; cursorPosition = e.target.selectionStart;
      const textBeforeCursor = val.slice(0, cursorPosition); const lastWord = textBeforeCursor.split(/\s+/).pop();
      if (lastWord.startsWith('@')) {
          const queryText = lastWord.slice(1).toLowerCase();
          suggestionList = storeUsers.filter(u => u.name.toLowerCase().includes(queryText) || u.username.toLowerCase().includes(queryText));
          showSuggestions = true;
      } else { showSuggestions = false; }
  }

  function selectUser(user) { /* ... Logic tag tên nguyên bản giữ nguyên ... */
      const textBeforeCursor = note.slice(0, cursorPosition); const textAfterCursor = note.slice(cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      note = textBeforeCursor.slice(0, lastAtIndex) + `@${user.username} ` + textAfterCursor;
      showSuggestions = false; document.getElementById('note-input').focus();
  }

  // [CodeGenesis] Nén và Up ảnh trực tiếp khi chọn
  async function handleFileSelect(e) {
      const file = e.target.files[0];
      if (!file) return;
      isUploading = true;
      try {
          const blob = await compressImage(file);
          const url = await uploadTaskImage(blob, $activeStoreId, taskId);
          imageLinks = [...imageLinks, url];
      } catch (err) { alert("Lỗi up ảnh: " + err.message); } 
      finally { isUploading = false; e.target.value = null; }
  }

  function submitComplete() {
      dispatch('confirm', { status: 'completed', imageLinks });
  }

  function submitFailed() {
      if (!note.trim()) return alert("BẮT BUỘC: Vui lòng ghi chú lý do không thể hoàn tất vào ô trống!");
      dispatch('confirm', { status: 'failed', imageLinks });
  }
</script>

<div class="modal-overlay" role="dialog" aria-modal="true" on:click|self={() => dispatch('cancel')}>
  <div class="modal-box text-center">
    <div class="modal-icon mb-2">
      <span class="material-icons-round text-4xl text-indigo-500">assignment_turned_in</span>
    </div>
    <h3 class="text-lg font-bold mb-1">Xác nhận công việc</h3>
    <p class="text-gray-500 mb-4 text-sm font-semibold">{taskTitle}</p>
    
    <div class="mb-4">
        {#if imageLinks.length > 0}
            <div class="flex gap-2 mb-2 overflow-x-auto pb-1 justify-center">
                {#each imageLinks as img}
                    <img src={img} alt="Đính kèm" class="w-12 h-12 object-cover rounded-md border shadow-sm">
                {/each}
            </div>
        {/if}
        <input type="file" hidden accept="image/*" bind:this={fileInput} on:change={handleFileSelect}>
        <button class="w-full py-2 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-lg text-sm font-bold flex items-center justify-center gap-1 hover:bg-indigo-50 transition-colors" on:click={() => fileInput.click()} disabled={isUploading}>
            {#if isUploading} <span class="material-icons-round text-sm animate-spin">sync</span> Đang nén & tải lên...
            {:else} <span class="material-icons-round text-sm">add_a_photo</span> Đính kèm hình ảnh (Nếu cần) {/if}
        </button>
    </div>

    <div class="note-area mb-4 relative">
      <textarea id="note-input" bind:value={note} on:input={handleInput} rows="3" placeholder="Ghi chú... (BẮT BUỘC nếu Không Thể Hoàn Tất)" class="w-full p-2 border rounded-lg resize-none text-sm focus:border-indigo-500 outline-none bg-gray-50"></textarea>
      
      {#if showSuggestions && suggestionList.length > 0}
        <div class="absolute bottom-full left-0 w-full mb-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-32 overflow-y-auto text-left">
            {#each suggestionList as user}
                <button class="w-full text-left p-2 hover:bg-indigo-50 flex items-center gap-2 border-b border-gray-50 last:border-0" on:click={() => selectUser(user)}>
                    <div class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-bold shrink-0">{user.name.charAt(0)}</div>
                    <div class="truncate"><span class="text-xs font-bold text-gray-800">{user.name}</span></div>
                </button>
            {/each}
        </div>
      {/if}
    </div>
    
    <div class="flex flex-col gap-2">
      <div class="flex gap-2">
        <button class="flex-1 py-2.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-200 font-bold hover:bg-orange-100 transition-colors text-sm flex items-center justify-center gap-1" disabled={isUploading} on:click={submitFailed}>
            <span class="material-icons-round text-sm">warning</span> Không Thể Hoàn Tất
        </button>
        <button class="flex-1 py-2.5 rounded-lg bg-green-600 text-white font-bold shadow-md hover:bg-green-700 transition-colors text-sm flex items-center justify-center gap-1" disabled={isUploading} on:click={submitComplete}>
            <span class="material-icons-round text-sm">check_circle</span> Hoàn Tất
        </button>
      </div>
      <button class="w-full py-1.5 text-xs font-bold text-gray-400 hover:text-gray-600" on:click={() => dispatch('cancel')}>Hủy bỏ / Quay lại</button>
    </div>
  </div>
</div>

<style>
  .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
  .modal-box { background: white; width: 85%; max-width: 350px; padding: 20px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: popIn 0.2s ease; }
  @keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>