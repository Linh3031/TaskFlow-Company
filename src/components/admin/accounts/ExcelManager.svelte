<script>
    import { createEventDispatcher } from 'svelte';
    import { db } from '../../../lib/firebase';
    import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
    import { read, utils, writeFile } from 'xlsx';
    import { safeString } from '../../../lib/utils';

    const dispatch = createEventDispatcher();

    export let selectedStoreId = '';
    export let accountList = [];
    export let isDemoMode = false;
    export let activeSuperAdmin = false;

    function checkDemoAndBlock(e) {
        if (isDemoMode) { e && e.preventDefault(); e && e.stopPropagation(); alert("Tài khoản demo không có tính năng này!"); return true; }
        return false;
    }

    function downloadAccountSample() {
        const wb = utils.book_new();
        const wsData = [
            ["Username", "Mật_Khẩu", "Tên_Hiển_Thị", "Giới_Tính", "Quyền_Hạn(admin/staff/pg)", "Mã_Kho"], 
            [`Tam-12234`, "123456", "Nguyễn Tâm", "Nữ", "staff", selectedStoreId||'kho']
        ];
        const ws = utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{wch: 15}, {wch: 10}, {wch: 25}, {wch: 10}, {wch: 25}, {wch: 15}];
        utils.book_append_sheet(wb, ws, "Mau_Moi");
        writeFile(wb, `Mau_Tai_Khoan_${selectedStoreId}.xlsx`);
    }

    function downloadCurrentAccounts() {
        const wb = utils.book_new();
        const wsData = [
            ["Username", "Mật_Khẩu", "Tên_Hiển_Thị", "Giới_Tính", "Quyền_Hạn(admin/staff/pg)", "Mã_Kho"]
        ];
        accountList.forEach(acc => {
            if (acc.role === 'pg') return; 
            let displayName = acc.name || '';
            let gender = acc.gender || '';
            let stores = acc.storeIds ? acc.storeIds.join(', ') : (acc.storeId || selectedStoreId);
            wsData.push([ acc.username, "*** (Giữ nguyên)", displayName, gender, acc.role, stores ]);
        });
        const ws = utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{wch: 15}, {wch: 18}, {wch: 25}, {wch: 10}, {wch: 25}, {wch: 15}];
        utils.book_append_sheet(wb, ws, "DS_Hien_Tai");
        writeFile(wb, `Cap_Nhat_Nhan_Su_${selectedStoreId}.xlsx`);
    }

    function downloadCurrentPGs() {
        const wb = utils.book_new();
        const wsData = [
            ["username", "pass", "name", "gender", "brand", "category", "ma_kho"]
        ];
        accountList.forEach(acc => {
            if (acc.role !== 'pg') return; 
            let displayName = acc.name || '';
            let gender = acc.gender || '';
            let stores = acc.storeIds ? acc.storeIds.join(', ') : (acc.storeId || selectedStoreId);
            wsData.push([ acc.username, "*** (Giữ nguyên)", displayName, gender, acc.brand || '', acc.category || '', stores ]);
        });
        const ws = utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{wch: 15}, {wch: 18}, {wch: 25}, {wch: 10}, {wch: 15}, {wch: 15}, {wch: 15}];
        utils.book_append_sheet(wb, ws, "DS_PG_Hien_Tai");
        writeFile(wb, `Cap_Nhat_PG_${selectedStoreId}.xlsx`);
    }

    async function handleAccountUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        dispatch('loading', true);
        setTimeout(async () => {
            try {
                const data = await file.arrayBuffer();
                const wb = read(data);
                const json = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
                const batch = writeBatch(db);
                
                let c = 0;
                json.forEach((row, index) => {
                    let u = '', p = '', n = '', g = '', s = '', r = '';
                    Object.keys(row).forEach(key => {
                        const k = key.normalize('NFC').toLowerCase().replace(/\s+/g, '_');
                        if (k.includes('user') || k.includes('tai_khoan')) u = row[key];
                        if (k.includes('pass') || k.includes('mat_khau') || k.includes('mật_khẩu')) p = row[key];
                        if (k.includes('name') || k.includes('hien_thi') || k.includes('hiển_thị')) n = row[key];
                        if (k.includes('gender') || k.includes('gioi_tinh') || k.includes('giới_tính')) g = row[key];
                        if (k.includes('kho') || k.includes('store')) s = row[key];
                        if (k.includes('role') || k.includes('quyen') || k.includes('quyền') || k.includes('quyen_han')) r = row[key];
                    });
                    if (u && s) {
                        const uid = safeString(u).toLowerCase();
                        const exactUsername = String(u).trim(); 
                        const storeArray = String(s).split(/[,;]+/).map(x=>x.trim().toUpperCase()).filter(Boolean);
                        
                        let rawRole = String(r).toLowerCase();
                        let finalRole = 'staff';
                        if (rawRole.includes('admin') || rawRole.includes('ql')) finalRole = 'admin';
                        else if (rawRole.includes('pg')) finalRole = 'pg';
                        let updatePayload = { username: exactUsername, username_idx: uid, role: finalRole, storeId: storeArray[0], storeIds: storeArray, orderIndex: index + 1, updatedAt: serverTimestamp() };
                        
                        let passStr = String(p).trim();
                        if (passStr && passStr !== '*** (Giữ nguyên)' && passStr !== '***') { updatePayload.pass = passStr; }
                        if (n && String(n).trim() !== '') { updatePayload.name = String(n).trim(); }
                        if (g && String(g).trim() !== '') { updatePayload.gender = String(g).toLowerCase().includes('nam') ? 'Nam' : 'Nữ'; }

                        batch.set(doc(db, 'users', uid), updatePayload, { merge: true });
                        if (activeSuperAdmin) { storeArray.forEach(k => { batch.set(doc(db, 'stores', k), { id: k, name: `Kho ${k}` }, { merge: true }); }); }
                        c++;
                    }
                });
                if (c > 0) { 
                    await batch.commit();
                    alert(`Đã cập nhật/import ${c} nhân sự. Thứ tự Excel đã được bảo lưu!`);
                    dispatch('reload');
                }
            } catch (e) { alert(e.message);
            } finally { dispatch('loading', false); e.target.value = null; }
        }, 100);
    }

    function downloadPGSample() {
        const wb = utils.book_new();
        const wsData = [
            ["username", "pass", "name", "gender", "brand", "category", "ma_kho"], 
            [`Nghĩa-Oppo`, "123456", "Nguyễn Trọng Nghĩa", "Nam", "Oppo", "ICT", selectedStoreId||'kho']
        ];
        const ws = utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{wch: 15}, {wch: 10}, {wch: 25}, {wch: 10}, {wch: 15}, {wch: 15}, {wch: 15}];
        utils.book_append_sheet(wb, ws, "DS_PG");
        writeFile(wb, `Mau_PG_${selectedStoreId}.xlsx`);
    }

    async function handlePGUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        dispatch('loading', true);
        setTimeout(async () => {
            try {
                const data = await file.arrayBuffer();
                const wb = read(data);
                const json = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
                const batch = writeBatch(db);
                
                let c = 0;
                json.forEach((row, index) => {
                    let u = '', p = '', n = '', g = '', s = '', brand = '', category = '';
                    Object.keys(row).forEach(key => {
                        const k = key.normalize('NFC').toLowerCase().replace(/\s+/g, '_');
                        if (k.includes('user') || k.includes('tai_khoan')) u = row[key];
                        if (k.includes('pass') || k.includes('mat_khau') || k.includes('mật_khẩu')) p = row[key];
                        if (k.includes('name') || k.includes('hien_thi') || k.includes('hiển_thị')) n = row[key];
                        if (k.includes('gender') || k.includes('gioi_tinh') || k.includes('giới_tính')) g = row[key];
                        if (k.includes('kho') || k.includes('store')) s = row[key];
                        if (k.includes('brand') || k.includes('hang')) brand = row[key];
                        if (k.includes('category') || k.includes('nganh')) category = row[key];
                    });

                    if (u && s) {
                        const uid = safeString(u).toLowerCase();
                        const storeArray = String(s).split(/[,;]+/).map(x=>x.trim().toUpperCase()).filter(Boolean); 

                        let payload = { username: String(u).trim(), username_idx: uid, role: 'pg', storeId: storeArray[0], storeIds: storeArray, brand: String(brand).trim(), category: String(category).trim(), orderIndex: index + 1, updatedAt: serverTimestamp() };
                        let passStr = String(p).trim();
                        if (passStr && passStr !== '*** (Giữ nguyên)' && passStr !== '***') payload.pass = passStr;
                        if (n && String(n).trim() !== '') payload.name = String(n).trim();
                        if (g && String(g).trim() !== '') payload.gender = String(g).toLowerCase().includes('nam') ? 'Nam' : 'Nữ';

                        batch.set(doc(db, 'users', uid), payload, { merge: true });
                        c++;
                    }
                });
                if (c > 0) { 
                    await batch.commit();
                    alert(`Đã cập nhật/import ${c} PG.`); 
                    dispatch('reload');
                }
            } catch (e) { alert(e.message);
            } finally { dispatch('loading', false); e.target.value = null; }
        }, 100);
    }
