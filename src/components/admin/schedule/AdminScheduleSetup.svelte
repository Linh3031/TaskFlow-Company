<script>
    import { createEventDispatcher, tick } from 'svelte';
    import { db } from '../../../lib/firebase';
    // [NEW IMPORT] Thêm collection, query, where, getDocs để truy vấn bảng Users
    import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
    
    let setupMode = 'auto'; 

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
    
    // [SURGICAL LOGIC] Thay đổi toàn bộ tư duy lấy danh sách nhân viên tại đây
   async function loadStoreData() { 
        if (!targetStore) return;
        scheduleStaffList = [];
        shiftMatrix = JSON.parse(JSON.stringify(defaultMatrix)); 
        weekendMatrix = JSON.parse(JSON.stringify(defaultMatrix));
        suggestedCombos = []; 
        suggestedWeekendCombos = [];
        try { 
            const q = query(collection(db, 'users'), where('storeIds', 'array-contains', targetStore));
            const snap = await getDocs(q);
            let list = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.role === 'staff') {
                    list.push({
                        id: data.username_idx,              
                        name: data.name || data.username,   
                        gender: data.gender || 'Nữ',
                        accountRole: data.role,
                        // [NEW] Lấy con tem orderIndex, nếu ai tạo tay thì đẩy xuống dưới cùng
                        orderIndex: data.orderIndex || 9999 
                    });
                }
            });
            
            // [SURGICAL FIX] Ưu tiên xếp theo orderIndex trước, nếu bằng nhau thì mới xếp theo tên
            scheduleStaffList = list.sort((a,b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name));
            
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
                shortageCount = Math.max(s1, s2);
                showShortageAlert = true; 
            } 
            
            if(save) { 
                await setDoc(doc(db, 'settings', `shift_matrix_${targetStore}`), { 
                    matrix: shiftMatrix, approvedCombos: suggestedCombos, weekendMatrix: weekendMatrix, weekendCombos: suggestedWeekendCombos, genderConfig, comboCols: customComboCols, updatedAt: serverTimestamp(), updatedBy: $currentUser.username 
                });
            } 
        } catch (e) { alert("Lỗi tính toán: " + e.message); } finally { if(save) isLoading = false; } 
    }

    function downloadManualTemplate() {
        const wb = utils.book_new();
        const daysInMonth = new Date(scheduleYear, scheduleMonth, 0).getDate();
        
        const headers = ["_SYS_ID_", "Tên hiển thị"];
        for (let i = 1; i <= daysInMonth; i++) headers.push(String(i));

        const wsData = [headers];
        
        scheduleStaffList.forEach((s, index) => {
            let row = [s.id, s.name]; 
            for(let i=1; i<=daysInMonth; i++) {
                if (index === 0 && i === 1) row.push("123-TN");
                else if (index === 0 && i === 2) row.push("456-K");
                else if (index === 0 && i === 3) row.push("OFF");
                else if (index === 0 && i === 4) row.push("2345");
                else row.push("");
            }
            wsData.push(row);
        });

        wsData.push([]);
        wsData.push(["HƯỚNG DẪN GÕ MÃ CA (Không phân biệt hoa thường, khoảng trắng)"]);
        wsData.push(["- Tư vấn (Mặc định):", "Chỉ gõ mã ca. VD: 123, 456, 12-56"]);
        wsData.push(["- Thu ngân:", "Thêm đuôi -TN. VD: 123-TN, 456 - tn"]);
        wsData.push(["- Kho:", "Thêm đuôi -K. VD: 123-K, 456 - kho"]);
        wsData.push(["- Giao hàng:", "Thêm đuôi -GH. VD: 12345 - gh"]);
        wsData.push(["- Nghỉ:", "Gõ OFF hoặc để ô trống"]);

        const ws = utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ hidden: true }, { wch: 25 }]; 
        
        utils.book_append_sheet(wb, ws, `Phan_Ca_T${scheduleMonth}_${scheduleYear}`);
        writeFile(wb, `Mau_Phan_Ca_Thu_Cong_T${scheduleMonth}_${scheduleYear}.xlsx`);
    }

    function parseExcelCell(cellValue) {
        let str = String(cellValue).toUpperCase().replace(/\s+/g, '');
        if (!str || str === 'OFF' || str === '0') return { shift: 'OFF', role: '', isOFF: true };

        let role = 'TV';
        let shift = str;

        if (str.endsWith('-TN')) { role = 'Thu Ngân'; shift = str.slice(0, -3); }
        else if (str.endsWith('-K') || str.endsWith('-KHO')) { role = 'Kho'; shift = str.slice(0, str.lastIndexOf('-')); }
        else if (str.endsWith('-GH')) { role = 'GH'; shift = str.slice(0, -3); }

        return { shift, role, isOFF: false };
    }

    async function handleManualUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        isLoading = true;
        try {
            const data = await file.arrayBuffer();
            const wb = read(data);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = utils.sheet_to_json(ws, { defval: "" }); 
            const daysInMonth = new Date(scheduleYear, scheduleMonth, 0).getDate();

            let parsedSchedule = {};
            for(let i=1; i<=daysInMonth; i++) parsedSchedule[String(i)] = [];

            let parsedStatsMap = {};
            scheduleStaffList.forEach(s => {
                parsedStatsMap[s.id] = { ...s, totalHours: 0, gh: 0, tn: 0, kho: 0 };
            });

            json.forEach(row => {
                let uidStr = String(row['_SYS_ID_'] || '').trim();
                if (!uidStr) return;
                
                let staffInfo = scheduleStaffList.find(s => s.id === uidStr);
                if (!staffInfo) {
                    let nameStr = String(row['Tên hiển thị'] || '').trim().toLowerCase();
                    staffInfo = scheduleStaffList.find(s => s.name.toLowerCase().includes(nameStr) || nameStr.includes(s.name.toLowerCase()));
                }
                if (!staffInfo) return; 

                for(let d=1; d<=daysInMonth; d++) {
                    let cellVal = row[String(d)] || '';
                    let { shift, role, isOFF } = parseExcelCell(cellVal);

                    parsedSchedule[String(d)].push({
                        staffId: staffInfo.id,
                        name: staffInfo.name,
                        gender: staffInfo.gender,
                        shift: shift,
                        role: role,
                        originalShift: shift,
                        originalRole: role
                    });

                    if (!isOFF) {
                        let rKey = role === 'Thu Ngân' ? 'tn' : (role === 'Kho' ? 'kho' : (role === 'GH' ? 'gh' : ''));
                        if (rKey) parsedStatsMap[staffInfo.id][rKey]++;
                        parsedStatsMap[staffInfo.id].totalHours += (shift.length >= 3 ? 7 : 4); 
                    }
                }
            });

            for(let d=1; d<=daysInMonth; d++) {
                scheduleStaffList.forEach(s => {
                    if (!parsedSchedule[String(d)].find(x => x.staffId === s.id)) {
                        parsedSchedule[String(d)].push({
                            staffId: s.id, name: s.name, gender: s.gender,
                            shift: 'OFF', role: '', originalShift: 'OFF', originalRole: ''
                        });
                    }
                });
            }

            const statsArray = Object.values(parsedStatsMap);
            dispatch('manualPreview', { schedule: parsedSchedule, stats: statsArray });

        } catch(e) { alert("Lỗi đọc file: " + e.message); } finally { isLoading = false; e.target.value = null; }
    }
