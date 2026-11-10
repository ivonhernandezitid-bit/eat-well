import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActionSheetController, AlertController, Platform } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { EatWellService, FavoriteRecipe, FoodScanResult, Recipe, SuggestedFoodRecipe, UserProfile, FoodScanHistoryItem } from '../core';
import { recipeMealLabels, recipeMealTypes } from '../core/recipe-meals';
import type { IngredientSubstitute, RecipeIngredientData, RecipeMetadata, RecipeMealType } from '../core/recipe-meals';
import { DailyMealPlan, dailyMealOptions, mealPlanDate } from '../core/daily-meal-plan';
import { ClinicalHistoryData } from '../core/clinical-history';
import { recipeCanScale, RecipePortionPreview } from '../core/recipe-portions';
import { ConsumedMeal, readDailyDashboardLog, recordConsumedMeal } from '../core/daily-dashboard-log';

interface PlanDayOption {
  date: string;
  label: string;
  dayNumber: number;
  isToday: boolean;
}

interface PlanMealSlot {
  type: RecipeMealType;
  label: string;
  icon: string;
  estimatedCalories: number;
}

interface MealCardView extends RecipeMetadata {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  calories?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  source: 'local' | 'ai' | 'favorite';
  favoriteId: string | null;
  ingredients: string[];
  instructions: string[];
}

@Component({
  selector: 'app-plan-alimenticio',
  templateUrl: './plan-alimenticio.page.html',
  styleUrls: ['./plan-alimenticio.page.scss'],
  standalone: false
})
export class PlanAlimenticioPage implements OnInit, OnDestroy {
  @ViewChild('cameraInput') cameraInput?: ElementRef<HTMLInputElement>;
  @ViewChild('galleryInput') galleryInput?: ElementRef<HTMLInputElement>;

  user: UserProfile | null = null;
  recipes: Recipe[] = [];
  generalRecipes: Recipe[] = [];
  scanRecipes: SuggestedFoodRecipe[] = [];
  favoriteRecipes: FavoriteRecipe[] = [];
  searchTerm = '';
  isScanning = false;
  scanPreview: string | null = null;
  scanResult: FoodScanResult | null = null;
  selectedRecipe: MealCardView | null = null;
  portionPreview: RecipePortionPreview | null = null;
  portionLoading = false;
  portionError = '';
  private portionRequest = 0;
  loadingRecipeId: string | null = null;
  isRecipeModalOpen = false;
  isSubstitutionModalOpen = false;
  isLoadingSubstitutes = false;
  selectedIngredient: { name: string; index: number; portion: string } | null = null;
  substituteOptions: IngredientSubstitute[] = [];
  selectedSubstitute: IngredientSubstitute | null = null;
  substituteSearchTerm = '';
  substitutionError = '';
  private substituteRequest = 0;
  selectedFilter: 'all' | 'favorites' | 'history' = 'all';
  scanHistory: FoodScanHistoryItem[] = [];
  clinicalPlanAlerts: string[] = [];
  clinicalHistoryLoadError = '';
  
  isLoadingPersonalized = false;
  personalizedError = '';
  preferencesCompleted = false;
  selectedMealType: RecipeMealType = 'breakfast';
  expandedMealType: RecipeMealType | null = null;
  readonly mealTypes = Object.keys(recipeMealLabels) as RecipeMealType[];
  dailyPlan: DailyMealPlan | null = null;
  planDays = this.createPlanDays();
  readonly planMealSlots: PlanMealSlot[] = [
    { type: 'breakfast', label: 'Desayuno', icon: '🍳', estimatedCalories: 450 },
    { type: 'morning_snack', label: 'Colación 1', icon: '🍎', estimatedCalories: 180 },
    { type: 'lunch', label: 'Comida', icon: '🥗', estimatedCalories: 650 },
    { type: 'afternoon_snack', label: 'Colación 2', icon: '🍇', estimatedCalories: 180 },
    { type: 'dinner', label: 'Cena', icon: '🌙', estimatedCalories: 400 },
  ];
  selectedDate = mealPlanDate();
  consumedMeals: ConsumedMeal[] = [];
  planLoading = false;
  planError = '';
  isManualMealSheetOpen = false;
  manualMealName = '';
  manualMealCalories: number | string | null = null;
  manualMealProtein: number | string | null = null;
  manualMealCarbohydrates: number | string | null = null;
  manualMealFat: number | string | null = null;
  manualMealError = '';
  private manualMealType: RecipeMealType | null = null;
  savingChoiceId: string | null = null;
  private optionsContext = '';
  private optionSets = new Map<string, Recipe[]>();
  private optionRequest = 0;
  private optionLoads = new Map<string, Promise<Recipe[]>>();

  viewMode: 'list' | 'grid' = 'list';
  readonly recipeMealLabels = recipeMealLabels;
  checkedIngredients = new Set<string>();

  activeTimerStep = '';
  timerSecondsLeft = 0;
  timerInterval: any = null;
  isTimerPaused = false;
  timerTotalDuration = 0;

