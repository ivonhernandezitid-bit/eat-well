import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActionSheetController, AlertController, Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { EatWellService, FavoriteRecipe, FoodScanResult, Recipe, SuggestedFoodRecipe, UserProfile, FoodScanHistoryItem } from '../core';
import { calculateMacroTargets, MacroTargets } from '../core/lifestyle-goals';
import { RecipeMetadata, RecipeMealType, recipeMealLabels, recipeMealTypes } from '../core/recipe-meals';
import { DailyMealPlan, mealPlanDate } from '../core/daily-meal-plan';
import { ClinicalHistoryData } from '../core/clinical-history';

interface MealCardView extends RecipeMetadata {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
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
  loadingRecipeId: string | null = null;
  isRecipeModalOpen = false;
  selectedFilter: 'all' | 'favorites' | 'history' = 'all';
  scanHistory: FoodScanHistoryItem[] = [];
  macroTargets: MacroTargets | null = null;
  clinicalPlanAlerts: string[] = [];
  clinicalHistoryLoadError = '';
  
  isLoadingPersonalized = false;
  personalizedError = '';
  preferencesCompleted = false;
  selectedMealType: RecipeMealType = 'breakfast';
  expandedMealType: RecipeMealType | null = null;
  readonly mealTypes = Object.keys(recipeMealLabels) as RecipeMealType[];
  dailyPlan: DailyMealPlan | null = null;
  savingChoiceId: string | null = null;
  private optionsContext = '';
  private optionSets: Partial<Record<RecipeMealType, Recipe[]>> = {};
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

  private readonly eatWellService = inject(EatWellService);
  private readonly alertController = inject(AlertController);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly platform = inject(Platform);

  ngOnInit(): void {
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
    if (this.user) {
      void this.loadMealsForUser(this.user);
    }
  }

  ngOnDestroy(): void {
    this.activeUserSubscription?.unsubscribe();
    this.stopTimer();
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'list' ? 'grid' : 'list';
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
    return this.dailyPlan?.date === mealPlanDate() ? this.dailyPlan.choices[type]?.title ?? '' : '';
  }

  isMealChosen(recipe: MealCardView): boolean {
    return this.dailyPlan?.date === mealPlanDate() && this.dailyPlan.choices[this.selectedMealType]?.id === recipe.id;
  }

  async chooseMeal(recipe: MealCardView): Promise<void> {
    if (!this.user || this.savingChoiceId) return;
    const userId = this.user.id;
    const type = this.selectedMealType;
    const date = mealPlanDate();
    const remove = this.isMealChosen(recipe);
    this.savingChoiceId = recipe.id;
    try {
      const plan = remove
        ? await this.eatWellService.clearDailyMeal(type, date)
        : await this.eatWellService.chooseDailyMeal(type, recipe.id, date);
      if (this.activeUserId === userId && plan.date === mealPlanDate()) this.dailyPlan = plan;
    } catch (error) {
      if (this.activeUserId === userId) await this.showError(error instanceof Error ? error.message : 'No se pudo guardar tu eleccion.');
    } finally {
      if (this.activeUserId === userId) this.savingChoiceId = null;
    }
  }

  private async loadMealOptions(user: UserProfile): Promise<void> {
    const type = this.selectedMealType;
    const version = ++this.optionRequest;
    const context = this.optionsContext;
    this.recipes = this.optionSets[type] ?? [];
    this.personalizedError = '';
    this.isLoadingPersonalized = this.recipes.length === 0;
    if (this.recipes.length) return;
    const key = `${user.id}:${context}:${type}`;
    let request = this.optionLoads.get(key);
    if (!request) {
      request = this.eatWellService.getMealOptions(type);
      this.optionLoads.set(key, request);
    }
    try {
      const recipes = await request;
      if (this.activeUserId === user.id && this.optionsContext === context) this.optionSets[type] = recipes;
      if (version === this.optionRequest && this.activeUserId === user.id) this.recipes = recipes;
    } catch (error) {
      if (version === this.optionRequest && this.activeUserId === user.id) this.personalizedError = error instanceof Error ? error.message : 'No se pudieron generar tus opciones. Vuelve a entrar al plan para reintentar.';
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
    const list: MealCardView[] = this.recipes.map(recipe => ({
      ...this.mealMetadata(recipe),
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

  async openRecipe(recipe: MealCardView): Promise<void> {
    if (this.loadingRecipeId) {
      return;
    }

    this.checkedIngredients.clear();
    this.stopTimer();

    if (recipe.source === 'local' || recipe.ingredients.length > 0 || recipe.instructions.length > 0) {
      this.selectedRecipe = recipe;
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
        id: details.id,
        title: details.title,
        description: details.description,
        imageUrl: details.imageUrl || null,
        source: 'ai',
        favoriteId: this.findFavoriteId(details.title),
        ingredients: details.ingredients,
        instructions: details.instructions,
      };
      this.isRecipeModalOpen = true;
    } catch (error) {
      await this.showError(error instanceof Error ? error.message : 'No se pudo cargar la receta.');
    } finally {
      this.loadingRecipeId = null;
    }
  }

  closeRecipe(): void {
    this.isRecipeModalOpen = false;
    this.selectedRecipe = null;
    this.stopTimer();
  }

  private mealMetadata(recipe: RecipeMetadata & { title: string; description: string }): RecipeMetadata {
    return { mealTypes: recipeMealTypes(recipe), servings: recipe.servings, preparationMinutes: recipe.preparationMinutes, validationNotes: recipe.validationNotes, ingredientData: recipe.ingredientData, nutrition: recipe.nutrition };
  }

  private findFavoriteId(title: string): string | null {
    return this.favoriteRecipes.find(recipe => recipe.title === title)?.favoriteId ?? null;
  }

  private resetMealState(): void {
    ++this.optionRequest;
    this.optionSets = {};
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
    this.loadingRecipeId = null;
    this.isRecipeModalOpen = false;
    this.isLoadingPersonalized = false;
    this.preferencesCompleted = false;
    this.clinicalPlanAlerts = [];
    this.clinicalHistoryLoadError = '';
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
    this.macroTargets = null;
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
      this.macroTargets = lifestyle?.settings ? calculateMacroTargets(lifestyle.user ?? user, lifestyle.settings) : null;
      this.setClinicalPlanAlerts(clinicalHistory?.history ?? null, clinicalHistory !== null);
      this.generalRecipes = general;
      this.favoriteRecipes = favorites;
      this.scanHistory = scanHistory;
      this.dailyPlan = dailyPlan.date === mealPlanDate() ? dailyPlan : null;
      const context = JSON.stringify([user, prefs, lifestyle?.settings]);
      if (context !== this.optionsContext) { this.optionsContext = context; this.optionSets = {}; }

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
    this.clinicalPlanAlerts.push('Las condiciones registradas orientan la selección de ingredientes, pero el catálogo no permite verificar por completo sodio, azúcares añadidos, grasas saturadas, purinas, potasio, fósforo u oxalatos.');
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
