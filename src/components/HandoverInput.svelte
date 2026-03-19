<script>
  // Version 41.0 - Optimized Handover (Use Cache)
  import { onMount } from 'svelte';
  import { db } from '../lib/firebase';
  import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
  import { currentUser, storeUsersCache } from '../lib/stores'; // Import Cache
  import { getTodayStr } from '../lib/utils';

  let taskTitle = '', deadline = '';
  // [CodeGenesis] Tự động lấy kho hiện tại, loại bỏ giao diện chọn kho rườm rà
  $: selectedTargetStore = $currentUser?.storeIds?.[0] || ''; 
  $: myStores = $currentUser?.storeIds || [];

  let storeUsers = [];
  let showSuggestions = false;
  let suggestionList = [];
  let cursorPosition = 0;

  // Logic tải User thông minh
  $: if (selectedTargetStore) loadStoreUsersSmart(selectedTargetStore);

  async function loadStoreUsersSmart(storeId) {
      if ($storeUsersCache[storeId]) {
          storeUsers = $storeUsersCache[storeId];
          return;
      }
      try {
          console.warn(`🚨🚨🚨 ĐANG GỌI FIREBASE [HandoverInput.svelte]: getDocs('users') - Tải user kho ${storeId}`);
          const q = query(collection(db, 'users'), where('storeIds', 'array-contains', storeId));
          const snap = await getDocs(q);
          const users = snap.docs.map(d => ({ username: d.data().username, name: d.data().name }));
          
          storeUsers = users;
          storeUsersCache.update(c => ({ ...c, [storeId]: users }));
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

<div class="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100 mb-4 animate-popIn relative">
  <div class="flex gap-2 items-end relative">
      
      <div class="flex-1 border border-gray-200 rounded-xl bg-gray-50 focus-within:bg-white focus-within:border-purple-300 focus-within:ring-2 focus-within:ring-purple-100 transition-all overflow-hidden flex flex-col">
          
          <input 
            id="handover-input"
            type="text" 
            bind:value={taskTitle} 
            on:input={handleInput}
            placeholder="Nhập việc bàn giao... (Gõ @ để nhắc)" 
            class="w-full px-3 py-2.5 bg-transparent text-sm outline-none placeholder:text-gray-400" 
            on:keydown={(e) => e.key === 'Enter' && !showSuggestions && addTask()}
          >
          
          <div class="px-2 pb-2 flex items-center justify-between">
              <div class="relative inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2 py-1 shadow-sm hover:bg-gray-100 transition-colors cursor-pointer">
                  <span class="material-icons-round text-[16px] {deadline ? 'text-purple-600' : 'text-gray-400'}">alarm</span>
                  <span class="text-[10px] font-bold {deadline ? 'text-purple-700' : 'text-gray-500'}">
                      {deadline ? deadline.replace('T', ' ') : 'Hạn chót'}
                  </span>
                  <input type="datetime-local" bind:value={deadline} class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Chọn thời gian hoàn thành">
              </div>

              {#if deadline}
              <button class="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:text-red-500 hover:bg-red-100 transition-colors" on:click={() => deadline = ''} title="Xóa hạn chót">
                  <span class="material-icons-round text-[14px]">close</span>
              </button>
              {/if}
          </div>
      </div>

      <button class="shrink-0 w-[50px] h-[50px] bg-purple-600 text-white rounded-xl flex items-center justify-center shadow-md hover:bg-purple-700 active:scale-95 transition-all mb-[1px]" on:click={addTask} aria-label="Gửi công việc">
          <span class="material-icons-round text-[22px]">send</span>
      </button>

      {#if showSuggestions && suggestionList.length > 0}
        <div class="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animate-popIn">
             <div class="p-2 bg-gray-50 text-[10px] font-bold text-gray-500 border-b">CHỌN NGƯỜI NHẮC TÊN</div>
            {#each suggestionList as user}
                <button class="w-full text-left p-2 hover:bg-indigo-50 flex items-center gap-2 transition-colors border-b border-gray-50 last:border-0" on:click={() => selectUser(user)}>
                    <div class="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[11px] font-bold">
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

<style>
  .animate-popIn { animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); } 
  @keyframes popIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>