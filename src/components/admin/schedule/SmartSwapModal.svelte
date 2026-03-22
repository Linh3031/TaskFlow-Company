<script>
    import { createEventDispatcher } from 'svelte';
    import { findSmartSwap } from '../../../lib/smartSwap.js';
    
    export let scheduleData;
    export let staffList;
    export let genderConfig;
    export let month;
    export let year;
    export let currentStats;

    const dispatch = createEventDispatcher();
    
    let searchA = ''; let searchB = ''; let searchBridge = '';
    let staffAId = ''; let staffBId = '';
    let bridgeIds = []; 
    
    let showDropA = false; let showDropB = false; let showDropBridge = false;
    let selectedAName = '--- Chọn Nhân Viên A ---';
    let selectedBName = '--- Chọn Nhân Viên B ---';
    let targetRole = 'ANY_HARD';

    $: filteredStaffA = staffList.filter(s => s.name.toLowerCase().includes(searchA.toLowerCase()));
    $: filteredStaffB = staffList.filter(s => s.name.toLowerCase().includes(searchB.toLowerCase()) && s.id !== staffAId);
    $: filteredBridge = staffList.filter(s => s.name.toLowerCase().includes(searchBridge.toLowerCase()) && s.id !== staffAId && s.id !== staffBId);

    function selectStaffA(s) { staffAId = s.id; selectedAName = s.name; showDropA = false; searchA = ''; scanResult = []; bridgeIds = bridgeIds.filter(id => id !== s.id); }
    function selectStaffB(s) { staffBId = s.id; selectedBName = s.name; showDropB = false; searchB = ''; scanResult = []; bridgeIds = bridgeIds.filter(id => id !== s.id); }
    
    function toggleBridge(id) {
        if (bridgeIds.includes(id)) bridgeIds = bridgeIds.filter(x => x !== id);
        else bridgeIds = [...bridgeIds, id];
        scanResult = [];
    }

    let scanResult = [];
    let isScanning = false;
    let hasScanned = false;

    function handleScan() {
        if (!staffAId || !staffBId) { alert("Vui lòng chọn đủ người nhả ca (A) và người nhận ca (B)!"); return; }
        isScanning = true; hasScanned = true;
        setTimeout(() => {
            scanResult = findSmartSwap(scheduleData, staffList, staffAId, staffBId, bridgeIds, targetRole, genderConfig, month, year, currentStats);
            isScanning = false;
        }, 400); 
    }

    // Hàm đóng tất cả dropdown khi click ra khoảng trắng
    function closeAllDropdowns() {
        showDropA = false; showDropB = false; showDropBridge = false;
    }
</script>

