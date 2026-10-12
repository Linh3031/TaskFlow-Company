// src/lib/shiftSwapRequest.js
// ĐĂNG KÝ ĐỔI CA: NV A tạo phiếu -> NV B đồng ý -> Quản lý (admin/super_admin của kho) duyệt -> mới đổi trên lịch chính thức.
// Chỉ đổi giữa 2 người cùng ngày, KHÁC ca, không ai đang OFF. Đổi luôn cả vai trò (TV/GH/TN/Kho).
import { db } from './firebase';
import { collection, doc, addDoc, getDoc, getDocs, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import { applyShiftSwapLocalData, findMyStatRowId } from './shiftUtils.js';
import { sendNotifications } from './notificationService.js';

export const SWAP_COLLECTION = 'shift_swap_requests';
export const SWAP_STATUS = {
    PENDING_TARGET: 'pending_target',
    PENDING_MANAGER: 'pending_manager',
    APPROVED: 'approved',
    REJECTED_TARGET: 'rejected_target',
    REJECTED_MANAGER: 'rejected_manager'
};
const OPEN_STATUSES = [SWAP_STATUS.PENDING_TARGET, SWAP_STATUS.PENDING_MANAGER];

export const SWAP_STATUS_LABEL = {
    pending_target: 'Chờ nhân viên được đổi xác nhận',
    pending_manager: 'Chờ quản lý duyệt',
    approved: 'Đã duyệt - đã đổi trên lịch',
    rejected_target: 'Nhân viên được đổi đã từ chối',
    rejected_manager: 'Quản lý đã từ chối'
};

const normRole = (r) => (!r || r === 'TV') ? '' : r;
const isGH = (r) => r === 'GH' || r === 'Giao Hàng';
const sameName = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

export function roleLabel(role) {
    const r = normRole(role);
    if (!r) return 'Tư vấn';
    if (isGH(r)) return 'Giao hàng';
    if (r === 'TN' || r === 'Thu Ngân') return 'Thu ngân';
    if (r === 'Kho' || r === 'K') return 'Kho';
    return r;
}

export function dayLabel(day, monthStr) {
    const mm = String(monthStr || '').split('-')[1] || '';
    return mm ? `${day}/${mm}` : `${day}`;
}

// Dòng lịch của chính user: ưu tiên khớp chính xác mã tài khoản, không có mới dò theo tên như nút "Tìm tôi"
export function findMyStaffId(user, stats) {
    if (!user || !stats) return null;
    const idx = user.username_idx || String(user.username || '').toLowerCase();
    if (idx && stats.some(s => s.id === idx)) return idx;
    return findMyStatRowId(user, stats);
}

export function isSwapManager(user, storeId) {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    return user.role === 'admin' && (user.storeIds || []).map(String).includes(String(storeId));
}

export function isSwapTarget(user, request) {
    if (!user || !request?.target) return false;
    return sameName(user.username, request.target.username) || (user.username_idx && user.username_idx === request.target.staffId);
}

// Người có thể đổi cùng ngày: khác ca, không OFF. Lịch Nam/Nữ thì chỉ đổi cùng giới (giữ đúng định mức Nam/Nữ)
export function getSwapCandidates(scheduleData, day, myStaffId) {
    return getSwapCandidatesFromDay(scheduleData?.data?.[String(day)] || [], scheduleData?.stats || [], myStaffId, { sameGenderOnly: !!scheduleData?.config?.byGender });
}

const isMale = (g) => String(g || '').trim().toLowerCase() === 'nam';

// allowOff (chỉ Admin): được đổi với người OFF / chuyển ngày OFF của mình sang người đang đi làm
export function getSwapCandidatesFromDay(dayList, stats, myStaffId, { allowOff = false, sameGenderOnly = false } = {}) {
    dayList = dayList || [];
    stats = stats || [];
    const mine = dayList.find(a => a.staffId === myStaffId);
    if (!mine || !mine.shift) return [];
    if (!allowOff && mine.shift === 'OFF') return [];
    const myStat = stats.find(s => s.id === myStaffId);
    const myIsMale = isMale(myStat?.gender || mine.gender);

    const candidates = dayList
        .filter(a => a.staffId !== myStaffId && a.shift && a.shift !== mine.shift && (allowOff || a.shift !== 'OFF'))
        .map(a => {
            const st = stats.find(s => s.id === a.staffId);
            return { staffId: a.staffId, name: st?.name || a.name || a.staffId, gender: st?.gender || a.gender || '', shift: a.shift, role: normRole(a.role), totalHours: Number(st?.totalHours) || 0 };
        })
        .filter(c => !sameGenderOnly || isMale(c.gender) === myIsMale);

    // Chuyển ngày OFF sang người khác: gợi ý người nhiều giờ công nhất lên đầu (người cần nghỉ nhất)
    if (mine.shift === 'OFF') candidates.sort((a, b) => b.totalHours - a.totalHours);
    return candidates;
}

// Phiếu đang chờ (chưa xong) trong tháng của kho
export async function loadOpenSwapRequests(storeId, monthStr) {
    const snap = await getDocs(query(collection(db, SWAP_COLLECTION), where('storeId', '==', storeId), where('monthStr', '==', monthStr)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => OPEN_STATUSES.includes(r.status));
}

export function findOpenRequestFor(openRequests, day, staffId) {
    return (openRequests || []).find(r => Number(r.day) === Number(day) && (r.requester?.staffId === staffId || r.target?.staffId === staffId)) || null;
}

// Cảnh báo NV nữ nhận vị trí Giao hàng (giống cảnh báo khi admin sửa tay)
export function getSwapGenderWarning(request) {
    const A = request?.requester, B = request?.target;
    if (!A || !B) return null;
    if (isGH(A.role) && B.gender !== 'Nam') return `⚠️ CẢNH BÁO: ${B.name} là NỮ nhưng sẽ nhận vị trí Giao Hàng của ${A.name}.\n\nBạn có chắc chắn muốn duyệt không?`;
    if (isGH(B.role) && A.gender !== 'Nam') return `⚠️ CẢNH BÁO: ${A.name} là NỮ nhưng sẽ nhận vị trí Giao Hàng của ${B.name}.\n\nBạn có chắc chắn muốn duyệt không?`;
    return null;
}

async function getStoreManagerUsernames(storeId) {
    const snap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['admin', 'super_admin'])));
    return snap.docs
        .map(d => d.data())
        .filter(u => {
            const ids = (u.storeIds || (u.storeId ? [u.storeId] : [])).map(String);
            return ids.includes(String(storeId));
        })
        .map(u => u.username);
}

