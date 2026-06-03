<script>
    import { onMount } from 'svelte';
    import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
    import { dbDoanhThu } from '../lib/firebase';
    import { currentUser, activeStoreId } from '../lib/stores.js';

    import SknvOverviewTab from './sknv/SknvOverviewTab.svelte';
    import SknvCompetitionTab from './sknv/SknvCompetitionTab.svelte';
    import SknvCategoryTab from './sknv/SknvCategoryTab.svelte';

    let checking = true; 
    let loading = false; 
    let errorMsg = '';
    let activeTab = 'tong_quan';

    let sknvData = null; 
    let allEmployeesData = []; 
    let selectedEmpId = '';

    // Version Control Variables
    let hasNewUpdate = false;
    let lastUpdatedTime = null;

    $: role = ($currentUser?.role || $currentUser?.chucDanh || '').toUpperCase();
    $: isSuperAdmin = role.includes('ADMIN') || role.includes('AM');
    $: isStoreAdmin = role.includes('QUAN LY') || role.includes('QUẢN LÝ');
    $: isUserAdmin = isSuperAdmin || isStoreAdmin;

    // Reactivity Lock: Chỉ kiểm tra Metadata (1 Read), KHÔNG tải data ngầm
    $: if ($activeStoreId && !role.includes('PG')) {
        checkMetadata($activeStoreId);
    } else if (role.includes('PG')) {
        errorMsg = "Tính năng này không dành cho cấp bậc PG.";
        checking = false;
    }

    async function checkMetadata(targetWarehouse) {
        checking = true;
        errorMsg = '';
        hasNewUpdate = false;

        const rawUsername = String($currentUser?.username || '');
        const myEmpId = rawUsername.match(/\d+/)?.[0] || rawUsername;
        const kho = String(targetWarehouse || $currentUser?.maKho || $currentUser?.ma_kho || '').trim();

        if (!kho || kho === 'ALL') {
             checking = false;
             errorMsg = "Vui lòng chọn 1 siêu thị cụ thể.";
             return;
        }

        const cacheKey = `sknv_data_${kho}`;
        const versionKey = `sknv_version_${kho}`;

        try {
            // 1. Tải Metadata từ Firebase (1 LƯỢT ĐỌC DUY NHẤT)
            const metaRef = doc(dbDoanhThu, 'sknv_metadata', kho);
            const metaSnap = await getDoc(metaRef);

            let serverVersion = 0;
            if (metaSnap.exists()) {
                serverVersion = metaSnap.data().lastUpdated || 0;
                lastUpdatedTime = new Date(serverVersion).toLocaleString('vi-VN', { hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit' });
            }

            // 2. Lấy bộ nhớ dưới LocalStorage lên so sánh
            const localVersion = parseInt(localStorage.getItem(versionKey) || '0', 10);
            const localData = localStorage.getItem(cacheKey);

            if (serverVersion > localVersion || !localData) {
                // KHO CÓ DỮ LIỆU MỚI (hoặc người dùng chưa từng tải)
                hasNewUpdate = true;
                if (localData) loadFromLocal(localData, myEmpId); // Vẫn load data cũ ra cho xem bình thường
            } else {
                // SỐ LIỆU ĐÃ MỚI NHẤT -> Không cần làm gì thêm
                hasNewUpdate = false;
                loadFromLocal(localData, myEmpId);
            }
        } catch (e) {
            console.error("Lỗi check metadata:", e);
            errorMsg = "Lỗi kiểm tra phiên bản dữ liệu.";
        } finally {
            checking = false;
        }
    }

    function loadFromLocal(jsonString, myEmpId) {
        try {
            const parsed = JSON.parse(jsonString);
            allEmployeesData = parsed.allEmployeesData || [];
            if (allEmployeesData.length > 0) {
                // Ưu tiên chọn chính mình, nếu không chọn người đầu tiên
                const me = allEmployeesData.find(e => e.maNV === myEmpId);
                sknvData = me || allEmployeesData[0];
                selectedEmpId = sknvData.maNV;
            } else {
                sknvData = null;
            }
        } catch (e) {
            console.error("Lỗi parse local data", e);
            hasNewUpdate = true; // Data trong máy bị hỏng -> Ép tải lại
        }
    }

    async function downloadNewData() {
        loading = true;
        errorMsg = '';

        const rawUsername = String($currentUser?.username || '');
        const myEmpId = rawUsername.match(/\d+/)?.[0] || rawUsername;
        const targetWarehouse = String($activeStoreId || $currentUser?.maKho || $currentUser?.ma_kho || '').trim();
        const myPersonalWarehouse = String($currentUser?.maKho || $currentUser?.ma_kho || '').trim();

        const cacheKey = `sknv_data_${targetWarehouse}`;
        const versionKey = `sknv_version_${targetWarehouse}`;

        try {
            let q;
            if (isStoreAdmin && !isSuperAdmin) {
                q = query(collection(dbDoanhThu, 'sknv_final_data'), where('maKho', '==', myPersonalWarehouse));
            } else {
                q = query(collection(dbDoanhThu, 'sknv_final_data'), where('maKho', '==', targetWarehouse));
            }

            // [COSTLY QUERY] - Lấy danh sách nhân sự (N Reads)
            const snap = await getDocs(q);

            if (!snap.empty) {
                allEmployeesData = snap.docs.map(d => d.data());
                const me = allEmployeesData.find(e => e.maNV === myEmpId);
                sknvData = me || allEmployeesData[0];
                selectedEmpId = sknvData.maNV;

                // LƯU CỨNG VÀO LOCAL BẢO VỆ FIREBASE
                localStorage.setItem(cacheKey, JSON.stringify({ allEmployeesData }));

                // Đóng dấu Version Server xuống Local
                const metaRef = doc(dbDoanhThu, 'sknv_metadata', targetWarehouse);
                const metaSnap = await getDoc(metaRef);
                if (metaSnap.exists()) {
                    localStorage.setItem(versionKey, metaSnap.data().lastUpdated.toString());
                    lastUpdatedTime = new Date(metaSnap.data().lastUpdated).toLocaleString('vi-VN', { hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit' });
                } else {
                    localStorage.setItem(versionKey, Date.now().toString());
                }

                hasNewUpdate = false;
            } else {
                sknvData = null;
                allEmployeesData = [];
                errorMsg = `Kho ${targetWarehouse} hiện chưa có dữ liệu đồng bộ.`;
            }
        } catch (e) {
            console.error(e);
            errorMsg = "Không thể tải dữ liệu từ máy chủ.";
        } finally {
            loading = false;
        }
    }

    function handleAdminSelect(e) { 
        sknvData = allEmployeesData.find(emp => emp.maNV === e.target.value);
    }
</script>

<div class="bg-slate-50 h-screen flex flex-col overflow-hidden">
    
    <div class="bg-white px-4 pt-6 pb-3 shadow-sm border-b border-gray-200 z-30 shrink-0">
        <div class="flex items-center justify-between mb-1">
            <h2 class="text-xl font-black text-emerald-600 flex items-center gap-2">
                <span class="material-icons-round">health_and_safety</span> Sức Khỏe NV
            </h2>
            
            <div class="flex items-center">
                {#if checking}
                    <span class="text-[11px] text-gray-400 flex items-center gap-1 font-medium bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                        <span class="material-icons-round text-[14px] animate-spin">sync</span> Đang kiểm tra...
                    </span>
                {:else if hasNewUpdate}
                    <button 
                        on:click={downloadNewData} 
                        disabled={loading}
                        class="relative bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:active:scale-100 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                    >
                        {#if !loading}
                            <span class="absolute -top-1 -right-1 flex h-3 w-3">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
                            </span>
                        {/if}
                        <span class="material-icons-round text-[15px] {loading ? 'animate-spin' : ''}">
                            {loading ? 'sync' : 'cloud_download'}
                        </span>
                        {loading ? 'Đang tải...' : 'Có số mới! Tải ngay'}
                    </button>
                {:else if lastUpdatedTime && sknvData}
                    <span class="text-[10px] text-gray-500 flex items-center gap-1 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full font-medium">
                        <span class="material-icons-round text-[12px] text-emerald-500">check_circle</span> 
                        Bản mới nhất
                    </span>
                {/if}
            </div>
        </div>
        
        {#if sknvData && !errorMsg}
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
                        {#each allEmployeesData as emp} 
                            <option value={emp.maNV}>{emp.hoTen} ({emp.maNV})</option> 
                        {/each}
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
        {#if checking && !sknvData && !errorMsg}
            <div class="text-center p-10 text-emerald-400 font-bold flex flex-col items-center">
                <span class="material-icons-round text-4xl mb-2 animate-spin">autorenew</span> Đang tải dữ liệu...
            </div>
        {:else if errorMsg && !sknvData}
            <div class="text-center p-6 bg-red-50 text-red-600 rounded-xl font-bold border border-red-200 shadow-sm">
                <span class="material-icons-round block text-3xl mb-2 text-red-400">error_outline</span> {errorMsg}
            </div>
        {:else if hasNewUpdate && !sknvData && !checking}
            <div class="text-center p-8 bg-blue-50 text-blue-800 rounded-2xl border border-blue-100 shadow-sm flex flex-col items-center">
                <span class="material-icons-round text-5xl mb-3 text-blue-400">cloud_sync</span>
                <p class="font-bold text-sm mb-1">Dữ liệu đã sẵn sàng</p>
                <p class="text-[11px] opacity-80 mb-4 text-center">Quản lý đã đẩy số liệu lên hệ thống. Bấm tải về để xem chi tiết.</p>
                <button 
                    on:click={downloadNewData} 
                    disabled={loading}
                    class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-2.5 rounded-full shadow-md flex items-center gap-2 transition-all active:scale-95"
                >
                    <span class="material-icons-round text-[16px] {loading ? 'animate-spin' : ''}">download</span>
                    {loading ? 'Đang kéo số liệu...' : 'Tải về máy ngay'}
                </button>
            </div>
        {:else if sknvData && sknvData.data}
            <div class="animate-fade-in transition-all">
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