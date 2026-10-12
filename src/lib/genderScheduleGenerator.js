// src/lib/genderScheduleGenerator.js
// Phân ca theo Nam/Nữ: định mức khai báo theo dòng Nam, Nữ, Giao Hàng (Giao Hàng luôn là Nam).
// Mỗi ngày: chọn người đi làm theo giờ công (ai ít giờ hơn đi làm trước), giao Giao Hàng cho Nam,
// xếp ca Sáng/Chiều sao cho không trùng nhóm ca liên tục nhiều ngày - tối ưu cùng lúc cho cả nhóm.
import { DISPLAY_ROLE_MAP } from './shiftConstants.js';
import { getDynamicShiftInfo } from './scheduleGenerator.js';

function normalizeGenderRole(role) {
    const s = String(role || '').trim().toLowerCase();
    if (s === 'nam') return 'nam';
    if (s === 'nữ' || s === 'nu') return 'nu';
    if (s === 'gh' || s.includes('giao')) return 'gh';
    return null;
}

// Gộp combo Nam + Nữ thành TV để lưu vào config lịch (phục vụ cảnh báo định mức khi sửa ca sau này)
export function genderCombosToRoleCombos(combos) {
    const map = {};
    (combos || []).forEach(c => {
        const r = normalizeGenderRole(c.role);
        if (!r) return;
        const role = r === 'gh' ? 'GH' : 'TV';
        const key = `${c.code}|${role}`;
        if (!map[key]) map[key] = { code: String(c.code), role, qty: 0 };
        map[key].qty += parseInt(c.qty) || 0;
    });
    return Object.values(map).filter(c => c.qty > 0);
}

// Đếm số slot Nam (gồm Giao Hàng) và Nữ của 1 bộ combo
export function countGenderDemand(combos) {
    let male = 0, female = 0;
    (combos || []).forEach(c => {
        const r = normalizeGenderRole(c.role);
        const qty = parseInt(c.qty) || 0;
        if (r === 'nam' || r === 'gh') male += qty;
        else if (r === 'nu') female += qty;
    });
    return { male, female };
}

const ROTATION_GROUPS = ['SANG', 'CHIEU'];
const getGroup = (code) => getDynamicShiftInfo(code).group;

// Ghép n người với n vị trí sao cho tổng chi phí nhỏ nhất (thuật toán Hungarian)
function solveAssignment(cost) {
    const n = cost.length;
    const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0);
    const p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
        p[0] = i;
        let j0 = 0;
        const minv = new Array(n + 1).fill(Infinity);
        const used = new Array(n + 1).fill(false);
        do {
            used[j0] = true;
            const i0 = p[j0];
            let delta = Infinity, j1 = 0;
            for (let j = 1; j <= n; j++) {
                if (used[j]) continue;
                const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
                if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
                if (minv[j] < delta) { delta = minv[j]; j1 = j; }
            }
            for (let j = 0; j <= n; j++) {
                if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
                else minv[j] -= delta;
            }
            j0 = j1;
        } while (p[j0] !== 0);
        do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const ans = new Array(n);
    for (let j = 1; j <= n; j++) if (p[j]) ans[p[j] - 1] = j - 1;
    return ans;
}

