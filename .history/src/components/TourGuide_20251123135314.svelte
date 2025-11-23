<script>
  import { onMount, createEventDispatcher } from 'svelte';
  
  export let steps = []; 
  
  const dispatch = createEventDispatcher();
  let currentStepIndex = 0;
  
  // Style cho Spotlight (Lỗ thủng)
  let styleString = '';
  
  // Style cho Hộp thoại hướng dẫn
  let tooltipStyle = '';
  
  // Biến kiểm soát mũi tên trang trí
  let arrowClass = ''; 
  let isMobile = false;

  function calculatePosition() {
    if (!steps || steps.length === 0) return;
    if (currentStepIndex >= steps.length) {
        completeTour(); return;
    }

    const step = steps[currentStepIndex];
    const el = document.querySelector(step.target);

    if (el) {
        const rect = el.getBoundingClientRect();
        isMobile = window.innerWidth < 640; // Coi dưới 640px là mobile

        // 1. VẼ SPOTLIGHT (Lỗ thủng)
        styleString = `
            top: ${rect.top}px;
            left: ${rect.left}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
        `;

        // 2. TÍNH VỊ TRÍ TOOLTIP (HỘP THOẠI)
        if (isMobile) {
            // --- LOGIC MOBILE: GHIM CỐ ĐỊNH TRÊN/DƯỚI ---
            // Kiểm tra xem đối tượng đang nằm ở nửa trên hay nửa dưới màn hình
            const isTargetInBottomHalf = rect.top > (window.innerHeight / 2);
            
            if (isTargetInBottomHalf) {
                // Nếu đối tượng ở dưới -> Tooltip hiện ở TRÊN CÙNG màn hình
                tooltipStyle = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 90%;
                    max-width: 350px;
                `;
                arrowClass = 'hidden'; // Ẩn mũi tên trên mobile cho gọn
            } else {
                // Nếu đối tượng ở trên -> Tooltip hiện ở DƯỚI CÙNG màn hình
                tooltipStyle = `
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 90%;
                    max-width: 350px;
                `;
                arrowClass = 'hidden';
            }
        } else {
            // --- LOGIC DESKTOP: BÁM THEO ĐỐI TƯỢNG ---
            const isBottom = rect.bottom + 250 < window.innerHeight;
            
            // Tính toạ độ Top
            let topPos = isBottom ? (rect.bottom + 15) : (rect.top - 15);
            let transformY = isBottom ? '' : 'translateY(-100%)';
            
            // Tính toạ độ Left (Cố gắng căn giữa đối tượng)
            let leftPos = rect.left + (rect.width / 2) - 150; // 150 là 1 nửa chiều rộng tooltip (300px)
            
            // Chặn tràn lề trái/phải
            if (leftPos < 10) leftPos = 10;
            if (leftPos + 300 > window.innerWidth) leftPos = window.innerWidth - 310;

            tooltipStyle = `
                position: absolute;
                top: ${topPos}px;
                left: ${leftPos}px;
                transform: ${transformY};
                width: 300px;
            `;
            
            // Mũi tên chỉ hướng (Chỉ hiện trên Desktop)
            arrowClass = isBottom 
                ? 'top-[-6px] left-1/2 -translate-x-1/2 border-t border-l' // Mũi tên hướng lên
                : 'bottom-[-6px] left-1/2 -translate-x-1/2 border-b border-r'; // Mũi tên hướng xuống
        }
            
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        nextStep();
    }
  }

  function nextStep() { currentStepIndex++; calculatePosition(); }
  function prevStep() { if (currentStepIndex > 0) { currentStepIndex--; calculatePosition(); } }
  function completeTour() { dispatch('complete'); }
  function skipTour() { dispatch('complete'); }

  onMount(() => {
    // Chờ render ổn định
    setTimeout(calculatePosition, 500);
    window.addEventListener('resize', calculatePosition);
    return () => window.removeEventListener('resize', calculatePosition);
  });
</script>

<div class="fixed inset-0 z-[9999] overflow-hidden pointer-events-none">
    
    <div 
        class="absolute box-content rounded-lg transition-all duration-300 ease-out border-2 border-yellow-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.75)]"
        style={styleString}
    ></div>

    <div 
        class="z-[10000] bg-white p-5 rounded-xl shadow-2xl transition-all duration-300 animate-popIn border border-gray-100 pointer-events-auto flex flex-col"
        style={tooltipStyle}
    >
        <div class="flex justify-between items-start mb-3">
            <h4 class="font-bold text-gray-800 text-lg">{steps[currentStepIndex]?.title}</h4>
            <button class="text-gray-400 hover:text-gray-600 p-1" on:click={skipTour}>
                <span class="material-icons-round text-sm">close</span>
            </button>
        </div>
        
        <p class="text-sm text-gray-600 mb-5 leading-relaxed">
            {steps[currentStepIndex]?.content}
        </p>

        <div class="flex justify-between items-center pt-3 border-t border-gray-100 mt-auto">
            <span class="text-xs font-bold text-indigo-400 bg-indigo-50 px-2 py-1 rounded">
                {currentStepIndex + 1} / {steps.length}
            </span>
            <div class="flex gap-2">
                {#if currentStepIndex > 0}
                    <button class="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-colors" on:click={prevStep}>
                        Lùi lại
                    </button>
                {/if}
                <button class="px-5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors" on:click={nextStep}>
                    {currentStepIndex === steps.length - 1 ? 'Hoàn tất' : 'Tiếp theo'}
                </button>
            </div>
        </div>
        
        {#if !isMobile}
            <div class={`absolute w-3 h-3 bg-white transform rotate-45 border-gray-100 ${arrowClass}`}></div>
        {/if}
    </div>
</div>

<style>
    @keyframes popIn { 
        from { opacity: 0; transform: scale(0.95) translateY(5px); } 
        to { opacity: 1; transform: scale(1) translateY(0); } 
    }
    .animate-popIn { animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
</style>