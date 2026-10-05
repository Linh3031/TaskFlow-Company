import { db } from '../lib/firebase';
import { doc, deleteDoc, updateDoc, query, collection, where, getDocs, serverTimestamp, deleteField } from 'firebase/firestore';

export const accountService = {
    async loadAccountList(sid) {
        if (!sid) return [];
        const q = query(collection(db, 'users'), where('storeIds', 'array-contains', sid));
        const snap = await getDocs(q);
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        const roleOrder = { 'super_admin': 0, 'admin': 1, 'staff': 2, 'pg': 3 };
        return list.sort((a, b) => {
            const rA = roleOrder[a.role] ?? 99;
            const rB = roleOrder[b.role] ?? 99;
            if (rA !== rB) return rA - rB;
            return a.username.localeCompare(b.username);
        });
    },

    async deleteAccount(uid) {
        await deleteDoc(doc(db, 'users', uid));
    },

    async changeRole(uid, newRole, editorName = 'System') {
        await updateDoc(doc(db, 'users', uid), { 
            role: newRole,
            lastModifiedBy: editorName,
            lastUpdatedAt: serverTimestamp()
        });
    },

    async resetPassword(uid) {
        await updateDoc(doc(db, 'users', uid), { pass: '123456' });
    },

    // Thêm hàm update tài khoản đa kho an toàn (Gắn Audit Trail)
    async updateAccount(uid, data, editorName = 'System') {
        const safeData = {
            ...data,
            lastModifiedBy: editorName,
            lastUpdatedAt: serverTimestamp()
        };
        await updateDoc(doc(db, 'users', uid), safeData);
    },

    // Lấy các tài khoản đang có MSNV nằm trong danh sách (Firestore giới hạn 30 giá trị mỗi lần hỏi)
    async getAccountsByMaNVs(maNVs) {
        const uniq = [...new Set(maNVs.map(m => String(m).trim()).filter(Boolean))];
        const list = [];
        for (let i = 0; i < uniq.length; i += 30) {
            const q = query(collection(db, 'users'), where('maNV', 'in', uniq.slice(i, i + 30)));
            const snap = await getDocs(q);
            snap.forEach(d => list.push({ ...d.data(), id: d.id }));
        }
        return list;
    },

    // Tìm tài khoản khác có cùng MSNV và có chung ít nhất 1 kho. Trả về null nếu không trùng.
    async findMaNVConflict(maNV, storeIds, excludeIds = []) {
        const accounts = await accountService.getAccountsByMaNVs([maNV]);
        const stores = (storeIds || []).map(s => String(s).trim().toUpperCase());
        for (const acc of accounts) {
            if (excludeIds.includes(acc.id) || (acc.username_idx && excludeIds.includes(acc.username_idx))) continue;
            const accStores = acc.storeIds || (acc.storeId ? [acc.storeId] : []);
            const commonStore = accStores.find(s => stores.includes(String(s).trim().toUpperCase()));
            if (commonStore) return { ...acc, commonStore };
        }
        return null;
    },

    // Lưu MSNV cho 1 tài khoản, chuỗi rỗng = xoá MSNV
    async updateMaNV(uid, maNV) {
        await updateDoc(doc(db, 'users', uid), { maNV: maNV ? maNV : deleteField() });
    }
};