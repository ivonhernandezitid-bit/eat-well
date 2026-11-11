import {
  RecipeNutritionInput,
  recipeCanBeSelected,
  resolveRecipeNutrition,
  selectRecipeForMeal,
} from './recipe-meals';

describe('selectRecipeForMeal', () => {
  const recipes = [
    { id: 'breakfast-1', title: 'Avena', description: '', mealTypes: ['breakfast' as const] },
    {
      id: 'breakfast-2',
      title: 'Hotcakes',
      description: '',
      mealTypes: ['breakfast' as const, 'morning_snack' as const, 'afternoon_snack' as const],
    },
    {
      id: 'snack-1',
      title: 'Yogur',
      description: '',
      mealTypes: ['morning_snack' as const, 'afternoon_snack' as const],
    },
    { id: 'lunch-1', title: 'Ensalada', description: '', mealTypes: ['lunch' as const] },
  ];

  it('filters by meal type before selecting', () => {
    const selected = selectRecipeForMeal(recipes, 'lunch', new Date(2026, 0, 1));

    expect(selected?.id).toBe('lunch-1');
  });

  describe('resolveRecipeNutrition', () => {
    const registeredRecipe = {
      id: '24',
      title: 'Avena',
      description: '',
      calories: 440,
      proteinGrams: 12,
      carbsGrams: 64,
      fatGrams: 15,
      ingredients: [],
      instructions: [],
      goals: [],
    };

    it('keeps catalog values distinct from per-serving values when the portion basis is unknown', () => {
      const nutrition = resolveRecipeNutrition(registeredRecipe);

      expect(nutrition.values).toEqual({ calories: 440, proteinGrams: 12, carbsGrams: 64, fatGrams: 15 });
      expect(nutrition.perServingValues).toEqual({ calories: null, proteinGrams: null, carbsGrams: null, fatGrams: null });
      expect(nutrition.isCompletePerServing).toBeFalse();
      expect(nutrition.sourceLabel).toContain('base de porción no está confirmada');
    });

    it('accepts complete BAM values without estimated nutrition', () => {
      const recipe = {
        ...registeredRecipe,
        id: 'personalized-1',
        estimatedNutrition: undefined,
        nutrition: {
          source: 'BAM',
          status: 'complete',
          values: { calories: 300, proteinGrams: 11, carbsGrams: 40, fatGrams: 6 },
          perServing: { calories: 300, proteinGrams: 11, carbsGrams: 40, fatGrams: 6, fiberGrams: 4 },
          sources: { calories: 'BAM', proteinGrams: 'BAM', carbsGrams: 'BAM', fatGrams: 'BAM' },
          portionBases: { calories: 'per_serving', proteinGrams: 'per_serving', carbsGrams: 'per_serving', fatGrams: 'per_serving' },
          calculation: {
            source: 'BAM',
            status: 'complete',
            perServing: { calories: 300, proteinGrams: 11, carbsGrams: 40, fatGrams: 6, fiberGrams: 4 },
            warnings: [],
            method: 'fixture',
          },
        },
      } satisfies RecipeNutritionInput;
      const nutrition = resolveRecipeNutrition(recipe);

      expect(nutrition.isCompletePerServing).toBeTrue();
      expect(nutrition.sources).toEqual({ calories: 'BAM', proteinGrams: 'BAM', carbsGrams: 'BAM', fatGrams: 'BAM' });
      expect(recipeCanBeSelected(recipe)).toBeTrue();
      expect(recipeCanBeSelected(registeredRecipe)).toBeFalse();
    });

    it('preserves per-serving estimates for recipes with multiple servings and retains real zeroes', () => {
      const nutrition = resolveRecipeNutrition({
        ...registeredRecipe,
        id: 'personalized-2',
        servings: 2,
        estimatedNutrition: { calories: 0, proteinGrams: 4, carbsGrams: 7, fatGrams: 2 },
      });

      expect(nutrition.values.calories).toBe(0);
      expect(nutrition.perServingValues).toEqual({ calories: 0, proteinGrams: 4, carbsGrams: 7, fatGrams: 2 });
      expect(nutrition.isCompletePerServing).toBeTrue();
    });

    it('treats null, negative, non-finite, and partial values as unavailable', () => {
      const nutrition = resolveRecipeNutrition({
        ...registeredRecipe,
        id: 'personalized-3',
        calories: 0,
        estimatedNutrition: {
          calories: 0,
          proteinGrams: null,
          carbsGrams: -1,
          fatGrams: Number.NaN,
        },
      });

      expect(nutrition.values).toEqual({ calories: 0, proteinGrams: null, carbsGrams: null, fatGrams: null });
      expect(nutrition.isCompletePerServing).toBeFalse();
    });

    it('keeps provenance per nutrient when sources are combined', () => {
      const nutrition = resolveRecipeNutrition({
        ...registeredRecipe,
        id: 'personalized-4',
        estimatedNutrition: { calories: 310, proteinGrams: 12, carbsGrams: 42, fatGrams: 8 },
        nutrition: {
          source: 'mixed',
          status: 'complete',
          values: { calories: 300, proteinGrams: 12, carbsGrams: 42, fatGrams: 8 },
          perServing: { calories: 300, proteinGrams: 12, carbsGrams: 42, fatGrams: 8, fiberGrams: null },
          sources: { calories: 'BAM', proteinGrams: 'estimate', carbsGrams: 'estimate', fatGrams: 'estimate' },
          portionBases: { calories: 'per_serving', proteinGrams: 'per_serving', carbsGrams: 'per_serving', fatGrams: 'per_serving' },
        },
      });

      expect(nutrition.values.calories).toBe(300);
      expect(nutrition.sources).toEqual({ calories: 'BAM', proteinGrams: 'estimate', carbsGrams: 'estimate', fatGrams: 'estimate' });
    });

    it('resolves identical values and provenance for card and modal copies', () => {
      const cardNutrition = resolveRecipeNutrition(registeredRecipe);
      const modalNutrition = resolveRecipeNutrition({ ...registeredRecipe });

      expect(modalNutrition).toEqual(cardNutrition);
    });
  });

  it('rotates the selected recipe on successive dates', () => {
    const firstDay = selectRecipeForMeal(recipes, 'breakfast', '2026-01-01');
    const nextDay = selectRecipeForMeal(recipes, 'breakfast', '2026-01-02');

    expect(firstDay?.id).not.toBe(nextDay?.id);
  });

  it('selects different recipes for the two snack slots on the same date', () => {
    const firstSnack = selectRecipeForMeal(recipes, 'morning_snack', '2026-01-01');
    const secondSnack = selectRecipeForMeal(recipes, 'afternoon_snack', '2026-01-01');

    expect(firstSnack?.id).not.toBe(secondSnack?.id);
  });

  it('returns null when no recipe belongs to the requested meal', () => {
    expect(selectRecipeForMeal(recipes, 'dinner', new Date(2026, 0, 1))).toBeNull();
  });
});
