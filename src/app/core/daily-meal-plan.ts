import { Recipe } from './models';
import { RecipeMealType } from './recipe-meals';

export const DAILY_MEAL_OPTION_COUNT = 4;

export function dailyMealOptions<T extends { id: string }>(options: readonly T[], selected?: T): T[] {
  const visible = options.slice(0, DAILY_MEAL_OPTION_COUNT);
  if (!selected || visible.some(recipe => recipe.id === selected.id)) return visible;
  return [selected, ...visible.filter(recipe => recipe.id !== selected.id)].slice(0, DAILY_MEAL_OPTION_COUNT);
}

export interface DailyMealPlan {
  date: string;
  choices: Partial<Record<RecipeMealType, Recipe>>;
  meals: DailyPlanMeal[];
  scheduleCustomized: boolean;
  summary: {
    totalMeals: number;
    selectedMeals: number;
    pendingMeals: number;
    needsReviewMeals: number;
    complete: boolean;
  };
}

export interface DailyPlanMeal {
  mealType: RecipeMealType;
  label: string;
  scheduledTime: string | null;
  selectionStatus: 'selected' | 'pending' | 'needs_review';
  recipe: Recipe | null;
}

export function mealPlanDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
