<script>
  // Version 9.3 - Fix Case Sensitivity in Note
  import { createEventDispatcher, onMount } from 'svelte';
  import { db } from '../lib/firebase';
  import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
  import { currentUser } from '../lib/stores';
  export let taskTitle = '';
  export let note = ''; 

  const dispatch = createEventDispatcher();

  let storeUsers = [];
  let showSuggestions = false;
  let suggestionList = [];
  let cursorPosition = 0;
  
  onMount(async () => {
      const currentStoreId = $currentUser.storeIds?.[0] || '';
      if (currentStoreId) {
          try {
              const q = query(collection(db, 'users'), where('storeIds', 'array-contains', currentStoreId));
              const snap = await getDocs(q);
              storeUsers = snap.docs.map(d => ({ username: d.data().username, name: d.data().name }));
          } catch (e) { console.error(e); }
      }
  });

  function handleInput(e) {
      const val = e.target.value;
      cursorPosition = e.target.selectionStart;
      const textBeforeCursor = val.slice(0, cursorPosition);
      const lastWord = textBeforeCursor.split(/\s+/).pop();

      if (lastWord.startsWith('@')) {
          const queryText = lastWord.slice(1).toLowerCase();
          suggestionList = storeUsers.filter(u => u.name.toLowerCase().includes(queryText) || u.username.toLowerCase().includes(queryText));
          showSuggestions = true;
      } else { showSuggestions = false; }
  }

  function selectUser(user) {
      const textBeforeCursor = note.slice(0, cursorPosition);
      const textAfterCursor = note.slice(cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      note = textBeforeCursor.slice(0, lastAtIndex) + `@${user.username} ` + textAfterCursor;
      showSuggestions = false;
      document.getElementById('note-input').focus();
  }

  async function detectAndNotify(content) {
      if (!content) return;
      
      const regex = /@([\w.-]+)/g;
      const matches = content.match(regex);
      
      if (matches) {
          const rawTags = matches.map(m => m.substring(1));
          const realTargets = [];

          // Tìm user thật để lấy đúng Username gốc
          rawTags.forEach(tag => {
              const foundUser = storeUsers.find(u => u.username.toLowerCase() === tag.toLowerCase());
              if (foundUser) {
                  realTargets.push(foundUser.username);
              }
          });

          const uniqueUsers = [...new Set(realTargets)];

          const batchPromises = uniqueUsers.map(targetUser => {
              return addDoc(collection(db, 'notifications'), {
                  toUser: targetUser, 
                  fromUser: $currentUser.name || $currentUser.username,
                  content: `đã nhắc đến bạn trong ghi chú: "${taskTitle}"`,
                  isRead: false, type: 'mention', createdAt: serverTimestamp()
              });
          });
          
          await Promise.all(batchPromises);
      }
  }

  async function handleConfirm() {
      await detectAndNotify(note);
      dispatch('confirm');
  }
</script>

<div class="modal-overlay" role="dialog" aria-modal="true">
  <div class="modal-box text-center">
    <div class="modal-icon mb-2">
      <span class="material-icons-round text-4xl text-green-500">check_circle</span>
    </div>
    <h3 class="text-lg font-bold mb-1">Xác nhận hoàn thành</h3>
    <p class="text-gray-500 mb-4 text-sm">{taskTitle}</p>
    
    <div class="note-area mb-4 relative">
      <label for="note-input" class="sr-only">Ghi chú công việc</label>
      <textarea 
        id="note-input"
        bind:value={note} 
        on:input={handleInput}
        rows="3" 
        placeholder="Ghi chú... (Gõ @ để chọn người)"
        class="w-full p-2 border rounded-lg resize-none text-sm focus:border-indigo-500 outline-none"
      ></textarea>
      
      {#if showSuggestions && suggestionList.length > 0}
        <div class="absolute bottom-full left-0 w-full mb-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-32 overflow-y-auto text-left">
            {#each suggestionList as user}
                <button class="w-full text-left p-2 hover:bg-indigo-50 flex items-center gap-2 border-b border-gray-50 last:border-0" on:click={() => selectUser(user)}>
                    <div class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-bold shrink-0">{user.name.charAt(0)}</div>
                    <div class="truncate">
                        <span class="text-xs font-bold text-gray-800">{user.name}</span>
                        <span class="text-[9px] text-gray-400 ml-1">@{user.username}</span>
                    </div>
                </button>
            {/each}
        </div>
      {/if}

      <p class="text-[10px] text-left text-gray-400 mt-1 pl-1">Mẹo: Tag tên quản lý để họ nhận thông báo ngay.</p>
    </div>
    
    <div class="flex gap-2">
      <button class="flex-1 py-2 rounded-lg bg-gray-100 font-bold text-gray-600" on:click={() => dispatch('cancel')}>Hủy</button>
      <button class="flex-1 py-2 rounded-lg bg-purple-600 text-white font-bold shadow-md" on:click={handleConfirm}>Hoàn Tất</button>
    </div>
  </div>
</div>

<style>
  .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
  .modal-box { background: white; width: 85%; max-width: 350px; padding: 20px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: popIn 0.2s ease; }
  @keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
</style>