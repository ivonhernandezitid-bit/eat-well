import type { FoodPreferences } from './models';
import type { RecipeIngredientData } from './recipe-meals';

const measuredIngredient = /^\s*(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?[¼½¾⅓⅔⅛⅜⅝⅞]?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(?:de\s+)?(g|ml|kg|gramos?|mililitros?|tazas?|cucharaditas?|cucharadas?|piezas?)\b/i;

export function ingredientMeasure(line?: string, data?: RecipeIngredientData): string {
  if (data?.unit && data.quantity != null && Number.isFinite(data.quantity) && data.quantity > 0) return data.quantity + ' ' + data.unit;
  const match = line?.match(measuredIngredient);
  return match ? match[1] + ' ' + match[2] : '';
}

interface Alternative {
  name: string;
  matches: RegExp;
  tags?: string[];
}

interface IngredientGroup {
  label: string;
  icon: string;
  preference?: 'preferredFruits' | 'preferredVegetables';
  foods: Alternative[];
}

const groups: IngredientGroup[] = [
  { label: 'Hojas para ensalada', icon: 'leaf-outline', preference: 'preferredVegetables', foods: [
    { name: 'Lechuga romana', matches: /^lechuga(?: romana)?$/ },
    { name: 'Lechuga orejona', matches: /^lechuga orejona$/ },
    { name: 'Lechuga italiana', matches: /^lechuga italiana$/ },
    { name: 'Espinaca baby', matches: /^espinaca(?: baby)?$/ },
    { name: 'Arúgula', matches: /^(?:arugula|rucula)$/ },
  ] },
  { label: 'Verduras frescas para ensalada', icon: 'leaf-outline', preference: 'preferredVegetables', foods: [
    { name: 'Jitomate saladet', matches: /^(?:jitomate|tomate)(?: saladet| guaje)?$/, tags: ['tomate'] },
    { name: 'Jitomate bola', matches: /^(?:jitomate|tomate) bola$/, tags: ['tomate'] },
    { name: 'Jitomate cherry', matches: /^(?:jitomate|tomate) cherry$/, tags: ['tomate'] },
    { name: 'Pepino', matches: /^pepino$/ },
    { name: 'Pimiento morrón', matches: /^(?:pimiento|pimiento morron)(?: rojo| verde| amarillo)?$/ },
  ] },
  { label: 'Verduras para cocer', icon: 'leaf-outline', preference: 'preferredVegetables', foods: [
    { name: 'Brócoli', matches: /^brocoli$/ },
    { name: 'Coliflor', matches: /^coliflor$/ },
    { name: 'Calabacita', matches: /^(?:calabacita|calabacin)$/ },
    { name: 'Zanahoria', matches: /^zanahoria$/ },
    { name: 'Ejotes', matches: /^ejotes?$/ },
    { name: 'Chayote', matches: /^chayote$/ },
  ] },
  { label: 'Fruta fresca', icon: 'nutrition-outline', preference: 'preferredFruits', foods: [
    { name: 'Manzana', matches: /^manzana(?: roja| verde| amarilla)?$/ },
    { name: 'Pera', matches: /^pera$/ },
    { name: 'Plátano', matches: /^(?:platano|banana)(?: tabasco| dominico)?$/, tags: ['banana'] },
    { name: 'Mango', matches: /^mango(?: manila| ataulfo)?$/ },
    { name: 'Papaya', matches: /^papaya$/ },
    { name: 'Piña', matches: /^pina$/ },
    { name: 'Fresas', matches: /^fresas?$/, tags: ['fresa', 'frutos rojos'] },
    { name: 'Durazno', matches: /^(?:durazno|melocoton)$/, tags: ['melocoton'] },
    { name: 'Melón', matches: /^melon$/ },
    { name: 'Uvas', matches: /^uvas?(?: verdes?| rojas?)?$/, tags: ['uva'] },
  ] },
  { label: 'Cereales en grano', icon: 'restaurant-outline', foods: [
    { name: 'Arroz integral', matches: /^arroz integral$/ },
    { name: 'Arroz blanco', matches: /^arroz(?: blanco)?$/ },
    { name: 'Quinoa', matches: /^(?:quinoa|quinua)$/ },
  ] },
  { label: 'Hojuelas para cocer', icon: 'restaurant-outline', foods: [
    { name: 'Hojuelas de avena', matches: /^(?:hojuelas de avena(?: entera)?|avena en hojuelas)$/ },
    { name: 'Hojuelas de quinoa', matches: /^hojuelas de (?:quinoa|quinua)$/ },
    { name: 'Hojuelas de cebada', matches: /^hojuelas de cebada$/, tags: ['gluten', 'cebada'] },
  ] },
  { label: 'Leguminosas', icon: 'leaf-outline', foods: [
    { name: 'Frijoles', matches: /^(?:frijol|frijoles)(?: negro[s]?| bayo[s]?| pinto[s]?)?$/, tags: ['leguminosas', 'frijol'] },
    { name: 'Garbanzos', matches: /^garbanzos?$/, tags: ['leguminosas', 'garbanzo'] },
    { name: 'Lentejas', matches: /^lentejas?$/, tags: ['leguminosas', 'lenteja'] },
  ] },
  { label: 'Pechugas de ave', icon: 'restaurant-outline', foods: [
    { name: 'Pechuga de pollo', matches: /^(?:pechuga de pollo|pollo pechuga)$/, tags: ['carne', 'aves', 'pollo'] },
    { name: 'Pechuga de pavo', matches: /^(?:pechuga de pavo|pavo pechuga)$/, tags: ['carne', 'aves', 'pavo'] },
  ] },
  { label: 'Yogures naturales', icon: 'cafe-outline', foods: [
    { name: 'Yogur natural sin azúcar', matches: /^yogur(?:t)? natural$/, tags: ['leche', 'lacteos', 'lactosa', 'yogur'] },
    { name: 'Yogur griego natural sin azúcar', matches: /^yogur(?:t)? griego natural$/, tags: ['leche', 'lacteos', 'lactosa', 'yogur'] },
  ] },
  { label: 'Aceites vegetales', icon: 'nutrition-outline', foods: [
    { name: 'Aceite de oliva', matches: /^aceite de oliva(?: virgen(?: extra)?)?$/ },
    { name: 'Aceite de canola', matches: /^aceite de canola$/ },
    { name: 'Aceite de girasol', matches: /^aceite de girasol$/, tags: ['semillas', 'girasol'] },
  ] },
];

export function normalizeIngredient(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

type SubstitutePreferences = Pick<FoodPreferences, 'allergies' | 'dislikedFoods' | 'dietType'>
  & Partial<Pick<FoodPreferences, 'preferredFruits' | 'preferredVegetables'>>;

export function ingredientAlternatives(ingredient: string, preferences: SubstitutePreferences) {
  const text = normalizeIngredient(ingredient.replace(measuredIngredient, '').replace(/^\s*(?:de\s+)?/i, ''));
  const state = text.match(/\b(crud[oa]s?|cocid[oa]s?|secos?|secas?)$/)?.[0];
  const cooked = !!state && state.startsWith('cocid');
  const name = (state ? text.slice(0, -state.length).trim() : text).replace(/ sin azucar$/, '');
  const group = groups.find(group => group.foods.some(food => food.matches.test(name)));
  const original = group?.foods.find(food => food.matches.test(name));
  const blocked = [...preferences.allergies, ...preferences.dislikedFoods].map(normalizeIngredient).filter(Boolean);
  const preferred = group?.preference ? (preferences[group.preference] ?? []).map(normalizeIngredient).filter(Boolean) : [];
  const matchesPreference = (food: Alternative, term: string) => food.matches.test(term)
    || [food.name, ...(food.tags ?? [])].map(normalizeIngredient)
      .some(value => value.includes(term) || (value.length >= 4 && term.includes(value)));
  const preferredRank = (food: Alternative) => {
    const rank = preferred.findIndex(term => matchesPreference(food, term));
    return rank < 0 ? preferred.length : rank;
  };
  const options = group?.foods.filter(food => {
    if (food === original) return false;
    if (preferences.dietType !== 'omnivore' && food.tags?.includes('carne')) return false;
    if (preferences.dietType === 'vegan' && food.tags?.includes('lacteos')) return false;
    return !blocked.some(term => matchesPreference(food, term));
  }).sort((a, b) => preferredRank(a) - preferredRank(b)).map(food => {
    if (!cooked) return food.name;
    if (group.label === 'Leguminosas') return food.name + (food.name === 'Lentejas' ? ' cocidas' : ' cocidos');
    if (group.label === 'Cereales en grano') return food.name + (food.name === 'Quinoa' ? ' cocida' : ' cocido');
    if (group.label === 'Pechugas de ave') return food.name + ' cocida';
    if (group.label === 'Verduras para cocer') return food.name + (food.name === 'Ejotes' ? ' cocidos'
      : ['Coliflor', 'Calabacita', 'Zanahoria'].includes(food.name) ? ' cocida' : ' cocido');
    return food.name;
  }) ?? [];
  return { label: group?.label ?? '', icon: group?.icon ?? 'swap-horizontal-outline', options };
}
