// src/lib/scheduleLogic.js
// Version 38.0 - Architecture: Refactored into specialized modules (Facade Pattern)

import { SHIFT_DEFINITIONS } from './shiftConstants.js';
import { calculateCombosFromMatrix, suggestPeakCombos } from './comboCalculator.js';
import { getDynamicShiftInfo, generateMonthlySchedule } from './scheduleGenerator.js';

export {
    SHIFT_DEFINITIONS,
    calculateCombosFromMatrix,
    suggestPeakCombos,
    getDynamicShiftInfo,
    generateMonthlySchedule
};