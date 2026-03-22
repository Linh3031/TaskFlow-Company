<script>
    import { createEventDispatcher, tick } from 'svelte';
    import { db } from '../../../lib/firebase';
    import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
    import { read, utils, writeFile } from 'xlsx';
    import { safeString } from '../../../lib/utils';
    import { currentUser } from '../../../lib/stores';
    import { calculateCombosFromMatrix } from '../../../lib/scheduleLogic';
    
    import AdminScheduleToolbar from './AdminScheduleToolbar.svelte';
    import ScheduleMatrix from './ScheduleMatrix.svelte';
    import StoreConfig from '../../StoreConfig.svelte';
    import TourGuide from '../../TourGuide.svelte'; 
    import { defaultMatrix, tourSteps, shiftCols, roleRows } from './scheduleConstants.js';

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
    
    function checkDemoAndBlock(e) { 
        if (isDemoMode) { e && e.preventDefault(); alert("Tài khoản demo không có tính năng này!"); return true; } 
        return false; 
    }
    
    async function loadStoreData() { 
        if (!targetStore) return; 
        scheduleStaffList = [];
        shiftMatrix = JSON.parse(JSON.stringify(defaultMatrix)); 
        weekendMatrix = JSON.parse(JSON.stringify(defaultMatrix));
        suggestedCombos = []; 
        suggestedWeekendCombos = []; 
        try { 
            const staffSnap = await getDoc(doc(db, 'settings', `staff_list_${targetStore}`));
            if (staffSnap.exists()) scheduleStaffList = staffSnap.data().staffList || []; 
            
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

    function downloadScheduleSample() { 
        const wb = utils.book_new();
        const wsData = [["Ho_Ten", "Gioi_Tinh"], ["Nguyễn Văn A", "Nam"], ["Trần Thị B", "Nữ"]]; 
        const ws = utils.aoa_to_sheet(wsData); 
        utils.book_append_sheet(wb, ws, "DS_Nhan_Vien");
        writeFile(wb, `Mau_Phan_Ca_${targetStore}.xlsx`); 
    }

    async function handleStaffUpload(e) { 
        const file = e.target.files[0]; 
        if(!file) return; 
        isLoading = true;
        setTimeout(async () => { 
            try { 
                const data = await file.arrayBuffer(); 
                const wb = read(data); 
                const json = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); 
                let newStaff = []; 
                for(let i=0; i<json.length; i++) { 
                    const row = json[i]; 
                    let name = row['Ho_Ten'] || row['Họ Tên'] || ''; 
                    let gender = row['Gioi_Tinh'] || row['Giới Tính'] || 'Nữ'; 
                    if(name) { 
                        newStaff.push({ 
                            id: String(newStaff.length+1), 
                            name: safeString(name), 
                            gender: String(gender).toLowerCase().includes('nam') ? 'Nam' : 'Nữ' 
                        }); 
                    } 
                } 
                if(newStaff.length > 0) { 
                    scheduleStaffList = newStaff; 
                    await setDoc(doc(db, 'settings', `staff_list_${targetStore}`), { staffList: scheduleStaffList, updatedAt: serverTimestamp() }); 
                    alert(`✅ Đã cập nhật danh sách: ${newStaff.length} nhân viên vào kho ${targetStore}.`); 
                } else { 
                    alert(`⚠️ File không có dữ liệu hợp lệ!`); 
                } 
            } catch(e) { alert("Lỗi file: " + e.message); } finally { isLoading=false; e.target.value=null; } 
        }, 100);
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
            currentList[idx].qty = qtyVal; currentList[idx].role = roleLabel;
        } else if (qtyVal > 0) { 
            currentList.push({ code: comboCode, role: roleLabel, label: `${roleLabel} ${comboCode}`, qty: qtyVal });
        } 
        if (activeMatrixMode === 'weekday') suggestedCombos = currentList; 
        else suggestedWeekendCombos = currentList;
    }

    async function saveGenderConfig(newConfig) { 
        if (!targetStore) return; 
        genderConfig = newConfig;
        try { await setDoc(doc(db, 'settings', `shift_matrix_${targetStore}`), { genderConfig }, { merge: true }); } catch (e) { console.error(e); } 
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
                shortageCount = Math.max(s1, s2); showShortageAlert = true; 
            } 
            
            if(save) { 
                await setDoc(doc(db, 'settings', `shift_matrix_${targetStore}`), { 
                    matrix: shiftMatrix, approvedCombos: suggestedCombos, weekendMatrix: weekendMatrix, weekendCombos: suggestedWeekendCombos, genderConfig, comboCols: customComboCols, updatedAt: serverTimestamp(), updatedBy: $currentUser.username 
                });
            } 
        } catch (e) { alert("Lỗi tính toán: " + e.message); } finally { if(save) isLoading = false; } 
    }
</script>

<AdminScheduleToolbar 
    {isDemoMode}
    on:downloadSample={() => { if(!checkDemoAndBlock()) downloadScheduleSample(); }}
    on:uploadStaff={(e) => handleStaffUpload(e.detail)}
    on:openConfig={() => showStoreConfig = true}
    on:openHelp={() => showTour = true}
/>

<div id="matrix-input-area">
    <ScheduleMatrix 
        bind:staffStats
        bind:shiftMatrix
        bind:weekendMatrix
        bind:activeMatrixMode
        bind:scheduleMonth
        bind:scheduleYear
        {shiftCols}
        {roleRows}
        comboCols={customComboCols}
        {activeSuggestedCombos}
        {comboTotalsMap}
        {genderConfig}
        on:modeChange={(e) => activeMatrixMode = e.detail}
        on:monthChange={(e) => {
            if(e.detail === 1) { if(scheduleMonth==12){scheduleMonth=1;scheduleYear++}else{scheduleMonth++} }
            else { if(scheduleMonth==1){scheduleMonth=12;scheduleYear--}else{scheduleMonth--} }
        }}
        on:calculate={() => handleCalculateCombos(true)}
        on:updateCombo={(e) => updateComboQty(e.detail.role, e.detail.code, e.detail.qty)}
        on:configChange={(e) => { const newConf = {...genderConfig}; newConf[e.detail.type] = e.detail.val; saveGenderConfig(newConf); }}
        on:preview={() => dispatch('preview')}
        on:addCol={handleAddColumn}
        on:updateCols={(e) => handleUpdateColumns(e.detail)}
    />
</div>

{#if showStoreConfig} <StoreConfig storeId={targetStore} on:close={()=>showStoreConfig=false} /> {/if}
{#if showTour} <TourGuide steps={tourSteps} on:complete={() => showTour = false} /> {/if}