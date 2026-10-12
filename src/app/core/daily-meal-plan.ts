import { Recipe } from './models';
import { RecipeMealType } from './recipe-meals';

export interface DailyMealPlan {
  date: string;
  choices: Partial<Record<RecipeMealType, Recipe>>;
}

export function mealPlanDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
