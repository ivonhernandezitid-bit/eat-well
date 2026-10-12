import { MealSchedule } from './meal-schedule';
import { RecipeMetadata, RecipeMealType, recipeMealLabels, recipeMealTypes } from './recipe-meals';

interface MealRecipe extends RecipeMetadata {
  id: string;
  title: string;
  description: string;
}

export interface MealConsumption {
  id: string;
  mealType?: RecipeMealType;
}

const mealFields: Record<RecipeMealType, keyof MealSchedule> = {
  breakfast: 'breakfastTime',
  morning_snack: 'morningSnackTime',
  lunch: 'lunchTime',
  afternoon_snack: 'afternoonSnackTime',
  dinner: 'dinnerTime',
};

export function nextPlannedMeal<T extends MealRecipe>(schedule: MealSchedule, recipes: T[], consumed: MealConsumption[], now: Date, choices?: Partial<Record<RecipeMealType, string>>) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const slots = (Object.keys(mealFields) as RecipeMealType[])
    .map(type => ({ type, label: recipeMealLabels[type], time: schedule[mealFields[type]] }))
    .filter(slot => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot.time))
    .map(slot => ({ ...slot, minutes: Number(slot.time.slice(0, 2)) * 60 + Number(slot.time.slice(3)) }))
    .sort((a, b) => a.minutes - b.minutes);
  const upcoming = slots.find(slot => slot.minutes >= minutes && !consumed.some(meal => meal.mealType === slot.type));
  const slot = upcoming ?? slots[0];
  if (!slot) return null;
  const isTomorrow = !upcoming;
  const recipe = recipes.find(candidate => (choices === undefined || (!isTomorrow && choices[slot.type] === candidate.id)) && recipeMealTypes(candidate).includes(slot.type)
    && (isTomorrow || !consumed.some(meal => !meal.mealType && meal.id === candidate.id))) ?? null;
  return { ...slot, isTomorrow, recipe };
}
