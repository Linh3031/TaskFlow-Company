// src/lib/shiftConstants.js

export const SHIFT_DEFINITIONS = [
    // Ca Chuẩn
    { code: '123', label: 'Ca Sáng (1+2+3)', time: '08:00 - 15:00', hours: 7, group: 'SANG' },
    { code: '456', label: 'Ca Chiều (4+5+6)', time: '15:00 - 22:00', hours: 6.5, group: 'CHIEU' },
    { code: '23', label: 'Ca Trưa (2+3)', time: '09:00 - 15:00', hours: 6, group: 'SANG' },
    { code: '45', label: 'Ca Chiều Lửng (4+5)', time: '15:00 - 21:00', hours: 6, group: 'CHIEU' },
    { code: '2-5', label: 'Ca Gãy (2+5)', time: '09:00-12:00 & 18:00-21:00', hours: 6, group: 'GAY' },
    { code: '2345', label: 'Giao Hàng Full', time: '09:00 - 21:00', hours: 12, group: 'FULL' },
    
    // Ca Siêu Cường & Đặc Biệt
    { code: '123456', label: 'Full Ngày Đêm', time: '08:00 - 22:00', hours: 13.5, group: 'EXTREME' },
    { code: '12-56', label: 'Sáng Sớm + Tối Muộn', time: '08:00-12:00 & 18:00-22:00', hours: 8, group: 'EXTREME' },
    { code: '12-456', label: 'Sáng Sớm + Chiều Full', time: '08:00-12:00 & 15:00-22:00', hours: 11, group: 'EXTREME' },
    { code: '123-56', label: 'Sáng Full + Tối Muộn', time: '08:00-15:00 & 18:00-22:00', hours: 11, group: 'EXTREME' },
    { code: '12345', label: 'Sáng Cường Lực', time: '08:00 - 21:00', hours: 13, group: 'EXTREME' },
    { code: '23456', label: 'Chiều Cường Lực', time: '09:00 - 22:00', hours: 13, group: 'EXTREME' }
];

export const BASE_HOURS = { '1': 1, '2': 3, '3': 3, '4': 3, '5': 3, '6': 0.5 };
export const SHIFT_INFO = {};
SHIFT_DEFINITIONS.forEach(s => SHIFT_INFO[s.code] = { h: s.hours, group: s.group });
SHIFT_INFO['OFF'] = { h: 0, group: 'OFF' };

export const ROLE_MAP = { 'Thu Ngân': 'tn', 'TN': 'tn', 'Kho': 'kho', 'K': 'kho', 'Giao Hàng': 'gh', 'GH': 'gh', 'Tư Vấn': 'tv', 'TV': 'tv', '': 'tv' };
export const DISPLAY_ROLE_MAP = { 'tn': 'Thu Ngân', 'kho': 'Kho', 'gh': 'Giao Hàng', 'tv': '' };
export const HARD_ROLES = ['gh', 'kho', 'tn'];