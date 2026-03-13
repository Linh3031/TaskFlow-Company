<script>
    import { createEventDispatcher, tick } from 'svelte';
    import Fuse from 'fuse.js';
    
    export let messages = [];
    export let categories = [];
    export let faqData = [];
    export let loadingData = false;
    export let isBotTyping = false;

    let inputText = '';
    let chatContainer;
    let showSuggestions = false;
    let suggestions = [];

    const dispatch = createEventDispatcher();

    $: if (messages || isBotTyping) { scrollToBottom(); }

    $: fuse = new Fuse(faqData, {
        keys: ['category', 'keywords', 'master_category'],
        threshold: 0.4,
        ignoreLocation: true
    });

    function handleInput() {
        if (inputText.trim().length >= 2) {
            suggestions = fuse.search(inputText.trim()).slice(0, 3).map(r => r.item);
            showSuggestions = suggestions.length > 0;
        } else {
            suggestions = [];
            showSuggestions = false;
        }
    }

    async function scrollToBottom() {
        await tick();
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function handleSend() {
        if (!inputText.trim()) return;
        const query = inputText.trim();
        inputText = '';
        showSuggestions = false;
        dispatch('send', { query });
    }

    function selectSuggestion(item) {
        dispatch('send', { query: item.category, exactItem: item });
        inputText = '';
        showSuggestions = false;
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }
</script>

<div class="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4 relative" bind:this={chatContainer}>
    {#each messages as msg}
        <div class="flex flex-col {msg.sender === 'user' ? 'items-end' : 'items-start'}">
            <div class="max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-sm 
                {msg.sender === 'user' ? 'bg-indigo-500 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}">
                {@html msg.text}
            </div>

            {#if msg.subCategories}
                <div class="flex flex-wrap gap-1.5 mt-2 ml-1">
                    {#each msg.subCategories as subCat}
                        <button class="shrink-0 bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-sm hover:bg-indigo-50 transition-colors whitespace-nowrap" 
                            on:click={() => dispatch('subCategoryClick', subCat)}>
                            {subCat}
                        </button>
                    {/each}
                </div>
            {/if}

            {#if msg.allowFeedback}
                <div class="flex flex-wrap gap-2 mt-1.5 ml-1 animate-fadeIn items-center">
                    <button class="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors px-2 py-1 rounded flex items-center gap-1 text-[10px] font-bold shadow-sm border border-indigo-100" 
                        on:click={() => dispatch('resetChat')} title="Xem danh sách chủ đề">
                        <span class="material-icons-round text-[12px]">menu_open</span> Chủ đề khác
                    </button>
                    
                    {#if !msg.feedbackType}
                        <div class="flex gap-2">
                            <button class="text-slate-400 hover:text-green-500 transition-colors flex items-center gap-0.5 text-[10px] font-bold" 
                                on:click={() => dispatch('feedback', { msgId: msg.id, type: 'up', query: msg.queryForFeedback })}>
                                <span class="material-icons-round text-[14px]">thumb_up</span>
                            </button>
                            <button class="text-slate-400 hover:text-red-500 transition-colors flex items-center gap-0.5 text-[10px] font-bold" 
                                on:click={() => dispatch('feedback', { msgId: msg.id, type: 'down', query: msg.queryForFeedback })}>
                                <span class="material-icons-round text-[14px]">thumb_down</span>
                            </button>
                        </div>
                    {:else}
                        <span class="text-[10px] text-slate-400 italic flex items-center">
                            {msg.feedbackType === 'up' ? '✅ Đã thích' : '⚠️ Đã báo lỗi'}
                        </span>
                    {/if}
                </div>
            {/if}
        </div>
    {/each}
    
    {#if isBotTyping}
        <div class="flex justify-start">
            <div class="max-w-[85%] px-4 py-3 bg-white border border-slate-200 rounded-2xl rounded-bl-sm flex items-center gap-1 shadow-sm">
                <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
                <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
            </div>
        </div>
    {/if}

    {#if messages.length > 0 && messages[messages.length-1].isWelcome && categories.length > 0}
        <div class="flex overflow-x-auto gap-2 mt-2 pb-1 hide-scrollbar">
            {#each categories as cat}
                <button class="shrink-0 bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-sm hover:bg-indigo-50 transition-colors whitespace-nowrap" 
                    on:click={() => dispatch('categoryClick', cat)}>
                    {cat}
                </button>
            {/each}
        </div>
    {/if}
</div>

<div class="relative p-3 bg-white border-t border-slate-200 flex items-end gap-2 shrink-0 z-30">
    {#if showSuggestions}
        <div class="absolute bottom-[100%] left-0 w-full p-2 z-20">
            <div class="bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden animate-slideUp">
                <div class="bg-indigo-50 text-[10px] font-bold text-indigo-600 px-3 py-1.5 border-b border-indigo-100 uppercase tracking-wider flex items-center gap-1">
                    <span class="material-icons-round text-[14px]">bolt</span> Gợi ý nhanh
                </div>
                <div class="max-h-[150px] overflow-y-auto">
                    {#each suggestions as item}
                        <button class="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b border-slate-100 last:border-0 transition-colors"
                            on:click={() => selectSuggestion(item)}>
                            <div class="font-bold text-indigo-700 text-[11px]">{item.category}</div>
                            <div class="text-slate-400 line-clamp-1 mt-0.5 text-[10px]">{item.answer.replace(/<[^>]*>?/gm, '')}</div>
                        </button>
                    {/each}
                </div>
            </div>
        </div>
    {/if}

    <button class="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center shrink-0 shadow-inner hover:bg-slate-200 hover:text-indigo-600 transition-colors"
        on:click={() => dispatch('resetChat')} title="Quay lại danh mục chính">
        <span class="material-icons-round text-[20px]">home</span>
    </button>

    <textarea 
        rows="1"
        placeholder={loadingData ? "Đang tải dữ liệu..." : "Gõ tìm kiếm (VD: lãi suất)..."}
        class="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none overflow-hidden max-h-[100px]"
        bind:value={inputText}
        on:input={handleInput}
        on:keydown={handleKeyDown}
        disabled={loadingData}
    ></textarea>
    <button 
        class="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        on:click={handleSend}
        disabled={!inputText.trim() || loadingData}
    >
        <span class="material-icons-round text-[20px] ml-1">send</span>
    </button>
</div>

<style>
    .overflow-y-auto::-webkit-scrollbar { width: 5px; }
    .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
    .overflow-y-auto::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    
    .animate-slideUp { animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    
    .animate-fadeIn { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>