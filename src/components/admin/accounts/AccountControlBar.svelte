<script>
    export let roleTab = 'ALL';
    export let searchQuery = '';
</script>

<div class="p-3 bg-white border-b border-slate-200 shrink-0 flex flex-col sm:flex-row justify-between items-center gap-3">
    <div class="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto shadow-inner border border-slate-200 overflow-x-auto hide-scrollbar">
        <button class="px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap {roleTab === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}" on:click={() => roleTab = 'ALL'}>Tất Cả</button>
        <button class="px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap {roleTab === 'admin' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}" on:click={() => roleTab = 'admin'}>Quản lý</button>
        <button class="px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap {roleTab === 'staff' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}" on:click={() => roleTab = 'staff'}>Nhân viên</button>
        <button class="px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap {roleTab === 'pg' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}" on:click={() => roleTab = 'pg'}>PG</button>
    </div>

    <div class="relative w-full sm:max-w-xs">
        <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
        <input type="text" bind:value={searchQuery} placeholder="Tìm User hoặc Tên hiển thị..." class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors shadow-sm">
    </div>
</div>

<style>
    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>