import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, IonModal } from '@ionic/angular';
import { EatWellService, Recipe, SuggestedFoodRecipe } from '../core';
import { DAILY_MEAL_OPTION_COUNT, DailyMealPlan, mealPlanDate } from '../core/daily-meal-plan';
import { ConsumedMeal } from '../core/daily-dashboard-log';
import { confirmMealConsumption } from '../core/confirm-meal-consumption';
import { recipeCanScale, RecipePortionPreview } from '../core/recipe-portions';
import { ingredientAlternatives, ingredientMeasure, normalizeIngredient } from '../core/ingredient-alternatives';
import {
  RecipeNutrientKey,
  ResolvedRecipeNutrition,
  recipeMealLabels,
  recipeMealTypes,
  RecipeMealType,
  resolveRecipeNutrition,
  selectRecipeForMeal,
} from '../core/recipe-meals';


@Component({
  selector: 'app-plan-recipe-suggestions',
  templateUrl: './plan-recipe-suggestions.page.html',
  styleUrls: ['./plan-recipe-suggestions.page.scss'],
  standalone: false,
})
export class PlanRecipeSuggestionsPage implements OnInit, OnDestroy {
  readonly recipeMealLabels = recipeMealLabels;
  mealType: RecipeMealType = 'breakfast';
  selectedDate = mealPlanDate();
  recipes: Recipe[] = [];
  loadingBackup: Recipe | null = null;
  detailRecipe: Recipe | null = null;
  portionPreview: RecipePortionPreview | null = null;
  portionLoading = false;
  portionError = '';
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
  substitutionLoading = false;
  substitutionError = '';
  private substitutionRequest = 0;
  substituteGroupLabel = '';
  substituteGroupIcon = 'swap-horizontal-outline';
  dailyPlan: DailyMealPlan | null = null;
  consumedMeals: ConsumedMeal[] = [];
  isLoading = true;
  isSaving = false;
  plannedRecipeId: string | null = null;
  confirmingMeal = false;
  error = '';
  favoriteIds = new Map<string, string>();
  favoriteLoadingId: string | null = null;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eatWellService = inject(EatWellService);
  private readonly alertController = inject(AlertController);
  @ViewChild('recipeDetailModal') private recipeDetailModal?: IonModal;
  @ViewChild('substitutionModal') private substitutionModal?: IonModal;
  private leavingView = false;
  private mealOptions: Recipe[] = [];

