<script>
    import { formatters } from '../../utils/formatters.js';
    import { sknvAppService } from '../../services/sknvAppService.js';

    // Document sknv_app/{kho}/chitiet/{maNV}: tong + cây nganh -> nhom -> sanPham (đã xếp sẵn theo DT giảm dần)
    export let chiTiet = null;
    export let trangThai = 'dang_tai'; // cho | dang_tai | co | khong_co | loi
    // Tỷ lệ QĐ / tỷ lệ trả chậm lấy từ bảng điểm (phieu.tyLeQD, phieu.tyLeTC) — document chi tiết không có số trả chậm
    export let tyLeQD = null;
    export let tyLeTC = null;

    $: tong = chiTiet?.tong || {};
    $: nganh = chiTiet?.nganh || [];
    $: gio = sknvAppService.dinhDangGio(chiTiet?.dongBoLuc);

    // Đổi người xem thì đóng hết các dòng đang mở
    let mo = {};
    let moCua = '';
    $: if ((chiTiet?.maNV || '') !== moCua) { moCua = chiTiet?.maNV || ''; mo = {}; }
    function doiMo(key) {
        mo[key] = !mo[key];
    }

    // Số lượng giữ nguyên; tiền tính theo nghìn đồng. Số lỗi (null) hiện "—".
    const sl = (v) => (v === null || v === undefined ? '—' : formatters.formatNumber(v));
    const k = (v) => (v === null || v === undefined ? '—' : formatters.formatNumber(Math.round(v / 1000)));

    const MAU_NGANH = [
        { vien: 'border-l-blue-500', nen: 'bg-blue-50', chu: 'text-blue-600' },
        { vien: 'border-l-emerald-500', nen: 'bg-emerald-50', chu: 'text-emerald-600' },
        { vien: 'border-l-orange-500', nen: 'bg-orange-50', chu: 'text-orange-600' },
        { vien: 'border-l-violet-500', nen: 'bg-violet-50', chu: 'text-violet-600' },
        { vien: 'border-l-pink-500', nen: 'bg-pink-50', chu: 'text-pink-600' },
        { vien: 'border-l-cyan-500', nen: 'bg-cyan-50', chu: 'text-cyan-600' }
    ];
</script>

