import { RecipeMealType } from './recipe-meals';

export interface EatingHabitMeal {
  mealType: RecipeMealType;
  status: 'reported' | 'omitted' | 'incomplete';
  time: string | null;
  location: string | null;
  withinAwakePeriod: boolean | null;
}

export interface EatingHabitsAnalysis {
  referenceDate: string;
  basis: 'single_24_hour_recall';
  wakeTime: string | null;
  sleepTime: string | null;
  awakeMinutes: number | null;
  crossesMidnight: boolean | null;
  reportedMeals: number;
  omittedMeals: number;
  incompleteMeals: number;
  meals: EatingHabitMeal[];
  locations: { location: string; meals: number }[];
  intervals: { fromMeal: RecipeMealType; toMeal: RecipeMealType; minutes: number }[];
  longestIntervalMinutes: number | null;
  wakeToFirstMealMinutes: number | null;
  lastMealToSleepMinutes: number | null;
  firstMealTime: string | null;
  lastMealTime: string | null;
  qualityWarnings: string[];
  limitations: string;
}

export interface EatingHabitsResponse {
  initialCompleted: boolean;
  analysis: EatingHabitsAnalysis | null;
}
