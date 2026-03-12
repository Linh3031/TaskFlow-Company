<script>
    import { currentUser } from '../lib/stores';
    import { db } from '../lib/firebase';
    import { collection, getDocs } from 'firebase/firestore'; 
    
    import ChatHeader from './ChatbotParts/ChatHeader.svelte';
    import ChatMessageArea from './ChatbotParts/ChatMessageArea.svelte';
    import AdminPanel from './ChatbotParts/AdminPanel.svelte';

    let faqData = [];
    let loadingData = false;

    let isOpen = false;
    let messages = [];
    let showAdminPanel = false;

    $: isAdmin = $currentUser?.role === 'super_admin';
    $: categories = [...new Set(faqData.map(item => item.category))].filter(Boolean);

    // Kỹ thuật "Bong Bóng Chat" mượt mà 60FPS (Dùng Transform 3D)
    function draggable(node) {
        let isDragging = false;
        let wasDragged = false;
        let startX, startY;
        let currentX = 0, currentY = 0; 
        let initialX, initialY;

        const handleMousedown = (e) => {
            isDragging = true;
            wasDragged = false;
            node.style.transition = 'none';

            startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
            startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

            initialX = currentX;
            initialY = currentY;

            document.addEventListener('mousemove', handleMousemove, { passive: false });
            document.addEventListener('mouseup', handleMouseup);
            document.addEventListener('touchmove', handleMousemove, { passive: false });
            document.addEventListener('touchend', handleMouseup);
        };

        const handleMousemove = (e) => {
            if (!isDragging) return;

            const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

            const dx = clientX - startX;
            const dy = clientY - startY;

            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                wasDragged = true;
            }

            if (wasDragged) {
                e.preventDefault(); 
                currentX = initialX + dx;
                currentY = initialY + dy;
                node.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        };

        const handleMouseup = () => {
            isDragging = false;
            node.style.transition = ''; 

            document.removeEventListener('mousemove', handleMousemove);
            document.removeEventListener('mouseup', handleMouseup);
            document.removeEventListener('touchmove', handleMousemove);
            document.removeEventListener('touchend', handleMouseup);
        };

        const handleClick = (e) => {
            if (wasDragged) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        node.addEventListener('mousedown', handleMousedown);
        node.addEventListener('touchstart', handleMousedown, { passive: false });
        node.addEventListener('click', handleClick, true); 

        return {
            destroy() {
                node.removeEventListener('mousedown', handleMousedown);
                node.removeEventListener('touchstart', handleMousedown);
                node.removeEventListener('click', handleClick, true);
            }
        };
    }

    async function toggleChat() {
        isOpen = !isOpen;
        
        if (isOpen) {
            if (messages.length === 0) {
                messages = [...messages, { 
                    sender: 'bot', 
                    text: `Chào <b>${$currentUser?.name || 'bạn'}</b>! Mình là Trợ lý Ảo hỗ trợ Quy định nội bộ.<br>Bạn cứ gõ câu hỏi hoặc chọn chủ đề bên dưới nhé!` 
                }];
            }

            if (faqData.length === 0 && !loadingData) {
                loadingData = true;
                try {
                    const q = collection(db, 'faq_bot');
                    const snapshot = await getDocs(q);
                    faqData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                } catch (error) {
                    console.error("Lỗi tải data Bot:", error);
                    addMessage('bot', "Xin lỗi, hệ thống đang bận tải dữ liệu. Vui lòng thử lại sau.");
                } finally {
                    loadingData = false;
                }
            }
        }
    }

    function addMessage(sender, text) { messages = [...messages, { sender, text }]; }

    function normalizeStr(str) {
        if (!str) return '';
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
    }

    function processQuery(query) {
        if (faqData.length === 0) return addMessage('bot', "Hiện tại hệ thống chưa có dữ liệu nào. Vui lòng liên hệ Admin.");
        const normalizedQuery = normalizeStr(query);
        let foundMatch = false;

        for (let faq of faqData) {
            for (let keyword of (faq.keywords || [])) {
                if (normalizedQuery.includes(normalizeStr(keyword))) {
                    addMessage('bot', faq.answer);
                    foundMatch = true;
                    break;
                }
            }
            if (foundMatch) break;
        }

        if (!foundMatch) addMessage('bot', "Xin lỗi, hệ thống chưa có dữ liệu cho câu hỏi này. Bạn hãy thử dùng từ khóa ngắn gọn hơn (VD: <i>truy thu, trả góp, kẹp nách</i>).");
    }

    function handleCategoryClick(cat) {
        addMessage('user', `Hỏi về: ${cat}`);
        const related = faqData.filter(f => f.category === cat);
        let responseHTML = `<b>Các quy định liên quan đến ${cat}:</b><br><ul class="list-disc pl-4 mt-1 space-y-1">`;
        related.forEach(item => { responseHTML += `<li class="text-[13px]">${item.answer}</li>`; });
        responseHTML += `</ul>`;
        addMessage('bot', responseHTML);
    }
</script>

<button 
    use:draggable
    class="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 hover:scale-105 z-[100] border-2 border-white cursor-move touch-none" 
    on:click={toggleChat}
>
    <span class="material-icons-round text-3xl">{isOpen ? 'close' : 'support_agent'}</span>
</button>

{#if isOpen}
    <div 
        class="fixed inset-0 z-[80] bg-slate-900/30 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none transition-all" 
        on:click={() => isOpen = false}
    ></div>

    <div class="fixed bottom-24 right-4 sm:right-6 w-[90vw] max-w-[380px] h-[75vh] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-[90] overflow-hidden border border-slate-200 animate-slideUp">
        
        <ChatHeader 
            {loadingData} 
            faqCount={categories.length} 
            {isAdmin} 
            {showAdminPanel} 
            on:toggleAdmin={() => showAdminPanel = !showAdminPanel} 
            on:closeChat={() => isOpen = false} 
        />

        {#if showAdminPanel && isAdmin}
            <AdminPanel {faqData} />
        {:else}
            <ChatMessageArea 
                {messages} 
                {categories} 
                {loadingData} 
                faqDataLength={faqData.length}
                on:send={(e) => { addMessage('user', e.detail); processQuery(e.detail); }}
                on:categoryClick={(e) => handleCategoryClick(e.detail)}
            />
        {/if}
    </div>
{/if}

<style>
    .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
</style>