<script>
    import { onMount } from 'svelte';
    import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
    import { dbDoanhThu } from '../lib/firebase';
    import { currentUser } from '../lib/stores.js'; 

    import SknvOverviewTab from './sknv/SknvOverviewTab.svelte';
    import SknvCompetitionTab from './sknv/SknvCompetitionTab.svelte';
    import SknvCategoryTab from './sknv/SknvCategoryTab.svelte'; // [MỚI] Import Tab 3

    let loading = true;
    let errorMsg = '';
    let activeTab = 'tong_quan'; // tong_quan | thi_dua | chi_tiet

    let sknvData = null; 
    let allEmployeesData = []; 
    let selectedEmpId = '';

    $: role = ($currentUser?.role || $currentUser?.chucDanh || '').toUpperCase();
    $: isUserAdmin = role.includes('ADMIN') || role.includes('QUAN LY') || role.includes('QUẢN LÝ') || role.includes('AM');

    onMount(async () => {
        if (role.includes('PG')) {
            errorMsg = "Tính năng này không dành cho cấp bậc PG.";
            loading = false;
            return;
        }

        const rawUsername = String($currentUser?.username || '');
        const myEmpId = rawUsername.match(/\d+/)?.[0] || rawUsername;

        try {
            if (isUserAdmin) {
                const snap = await getDocs(collection(dbDoanhThu, 'sknv_final_data'));
                if (!snap.empty) {
                    allEmployeesData = snap.docs.map(d => d.data());
                    const me = allEmployeesData.find(e => e.maNV === myEmpId);
                    sknvData = me || allEmployeesData[0];
                    selectedEmpId = sknvData.maNV;
                } else { errorMsg = "Chưa có dữ liệu trên Cloud."; }
            } else {
                if (!myEmpId) { errorMsg = "Không tìm thấy mã số nhân viên."; loading = false; return; }
                const docRef = doc(dbDoanhThu, 'sknv_final_data', myEmpId);
                const snap = await getDoc(docRef);
                if (snap.exists()) { sknvData = snap.data(); } 
                else { errorMsg = `Chưa có dữ liệu đồng bộ cho mã NV ${myEmpId}.`; }
            }
        } catch (e) {
            errorMsg = "Không thể kết nối đến máy chủ dữ liệu.";
        } finally { loading = false; }
    });

    function handleAdminSelect(e) { sknvData = allEmployeesData.find(emp => emp.maNV === e.target.value); }
</script>

<div class="bg-slate-50 h-screen flex flex-col overflow-hidden">
    
    <div class="bg-white px-4 pt-6 pb-3 shadow-sm border-b border-gray-200 z-30 shrink-0">
        <h2 class="text-xl font-black text-emerald-600 flex items-center gap-2">
            <span class="material-icons-round">health_and_safety</span> Sức Khỏe Nhân Viên
        </h2>
        
        {#if sknvData && !loading && !errorMsg}
            <div class="mt-3 flex items-center justify-between">
                <div>
                    <div class="text-sm font-bold text-slate-800">{sknvData.hoTen}</div>
                    <div class="text-xs text-slate-500">Mã NV: {sknvData.maNV} | Kho: {sknvData.maKho}</div>
                </div>

                {#if isUserAdmin && allEmployeesData.length > 0}
                    <select 
                        class="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-lg px-2 py-1.5 outline-none max-w-[120px] truncate"
                        bind:value={selectedEmpId} on:change={handleAdminSelect}
                    >
                        {#each allEmployeesData as emp} <option value={emp.maNV}>{emp.hoTen} ({emp.maNV})</option> {/each}
                    </select>
                {/if}
            </div>

            <div class="flex gap-1 bg-gray-100 p-1 rounded-xl mt-3">
                {#each [{id:'tong_quan', label:'Tổng Quan'}, {id:'thi_dua', label:'Thi Đua'}, {id:'chi_tiet', label:'Chi Tiết'}] as tab}
                    <button 
                        class="flex-1 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all {activeTab === tab.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
                        on:click={() => activeTab = tab.id}
                    >{tab.label}</button>
                {/each}
            </div>
        {/if}
    </div>

    <div class="flex-1 overflow-y-auto overscroll-contain p-4 pb-24 relative">
        {#if loading}
            <div class="text-center p-10 text-emerald-400 animate-pulse font-bold flex flex-col items-center">
                <span class="material-icons-round text-4xl mb-2">cloud_sync</span> Đang tải dữ liệu...
            </div>
        {:else if errorMsg}
            <div class="text-center p-6 bg-red-50 text-red-600 rounded-xl font-bold border border-red-200 shadow-sm">
                <span class="material-icons-round block text-3xl mb-2 text-red-400">error_outline</span> {errorMsg}
            </div>
        {:else if sknvData && sknvData.data}
            
            <div class="animate-fade-in">
                {#if activeTab === 'tong_quan'}
                    <SknvOverviewTab data={sknvData.data} />
                {:else if activeTab === 'thi_dua'}
                    <SknvCompetitionTab thiDuaList={sknvData.data.thiDuaDetail} />
                {:else if activeTab === 'chi_tiet'}
                    <SknvCategoryTab data={sknvData.data} />
                {/if}
            </div>

        {/if}
    </div>
</div>

<style>
    .animate-fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>