// BƯỚC 1: NV A tạo phiếu, báo cho NV B
export async function createSwapRequest({ storeId, monthStr, day, requester, target }) {
    const targetSnap = await getDoc(doc(db, 'users', target.staffId));
    if (!targetSnap.exists()) throw new Error(`${target.name} chưa liên kết tài khoản đăng nhập nên không nhận được thông báo. Vui lòng báo quản lý.`);
    const targetUsername = targetSnap.data().username || target.staffId;

    const open = await loadOpenSwapRequests(storeId, monthStr);
    if (findOpenRequestFor(open, day, requester.staffId)) throw new Error(`Bạn đang có phiếu đổi ca ngày ${dayLabel(day, monthStr)} chưa xử lý xong.`);
    if (findOpenRequestFor(open, day, target.staffId)) throw new Error(`${target.name} đang có phiếu đổi ca khác ngày ${dayLabel(day, monthStr)} chưa xử lý xong.`);

    const ref = await addDoc(collection(db, SWAP_COLLECTION), {
        storeId, monthStr, day: Number(day),
        requester: { staffId: requester.staffId, username: requester.username, name: requester.name, gender: requester.gender || '', shift: requester.shift, role: normRole(requester.role) },
        target: { staffId: target.staffId, username: targetUsername, name: target.name, gender: target.gender || '', shift: target.shift, role: normRole(target.role) },
        status: SWAP_STATUS.PENDING_TARGET,
        createdAt: serverTimestamp()
    });

    await sendNotifications([targetUsername], {
        type: 'swap_request', requestId: ref.id, storeId,
        fromUser: requester.name,
        content: `muốn đổi ca ngày ${dayLabel(day, monthStr)} với bạn: bạn nhận ca ${requester.shift} (${roleLabel(requester.role)}), nhường ca ${target.shift} (${roleLabel(target.role)}). Bấm để xác nhận.`
    });
    return ref.id;
}

// Chuyển trạng thái phiếu an toàn (2 người bấm cùng lúc thì chỉ 1 người thành công)
async function moveStatus(requestId, fromStatus, updates) {
    const reqRef = doc(db, SWAP_COLLECTION, requestId);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(reqRef);
        if (!snap.exists()) throw new Error('Phiếu đổi ca không còn tồn tại.');
        const req = snap.data();
        if (req.status !== fromStatus) throw new Error(`Phiếu đã được xử lý: ${SWAP_STATUS_LABEL[req.status] || req.status}.`);
        tx.update(reqRef, updates);
        return req;
    });
}

