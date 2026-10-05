<script>
    import { createEventDispatcher, onDestroy, tick } from 'svelte';
    export let show = false;
    export let requiredShots = 4;
    export let areaName = '';

    const dispatch = createEventDispatcher();

    let videoEl;
    let stream = null;
    let shots = []; // { blob, previewUrl, capturedAt }
    let cameraError = '';
    let starting = false;

    $: if (show) startCamera(); else stopCamera();
    $: isFull = shots.length >= requiredShots;

    async function startCamera() {
        if (stream || starting) return;
        starting = true;
        cameraError = '';
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
                audio: false
            });
            if (!show) { stopCamera(); return; }
            await tick();
            if (videoEl) { videoEl.srcObject = stream; await videoEl.play().catch(() => {}); }
        } catch (e) {
            cameraError = 'Không mở được camera. Vui lòng cho phép quyền truy cập camera trong cài đặt trình duyệt.';
        } finally {
            starting = false;
        }
    }

    function stopCamera() {
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        shots.forEach(s => URL.revokeObjectURL(s.previewUrl));
        shots = [];
        cameraError = '';
    }

    function takeShot() {
        if (!videoEl || !videoEl.videoWidth || isFull) return;
        const capturedAt = new Date();
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (!blob) return;
            shots = [...shots, { blob, previewUrl: URL.createObjectURL(blob), capturedAt }];
        }, 'image/jpeg', 0.9);
    }

    function removeShot(index) {
        URL.revokeObjectURL(shots[index].previewUrl);
        shots = shots.filter((_, i) => i !== index);
    }

    function close() { dispatch('close'); }

    function confirm() {
        if (!isFull) return;
        dispatch('confirm', { shots: shots.map(s => ({ blob: s.blob, capturedAt: s.capturedAt })) });
    }

    onDestroy(stopCamera);
</script>

{#if show}
<div class="fixed inset-0 z-[100] bg-black flex flex-col">
    <div class="flex items-center justify-between px-3 py-2 text-white shrink-0">
        <div class="min-w-0 flex-1">
            <div class="text-sm font-bold truncate">📷 {areaName}</div>
            <div class="text-[11px] text-slate-300">Đã chụp {shots.length}/{requiredShots} ảnh</div>
        </div>
        <button class="hover:text-red-400 transition-colors" on:click={close}><span class="material-icons-round text-3xl">close</span></button>
    </div>

    <div class="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">
        {#if cameraError}
            <div class="text-white text-sm text-center px-6">{cameraError}</div>
        {:else}
            <!-- svelte-ignore a11y-media-has-caption -->
            <video bind:this={videoEl} autoplay playsinline muted class="w-full h-full object-contain"></video>
        {/if}
    </div>

    <div class="flex gap-2 px-3 py-2 shrink-0 overflow-x-auto">
        {#each shots as shot, index}
            <div class="w-14 h-14 rounded-lg overflow-hidden border border-white/40 relative shrink-0">
                <img src={shot.previewUrl} alt="Ảnh {index + 1}" class="w-full h-full object-cover">
                <button class="absolute top-0 right-0 bg-black/60 text-white w-5 h-5 rounded-bl-lg flex items-center justify-center" on:click={() => removeShot(index)} title="Chụp lại ảnh này">
                    <span class="material-icons-round text-[14px]">close</span>
                </button>
            </div>
        {/each}
        {#each Array(Math.max(requiredShots - shots.length, 0)) as _}
            <div class="w-14 h-14 rounded-lg border-2 border-dashed border-white/30 shrink-0"></div>
        {/each}
    </div>

    <div class="flex items-center justify-between px-6 pb-6 pt-2 shrink-0">
        <button class="text-white text-sm font-bold px-3 py-2" on:click={close}>Huỷ</button>
        <button class="w-16 h-16 rounded-full border-4 border-white bg-white/20 active:bg-white/60 disabled:opacity-30" on:click={takeShot} disabled={isFull || !!cameraError || !stream} title="Chụp"></button>
        <button class="text-sm font-bold px-3 py-2 rounded-lg {isFull ? 'bg-cyan-500 text-white' : 'bg-white/10 text-white/40'}" on:click={confirm} disabled={!isFull}>Lưu {requiredShots} ảnh</button>
    </div>
</div>
{/if}
