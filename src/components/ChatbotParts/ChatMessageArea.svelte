<script>
    import { createEventDispatcher, tick } from 'svelte';
    
    export let messages = [];
    export let categories = [];
    export let loadingData = false;
    export let faqDataLength = 0;

    let inputText = '';
    let chatContainer;
    const dispatch = createEventDispatcher();

    // Tự động cuộn xuống đáy mỗi khi mảng messages có sự thay đổi
    $: if (messages) { scrollToBottom(); }

    async function scrollToBottom() {
        await tick();
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function handleSend() {
        if (!inputText.trim()) return;
        dispatch('send', inputText.trim());
        inputText = '';
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }
</script>

<div class="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4" bind:this={chatContainer}>
    {#each messages as msg}
        <div class="flex {msg.sender === 'user' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-sm 
                {msg.sender === 'user' ? 'bg-indigo-500 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}">
                {@html msg.text}
            </div>
        </div>
    {/each}
    
    {#if messages.length > 0 && messages[messages.length-1].sender === 'bot' && faqDataLength > 0}
        <div class="flex overflow-x-auto gap-2 mt-2 pb-1 hide-scrollbar">
            {#each categories as cat}
                <button class="shrink-0 bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-sm hover:bg-indigo-50 transition-colors whitespace-nowrap" on:click={() => dispatch('categoryClick', cat)}>
                    {cat}
                </button>
            {/each}
        </div>
    {/if}
</div>

<div class="p-3 bg-white border-t border-slate-200 flex items-end gap-2 shrink-0">
    <textarea 
        rows="1"
        placeholder="Nhập từ khóa cần hỏi..." 
        class="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none overflow-hidden max-h-[100px]"
        bind:value={inputText}
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
</style>