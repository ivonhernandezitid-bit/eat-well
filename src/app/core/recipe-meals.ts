export type RecipeMealType = 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner';

export interface RecipeMetadata {
  mealTypes?: RecipeMealType[];
  servings?: number | null;
  preparationMinutes?: number | null;
  validationNotes?: string[];
  ingredientData?: RecipeIngredientData[];
  nutrition?: RecipeNutrition;
  estimatedNutrition?: {
    calories?: number;
    proteinGrams?: number;
    carbsGrams?: number;
    fatGrams?: number;
  };
}

export interface RecipeIngredientData {
  foodId: number;
  name: string;
  quantity: number | null;
  unit: 'g' | 'ml' | null;
}

export type IngredientSubstitute = RecipeIngredientData;

export interface RecipeNutrition {
  source: 'BAM';
  status: 'complete' | 'partial' | 'unavailable';
  perServing: {
    calories: number | null;
    proteinGrams: number | null;
    carbsGrams: number | null;
    fatGrams: number | null;
    fiberGrams: number | null;
  };
  warnings: string[];
  method: string;
}

const mealTypeRotationOffset: Record<RecipeMealType, number> = {
  breakfast: 0,
  morning_snack: 1,
  lunch: 3,
  afternoon_snack: 2,
  dinner: 4,
};

export const recipeMealLabels: Record<string, string> = {
  breakfast: 'Desayuno',
  morning_snack: 'Colación matutina',
  lunch: 'Comida',
  afternoon_snack: 'Colación vespertina',
  dinner: 'Cena',
};

export function recipeMealTypes(recipe: RecipeMetadata & { title: string; description: string }): RecipeMealType[] {
  const types = [...new Set((recipe.mealTypes ?? []).filter(type => Object.prototype.hasOwnProperty.call(recipeMealLabels, type)))];
  if (types.length) return types;

  // Older recipes have no classification: use their wording as a suggested category.
  const text = `${recipe.title} ${recipe.description}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const explicit: RecipeMealType[] = [];
  if (/\bdesayuno\b/.test(text)) explicit.push('breakfast');
  if (/\bcolacion matutina\b/.test(text)) explicit.push('morning_snack');
  if (/\bcomida\b|\balmuerzo\b/.test(text)) explicit.push('lunch');
  if (/\bcolacion vespertina\b/.test(text)) explicit.push('afternoon_snack');
  if (/\bcena\b|\bcenar\b/.test(text)) explicit.push('dinner');
  if (explicit.length) return explicit;
  if (/\bcolacion\b|\bsnack\b|\bfruta\b|\byogur\b|\byogurt\b/.test(text)) return ['morning_snack', 'afternoon_snack'];
  if (/\bavena\b|\bhotcakes\b|\bomelette\b|\bhuevos\b/.test(text)) return ['breakfast'];
  return ['lunch', 'dinner'];
}

export function selectRecipeForMeal<T extends RecipeMetadata & { id: string; title: string; description: string }>(
  recipes: readonly T[],
  mealType: RecipeMealType,
  date: string | Date = new Date(),
): T | null {
  const available = recipes.filter(recipe => recipeMealTypes(recipe).includes(mealType));
  if (available.length === 0) return null;

  const timestamp = typeof date === 'string'
    ? Date.parse(`${date}T00:00:00Z`)
    : Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  if (!Number.isFinite(timestamp)) throw new RangeError('La fecha para seleccionar recetas no es válida.');

  const dayNumber = Math.floor(timestamp / 86_400_000);
  const index = (dayNumber + mealTypeRotationOffset[mealType]) % available.length;
  return available[index];
}
