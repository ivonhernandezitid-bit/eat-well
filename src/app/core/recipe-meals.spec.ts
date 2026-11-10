import { selectRecipeForMeal } from './recipe-meals';

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
