<script>
  import { onMount, createEventDispatcher } from 'svelte';
  
  // Props nhận vào: Danh sách các bước hướng dẫn
  // Mỗi bước gồm: { target: 'selector css', title: '...', content: '...' }
  export let steps = []; 
  
  const dispatch = createEventDispatcher();
  let currentStepIndex = 0;
  let styleString = '';
  let tooltipStyle = '';
  let targetElement = null;

  // Tính toán vị trí highlight và tooltip
  function calculatePosition() {
    if (!steps || steps.length === 0) return;

    if (currentStepIndex >= steps.length) {
        completeTour();
        return;
    }

    const step = steps[currentStepIndex];
    const el = document.querySelector(step.target);

    if (el) {
        targetElement = el;
        const rect = el.getBoundingClientRect();
        
        // Tạo hiệu ứng "đục lỗ" (Spotlight) bằng box-shadow
        styleString = `
            top: ${rect.top}px;
            left: ${rect.left}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
        `;

        // Tính vị trí Tooltip: Ưu tiên hiện bên dưới, nếu hết chỗ thì hiện bên trên
        const isBottom = rect.bottom + 200 < window.innerHeight;
        tooltipStyle = isBottom 
            ? `top: ${rect.bottom + 15}px; left: ${rect.left}px;`
            : `bottom: ${window.innerHeight - rect.top + 15}px; left: ${rect.left}px;`;
            
        // Cuộn tới element nếu nó bị khuất
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        // Nếu không tìm thấy element (ví dụ đang ở tab khác), tự động bỏ qua bước này
        nextStep();
    }
  }

  function nextStep() {
    currentStepIndex++;
    calculatePosition();
  }

  function prevStep() {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        calculatePosition();
    }
  }

  function completeTour() {
    dispatch('complete');
  }

  function skipTour() {
    dispatch('complete');
  }

  onMount(() => {
    // Đợi 0.5s để giao diện render xong hoàn toàn mới tính toán
    setTimeout(calculatePosition, 500);
    
    // Lắng nghe sự kiện resize để tính lại vị trí nếu người dùng xoay màn hình
    window.addEventListener('resize', calculatePosition);
    return () => window.removeEventListener('resize', calculatePosition);
  });
</script>

<div class="fixed inset-0 z-[9999] overflow-hidden">
    <div 
        class="absolute box-content rounded-lg transition-all duration-300 ease-out border-2 border-yellow-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] pointer-events-none"
        style={styleString}
    ></div>

    <div 
        class="absolute z-[10000] w-72 bg-white p-5 rounded-xl shadow-2xl transition-all duration-300 animate-popIn border border-gray-100"
        style={tooltipStyle}
    >
        <div class="flex justify-between items-start mb-3">
            <h4 class="font-bold text-gray-800 text-lg">
                {steps[currentStepIndex]?.title}
            </h4>
            <span class="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">
                {currentStepIndex + 1}/{steps.length}
            </span>
        </div>
        
        <p class="text-sm text-gray-600 mb-5 leading-relaxed">
            {steps[currentStepIndex]?.content}
        </p>

        <div class="flex justify-between items-center pt-2 border-t border-gray-100">
            <button class="text-xs text-gray-400 font-bold hover:text-gray-600 px-2 py-1" on:click={skipTour}>
                Bỏ qua
            </button>
            <div class="flex gap-2">
                {#if currentStepIndex > 0}
                    <button class="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-colors" on:click={prevStep}>
                        Lùi
                    </button>
                {/if}
                <button class="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors" on:click={nextStep}>
                    {currentStepIndex === steps.length - 1 ? 'Hoàn thành' : 'Tiếp theo'}
                </button>
            </div>
        </div>
        
        <div class="absolute w-4 h-4 bg-white transform rotate-45 -top-2 left-6 border-t border-l border-gray-100"></div>
    </div>
</div>

<style>
    @keyframes popIn { 
        from { opacity: 0; transform: scale(0.95) translateY(10px); } 
        to { opacity: 1; transform: scale(1) translateY(0); } 
    }
    .animate-popIn { animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
</style>