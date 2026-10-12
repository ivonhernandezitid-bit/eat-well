export type RecipeMealType = 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner';

export interface RecipeMetadata {
  mealTypes?: RecipeMealType[];
  servings?: number | null;
  preparationMinutes?: number | null;
  validationNotes?: string[];
  ingredientData?: RecipeIngredientData[];
  nutrition?: RecipeNutrition;
}

export interface RecipeIngredientData {
  foodId: number;
  name: string;
  quantity: number | null;
  unit: 'g' | 'ml' | null;
}

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

export const recipeMealLabels: Record<RecipeMealType, string> = {
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