<div class="fixed inset-0 z-[120] bg-slate-900/70 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => dispatch('close')}>
    <div class="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] animate-popIn" on:click|stopPropagation={closeAllDropdowns}>
        
        <div class="p-5 border-b flex justify-between items-center bg-indigo-50/50 rounded-t-2xl shrink-0">
            <div>
                <h3 class="text-xl font-black text-indigo-900 flex items-center gap-2">
                    <span class="material-icons-round text-indigo-600">psychology</span> AI Đổi Ca Đa Chiều
                </h3>
                <p class="text-xs text-slate-600 mt-1">Cân bằng số lượng bằng cách tráo đổi <b>Nghiệp Vụ ⇌ Tư Vấn/Nghỉ</b>.</p>
            </div>
            <button on:click={() => dispatch('close')} class="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center">
                <span class="material-icons-round">close</span>
            </button>
        </div>
        
        <div class="p-5 bg-slate-50 border-b shrink-0 flex flex-col gap-5">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="relative" on:click|stopPropagation>
                    <label class="text-xs font-bold text-slate-600 mb-1 block">Người Dư Ca (A - Trừ đi)</label>
                    <div class="p-3 border rounded-xl bg-white flex justify-between items-center cursor-pointer shadow-sm hover:border-indigo-400 transition-colors" on:click={() => {showDropA = !showDropA; showDropB=false; showDropBridge=false;}}>
                        <span class="font-bold truncate pr-2 {staffAId?'text-indigo-700':'text-slate-400'}">{selectedAName}</span>
                        <span class="material-icons-round text-sm">expand_more</span>
                    </div>
                    {#if showDropA}
                        <div class="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl overflow-hidden">
                            <div class="p-2 border-b bg-slate-50"><input type="text" bind:value={searchA} placeholder="Tìm tên..." class="w-full p-2 border rounded bg-white outline-none text-sm focus:ring-2 focus:ring-indigo-200" autofocus></div>
                            <div class="max-h-48 overflow-y-auto">
                                {#each filteredStaffA as s}
                                    <div class="p-3 text-sm hover:bg-indigo-50 cursor-pointer border-b last:border-0 font-medium" on:click={() => selectStaffA(s)}>{s.name} <span class="text-[10px] text-slate-400">({s.gender})</span></div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>

                <div class="relative" on:click|stopPropagation>
                    <label class="text-xs font-bold text-slate-600 mb-1 block">Người Thiếu Ca (B - Cộng vào)</label>
                    <div class="p-3 border rounded-xl bg-white flex justify-between items-center cursor-pointer shadow-sm hover:border-pink-400 transition-colors" on:click={() => {showDropB = !showDropB; showDropA=false; showDropBridge=false;}}>
                        <span class="font-bold truncate pr-2 {staffBId?'text-pink-600':'text-slate-400'}">{selectedBName}</span>
                        <span class="material-icons-round text-sm">expand_more</span>
                    </div>
                    {#if showDropB}
                        <div class="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl overflow-hidden right-0">
                            <div class="p-2 border-b bg-slate-50"><input type="text" bind:value={searchB} placeholder="Tìm tên..." class="w-full p-2 border rounded bg-white outline-none text-sm focus:ring-2 focus:ring-pink-200" autofocus></div>
                            <div class="max-h-48 overflow-y-auto">
                                {#each filteredStaffB as s}
                                    <div class="p-3 text-sm hover:bg-pink-50 cursor-pointer border-b last:border-0 font-medium" on:click={() => selectStaffB(s)}>{s.name} <span class="text-[10px] text-slate-400">({s.gender})</span></div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div on:click|stopPropagation>
                    <label class="text-xs font-bold text-slate-600 mb-1 block">Loại ca muốn A chuyển cho B</label>
                    <select bind:value={targetRole} class="w-full p-3 border rounded-xl text-sm font-bold text-purple-700 bg-purple-50 outline-none shadow-sm cursor-pointer" on:change={() => scanResult = []}>
                        <option value="ANY_HARD">Bất kỳ ca Nghiệp Vụ (Tự động quét)</option>
                        <option value="GH">Chỉ định: Giao Hàng (GH)</option>
                        <option value="TN">Chỉ định: Thu Ngân (TN)</option>
                        <option value="Kho">Chỉ định: Kho (K)</option>
                        <option value="Weekend">Chỉ định: Ca Cuối Tuần</option>
                    </select>
                </div>

                <div class="relative bg-amber-50 rounded-xl border border-amber-200 flex flex-col justify-center px-3 py-2" on:click|stopPropagation>
                    <div class="flex justify-between items-center">
                        <label class="text-xs font-bold text-amber-900 block">Dự phòng: Trạm Trung Chuyển</label>
                        <button class="px-2 py-1 bg-amber-200 text-amber-900 text-xs font-bold rounded-lg hover:bg-amber-300" on:click={() => {showDropBridge = !showDropBridge; showDropA=false; showDropB=false;}}>
                            + Chọn người
                        </button>
                    </div>
                    
                    {#if bridgeIds.length > 0}
                        <div class="flex flex-wrap gap-1 mt-1.5">
                            {#each bridgeIds as bid}
                                {@const bStaff = staffList.find(s=>s.id===bid)}
                                <span class="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 border border-amber-200">
                                    {bStaff?.name} <button class="hover:text-red-500 material-icons-round text-[12px]" on:click={() => toggleBridge(bid)}>close</button>
                                </span>
                            {/each}
                        </div>
                    {/if}

                    {#if showDropBridge}
                        <div class="absolute z-50 w-full mt-2 bg-white border rounded-xl shadow-xl overflow-hidden right-0 top-full">
                            <div class="p-2 border-b bg-slate-50"><input type="text" bind:value={searchBridge} placeholder="Tìm kiếm đồng đội..." class="w-full p-2 border rounded bg-white outline-none text-sm focus:ring-2 focus:ring-amber-200" autofocus></div>
                            <div class="max-h-48 overflow-y-auto">
                                {#each filteredBridge as s}
                                    <label class="p-3 text-sm hover:bg-amber-50 cursor-pointer border-b last:border-0 font-medium flex items-center gap-3">
                                        <input type="checkbox" checked={bridgeIds.includes(s.id)} on:change={() => toggleBridge(s.id)} class="w-4 h-4 text-amber-600 rounded">
                                        <span>{s.name} <span class="text-[10px] text-slate-400">({s.gender})</span></span>
                                    </label>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>

            <div class="text-center mt-2">
                <button class="px-8 py-3 bg-slate-800 text-white font-bold rounded-full shadow hover:bg-slate-900 transition-all disabled:opacity-50" disabled={!staffAId || !staffBId || isScanning} on:click={handleScan}>
                    {#if isScanning}
                        <span class="material-icons-round animate-spin">sync</span> Đang nội suy đường đi...
                    {:else}
                        <span class="material-icons-round text-sm">auto_awesome</span> TÌM PHƯƠNG ÁN CÂN BẰNG
                    {/if}
                </button>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto p-5 bg-slate-100/50">
            {#if scanResult.length === 0 && hasScanned && !isScanning}
                <div class="text-center text-slate-500 py-10 bg-white rounded-xl border border-dashed">
                    <span class="material-icons-round text-4xl mb-2 opacity-50">search_off</span>
                    <p class="font-bold">Tuyệt vọng! AI không tìm thấy đường đi.</p>
                    <p class="text-xs mt-2">Hai người này quá kỵ rơ nhau (Giới tính, xoay ca).<br>Gợi ý: Hãy thêm 1-2 người khác vào <b>Trạm Trung Chuyển</b> và quét lại!</p>
                </div>
            {:else if scanResult.length > 0}
                <div class="space-y-4">
                    {#each scanResult as sol, index}
                        <div class="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col hover:border-indigo-400 hover:shadow-md transition-all">
                            
                            <div class="bg-indigo-50/50 px-4 py-3 border-b flex justify-between items-center">
                                <div class="font-black text-indigo-900 text-sm flex items-center gap-2">
                                    <span class="bg-indigo-600 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs shadow-sm">#{index+1}</span>
                                    {sol.type}
                                </div>
                                <button class="px-5 py-2 bg-emerald-500 text-white font-black text-xs rounded-lg hover:bg-emerald-600 transition-colors shadow shadow-emerald-200" on:click={() => dispatch('execute', sol.plan)}>
                                    CHỌN PHƯƠNG ÁN NÀY
                                </button>
                            </div>

                            <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <div class="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider flex items-center gap-1"><span class="material-icons-round text-[14px]">swap_calls</span> Lộ trình đổi ca</div>
                                    <div class="space-y-3">
                                        {#each sol.plan as step}
                                            <div class="text-xs bg-slate-50 p-2.5 rounded-xl border font-medium flex items-center justify-between shadow-sm">
                                                <div class="flex-1">
                                                    <div class="font-bold text-indigo-700 mb-1 text-[10px] uppercase">Ngày {step.day}</div>
                                                    {step.staff1.name} <span class="bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-bold ml-1">{step.role1||'TV'}</span>
                                                </div>
                                                <span class="material-icons-round text-slate-300 text-lg px-2">sync_alt</span>
                                                <div class="flex-1 text-right">
                                                    <div class="font-bold text-slate-400 mb-1 text-[10px] uppercase">&nbsp;</div>
                                                    <span class="bg-pink-100 text-pink-700 border border-pink-200 px-1.5 py-0.5 rounded font-bold mr-1">{step.role2||'TV'}</span> {step.staff2.name}
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                </div>

                                <div class="md:border-l md:pl-6 border-t md:border-t-0 pt-4 md:pt-0">
                                    <div class="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider flex items-center gap-1"><span class="material-icons-round text-[14px]">analytics</span> Bức tranh tổng quan (Kết quả)</div>
                                    <div class="space-y-2">
                                        {#each sol.impact as imp}
                                            <div class="text-xs bg-white p-2.5 rounded-xl border flex items-center justify-between">
                                                <div class="font-bold text-slate-700 w-1/3 truncate pr-2" title={imp.name}>{imp.name}</div>
                                                <div class="flex flex-wrap gap-1.5 justify-end w-2/3">
                                                    {#if imp.gh !== 0}<span class="px-1.5 py-0.5 rounded-md font-bold {imp.gh>0?'bg-emerald-100 text-emerald-700 border border-emerald-200':'bg-red-50 text-red-600 border border-red-100'}">GH {imp.gh>0?'+':''}{imp.gh}</span>{/if}
                                                    {#if imp.tn !== 0}<span class="px-1.5 py-0.5 rounded-md font-bold {imp.tn>0?'bg-emerald-100 text-emerald-700 border border-emerald-200':'bg-red-50 text-red-600 border border-red-100'}">TN {imp.tn>0?'+':''}{imp.tn}</span>{/if}
                                                    {#if imp.kho !== 0}<span class="px-1.5 py-0.5 rounded-md font-bold {imp.kho>0?'bg-emerald-100 text-emerald-700 border border-emerald-200':'bg-red-50 text-red-600 border border-red-100'}">K {imp.kho>0?'+':''}{imp.kho}</span>{/if}
                                                    {#if imp.weekend !== 0}<span class="px-1.5 py-0.5 rounded-md font-bold {imp.weekend>0?'bg-emerald-100 text-emerald-700 border border-emerald-200':'bg-red-50 text-red-600 border border-red-100'}">T7/CN {imp.weekend>0?'+':''}{imp.weekend}</span>{/if}
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .animate-popIn { animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes popIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>