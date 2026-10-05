<script>
    import { onDestroy } from 'svelte';
    import { currentUser, activeStoreId, refreshCurrentUser } from '../lib/stores.js';
    import { sknvAppService } from '../services/sknvAppService.js';

    import PhieuNhanVien from './sknv/bang-diem/PhieuNhanVien.svelte';
    import SknvCategoryTab from './sknv/SknvCategoryTab.svelte';
    import SknvCompetitionTab from './sknv/SknvCompetitionTab.svelte';
    import ChonNhanVien from './sknv/ChonNhanVien.svelte';
    import AppFooter from './AppFooter.svelte';

    const TABS = [
        { id: 'bang_diem', label: 'Bảng điểm', icon: 'assignment', on: 'bg-indigo-500 text-white shadow-sm' },
        { id: 'chi_tiet', label: 'Chi tiết', icon: 'category', on: 'bg-sky-500 text-white shadow-sm' },
        { id: 'thi_dua', label: 'Thi đua', icon: 'emoji_events', on: 'bg-pink-500 text-white shadow-sm' }
    ];
    let activeTab = 'bang_diem';

    // Tóm tắt kho sknv_app/{kho} — theo dõi trực tiếp, dashboard đồng bộ xong là app tự tải số mới
    let khoDangXem = null;
    let trangThaiKho = 'cho'; // cho | chua_chon | dang_tai | co | khong_co | loi
    let tomTat = null;
    let huyTheoDoiKho = null;

    // Quản lý tự chọn nhân viên (null = chưa chọn)
    let maNVChon = null;

    // Bảng điểm + thi đua của người đang xem
    let goiPhieu = null;
    let trangThaiPhieu = 'cho'; // cho | dang_tai | co | khong_co | loi
    let phieuKhoa = '';
    let phieuLuc = -1;
    let lanTaiPhieu = 0;
    let dangTaiPhieu = false;

    // Chi tiết sản phẩm — chỉ tải khi mở tab Chi tiết
    let goiChiTiet = null;
    let trangThaiChiTiet = 'cho';
    let chiTietKhoa = '';
    let chiTietLuc = -1;
    let lanTaiChiTiet = 0;

    // Hồ sơ chưa có MSNV: hỏi lại Firebase 1 lần
    let daHoiLaiHoSo = false;
    let dangHoiLaiHoSo = false;

    sknvAppService.xoaBanCaKhoCu();

    $: vaiTro = $currentUser?.role || '';
    $: laPG = vaiTro === 'pg';
    $: laQuanLy = vaiTro === 'admin' || vaiTro === 'super_admin';
    $: maNVCuaToi = sknvAppService.maNVHopLe($currentUser?.maNV);

    $: if (!laPG) moKho(String($activeStoreId || '').trim());

    $: dsNhanVien = tomTat?.nhanVien || [];
    $: macDinhQuanLy = dsNhanVien.some(n => String(n.maNV ?? '').trim() === maNVCuaToi) ? maNVCuaToi : '';
    $: maNVDangXem = laQuanLy ? (maNVChon ?? macDinhQuanLy) : maNVCuaToi;

    $: if (!laPG && !laQuanLy && $currentUser && !maNVCuaToi && !daHoiLaiHoSo) hoiLaiHoSo();

    $: kiemTraPhieu(tomTat, maNVDangXem);
    $: if (activeTab === 'chi_tiet') kiemTraChiTiet(tomTat, maNVDangXem);

    $: nvTrongDanhSach = dsNhanVien.find(n => String(n.maNV ?? '').trim() === maNVDangXem);
    $: hoTenDangXem = goiPhieu?.hoTen || nvTrongDanhSach?.hoTen || '';
    $: boPhanDangXem = goiPhieu?.boPhan || nvTrongDanhSach?.boPhan || '';
    $: gioCapNhat = sknvAppService.dinhDangGio(goiPhieu?.dongBoLuc);
    $: propsPhieu = sknvAppService.taoPropsPhieu(goiPhieu);

    // Hiển thị phần đầu tab
    $: dangTaiSoMoi = dangTaiPhieu || dangHoiLaiHoSo || trangThaiKho === 'dang_tai';
    $: hienCapNhat = !!gioCapNhat && trangThaiPhieu === 'co';
    $: coOTim = laQuanLy && dsNhanVien.length > 0;
    $: hienNhanVien = !laPG && trangThaiKho === 'co' && (!!maNVDangXem || coOTim);
    $: hienTabPhu = !laPG && trangThaiKho === 'co' && trangThaiPhieu === 'co' && !!goiPhieu;

    async function hoiLaiHoSo() {
        daHoiLaiHoSo = true;
        dangHoiLaiHoSo = true;
        try {
            await refreshCurrentUser(true);
        } finally {
            dangHoiLaiHoSo = false;
        }
    }

    function datLaiPhieu() {
        lanTaiPhieu++;
        goiPhieu = null;
        trangThaiPhieu = 'cho';
        phieuKhoa = '';
        phieuLuc = -1;
        dangTaiPhieu = false;
    }

    function datLaiChiTiet() {
        lanTaiChiTiet++;
        goiChiTiet = null;
        trangThaiChiTiet = 'cho';
        chiTietKhoa = '';
        chiTietLuc = -1;
    }

    function moKho(kho) {
        if (kho === khoDangXem) return;
        khoDangXem = kho;
        if (huyTheoDoiKho) { huyTheoDoiKho(); huyTheoDoiKho = null; }
        tomTat = null;
        maNVChon = null;
        datLaiPhieu();
        datLaiChiTiet();

        if (!kho) { trangThaiKho = 'cho'; return; }
        if (kho === 'ALL') { trangThaiKho = 'chua_chon'; return; }

        trangThaiKho = 'dang_tai';
        huyTheoDoiKho = sknvAppService.theoDoiKho(kho, (tt) => {
            if (kho !== khoDangXem) return;
            tomTat = tt;
            trangThaiKho = tt ? 'co' : 'khong_co';
        }, (e) => {
            console.error('Lỗi đọc tóm tắt kho SKNV:', e);
            if (kho !== khoDangXem) return;
            trangThaiKho = 'loi';
        });
    }

    async function kiemTraPhieu(tt, maNV) {
        if (!tt || !maNV) return;
        const kho = khoDangXem;
        const khoa = `${kho}|${maNV}`;
        const can = tt.capNhatPhieuLuc || 0;
        if (khoa === phieuKhoa && phieuLuc >= can && trangThaiPhieu !== 'loi') return;

        if (khoa !== phieuKhoa) {
            datLaiPhieu();
            phieuKhoa = khoa;
            trangThaiPhieu = 'dang_tai';
            const luu = maNV === maNVCuaToi ? sknvAppService.docBanLuu('phieu', kho, maNV) : null;
            if (luu) {
                goiPhieu = luu.data;
                phieuLuc = luu.luc;
                trangThaiPhieu = 'co';
                if (luu.luc >= can) return;
            }
        }

        const lan = ++lanTaiPhieu;
        dangTaiPhieu = true;
        try {
            const goi = await sknvAppService.taiPhieu(kho, maNV);
            if (lan !== lanTaiPhieu) return;
            goiPhieu = goi;
            phieuLuc = can;
            trangThaiPhieu = goi ? 'co' : 'khong_co';
            if (maNV === maNVCuaToi) {
                if (goi) sknvAppService.ghiBanLuu('phieu', kho, maNV, can, goi);
                else sknvAppService.xoaBanLuu('phieu');
            }
        } catch (e) {
            console.error('Lỗi tải bảng điểm:', e);
            if (lan !== lanTaiPhieu) return;
            if (!goiPhieu) trangThaiPhieu = 'loi';
        } finally {
            if (lan === lanTaiPhieu) dangTaiPhieu = false;
        }
    }

    async function kiemTraChiTiet(tt, maNV) {
        if (!tt || !maNV) return;
        const kho = khoDangXem;
        const khoa = `${kho}|${maNV}`;
        const can = tt.capNhatChiTietLuc || 0;
        if (khoa === chiTietKhoa && chiTietLuc >= can && trangThaiChiTiet !== 'loi') return;

        if (khoa !== chiTietKhoa) {
            datLaiChiTiet();
            chiTietKhoa = khoa;
            trangThaiChiTiet = 'dang_tai';
            const luu = maNV === maNVCuaToi ? sknvAppService.docBanLuu('chitiet', kho, maNV) : null;
            if (luu) {
                goiChiTiet = luu.data;
                chiTietLuc = luu.luc;
                trangThaiChiTiet = 'co';
                if (luu.luc >= can) return;
            }
        }

        const lan = ++lanTaiChiTiet;
        try {
            const goi = await sknvAppService.taiChiTiet(kho, maNV);
            if (lan !== lanTaiChiTiet) return;
            goiChiTiet = goi;
            chiTietLuc = can;
            trangThaiChiTiet = goi ? 'co' : 'khong_co';
            if (maNV === maNVCuaToi) {
                if (goi) sknvAppService.ghiBanLuu('chitiet', kho, maNV, can, goi);
                else sknvAppService.xoaBanLuu('chitiet');
            }
        } catch (e) {
            console.error('Lỗi tải chi tiết sản phẩm:', e);
            if (lan !== lanTaiChiTiet) return;
            if (!goiChiTiet) trangThaiChiTiet = 'loi';
        }
    }

    onDestroy(() => {
        if (huyTheoDoiKho) huyTheoDoiKho();
        lanTaiPhieu++;
        lanTaiChiTiet++;
    });
