<script>
  // Version 41.0 - Optimized Handover (Use Cache)
  import { onMount } from 'svelte';
  import { db } from '../lib/firebase';
  import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
  import { currentUser, storeUsersCache } from '../lib/stores'; // Import Cache
  import { getTodayStr } from '../lib/utils';

  let taskTitle = '', deadline = '';
  let selectedTargetStore = $currentUser?.storeIds?.[0] || ''; 
  $: myStores = $currentUser?.storeIds || [];

  let storeUsers = [];
  let showSuggestions = false;
  let suggestionList = [];
  let cursorPosition = 0;

  // Logic tải User thông minh
  $: if (selectedTargetStore) loadStoreUsersSmart(selectedTargetStore);

  async function loadStoreUsersSmart(storeId) {
      // 1. Kiểm tra trong Cache trước
      if ($storeUsersCache[storeId]) {
          storeUsers = $storeUsersCache[storeId];
          // console.log("Loaded users from Cache");
          return;
      }

      // 2. Nếu chưa có thì mới tải từ DB
      try {
          const q = query(collection(db, 'users'), where('storeIds', 'array-contains', storeId));
          const snap = await getDocs(q);
          const users = snap.docs.map(d => ({ username: d.data().username, name: d.data().name }));
          
          storeUsers = users;
          
          // 3. Lưu vào Cache
          storeUsersCache.update(c => ({ ...c, [storeId]: users }));
          // console.log("Loaded users from DB & Cached");
      } catch (e) { console.error(e); }
  }

  function handleInput(e) {
      const val = e.target.value;
      cursorPosition = e.target.selectionStart;
      const textBeforeCursor = val.slice(0, cursorPosition);
      const lastWord = textBeforeCursor.split(/\s+/).pop();

      if (lastWord.startsWith('@')) {
          const queryText = lastWord.slice(1).toLowerCase();
          suggestionList = storeUsers.filter(u => 
              u.name.toLowerCase().includes(queryText) || 
              u.username.toLowerCase().includes(queryText)
          );
          showSuggestions = true;
      } else { showSuggestions = false; }
  }

  function selectUser(user) {
      const textBeforeCursor = taskTitle.slice(0, cursorPosition);
      const textAfterCursor = taskTitle.slice(cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      taskTitle = textBeforeCursor.slice(0, lastAtIndex) + `@${user.username} ` + textAfterCursor;
      showSuggestions = false;
      document.getElementById('handover-input').focus();
  }

  async function addTask() {
    if (!taskTitle.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'tasks'), {
        type: 'handover', title: taskTitle, completed: false, createdBy: $currentUser?.name,
        deadline: deadline, date: getTodayStr(),
        storeId: selectedTargetStore, 
        timestamp: serverTimestamp()
      });

      const regex = /@([\w.-]+)/g;
      const matches = taskTitle.match(regex);
      
      if (matches) {
          const rawTags = matches.map(m => m.substring(1));
          const realTargets = [];
          
          rawTags.forEach(tag => {
              const foundUser = storeUsers.find(u => u.username.toLowerCase() === tag.toLowerCase());
              if (foundUser) realTargets.push(foundUser.username);
              else realTargets.push(tag); 
          });

          const uniqueTargets = [...new Set(realTargets)];
          const batchPromises = uniqueTargets.map(targetUser => {
              return addDoc(collection(db, 'notifications'), {
                  toUser: targetUser, 
                  fromUser: $currentUser.name || $currentUser.username,
                  content: `đã nhắc đến bạn trong bàn giao: "${taskTitle}"`,
                  taskId: docRef.id, 
                  targetTab: 'handover',
                  isRead: false, type: 'mention', createdAt: serverTimestamp()
              });
          });
          await Promise.all(batchPromises);
      }

      taskTitle = ''; deadline = '';
    } catch (err) { alert(err.message); }
  }
</script>

<div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 mb-4 animate-popIn relative">
  <div class="flex gap-2 items-center">
      {#if myStores.length > 1}
        <label for="store-select" class="sr-only">Chọn kho</label>
        <select id="store-select" bind:value={selectedTargetStore} class="p-2 border rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 outline-none cursor-pointer">
            {#each myStores as s}<option value={s}>{s}</option>{/each}
        </select>
      {/if}

      <div class="relative">
          <label for="deadline-input" class="sr-only">Hạn chót</label>
          <span class="absolute left-2 top-1/2 -translate-y-1/2 material-icons-round text-gray-400 text-sm">alarm</span>
          <input id="deadline-input" type="datetime-local" bind:value={deadline} class="pl-7 pr-2 py-2 border rounded-lg text-sm bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-purple-200 transition-all">
      </div>
  </div>

  <div class="flex gap-2 relative">
      <label for="handover-input" class="sr-only">Nội dung công việc</label>
      <input 
        id="handover-input"
        type="text" 
        bind:value={taskTitle} 
        on:input={handleInput}
        placeholder="Nhập việc bàn giao... (Gõ @ để chọn người nhận)" 
        class="flex-1 p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-200 transition-all" 
        on:keydown={(e) => e.key === 'Enter' && !showSuggestions && addTask()}
      >
      <button class="w-10 h-10 bg-purple-600 text-white rounded-lg flex items-center justify-center shadow-md hover:bg-purple-700 active:scale-95 transition-all" on:click={addTask} aria-label="Gửi công việc"><span class="material-icons-round">send</span></button>
      
      {#if showSuggestions && suggestionList.length > 0}
        <div class="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
             <div class="p-2 bg-gray-50 text-[10px] font-bold text-gray-500 border-b">CHỌN NGƯỜI NHẮC TÊN</div>
            {#each suggestionList as user}
                <button class="w-full text-left p-2 hover:bg-indigo-50 flex items-center gap-2 transition-colors border-b border-gray-50 last:border-0" on:click={() => selectUser(user)}>
                    <div class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                         {user.name.charAt(0)}
                    </div>
                    <div>
                         <div class="text-xs font-bold text-gray-800">{user.name}</div>
                        <div class="text-[10px] text-gray-400">@{user.username}</div>
                    </div>
                </button>
            {/each}
        </div>
      {/if}
  </div>
</div>
<style>.animate-popIn { animation: popIn 0.3s ease-out; } @keyframes popIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }</style>