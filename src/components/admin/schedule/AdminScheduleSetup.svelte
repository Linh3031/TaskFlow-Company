<script>
    import { createEventDispatcher, tick } from 'svelte';
    import { db } from '../../../lib/firebase';
    import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
    import { currentUser } from '../../../lib/stores';
    import { calculateCombosFromMatrix } from '../../../lib/scheduleLogic';
    
    import AdminScheduleToolbar from './AdminScheduleToolbar.svelte';
    import ScheduleMatrix from './ScheduleMatrix.svelte';
    import StoreConfig from '../../StoreConfig.svelte';
    import TourGuide from '../../TourGuide.svelte'; 
    import ManualScheduleUpload from './ManualScheduleUpload.svelte';
    import { defaultMatrix, tourSteps, shiftCols, roleRows } from './scheduleConstants.js';
    import RosterManager from './RosterManager.svelte';

    const dispatch = createEventDispatcher();

    export let targetStore;
    export let isLoading;
    export let scheduleStaffList;
    export let staffStats;
    export let scheduleMonth;
    export let scheduleYear;
    export let shiftMatrix;
    export let weekendMatrix;
    export let suggestedCombos;
    export let suggestedWeekendCombos;
    export let activeMatrixMode;
    export let genderConfig;
    export let customComboCols;

    let showStoreConfig = false;
    let showTour = false;
    let showShortageAlert = false;
    let shortageCount = 0;
    
    let setupMode = 'auto';
    let showRosterManager = false;

    // [NEW] Biến lưu toàn bộ user của kho để Modal Đội hình có thể lấy ra "Thêm mới"
    let masterStoreUsers = [];
    
    $: isDemoMode = targetStore?.includes('DEMO');
    $: activeSuggestedCombos = activeMatrixMode === 'weekday' ? suggestedCombos : suggestedWeekendCombos;
    
    let comboTotalsMap = {};
    $: { 
        const map = {};
        customComboCols.forEach(code => { 
            const items = activeSuggestedCombos.filter(c => c.code === code); 
            map[code] = items.reduce((sum, c) => sum + (parseInt(c.qty) || 0), 0); 
        });
        comboTotalsMap = map; 
    }

    $: if (scheduleStaffList) { 
        try { 
            staffStats = { 
                total: scheduleStaffList.length, 
                male: scheduleStaffList.filter(s => String(s.gender || '').trim().toLowerCase() === 'nam').length, 
                female: scheduleStaffList.filter(s => String(s.gender || '').trim().toLowerCase() !== 'nam').length 
            };
        } catch (e) { 
            staffStats = { total: 0, male: 0, female: 0 };
        } 
    }
    
    $: if (targetStore) loadStoreData();

    async function loadStoreData() { 
        if (!targetStore) return;
        scheduleStaffList = [];
        masterStoreUsers = []; // Reset master list
        shiftMatrix = JSON.parse(JSON.stringify(defaultMatrix)); 
        weekendMatrix = JSON.parse(JSON.stringify(defaultMatrix));
        suggestedCombos = []; 
        suggestedWeekendCombos = [];

        try { 
            // 1. LẤY TOÀN BỘ USER CỦA KHO NÀY
            const q = query(collection(db, 'users'), where('storeIds', 'array-contains', targetStore));
            const snap = await getDocs(q);
            let fullList = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.role === 'staff') {
                    fullList.push({
                        id: data.username_idx,     
                        name: data.name || data.username,   
                        gender: data.gender || 'Nữ',
                        accountRole: data.role,
                        orderIndex: data.orderIndex || 9999 
                    });
                }
            });
            masterStoreUsers = [...fullList]; // Lưu lại cho Modal Đội Hình dùng

            // 2. LẤY ĐỘI HÌNH ĐÃ CHỐT TỪ CLOUD (ROSTER)
            const rosterSnap = await getDoc(doc(db, 'stores', targetStore, 'config', 'roster'));
            
            if (rosterSnap.exists() && rosterSnap.data().list && rosterSnap.data().list.length > 0) {
                // Nếu có đội hình, lọc và sắp xếp đúng thứ tự của đội hình
                let rosterConfig = rosterSnap.data().list;
                let orderedList = [];
                
                rosterConfig.forEach(rItem => {
                    let foundUser = masterStoreUsers.find(u => u.id === rItem.id);
                    if (foundUser) orderedList.push(foundUser);
                });
                
                scheduleStaffList = orderedList; // Đây là danh sách chính thức đem đi chạy ca
            } else {
                // Nếu chưa từng lưu đội hình, lấy toàn bộ kho làm mặc định
                scheduleStaffList = fullList.sort((a,b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name));
            }

            // 3. TẢI CÁC CẤU HÌNH KHÁC
            const configSnap = await getDoc(doc(db, 'settings', `shift_matrix_${targetStore}`));
            if (configSnap.exists()) { 
                const data = configSnap.data();
                if (data.matrix) shiftMatrix = { ...defaultMatrix, ...data.matrix }; 
                if (data.approvedCombos) suggestedCombos = data.approvedCombos;
                if (data.weekendMatrix) weekendMatrix = { ...defaultMatrix, ...data.weekendMatrix }; 
                if (data.weekendCombos) suggestedWeekendCombos = data.weekendCombos; 
                if (data.genderConfig) genderConfig = data.genderConfig;
                if (data.comboCols && Array.isArray(data.comboCols)) { customComboCols = data.comboCols; } 
            } 
        } catch (e) { console.error(e); } 
    }

    function updateComboQty(roleLabel, comboCode, newQty) { 
        const qtyVal = parseInt(newQty) || 0;
        let currentList = activeMatrixMode === 'weekday' ? [...suggestedCombos] : [...suggestedWeekendCombos]; 
        const targetRoles = [roleLabel];
        if (roleLabel === 'Thu Ngân') targetRoles.push('TN', 'tn');
        if (roleLabel === 'Giao Hàng') targetRoles.push('GH', 'gh');
        if (roleLabel === 'Tư Vấn') targetRoles.push('TV', 'tv');
        
        const idx = currentList.findIndex(c => { 
            const cRole = c.role || 'TV'; 
            return c.code === comboCode && targetRoles.includes(cRole); 
        });
        if (idx >= 0) { 
            currentList[idx].qty = qtyVal;
            currentList[idx].role = roleLabel;
        } else if (qtyVal > 0) { 
            currentList.push({ code: comboCode, role: roleLabel, label: `${roleLabel} ${comboCode}`, qty: qtyVal });
        } 
        
        if (activeMatrixMode === 'weekday') suggestedCombos = currentList;
        else suggestedWeekendCombos = currentList;
    }

    async function saveGenderConfig(newConfig) { 
        if (!targetStore) return;
        genderConfig = newConfig;
        try { 
            await setDoc(doc(db, 'settings', `shift_matrix_${targetStore}`), { genderConfig }, { merge: true });
        } catch (e) { console.error(e); } 
    }

    function handleAddColumn() { customComboCols = [...customComboCols, '']; }
    function handleUpdateColumns(newCols) { customComboCols = newCols; }

    async function handleCalculateCombos(save = true) { 
        if(save) isLoading = true;
        try { 
            const clean = (m) => { 
                const c = JSON.parse(JSON.stringify(m));
                Object.keys(c).forEach(key => { 
                    if(c[key]) ['kho', 'tn', 'tv', 'gh'].forEach(role => { 
                        let val = parseInt(c[key][role]); 
                        if (isNaN(val)) val = 0; 
                        c[key][role] = val; 
                    }); 
                });
                return c; 
            }; 
            shiftMatrix = clean(shiftMatrix); 
            weekendMatrix = clean(weekendMatrix); 
            await tick(); 
            showShortageAlert = false; 
            shortageCount = 0;
            let tempWeekday = calculateCombosFromMatrix(shiftMatrix); 
            let tempWeekend = calculateCombosFromMatrix(weekendMatrix); 
            const checkShortage = (combos) => { 
                const totalDemand = combos.reduce((sum, c) => sum + (parseInt(c.qty)||0), 0);
                return totalDemand > staffStats.total ? (totalDemand - staffStats.total) : 0; 
            }; 
            
            const s1 = checkShortage(tempWeekday); 
            const s2 = checkShortage(tempWeekend);
            suggestedCombos = tempWeekday; 
            suggestedWeekendCombos = tempWeekend;
            
            if (s1 > 0 || s2 > 0) { 
                shortageCount = Math.max(s1, s2);
                showShortageAlert = true; 
            } 
            
            if(save) { 
                await setDoc(doc(db, 'settings', `shift_matrix_${targetStore}`), { 
                    matrix: shiftMatrix, approvedCombos: suggestedCombos, weekendMatrix: weekendMatrix, weekendCombos: suggestedWeekendCombos, genderConfig, comboCols: customComboCols, updatedAt: serverTimestamp(), updatedBy: $currentUser.username 
                });
            } 
        } catch (e) { alert("Lỗi tính toán: " + e.message);
        } finally { if(save) isLoading = false; } 
    }

    // [NEW] Xử lý khi đóng Modal Đội Hình: Reload lại data ngay lập tức để cập nhật bộ đếm
    function handleRosterClose() {
        showRosterManager = false;
        loadStoreData(); 
    }