</script>

<div class="bg-slate-50 h-screen flex flex-col overflow-hidden">

    {#if hienNhanVien || dangTaiSoMoi || hienCapNhat || hienTabPhu}
    <div class="bg-white px-4 py-2 shadow-sm border-b border-gray-200 z-30 shrink-0 flex flex-col gap-2">
        {#if hienNhanVien || dangTaiSoMoi || hienCapNhat}
            <div class="flex items-center justify-between gap-2">
                {#if hienNhanVien}
                    {#if coOTim}
                        <ChonNhanVien {dsNhanVien} value={maNVDangXem} on:chon={(e) => { maNVChon = e.detail; }} />
                    {:else}
                        <div class="min-w-0 flex-1 truncate text-[13px]">
                            <span class="font-semibold text-slate-800">{hoTenDangXem || 'Nhân viên'}</span><span class="text-slate-500"> · {maNVDangXem}</span>
                        </div>
                    {/if}
                {/if}

                {#if dangTaiSoMoi}
                    <span class="ml-auto shrink-0 text-[11px] text-orange-600 flex items-center gap-1 font-bold bg-orange-50 px-2 py-1 rounded-full border border-orange-100">
                        <span class="material-icons-round text-[14px] animate-spin">sync</span> Đang tải số mới...
                    </span>
                {:else if hienCapNhat}
                    {#if hienNhanVien && coOTim}
                        <div class="ml-auto shrink-0 text-[10px] text-emerald-700 font-bold leading-tight whitespace-nowrap">
                            <div class="flex items-center gap-1">
                                <span class="material-icons-round text-[12px] text-emerald-500">check_circle</span>Cập nhật
                            </div>
                            <div>{gioCapNhat}</div>
                        </div>
                    {:else}
                        <span class="ml-auto shrink-0 text-[10px] text-emerald-700 flex items-center gap-1 font-bold whitespace-nowrap">
                            <span class="material-icons-round text-[12px] text-emerald-500">check_circle</span>
                            Cập nhật {gioCapNhat}
                        </span>
                    {/if}
                {/if}
            </div>
        {/if}

        {#if hienTabPhu}
            <div class="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {#each TABS as tab}
                    <button
                        class="flex-1 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 {activeTab === tab.id ? tab.on : 'text-gray-500 hover:text-gray-700'}"
                        on:click={() => activeTab = tab.id}
                    >
                        <span class="material-icons-round text-[15px]">{tab.icon}</span>{tab.label}
                    </button>
                {/each}
            </div>
        {/if}
    </div>
    {/if}

    <div class="flex-1 overflow-y-auto overscroll-contain p-4 pb-24 relative">
        {#if laPG}
            <div class="text-center p-6 bg-red-50 text-red-600 rounded-xl font-bold border border-red-200 shadow-sm">
                <span class="material-icons-round block text-3xl mb-2 text-red-400">error_outline</span> Tính năng này không dành cho cấp bậc PG.
            </div>
        {:else if trangThaiKho === 'chua_chon'}
            <div class="text-center p-6 bg-blue-50 text-blue-700 rounded-xl font-bold border border-blue-100 shadow-sm">
                <span class="material-icons-round block text-3xl mb-2 text-blue-400">store</span> Vui lòng chọn 1 siêu thị cụ thể.
            </div>
        {:else if !laQuanLy && !maNVCuaToi}
            {#if dangHoiLaiHoSo || !daHoiLaiHoSo}
                <div class="text-center p-10 text-emerald-400 font-bold flex flex-col items-center">
                    <span class="material-icons-round text-4xl mb-2 animate-spin">autorenew</span> Đang kiểm tra MSNV...
                </div>
            {:else}
                <div class="text-center p-6 bg-amber-50 text-amber-800 rounded-xl font-bold border border-amber-200 shadow-sm">
                    <span class="material-icons-round block text-3xl mb-2 text-amber-500">badge</span> Liên hệ QL cập nhật MSNV để xem kết quả
                </div>
            {/if}
        {:else if trangThaiKho === 'cho' || trangThaiKho === 'dang_tai'}
            <div class="text-center p-10 text-emerald-400 font-bold flex flex-col items-center">
                <span class="material-icons-round text-4xl mb-2 animate-spin">autorenew</span> Đang tải dữ liệu...
            </div>
        {:else if trangThaiKho === 'loi'}
            <div class="text-center p-6 bg-red-50 text-red-600 rounded-xl font-bold border border-red-200 shadow-sm">
                <span class="material-icons-round block text-3xl mb-2 text-red-400">error_outline</span> Không thể tải dữ liệu từ máy chủ.
            </div>
        {:else if trangThaiKho === 'khong_co'}
            <div class="text-center p-6 bg-blue-50 text-blue-700 rounded-xl font-bold border border-blue-100 shadow-sm">
                <span class="material-icons-round block text-3xl mb-2 text-blue-400">cloud_off</span> Kho {khoDangXem} hiện chưa có dữ liệu đồng bộ.
            </div>
        {:else if !maNVDangXem}
            <div class="text-center p-6 bg-emerald-50 text-emerald-700 rounded-xl font-bold border border-emerald-100 shadow-sm">
                <span class="material-icons-round block text-3xl mb-2 text-emerald-400">person_search</span> Chọn nhân viên để xem
            </div>
        {:else if trangThaiPhieu === 'co' && goiPhieu}
            <div class="animate-fade-in transition-all">
                {#if activeTab === 'bang_diem'}
                    {#key phieuKhoa}
                        <div class="rounded-[20px] shadow-sm border border-slate-100 overflow-hidden">
                            <PhieuNhanVien {...propsPhieu} />
                        </div>
                    {/key}
                {:else if activeTab === 'chi_tiet'}
                    <SknvCategoryTab chiTiet={goiChiTiet} trangThai={trangThaiChiTiet} tyLeQD={goiPhieu.phieu?.tyLeQD} tyLeTC={goiPhieu.phieu?.tyLeTC} />
                {:else if activeTab === 'thi_dua'}
                    <SknvCompetitionTab thiDua={goiPhieu.thiDua} />
                {/if}
            </div>
        {:else if trangThaiPhieu === 'khong_co'}
            <div class="text-center p-6 bg-blue-50 text-blue-700 rounded-xl font-bold border border-blue-100 shadow-sm">
                <span class="material-icons-round block text-3xl mb-2 text-blue-400">search_off</span> Chưa có dữ liệu cho mã {maNVDangXem} tại kho {khoDangXem}.
            </div>
        {:else if trangThaiPhieu === 'loi'}
            <div class="text-center p-6 bg-red-50 text-red-600 rounded-xl font-bold border border-red-200 shadow-sm">
                <span class="material-icons-round block text-3xl mb-2 text-red-400">error_outline</span> Không thể tải dữ liệu từ máy chủ.
            </div>
        {:else}
            <div class="text-center p-10 text-emerald-400 font-bold flex flex-col items-center">
                <span class="material-icons-round text-4xl mb-2 animate-spin">autorenew</span> Đang tải dữ liệu...
            </div>
        {/if}
        <AppFooter />
    </div>
</div>

<style>
    .animate-fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