<div class="space-y-4 animate-fade-in">
    {#if trangThai === 'cho' || trangThai === 'dang_tai'}
        <div class="text-center p-10 text-sky-400 font-bold flex flex-col items-center">
            <span class="material-icons-round text-4xl mb-2 animate-spin">autorenew</span> Đang tải chi tiết sản phẩm...
        </div>
    {:else if trangThai === 'loi'}
        <div class="text-center p-6 bg-red-50 text-red-600 rounded-xl font-bold border border-red-200 shadow-sm">
            <span class="material-icons-round block text-3xl mb-2 text-red-400">error_outline</span> Không thể tải chi tiết sản phẩm.
        </div>
    {:else if !chiTiet}
        <div class="text-center p-8 bg-white rounded-xl border border-dashed border-gray-300 shadow-sm">
            <span class="material-icons-round text-4xl text-gray-300 mb-2 block">category</span>
            <p class="text-gray-500 text-sm font-medium">Chưa có chi tiết sản phẩm cho mã này.</p>
        </div>
    {:else}
        <div class="bg-gradient-to-br from-sky-500 to-indigo-500 rounded-2xl p-4 text-white shadow-sm">
            <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-black uppercase tracking-wider">Tổng cộng</span>
                {#if gio}
                    <span class="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full truncate">Cập nhật {gio}</span>
                {/if}
            </div>
            <div class="grid grid-cols-2 gap-2 mt-3">
                <div class="bg-white/15 rounded-xl p-2 min-w-0">
                    <div class="text-[10px] uppercase font-bold text-sky-100">DT thực</div>
                    <div class="text-lg font-black text-yellow-200 truncate">{k(tong.dt)}</div>
                </div>
                <div class="bg-white/15 rounded-xl p-2 min-w-0">
                    <div class="text-[10px] uppercase font-bold text-sky-100">DTQĐ</div>
                    <div class="text-lg font-black text-pink-200 truncate">{k(tong.dtqd)}</div>
                </div>
                <div class="bg-white/15 rounded-xl p-2 min-w-0">
                    <div class="text-[10px] uppercase font-bold text-sky-100">Tỷ lệ QĐ</div>
                    <div class="text-lg font-black text-emerald-200 truncate">{tyLeQD?.value ?? '—'}</div>
                </div>
                <div class="bg-white/15 rounded-xl p-2 min-w-0">
                    <div class="text-[10px] uppercase font-bold text-sky-100">Tỷ lệ trả chậm</div>
                    <div class="text-lg font-black text-orange-200 truncate">{tyLeTC?.value ?? '—'}</div>
                </div>
            </div>
            <div class="text-[10px] text-sky-100 mt-2">Tiền tính theo nghìn đồng · chạm vào ngành hàng để xem nhóm và sản phẩm</div>
        </div>

        {#if nganh.length === 0}
            <div class="text-center p-8 bg-white rounded-xl border border-dashed border-gray-300 shadow-sm">
                <span class="material-icons-round text-4xl text-gray-300 mb-2 block">category</span>
                <p class="text-gray-500 text-sm font-medium">Chưa phát sinh doanh thu ngành hàng.</p>
            </div>
        {:else}
            <div class="space-y-2">
                {#each nganh as ng, i}
                    {@const mau = MAU_NGANH[i % MAU_NGANH.length]}
                    <div class="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 {mau.vien} overflow-hidden">
                        <button class="w-full flex items-center gap-2 p-3 text-left" on:click={() => doiMo(`${i}`)}>
                            <span class="material-icons-round text-[18px] text-gray-400 transition-transform shrink-0 {mo[`${i}`] ? 'rotate-90' : ''}">chevron_right</span>
                            <div class="flex-1 min-w-0">
                                <div class="text-[13px] font-black text-slate-800 truncate">{ng.ten || 'Khác'}</div>
                                <div class="flex flex-wrap gap-x-3 text-[11px] mt-0.5">
                                    <span class="text-slate-500">SL <b class="text-slate-700">{sl(ng.sl)}</b></span>
                                    <span class="text-slate-500">DT thực <b class="text-blue-600">{k(ng.dt)}</b></span>
                                </div>
                            </div>
                            <div class="text-right shrink-0">
                                <div class="text-[9px] text-slate-400 font-bold uppercase">DTQĐ</div>
                                <div class="text-[15px] font-black {mau.chu}">{k(ng.dtqd)}</div>
                            </div>
                        </button>

                        {#if mo[`${i}`]}
                            <div class="{mau.nen} px-2 pb-2 pt-1 space-y-1.5">
                                {#each ng.nhom || [] as nh, j}
                                    <div class="bg-white rounded-lg overflow-hidden shadow-sm">
                                        <button class="w-full flex items-center gap-2 px-2.5 py-2 text-left" on:click={() => doiMo(`${i}-${j}`)}>
                                            <span class="material-icons-round text-[16px] text-gray-400 transition-transform shrink-0 {mo[`${i}-${j}`] ? 'rotate-90' : ''}">chevron_right</span>
                                            <div class="flex-1 min-w-0">
                                                <div class="text-[12px] font-bold text-slate-700 truncate">{nh.ten || 'Khác'}</div>
                                                <div class="flex flex-wrap gap-x-3 text-[10.5px]">
                                                    <span class="text-slate-500">SL <b class="text-slate-700">{sl(nh.sl)}</b></span>
                                                    <span class="text-slate-500">DT thực <b class="text-blue-600">{k(nh.dt)}</b></span>
                                                </div>
                                            </div>
                                            <div class="text-[13px] font-black {mau.chu} shrink-0">{k(nh.dtqd)}</div>
                                        </button>

                                        {#if mo[`${i}-${j}`]}
                                            <div class="divide-y divide-slate-100 border-t border-slate-100">
                                                {#each nh.sanPham || [] as sp}
                                                    <div class="px-3 py-2">
                                                        <div class="text-[12px] font-semibold text-slate-700 line-clamp-2 break-words">{sp.ten || sp.ma || 'Không rõ'}</div>
                                                        <div class="grid grid-cols-4 gap-1 mt-1 text-[11px]">
                                                            <div class="min-w-0">
                                                                <div class="text-[9px] uppercase font-bold text-slate-400">SL</div>
                                                                <div class="font-bold text-slate-700 truncate">{sl(sp.sl)}</div>
                                                            </div>
                                                            <div class="min-w-0">
                                                                <div class="text-[9px] uppercase font-bold text-slate-400">Đơn giá</div>
                                                                <div class="font-bold text-orange-600 truncate">{k(sp.donGia)}</div>
                                                            </div>
                                                            <div class="min-w-0">
                                                                <div class="text-[9px] uppercase font-bold text-slate-400">DT thực</div>
                                                                <div class="font-bold text-blue-600 truncate">{k(sp.dt)}</div>
                                                            </div>
                                                            <div class="min-w-0">
                                                                <div class="text-[9px] uppercase font-bold text-slate-400">DTQĐ</div>
                                                                <div class="font-bold text-purple-600 truncate">{k(sp.dtqd)}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<style>
    .animate-fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>
