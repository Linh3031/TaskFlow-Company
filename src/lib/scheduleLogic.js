// src/lib/scheduleLogic.js
// Version 38.0 - Architecture: Refactored into specialized modules (Facade Pattern)

import { SHIFT_DEFINITIONS } from './shiftConstants.js';
import { calculateCombosFromMatrix, calculateGenderCombosFromMatrix, suggestPeakCombos } from './comboCalculator.js';
import { getDynamicShiftInfo, generateMonthlySchedule } from './scheduleGenerator.js';
import { generateGenderSchedule, genderCombosToRoleCombos, countGenderDemand } from './genderScheduleGenerator.js';

export {
    SHIFT_DEFINITIONS,
    calculateCombosFromMatrix,
    calculateGenderCombosFromMatrix,
    suggestPeakCombos,
    getDynamicShiftInfo,
    generateMonthlySchedule,
    generateGenderSchedule,
    genderCombosToRoleCombos,
    countGenderDemand
};