  private activeUserId: string | null = null;
  private activeUserSubscription?: Subscription;
  private mealsLoadInFlight: { userId: string; promise: Promise<void> } | null = null;
  private planRequest = 0;
  private planCalendarTimer?: ReturnType<typeof setInterval>;
  private planCalendarDate = mealPlanDate();
  showDisclaimers = true;
  disclaimersFading = false;
  private disclaimersTimer?: ReturnType<typeof setTimeout>;
  private disclaimersRemovalTimer?: ReturnType<typeof setTimeout>;
  selectedPlanMealType: RecipeMealType | null = null;

  private readonly eatWellService = inject(EatWellService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly platform = inject(Platform);

  ngOnInit(): void {
    this.planCalendarTimer = setInterval(() => this.refreshPlanCalendar(), 60_000);
    this.disclaimersTimer = setTimeout(() => {
      this.showDisclaimers = false;
      this.disclaimersFading = true;
      this.disclaimersRemovalTimer = setTimeout(() => {
        this.disclaimersFading = false;
      }, 450);
    }, 10_000);
    this.activeUserSubscription = this.eatWellService.activeUser$.subscribe(user => {
      this.user = user;
      const nextUserId = user?.id ?? null;

      if (nextUserId !== this.activeUserId) {
        this.activeUserId = nextUserId;
        this.resetMealState();
        if (user) {
          void this.loadMealsForUser(user);
        }
      }
    });
  }

  ionViewWillEnter(): void {
    this.refreshPlanCalendar();
    if (this.user) {
      void this.loadMealsForUser(this.user);
    }
  }

  ngOnDestroy(): void {
    this.resetPortionPreview();
    this.activeUserSubscription?.unsubscribe();
    if (this.planCalendarTimer) clearInterval(this.planCalendarTimer);
    if (this.disclaimersTimer) clearTimeout(this.disclaimersTimer);
    if (this.disclaimersRemovalTimer) clearTimeout(this.disclaimersRemovalTimer);
    this.stopTimer();
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'list' ? 'grid' : 'list';
  }

  get planMealCards(): Array<PlanMealSlot & { recipe: Recipe | null; consumedMeal: ConsumedMeal | null; isConsumed: boolean; calories: number }> {
    const meals = Array.isArray(this.dailyPlan?.meals) ? this.dailyPlan.meals : [];
    const choices = this.dailyPlan?.choices ?? {};
    const consumedMeals = Array.isArray(this.consumedMeals) ? this.consumedMeals : [];
    return this.planMealSlots.map(slot => {
      const planMeal = meals.find(meal => meal.mealType === slot.type);
      const recipe = planMeal?.recipe ?? choices[slot.type] ?? null;
      const consumedMeal = consumedMeals.find(meal => meal.mealType === slot.type || (!!recipe && meal.id === recipe.id)) ?? null;
      return {
        ...slot,
        recipe,
        consumedMeal,
        isConsumed: !!consumedMeal,
        calories: consumedMeal?.calories ?? recipe?.calories ?? slot.estimatedCalories,
      };
    });
  }

  get selectedPlanDateLabel(): string {
    return new Date(`${this.selectedDate}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  async selectPlanDay(day: PlanDayOption): Promise<void> {
    const dateChanged = day.date !== this.selectedDate;
    this.selectedDate = day.date;
    if (dateChanged) this.dailyPlan = null;
    this.planError = '';
    this.consumedMeals = this.user ? readDailyDashboardLog(this.user.id, day.date).consumedMeals : [];
    if (this.user) await this.loadPlanForDate(this.user, day.date);
  }

  private createPlanDays(): PlanDayOption[] {
    const today = new Date();
    const firstDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const todayKey = mealPlanDate(today);
    const todayWeekday = (today.getDay() + 6) % 7;
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(firstDate);
      const daysUntil = (index - todayWeekday + 7) % 7;
      date.setDate(firstDate.getDate() + daysUntil);
      return {
        date: mealPlanDate(date),
        label: labels[date.getDay()],
        dayNumber: date.getDate(),
        isToday: mealPlanDate(date) === todayKey,
      };
    });
  }

  private refreshPlanCalendar(): void {
    const today = mealPlanDate();
    if (today === this.planCalendarDate) return;
    this.planCalendarDate = today;
    this.planDays = this.createPlanDays();

    if (this.selectedDate < today) {
      this.selectedDate = today;
      this.dailyPlan = null;
      this.consumedMeals = this.user ? readDailyDashboardLog(this.user.id, today).consumedMeals : [];
      if (this.user) void this.loadPlanForDate(this.user, today);
    }
  }

  private async loadPlanForDate(user: UserProfile, date: string): Promise<DailyMealPlan | null> {
    const request = ++this.planRequest;
    this.planLoading = true;
    this.planError = '';
    try {
      const plan = await this.eatWellService.getDailyMealPlan(date);
      if (request === this.planRequest && this.activeUserId === user.id && this.selectedDate === date) {
        this.dailyPlan = plan;
        return plan;
      }
      return null;
    } catch (error) {
      if (request === this.planRequest && this.activeUserId === user.id && this.selectedDate === date) {
        this.planError = error instanceof Error ? error.message : 'No se pudo cargar el plan de este día.';
      }
      return null;
    } finally {
      if (request === this.planRequest) this.planLoading = false;
    }
  }

  private toMealCard(recipe: Recipe): MealCardView {
    return {
      ...this.mealMetadata(recipe),
      calories: recipe.calories,
      proteinGrams: recipe.proteinGrams,
      carbsGrams: recipe.carbsGrams,
      fatGrams: recipe.fatGrams,
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      imageUrl: null,
      source: 'ai',
      favoriteId: this.findFavoriteId(recipe.title),
      ingredients: [...recipe.ingredients],
      instructions: [...recipe.instructions],
    };
  }

  private optionalNumber(value: number | string | null): number | null {
    if (value === null || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  async abrirSugerencias(tipoComida: RecipeMealType, kcal: number): Promise<void> {
    if (!this.user) {
      await this.showError('Inicia sesión para consultar y guardar tu plan alimenticio.');
      return;
    }

    await this.router.navigate(['sugerencias', tipoComida, kcal], {
      relativeTo: this.route,
      queryParams: { date: this.selectedDate },
    });
  }

  get selectedRecipeIsConsumed(): boolean {
    if (!this.selectedRecipe) return false;
    return this.consumedMeals.some(meal =>
      this.selectedPlanMealType ? meal.mealType === this.selectedPlanMealType : meal.id === this.selectedRecipe?.id,
    );
  }

  async markSelectedRecipeConsumed(): Promise<void> {
    const recipe = this.selectedRecipe;
    const userId = this.user?.id;
    if (!recipe || !userId || !this.selectedPlanMealType || this.selectedRecipeIsConsumed) return;
    const slot = this.planMealSlots.find(item => item.type === this.selectedPlanMealType);
    const meal: ConsumedMeal = {
      id: recipe.id,
      title: recipe.title,
      mealType: this.selectedPlanMealType,
      calories: recipe.calories ?? slot?.estimatedCalories ?? null,
      protein: recipe.proteinGrams ?? null,
      carbohydrates: recipe.carbsGrams ?? null,
      fat: recipe.fatGrams ?? null,
      nutritionSource: recipe.nutrition?.source === 'BAM' ? 'BAM' : 'estimate',
    };
    try {
      this.consumedMeals = recordConsumedMeal(userId, this.selectedDate, meal).consumedMeals;
      this.closeRecipe();
    } catch (error) {
      await this.showError(error instanceof Error ? error.message : 'No se pudo registrar la comida consumida.');
    }
  }

  openManualMealSheet(): void {
    this.manualMealType = this.selectedPlanMealType;
    this.closeRecipe();
    this.manualMealName = '';
    this.manualMealCalories = null;
    this.manualMealProtein = null;
    this.manualMealCarbohydrates = null;
    this.manualMealFat = null;
    this.manualMealError = '';
    this.isManualMealSheetOpen = true;
  }

  saveManualMeal(): void {
    const userId = this.user?.id;
    const name = this.manualMealName.trim();
    const calories = this.optionalNumber(this.manualMealCalories);
    if (!userId || !name || calories === null) {
      this.manualMealError = 'Escribe el nombre del platillo y sus calorías (un valor igual o mayor que cero).';
      return;
    }

    const meal: ConsumedMeal = {
      id: `manual-${Date.now()}`,
      title: name,
      ...(this.manualMealType ? { mealType: this.manualMealType } : {}),
      calories,
      protein: this.optionalNumber(this.manualMealProtein),
      carbohydrates: this.optionalNumber(this.manualMealCarbohydrates),
      fat: this.optionalNumber(this.manualMealFat),
      nutritionSource: 'manual',
    };
    try {
      this.consumedMeals = recordConsumedMeal(userId, this.selectedDate, meal).consumedMeals;
      this.isManualMealSheetOpen = false;
    } catch (error) {
      this.manualMealError = error instanceof Error ? error.message : 'No se pudo guardar la comida.';
    }
  }

  closeManualMealSheet(): void {
    this.isManualMealSheetOpen = false;
    this.manualMealError = '';
  }

  async toggleMealType(type: RecipeMealType): Promise<void> {
    if (this.expandedMealType === type) {
      this.expandedMealType = null;
      ++this.optionRequest;
      this.isLoadingPersonalized = false;
      return;
    }
    this.selectedMealType = type;
    this.expandedMealType = type;
    if (this.user && this.preferencesCompleted) await this.loadMealOptions(this.user);
  }

  chosenMealTitle(type: RecipeMealType): string {
    return this.dailyPlan?.date === this.selectedDate ? this.dailyPlan.choices[type]?.title ?? '' : '';
  }

  isMealChosen(recipe: MealCardView): boolean {
    return this.dailyPlan?.date === this.selectedDate && this.dailyPlan.choices[this.selectedMealType]?.id === recipe.id;
  }

  async chooseMeal(recipe: MealCardView): Promise<boolean> {
    if (!this.user || this.savingChoiceId) return false;
    const userId = this.user.id;
    const type = this.selectedMealType;
    const date = this.selectedDate;
    const remove = this.isMealChosen(recipe);
    this.savingChoiceId = recipe.id;
    try {
      const plan = remove
        ? await this.eatWellService.clearDailyMeal(type, date)
        : await this.eatWellService.chooseDailyMeal(type, recipe.id, date);
      if (this.activeUserId === userId && plan.date === this.selectedDate) this.dailyPlan = plan;
      return true;
    } catch (error) {
      if (this.activeUserId === userId) await this.showError(error instanceof Error ? error.message : 'No se pudo guardar tu eleccion.');
      return false;
    } finally {
      if (this.activeUserId === userId) this.savingChoiceId = null;
    }
  }

  private async loadMealOptions(user: UserProfile): Promise<Recipe[]> {
    const type = this.selectedMealType;
    const date = this.selectedDate;
    const version = ++this.optionRequest;
    const context = this.optionsContext;
    const key = `${user.id}:${context}:${date}:${type}`;
    this.recipes = this.optionSets.get(key) ?? [];
    this.personalizedError = '';
    this.isLoadingPersonalized = this.recipes.length === 0;
    if (this.recipes.length) return this.recipes;
    let request = this.optionLoads.get(key);
    if (!request) {
      request = this.eatWellService.getMealOptions(type, date);
      this.optionLoads.set(key, request);
    }
    try {
      const recipes = await request;
      if (this.activeUserId === user.id && this.optionsContext === context) this.optionSets.set(key, recipes);
      if (version === this.optionRequest && this.activeUserId === user.id) this.recipes = recipes;
      return recipes;
    } catch (error) {
      if (version === this.optionRequest && this.activeUserId === user.id) this.personalizedError = error instanceof Error ? error.message : 'No se pudieron generar tus opciones. Vuelve a entrar al plan para reintentar.';
      return [];
    } finally {
      if (this.optionLoads.get(key) === request) this.optionLoads.delete(key);
      if (version === this.optionRequest && this.activeUserId === user.id) this.isLoadingPersonalized = false;
    }
  }

  toggleIngredient(ingredient: string): void {
    if (this.checkedIngredients.has(ingredient)) {
      this.checkedIngredients.delete(ingredient);
    } else {
      this.checkedIngredients.add(ingredient);
    }
  }

  get filteredSubstituteOptions(): IngredientSubstitute[] {
    const term = this.substituteSearchTerm.trim().toLocaleLowerCase();
    return term
      ? this.substituteOptions.filter(option => option.name.toLocaleLowerCase().includes(term))
      : this.substituteOptions;
  }

  async openSubstitution(ingredient: string, index: number, event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.selectedRecipe || !this.canSubstituteIngredient) return;

    const ingredientData = this.selectedRecipe.ingredientData?.[index];
    this.selectedIngredient = {
      name: ingredientData?.name || ingredient,
      index,
      portion: ingredientData?.quantity != null
        ? `${ingredientData.quantity} ${ingredientData.unit ?? ''}`.trim()
        : this.getTextPortion(ingredient) || 'Porción no especificada',
    };
    this.substituteOptions = [];
    this.selectedSubstitute = null;
    this.substituteSearchTerm = '';
    this.substitutionError = '';
    this.isSubstitutionModalOpen = true;
    this.isLoadingSubstitutes = true;
    const request = ++this.substituteRequest;

    try {
      const options = await this.eatWellService.obtenerSustitutos(
        ingredientData?.foodId ?? ingredient,
      );
      if (request === this.substituteRequest) this.substituteOptions = options;
    } catch (error) {
      if (request === this.substituteRequest) {
        this.substitutionError = error instanceof Error
          ? error.message
          : 'No se pudieron cargar los sustitutos.';
      }
    } finally {
      if (request === this.substituteRequest) this.isLoadingSubstitutes = false;
    }
  }

  confirmSubstitution(): void {
    if (!this.selectedRecipe || !this.selectedIngredient || !this.selectedSubstitute || !this.canSubstituteIngredient) return;
    this.resetPortionPreview();

    const { index } = this.selectedIngredient;
    const substitute = this.selectedSubstitute;
    this.checkedIngredients.delete(this.selectedRecipe.ingredients[index]);
    const portion = substitute.quantity != null
      ? `${substitute.quantity} ${substitute.unit ?? ''}`.trim()
      : 'Porción no especificada';
    const nextIngredient = `${substitute.name} (${portion})`;

    this.selectedRecipe.ingredients = this.selectedRecipe.ingredients.map((ingredient, ingredientIndex) =>
      ingredientIndex === index ? nextIngredient : ingredient,
    );
    const ingredientData: RecipeIngredientData = {
      foodId: substitute.foodId,
      name: substitute.name,
      quantity: substitute.quantity,
      unit: substitute.unit,
    };
    const nextIngredientData = [...(this.selectedRecipe.ingredientData ?? [])];
    nextIngredientData[index] = ingredientData;
    this.selectedRecipe.ingredientData = nextIngredientData;
    this.closeSubstitution();
  }

  closeSubstitution(): void {
    ++this.substituteRequest;
    this.isSubstitutionModalOpen = false;
    this.isLoadingSubstitutes = false;
    this.selectedIngredient = null;
    this.selectedSubstitute = null;
    this.substituteOptions = [];
    this.substituteSearchTerm = '';
    this.substitutionError = '';
  }

  private getTextPortion(ingredient: string): string {
    const match = ingredient.match(/(?:\d+\s*(?:\/\s*\d+)?(?:[.,]\d+)?\s*(?:g|kg|ml|l|tazas?|cucharadas?|cucharaditas?|piezas?|unidades?)?)/i);
    return match?.[0]?.trim() ?? '';
  }

  parseMinutes(instruction: string): number | null {
    const match = instruction.match(/(\d+)\s*(?:minutos|min|m)\b/i);
    return match ? parseInt(match[1], 10) : null;
  }

  startCookingTimer(minutes: number, stepText: string): void {
    this.stopTimer();
    this.activeTimerStep = stepText;
    this.timerTotalDuration = minutes * 60;
    this.timerSecondsLeft = minutes * 60;
    this.isTimerPaused = false;

    this.timerInterval = setInterval(() => {
      if (!this.isTimerPaused && this.timerSecondsLeft > 0) {
        this.timerSecondsLeft--;
        if (this.timerSecondsLeft === 0) {
          this.stopTimer();
          void this.playTimerAlert();
        }
      }
    }, 1000);
  }

  pauseTimer(): void {
    this.isTimerPaused = true;
  }

  resumeTimer(): void {
    this.isTimerPaused = false;
  }

  stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timerSecondsLeft = 0;
    this.activeTimerStep = '';
    this.isTimerPaused = false;
    this.timerTotalDuration = 0;
  }

  get timerProgress(): number {
    if (this.timerTotalDuration === 0) return 0;
    return this.timerSecondsLeft / this.timerTotalDuration;
  }

  get timerDisplay(): string {
    const minutes = Math.floor(this.timerSecondsLeft / 60);
    const seconds = this.timerSecondsLeft % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  private async playTimerAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: '¡Tiempo terminado!',
      message: 'El paso de cocción ha finalizado.',
      buttons: ['Entendido']
    });
    await alert.present();
  }

  get scanMeals(): MealCardView[] {
    const term = this.searchTerm.trim().toLowerCase();
    const list: MealCardView[] = this.scanRecipes.map(recipe => ({
      ...this.mealMetadata(recipe),
      calories: recipe.nutrition?.perServing.calories ?? null,
      proteinGrams: recipe.nutrition?.perServing.proteinGrams ?? null,
      carbsGrams: recipe.nutrition?.perServing.carbsGrams ?? null,
      fatGrams: recipe.nutrition?.perServing.fatGrams ?? null,
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl || null,
      source: 'ai' as const,
      favoriteId: this.findFavoriteId(recipe.title),
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
    }));

    if (!term) {
      return list;
    }

    return list.filter(recipe =>
      recipe.title.toLowerCase().includes(term) ||
      recipe.description.toLowerCase().includes(term) ||
      recipe.ingredients.some(ing => ing.toLowerCase().includes(term))
    );
  }

  get aiMeals(): MealCardView[] {
    const term = this.searchTerm.trim().toLowerCase();
    const chosen = this.dailyPlan?.date === this.selectedDate ? this.dailyPlan.choices[this.selectedMealType] : undefined;
    const list: MealCardView[] = dailyMealOptions(this.recipes, chosen).map(recipe => ({
      ...this.mealMetadata(recipe),
      calories: recipe.calories,
      proteinGrams: recipe.proteinGrams,
      carbsGrams: recipe.carbsGrams,
      fatGrams: recipe.fatGrams,
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      imageUrl: null,
      source: 'ai' as const,
      favoriteId: this.findFavoriteId(recipe.title),
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
    }));

    if (!term) {
      return list;
    }

    return list.filter(recipe =>
      recipe.title.toLowerCase().includes(term) ||
      recipe.description.toLowerCase().includes(term) ||
      recipe.ingredients.some(ing => ing.toLowerCase().includes(term))
    );
  }

  get favoriteMeals(): MealCardView[] {
    const term = this.searchTerm.trim().toLowerCase();
    const list: MealCardView[] = this.favoriteRecipes.map(recipe => ({
      ...this.mealMetadata(recipe),
      calories: recipe.nutrition?.perServing.calories ?? null,
      proteinGrams: recipe.nutrition?.perServing.proteinGrams ?? null,
      carbsGrams: recipe.nutrition?.perServing.carbsGrams ?? null,
      fatGrams: recipe.nutrition?.perServing.fatGrams ?? null,
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl || null,
      source: 'favorite' as const,
      favoriteId: recipe.favoriteId,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
    }));

    if (!term) {
      return list;
    }

    return list.filter(recipe =>
      recipe.title.toLowerCase().includes(term) ||
      recipe.description.toLowerCase().includes(term) ||
      recipe.ingredients.some(ing => ing.toLowerCase().includes(term))
    );
  }

  get suggestedMeals(): MealCardView[] {
    const term = this.searchTerm.trim().toLowerCase();
    const list: MealCardView[] = this.generalRecipes
      .filter(recipe => !this.favoriteRecipes.some(favorite => favorite.title === recipe.title))
      .map(recipe => ({
        ...this.mealMetadata(recipe),
        calories: recipe.calories,
        proteinGrams: recipe.proteinGrams,
        carbsGrams: recipe.carbsGrams,
        fatGrams: recipe.fatGrams,
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        imageUrl: null,
        source: 'local' as const,
        favoriteId: this.findFavoriteId(recipe.title),
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
      }));

    if (!term) {
      return list;
    }

    return list.filter(recipe =>
      recipe.title.toLowerCase().includes(term) ||
      recipe.description.toLowerCase().includes(term) ||
      recipe.ingredients.some(ing => ing.toLowerCase().includes(term))
    );
  }

  async scanFood(): Promise<void> {
    if (this.isScanning) {
      return;
    }

    const isMobile = this.platform.is('cordova') || this.platform.is('capacitor') || this.platform.is('mobile') || 
                     /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      const actionSheet = await this.actionSheetController.create({
        header: 'Escanear comida',
        buttons: [
          {
            text: 'Tomar foto',
            icon: 'camera-outline',
            handler: () => {
              this.cameraInput?.nativeElement.click();
            }
          },
          {
            text: 'Seleccionar de la galería',
            icon: 'image-outline',
            handler: () => {
              this.galleryInput?.nativeElement.click();
            }
          },
          {
            text: 'Cancelar',
            role: 'cancel',
            icon: 'close-outline'
          }
        ]
      });
      await actionSheet.present();
    } else {
      this.galleryInput?.nativeElement.click();
    }
  }

  async onFoodImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      await this.showError('Selecciona una fotografia valida.');
      input.value = '';
      return;
    }

    this.isScanning = true;
    this.scanResult = null;

    try {
      this.scanPreview = await this.resizeFoodImage(file);
      this.scanResult = await this.eatWellService.scanFoodImage({
        imageBase64: this.scanPreview,
      });
      this.scanRecipes = this.scanResult.suggestedRecipes;
      void this.loadScanHistory();
    } catch (error) {
      this.scanPreview = null;
      await this.showError(error instanceof Error ? error.message : 'No se pudo analizar la imagen.');
    } finally {
      this.isScanning = false;
      input.value = '';
    }
  }

  clearScan(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.scanPreview = null;
    this.scanResult = null;
    this.scanRecipes = [];
  }

  async showFullScanDetails(): Promise<void> {
    if (this.isScanning || !this.scanResult) {
      return;
    }

    let cleanRecommendation = this.scanResult.recommendation;
    const transitionPhrases = [
      /aquí tienes (?:cinco|5) recetas.*/i,
      /a continuación te (?:presento|muestro|sugiero) (?:cinco|5) recetas.*/i,
      /aquí tienes algunas recetas.*/i,
      /estas son las recetas.*/i,
      /aquí tienes (?:cinco|5) sugerencias.*/i
    ];
    for (const regex of transitionPhrases) {
      cleanRecommendation = cleanRecommendation.replace(regex, '').trim();
    }

    cleanRecommendation = cleanRecommendation.replace(/[,;.:\-#\s]+$/, '.');

    const alert = await this.alertController.create({
      header: this.scanResult.foodName || 'Detalles del escaneo',
      message: cleanRecommendation,
      buttons: ['Aceptar']
    });
    await alert.present();
  }

  async toggleFavorite(recipe: MealCardView, event: Event): Promise<void> {
    event.stopPropagation();

    try {
      if (recipe.favoriteId) {
        await this.eatWellService.removeFavoriteRecipe(recipe.favoriteId);
        this.favoriteRecipes = this.favoriteRecipes.filter(item => item.favoriteId !== recipe.favoriteId);
        return;
      }

      const favorite = await this.eatWellService.addFavoriteRecipe({
        ...this.mealMetadata(recipe),
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        imageUrl: recipe.imageUrl ?? '',
        sourceUrl: '',
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        detailsLoaded: true,
      }, recipe.source);
      this.favoriteRecipes = [favorite, ...this.favoriteRecipes.filter(item => item.title !== favorite.title)];
    } catch (error) {
      await this.showError(error instanceof Error ? error.message : 'No se pudo actualizar favoritos.');
    }
  }

  async openRecipe(recipe: MealCardView, planMealType: RecipeMealType | null = null): Promise<void> {
    if (this.loadingRecipeId) {
      return;
    }

    this.selectedPlanMealType = planMealType;
    this.checkedIngredients.clear();
    this.resetPortionPreview();
    this.stopTimer();

    if (recipe.source === 'local' || recipe.ingredients.length > 0 || recipe.instructions.length > 0) {
      this.selectedRecipe = {
        ...recipe,
        ingredients: [...recipe.ingredients],
        ingredientData: recipe.ingredientData?.map(item => ({ ...item })),
      };
      this.isRecipeModalOpen = true;
      return;
    }

    this.loadingRecipeId = recipe.id;

    try {
      const details = await this.eatWellService.getSavedFoodRecipeDetail(recipe.id);
      this.scanRecipes = this.scanRecipes.map(savedRecipe =>
        savedRecipe.id === details.id ? details : savedRecipe,
      );
      this.selectedRecipe = {
        ...this.mealMetadata(details),
        calories: details.nutrition?.perServing.calories ?? null,
        proteinGrams: details.nutrition?.perServing.proteinGrams ?? null,
        carbsGrams: details.nutrition?.perServing.carbsGrams ?? null,
        fatGrams: details.nutrition?.perServing.fatGrams ?? null,
        id: details.id,
        title: details.title,
        description: details.description,
        imageUrl: details.imageUrl || null,
        source: 'ai',
        favoriteId: this.findFavoriteId(details.title),
        ingredients: [...details.ingredients],
        instructions: details.instructions,
        ingredientData: details.ingredientData?.map(item => ({ ...item })),
      };
      this.isRecipeModalOpen = true;
    } catch (error) {
      await this.showError(error instanceof Error ? error.message : 'No se pudo cargar la receta.');
    } finally {
      this.loadingRecipeId = null;
    }
  }

  closeRecipe(): void {
    this.resetPortionPreview();
    this.isRecipeModalOpen = false;
    this.closeSubstitution();
    this.selectedRecipe = null;
    this.selectedPlanMealType = null;
    this.stopTimer();
  }

  private mealMetadata(recipe: RecipeMetadata & { title: string; description: string }): RecipeMetadata {
    return { mealTypes: recipeMealTypes(recipe), servings: recipe.servings, preparationMinutes: recipe.preparationMinutes, validationNotes: recipe.validationNotes, ingredientData: recipe.ingredientData, nutrition: recipe.nutrition };
  }

  get canAdjustPortions(): boolean {
    return !!this.selectedRecipe && recipeCanScale(this.selectedRecipe);
  }

  get canSubstituteIngredient(): boolean {
    return !this.portionLoading && (!this.portionPreview || this.displayedServings === this.selectedRecipe?.servings);
  }

  get displayedServings(): number {
    return this.portionPreview?.requestedServings ?? this.selectedRecipe?.servings ?? 1;
  }

  get displayedIngredients(): string[] {
    return this.portionPreview?.ingredients ?? this.selectedRecipe?.ingredients ?? [];
  }

  ingredientPortion(index: number, ingredient: string): string {
    const data = this.portionPreview?.ingredientData?.[index] ?? this.selectedRecipe?.ingredientData?.[index];
    if (data?.quantity != null && data.unit) return `Cantidad de receta: ${data.quantity} ${data.unit}`;
    return this.getTextPortion(ingredient) || 'Porción no especificada';
  }

  async changeRecipeServings(change: number): Promise<void> {
    const recipe = this.selectedRecipe;
    const userId = this.user?.id;
    const target = this.displayedServings + change;
    if (!recipe || !userId || !this.canAdjustPortions || this.portionLoading || this.isSubstitutionModalOpen || !Number.isInteger(target) || target < 1 || target > 12) return;
    const version = ++this.portionRequest;
    this.portionLoading = true;
    this.portionError = '';
    const source = recipe.id.startsWith('personalized-') ? 'personalized' : recipe.id.startsWith('favorite-') ? 'favorite' : recipe.source === 'local' ? 'local' : 'scan';
    try {
      const preview = await this.eatWellService.getRecipePortions(recipe.id,source,target);
      if (version !== this.portionRequest || this.user?.id !== userId || this.selectedRecipe !== recipe || !this.isRecipeModalOpen) return;
      if (!preview.available) { this.portionError = preview.reason ?? 'No se pudieron ajustar las cantidades.'; return; }
      this.portionPreview = preview;
      this.checkedIngredients.clear();
    } catch (error) {
      if (version === this.portionRequest && this.user?.id === userId) this.portionError = error instanceof Error ? error.message : 'No se pudieron ajustar las porciones.';
    } finally { if (version === this.portionRequest) this.portionLoading = false; }
  }

  private resetPortionPreview(): void {
    ++this.portionRequest;
    this.portionPreview = null;
    this.portionLoading = false;
    this.portionError = '';
  }

  private findFavoriteId(title: string): string | null {
    return this.favoriteRecipes.find(recipe => recipe.title === title)?.favoriteId ?? null;
  }

  private resetMealState(): void {
    this.resetPortionPreview();
    ++this.optionRequest;
    this.optionSets.clear();
    this.optionsContext = '';
    this.dailyPlan = null;
    this.savingChoiceId = null;
    this.selectedMealType = 'breakfast';
    this.expandedMealType = null;
    this.personalizedError = '';
    this.recipes = [];
    this.generalRecipes = [];
    this.scanRecipes = [];
    this.favoriteRecipes = [];
    this.scanHistory = [];
    this.scanPreview = null;
    this.scanResult = null;
    this.selectedRecipe = null;
    this.closeSubstitution();
    this.loadingRecipeId = null;
    this.isRecipeModalOpen = false;
    this.isLoadingPersonalized = false;
    this.preferencesCompleted = false;
    this.clinicalPlanAlerts = [];
    this.clinicalHistoryLoadError = '';
    this.consumedMeals = [];
    this.planError = '';
    this.planLoading = false;
    this.selectedDate = mealPlanDate();
    this.selectedPlanMealType = null;
    this.manualMealType = null;
    this.isManualMealSheetOpen = false;
    ++this.planRequest;
    this.stopTimer();
  }

  private async loadMealsForUser(user: UserProfile): Promise<void> {
    if (this.mealsLoadInFlight?.userId === user.id) {
      await this.mealsLoadInFlight.promise;
      return;
    }

    const promise = this.fetchMealsForUser(user);
    this.mealsLoadInFlight = { userId: user.id, promise };

    try {
      await promise;
    } finally {
      if (this.mealsLoadInFlight?.promise === promise) {
        this.mealsLoadInFlight = null;
      }
    }
  }

  private async fetchMealsForUser(user: UserProfile): Promise<void> {
    this.clinicalPlanAlerts = [];
    this.clinicalHistoryLoadError = '';

    try {
      const [prefs, general, favorites, scanHistory, dailyPlan, lifestyle, clinicalHistory] = await Promise.all([
        this.eatWellService.getFoodPreferences().catch(() => null),
        this.eatWellService.getGeneralRecipes(),
        this.eatWellService.getFavoriteRecipes(),
        this.eatWellService.getScanHistory().catch(error => {
          console.error('Error loading scan history', error);
          return [];
        }),
        this.eatWellService.getDailyMealPlan(),
        this.eatWellService.getLifestyleGoals().catch(() => null),
        this.eatWellService.getClinicalHistory().catch(error => {
          console.error('Error loading clinical history for meal guidance', error);
          return null;
        }),
      ]);

      if (this.activeUserId !== user.id) {
        return;
      }

      this.preferencesCompleted = prefs?.completed ?? false;
      this.setClinicalPlanAlerts(clinicalHistory?.history ?? null, clinicalHistory !== null);
      this.generalRecipes = general;
      this.favoriteRecipes = favorites;
      this.scanHistory = scanHistory;
      this.dailyPlan = dailyPlan.date === this.selectedDate ? dailyPlan : null;
      this.consumedMeals = readDailyDashboardLog(user.id, this.selectedDate).consumedMeals;
      const context = JSON.stringify([user, prefs, lifestyle?.settings]);
      if (context !== this.optionsContext) { this.optionsContext = context; this.optionSets.clear(); }

      if (this.preferencesCompleted && this.expandedMealType) {
        await this.loadMealOptions(user);
      } else {
        this.recipes = [];
        this.personalizedError = '';
      }
    } catch (error) {
      if (this.activeUserId === user.id) {
        this.recipes = [];
        await this.showError(error instanceof Error ? error.message : 'No se pudieron cargar las recetas.');
      }
    }
  }

  private setClinicalPlanAlerts(history: ClinicalHistoryData | null, loaded: boolean): void {
    if (!loaded) {
      this.clinicalHistoryLoadError = 'No se pudo consultar tu historial clínico; las sugerencias no incluirán ajustes según tus condiciones.';
      return;
    }
    if (!history) return;

    const hasThyroidCondition = history.diagnosisHypothyroidism || history.diagnosisHyperthyroidism;
    const hasRenalCondition = history.diagnosisChronicKidneyDisease || history.diagnosisKidneyStones;
    const hasClinicalConditions = [
      history.diagnosisDiabetes,
      history.diagnosisInsulinResistance,
      hasThyroidCondition,
      history.diagnosisHypertension,
      history.diagnosisDyslipidemia,
      history.diagnosisFattyLiver,
      history.diagnosisGout,
      hasRenalCondition,
    ].some(Boolean);

    if (!hasClinicalConditions) return;
    if (hasThyroidCondition) {
      this.clinicalPlanAlerts.push('Las calorías estimadas no se ajustan automáticamente por una condición tiroidea. Consulta con tu profesional de salud para una valoración individual.');
    }
    if (hasRenalCondition) {
      this.clinicalPlanAlerts.push('En enfermedad renal o litiasis, no se fijan límites automáticos de proteína, sodio, potasio, fósforo u oxalatos; sigue la pauta indicada por tu equipo médico.');
    }
  }

  private resizeFoodImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        URL.revokeObjectURL(objectUrl);

        if (!context) {
          reject(new Error('No se pudo preparar la fotografia.'));
          return;
        }

        canvas.width = width;
        canvas.height = height;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('No se pudo leer la fotografia.'));
      };

      image.src = objectUrl;
    });
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Escaner de alimentos',
      message,
      buttons: ['Aceptar'],
    });
    await alert.present();
  }

  async loadScanHistory(): Promise<void> {
    if (!this.activeUserId) {
      return;
    }
    try {
      this.scanHistory = await this.eatWellService.getScanHistory();
    } catch (error) {
      console.error('Error loading scan history', error);
    }
  }

  async openScanHistoryItem(scan: FoodScanHistoryItem): Promise<void> {
    this.isScanning = true;
    this.scanResult = null;
    try {
      const recommendations = await this.eatWellService.getSavedFoodRecommendations(scan.id);
      
      this.scanPreview = scan.imageUrl || 'assets/images/default-food.jpg';
      this.scanResult = {
        status: 'analyzed',
        foodName: scan.detectedFood,
        detectedIngredients: scan.detectedIngredients,
        recommendation: scan.aiRecommendation,
        suggestedRecipes: recommendations
      };
      this.scanRecipes = recommendations;
      this.selectedFilter = 'all';
    } catch (error) {
      await this.showError(error instanceof Error ? error.message : 'No se pudieron cargar las recetas de este escaneo.');
    } finally {
      this.isScanning = false;
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr.replace(' ', 'T'));
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }
}
