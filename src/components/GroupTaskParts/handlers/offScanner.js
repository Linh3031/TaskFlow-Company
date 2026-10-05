import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// [CodeGenesis v2] Thuật toán quét kép (Dual-Engine Scan) - trả về Set id/username (lowercase) đang OFF trong ngày
export async function scanOffUserIds(storeId, dateStr, roleType) {
  const newOffSet = new Set();
  if (!storeId) return newOffSet;

  const targetDate = dateStr ? new Date(dateStr) : new Date();
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  const day = targetDate.getDate();

  // 1. QUÉT LỊCH PG (Lưu theo Tuần YYYY-Wxx, key thứ 'T2' -> 'CN')
  if (roleType === 'ALL' || roleType === 'PG') {
    const d = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    const weekId = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

    const daysMap = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dayStr = daysMap[targetDate.getDay()];

    const pgSnap = await getDoc(doc(db, 'stores', storeId, 'pg_schedules', weekId));
    if (pgSnap.exists()) {
      const pgData = pgSnap.data().data || {};
      for (const [pgId, shifts] of Object.entries(pgData)) {
        if (shifts && shifts[dayStr] === 'OFF') {
          newOffSet.add(String(pgId).toLowerCase());
        }
      }
    }
  }

  // 2. QUÉT LỊCH NHÂN VIÊN KHO (Lưu theo Tháng YYYY-MM, key ngày trong tháng '1' -> '31')
  if (roleType === 'ALL' || roleType === 'STAFF') {
    const monthStrPadded = `${year}-${String(month).padStart(2, '0')}`;
    const monthStrNormal = `${year}-${month}`;

    let staffSnap = await getDoc(doc(db, 'stores', storeId, 'schedules', monthStrPadded));
    if (!staffSnap.exists() && monthStrPadded !== monthStrNormal) {
      staffSnap = await getDoc(doc(db, 'stores', storeId, 'schedules', monthStrNormal));
    }

    if (staffSnap.exists()) {
      const scheduleData = staffSnap.data().data || {};
      const dayAssignments = scheduleData[String(day)] || scheduleData[day] || [];
      dayAssignments.forEach(assign => {
        if (assign && assign.shift === 'OFF') {
          if (assign.staffId) newOffSet.add(String(assign.staffId).toLowerCase());
          if (assign.username) newOffSet.add(String(assign.username).toLowerCase());
        }
      });
    }
  }

  return newOffSet;
}

// Kiểm tra 1 user có nằm trong Set OFF không (khớp theo id hoặc username)
export function isUserOff(u, offSet) {
  const uid = String(u.id || '').toLowerCase();
  const uname = String(u.username || '').toLowerCase();
  return offSet.has(uid) || offSet.has(uname);
}