// BƯỚC 2: NV B đồng ý / từ chối
export async function respondSwapAsTarget(requestId, accept, actor) {
    const req = await moveStatus(requestId, SWAP_STATUS.PENDING_TARGET, {
        status: accept ? SWAP_STATUS.PENDING_MANAGER : SWAP_STATUS.REJECTED_TARGET,
        targetRespondedAt: serverTimestamp()
    });
    const when = dayLabel(req.day, req.monthStr);

    if (accept) {
        const managers = await getStoreManagerUsernames(req.storeId);
        await sendNotifications(managers, {
            type: 'swap_request', requestId, storeId: req.storeId,
            fromUser: req.requester.name,
            content: `xin đổi ca ngày ${when} với ${req.target.name} (${req.requester.shift} ⇄ ${req.target.shift}), ${req.target.name} đã đồng ý. Bấm để duyệt.`
        });
    } else {
        await sendNotifications([req.requester.username], {
            type: 'swap_result', requestId, storeId: req.storeId,
            fromUser: actor?.name || req.target.name,
            content: `đã TỪ CHỐI đổi ca ngày ${when} với bạn.`
        });
    }
}

// BƯỚC 3: Quản lý duyệt / từ chối. Duyệt = kiểm tra lịch chưa bị đổi rồi mới đảo ca + vai trò của 2 người
export async function respondSwapAsManager(requestId, approve, actor) {
    const managerInfo = { managerName: actor?.name || actor?.username || '', managerUsername: actor?.username || '', managerRespondedAt: serverTimestamp() };
    let req;

    if (!approve) {
        req = await moveStatus(requestId, SWAP_STATUS.PENDING_MANAGER, { status: SWAP_STATUS.REJECTED_MANAGER, ...managerInfo });
    } else {
        const reqRef = doc(db, SWAP_COLLECTION, requestId);
        req = await runTransaction(db, async (tx) => {
            const reqSnap = await tx.get(reqRef);
            if (!reqSnap.exists()) throw new Error('Phiếu đổi ca không còn tồn tại.');
            const r = reqSnap.data();
            if (r.status !== SWAP_STATUS.PENDING_MANAGER) throw new Error(`Phiếu đã được xử lý: ${SWAP_STATUS_LABEL[r.status] || r.status}.`);

            const schedRef = doc(db, 'stores', r.storeId, 'schedules', r.monthStr);
            const schedSnap = await tx.get(schedRef);
            if (!schedSnap.exists()) throw new Error('Không tìm thấy lịch tháng của phiếu này.');
            const scheduleData = schedSnap.data();
            const dayList = scheduleData.data?.[String(r.day)] || [];
            const a = dayList.find(x => x.staffId === r.requester.staffId);
            const b = dayList.find(x => x.staffId === r.target.staffId);
            const unchanged = a && b
                && a.shift === r.requester.shift && normRole(a.role) === r.requester.role
                && b.shift === r.target.shift && normRole(b.role) === r.target.role;
            if (!unchanged) throw new Error(`Ca ngày ${dayLabel(r.day, r.monthStr)} của ${r.requester.name} hoặc ${r.target.name} đã bị thay đổi kể từ lúc đăng ký. Không thể duyệt, vui lòng từ chối phiếu này.`);

            const { dayKey, dayList: newDayList, newStats } = applyShiftSwapLocalData(
                { day: r.day, staffId: r.requester.staffId, shift: b.shift, role: b.role || 'TV', isOFF: false },
                { staffId: r.target.staffId, shift: a.shift, role: a.role || 'TV', isOFF: false },
                scheduleData
            );
            tx.update(schedRef, { [`data.${dayKey}`]: newDayList, stats: newStats });
            tx.update(reqRef, { status: SWAP_STATUS.APPROVED, ...managerInfo });
            return r;
        });
    }

    const when = dayLabel(req.day, req.monthStr);
    await sendNotifications([req.requester.username, req.target.username], {
        type: 'swap_result', requestId, storeId: req.storeId,
        fromUser: actor?.name || 'Quản lý',
        content: approve
            ? `đã DUYỆT đổi ca ngày ${when} giữa ${req.requester.name} và ${req.target.name}. Lịch đã được cập nhật.`
            : `đã TỪ CHỐI đổi ca ngày ${when} giữa ${req.requester.name} và ${req.target.name}.`
    });
}

export async function getSwapRequest(requestId) {
    const snap = await getDoc(doc(db, SWAP_COLLECTION, requestId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
