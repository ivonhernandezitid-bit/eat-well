import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CapacitorPedometer } from '@capgo/capacitor-pedometer';
import { PluginListenerHandle } from '@capacitor/core';
import { Subscription } from 'rxjs';
import { EatWellService, Recipe, UserProfile } from '../core';
import { calculateMacroTargets, loadLifestyleSettings, MacroTargets } from '../core/lifestyle-goals';

interface ConsumedMeal {
  id: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
}

interface DailyDashboardLog {
  date: string;
  consumedMeals: ConsumedMeal[];
  waterGlasses: number;
  exerciseMinutes: number;
  steps: number;
}

type ActivityMode = 'checking' | 'sensor' | 'permission' | 'manual';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit, OnDestroy {
  user: UserProfile | null = null;
  dailyTip = 'Mantén una alimentación variada durante el día.';
  dailyTipIcon = 'sparkles-outline';
  isFading = false;
  recipes: Recipe[] = [];
  macroTargets: MacroTargets = { calories: 2000, protein: 125, carbohydrates: 225, fat: 67 };
  dailyLog: DailyDashboardLog = this.createEmptyDailyLog();
  activityMode: ActivityMode = 'checking';
  activityStatus = 'Comprobando el sensor de pasos';
  readonly waterGoalGlasses = 10;
  readonly stepGoal = 10000;
  readonly exerciseGoalMinutes = 30;
  readonly waterGlassSlots = Array.from({ length: 8 }, (_, index) => index + 1);

  private userSubscription?: Subscription;
  private tipTimer?: ReturnType<typeof setInterval>;
  private pedometerListener?: PluginListenerHandle;
  private pedometerStarted = false;
  private stepSessionBase = 0;
  private activeUserId: string | null = null;
  activeTips: { text: string; icon: string }[] = [];
  currentTipIndex = 0;

  private readonly eatWellService = inject(EatWellService);
  private readonly router = inject(Router);

  ngOnInit() {
    this.userSubscription = this.eatWellService.activeUser$.subscribe((user) => {
      this.user = user;
      const nextUserId = user?.id ?? null;
      if (user && nextUserId !== this.activeUserId) {
        this.activeUserId = user.id;
        this.dailyLog = this.loadDailyLog(user.id);
        this.updateMacroTargets(user);
      }
    });
    
    // Cycle tip automatically every 60 seconds
    this.tipTimer = setInterval(() => this.cycleTip(), 60 * 1000);
  }

  ionViewWillEnter() {
    void this.loadDailyTip();
    if (this.user) {
      this.dailyLog = this.loadDailyLog(this.user.id);
      this.updateMacroTargets(this.user);
      void this.loadRecipes(this.user);
      if (this.activityMode === 'checking') {
        void this.checkActivitySensor();
      } else if (this.activityMode === 'sensor') {
        void this.startPedometer();
      }
    }
  }

  ionViewWillLeave(): void {
    void this.stopPedometer();
  }

  ngOnDestroy() {
    this.userSubscription?.unsubscribe();
    if (this.tipTimer) {
      clearInterval(this.tipTimer);
    }
    void this.stopPedometer();
  }

  get caloriesConsumed(): number {
    return this.dailyLog.consumedMeals.reduce((total, meal) => total + meal.calories, 0);
  }

  get proteinConsumed(): number {
    return this.dailyLog.consumedMeals.reduce((total, meal) => total + meal.protein, 0);
  }

  get carbohydratesConsumed(): number {
    return this.dailyLog.consumedMeals.reduce((total, meal) => total + meal.carbohydrates, 0);
  }

  get fatConsumed(): number {
    return this.dailyLog.consumedMeals.reduce((total, meal) => total + meal.fat, 0);
  }

  get calorieProgress(): number {
    return Math.min(100, Math.round(this.caloriesConsumed / Math.max(1, this.macroTargets.calories) * 100));
  }

  get caloriesRemaining(): number {
    return Math.max(0, this.macroTargets.calories - this.caloriesConsumed);
  }

  get proteinProgress(): number {
    return Math.min(100, Math.round(this.proteinConsumed / Math.max(1, this.macroTargets.protein) * 100));
  }

  get carbohydrateProgress(): number {
    return Math.min(100, Math.round(this.carbohydratesConsumed / Math.max(1, this.macroTargets.carbohydrates) * 100));
  }

  get fatProgress(): number {
    return Math.min(100, Math.round(this.fatConsumed / Math.max(1, this.macroTargets.fat) * 100));
  }

  get waterProgress(): number {
    return Math.min(100, Math.round(this.dailyLog.waterGlasses / this.waterGoalGlasses * 100));
  }

  get activityProgress(): number {
    const value = this.activityMode === 'sensor' ? this.dailyLog.steps : this.dailyLog.exerciseMinutes;
    const goal = this.activityMode === 'sensor' ? this.stepGoal : this.exerciseGoalMinutes;
    return Math.min(100, Math.round(value / goal * 100));
  }

  get activityValue(): number {
    return this.activityMode === 'sensor' ? this.dailyLog.steps : this.dailyLog.exerciseMinutes;
  }

  get nextMeal(): Recipe | null {
    return this.recipes.find(recipe => !this.dailyLog.consumedMeals.some(meal => meal.id === recipe.id)) ?? null;
  }

  get mealTimeLabel(): string {
    const hour = new Date().getHours();
    if (hour < 11) return 'Desayuno';
    if (hour < 17) return 'Comida';
    return 'Cena';
  }

  get mealScheduledTime(): string {
    const hour = new Date().getHours();
    if (hour < 11) return '08:00';
    if (hour < 17) return '14:00';
    return '20:00';
  }

  get waterLiters(): string {
    return (this.dailyLog.waterGlasses * 0.25).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  private createEmptyDailyLog(): DailyDashboardLog {
    return { date: this.localDateKey(), consumedMeals: [], waterGlasses: 0, exerciseMinutes: 0, steps: 0 };
  }

  private localDateKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private dailyLogStorageKey(userId: string): string {
    return `eat-well-home-${userId}-${this.localDateKey()}`;
  }

  private loadDailyLog(userId: string): DailyDashboardLog {
    try {
      const stored = localStorage.getItem(this.dailyLogStorageKey(userId));
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<DailyDashboardLog>;
        return {
          ...this.createEmptyDailyLog(),
          ...parsed,
          date: this.localDateKey(),
          consumedMeals: Array.isArray(parsed.consumedMeals) ? parsed.consumedMeals : [],
          waterGlasses: Math.max(0, Math.min(this.waterGoalGlasses, Number(parsed.waterGlasses) || 0)),
          exerciseMinutes: Math.max(0, Number(parsed.exerciseMinutes) || 0),
          steps: Math.max(0, Number(parsed.steps) || 0),
        };
      }
    } catch {
      localStorage.removeItem(this.dailyLogStorageKey(userId));
    }
    return this.createEmptyDailyLog();
  }

  private saveDailyLog(): void {
    if (this.user) {
      localStorage.setItem(this.dailyLogStorageKey(this.user.id), JSON.stringify(this.dailyLog));
    }
  }

  private updateMacroTargets(user: UserProfile): void {
    const settings = loadLifestyleSettings(user.id) ?? {
      goal: user.goal,
      targetWeightKg: user.weightKg,
      activityBand: 'moderate' as const,
      exerciseTypes: [],
      sessionDuration: 45,
      trainingTime: 'afternoon' as const,
      cookingTime: 'medium' as const,
      stressLevel: 'moderate' as const,
    };
    this.macroTargets = calculateMacroTargets(user, settings);
  }

  private async loadRecipes(user: UserProfile): Promise<void> {
    try {
      const preferences = await this.eatWellService.getFoodPreferences();
      let recipes = preferences.completed ? await this.eatWellService.getPersonalizedRecipes(user) : [];
      if (recipes.length === 0) {
        recipes = await this.eatWellService.getGeneralRecipes();
      }
      if (this.eatWellService.getActiveUser()?.id === user.id) {
        this.recipes = recipes;
      }
    } catch {
      this.recipes = [];
    }
  }

  addWaterGlass(): void {
    this.dailyLog.waterGlasses = Math.min(this.waterGoalGlasses, this.dailyLog.waterGlasses + 1);
    this.saveDailyLog();
  }

  removeWaterGlass(): void {
    this.dailyLog.waterGlasses = Math.max(0, this.dailyLog.waterGlasses - 1);
    this.saveDailyLog();
  }

  markMealConsumed(recipe: Recipe): void {
    if (this.dailyLog.consumedMeals.some(meal => meal.id === recipe.id)) {
      return;
    }
    this.dailyLog.consumedMeals = [...this.dailyLog.consumedMeals, {
      id: recipe.id,
      calories: recipe.calories,
      protein: recipe.proteinGrams,
      carbohydrates: recipe.carbsGrams,
      fat: recipe.fatGrams,
    }];
    this.saveDailyLog();
  }

  addExerciseMinutes(): void {
    this.dailyLog.exerciseMinutes += 10;
    this.saveDailyLog();
  }

  async connectActivitySensor(): Promise<void> {
    try {
      const permission = await CapacitorPedometer.requestPermissions();
      if (permission.activityRecognition !== 'granted') {
        this.activityMode = 'permission';
        this.activityStatus = 'No se concedió el permiso. Puedes registrar minutos manualmente.';
        return;
      }
      await this.startPedometer();
    } catch {
      this.activityMode = 'manual';
      this.activityStatus = 'No fue posible conectar el sensor. Puedes registrar minutos manualmente.';
    }
  }

  private async checkActivitySensor(): Promise<void> {
    try {
      const availability = await CapacitorPedometer.isAvailable();
      if (!availability.stepCounting) {
        this.activityMode = 'manual';
        this.activityStatus = 'El sensor de pasos no está disponible. Puedes registrar minutos manualmente.';
        return;
      }
      const permission = await CapacitorPedometer.checkPermissions();
      if (permission.activityRecognition === 'granted') {
        await this.startPedometer();
      } else {
        this.activityMode = 'permission';
        this.activityStatus = 'Conecta el sensor para contar tus pasos del día.';
      }
    } catch {
      this.activityMode = 'manual';
      this.activityStatus = 'En este dispositivo puedes registrar minutos manualmente.';
    }
  }

  private async startPedometer(): Promise<void> {
    if (this.pedometerStarted) {
      this.activityMode = 'sensor';
      return;
    }
    this.stepSessionBase = this.dailyLog.steps;
    this.pedometerListener = await CapacitorPedometer.addListener('measurement', measurement => {
      this.dailyLog.steps = this.stepSessionBase + Math.max(0, measurement.numberOfSteps ?? 0);
      this.saveDailyLog();
    });
    await CapacitorPedometer.startMeasurementUpdates();
    this.pedometerStarted = true;
    this.activityMode = 'sensor';
    this.activityStatus = 'Pasos registrados por el sensor mientras la app está activa.';
  }

  private async stopPedometer(): Promise<void> {
    if (!this.pedometerStarted) return;
    this.pedometerStarted = false;
    await this.pedometerListener?.remove();
    this.pedometerListener = undefined;
    await CapacitorPedometer.stopMeasurementUpdates();
  }

  async logout(): Promise<void> {
    await this.eatWellService.logout();
    await this.router.navigateByUrl('/login');
  }

  private touchStartX = 0;
  private touchStartY = 0;
  private dragStartX = 0;

  cycleTip(direction: 'next' | 'prev' = 'next'): void {
    if (this.isFading || this.activeTips.length <= 1) {
      return;
    }

    this.isFading = true;
    
    setTimeout(() => {
      if (direction === 'next') {
        this.currentTipIndex = (this.currentTipIndex + 1) % this.activeTips.length;
      } else {
        this.currentTipIndex = (this.currentTipIndex - 1 + this.activeTips.length) % this.activeTips.length;
      }
      const nextTip = this.activeTips[this.currentTipIndex];
      this.dailyTip = nextTip.text;
      this.dailyTipIcon = nextTip.icon;
      this.isFading = false;
    }, 150);
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent): void {
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    
    const dx = touchEndX - this.touchStartX;
    const dy = touchEndY - this.touchStartY;
    
    // Swipe left (next tip) or right (previous tip)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) {
        this.cycleTip('next');
      } else {
        this.cycleTip('prev');
      }
    }
  }

  onMouseDown(event: MouseEvent): void {
    this.dragStartX = event.clientX;
  }

  onMouseUp(event: MouseEvent): void {
    const dragEndX = event.clientX;
    const dx = dragEndX - this.dragStartX;
    
    // Drag left (next) or right (prev)
    if (Math.abs(dx) > 40) {
      if (dx < 0) {
        this.cycleTip('next');
      } else {
        this.cycleTip('prev');
      }
    }
  }

  private async loadDailyTip(): Promise<void> {
    try {
      this.activeTips = await this.eatWellService.getCustomTips();
    } catch {
      this.activeTips = [
        { text: 'Acompaña tus comidas con agua pura y mantente hidratado todo el día.', icon: 'water-outline' },
        { text: 'Combina distintos colores de vegetales en tu plato para asegurar una mayor variedad de vitaminas.', icon: 'color-palette-outline' },
        { text: 'Masticar despacio ayuda a mejorar tu digestión y permite al cerebro registrar la saciedad a tiempo.', icon: 'hourglass-outline' }
      ];
    }
    
    this.currentTipIndex = 0;
    
    // Set initial tip
    if (this.activeTips.length > 0) {
      this.dailyTip = this.activeTips[0].text;
      this.dailyTipIcon = this.activeTips[0].icon;
    }
  }
}