</script>

<AdminScheduleToolbar {isDemoMode} bind:setupMode on:openConfig={() => showStoreConfig = true} on:openHelp={() => showTour = true} />

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
    <div id="manual-input-area" class="p-6 mt-4 bg-indigo-50/40 rounded-xl border border-indigo-100 flex flex-col items-center justify-center animate-fadeIn shadow-sm">
        <div class="flex items-center gap-3 mb-4">
            <span class="material-icons-round text-[36px] text-indigo-400">grid_on</span>
            <div>
                <h3 class="text-lg font-black text-slate-800">Tải Lên Lịch Phân Ca Từ Excel</h3>
                <p class="text-xs text-slate-500">Hệ thống sẽ tự động bóc tách Ca/Vai Trò để chuyển sang Review.</p>
            </div>
        </div>

        <div class="flex flex-wrap justify-center items-center gap-4 mb-6 bg-white px-5 py-2.5 rounded-xl shadow-sm border border-indigo-100">
            <span class="font-bold text-slate-600 text-xs">Tháng:</span>
            <select bind:value={scheduleMonth} class="border-none font-bold text-indigo-700 outline-none cursor-pointer bg-transparent text-sm">
                {#each [1,2,3,4,5,6,7,8,9,10,11,12] as m}<option value={m}>Tháng {m}</option>{/each}
            </select>
            <div class="w-px h-4 bg-slate-300 mx-1"></div>
            <span class="font-bold text-slate-600 text-xs">Năm:</span>
            <input type="number" bind:value={scheduleYear} class="border-none font-bold text-indigo-700 w-16 outline-none bg-transparent text-sm text-center">
        </div>

        <div class="flex flex-wrap justify-center gap-4">
            <button class="bg-white text-indigo-600 border border-indigo-200 font-bold py-2.5 px-5 rounded-lg shadow-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 text-xs" on:click={downloadManualTemplate}>
                <span class="material-icons-round text-[16px]">download</span> Tải File Mẫu
            </button>
            <label class="bg-indigo-600 text-white font-bold py-2.5 px-6 rounded-lg shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all cursor-pointer flex items-center gap-2 text-xs">
                {#if isLoading} <span class="material-icons-round text-[16px] animate-spin">sync</span> Đang đọc... {:else} <span class="material-icons-round text-[16px]">cloud_upload</span> Tải Lịch Lên <input type="file" hidden accept=".xlsx" on:change={handleManualUpload}> {/if}
            </label>
        </div>
    </div>
{/if}

{#if showStoreConfig} <StoreConfig storeId={targetStore} on:close={()=>showStoreConfig=false} /> {/if}
{#if showTour} <TourGuide steps={tourSteps} on:complete={() => showTour = false} /> {/if}