</script>

<div id="upload-center" class="p-3 bg-slate-50 border-b border-slate-200 shrink-0 flex flex-col xl:flex-row gap-4 animate-fadeIn">
    <div class="flex-1 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <h4 class="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1"><span class="material-icons-round text-blue-500 text-sm">badge</span> Khai Báo / Cập Nhật Nhân Viên</h4>
        <div class="flex gap-2">
            <button class="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-colors" on:click={(e) => checkDemoAndBlock(e) || downloadAccountSample()}>Tải Mẫu Trắng</button>
            <button class="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-100 transition-colors flex justify-center items-center gap-1" on:click={(e) => checkDemoAndBlock(e) || downloadCurrentAccounts()}>
                <span class="material-icons-round text-[14px]">download</span> Tải DS Hiện Tại
            </button>
            <label class="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold cursor-pointer text-center hover:bg-blue-700 transition-colors shadow-sm">
                Upload Lên <input type="file" hidden accept=".xlsx" disabled={isDemoMode} on:change={handleAccountUpload}>
            </label>
        </div>
    </div>
    <div class="flex-1 bg-pink-50/50 p-3 rounded-lg border border-pink-200 shadow-sm">
        <h4 class="text-xs font-bold text-pink-700 mb-3 flex items-center gap-1"><span class="material-icons-round text-pink-500 text-sm">face_retouching_natural</span> Danh Sách PG</h4>
        <div class="flex gap-2">
            <button class="flex-1 bg-pink-100 text-pink-700 py-2 rounded-lg text-xs font-bold border border-pink-200 hover:bg-pink-200 transition-colors flex justify-center items-center gap-1" on:click={(e) => checkDemoAndBlock(e) || downloadCurrentPGs()}>
                <span class="material-icons-round text-[14px]">download</span> Tải DS Hiện Tại
            </button>
            <label class="flex-1 bg-pink-600 text-white py-2 rounded-lg text-xs font-bold cursor-pointer text-center hover:bg-pink-700 transition-colors shadow-sm">
                Upload PG <input type="file" hidden accept=".xlsx" disabled={isDemoMode} on:change={handlePGUpload}>
            </label>
        </div>
    </div>
</div>