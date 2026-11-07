import { RecipeIngredientData, RecipeMetadata, RecipeNutrition } from './recipe-meals';

export type PortionRecipeSource = 'personalized' | 'favorite' | 'scan' | 'local';

export interface RecipePortionPreview {
  recipeId: string;
  available: boolean;
  reason?: string;
  baseServings?: number;
  requestedServings?: number;
  factor?: number;
  ingredients?: string[];
  ingredientData?: RecipeIngredientData[];
  nutrition?: RecipeNutrition;
  totalNutrition?: RecipeNutrition['perServing'];
  instructionQuantitiesUnchanged?: boolean;
}

export function recipeCanScale(recipe: RecipeMetadata & { ingredients: string[] }): boolean {
  const servings = recipe.servings;
  if (!Number.isInteger(servings) || !servings || servings < 1 || servings > 12) return false;
  const data = recipe.ingredientData;
  if (!data?.length || data.length > 30 || data.length !== recipe.ingredients.length) return false;
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  return data.every((item, index) => {
    if (!item || typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 100000 || !['g','ml'].includes(item.unit ?? '') || typeof item.name !== 'string' || !item.name.trim()) return false;
    const amount = Number(item.quantity.toFixed(3));
    return amount > 0 && typeof recipe.ingredients[index] === 'string'
      && normalize(recipe.ingredients[index]) === `${amount} ${item.unit} de ${normalize(item.name)}`;
  });
}
