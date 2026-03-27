<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    
    export let filteredAccounts = [];
    export let activeSuperAdmin = false;

    // [NEW] Logic Sort cho Bảng
    let sortField = null; // 'username', 'gender', 'role'
    let sortAsc = true;

    function toggleSort(field) {
        if (sortField === field) sortAsc = !sortAsc;
        else { sortField = field; sortAsc = true; }
    }

    $: sortedAccounts = [...filteredAccounts].sort((a, b) => {
        if (!sortField) return 0;
        let valA = String(a[sortField] || '').toLowerCase();
        let valB = String(b[sortField] || '').toLowerCase();
        
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
    });
</script>

<div id="accounts-table" class="flex-1 overflow-auto relative bg-slate-50/50">
    <table class="w-full text-sm text-left border-collapse">
        <thead class="bg-white text-slate-500 font-bold sticky top-0 z-10 shadow-sm border-b border-slate-200">
            <tr>
                <th class="p-3 border-b border-slate-200 w-1/3 cursor-pointer hover:bg-slate-50 transition-colors" on:click={() => toggleSort('username')}>
                    <div class="flex items-center gap-1">Tài Khoản / Tên {sortField==='username'?(sortAsc?'▲':'▼'):'↕'}</div>
                </th>
                <th class="p-3 border-b border-slate-200 w-1/6 cursor-pointer hover:bg-slate-50 transition-colors" on:click={() => toggleSort('gender')}>
                    <div class="flex items-center gap-1">Giới Tính {sortField==='gender'?(sortAsc?'▲':'▼'):'↕'}</div>
                </th>
                <th class="p-3 border-b border-slate-200 w-1/4 cursor-pointer hover:bg-slate-50 transition-colors" on:click={() => toggleSort('role')}>
                    <div class="flex items-center gap-1">Quyền Hạn {sortField==='role'?(sortAsc?'▲':'▼'):'↕'}</div>
                </th>
                <th class="p-3 border-b border-slate-200 text-center">Thao Tác</th>
            </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
            {#each sortedAccounts as acc}
                <tr class="hover:bg-indigo-50/40 transition-colors group bg-white">
                    <td class="p-3">
                        <div class="font-bold text-slate-800">{acc.username}</div>
                        {#if acc.name}
                            <div class="text-[11px] text-gray-500 font-medium">{acc.name}</div>
                        {:else}
                            <div class="text-[10px] text-red-500 font-bold bg-red-50 inline-block px-1.5 py-0.5 rounded border border-red-200 mt-0.5 animate-pulse">Chưa có tên hiển thị</div>
                        {/if}

                        {#if acc.role === 'pg'}
                            <div class="text-[10px] text-pink-600 font-semibold mt-0.5 bg-pink-50 inline-block px-1.5 py-0.5 rounded border border-pink-100">{acc.brand} | {acc.category}</div>
                        {/if}
                        {#if acc.storeIds && acc.storeIds.length > 1}
                            <div class="text-[10px] text-indigo-600 font-semibold mt-0.5 bg-indigo-50 inline-block px-1.5 py-0.5 rounded border border-indigo-100" title={acc.storeIds.join(', ')}>Đa kho: {acc.storeIds.length} kho</div>
                        {/if}
                    </td>
                    <td class="p-3">
                        {#if acc.gender}
                            <span class="font-bold text-[13px] px-2 py-0.5 rounded {acc.gender === 'Nam' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}">{acc.gender}</span>
                        {:else}
                            <span class="inline-block bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-200 text-[10px] font-black animate-pulse">Thiếu</span>
                        {/if}
                    </td>
                    <td class="p-3">
                        <select class="bg-transparent text-xs font-bold py-1 px-2 rounded border border-transparent hover:border-slate-300 {acc.role==='admin'?'text-purple-700 bg-purple-50':(acc.role==='super_admin'?'text-red-700 bg-red-50':(acc.role==='pg'?'text-pink-700 bg-pink-50':'text-blue-700 bg-blue-50'))}" value={acc.role} on:change={(e) => dispatch('changeRole', { id: acc.id, role: e.target.value })}>
                            <option value="staff">Nhân viên</option>
                            <option value="admin">Quản lý</option>
                            <option value="pg">PG</option>
                            {#if activeSuperAdmin}<option value="super_admin">Super Admin</option>{/if}
                        </select>
                    </td>
                    <td class="p-3 text-center align-middle">
                        <div class="flex justify-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            <button class="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-blue-50 text-slate-500 hover:text-blue-600 shadow-sm" on:click={() => dispatch('edit', acc)} title="Sửa tài khoản"><span class="material-icons-round text-sm">edit</span></button>
                            <button class="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-yellow-50 text-slate-500 hover:text-yellow-600 shadow-sm" on:click={() => dispatch('resetPass', acc.id)} title="Reset Mật khẩu"><span class="material-icons-round text-sm">lock_reset</span></button>
                            <button class="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-red-50 text-slate-500 hover:text-red-600 shadow-sm" on:click={() => dispatch('delete', acc.id)} title="Xóa tài khoản"><span class="material-icons-round text-sm">delete</span></button>
                        </div>
                    </td>
                </tr>
            {/each}
            {#if sortedAccounts.length === 0}
                <tr>
                    <td colspan="4" class="p-12 text-center">
                        <span class="material-icons-round text-4xl text-slate-200 mb-2 block">person_off</span>
                        <span class="text-slate-400 font-bold text-sm">Không có dữ liệu phù hợp với bộ lọc.</span>
                    </td>
                </tr>
            {/if}
        </tbody>
    </table>
</div>