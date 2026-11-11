import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { EatWellService, Recipe, SuggestedFoodRecipe } from '../core';
import { DailyMealPlan, mealPlanDate } from '../core/daily-meal-plan';
import { ConsumedMeal } from '../core/daily-dashboard-log';
import {
  RecipeNutrientKey,
  ResolvedRecipeNutrition,
  recipeMealLabels,
  recipeMealTypes,
  recipeCanBeSelected,
  RecipeMealType,
  resolveRecipeNutrition,
} from '../core/recipe-meals';

const ingredientSubstituteGroups: Array<{ label: string; icon: string; keywords: string[]; options: string[] }> = [
  {
    label: 'Verduras', icon: 'leaf-outline',
    keywords: ['lechuga', 'espinaca', 'acelga', 'col', 'kale', 'berro'],
    options: ['Espinaca baby', 'Acelga', 'Col'],
  },
  {
    label: 'Verduras', icon: 'leaf-outline',
    keywords: ['tomate', 'jitomate', 'pimiento', 'calabaza', 'calabacita', 'pepino', 'brocoli', 'coliflor', 'zanahoria'],
    options: ['Calabacita', 'Pimiento', 'Brócoli'],
  },
  {
    label: 'Frutas', icon: 'nutrition-outline',
    keywords: ['manzana', 'pera', 'platano', 'banana', 'naranja', 'fresa', 'frutos rojos', 'mango'],
    options: ['Manzana', 'Pera', 'Naranja'],
  },
  {
    label: 'Cereales', icon: 'restaurant-outline',
    keywords: ['arroz', 'avena', 'quinoa', 'maiz', 'tortilla', 'pasta', 'pan', 'cebada'],
    options: ['Arroz integral', 'Quinoa', 'Avena'],
  },
  {
    label: 'Leguminosas', icon: 'leaf-outline',
    keywords: ['frijol', 'lenteja', 'garbanzo', 'haba'],
    options: ['Lentejas', 'Garbanzos', 'Frijoles'],
  },
  {
    label: 'Alimentos de origen animal', icon: 'restaurant-outline',
    keywords: ['pollo', 'pavo', 'res', 'carne', 'pescado', 'atun', 'salmon', 'huevo'],
    options: ['Pollo', 'Pescado', 'Huevo'],
  },
  {
    label: 'Lácteos y alternativas', icon: 'cafe-outline',
    keywords: ['leche', 'yogur', 'yogurt', 'queso', 'requeson'],
    options: ['Yogur natural', 'Queso panela', 'Leche'],
  },
  {
    label: 'Grasas y semillas', icon: 'nutrition-outline',
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
export class PlanRecipeSuggestionsPage implements OnInit, OnDestroy {
  readonly recipeMealLabels = recipeMealLabels;
  mealType: RecipeMealType = 'breakfast';
  targetCalories = 0;
  selectedDate = mealPlanDate();
  recipes: Recipe[] = [];
  detailRecipe: Recipe | null = null;
  activeIngredients: string[] = [];
  checkedIngredients = new Set<number>();
  activeTimerStep: number | null = null;
  timerSecondsLeft = 0;
  isTimerPaused = false;
  private timerEndsAt: number | null = null;
  private cookingInterval?: ReturnType<typeof setInterval>;
  isRecipeDetailOpen = false;
  isSubstitutionSheetOpen = false;
  selectedIngredientIndex: number | null = null;
  substituteOptions: string[] = [];
  substituteSearchTerm = '';
  substituteGroupLabel = '';
  substituteGroupIcon = 'swap-horizontal-outline';
  dailyPlan: DailyMealPlan | null = null;
  consumedMeals: ConsumedMeal[] = [];
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

  isConsumed(recipe: Recipe): boolean {
    return this.consumedMeals.some(meal => meal.id === recipe.id && (meal.mealType === this.mealType || !meal.mealType));
  }

  selectionButtonLabel(recipe: Recipe): string {
    return this.isSelected(recipe) ? 'RECETA ACTUALMENTE SELECCIONADA'
      : this.selectedRecipeId ? 'CAMBIAR A ESTA RECETA' : 'SELECCIONAR RECETA';
  }

  ionViewWillEnter(): void {
    if (!this.isLoading) void this.loadSuggestions();
  }

  private pinSelectedRecipe(options: Recipe[]): void {
    const selected = this.dailyPlan?.choices[this.mealType];
    const ordered = selected ? [selected, ...options] : options;
    this.recipes = ordered.filter((recipe, index) => ordered.findIndex(item => item.id === recipe.id) === index);
  }

  returnToPlan(): void {
    void this.router.navigateByUrl('/tabs/plan-alimenticio');
  }

  openRecipeDetail(recipe: Recipe): void {
    this.saveCookingProgress();
    this.clearCookingInterval();
    this.detailRecipe = { ...recipe };
    this.activeIngredients = [...recipe.ingredients];
    this.checkedIngredients = new Set();
    this.activeTimerStep = null;
    this.timerSecondsLeft = 0;
    this.timerEndsAt = null;
    this.isTimerPaused = false;
    this.restoreCookingProgress();
    this.isRecipeDetailOpen = true;
  }

  closeRecipeDetail(): void {
    this.saveCookingProgress();
    this.clearCookingInterval();
    this.closeSubstitutionSheet();
    this.isRecipeDetailOpen = false;
    this.detailRecipe = null;
    this.activeIngredients = [];
  }

  ngOnDestroy(): void {
    this.saveCookingProgress();
    this.clearCookingInterval();
  }

  toggleIngredient(index: number): void {
    if (this.checkedIngredients.has(index)) this.checkedIngredients.delete(index);
    else this.checkedIngredients.add(index);
    this.saveCookingProgress();
  }

  parseMinutes(instruction: string): number | null {
    const match = instruction.match(/(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?\s*(minutos?|min|m|horas?|h)\b/i);
    if (!match) return null;
    const amount = Number(match[1].replace(',', '.')) / (match[2] ? Number(match[2]) : 1);
    const minutes = amount * (/^h/i.test(match[3]) ? 60 : 1);
    return Number.isFinite(minutes) && minutes > 0 && minutes <= 1440 ? minutes : null;
  }

  startCookingTimer(minutes: number, step: number): void {
    this.clearCookingInterval();
    this.activeTimerStep = step;
    this.timerSecondsLeft = Math.ceil(minutes * 60);
    this.timerEndsAt = Date.now() + this.timerSecondsLeft * 1000;
    this.isTimerPaused = false;
    this.watchCookingTimer();
    this.saveCookingProgress();
  }

  toggleTimerPause(): void {
    if (this.isTimerPaused) {
      this.timerEndsAt = Date.now() + this.timerSecondsLeft * 1000;
      this.isTimerPaused = false;
      this.watchCookingTimer();
    } else {
      this.updateCookingTimer();
      this.clearCookingInterval();
      this.timerEndsAt = null;
      this.isTimerPaused = true;
    }
    this.saveCookingProgress();
  }

  stopCookingTimer(): void {
    this.clearCookingInterval();
    this.activeTimerStep = null;
    this.timerSecondsLeft = 0;
    this.timerEndsAt = null;
    this.isTimerPaused = false;
    this.saveCookingProgress();
  }

  get timerDisplay(): string {
    const minutes = Math.floor(this.timerSecondsLeft / 60);
    return `${minutes}:${String(this.timerSecondsLeft % 60).padStart(2, '0')}`;
  }

  private updateCookingTimer(): void {
    if (this.timerEndsAt === null || this.isTimerPaused) return;
    this.timerSecondsLeft = Math.max(0, Math.ceil((this.timerEndsAt - Date.now()) / 1000));
    if (this.timerSecondsLeft === 0) {
      this.clearCookingInterval();
      this.timerEndsAt = null;
      this.saveCookingProgress();
    }
  }

  private watchCookingTimer(): void {
    this.clearCookingInterval();
    this.updateCookingTimer();
    if (this.timerSecondsLeft > 0 && !this.isTimerPaused) {
      this.cookingInterval = setInterval(() => this.updateCookingTimer(), 1000);
    }
  }

  private clearCookingInterval(): void {
    if (this.cookingInterval !== undefined) clearInterval(this.cookingInterval);
    this.cookingInterval = undefined;
  }

  private get cookingStorageKey(): string | null {
    const userId = this.eatWellService.getActiveUser()?.id;
    return userId && this.detailRecipe
      ? `eat-well-cooking-v1:${JSON.stringify([userId, this.selectedDate, this.mealType, this.detailRecipe.id])}`
      : null;
  }

  private saveCookingProgress(): void {
    const key = this.cookingStorageKey;
    if (!key || !this.detailRecipe) return;
    // El progreso de cocina es local; no cambia la receta ni su nutrición guardada en el plan.
    try {
      localStorage.setItem(key, JSON.stringify({
        original: JSON.stringify([this.detailRecipe.ingredients, this.detailRecipe.instructions]),
        ingredients: this.activeIngredients,
        checked: [...this.checkedIngredients],
        timerStep: this.activeTimerStep,
        timerSeconds: this.timerSecondsLeft,
        timerEndsAt: this.timerEndsAt,
        timerPaused: this.isTimerPaused,
      }));
    } catch { /* El detalle sigue disponible si el dispositivo bloquea el almacenamiento. */ }
  }

  private restoreCookingProgress(): void {
    const key = this.cookingStorageKey;
    if (!key || !this.detailRecipe) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (!saved || saved.original !== JSON.stringify([this.detailRecipe.ingredients, this.detailRecipe.instructions])) return;
      if (Array.isArray(saved.ingredients) && saved.ingredients.length === this.activeIngredients.length
        && saved.ingredients.every((item: unknown) => typeof item === 'string')) {
        this.activeIngredients = saved.ingredients;
      }
      if (Array.isArray(saved.checked)) {
        this.checkedIngredients = new Set(saved.checked.filter((index: unknown): index is number =>
          typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < this.activeIngredients.length));
      }
      if (Number.isInteger(saved.timerStep) && saved.timerStep >= 0 && saved.timerStep < this.detailRecipe.instructions.length
        && typeof saved.timerSeconds === 'number' && Number.isFinite(saved.timerSeconds)
        && saved.timerSeconds >= 0 && saved.timerSeconds <= 86400) {
        this.activeTimerStep = saved.timerStep;
        this.timerSecondsLeft = Math.ceil(saved.timerSeconds);
        this.isTimerPaused = saved.timerPaused === true;
        this.timerEndsAt = typeof saved.timerEndsAt === 'number' && Number.isFinite(saved.timerEndsAt)
          ? saved.timerEndsAt : null;
        this.watchCookingTimer();
      }
    } catch { /* Una entrada local antigua o inválida no debe impedir abrir la receta. */ }
  }

  get selectedIngredientName(): string {
    return this.selectedIngredientIndex === null ? '' : this.activeIngredients[this.selectedIngredientIndex] ?? '';
  }

  get substitutionPortion(): string {
    return this.selectedIngredientName.match(/^(.+?)\s+de\s+/i)?.[1] ?? '';
  }

  get filteredSubstituteOptions(): string[] {
    const term = normalizeIngredient(this.substituteSearchTerm.trim());
    return term ? this.substituteOptions.filter(option => normalizeIngredient(option).includes(term)) : this.substituteOptions;
  }

  updateSubstituteSearch(event: Event): void {
    this.substituteSearchTerm = (event.target as HTMLInputElement).value;
  }

  openSubstitution(index: number): void {
    const ingredient = this.activeIngredients[index];
    if (!ingredient) return;

    const normalized = normalizeIngredient(ingredient);
    const group = ingredientSubstituteGroups.find(item =>
      item.keywords.some(keyword => normalized.includes(keyword)),
    );
    this.selectedIngredientIndex = index;
    this.substituteSearchTerm = '';
    this.substituteGroupLabel = group?.label ?? '';
    this.substituteGroupIcon = group?.icon ?? 'swap-horizontal-outline';
    this.substituteOptions = group
      ? group.options.filter(option => !normalized.includes(normalizeIngredient(option)))
      : [];
    this.isSubstitutionSheetOpen = true;
  }

  replaceIngredient(substitute: string): void {
    if (this.selectedIngredientIndex === null || !this.substituteOptions.includes(substitute)) return;

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
    this.checkedIngredients.delete(index);
    this.saveCookingProgress();
    this.closeSubstitutionSheet();
  }

  closeSubstitutionSheet(): void {
    this.isSubstitutionSheetOpen = false;
    this.selectedIngredientIndex = null;
    this.substituteOptions = [];
    this.substituteSearchTerm = '';
    this.substituteGroupLabel = '';
    this.substituteGroupIcon = 'swap-horizontal-outline';
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
    return `Respaldo: receta ${cache} porque ${reason}. Al seleccionarla, se validará su compatibilidad con tus preferencias.`;
  }

  hasCatalogFallback(): boolean {
    return this.recipes.some(recipe => this.isCatalogFallback(recipe));
  }

  canSelectRecipe(recipe: Recipe): boolean {
    if (this.isFixture(recipe)) return false;
    if (/^[1-9]\d*$/.test(recipe.id)) {
      return recipe.ingredients.length > 0 && recipe.instructions.length > 0
        && recipeMealTypes(recipe).includes(this.mealType)
        && Object.values(this.nutrition(recipe).values).every(value => value !== null);
    }
    return recipeCanBeSelected(recipe);
  }

  selectionLimitation(recipe: Recipe): string {
    if (/^[1-9]\d*$/.test(recipe.id)) {
      return 'Esta receta no tiene todos los datos necesarios o no corresponde a este tiempo de comida.';
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
      if (this.eatWellService.getActiveUser()) {
        this.consumedMeals = this.eatWellService.getDailyMealLog(this.selectedDate).consumedMeals;
      }
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
        this.eatWellService.getMealOptions(this.mealType, this.selectedDate, recoverCache, true).catch(error => {
          this.error = error instanceof Error ? error.message : 'No se pudieron cargar las alternativas.';
          return [];
        }),
        favoritesPromise,
      ]);
      this.dailyPlan = plan;
      this.favoriteIds = new Map(favorites.map(favorite => [favorite.title, favorite.favoriteId]));
      this.pinSelectedRecipe(recipes);
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
    if (!this.canSelectRecipe(recipe) || this.isSaving || this.isLoading || this.isSelected(recipe)) return;

    this.isSaving = true;
    this.error = '';
    try {
      this.dailyPlan = await this.eatWellService.chooseDailyMeal(
        this.mealType,
        recipe.id,
        this.selectedDate,
      );
      this.pinSelectedRecipe(this.recipes);
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
