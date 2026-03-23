<script>
    import { createEventDispatcher } from 'svelte';
    import { read, utils, writeFile } from 'xlsx';

    const dispatch = createEventDispatcher();

    export let scheduleMonth;
    export let scheduleYear;
    export let scheduleStaffList = [];
    export let isLoading = false;

    // [SURGICAL EXCEL LOGIC] Tách biệt hoàn toàn khỏi Container
    function downloadManualTemplate() {
        const wb = utils.book_new();
        const daysInMonth = new Date(scheduleYear, scheduleMonth, 0).getDate();
        
        const headers = ["_SYS_ID_", "Tên hiển thị", "Giới tính"];
        const weekdaysRow = ["", "", ""]; 
        
        for (let i = 1; i <= daysInMonth; i++) {
            headers.push(String(i));
            const d = new Date(scheduleYear, scheduleMonth - 1, i);
            const wd = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
            weekdaysRow.push(wd);
        }

        const wsData = [headers, weekdaysRow];
        
        scheduleStaffList.forEach((s) => {
            let row = [s.id, s.name, s.gender || 'Nữ']; 
            for(let i=1; i<=daysInMonth; i++) {
                row.push(""); 
            }
            wsData.push(row);
        });

        const ws = utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ hidden: true }, { wch: 25 }, { wch: 10 }]; 
        utils.book_append_sheet(wb, ws, `Phan_Ca_T${scheduleMonth}_${scheduleYear}`);

        const hdData = [
            ["HƯỚNG DẪN GÕ MÃ CA (Không phân biệt hoa thường, khoảng trắng)"],
            ["- Tư vấn (Mặc định):", "Chỉ gõ mã ca. VD: 123, 456, 12-56"],
            ["- Thu ngân:", "Thêm đuôi -TN. VD: 123-TN, 456 - tn"],
            ["- Kho:", "Thêm đuôi -K. VD: 123-K, 456 - kho"],
            ["- Giao hàng:", "Thêm đuôi -GH. VD: 12345 - gh"],
            ["- Nghỉ:", "Gõ OFF hoặc để ô trống"]
        ];
        const wsHd = utils.aoa_to_sheet(hdData);
        wsHd['!cols'] = [{ wch: 30 }, { wch: 50 }];
        utils.book_append_sheet(wb, wsHd, "Huong_Dan");

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
        dispatch('loading', true); // Báo lên cha để hiện spinner nếu cần

        try {
            const data = await file.arrayBuffer();
            const wb = read(data);
            const ws = wb.Sheets[wb.SheetNames[0]]; 
            const json = utils.sheet_to_json(ws, { defval: "" });
            const daysInMonth = new Date(scheduleYear, scheduleMonth, 0).getDate();

            let parsedSchedule = {};
            for(let i=1; i<=daysInMonth; i++) parsedSchedule[String(i)] = [];
            
            let parsedStatsMap = {};
            let orderedStaffIds = []; 

            json.forEach(row => {
                let uidStr = String(row['_SYS_ID_'] || '').trim();
                if (!uidStr) return; 
                
                let staffInfo = scheduleStaffList.find(s => s.id === uidStr);
                if (!staffInfo) return; 

                if (!parsedStatsMap[staffInfo.id]) {
                    orderedStaffIds.push(staffInfo.id);
                    parsedStatsMap[staffInfo.id] = { ...staffInfo, totalHours: 0, gh: 0, tn: 0, kho: 0 };
                }

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

            scheduleStaffList.forEach(s => {
                if (!parsedStatsMap[s.id]) {
                    orderedStaffIds.push(s.id);
                    parsedStatsMap[s.id] = { ...s, totalHours: 0, gh: 0, tn: 0, kho: 0 };
                    for(let d=1; d<=daysInMonth; d++) {
                        parsedSchedule[String(d)].push({
                            staffId: s.id, name: s.name, gender: s.gender,
                            shift: 'OFF', role: '', originalShift: 'OFF', originalRole: ''
                        });
                    }
                }
            });

            const statsArray = orderedStaffIds.map(id => parsedStatsMap[id]);

            // Phát sự kiện đẩy dữ liệu lên cha
            dispatch('manualPreview', { schedule: parsedSchedule, stats: statsArray });

        } catch(e) { 
            alert("Lỗi đọc file: " + e.message);
        } finally { 
            isLoading = false;
            dispatch('loading', false);
            e.target.value = null; 
        }
    }
</script>

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
            {#if isLoading} 
                <span class="material-icons-round text-[16px] animate-spin">sync</span> Đang đọc... 
            {:else} 
                <span class="material-icons-round text-[16px]">cloud_upload</span> Tải Lịch Lên 
                <input type="file" hidden accept=".xlsx" on:change={handleManualUpload}> 
            {/if}
        </label>
    </div>
</div>