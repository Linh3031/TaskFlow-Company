<script>
    import { createEventDispatcher } from 'svelte';

    // Ô chọn nhân viên cho quản lý: gõ tên (không cần dấu) hoặc MSNV để lọc danh sách.
    export let dsNhanVien = []; // [{ maNV, hoTen, boPhan }] — từ document sknv_app/{kho}
    export let value = '';      // MSNV đang xem

    const dispatch = createEventDispatcher();
    let tuKhoa = '';
    let mo = false;

    const boDau = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();

    $: dangChon = dsNhanVien.find(n => String(n.maNV ?? '').trim() === value);
    $: q = boDau(tuKhoa);
    $: ketQua = q ? dsNhanVien.filter(n => boDau(n.hoTen).includes(q) || String(n.maNV ?? '').includes(q)) : dsNhanVien;

    function chon(nv) {
        dispatch('chon', String(nv.maNV ?? '').trim());
        tuKhoa = '';
        mo = false;
    }
</script>

<div class="relative flex-1 min-w-0">
    <div class="flex items-center bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5 focus-within:border-emerald-400">
        <span class="material-icons-round text-[16px] text-emerald-500 mr-1 shrink-0">search</span>
        <input
            type="text"
            bind:value={tuKhoa}
            on:focus={() => mo = true}
            on:blur={() => mo = false}
            placeholder={dangChon ? `${dangChon.hoTen} · ${String(dangChon.maNV ?? '').trim()}` : 'Tìm tên hoặc MSNV'}
            class="bg-transparent outline-none text-xs font-bold text-emerald-700 placeholder:text-emerald-700 w-full min-w-0 truncate"
        >
    </div>

    {#if mo}
        <div class="absolute right-0 top-full mt-1 w-64 max-w-[80vw] max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-40">
            {#each ketQua as nv}
                <button
                    type="button"
                    on:mousedown|preventDefault={() => chon(nv)}
                    class="w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 border-b border-gray-50 {String(nv.maNV ?? '').trim() === value ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-gray-50'}"
                >
                    <span class="font-bold truncate">{nv.hoTen}</span>
                    <span class="text-[11px] text-slate-400 shrink-0">{nv.maNV}</span>
                </button>
            {:else}
                <div class="px-3 py-3 text-xs text-gray-400 text-center">Không tìm thấy nhân viên</div>
            {/each}
        </div>
    {/if}
</div>
