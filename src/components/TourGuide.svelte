<script>
  import { onMount, createEventDispatcher, onDestroy, tick } from 'svelte';
  export let steps = []; 
  
  const dispatch = createEventDispatcher();
  let currentStepIndex = 0;
  let styleString = 'opacity: 0;';
  let tooltipStyle = 'opacity: 0;'; 
  let arrowClass = '';
  let isMobile = false;
  let retryCount = 0;
  const MAX_RETRIES = 10; 

  async function runStepAction() {
      const step = steps[currentStepIndex];
      if (step && typeof step.action === 'function') {
          await step.action();
          await tick();
          await new Promise(r => setTimeout(r, 300));
      }
      calculatePosition();
  }

  async function calculatePosition() {
    if (!steps || steps.length === 0) return;
    if (currentStepIndex >= steps.length) {
        completeTour(); return;
    }

    const step = steps[currentStepIndex];
    const el = document.querySelector(step.target);
    if (!el) {
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            setTimeout(calculatePosition, 200); 
            return;
        } else {
            console.warn('TourGuide: Target not found:', step.target);
            // Fallback an toàn: Hiện giữa màn hình nếu không tìm thấy đích (tránh đơ)
            styleString = 'display: none;';
            tooltipStyle = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 300px; z-index: 100000;`;
            return;
        }
    }
    
    retryCount = 0;
    const rect = el.getBoundingClientRect();
    isMobile = window.innerWidth < 640;

    styleString = `
        position: fixed;
        top: ${rect.top}px;
        left: ${rect.left}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        transition: all 0.3s ease-out;
        opacity: 1;
        z-index: 99999; /* Đảm bảo khung sáng nằm trên cùng */
    `;
    if (isMobile) {
        const isTargetInBottomHalf = rect.top > (window.innerHeight / 2);
        tooltipStyle = `
            position: fixed;
            ${isTargetInBottomHalf ? 'top: 20px;' : 'bottom: 20px;'}
            left: 50%;
            transform: translateX(-50%);
            width: 90%; max-width: 350px;
            opacity: 1;
            z-index: 100000;
        `;
        arrowClass = 'hidden';
    } else {
        const isBottom = rect.bottom + 250 < window.innerHeight;
        let topPos = isBottom ? (rect.bottom + 15) : (rect.top - 15);
        let transformY = isBottom ? '' : 'translateY(-100%)';
        let leftPos = rect.left + (rect.width / 2) - 150;
        
        if (leftPos < 10) leftPos = 10;
        if (leftPos + 300 > window.innerWidth) leftPos = window.innerWidth - 310;
        tooltipStyle = `
            position: fixed;
            top: ${topPos}px;
            left: ${leftPos}px;
            transform: ${transformY};
            width: 300px;
            opacity: 1;
            z-index: 100000; /* Tooltip nằm trên cả khung sáng */
        `;
        
        arrowClass = isBottom 
            ? 'top-[-6px] left-1/2 -translate-x-1/2 border-t border-l' 
            : 'bottom-[-6px] left-1/2 -translate-x-1/2 border-b border-r';
    }
        
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
}

  function nextStep() { currentStepIndex++; retryCount=0; runStepAction(); }
  function prevStep() { if (currentStepIndex > 0) { currentStepIndex--; retryCount=0; runStepAction(); } }
  function completeTour() { dispatch('complete'); }
  function skipTour() { dispatch('complete'); }

  onMount(() => {
    runStepAction(); 
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition, { capture: true });
  });
  onDestroy(() => {
    window.removeEventListener('resize', calculatePosition);
    window.removeEventListener('scroll', calculatePosition, { capture: true });
  });
</script>

<div class="fixed inset-0 z-[99998] overflow-hidden pointer-events-none">
    <div class="box-content rounded-lg border-2 border-yellow-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.75)] pointer-events-none" style={styleString}></div>

    <div class="bg-white p-5 rounded-xl shadow-2xl border border-gray-100 pointer-events-auto flex flex-col" style={tooltipStyle}>
        <div class="flex justify-between items-start mb-3">
            <h4 class="font-bold text-gray-800 text-lg">{steps[currentStepIndex]?.title}</h4>
            <button class="text-gray-400 hover:text-gray-600 p-1" on:click={skipTour} aria-label="Đóng">
                <span class="material-icons-round text-sm">close</span>
            </button>
        </div>
        
        <p class="text-sm text-gray-600 mb-5 leading-relaxed">
            {@html steps[currentStepIndex]?.content} 
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
        
        {#if !isMobile && arrowClass}
            <div class={`absolute w-3 h-3 bg-white transform rotate-45 border-gray-100 ${arrowClass}`}></div>
        {/if}
    </div>
</div>