</script>

<AdminScheduleToolbar 
    {isDemoMode} 
    bind:setupMode 
    on:openConfig={() => showStoreConfig = true} 
    on:openHelp={() => showTour = true} 
    on:openRoster={() => showRosterManager = true} 
/>

{#if setupMode === 'auto'}
    <div id="matrix-input-area" class="animate-fadeIn mt-2">
        <ScheduleMatrix 
            bind:staffStats bind:shiftMatrix bind:weekendMatrix bind:activeMatrixMode bind:scheduleMonth bind:scheduleYear {shiftCols} {roleRows} comboCols={customComboCols} {activeSuggestedCombos} {comboTotalsMap} {genderConfig}
            on:modeChange={(e) => activeMatrixMode = e.detail}
            on:monthChange={(e) => { if(e.detail === 1) { if(scheduleMonth==12){scheduleMonth=1;scheduleYear++}else{scheduleMonth++} } else { if(scheduleMonth==1){scheduleMonth=12;scheduleYear--}else{scheduleMonth--} } }}
            on:calculate={() => handleCalculateCombos(true)}
            on:updateCombo={(e) => updateComboQty(e.detail.role, e.detail.code, e.detail.qty)}
            on:configChange={(e) => { const newConf = {...genderConfig}; newConf[e.detail.type] = e.detail.val; saveGenderConfig(newConf); }}
            on:preview={() => dispatch('preview')}
            on:addCol={handleAddColumn}
            on:updateCols={(e) => handleUpdateColumns(e.detail)}
        />
    </div>
{:else}
    <ManualScheduleUpload 
        bind:scheduleMonth 
        bind:scheduleYear 
        {scheduleStaffList} 
        on:loading={(e) => isLoading = e.detail}
        on:manualPreview={(e) => dispatch('manualPreview', e.detail)}
    />
{/if}

{#if showStoreConfig} <StoreConfig storeId={targetStore} on:close={()=>showStoreConfig=false} /> {/if}
{#if showTour} <TourGuide steps={tourSteps} on:complete={() => showTour = false} /> {/if}

{#if showRosterManager} 
    <RosterManager 
        storeId={targetStore} 
        masterStaffList={masterStoreUsers}
        on:close={handleRosterClose} 
    /> 
{/if}