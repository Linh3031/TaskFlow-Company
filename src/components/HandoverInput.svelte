<script>
  // Version 44.2 - [CodeGenesis] Xóa bỏ hoàn toàn tiền tố "Bàn giao: " thừa thãi trong tiêu đề
  import { onMount } from 'svelte';
  import { db } from '../lib/firebase';
  import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
  import { currentUser, storeUsersCache, activeStoreId } from '../lib/stores';
  import { getCurrentTimeShort } from '../lib/utils';
  import { compressImage, uploadTaskImage } from '../lib/imageUtils.js'; 
  
  let note = '';
  let deadline = ''; 
  $: selectedTargetStore = $currentUser?.storeIds?.[0] || ''; 
  
  let storeUsers = [];
  let showSuggestions = false;
  let suggestionList = [];
  let cursorPosition = 0;
  let isCreating = false;

  let imageLinks = [];
  let isUploading = false;
  let fileInput;

  // [SURGICAL FIX] State mở Modal
  let showModal = false;

  $: if (selectedTargetStore) loadStoreUsersSmart(selectedTargetStore);

  async function loadStoreUsersSmart(storeId) {
      if ($storeUsersCache[storeId]) {
          storeUsers = $storeUsersCache[storeId]; return;
      }
      try {
          const q = query(collection(db, 'users'), where('storeIds', 'array-contains', storeId));
          const snap = await getDocs(q);
          const users = snap.docs.map(d => ({ username: d.data().username, name: d.data().name }));
          storeUsers = users;
          storeUsersCache.update(c => ({ ...c, [storeId]: users }));
      } catch (e) { console.error(e); }
  }

  onMount(() => {
      deadline = ""; 
  });

  function handleInput(e) {
      const val = e.target.value; cursorPosition = e.target.selectionStart;
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
      document.getElementById('handover-input').focus();
  }

  async function handleFileSelected(event) {
      const file = event.target.files[0];
      if (!file) return;
      if (imageLinks.length >= 4) {
          alert('⚠️ Chỉ được phép tải lên tối đa 4 hình ảnh!');
          fileInput.value = null; return;
      }
      isUploading = true;
      try {
          const taskId = `temp_handover_${Date.now()}`;
          const blob = await compressImage(file);
          const downloadURL = await uploadTaskImage(blob, $activeStoreId, taskId);
          imageLinks = [...imageLinks, downloadURL];
      } catch (e) { alert("Lỗi up ảnh: " + e.message); } 
      finally { isUploading = false; if (fileInput) fileInput.value = null; }
  }

  function removeImage(url) { imageLinks = imageLinks.filter(img => img !== url); }

  async function addTask() {
      if (isCreating || isUploading || !note.trim()) return;
      
      // [CodeGenesis] Phẫu thuật: Gọt sạch hoàn toàn các tiền tố thừa thãi, lấy đúng nội dung người dùng gõ
      const finalTitle = note.trim();
      const user = $currentUser.name || $currentUser.username;
      
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      
      const taskDate = deadline ? deadline.split('T')[0] : todayStr;
      
      isCreating = true;
      try {
          await addDoc(collection(db, 'tasks'), {
              title: finalTitle, 
              storeId: $activeStoreId, 
              date: taskDate, 
              timeSlot: 'Khác', 
              type: 'handover', 
              deadline: deadline || "", 
              isImportant: true, 
              completed: false, 
              createdBy: user, 
              timestamp: serverTimestamp(),
              imageLinks: imageLinks,
              history: [{ action: 'create', user: user, time: getCurrentTimeShort(), fullTime: new Date().toISOString() }]
          });
          note = ''; deadline = ""; imageLinks = []; 
          showModal = false;
      } catch (e) { alert("Lỗi tạo bàn giao: " + e.message); } 
      finally { isCreating = false; }
  }
</script>

<button class="bg-purple-600 text-white font-bold py-2 px-4 rounded-xl shadow-md shadow-purple-200 hover:bg-purple-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-sm shrink-0" on:click={() => showModal = true}>
    <span class="material-icons-round text-[18px]">add</span> TẠO BÀN GIAO
</button>

