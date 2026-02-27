<script>
    import { createEventDispatcher } from 'svelte';
    export let isDemoMode = false;

    const dispatch = createEventDispatcher();
</script>

<div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
    <div class="flex items-center gap-2">
        <div id="toolbar-actions" class="flex items-center gap-2">
            <button class="bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center gap-1 border border-blue-100" on:click={() => dispatch('downloadSample')}>Tải Mẫu</button>
            <label class="bg-blue-600 text-white hover:bg-blue-700 font-bold py-2 px-3 rounded-lg text-xs cursor-pointer flex items-center gap-1 shadow-lg shadow-blue-200 transition-all active:scale-95">
                <span class="material-icons-round text-sm">upload</span> Upload
                <input type="file" hidden accept=".xlsx" disabled={isDemoMode} on:change={(e) => dispatch('uploadStaff', e)}>
            </label>

            <div class="w-px h-8 bg-slate-200 mx-1"></div>
            <button class="bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center gap-1 border border-gray-200" on:click={() => dispatch('openConfig')}>
                <span class="material-icons-round text-sm">settings</span> Khai báo giờ công
            </button>
        </div>
    </div>
    <div class="flex items-center gap-2">
         <button id="btn-help-schedule" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400" on:click={() => dispatch('openHelp')}><span class="material-icons-round">help_outline</span></button>
    </div>
</div>