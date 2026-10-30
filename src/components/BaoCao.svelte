<script>
    // Tab "Báo cáo" — clone phần "Nhập báo cáo" của Son911 (Báo cáo khai thác).
    // Mỗi lần bấm Báo cáo = 1 đơn hàng: copy văn bản chuẩn Zalo/Line, ghi đơn lên Firestore của kho, làm sạch form.
    // Nhân viên chỉ thấy đơn của chính mình (theo username đăng nhập); admin thấy đơn cả kho.
    import { onMount, onDestroy } from 'svelte';
    import { currentUser, activeStoreId } from '../lib/stores.js';
    import { ITEM_GROUPS, createEmptyDraft, normalizeDraft, isValidStaffName, parseTr } from '../lib/baocao/catalog.js';
    import { sanitizeExpressionInput, evaluateExpression, hasOperator } from '../lib/baocao/expression.js';
    import { buildReportText, fmtTr } from '../lib/baocao/reportText.js';
    import { streakWarnings, localDateKey } from '../lib/baocao/streak.js';
    import { windowStartKey, usedFieldDefs, mergeFields } from '../lib/baocao/aggregate.js';
    import { baoCaoStorage, newId } from '../lib/baocao/storage.js';
    import { listenStoreFields, addStoreField, removeStoreField } from '../lib/baocao/storeFields.js';
    import { listenOwnReports, listenStoreReports, fetchDay, saveReport, deleteReport as deleteReportDoc, dateKeysBetween } from '../lib/baocao/reportsRepo.js';
    import BandHeader from './BaoCaoParts/BandHeader.svelte';
    import GroupSection from './BaoCaoParts/GroupSection.svelte';
    import CustomFieldModal from './BaoCaoParts/CustomFieldModal.svelte';
    import DashboardTab from './BaoCaoParts/DashboardTab.svelte';
    import HistoryTab from './BaoCaoParts/HistoryTab.svelte';
    import AppFooter from './AppFooter.svelte';

    const SUB_TABS = [
        { id: 'entry', label: 'Nhập báo cáo' },
        { id: 'history', label: 'Nhật ký' },
        { id: 'dashboard', label: 'Biểu đồ' },
    ];
    let subTab = 'entry';
    let range = 'today';

    let draft = createEmptyDraft('');
    let localFields = [];   // nhân viên tự thêm — chỉ trên máy này
    let storeFields = [];   // admin thêm — chung cả kho
    let unsubStoreFields = () => {};
    let windowReports = []; // đơn trong khoảng đang nghe (đầu tháng / đầu tuần / 14 ngày → hôm nay)
    let extraReports = [];  // ngày cũ hơn, tải khi lọc ở Nhật ký
    let unsubReports = () => {};
    let historyStaff = 'all';
    let dashboardStaff = 'all';
    let loaded = false;
    let isSaving = false;
    let editingName = false;
    let nameInput = '';
    let fieldModalGroup = null;
    let notice = '';
    let noticeTimer;
    let saveTimer;

    $: isAdmin = $currentUser?.role === 'admin' || $currentUser?.role === 'super_admin';
    $: fields = [...storeFields.map(f => ({ ...f, scope: 'store' })), ...localFields];

    function watchStoreFields(storeId) {
        unsubStoreFields();
        unsubStoreFields = listenStoreFields(storeId, (list) => storeFields = list);
    }
    $: watchStoreFields($activeStoreId);

    // Định danh tài khoản để tách dữ liệu: username_idx (id hồ sơ), thiếu thì dùng username
    $: uid = String($currentUser?.username_idx || $currentUser?.username || '').trim();
    $: windowStart = windowStartKey();

    function watchReports(storeId, userId, admin) {
        unsubReports();
        windowReports = [];
        extraReports = [];
        const from = windowStartKey();
        const to = localDateKey();
        unsubReports = admin
            ? listenStoreReports(storeId, from, to, (list) => windowReports = list)
            : listenOwnReports(storeId, userId, dateKeysBetween(from, to), (list) => windowReports = list);
    }
    $: watchReports($activeStoreId, uid, isAdmin);

    // Gộp + bỏ trùng theo id; nhân viên chỉ giữ đơn của chính mình
    $: reports = Array.from(new Map([...windowReports, ...extraReports].map(r => [r.id, r])).values())
        .filter(r => isAdmin || r.username === uid);
    $: myReports = reports.filter(r => r.username === uid);
    $: viewFields = mergeFields(fields, reports);

    async function loadDay(e) {
        const date = e.detail;
        try {
            const list = await fetchDay($activeStoreId, date, uid, isAdmin);
            extraReports = [...extraReports.filter(r => r.date !== date), ...list];
        } catch (err) {
            console.error(err);
            alert('Lỗi tải đơn ngày ' + date + ': ' + err.message);
        }
    }

    // Tên theo tài khoản đang đăng nhập: lấy đúng username (VD "Linh-3031")
    function defaultStaffName(u) {
        if (!u) return '';
        return String(u.username || '').trim();
    }

    onMount(() => {
        const loginName = defaultStaffName($currentUser);
        draft = normalizeDraft(baoCaoStorage.loadDraft(uid), loginName);
        // Luôn điền theo nhân viên đang đăng nhập
        if (isValidStaffName(loginName)) draft.staffName = loginName;
        localFields = baoCaoStorage.loadCustomFields(uid);
        editingName = !isValidStaffName(draft.staffName);
        nameInput = draft.staffName || loginName;
        loaded = true;
        window.addEventListener('pagehide', flushDraft);
    });

    onDestroy(() => {
        unsubStoreFields();
        unsubReports();
        clearTimeout(noticeTimer);
        if (typeof window !== 'undefined') window.removeEventListener('pagehide', flushDraft);
        flushDraft();
    });

    function showNotice(msg) {
        notice = msg;
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => notice = '', 3000);
    }

    // Gõ phím thì gộp 300ms rồi mới ghi; thao tác một-nhát (đếm, bật/tắt, làm mới) ghi ngay
    let pendingDraft = null;
    function flushDraft() {
        clearTimeout(saveTimer);
        saveTimer = null;
        const next = pendingDraft;
        pendingDraft = null;
        if (next && !baoCaoStorage.saveDraft(uid, next)) showNotice('⚠️ Bản nháp chưa lưu được trên máy (bộ nhớ trình duyệt có thể đã đầy)');
    }
    function updateDraft(next, immediate = true) {
        draft = next;
        pendingDraft = next;
        if (immediate) { flushDraft(); return; }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flushDraft, 300);
    }

    const patchDraft = (patch, immediate = false) => updateDraft({ ...draft, ...patch }, immediate);

    function onCount(e) {
        const { group, key, value } = e.detail;
        updateDraft({ ...draft, counts: { ...draft.counts, [group]: { ...draft.counts[group], [key]: Math.max(0, value) } } });
    }
    function onAmount(e) {
        const { key, value } = e.detail;
        updateDraft({ ...draft, amounts: { ...draft.amounts, [key]: value } }, false);
    }
    function onOther(e) {
        const { group, patch } = e.detail;
        updateDraft({ ...draft, others: { ...draft.others, [group]: { ...draft.others[group], ...patch } } }, patch.name === undefined);
    }

    // ── Mục tuỳ chỉnh: admin thêm → chung cả kho (Firestore); nhân viên thêm → chỉ trên máy ──
    $: useStoreScope = isAdmin && !!$activeStoreId;

    async function addField(e) {
        if (useStoreScope) {
            const field = { ...e.detail, id: `sf_${newId()}` };
            try {
                await addStoreField($activeStoreId, field, $currentUser?.username);
                showNotice(`Đã thêm mục "${field.name}" cho cả kho ${$activeStoreId}`);
            } catch (err) {
                console.error(err);
                alert('Lỗi lưu mục cho kho: ' + err.message);
            }
            return;
        }
        const field = { ...e.detail, id: `cf_${newId()}` };
        const next = [...localFields, field];
        if (!baoCaoStorage.saveCustomFields(uid, next)) { alert('Không lưu được trên máy — bộ nhớ trình duyệt có thể đã đầy.'); return; }
        localFields = next;
        showNotice(`Đã thêm mục "${field.name}" (chỉ trên máy này)`);
    }
    async function deleteField(e) {
        const f = e.detail;
        if (f.scope === 'store') {
            if (!isAdmin) return;
            if (!confirm(`Xoá mục "${f.name}" khỏi cả kho ${$activeStoreId}?`)) return;
            try {
                await removeStoreField($activeStoreId, storeFields, f.id, $currentUser?.username);
            } catch (err) {
                console.error(err);
                alert('Lỗi xoá mục của kho: ' + err.message);
                return;
            }
        } else {
            if (!confirm(`Xoá mục "${f.name}"?`)) return;
            const next = localFields.filter(x => x.id !== f.id);
            if (!baoCaoStorage.saveCustomFields(uid, next)) { alert('Không lưu được trên máy — bộ nhớ trình duyệt có thể đã đầy.'); return; }
            localFields = next;
        }
        const groupCounts = { ...draft.counts[f.group] };
        delete groupCounts[f.id];
        const amounts = { ...draft.amounts };
        delete amounts[f.id];
        updateDraft({ ...draft, counts: { ...draft.counts, [f.group]: groupCounts }, amounts });
        showNotice(`Đã xoá mục "${f.name}"`);
    }

    // ── Tên nhân viên ──
    function commitName() {
        const v = nameInput.trim();
        if (!isValidStaffName(v)) {
            alert('Nhập đúng dạng "Tên - Mã", ví dụ: Linh -3031');
            return;
        }
        patchDraft({ staffName: v }, true);
        editingName = false;
    }

    // ── Doanh thu: nhận phép tính, rời ô (blur/Enter) thì thay bằng số đã tính ──
    $: isExpression = hasOperator(draft.revenueTotal);
    $: evaluated = isExpression ? evaluateExpression(draft.revenueTotal) : null;
    function commitRevenue() {
        if (isExpression && evaluated !== null) patchDraft({ revenueTotal: fmtTr(Math.max(0, evaluated)) }, true);
    }

    $: previewText = buildReportText(draft, fields);
    $: warnings = loaded ? streakWarnings(draft, myReports, fields) : [];

    function resetForm() {
        updateDraft(createEmptyDraft(draft.staffName));
        showNotice('Đã làm sạch form, sẵn sàng nhập đơn mới');
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            return false;
        }
    }

    async function submitReport() {
        if (!isValidStaffName(draft.staffName)) {
            alert('Nhập tên nhân viên dạng "Tên - Mã" (VD: Linh -3031) trước khi báo cáo');
            nameInput = draft.staffName;
            editingName = true;
            return;
        }
        if (!$activeStoreId || !uid) {
            alert('Chưa xác định được kho / tài khoản để lưu đơn. Vui lòng đăng nhập lại.');
            return;
        }
        isSaving = true;
        try {
            const text = buildReportText(draft, fields);
            const copied = await copyText(text);
            // Lưu số đã tính (ô doanh thu có thể còn chứa phép tính nếu bấm Báo cáo khi chưa rời ô)
            const revenueValue = parseTr(draft.revenueTotal);
            const report = { ...draft, revenueTotal: revenueValue > 0 ? fmtTr(revenueValue) : '', id: newId(), date: localDateKey(), savedAt: new Date().toISOString(), username: uid };
            // Đính kèm mục tự thêm đã dùng để admin ở máy khác vẫn cộng đúng
            report.fieldDefs = usedFieldDefs(report, fields);
            try {
                await saveReport($activeStoreId, uid, report);
            } catch (err) {
                console.error(err);
                alert('Không lưu được đơn hàng lên hệ thống: ' + err.message);
                return;
            }
            updateDraft(createEmptyDraft(draft.staffName));
            showNotice(copied ? '✅ Đã copy báo cáo. Dán lên nhóm Zalo/Line nhé!' : '⚠️ Đã ghi đơn nhưng không copy tự động được — copy tay nội dung vừa hiện');
            // Form đã làm sạch nên hiện lại văn bản để copy tay
            if (!copied) alert(text);
        } finally {
            isSaving = false;
        }
    }

    // ── Nhật ký ──
    // Chỉ sửa / xoá đơn của chính mình (admin xem đơn người khác chỉ để đọc + copy)
    function editReport(e) {
        const { id, date, savedAt, username, fieldDefs, ...rest } = e.detail;
        if (username !== uid) return;
        updateDraft({ ...normalizeDraft(rest, draft.staffName), staffName: draft.staffName });
        subTab = 'entry';
        showNotice('Đã tải lại đơn để sửa — bấm Báo cáo để ghi thành đơn mới');
    }
    async function deleteReport(e) {
        const r = e.detail;
        if (r.username !== uid) return;
        try {
            await deleteReportDoc($activeStoreId, uid, r);
            extraReports = extraReports.filter(x => x.id !== r.id);
        } catch (err) {
            console.error(err);
            alert('Không xoá được đơn: ' + err.message);
        }
    }
    function clearLocal() {
        // Huỷ (không ghi) bản nháp đang chờ, tránh ghi nháp cũ trở lại ngay sau khi xoá
        clearTimeout(saveTimer);
        saveTimer = null;
        pendingDraft = null;
        if (!baoCaoStorage.clearLocal(uid)) { alert('Không xoá được dữ liệu'); return; }
        localFields = [];
        draft = createEmptyDraft(draft.staffName);
        alert('Đã xoá nháp và mục tự thêm trên máy này');
    }
