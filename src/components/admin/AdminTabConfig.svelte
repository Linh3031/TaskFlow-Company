<script>
    // Cài đặt giao diện: Bật/tắt Tab hiển thị cho cả kho
    import { db } from '../../lib/firebase';
    import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
    import { currentUser } from '../../lib/stores';

    export let targetStore = '';
    export let allTabs = [];

    let tabVisibility = {};
    let loading = false;
    let saving = false;

    const isTabOn = (t, cfg) => cfg[t.id] ?? !t.defaultHidden;
    $: enabledCount = allTabs.filter(t => isTabOn(t, tabVisibility)).length;

    async function loadConfig(storeId) {
        if (!storeId) return;
        loading = true;
        tabVisibility = {};
        try {
            const snap = await getDoc(doc(db, 'stores', storeId, 'settings', 'uiConfig'));
            if (snap.exists()) tabVisibility = snap.data().tabVisibility || {};
        } catch (e) { console.error("Lỗi tải cài đặt giao diện", e); }
        finally { loading = false; }
    }

    $: loadConfig(targetStore);

    function toggleTab(t) {
        tabVisibility = { ...tabVisibility, [t.id]: !isTabOn(t, tabVisibility) };
    }

    async function saveConfig() {
        if (!targetStore) return;
        if (enabledCount === 0) { alert('Phải bật ít nhất 1 tab!'); return; }
        saving = true;
        try {
            const toSave = {};
            allTabs.forEach(t => { toSave[t.id] = isTabOn(t, tabVisibility); });
            await setDoc(doc(db, 'stores', targetStore, 'settings', 'uiConfig'), {
                tabVisibility: toSave,
                updatedBy: $currentUser?.username || '',
                updatedAt: serverTimestamp()
            }, { merge: true });
            alert(`Đã lưu cài đặt giao diện cho kho ${targetStore}!`);
        } catch (e) {
            console.error(e);
            alert('Lỗi lưu cài đặt: ' + e.message);
        } finally { saving = false; }
    }
</script>

<div class="w-full max-w-xl mx-auto">
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100">
            <h3 class="font-bold text-slate-800 truncate">Cài Đặt Giao Diện - Kho {targetStore}</h3>
            <p class="text-xs text-slate-500">Tắt các tab kho không sử dụng. Áp dụng cho toàn bộ nhân viên trong kho.</p>
        </div>

        {#if loading}
            <div class="p-6 text-center text-sm text-slate-400">Đang tải...</div>
        {:else}
            <div class="divide-y divide-slate-100">
                {#each allTabs as t (t.id)}
                    {@const isOn = isTabOn(t, tabVisibility)}
                    <button class="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left" on:click={() => toggleTab(t)}>
                        <span class="material-icons-round shrink-0" style="color: {isOn ? t.color : '#cbd5e1'};">{t.icon}</span>
                        <span class="flex-1 min-w-0 truncate font-bold text-sm {isOn ? 'text-slate-800' : 'text-slate-400'}">{t.label}</span>
                        <span class="shrink-0 w-11 h-6 rounded-full p-0.5 flex transition-colors {isOn ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}">
                            <span class="w-5 h-5 bg-white rounded-full shadow"></span>
                        </span>
                    </button>
                {/each}
            </div>

            <div class="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <span class="text-xs text-slate-500">Đang bật {enabledCount}/{allTabs.length} tab</span>
                <button class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm disabled:opacity-50" on:click={saveConfig} disabled={saving || !targetStore}>
                    {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
            </div>
        {/if}
    </div>
</div>
