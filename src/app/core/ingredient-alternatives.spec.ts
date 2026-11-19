import { ingredientAlternatives, ingredientMeasure } from './ingredient-alternatives';

describe('ingredientAlternatives', () => {
  const preferences = { dietType: 'omnivore' as const, allergies: [], dislikedFoods: [] };

  it('preserves the cooked state and excludes the original ingredient', () => {
    expect(ingredientAlternatives('100 g de frijoles cocidos', preferences).options)
      .toEqual(['Garbanzos cocidos', 'Lentejas cocidas']);
  });

  it('does not treat flour as whole grain or plant drinks as dairy', () => {
    expect(ingredientAlternatives('40 g de harina de arroz', preferences).options).toEqual([]);
    expect(ingredientAlternatives('1 taza de leche de almendras', preferences).options).toEqual([]);
  });

  it('excludes relevant dietary restrictions and dislikes', () => {
    expect(ingredientAlternatives('1/2 taza de hojuelas de avena entera', {
      ...preferences, allergies: ['Gluten'],
    }).options).toEqual(['Hojuelas de quinoa']);
    expect(ingredientAlternatives('Pechuga de pollo cruda', {
      ...preferences, dietType: 'vegetarian',
    }).options).toEqual([]);
    expect(ingredientAlternatives('Manzana verde', {
      ...preferences, dislikedFoods: ['Pera', 'Plátano', 'Mango', 'Papaya', 'Piña', 'Fresas', 'Durazno', 'Melón', 'Uvas'],
    }).options).toEqual([]);
  });

  it('keeps the original kitchen measure when changing oil', () => {
    const oil = '1/2 de taza de aceite de oliva';
    expect(ingredientMeasure(oil)).toBe('1/2 taza');
    expect(ingredientAlternatives(oil, preferences).options).toEqual(['Aceite de canola', 'Aceite de girasol']);
  });

  it('ranks preferred foods first and applies exclusions before preference', () => {
    const options = ingredientAlternatives('Manzana', {
      ...preferences, preferredFruits: ['Fresa', 'Mango', 'Pera'], allergies: ['Fresa'], dislikedFoods: ['Pera'],
    }).options;
    expect(options[0]).toBe('Mango');
    expect(options).not.toContain('Fresas');
    expect(options).not.toContain('Pera');
    expect(options).toContain('Papaya');
  });
});
