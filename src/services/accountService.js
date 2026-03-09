import { db } from '../lib/firebase';
import { doc, deleteDoc, updateDoc, query, collection, where, getDocs, serverTimestamp } from 'firebase/firestore';

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
    }
};