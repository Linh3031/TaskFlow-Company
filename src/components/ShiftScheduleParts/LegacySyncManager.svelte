<script>
    import { db } from '../../lib/firebase';
    import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

    export let scheduleData;
    export let activeStoreId;
    export let currentMonthStr;
    export let isAdmin;
    export let currentMode;

    let currentStoreUsers = [];
    let orphanStaff = [];
    let showSyncModal = false;
    let syncMap = {}; 
    let activeSyncId = null;
    let syncSearchQuery = '';
    let loading = false;

    // Lắng nghe thay đổi Lịch để kích hoạt bộ quét ngầm
    $: if (isAdmin && scheduleData && activeStoreId && currentMode === 'NV') {
        checkLegacyData();
    }

    async function checkLegacyData() {
        try {
            const q = query(collection(db, 'users'), where('storeIds', 'array-contains', activeStoreId));
            const snap = await getDocs(q);
currentStoreUsers = snap.docs.map(d => d.data()).filter(u => u.role === 'staff');
            const validUserIds = currentStoreUsers.map(u => u.username_idx);
            let orphans = [];

            if (scheduleData && scheduleData.stats) {
                scheduleData.stats.forEach(st => {
                    if (!validUserIds.includes(st.id) && st.id !== 'OFF') {
                        orphans.push(st);
                    }
                });
            }
            orphanStaff = orphans;
        } catch(e) { console.error("Lỗi rà quét dữ liệu:", e); }
    }

    function getSelectedUserName(idx) {
        if (!idx) return '-- Chọn Tài Khoản Chuẩn --';
        const u = currentStoreUsers.find(x => x.username_idx === idx);
        return u ? `${u.name} (${u.username})` : '-- Chọn Tài Khoản Chuẩn --';
    }

    async function executeSync() {
        const mappings = Object.keys(syncMap).filter(k => syncMap[k]);
        if (mappings.length === 0) return alert("Vui lòng chọn ít nhất 1 tài khoản để khớp nối!");

        if (!confirm(`Xác nhận đồng bộ ${mappings.length} nhân sự?\nDữ liệu lịch cũ sẽ được sửa lại vĩnh viễn theo ID Hệ thống mới.`)) return;

        loading = true;
        try {
            let newScheduleData = JSON.parse(JSON.stringify(scheduleData));

            const applyMappingToStats = (statsArray) => {
                if (!statsArray) return;
                statsArray.forEach(st => {
                    if (syncMap[st.id]) {
                        const matchedUser = currentStoreUsers.find(u => u.username_idx === syncMap[st.id]);
                        if(matchedUser) {
                            st.id = matchedUser.username_idx;
                            st.name = matchedUser.name;
                            st.gender = matchedUser.gender || 'Nữ';
                            if (matchedUser.username) st.username = matchedUser.username;
                        }
                    }
                });
            };

            applyMappingToStats(newScheduleData.stats);
            applyMappingToStats(newScheduleData.baselineStats);
            applyMappingToStats(newScheduleData.systemStats);

            Object.keys(newScheduleData.data).forEach(day => {
                newScheduleData.data[day].forEach(assign => {
                    if (syncMap[assign.staffId]) {
                        const matchedUser = currentStoreUsers.find(u => u.username_idx === syncMap[assign.staffId]);
                        if(matchedUser) {
                            assign.staffId = matchedUser.username_idx;
                            assign.name = matchedUser.name;
                            assign.gender = matchedUser.gender || 'Nữ';
                        }
                    }
                });
            });

            const payload = { data: newScheduleData.data, stats: newScheduleData.stats };
            if (newScheduleData.baselineStats) payload.baselineStats = newScheduleData.baselineStats;
            if (newScheduleData.systemStats) payload.systemStats = newScheduleData.systemStats;

            const cleanPayload = JSON.parse(JSON.stringify(payload));
            await updateDoc(doc(db, 'stores', activeStoreId, 'schedules', currentMonthStr), cleanPayload);

            alert("✅ Khớp nối và Cứu dữ liệu thành công!");
            showSyncModal = false;
            syncMap = {};
        } catch (error) {
            alert("Lỗi đồng bộ: " + error.message);
        } finally {
            loading = false;
        }
    }
</script>

