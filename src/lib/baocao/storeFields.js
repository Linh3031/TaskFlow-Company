// Mục tuỳ chỉnh dùng chung cho cả kho (admin thêm) — lưu ở stores/{storeId}/settings/baoCaoConfig
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';

const configRef = (storeId) => doc(db, 'stores', storeId, 'settings', 'baoCaoConfig');

// Nghe danh sách mục của kho; trả hàm huỷ nghe
export function listenStoreFields(storeId, callback) {
    if (!storeId) { callback([]); return () => {}; }
    return onSnapshot(configRef(storeId), (snap) => {
        const list = snap.exists() ? snap.data().customFields : [];
        callback(Array.isArray(list) ? list : []);
    }, (err) => {
        console.error('[baocao] Lỗi tải mục chung của kho', err);
        callback([]);
    });
}

export function addStoreField(storeId, field, username) {
    return setDoc(configRef(storeId), {
        customFields: arrayUnion(field),
        updatedBy: username || '',
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

// Ghi lại cả danh sách sau khi bỏ mục (lọc theo id)
export function removeStoreField(storeId, currentFields, fieldId, username) {
    return setDoc(configRef(storeId), {
        customFields: currentFields.filter(f => f.id !== fieldId),
        updatedBy: username || '',
        updatedAt: serverTimestamp(),
    }, { merge: true });
}
