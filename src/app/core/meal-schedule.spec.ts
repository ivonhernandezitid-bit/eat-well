import { mealScheduleError, MealSchedule, shiftMealTime } from './meal-schedule';

describe('mealScheduleError', () => {
  const orderedSchedule: MealSchedule = {
    breakfastTime: '07:00',
    morningSnackTime: '10:00',
    lunchTime: '13:00',
    afternoonSnackTime: '16:00',
    dinnerTime: '19:00',
  };

  it('accepts meal times in strict chronological order', () => {
    expect(mealScheduleError(orderedSchedule)).toBeNull();
  });

  describe('shiftMealTime', () => {
    it('shifts a valid time by a whole number of minutes', () => {
      expect(shiftMealTime('10:30', 1)).toBe('10:31');
      expect(shiftMealTime('10:30', -1)).toBe('10:29');
    });

    it('returns null when the time or resulting day boundary is invalid', () => {
      expect(shiftMealTime('24:00', 1)).toBeNull();
      expect(shiftMealTime('00:00', -1)).toBeNull();
      expect(shiftMealTime('23:59', 1)).toBeNull();
    });
  });

  it('rejects a meal scheduled before the previous meal', () => {
    expect(mealScheduleError({ ...orderedSchedule, lunchTime: '09:00' }))
      .toBe('El horario ingresado no es válido. La hora de Comida debe ser posterior a la hora de Colación matutina previa.');
  });

  it('rejects equal meal times', () => {
    expect(mealScheduleError({ ...orderedSchedule, dinnerTime: '16:00' }))
      .toBe('El horario ingresado no es válido. La hora de Cena debe ser posterior a la hora de Colación vespertina previa.');
  });

  it('requires a valid time for every meal', () => {
    expect(mealScheduleError({ ...orderedSchedule, breakfastTime: '' }))
      .toBe('Indica una hora válida para cada comida.');
  });
});
