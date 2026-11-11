import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { EatWellService, Recipe, SuggestedFoodRecipe } from '../core';
import { DailyMealPlan, mealPlanDate } from '../core/daily-meal-plan';
import {
  RecipeNutrientKey,
  ResolvedRecipeNutrition,
  recipeMealLabels,
  recipeMealTypes,
  recipeCanBeSelected,
  RecipeMealType,
  resolveRecipeNutrition,
} from '../core/recipe-meals';

const ingredientSubstituteGroups: Array<{ keywords: string[]; options: string[] }> = [
  {
    keywords: ['lechuga', 'espinaca', 'acelga', 'col', 'kale', 'berro'],
    options: ['Espinaca baby', 'Acelga', 'Col'],
  },
  {
    keywords: ['tomate', 'jitomate', 'pimiento', 'calabaza', 'calabacita', 'pepino', 'brocoli', 'coliflor', 'zanahoria'],
    options: ['Calabacita', 'Pimiento', 'Brócoli'],
  },
  {
    keywords: ['manzana', 'pera', 'platano', 'banana', 'naranja', 'fresa', 'frutos rojos', 'mango'],
    options: ['Manzana', 'Pera', 'Naranja'],
  },
  {
    keywords: ['arroz', 'avena', 'quinoa', 'maiz', 'tortilla', 'pasta', 'pan', 'cebada'],
    options: ['Arroz integral', 'Quinoa', 'Avena'],
  },
  {
    keywords: ['frijol', 'lenteja', 'garbanzo', 'haba'],
    options: ['Lentejas', 'Garbanzos', 'Frijoles'],
  },
  {
    keywords: ['pollo', 'pavo', 'res', 'carne', 'pescado', 'atun', 'salmon', 'huevo'],
    options: ['Pollo', 'Pescado', 'Huevo'],
  },
  {
    keywords: ['leche', 'yogur', 'yogurt', 'queso', 'requeson'],
    options: ['Yogur natural', 'Queso panela', 'Leche'],
  },
  {
    keywords: ['aguacate', 'aceite', 'nuez', 'almendra', 'semilla'],
    options: ['Aguacate', 'Nueces', 'Semillas'],
  },
];

