export type RecipeMealType = 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner';

export interface RecipeMetadata {
  mealTypes?: RecipeMealType[];
  servings?: number | null;
  preparationMinutes?: number | null;
  validationNotes?: string[];
  ingredientData?: RecipeIngredientData[];
  nutrition?: RecipeNutrition;
  estimatedNutrition?: {
    calories?: number | null;
    proteinGrams?: number | null;
    carbsGrams?: number | null;
    fatGrams?: number | null;
  };
  registeredNutrition?: RecipeNutrientValues;
  suggestionContext?: {
    source: 'generated' | 'cache' | 'catalog-fallback';
    cache: 'server' | 'local' | 'none';
    failureCode?: 'timeout' | 'network_error' | 'provider_error' | 'options_cache_review';
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
  source: RecipeNutritionSource;
  status: 'complete' | 'partial' | 'unavailable';
  values?: RecipeNutrientValues;
  perServing: RecipeNutrientValues & { fiberGrams: number | null };
  sources?: Partial<Record<RecipeNutrientKey, RecipeNutrientSource>>;
  portionBases?: Partial<Record<RecipeNutrientKey, 'per_serving' | 'unknown' | null>>;
  calculation?: {
    source: 'BAM';
    status: 'complete' | 'partial' | 'unavailable';
    perServing: RecipeNutrientValues & { fiberGrams: number | null };
    warnings: string[];
    method: string;
  };
  warnings?: string[];
  method?: string;
}

export type RecipeNutrientKey = 'calories' | 'proteinGrams' | 'carbsGrams' | 'fatGrams';
export type RecipeNutrientSource = 'BAM' | 'estimate' | 'catalog' | null;
export type RecipeNutritionSource = Exclude<RecipeNutrientSource, null> | 'mixed' | 'unavailable';
export type RecipeNutrientValues = Record<RecipeNutrientKey, number | null>;

export interface ResolvedRecipeNutrition {
  values: RecipeNutrientValues;
  perServingValues: RecipeNutrientValues;
  sources: Record<RecipeNutrientKey, RecipeNutrientSource>;
  portionBases: Record<RecipeNutrientKey, 'per_serving' | 'unknown' | null>;
  sourceLabel: string;
  calorieUnitLabel: string;
  isCompletePerServing: boolean;
  hasAnyValues: boolean;
}

export interface RecipeNutritionInput extends RecipeMetadata {
  id: string;
  calories?: unknown;
  proteinGrams?: unknown;
  carbsGrams?: unknown;
  fatGrams?: unknown;
  proteins_g?: unknown;
  protein_grams?: unknown;
  proteinas?: unknown;
  carbs_g?: unknown;
  carbs_grams?: unknown;
  carbohidratos?: unknown;
  fats_g?: unknown;
  fat_grams?: unknown;
  grasas?: unknown;
}

const nutritionNutrients: Array<[RecipeNutrientKey, string]> = [
  ['calories', 'calorías'],
  ['proteinGrams', 'proteínas'],
  ['carbsGrams', 'carbohidratos'],
  ['fatGrams', 'grasas'],
];

function usableNutrient(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function resolveRecipeNutrition(recipe: RecipeNutritionInput): ResolvedRecipeNutrition {
  const nutrition = recipe.nutrition;
  const values = {} as RecipeNutrientValues;
  const perServingValues = {} as RecipeNutrientValues;
  const sources = {} as Record<RecipeNutrientKey, RecipeNutrientSource>;
  const portionBases = {} as Record<RecipeNutrientKey, 'per_serving' | 'unknown' | null>;
  const catalogRecipe = /^\d+$/.test(recipe.id);

  for (const [nutrient] of nutritionNutrients) {
    const explicitValue = nutrition?.values?.[nutrient];
    const explicitSource = nutrition?.sources?.[nutrient];
    const explicitBasis = nutrition?.portionBases?.[nutrient];
    const calculated = nutrition?.perServing?.[nutrient];
    const estimate = recipe.estimatedNutrition?.[nutrient];
    const registered = recipe.registeredNutrition?.[nutrient];

    if (usableNutrient(calculated)) {
      perServingValues[nutrient] = calculated;
      values[nutrient] = calculated;
      sources[nutrient] = explicitSource === 'estimate' || explicitSource === 'BAM'
        ? explicitSource
        : usableNutrient(estimate) && estimate === calculated ? 'estimate' : 'BAM';
      portionBases[nutrient] = 'per_serving';
    } else if (usableNutrient(explicitValue)
      && (explicitBasis === 'per_serving' || explicitBasis === 'unknown')
      && (explicitSource === 'BAM' || explicitSource === 'estimate' || explicitSource === 'catalog')) {
      values[nutrient] = explicitValue;
      perServingValues[nutrient] = explicitBasis === 'per_serving' ? explicitValue : null;
      sources[nutrient] = explicitSource;
      portionBases[nutrient] = explicitBasis;
    } else if (usableNutrient(estimate)) {
      values[nutrient] = estimate;
      perServingValues[nutrient] = estimate;
      sources[nutrient] = 'estimate';
      portionBases[nutrient] = 'per_serving';
    } else {
      const rootValue = nutrient === 'proteinGrams'
        ? recipe.proteinGrams ?? recipe.protein_grams ?? recipe.proteins_g ?? recipe.proteinas
        : nutrient === 'carbsGrams'
          ? recipe.carbsGrams ?? recipe.carbs_grams ?? recipe.carbs_g ?? recipe.carbohidratos
          : nutrient === 'fatGrams'
            ? recipe.fatGrams ?? recipe.fat_grams ?? recipe.fats_g ?? recipe.grasas
            : recipe.calories;
      const catalogValue = usableNutrient(registered) ? registered : catalogRecipe ? rootValue : null;
      if (usableNutrient(catalogValue)) {
        values[nutrient] = catalogValue;
        perServingValues[nutrient] = null;
        sources[nutrient] = 'catalog';
        portionBases[nutrient] = 'unknown';
      } else {
        values[nutrient] = null;
        perServingValues[nutrient] = null;
        sources[nutrient] = null;
        portionBases[nutrient] = null;
      }
    }
  }

  const availableSources = [...new Set(Object.values(sources).filter((source): source is Exclude<RecipeNutrientSource, null> => source !== null))];
  const hasCatalogValue = Object.values(sources).includes('catalog');
  const hasPerServingValue = Object.values(portionBases).includes('per_serving');
  const sourceLabel = hasCatalogValue && !hasPerServingValue
    ? 'Valores registrados en el catálogo; la base de porción no está confirmada.'
    : availableSources.length === 0
      ? 'Datos nutricionales no disponibles.'
      : `${hasCatalogValue ? 'Procedencia por nutriente; los valores del catálogo no tienen base de porción confirmada' : 'Por porción. Procedencia'}: ${nutritionNutrients
        .filter(([nutrient]) => sources[nutrient] !== null)
        .map(([nutrient, label]) => `${label}: ${sources[nutrient] === 'BAM' ? 'BAM' : sources[nutrient] === 'estimate' ? 'estimación' : 'catálogo (base no confirmada)'}`)
        .join('; ')}.`;
  const isCompletePerServing = nutritionNutrients.every(([nutrient]) =>
    usableNutrient(perServingValues[nutrient]) && portionBases[nutrient] === 'per_serving',
  );
  const hasAnyValues = nutritionNutrients.some(([nutrient]) => usableNutrient(values[nutrient]));

  return {
    values,
    perServingValues,
    sources,
    portionBases,
    sourceLabel,
    calorieUnitLabel: portionBases.calories === 'per_serving' ? 'kcal por porción' : 'kcal · porción no confirmada',
    isCompletePerServing,
    hasAnyValues,
  };
}

export function recipeCanBeSelected(recipe: RecipeNutritionInput): boolean {
  return recipe.id.startsWith('personalized-') && resolveRecipeNutrition(recipe).isCompletePerServing;
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
