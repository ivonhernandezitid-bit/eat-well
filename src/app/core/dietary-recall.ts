export const recallMeals = [
  { type: 'breakfast', time: 'breakfastTime', place: 'breakfastPlace', details: 'breakfastDetails', skipped: 'noBreakfast' },
  { type: 'snack', time: 'snackTime', place: 'snackPlace', details: 'snackDetails', skipped: 'noSnack' },
  { type: 'lunch', time: 'lunchTime', place: 'lunchPlace', details: 'lunchDetails', skipped: 'noLunch' },
  { type: 'snack', time: 'afternoonSnackTime', place: 'afternoonSnackPlace', details: 'afternoonSnackDetails', skipped: 'noAfternoonSnack' },
  { type: 'dinner', time: 'dinnerTime', place: 'dinnerPlace', details: 'dinnerDetails', skipped: 'noDinner' },
] as const;

export function emptyDietaryRecall() {
  return {
    wakeTime: '', wakeActivity: '',
    breakfastTime: '', breakfastPlace: '', breakfastDetails: '', noBreakfast: false,
    snackTime: '', snackPlace: '', snackDetails: '', noSnack: false,
    lunchTime: '', lunchPlace: '', lunchDetails: '', noLunch: false,
    afternoonSnackTime: '', afternoonSnackPlace: '', afternoonSnackDetails: '', noAfternoonSnack: false,
    activityTime: '', activityType: '', activityDuration: '', noActivity: false,
    dinnerTime: '', dinnerPlace: '', dinnerDetails: '', noDinner: false,
    sleepTime: '',
  };
}

export type DietaryRecallData = ReturnType<typeof emptyDietaryRecall>;
export interface DietaryRecallResponse {
  recall: DietaryRecallData | null;
  recallDate: string;
  completed: boolean;
}

export function calendarDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function previousRecallDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return calendarDate(yesterday);
}

export function recallDateError(value: string, today = calendarDate()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Selecciona el día que estás recordando.';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (year < 1900 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || value > today) {
    return 'Selecciona una fecha válida que no sea futura.';
  }
  return null;
}

export function dietaryRecallError(data: DietaryRecallData, date: string, today = calendarDate()): string | null {
  const dateError = recallDateError(date, today);
  if (dateError) return dateError;
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!validTime(data.wakeTime) || !validTime(data.sleepTime) || !data.wakeActivity.trim()) {
    return 'Completa la hora y actividad al despertar, y la hora de dormir.';
  }
  for (const meal of recallMeals) {
    const time = data[meal.time], place = data[meal.place], details = data[meal.details].trim();
    if (data[meal.skipped]) {
      if (time || place || details) return 'Una comida marcada como omitida no puede tener horario ni alimentos.';
    } else {
      const places = ['En casa', 'En la oficina', 'En otro lugar', meal.type === 'lunch' ? 'Fonda / Restaurante' : 'En restaurante'];
      if (!validTime(time) || !places.includes(place) || !details) return 'Completa las comidas o indica cuáles no realizaste.';
    }
  }
  const activity = [data.activityTime, data.activityType.trim(), data.activityDuration.trim()];
  if (data.noActivity) {
    if (activity.some(Boolean)) return 'No puedes indicar actividad si marcaste que no realizaste actividad física.';
  } else if (!validTime(data.activityTime) || !data.activityType.trim() || !data.activityDuration.trim()) {
    return 'Completa la actividad física o indica que no realizaste actividad.';
  }
  for (const [field, value] of Object.entries(data)) {
    if (typeof value !== 'string') continue;
    const max = field === 'activityType' ? 150 : field === 'activityDuration' ? 120 : 10000;
    const length = max < 10000 ? Array.from(value).length : new TextEncoder().encode(value).length;
    if (length > max) return 'Hay un texto demasiado largo en el recordatorio.';
  }
  return null;
}

export function setRecallSkipped(data: DietaryRecallData, field: 'noBreakfast' | 'noSnack' | 'noLunch' | 'noAfternoonSnack' | 'noDinner' | 'noActivity', skipped: boolean): DietaryRecallData {
  const next = { ...data, [field]: skipped };
  if (!skipped) return next;
  if (field === 'noActivity') return { ...next, activityTime: '', activityType: '', activityDuration: '' };
  const meal = recallMeals.find(item => item.skipped === field)!;
  return { ...next, [meal.time]: '', [meal.place]: '', [meal.details]: '' };
}