{#if isAdmin && orphanStaff.length > 0}
    <div class="bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-4 mb-4 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 animate-fadeIn border border-amber-200">
        <div class="flex items-center gap-3">
            <span class="material-icons-round text-3xl text-amber-500 animate-pulse">warning</span>
            <div>
                <h4 class="font-black text-amber-900">Phát hiện Dữ Liệu Nhân Sự Rời Rạc!</h4>
                <p class="text-xs font-medium mt-0.5">Có <b class="text-red-600 text-sm">{orphanStaff.length}</b> nhân sự đang sử dụng ID rác. Hãy khớp nối ngay để không đứt gãy Lũy kế.</p>
            </div>
        </div>
        <button class="bg-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all shrink-0 whitespace-nowrap flex items-center gap-2" on:click={() => showSyncModal = true}>
            <span class="material-icons-round text-sm">handshake</span> Khớp Nối Ngay
        </button>
    </div>
{/if}

{#if showSyncModal}
    <div class="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" on:click={() => showSyncModal = false}>
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-popIn" on:click|stopPropagation>
            <div class="p-5 border-b flex justify-between items-center bg-amber-50 rounded-t-2xl">
                <h3 class="font-black text-amber-800 text-lg flex items-center gap-2"><span class="material-icons-round">sync_problem</span> Khớp Nối Dữ Liệu Cũ</h3>
                <button class="text-amber-600 hover:bg-amber-100 p-1 rounded-full transition-colors" on:click={() => showSyncModal = false}><span class="material-icons-round">close</span></button>
            </div>
            <div class="p-5 flex-1 overflow-y-auto bg-slate-50">
<p class="text-sm text-slate-600 font-medium">Bạn có thể chọn tài khoản chuẩn (bên phải) để nối với ID cũ (bên trái).</p>
<p class="text-xs font-bold text-amber-700 bg-amber-100 p-2.5 rounded-lg border border-amber-200 mt-2 flex gap-2">
    <span class="material-icons-round text-amber-600 text-base">lightbulb</span>
    <span><b>MẸO XỬ LÝ NHANH:</b> Nếu danh sách trống (chưa có tài khoản chuẩn) hoặc thiếu Giới tính, hãy tạm đóng bảng này. Vào menu <b class="text-amber-900">Quản trị -> Nhân sự</b>, bấm <b>Tải DS Hiện Tại</b>, điền Tên/Giới tính vào Excel rồi Upload lại để hệ thống tự động chuẩn hóa hàng loạt trước!</span>
</p>
                <div class="space-y-3">
                    {#each orphanStaff as orphan}
                        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm gap-3">
                            <div>
                                <div class="font-black text-slate-800 text-base capitalize">{orphan.name}</div>
                                <div class="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded inline-block mt-1">ID Cũ: {orphan.id}</div>
                            </div>
                            <span class="material-icons-round text-slate-300 hidden sm:block">arrow_forward</span>
                            
                            <div class="relative w-full sm:w-72">
                                <div class="border border-indigo-200 p-2.5 rounded-lg w-full text-sm font-bold text-indigo-700 bg-indigo-50 cursor-pointer flex justify-between items-center shadow-sm hover:ring-2 hover:ring-indigo-300 transition-all"
                                     on:click={() => { activeSyncId = activeSyncId === orphan.id ? null : orphan.id; syncSearchQuery = ''; }}>
                                    <span class="truncate">{getSelectedUserName(syncMap[orphan.id])}</span>
                                    <span class="material-icons-round text-sm">{activeSyncId === orphan.id ? 'expand_less' : 'expand_more'}</span>
                                </div>

                                {#if activeSyncId === orphan.id}
                                    <div class="absolute top-full left-0 right-0 mt-1 bg-white border border-indigo-100 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-fadeIn">
                                        <div class="p-2 border-b bg-slate-50 relative">
                                            <span class="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                                            <input type="text" placeholder="Tìm tên..." bind:value={syncSearchQuery} class="w-full text-xs pl-8 pr-2 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" autofocus>
                                        </div>
                                        <div class="max-h-48 overflow-y-auto">
                                            <button class="w-full text-left p-2 text-xs text-red-500 hover:bg-red-50 font-bold border-b transition-colors flex items-center gap-1" on:click={() => {syncMap[orphan.id] = null; activeSyncId = null;}}><span class="material-icons-round text-[14px]">clear</span> Bỏ chọn</button>
                                            {#each currentStoreUsers.filter(u => !syncSearchQuery || u.name.toLowerCase().includes(syncSearchQuery.toLowerCase()) || u.username.toLowerCase().includes(syncSearchQuery.toLowerCase())) as u}
                                                <button class="w-full text-left p-2.5 text-xs hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-none flex flex-col gap-0.5"
                                                    on:click={() => { syncMap[orphan.id] = u.username_idx; activeSyncId = null; }}>
                                                    <div class="font-bold text-slate-800">{u.name}</div>
                                                    <div class="text-[10px] text-slate-400 font-mono">{u.username}</div>
                                                </button>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
            <div class="p-5 border-t bg-white rounded-b-2xl flex justify-end gap-3">
                <button class="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors" on:click={() => showSyncModal = false}>Để Sau</button>
                <button class="px-5 py-2.5 bg-amber-500 text-white font-bold rounded-xl shadow-lg hover:bg-amber-600 transition-transform active:scale-95 flex items-center gap-2 disabled:opacity-50" on:click={executeSync} disabled={loading}>
                    {#if loading} <span class="material-icons-round text-sm animate-spin">sync</span> Đang xử lý... {:else} <span class="material-icons-round text-sm">save</span> Lưu Đồng Bộ {/if}
                </button>
            </div>
        </div>
    </div>
{/if}