import { RecipeMealType, RecipeNutritionSource } from './recipe-meals';

export interface ConsumedMeal {
  id: string;
  title?: string;
  mealType?: RecipeMealType;
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  nutritionSource?: RecipeNutritionSource | 'manual';
}

export interface DailyDashboardLog {
  date: string;
  consumedMeals: ConsumedMeal[];
  waterGlasses: number;
  exerciseMinutes: number;
  steps: number;
}

export function dailyDashboardLogStorageKey(userId: string, date: string): string {
  return `eat-well-home-${userId}-${date}`;
}

export function createDailyDashboardLog(date: string): DailyDashboardLog {
  return { date, consumedMeals: [], waterGlasses: 0, exerciseMinutes: 0, steps: 0 };
}

export function readDailyDashboardLog(userId: string, date: string, waterGoalGlasses = 10): DailyDashboardLog {
  const key = dailyDashboardLogStorageKey(userId, date);
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return createDailyDashboardLog(date);

    const parsed = JSON.parse(stored) as Partial<DailyDashboardLog>;
    return {
      ...createDailyDashboardLog(date),
      ...parsed,
      date,
      consumedMeals: Array.isArray(parsed.consumedMeals) ? parsed.consumedMeals : [],
      waterGlasses: Math.max(0, Math.min(waterGoalGlasses, Number(parsed.waterGlasses) || 0)),
      exerciseMinutes: Math.max(0, Number(parsed.exerciseMinutes) || 0),
      steps: Math.max(0, Number(parsed.steps) || 0),
    };
  } catch {
    localStorage.removeItem(key);
    return createDailyDashboardLog(date);
  }
}

export function saveDailyDashboardLog(userId: string, log: DailyDashboardLog): void {
  localStorage.setItem(dailyDashboardLogStorageKey(userId, log.date), JSON.stringify(log));
}

export function recordConsumedMeal(userId: string, date: string, meal: ConsumedMeal): DailyDashboardLog {
  const log = readDailyDashboardLog(userId, date);
  const consumedMeals = meal.mealType
    ? log.consumedMeals.filter(existing => existing.mealType !== meal.mealType)
    : log.consumedMeals.filter(existing => existing.id !== meal.id);
  log.consumedMeals = [...consumedMeals, meal];
  saveDailyDashboardLog(userId, log);
  return log;
}