export function generateGenderSchedule(originalStaffList, comboData, month, year, prevScheduleData = null, pastThreeMonthsData = []) {
    const daysInMonth = new Date(year, month, 0).getDate();
    let warnings = [];

    const weekdayCombos = Array.isArray(comboData) ? comboData : (comboData.weekday || []);
    const weekendCombos = Array.isArray(comboData) ? comboData : (comboData.weekend || []);

    let staffList = originalStaffList.map((s, index) => ({
        id: s.id, name: s.name, gender: s.gender, index,
        isMale: (s.gender || '').trim().toLowerCase() === 'nam',
        lastShiftCode: 'OFF', sameGroupRun: 0,
        lastGhDay: -10, ghThisWeek: 0, weekendGhCount: 0,
        stats: { hours: 0, sang: 0, chieu: 0, roles: { tn: 0, tv: 0, kho: 0, gh: 0 } },
        baseStats: { gh: 0, weekendHardRoleCount: 0 }
    }));

    // Nợ ca 3 tháng trước (Giao Hàng + nghiệp vụ cuối tuần)
    (pastThreeMonthsData || []).forEach(pastMonth => {
        (pastMonth.stats || []).forEach(st => {
            const staff = staffList.find(s => s.id === st.id);
            if (!staff) return;
            staff.baseStats.gh += parseInt(st.gh) || 0;
            staff.baseStats.weekendHardRoleCount += parseInt(st.weekendHardRoles) || 0;
        });
    });

    // Nối tiếp cuối tháng trước: ca hôm qua, số ngày liên tiếp cùng nhóm ca, Giao Hàng hôm qua
    if (prevScheduleData && prevScheduleData.data) {
        const days = Object.keys(prevScheduleData.data).map(Number).sort((a, b) => b - a);
        if (days.length > 0) {
            (prevScheduleData.data[String(days[0])] || []).forEach(assign => {
                const staff = staffList.find(s => s.id === assign.staffId);
                if (!staff) return;
                staff.lastShiftCode = assign.shift || 'OFF';
                if (assign.role === 'Giao Hàng' || assign.role === 'GH') staff.lastGhDay = 0;
                const g = getGroup(staff.lastShiftCode);
                if (!ROTATION_GROUPS.includes(g)) return;
                let run = 0;
                for (const day of days) {
                    const a = (prevScheduleData.data[String(day)] || []).find(x => x.staffId === staff.id);
                    if (a && a.shift && getGroup(a.shift) === g) run++;
                    else break;
                }
                staff.sameGroupRun = run;
            });
        }
    }

    const buildSlots = (combos) => {
        const male = [], female = [];
        combos.forEach(c => {
            const r = normalizeGenderRole(c.role);
            const qty = parseInt(c.qty) || 0;
            for (let i = 0; i < qty; i++) {
                if (r === 'gh') male.push({ code: String(c.code), role: 'gh' });
                else if (r === 'nam') male.push({ code: String(c.code), role: 'tv' });
                else if (r === 'nu') female.push({ code: String(c.code), role: 'tv' });
            }
        });
        // Giao Hàng xếp trước
        male.sort((a, b) => (a.role === 'gh' ? 0 : 1) - (b.role === 'gh' ? 0 : 1));
        return { male, female };
    };

    const weekdaySlots = buildSlots(weekdayCombos);
    const weekendSlots = buildSlots(weekendCombos);

    const males = staffList.filter(s => s.isMale);
    const females = staffList.filter(s => !s.isMale);

    const checkShortage = (slots, label) => {
        if (slots.male.length > males.length) warnings.push(`THIẾU NHÂN SỰ NAM (${label}): Cần ${slots.male.length} (gồm Giao Hàng), chỉ có ${males.length}. Các vị trí thừa bị bỏ trống.`);
        if (slots.female.length > females.length) warnings.push(`THIẾU NHÂN SỰ NỮ (${label}): Cần ${slots.female.length}, chỉ có ${females.length}. Các vị trí thừa bị bỏ trống.`);
    };
    checkShortage(weekdaySlots, 'Thứ 2 - 6');
    checkShortage(weekendSlots, 'T7 & CN');

    const monthOffset = staffList.length > 0 ? (year * 12 + month) % staffList.length : 0;

    // Phạt khi lặp lại cùng nhóm ca (Sáng/Chiều) với hôm qua; lặp càng nhiều ngày phạt càng nặng
    const rotationCost = (p, code) => {
        const g = getGroup(code);
        let cost = 0;
        if (ROTATION_GROUPS.includes(g) && g === getGroup(p.lastShiftCode)) cost += 100000 * Math.max(1, p.sameGroupRun);
        if (g === 'SANG') cost += (p.stats.sang - p.stats.chieu) * 100;
        if (g === 'CHIEU') cost += (p.stats.chieu - p.stats.sang) * 100;
        return cost;
    };

    const ghCost = (p, code, d, isWeekend) => {
        let cost = 0;
        if (d - p.lastGhDay <= 1) cost += 1000000000; // Không Giao Hàng 2 ngày liền
        if (p.ghThisWeek >= 3) cost += 20000000;       // Giãn Giao Hàng theo tuần
        cost += (p.baseStats.gh + p.stats.roles.gh) * 10000000; // Cân bằng số ca Giao Hàng
        if (isWeekend) cost += (p.baseStats.weekendHardRoleCount + p.weekendGhCount) * 15000000; // Công bằng cuối tuần
        cost += rotationCost(p, code);
        return cost;
    };

    // Xếp ca cho 1 nhóm (Nam hoặc Nữ) trong 1 ngày: tối ưu cùng lúc ai nghỉ, ai Giao Hàng, ai ca Sáng/Chiều
    const assignGroup = (people, slots, d, isWeekend, result) => {
        const n = people.length;
        if (n === 0) return;
        const rot = (p) => (p.index + monthOffset + d) % n;
        const minHours = Math.min(...people.map(p => p.stats.hours));

        // Thiếu người thì giữ Giao Hàng trước (slots đã xếp GH lên đầu), phần còn lại là OFF
        const daySlots = slots.slice(0, n);
        while (daySlots.length < n) daySlots.push({ code: 'OFF', role: 'tv' });

        const cost = people.map(p => daySlots.map(slot => {
            if (slot.code === 'OFF') return 0;
            // Ai đã làm nhiều giờ hơn thì ưu tiên nghỉ (~7 giờ lệch < 1 lần trùng ca)
            let c = (p.stats.hours - minHours) * 5000 + rot(p) * 10;
            c += slot.role === 'gh' ? ghCost(p, slot.code, d, isWeekend) : rotationCost(p, slot.code);
            return c;
        }));

        const assignment = solveAssignment(cost);
        people.forEach((p, i) => {
            const slot = daySlots[assignment[i]];
            result[p.id] = { shift: slot.code, role: slot.code === 'OFF' ? 'tv' : slot.role };
        });
    };

    let schedule = {};
    for (let d = 1; d <= daysInMonth; d++) {
        const dayOfWeek = new Date(year, month - 1, d).getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

        if (dayOfWeek === 1 || d === 1) staffList.forEach(s => s.ghThisWeek = 0);

        const slots = isWeekend ? weekendSlots : weekdaySlots;
        const result = {};
        assignGroup(males, slots.male, d, isWeekend, result);
        assignGroup(females, slots.female, d, isWeekend, result);

        schedule[d] = staffList.map(staff => {
            const a = result[staff.id] || { shift: 'OFF', role: 'tv' };
            const g = getGroup(a.shift);
            if (ROTATION_GROUPS.includes(g) && g === getGroup(staff.lastShiftCode)) staff.sameGroupRun++;
            else staff.sameGroupRun = ROTATION_GROUPS.includes(g) ? 1 : 0;
            staff.lastShiftCode = a.shift;

            if (a.shift !== 'OFF') {
                staff.stats.hours += getDynamicShiftInfo(a.shift).h;
                if (g === 'SANG') staff.stats.sang++;
                if (g === 'CHIEU') staff.stats.chieu++;
                staff.stats.roles[a.role]++;
                if (a.role === 'gh') {
                    staff.lastGhDay = d;
                    staff.ghThisWeek++;
                    if (isWeekend) staff.weekendGhCount++;
                }
            }

            return {
                staffId: staff.id, name: staff.name, gender: staff.gender,
                shift: a.shift,
                role: DISPLAY_ROLE_MAP[a.role] || '',
                originalShift: a.shift,
                originalRole: DISPLAY_ROLE_MAP[a.role] || '',
                rawRole: a.role
            };
        });
    }

    const finalStaffStats = staffList.map(s => ({
        id: s.id, name: s.name, gender: s.gender,
        totalHours: Math.round(s.stats.hours),
        gh: s.stats.roles.gh, tn: 0, kho: 0,
        weekendHardRoles: s.weekendGhCount
    }));

    const maleStats = finalStaffStats.filter(s => (s.gender || '').trim().toLowerCase() === 'nam');
    if (maleStats.length > 0) {
        const counts = maleStats.map(s => s.gh);
        const min = Math.min(...counts);
        const max = Math.max(...counts);
        if (max - min > 2) {
            const maxNames = maleStats.filter(s => s.gh === max).map(s => `${s.name}(${max})`).join(', ');
            const minNames = maleStats.filter(s => s.gh === min).map(s => `${s.name}(${min})`).join(', ');
            warnings.push(`CẢNH BÁO LỆCH GH: Max=${max}, Min=${min}. [Thừa: ${maxNames}] - [Thiếu: ${minNames}]`);
        }
    }

    return { schedule, staffStats: finalStaffStats, endOffset: 0, warnings };
}
