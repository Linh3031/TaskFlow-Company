<script>
    export let data = {};

    // Rút gọn chia 1000
    const fmtRevK = (val) => new Intl.NumberFormat('vi-VN').format(Math.round((val || 0) / 1000));
    const fmtPct = (val) => ((val || 0) * 100).toFixed(1) + '%';
</script>

<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
    
    <div class="bg-amber-50 p-3 sm:p-4 rounded-2xl shadow-sm border border-amber-100 flex flex-col justify-between relative">
        <span class="text-[10px] text-amber-700 font-bold uppercase tracking-wide">Doanh thu Thực</span>
        <div class="text-base sm:text-lg font-black text-amber-900 mt-2">{fmtRevK(data.doanhThu)}</div>
        {#if data.rankDtThuc && data.totalEmployees}
            <div class="absolute top-2 right-2 bg-amber-200 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-black shadow-sm">
                #{data.rankDtThuc}/{data.totalEmployees}
            </div>
        {/if}
    </div>

    <div class="bg-blue-50 p-3 rounded-2xl shadow-sm border border-blue-100 flex flex-col justify-between relative">
        <span class="text-[10px] text-blue-600 font-bold uppercase tracking-wide">Doanh thu QĐ</span>
        <div class="text-lg font-black text-blue-800 mt-2">{fmtRevK(data.doanhThuQuyDoi)}</div>
        {#if data.rankDtqd && data.totalEmployees}
            <div class="absolute top-2 right-2 bg-blue-200 text-blue-800 text-[9px] px-1.5 py-0.5 rounded font-black shadow-sm">
                #{data.rankDtqd}/{data.totalEmployees}
            </div>
        {/if}
    </div>

    <div class="bg-emerald-50 p-3 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between relative">
        <span class="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">Tỷ lệ Quy đổi</span>
        <div class="text-lg font-black text-emerald-800 mt-2">{fmtPct(data.hieuQuaQuyDoi)}</div>
        {#if data.rankTyLe && data.totalEmployees}
            <div class="absolute top-2 right-2 bg-emerald-200 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-black shadow-sm">
                #{data.rankTyLe}/{data.totalEmployees}
            </div>
        {/if}
    </div>

    <div class="bg-orange-50 p-3 rounded-2xl shadow-sm border border-orange-100 flex flex-col justify-between relative">
        <span class="text-[10px] text-orange-600 font-bold uppercase tracking-wide">Tỷ lệ Trả chậm</span>
        <div class="text-lg font-black text-orange-800 mt-2">{fmtPct(data.tyLeTraCham)}</div>
        {#if data.rankTraCham && data.totalEmployees}
            <div class="absolute top-2 right-2 bg-orange-200 text-orange-800 text-[9px] px-1.5 py-0.5 rounded font-black shadow-sm">
                #{data.rankTraCham}/{data.totalEmployees}
            </div>
        {/if}
    </div>

    <div class="bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-700 flex flex-col justify-between relative">
        <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Dự kiến so Tháng trước</span>
        <div class="mt-1">
            <div class="text-lg font-black text-white flex items-center gap-1">
                {fmtRevK(Math.abs(data.duKienSoCK || 0))}
                {#if (data.duKienSoCK || 0) >= 0}
                    <i class="material-icons-round text-sm text-emerald-400">arrow_upward</i>
                {:else}
                    <i class="material-icons-round text-sm text-red-400">arrow_downward</i>
                {/if}
            </div>
            <div class="text-[10px] text-slate-400 mt-0.5">Tháng trước: {fmtRevK(data.dtqdCK)}</div>
        </div>
        {#if data.rankDuKien && data.totalEmployees}
            <div class="absolute top-2 right-2 bg-slate-600 text-slate-200 text-[9px] px-1.5 py-0.5 rounded font-black shadow-sm">
                #{data.rankDuKien}/{data.totalEmployees}
            </div>
        {/if}
    </div>

    <div class="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-2xl shadow-sm border border-indigo-400 flex flex-col justify-between relative">
        <span class="text-[10px] text-indigo-100 font-bold uppercase tracking-wide">Thi đua đạt</span>
        <div class="text-lg font-black text-white mt-2 flex items-baseline gap-1.5">
            <span>
                <span class="text-yellow-300 text-2xl">{data.thiDuaScore || 0}</span> 
                <span class="text-sm opacity-80">/ {(data.thiDuaDetail || []).length}</span>
            </span>
            <span class="text-[11px] text-indigo-200 font-medium">
                ({fmtPct((data.thiDuaScore || 0) / (data.thiDuaDetail?.length || 1))})
            </span>
        </div>
        {#if data.rankThiDua && data.totalEmployees}
            <div class="absolute top-2 right-2 bg-indigo-400/50 text-white text-[9px] px-1.5 py-0.5 rounded font-black shadow-sm">
                #{data.rankThiDua}/{data.totalEmployees}
            </div>
        {/if}
    </div>

</div>