{#if showModal}
<div class="fixed inset-0 z-[100] bg-slate-900/60 flex flex-col justify-end sm:justify-center items-center sm:p-4 backdrop-blur-sm" on:click|self={() => showModal = false}>
    <div class="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slideUp overflow-hidden flex flex-col max-h-[90vh]">
        
        <div class="p-4 border-b border-purple-100 flex justify-between items-center bg-purple-50 shrink-0">
            <h3 class="font-black text-purple-800 flex items-center gap-2"><span class="material-icons-round">assignment_add</span> TẠO BÀN GIAO MỚI</h3>
            <button class="w-8 h-8 flex items-center justify-center rounded-full bg-purple-200/50 text-purple-600 hover:bg-purple-200 transition-colors" on:click={() => showModal = false}>
                <span class="material-icons-round text-[18px]">close</span>
            </button>
        </div>

        <div class="p-4 overflow-y-auto flex flex-col gap-4">
            <div class="w-full relative">
                <label class="text-[10px] font-bold text-purple-700 block ml-1 mb-1">NỘI DUNG</label>
                <textarea id="handover-input" bind:value={note} on:input={handleInput} rows="3" placeholder="Nội dung bàn giao... (Dùng @ để tag tên)" class="w-full p-3 border border-purple-200 rounded-xl resize-none text-sm focus:border-purple-500 outline-none bg-gray-50 focus:bg-white transition-colors shadow-sm"></textarea>
                
                {#if showSuggestions && suggestionList.length > 0}
                  <div class="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animate-popIn">
                       <div class="p-2 bg-gray-50 text-[10px] font-bold text-gray-500 border-b">CHỌN NGƯỜI NHẮC TÊN</div>
                       {#each suggestionList as user}
                          <button class="w-full text-left p-2 hover:bg-purple-50 flex items-center gap-2 border-b border-gray-50 last:border-0" on:click={() => selectUser(user)}>
                              <div class="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[11px] font-bold shrink-0">{user.name.charAt(0)}</div>
                              <div class="truncate">
                                  <span class="text-xs font-bold text-gray-800">{user.name}</span>
                                  <span class="text-[10px] text-gray-400 block -mt-0.5">@{user.username}</span>
                              </div>
                          </button>
                      {/each}
                  </div>
                {/if}
            </div>

            <div class="w-full grid grid-cols-2 gap-3">
                <div>
                    <label class="text-[10px] font-bold text-purple-700 block ml-1 mb-1" for="deadline-input">HẠN CHÓT (TÙY CHỌN)</label>
                    <input id="deadline-input" type="datetime-local" bind:value={deadline} class="w-full p-2 border border-purple-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-purple-500 outline-none text-gray-700 shadow-sm transition-colors">
                </div>
                
                <div class="flex items-end">
                    <input type="file" hidden accept="image/*" bind:this={fileInput} on:change={handleFileSelected}>
                    <button type="button" class="w-full h-[38px] border border-purple-300 bg-white text-purple-700 rounded-xl text-sm font-bold flex items-center justify-center gap-1 hover:bg-purple-50 shadow-sm transition-colors" disabled={isUploading || imageLinks.length >= 4} on:click={() => fileInput.click()}>
                        {#if isUploading}
                            <span class="material-icons-round text-sm animate-spin">sync</span> Đang nén...
                        {:else}
                            <span class="material-icons-round text-sm">add_a_photo</span> + Hình Ảnh
                        {/if}
                    </button>
                </div>
            </div>

            {#if imageLinks.length > 0}
                <div class="w-full bg-white p-2 rounded-xl border border-purple-100 shadow-sm relative animate-popIn">
                    <label class="text-[10px] font-bold text-purple-700 block mb-1">ĐÃ ĐÍNH KÈM ({imageLinks.length}/4)</label>
                    <div class="flex gap-2 overflow-x-auto pb-1">
                        {#each imageLinks as img}
                            <div class="relative inline-block shrink-0">
                                <img src={img} class="w-12 h-12 object-cover rounded shadow-sm border border-gray-200" alt="Đính kèm">
                                <button class="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center shadow-md hover:bg-red-600 transition-colors" on:click={() => removeImage(img)}>
                                    <span class="material-icons-round text-[12px]">close</span>
                                </button>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>

        <div class="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
            <button class="w-full py-3 rounded-xl bg-purple-600 text-white font-bold shadow-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2" on:click={addTask} disabled={isCreating || isUploading || !note.trim()}>
                {#if isCreating}
                    <span class="material-icons-round text-[18px] animate-spin">sync</span> Đang gửi...
                {:else}
                    <span class="material-icons-round text-[18px]">send</span> GỬI BÀN GIAO
                {/if}
            </button>
        </div>
    </div>
</div>
{/if}

<style>
  .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
  @keyframes slideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
  .animate-popIn { animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  @keyframes popIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>