</script>

<div class="h-full overflow-y-auto bg-slate-50">
    <div class="w-full max-w-[960px] mx-auto pb-4 space-y-3">
        <!-- Tab con + tên nhân viên -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex gap-3 border-b border-slate-200 shrink-0">
                {#each SUB_TABS as t (t.id)}
                    <button class="pb-1.5 text-[13px] font-bold border-b-2 -mb-px transition-colors {subTab === t.id ? 'text-sky-700 border-sky-600' : 'text-slate-400 border-transparent hover:text-slate-600'}" on:click={() => subTab = t.id}>
                        {t.label}
                        {#if t.id === 'history' && myReports.length > 0}<span class="ml-0.5 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-500">{myReports.length}</span>{/if}
                    </button>
                {/each}
            </div>
            <div class="flex items-center gap-1.5 min-w-0">
                <span class="material-icons-round text-lg text-slate-400 shrink-0">person</span>
                {#if editingName}
                    <!-- svelte-ignore a11y_autofocus -->
                    <input autofocus placeholder="VD: Linh -3031" bind:value={nameInput} aria-label="Tên nhân viên"
                        on:keydown={(e) => { if (e.key === 'Enter') commitName(); }}
                        class="h-8 w-48 sm:w-56 min-w-0 rounded border border-slate-300 px-2 text-base sm:text-[13px] outline-none focus:border-sky-500" />
                    <button class="h-8 w-8 shrink-0 rounded bg-sky-600 text-white flex items-center justify-center" aria-label="Lưu tên" on:click={commitName}>
                        <span class="material-icons-round text-lg">check</span>
                    </button>
                {:else}
                    <button class="h-8 min-w-0 rounded border border-slate-200 bg-white px-2 flex items-center gap-1.5" title="Đổi tên nhân viên" on:click={() => { nameInput = draft.staffName; editingName = true; }}>
                        <span class="font-semibold text-[13px] text-slate-800 truncate">{draft.staffName || 'Chưa có tên'}</span>
                        <span class="material-icons-round text-sm text-slate-400 shrink-0">edit</span>
                    </button>
                {/if}
            </div>
        </div>

        {#if !loaded}
            <div class="border border-slate-200 bg-white h-40"></div>
        {:else if subTab === 'dashboard'}
            <DashboardTab {reports} fields={viewFields} {isAdmin} {uid} staffName={draft.staffName} bind:range bind:staffFilter={dashboardStaff} />
        {:else if subTab === 'history'}
            <HistoryTab {reports} fields={viewFields} {isAdmin} {uid} {windowStart} staffName={draft.staffName} bind:staffFilter={historyStaff}
                on:edit={editReport} on:delete={deleteReport} on:clearLocal={clearLocal} on:loadDay={loadDay} />
        {:else}
            <div class="lg:grid lg:grid-cols-12 lg:gap-3 space-y-3 lg:space-y-0">
                <div class="lg:col-span-8 space-y-3">
                    {#if warnings.length > 0}
                        <div class="border border-amber-300 bg-amber-50 px-3 py-2 flex gap-2 items-start" role="alert">
                            <span class="material-icons-round text-lg text-amber-700 mt-0.5 shrink-0">warning</span>
                            <div class="text-[13px] text-amber-800 min-w-0">
                                <span class="font-bold uppercase text-[11px] tracking-wider block">Cảnh báo 3 ngày liên tiếp không khai thác</span>
                                {warnings.join(' · ')}
                            </div>
                        </div>
                    {/if}

                    <!-- Doanh thu đơn hàng -->
                    <section class="border border-slate-200 bg-white">
                        <BandHeader icon="payments" title="Doanh thu đơn hàng (Tr)" />
                        <div class="p-2 space-y-1">
                            <label for="bc-revenue" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Tổng doanh thu thực</label>
                            <div class="flex items-center gap-2">
                                <input id="bc-revenue" type="text" inputmode="decimal" placeholder="VD: 8.5 hoặc 5+3+4" autocomplete="off"
                                    value={draft.revenueTotal}
                                    on:input={(e) => { const v = sanitizeExpressionInput(e.target.value); e.target.value = v; patchDraft({ revenueTotal: v }); }}
                                    on:blur={commitRevenue}
                                    on:keydown={(e) => { if (e.key === 'Enter') commitRevenue(); }}
                                    class="flex-1 min-w-0 h-9 rounded border border-slate-200 px-2 text-[16px] tabular-nums font-semibold outline-none focus:border-sky-500" />
                                {#if isExpression}
                                    <span class="shrink-0 text-[15px] font-semibold tabular-nums {evaluated !== null ? 'text-sky-700' : 'text-slate-300'}">
                                        = {evaluated !== null ? fmtTr(evaluated) : '…'}
                                    </span>
                                {/if}
                            </div>
                            <p class="text-[11.5px] text-slate-500">Gõ được phép tính (VD <span class="tabular-nums">5+3+4</span>) — rời ô là tự tính ra tổng.</p>
                        </div>
                        <div class="grid grid-cols-3 gap-2 p-2 border-t border-slate-100">
                            <!-- Ô tích ẩn ở mobile cho đủ chỗ chữ; trạng thái bật vẫn thấy qua màu nút -->
                            <button class="h-9 lg:h-8 rounded border px-1 flex items-center justify-center gap-1 text-[12px] sm:text-[13px] font-semibold min-w-0 {draft.traGop ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}" aria-pressed={draft.traGop} on:click={() => patchDraft({ traGop: !draft.traGop }, true)}>
                                <span class="material-icons-round text-base shrink-0 hidden sm:inline">{draft.traGop ? 'check_box' : 'check_box_outline_blank'}</span>
                                <span class="material-icons-round text-base shrink-0">credit_card</span>
                                <span class="truncate">Trả góp</span>
                            </button>
                            <button class="h-9 lg:h-8 rounded border px-1 flex items-center justify-center gap-1 text-[12px] sm:text-[13px] font-semibold min-w-0 {draft.moVi ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600'}" aria-pressed={draft.moVi} on:click={() => patchDraft({ moVi: !draft.moVi }, true)}>
                                <span class="material-icons-round text-base shrink-0 hidden sm:inline">{draft.moVi ? 'check_box' : 'check_box_outline_blank'}</span>
                                <span class="material-icons-round text-base shrink-0">account_balance_wallet</span>
                                <span class="truncate">Thanh toán ví</span>
                            </button>
                            <button class="h-9 lg:h-8 rounded border px-1 flex items-center justify-center gap-1 text-[12px] sm:text-[13px] font-semibold min-w-0 {draft.priceWar ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'}" aria-pressed={draft.priceWar} on:click={() => patchDraft({ priceWar: !draft.priceWar }, true)}>
                                <span class="material-icons-round text-base shrink-0 hidden sm:inline">{draft.priceWar ? 'check_box' : 'check_box_outline_blank'}</span>
                                <span class="material-icons-round text-base shrink-0">local_offer</span>
                                <span class="truncate">Chiến giá</span>
                            </button>
                        </div>
                    </section>

                    {#each ITEM_GROUPS as group (group)}
                        <GroupSection {group} {draft} {fields} {isAdmin}
                            on:count={onCount} on:amount={onAmount} on:other={onOther}
                            on:addField={(e) => fieldModalGroup = e.detail} on:deleteField={deleteField} />
                    {/each}

                    <section class="border border-slate-200 bg-white">
                        <BandHeader icon="info" title="Ghi chú" />
                        <textarea rows="3" placeholder={'- Đã tư vấn MLN, SIM nhưng khách chưa có nhu cầu\n- PG hỗ trợ : Trang'} aria-label="Ghi chú" value={draft.notes}
                            on:input={(e) => patchDraft({ notes: e.target.value })}
                            class="block w-full resize-none border-0 px-3 py-2 text-base sm:text-[13px] text-slate-800 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-sky-500"></textarea>
                    </section>
                </div>

                <!-- Xem trước + nút: cuối trang ở mobile, cột phải dính ở desktop -->
                <aside class="lg:col-span-4">
                    <div class="lg:sticky lg:top-0 space-y-3">
                        <section class="border border-slate-200 bg-white">
                            <BandHeader icon="description" title="Xem trước báo cáo" />
                            <pre class="px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words font-sans text-slate-800 min-h-[120px] overflow-hidden">{previewText}</pre>
                        </section>
                        {#if notice}
                            <div class="border border-sky-200 bg-sky-50 px-3 py-2 text-[13px] font-semibold text-sky-800">{notice}</div>
                        {/if}
                        <div class="grid grid-cols-2 gap-2">
                            <button class="h-11 lg:h-9 rounded border border-rose-200 bg-white text-rose-700 font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-rose-50" on:click={resetForm}>
                                <span class="material-icons-round text-lg">restart_alt</span> Làm mới
                            </button>
                            <button class="h-11 lg:h-9 rounded bg-sky-600 text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-sky-700 disabled:opacity-60" disabled={isSaving} on:click={submitReport}>
                                <span class="material-icons-round text-lg">content_copy</span> Báo cáo
                            </button>
                        </div>
                        <p class="text-[11.5px] text-slate-500 leading-snug">
                            Bấm <b>Báo cáo</b>: copy văn bản vào clipboard để dán lên nhóm Zalo/Line, ghi đơn lại trên máy, rồi làm sạch form cho đơn kế tiếp.
                        </p>
                    </div>
                </aside>
            </div>
        {/if}
    </div>
    <AppFooter />
</div>

{#if fieldModalGroup}
    <CustomFieldModal group={fieldModalGroup} scopeNote={useStoreScope ? `Áp dụng chung cho cả kho ${$activeStoreId}` : 'Chỉ lưu trên máy này'} on:close={() => fieldModalGroup = null} on:save={addField} />
{/if}
