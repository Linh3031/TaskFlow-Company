<script>
    import { currentUser } from '../lib/stores';
    import { db } from '../lib/firebase';
    import { collection, getDocs, addDoc } from 'firebase/firestore'; 
    import Fuse from 'fuse.js';
    
    import ChatHeader from './ChatbotParts/ChatHeader.svelte';
    import ChatMessageArea from './ChatbotParts/ChatMessageArea.svelte';
    import AdminPanel from './ChatbotParts/AdminPanel.svelte';

    let faqData = [];
    let loadingData = false;

    let isOpen = false;
    let messages = [];
    let showAdminPanel = false;
    let isBotTyping = false; // Trạng thái UX 

    $: isAdmin = $currentUser?.role === 'super_admin';
    // Khởi tạo Decision Tree từ Master Category
    $: categories = [...new Set(faqData.map(item => item.master_category || item.category))].filter(Boolean);

    // Kỹ thuật "Bong Bóng Chat" mượt mà 60FPS
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
                    id: Date.now().toString(),
                    sender: 'bot', 
                    text: `Chào <b>${$currentUser?.name || 'bạn'}</b>! Mình là Trợ lý Quy định.<br>Bạn gõ từ khóa tìm kiếm hoặc chọn nhóm chủ đề bên dưới nhé!`,
                    isWelcome: true
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

    // Hàm tiện ích thêm tin nhắn có tạo độ trễ (UX Typing indicator)
    async function addMessage(sender, text, extraInfo = {}) { 
        if (sender === 'bot') {
            isBotTyping = true;
            // Tạo độ trễ 500ms để giống người thật đang gõ
            await new Promise(r => setTimeout(r, 500));
            isBotTyping = false;
        }
        messages = [...messages, { id: Date.now().toString(), sender, text, ...extraInfo }];
    }

    // UX 2: Hàm Bôi Đậm Từ Khóa (Keyword Highlighting)
    function highlightText(text, keyword) {
        if (!keyword) return text;
        const terms = keyword.split(/\s+/).filter(k => k.length > 1);
        let highlighted = text;
        terms.forEach(term => {
            // Regex bỏ qua các chữ nằm trong thẻ HTML (VD: <b>, <br>)
            const regex = new RegExp(`(${term})(?![^<]*>)`, 'gi');
            highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200 text-slate-900 rounded-sm px-0.5 font-bold shadow-sm">$1</mark>');
        });
        return highlighted;
    }

    // Xử lý khi user Enter hoặc Chọn Gợi ý
    async function processQuery(query, exactItem = null) {
        if (faqData.length === 0) return addMessage('bot', "Hệ thống chưa có dữ liệu.");

        let bestMatch = exactItem;

        // Nếu user Enter mà không chọn gợi ý, chạy Fuse.js
        if (!bestMatch) {
            const fuse = new Fuse(faqData, {
                keys: ['category', 'keywords', 'master_category'],
                threshold: 0.4,
                ignoreLocation: true
            });
            const results = fuse.search(query);
            if (results.length > 0) bestMatch = results[0].item;
        }

        if (bestMatch) {
            const highlightedAnswer = highlightText(bestMatch.answer, query);
            const contextHeader = `<div class="text-[10px] font-bold text-indigo-500 mb-1 border-b border-indigo-100 pb-1">${bestMatch.master_category || 'Chung'} > ${bestMatch.category}</div>`;
            await addMessage('bot', contextHeader + highlightedAnswer, { queryForFeedback: query, allowFeedback: true });
        } else {
            await addMessage('bot', `Xin lỗi, mình không tìm thấy quy định cho <b>"${query}"</b>. Bạn thử dùng từ khóa khác ngắn gọn hơn xem sao.`, { queryForFeedback: query, allowFeedback: true });
        }
    }

    // Xử lý Click Chủ Đề Gốc
    async function handleCategoryClick(cat) {
        await addMessage('user', `Hỏi về nhóm: ${cat}`);
        const related = faqData.filter(f => (f.master_category === cat || f.category === cat));
        
        if (related.length === 1) {
            await processQuery(cat, related[0]);
        } else if (related.length > 1) {
            const subCats = [...new Set(related.map(r => r.category))];
            await addMessage('bot', `Trong nhóm <b>${cat}</b>, bạn muốn xem chi tiết về phần nào?`, { subCategories: subCats });
        }
    }

    // UX 3: Ghi nhận Feedback của User
    async function handleFeedback(e) {
        const { msgId, type, query } = e.detail;
        
        // Update trạng thái UI ngay lập tức
        messages = messages.map(m => m.id === msgId ? { ...m, feedbackType: type } : m);

        if (type === 'down') {
            await addMessage('bot', `Cảm ơn bạn! Hệ thống đã ghi nhận từ khóa thất bại <b>"${query}"</b> để Admin bổ sung thêm quy định này.`);
            try {
                // Đẩy lịch sử truy vấn thất bại lên một Collection mới để Admin theo dõi
                await addDoc(collection(db, 'bot_feedback'), {
                    query: query,
                    type: 'downvote',
                    timestamp: new Date()
                });
            } catch (error) { console.error("Lỗi lưu feedback", error); }
        }
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
                {faqData}
                {isBotTyping}
                on:send={(e) => { 
                    addMessage('user', e.detail.query); 
                    processQuery(e.detail.query, e.detail.exactItem); 
                }}
                on:categoryClick={(e) => handleCategoryClick(e.detail)}
                on:subCategoryClick={(e) => {
                    addMessage('user', e.detail);
                    const item = faqData.find(f => f.category === e.detail);
                    processQuery(e.detail, item);
                }}
                on:feedback={handleFeedback}
            />
        {/if}
    </div>
{/if}

<style>
    .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
</style>