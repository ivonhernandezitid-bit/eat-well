export const scheduleMeals = [
  { field: 'breakfastTime', label: 'Desayuno' },
  { field: 'morningSnackTime', label: 'Colación matutina' },
  { field: 'lunchTime', label: 'Comida' },
  { field: 'afternoonSnackTime', label: 'Colación vespertina' },
  { field: 'dinnerTime', label: 'Cena' },
] as const;
export interface MealSchedule {
  breakfastTime: string;
  morningSnackTime: string;
  lunchTime: string;
  afternoonSnackTime: string;
  dinnerTime: string;
}
export interface MealScheduleResponse {
  schedule: MealSchedule | null;
  initialCompleted: boolean;
  customized: boolean;
}
export function shiftMealTime(time: string, minutes: number): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match || !Number.isInteger(minutes)) return null;
  const shiftedMinutes = Number(match[1]) * 60 + Number(match[2]) + minutes;
  if (shiftedMinutes < 0 || shiftedMinutes >= 24 * 60) return null;
  return `${String(Math.floor(shiftedMinutes / 60)).padStart(2, '0')}:${String(shiftedMinutes % 60).padStart(2, '0')}`;
}

export function mealScheduleError(schedule: MealSchedule): string | null {
  const times = scheduleMeals.map(meal => schedule[meal.field]);
  if (times.some(time => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return 'Indica una hora válida para cada comida.';
  for (let index = 1; index < scheduleMeals.length; index++) {
    if (times[index] <= times[index - 1]) {
      return `El horario ingresado no es válido. La hora de ${scheduleMeals[index].label} debe ser posterior a la hora de ${scheduleMeals[index - 1].label} previa.`;
    }
  }
  return null;
}
