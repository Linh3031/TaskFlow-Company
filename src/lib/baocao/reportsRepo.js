// Đơn đã báo cáo lưu trên Firestore để admin xem được cả kho.
// Mỗi nhân viên mỗi ngày = 1 document: stores/{storeId}/baocao_days/{YYYY-MM-DD}__{uid}, field `orders` là mảng đơn.
// Truy vấn chỉ dùng documentId 'in' (nhân viên) hoặc khoảng `date` (admin) → không cần composite index.
import { db } from '../firebase';
import { collection, doc, query, where, documentId, onSnapshot, getDocs, setDoc, arrayUnion, runTransaction, serverTimestamp } from 'firebase/firestore';
import { localDateKey } from './streak.js';

const daysCol = (storeId) => collection(db, 'stores', storeId, 'baocao_days');
const dayDocId = (date, uid) => `${date}__${uid}`;

function ordersOf(snap) {
    return snap.docs.flatMap(d => {
        const orders = d.data().orders;
        return Array.isArray(orders) ? orders : [];
    });
}

// Danh sách ngày YYYY-MM-DD từ `from` đến `to` (gồm cả 2 đầu)
export function dateKeysBetween(from, to) {
    const out = [];
    const [y, m, d] = from.split('-').map(Number);
    const cur = new Date(y, m - 1, d);
    while (localDateKey(cur) <= to) {
        out.push(localDateKey(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return out;
}

// Nghe đơn của 1 nhân viên trong các ngày cho trước (chia lô 30 vì giới hạn 'in'); trả hàm huỷ nghe
export function listenOwnReports(storeId, uid, dates, callback) {
    if (!storeId || !uid || dates.length === 0) { callback([]); return () => {}; }
    const chunks = [];
    for (let i = 0; i < dates.length; i += 30) chunks.push(dates.slice(i, i + 30).map(d => dayDocId(d, uid)));
    const parts = chunks.map(() => []);
    const unsubs = chunks.map((ids, idx) => onSnapshot(query(daysCol(storeId), where(documentId(), 'in', ids)), (snap) => {
        parts[idx] = ordersOf(snap);
        callback(parts.flat());
    }, (err) => console.error('[baocao] Lỗi tải đơn của nhân viên', err)));
    return () => unsubs.forEach(u => u());
}

// Admin: nghe đơn của cả kho trong khoảng ngày
export function listenStoreReports(storeId, from, to, callback) {
    if (!storeId) { callback([]); return () => {}; }
    return onSnapshot(query(daysCol(storeId), where('date', '>=', from), where('date', '<=', to)), (snap) => {
        callback(ordersOf(snap));
    }, (err) => console.error('[baocao] Lỗi tải đơn của kho', err));
}

// Tải 1 ngày nằm ngoài khoảng đang nghe (lọc ngày cũ ở Nhật ký)
export async function fetchDay(storeId, date, uid, isAdmin) {
    if (!storeId || !date) return [];
    const q = isAdmin
        ? query(daysCol(storeId), where('date', '==', date))
        : query(daysCol(storeId), where(documentId(), '==', dayDocId(date, uid)));
    return ordersOf(await getDocs(q));
}

export function saveReport(storeId, uid, report) {
    return setDoc(doc(daysCol(storeId), dayDocId(report.date, uid)), {
        storeId,
        date: report.date,
        username: uid,
        staffName: report.staffName || '',
        orders: arrayUnion(report),
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

// Xoá 1 đơn khỏi document ngày của chính nhân viên đó
export function deleteReport(storeId, uid, report) {
    const ref = doc(daysCol(storeId), dayDocId(report.date, uid));
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const orders = (snap.data().orders || []).filter(o => o.id !== report.id);
        tx.update(ref, { orders, updatedAt: serverTimestamp() });
    });
}
