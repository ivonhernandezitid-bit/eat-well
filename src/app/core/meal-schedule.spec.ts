import { mealScheduleError, MealSchedule } from './meal-schedule';

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