  ngOnInit(): void {
    const mealType = this.route.snapshot.paramMap.get('mealType');
    this.plannedRecipeId = this.route.snapshot.paramMap.has?.('recipeId')
      ? this.route.snapshot.paramMap.get('recipeId') : null;
    const targetCalories = Number(this.route.snapshot.paramMap.get('kcal'));
    const date = this.route.snapshot.queryParamMap.get('date');

    if (!mealType || !Object.prototype.hasOwnProperty.call(recipeMealLabels, mealType)
      || !Number.isFinite(targetCalories) || targetCalories < 0) {
      this.error = 'No se pudo identificar la comida seleccionada.';
      this.isLoading = false;
      return;
    }

    this.mealType = mealType as RecipeMealType;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) this.selectedDate = date;
    if (this.plannedRecipeId) void this.loadPlannedRecipe(this.plannedRecipeId);
    else void this.loadSuggestions();
  }

  private async loadPlannedRecipe(recipeId: string): Promise<void> {
    try {
      const userId = this.eatWellService.getActiveUser()?.id;
      if (!userId) return;
      const plan = await this.eatWellService.getDailyMealPlan(this.selectedDate);
      if (this.leavingView || this.eatWellService.getActiveUser()?.id !== userId) return;
      const recipe = plan.choices[this.mealType];
      if (plan.date !== this.selectedDate || recipe?.id !== recipeId) {
        this.error = 'Esta receta ya no está seleccionada en tu plan.';
        return;
      }
      this.dailyPlan = plan;
      this.consumedMeals = this.eatWellService.getDailyMealLog(this.selectedDate).consumedMeals;
      this.openRecipeDetail(recipe);
    } catch {
      this.error = 'No se pudo cargar la receta de tu plan.';
    } finally {
      this.isLoading = false;
    }
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

  get energyTarget() {
    return this.dailyPlan?.energyTargets?.[this.mealType];
  }

  isWithinEnergyTarget(recipe: Recipe): boolean {
    const target = this.energyTarget;
    const nutrition = this.nutrition(recipe);
    const calories = nutrition.perServingValues.calories;
    return !!target && nutrition.sources.calories === 'BAM'
      && calories !== null && calories >= target.min && calories <= target.max;
  }

  get visibleRecipes(): Recipe[] {
    const backup = this.loadingBackup;
    return backup && !this.recipes.some(recipe => recipe.id === backup.id) ? [backup, ...this.recipes] : this.recipes;
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
    this.leavingView = false;
    if (this.isLoading) return;
    if (!this.plannedRecipeId) void this.loadSuggestions();
    else if (!this.isRecipeDetailOpen) {
      this.isLoading = true;
      this.error = '';
      void this.loadPlannedRecipe(this.plannedRecipeId);
    }
  }

  private pinSelectedRecipe(options: Recipe[]): void {
    const selected = this.dailyPlan?.choices[this.mealType];
    const alternatives = options.filter((recipe, index) => options.findIndex(item => item.id === recipe.id) === index)
      .slice(0, DAILY_MEAL_OPTION_COUNT);
    this.recipes = selected ? [selected, ...alternatives.filter(recipe => recipe.id !== selected.id)] : alternatives;
  }

  returnToPlan(): void {
    if (this.plannedRecipeId) void this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
    else void this.router.navigateByUrl('/tabs/plan-alimenticio');
  }

  onRecipeDetailDismiss(): void {
    this.closeRecipeDetail();
    if (this.plannedRecipeId && !this.leavingView) this.returnToPlan();
  }

  async dismissOverlaysBeforeLeaving(fromBrowserHistory: boolean): Promise<boolean> {
    if (fromBrowserHistory && !this.plannedRecipeId) {
      if (this.isSubstitutionSheetOpen) {
        await this.substitutionModal?.dismiss();
        this.closeSubstitutionSheet();
        return false;
      }
      if (this.isRecipeDetailOpen) {
        await this.recipeDetailModal?.dismiss();
        this.closeRecipeDetail();
        return false;
      }
    }

    this.leavingView = true;
    // Finish dismissal while this page still owns the modal's content and styles.
    try {
      await this.substitutionModal?.dismiss();
      await this.recipeDetailModal?.dismiss();
    } finally {
      this.closeRecipeDetail();
    }
    return true;
  }

  get canCompletePlannedRecipe(): boolean {
    return !!this.detailRecipe && this.selectedDate === mealPlanDate() && !this.isConsumed(this.detailRecipe);
  }

  async completePlannedRecipe(): Promise<void> {
    const recipe = this.detailRecipe;
    const userId = this.eatWellService.getActiveUser()?.id;
    if (!this.plannedRecipeId || !recipe || !userId || !this.canCompletePlannedRecipe || this.confirmingMeal) return;
    this.confirmingMeal = true;
    this.error = '';
    try {
      if (await confirmMealConsumption(this.alertController)
        && this.eatWellService.getActiveUser()?.id === userId
        && this.detailRecipe === recipe && this.canCompletePlannedRecipe) {
        this.consumedMeals = this.eatWellService.markDailyMealConsumed(recipe, this.mealType).consumedMeals;
        this.closeRecipeDetail();
      }
    } catch {
      this.error = 'No se pudo registrar la comida consumida.';
    } finally {
      this.confirmingMeal = false;
    }
  }

  openRecipeDetail(recipe: Recipe): void {
    this.saveCookingProgress();
    this.clearCookingInterval();
    this.detailRecipe = { ...recipe };
    this.portionPreview = null;
    this.portionLoading = false;
    this.portionError = '';
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

  get canAdjustPortions(): boolean {
    return !!this.detailRecipe && recipeCanScale(this.detailRecipe)
      && /^(personalized-.+|[1-9]\d*)$/.test(this.detailRecipe.id);
  }

  get displayedServings(): number | undefined {
    return this.portionPreview?.requestedServings ?? this.detailRecipe?.servings ?? undefined;
  }

  displayedIngredient(index: number): string {
    const active = this.activeIngredients[index];
    if (active === this.detailRecipe?.ingredients[index]) return this.portionPreview?.ingredients?.[index] ?? active;
    const measure = this.substituteMeasure(index);
    return measure ? measure + ' de ' + active : active;
  }

  private substituteMeasure(index: number): string {
    const source = this.portionPreview ?? this.detailRecipe;
    return ingredientMeasure(source?.ingredients?.[index], source?.ingredientData?.[index]);
  }

  async changeServings(change: number): Promise<void> {
    const recipe = this.detailRecipe;
    const userId = this.eatWellService.getActiveUser()?.id;
    const target = (this.displayedServings ?? 1) + change;
    if (!recipe || !userId || !this.canAdjustPortions || this.portionLoading || target < 1 || target > 12) return;
    this.portionError = '';
    if (target === recipe.servings) {
      this.portionPreview = null;
      return;
    }
    this.portionLoading = true;
    try {
      const result = await this.eatWellService.getRecipePortions(recipe.id, recipe.id.startsWith('personalized-') ? 'personalized' : 'local', target);
      if (this.detailRecipe !== recipe || this.eatWellService.getActiveUser()?.id !== userId) return;
      if (result.available && result.ingredients?.length) this.portionPreview = result;
      else this.portionError = result.reason ?? 'No se pudieron ajustar las cantidades.';
    } catch {
      if (this.detailRecipe === recipe) this.portionError = 'No se pudieron ajustar las porciones.';
    } finally {
      if (this.detailRecipe === recipe) this.portionLoading = false;
    }
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
    return this.selectedIngredientIndex === null ? '' : this.displayedIngredient(this.selectedIngredientIndex) ?? '';
  }

  get substitutionPortion(): string {
    if (this.selectedIngredientIndex === null) return '';
    const index = this.selectedIngredientIndex;
    return this.substituteMeasure(index);
  }

  get filteredSubstituteOptions(): string[] {
    const term = normalizeIngredient(this.substituteSearchTerm.trim());
    return term ? this.substituteOptions.filter(option => normalizeIngredient(option).includes(term)) : this.substituteOptions;
  }

  updateSubstituteSearch(event: Event): void {
    this.substituteSearchTerm = (event.target as HTMLInputElement).value;
  }

  async openSubstitution(index: number): Promise<void> {
    const ingredient = this.activeIngredients[index];
    const userId = this.eatWellService.getActiveUser()?.id;
    if (!ingredient || !userId) return;

    const original = this.detailRecipe?.ingredientData?.[index]?.name ?? this.detailRecipe?.ingredients[index] ?? ingredient;
    this.selectedIngredientIndex = index;
    this.substituteSearchTerm = '';
    this.substituteGroupLabel = '';
    this.substituteOptions = [];
    this.substitutionError = '';
    this.substitutionLoading = true;
    this.isSubstitutionSheetOpen = true;
    const request = ++this.substitutionRequest;
    try {
      const preferences = await this.eatWellService.getFoodPreferences();
      if (request !== this.substitutionRequest || this.eatWellService.getActiveUser()?.id !== userId) return;
      const group = ingredientAlternatives(original, preferences);
      this.substituteGroupLabel = group.label;
      this.substituteGroupIcon = group.icon;
      this.substituteOptions = group.options.filter(option => normalizeIngredient(option) !== normalizeIngredient(ingredient));
    } catch {
      if (request === this.substitutionRequest) this.substitutionError = 'No se pudieron consultar tus preferencias.';
    } finally {
      if (request === this.substitutionRequest) this.substitutionLoading = false;
    }
  }

  replaceIngredient(substitute: string): void {
    if (this.selectedIngredientIndex === null || !this.substituteOptions.includes(substitute)) return;

    const index = this.selectedIngredientIndex;
    const currentIngredient = this.activeIngredients[index];
    if (!currentIngredient) return;

    this.activeIngredients = this.activeIngredients.map((ingredient, ingredientIndex) =>
      ingredientIndex === index
        ? substitute
        : ingredient,
    );
    this.checkedIngredients.delete(index);
    this.saveCookingProgress();
    this.closeSubstitutionSheet();
  }

  closeSubstitutionSheet(): void {
    ++this.substitutionRequest;
    this.substitutionLoading = false;
    this.substitutionError = '';
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
    return /^(personalized-[1-9]\d*|[1-9]\d*)$/.test(recipe.id)
      && recipe.ingredients.length > 0 && recipe.instructions.length > 0
      && recipeMealTypes(recipe).includes(this.mealType);
  }

  selectionLimitation(recipe: Recipe): string {
    return 'Esta receta no tiene ingredientes o preparación, o no corresponde a esta comida.';
  }

  async loadSuggestions(recoverCache = false): Promise<void> {
    this.isLoading = true;
    this.loadingBackup = null;
    this.error = '';
    try {
      const user = this.eatWellService.getActiveUser();
      if (user) {
        this.consumedMeals = this.eatWellService.getDailyMealLog(this.selectedDate).consumedMeals;
        void Promise.resolve().then(() => this.eatWellService.getGeneralRecipes()).then(recipes => {
          if (this.eatWellService.getActiveUser()?.id === user.id) {
            this.loadingBackup = selectRecipeForMeal(recipes, this.mealType, this.selectedDate);
          }
        }).catch(() => {});
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
      this.mealOptions = recipes;
      this.pinSelectedRecipe(this.mealOptions);
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
      this.pinSelectedRecipe(this.mealOptions);
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