function normalizeIngredient(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

@Component({
  selector: 'app-plan-recipe-suggestions',
  templateUrl: './plan-recipe-suggestions.page.html',
  styleUrls: ['./plan-recipe-suggestions.page.scss'],
  standalone: false,
})
export class PlanRecipeSuggestionsPage implements OnInit {
  readonly recipeMealLabels = recipeMealLabels;
  mealType: RecipeMealType = 'breakfast';
  targetCalories = 0;
  selectedDate = mealPlanDate();
  recipes: Recipe[] = [];
  detailRecipe: Recipe | null = null;
  activeIngredients: string[] = [];
  isRecipeDetailOpen = false;
  isSubstitutionSheetOpen = false;
  selectedIngredientIndex: number | null = null;
  substituteOptions: string[] = [];
  dailyPlan: DailyMealPlan | null = null;
  isLoading = true;
  isSaving = false;
  error = '';
  favoriteIds = new Map<string, string>();
  favoriteLoadingId: string | null = null;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eatWellService = inject(EatWellService);
  private readonly alertController = inject(AlertController);

  ngOnInit(): void {
    const mealType = this.route.snapshot.paramMap.get('mealType');
    const targetCalories = Number(this.route.snapshot.paramMap.get('kcal'));
    const date = this.route.snapshot.queryParamMap.get('date');

    if (!mealType || !Object.prototype.hasOwnProperty.call(recipeMealLabels, mealType)
      || !Number.isFinite(targetCalories) || targetCalories < 0) {
      this.error = 'No se pudo identificar la comida seleccionada.';
      this.isLoading = false;
      return;
    }

    this.mealType = mealType as RecipeMealType;
    this.targetCalories = targetCalories;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) this.selectedDate = date;
    void this.loadSuggestions();
  }

  get mealLabel(): string {
    if (this.mealType === 'morning_snack') return 'Colación 1';
    if (this.mealType === 'afternoon_snack') return 'Colación 2';
    return recipeMealLabels[this.mealType];
  }

  get selectedDateLabel(): string {
    return new Date(`${this.selectedDate}T00:00:00`).toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  get selectedRecipeId(): string | null {
    return this.dailyPlan?.choices[this.mealType]?.id ?? null;
  }

  isSelected(recipe: Recipe): boolean {
    return this.selectedRecipeId === recipe.id;
  }

  returnToPlan(): void {
    void this.router.navigateByUrl('/tabs/plan-alimenticio');
  }

  openRecipeDetail(recipe: Recipe): void {
    this.detailRecipe = { ...recipe };
    this.activeIngredients = [...recipe.ingredients];
    this.isRecipeDetailOpen = true;
  }

  closeRecipeDetail(): void {
    this.closeSubstitutionSheet();
    this.isRecipeDetailOpen = false;
    this.detailRecipe = null;
    this.activeIngredients = [];
  }

  openSubstitution(index: number): void {
    const ingredient = this.activeIngredients[index];
    if (!ingredient) return;

    const normalized = normalizeIngredient(ingredient);
    const group = ingredientSubstituteGroups.find(item =>
      item.keywords.some(keyword => normalized.includes(keyword)),
    );
    this.selectedIngredientIndex = index;
    this.substituteOptions = group
      ? group.options.filter(option => !normalized.includes(normalizeIngredient(option)))
      : [];
    this.isSubstitutionSheetOpen = true;
  }

  replaceIngredient(substitute: string): void {
    if (this.selectedIngredientIndex === null) return;

    const index = this.selectedIngredientIndex;
    const currentIngredient = this.activeIngredients[index];
    if (!currentIngredient) return;

    const quantityPrefix = currentIngredient.match(
      /^(.+?\bde\s+)/i,
    )?.[0];
    this.activeIngredients = this.activeIngredients.map((ingredient, ingredientIndex) =>
      ingredientIndex === index
        ? `${quantityPrefix ?? ''}${substitute}`
        : ingredient,
    );
    this.closeSubstitutionSheet();
  }

  closeSubstitutionSheet(): void {
    this.isSubstitutionSheetOpen = false;
    this.selectedIngredientIndex = null;
    this.substituteOptions = [];
  }

  isFixture(recipe: Recipe): boolean {
    return recipe.id.startsWith('fixture-');
  }

  nutrition(recipe: Recipe): ResolvedRecipeNutrition {
    return resolveRecipeNutrition(recipe);
  }

  nutritionValue(recipe: Recipe, nutrient: RecipeNutrientKey): string {
    const value = this.nutrition(recipe).values[nutrient];
    if (value === null) return '—';
    const maximumFractionDigits = nutrient === 'calories' ? 0 : 1;
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits }).format(value);
  }

  isCatalogFallback(recipe: Recipe): boolean {
    return recipe.suggestionContext?.source === 'catalog-fallback';
  }

  fallbackStatus(recipe: Recipe): string {
    const context = recipe.suggestionContext;
    if (!context || context.source !== 'catalog-fallback') return '';
    const reason = context.failureCode === 'timeout'
      ? 'la generación superó el tiempo de espera'
      : context.failureCode === 'network_error'
        ? 'no hubo conexión con el servicio'
        : context.failureCode === 'options_cache_review'
          ? 'las opciones guardadas requieren revisión'
        : 'el servicio no devolvió opciones seleccionables';
    const cache = context.cache === 'local' ? 'recuperada del dispositivo' : 'consultada en el catálogo';
    return `Respaldo: receta ${cache} porque ${reason}. El plan solo acepta recetas personalizadas compatibles con tus preferencias.`;
  }

  hasCatalogFallback(): boolean {
    return this.recipes.some(recipe => this.isCatalogFallback(recipe));
  }

  canSelectRecipe(recipe: Recipe): boolean {
    return !this.isFixture(recipe)
      && recipeCanBeSelected(recipe);
  }

  selectionLimitation(recipe: Recipe): string {
    if (this.isCatalogFallback(recipe)) {
      return 'Esta receta del catálogo no se puede guardar en el plan. Vuelve a generar opciones para obtener recetas personalizadas seleccionables.';
    }
    if (!recipe.id.startsWith('personalized-')) {
      return 'Esta receta no pertenece a las opciones personalizadas que el plan permite guardar.';
    }
    return 'No están disponibles los cuatro valores nutricionales por porción; esta receta no se puede agregar al plan todavía.';
  }

  async loadSuggestions(recoverCache = false): Promise<void> {
    this.isLoading = true;
    this.error = '';
    try {
      console.log('[Frontend] Enviando solicitud a backend...');
      const planPromise = this.eatWellService.getDailyMealPlan(this.selectedDate).catch(error => {
        this.error = error instanceof Error
          ? error.message
          : 'No se pudo consultar la elección guardada para este día.';
        return null;
      });
      const favoritesPromise = this.eatWellService.getFavoriteRecipes().catch(error => {
        this.error = error instanceof Error ? error.message : 'No se pudieron cargar tus favoritos.';
        return [];
      });
      const [plan, recipes, favorites] = await Promise.all([
        planPromise,
        this.eatWellService.getMealOptions(this.mealType, this.selectedDate, recoverCache),
        favoritesPromise,
      ]);
      this.dailyPlan = plan;
      this.favoriteIds = new Map(favorites.map(favorite => [favorite.title, favorite.favoriteId]));
      const selected = plan?.choices[this.mealType];
      this.recipes = selected ? [selected] : recipes.slice(0, 1);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudieron cargar las sugerencias de recetas.';
    } finally {
      this.isLoading = false;
    }
  }

  async retryGeneration(): Promise<void> {
    await this.loadSuggestions(true);
    if (!this.error && !this.hasCatalogFallback()) this.closeRecipeDetail();
  }

  async selectRecipe(recipe: Recipe): Promise<void> {
    if (!this.canSelectRecipe(recipe) || this.isSaving || this.isSelected(recipe)) return;

    this.isSaving = true;
    this.error = '';
    try {
      this.dailyPlan = await this.eatWellService.chooseDailyMeal(
        this.mealType,
        recipe.id,
        this.selectedDate,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la receta.';
      this.error = message;
      const alert = await this.alertController.create({
        header: 'Plan alimenticio',
        message,
        buttons: ['Aceptar'],
      });
      await alert.present();
    } finally {
      this.isSaving = false;
    }
  }

  isFavorite(recipe: Recipe): boolean {
    return this.favoriteIds.has(recipe.title);
  }

  async toggleFavorite(recipe: Recipe, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.favoriteLoadingId) return;

    this.favoriteLoadingId = recipe.id;
    try {
      const favoriteId = this.favoriteIds.get(recipe.title);
      if (favoriteId) {
        await this.eatWellService.removeFavoriteRecipe(favoriteId);
        this.favoriteIds.delete(recipe.title);
      } else {
        const favorite = await this.eatWellService.addFavoriteRecipe({
          ...recipe,
          id: recipe.id,
          imageUrl: '',
          sourceUrl: '',
          detailsLoaded: true,
          mealTypes: recipeMealTypes(recipe),
        } satisfies SuggestedFoodRecipe, 'plan');
        this.favoriteIds.set(recipe.title, favorite.favoriteId);
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo actualizar favoritos.';
    } finally {
      this.favoriteLoadingId = null;
    }
  }
}
