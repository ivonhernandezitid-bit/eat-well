import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionSheetController, AlertController, IonicModule, IonContent, Platform } from '@ionic/angular';
import { EatWellService, Gender } from '../core';
import { LifestyleSettings, defaultLifestyleSettings, lifestyleSettingsError, loadLifestyleSettings } from '../core/lifestyle-goals';
import { FitnessGoal } from '../core/models';
import { changeClinicalField, ClinicalHistoryData, clinicalHistoryError, clinicalHistoryForSex, clinicalHistoryMissingFields, emptyClinicalHistory } from '../core/clinical-history';
import { calendarDate, dietaryRecallError, emptyDietaryRecall, previousRecallDate, recallDateError, recallMeals, setRecallSkipped } from '../core/dietary-recall';
import { MealSchedule, mealScheduleError, scheduleMeals } from '../core/meal-schedule';

type WeightUnit = 'kg' | 'lbs';
type HeightUnit = 'cm' | 'ft';
type R24hTimeField = 'wakeTime' | 'breakfastTime' | 'snackTime' | 'lunchTime' | 'afternoonSnackTime' | 'activityTime' | 'dinnerTime' | 'sleepTime';

@Component({
  selector: 'app-datos-perfil',
  templateUrl: './datos-perfil.page.html',
  styleUrls: ['./datos-perfil.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class DatosPerfilPage implements OnInit {
  @ViewChild('photoInput') photoInput?: ElementRef<HTMLInputElement>;
  @ViewChild('profileCameraInput') profileCameraInput?: ElementRef<HTMLInputElement>;
  photoSaving = false;
  photoLoading = false;
  private photoOwnerId: string | null = null;
  @ViewChild(IonContent) private content?: IonContent;

  fullName = '';
  username = '';
  email = '';
  weightKg = 70;
  heightCm = 170;
  displayWeight = 70;
  displayHeight = 170;
  weightUnit: WeightUnit = 'kg';
  heightUnit: HeightUnit = 'cm';
  gender: Gender = 'other';
  age = 18;
  imc = 24.22;
  profileImage: string | null = null;
  isOnboarding = false;
  profileProgressReady = false;
  foodPreferencesCompleted = false;
  showProfileModuleDetails = false;
  view: 'settings' | 'general' | 'clinical' | 'r24h' | 'schedule' | 'lifestyle' | 'privacy' = 'settings';
  mealSchedule: MealSchedule | null = null;
  scheduleLoading = false;
  scheduleSaving = false;
  scheduleValidationAttempted = false;
  scheduleValidationError = '';
  private scheduleOwnerId: string | null = null;
  private scheduleCustomized = false;
  readonly scheduleMeals = scheduleMeals;
  private scheduleLoadVersion = 0;

  private moduleTouchStartX = 0;
  private moduleTouchStartY = 0;
  private moduleSwipeEligible = false;
  private profileLoadVersion = 0;

  lifestyleSettings: LifestyleSettings = {
    goal: 'improve_health',
    targetWeightKg: 65,
    activityBand: 'moderate',
    exerciseTypes: [],
    sessionDuration: 45,
    trainingTime: 'afternoon',
    cookingTime: 'medium',
    stressLevel: 'moderate',
  };
  lifestyleLoading = false;
  lifestyleSaving = false;
  lifestyleSaved = false;
  lifestyleLoadError = '';
  private lifestyleOwnerId: string | null = null;
  private lifestyleLoadVersion = 0;

  readonly lifestyleGoals: { value: FitnessGoal; label: string; icon: string }[] = [
    { value: 'lose_weight', label: 'Perder grasa corporal', icon: 'trending-down-outline' },
    { value: 'maintain', label: 'Mantener mi peso', icon: 'scale-outline' },
    { value: 'gain_muscle', label: 'Aumentar masa muscular', icon: 'barbell-outline' },
    { value: 'improve_health', label: 'Mejorar mi salud', icon: 'heart-outline' },
  ];

  readonly exerciseOptions = [
    { value: 'walking', label: 'Caminata / Trotar' },
    { value: 'strength', label: 'Gimnasio / Pesas' },
    { value: 'cycling', label: 'Ciclismo' },
    { value: 'sports', label: 'Deportes' },
    { value: 'home', label: 'Ejercicio en casa' },
    { value: 'none', label: 'Ninguno por ahora' },
  ];

  r24hData = emptyDietaryRecall();
  r24hDate = previousRecallDate();
  r24hMaxDate = calendarDate();
  r24hLoading = false;
  r24hSaving = false;
  r24hSaved = false;
  r24hValidationAttempted = false;
  private r24hOwnerId: string | null = null;
  private r24hLoadVersion = 0;
  private r24hLoadError = '';
  private r24hLoadedDate = this.r24hDate;
  private r24hSnapshot = JSON.stringify(this.r24hData);

  isTimePickerOpen = false;
  activeTimeField: R24hTimeField | null = null;
  timePickerValue = '2000-01-01T00:00:00';

  clinicalData = emptyClinicalHistory();
  clinicalLoading = false;
  clinicalSaving = false;
  clinicalValidationAttempted = false;
  private clinicalLoadVersion = 0;
  private clinicalLoadError = '';
  private clinicalHistorySaved = false;

  readonly allergyOptions = ['Lactosa', 'Gluten', 'Mariscos', 'Frutos secos', 'Nuez/Maní', 'APLV (proteína de leche de vaca)'];

  formName = '';
  birthDate = '';
  activityLevel: 'sedentary' | 'standing' | 'active' = 'sedentary';
  generalValidationAttempted = false;
  lifestyleValidationAttempted = false;

  get generalMissingFields(): string[] {
    const missing: string[] = [];
    const birthDateValue = this.birthDate ? new Date(`${this.birthDate}T00:00:00`) : null;
    const validBirthDate = !!birthDateValue
      && !Number.isNaN(birthDateValue.getTime())
      && `${birthDateValue.getFullYear()}-${String(birthDateValue.getMonth() + 1).padStart(2, '0')}-${String(birthDateValue.getDate()).padStart(2, '0')}` === this.birthDate
      && birthDateValue.getTime() <= Date.now()
      && this.calculateAgeFromBirthDate(this.birthDate) > 0
      && this.calculateAgeFromBirthDate(this.birthDate) <= 120;
    if (!this.formName.trim()) missing.push('Nombre completo');
    if (!validBirthDate) missing.push('Fecha de nacimiento válida');
    if (this.gender !== 'female' && this.gender !== 'male') missing.push('Género biológico');
    if (!Number.isFinite(Number(this.heightCm)) || Number(this.heightCm) <= 0) missing.push('Estatura');
    if (!Number.isFinite(Number(this.weightKg)) || Number(this.weightKg) <= 0) missing.push('Peso actual');
    if (!['sedentary', 'standing', 'active'].includes(this.activityLevel)) missing.push('Actividad diaria');
    return missing;
  }

  get clinicalMissingFields(): string[] {
    return clinicalHistoryMissingFields(this.clinicalData, this.clinicalGender);
  }

  get r24hMissingFields(): string[] {
    const missing: string[] = [];
    if (!this.r24hDate) missing.push('Día recordado');
    if (!this.r24hData.wakeTime) missing.push('Hora de despertar');
    for (const [index, meal] of recallMeals.entries()) {
      if (this.r24hData[meal.skipped]) continue;
      const label = ['Desayuno', 'Colación matutina', 'Comida', 'Colación vespertina', 'Cena'][index];
      if (!this.r24hData[meal.time]) missing.push(`Hora de ${label}`);
      if (!this.r24hData[meal.place]) missing.push(`Lugar de ${label}`);
      if (!this.r24hData[meal.details].trim()) missing.push(`Alimentos y bebidas de ${label}`);
    }
    if (!this.r24hData.noActivity) {
      if (!this.r24hData.activityTime) missing.push('Hora de actividad');
      if (!this.r24hData.activityType.trim()) missing.push('Tipo de actividad');
      if (!this.r24hData.activityDuration.trim()) missing.push('Duración de actividad');
    }
    if (!this.r24hData.sleepTime) missing.push('Hora de dormir');
    return missing;
  }

  get lifestyleMissingFields(): string[] {
    const missing: string[] = [];
    if (!this.lifestyleGoals.some(goal => goal.value === this.lifestyleSettings.goal)) missing.push('Meta principal de salud');
    if (!Number.isFinite(Number(this.lifestyleSettings.targetWeightKg)) || Number(this.lifestyleSettings.targetWeightKg) < 25 || Number(this.lifestyleSettings.targetWeightKg) > 350) missing.push('Peso meta deseado');
    if (!['sedentary', 'light', 'moderate', 'intense'].includes(this.lifestyleSettings.activityBand)) missing.push('Nivel habitual de actividad');
    if (!this.lifestyleSettings.exerciseTypes.length) missing.push('Tipo de ejercicio habitual (o Ninguno por ahora)');
    return missing;
  }

  get scheduleMissingFields(): string[] {
    if (!this.mealSchedule) return ['Horarios de alimentación'];
    return scheduleMeals
      .filter(meal => !/^([01]\d|2[0-3]):[0-5]\d$/.test(this.mealSchedule![meal.field]))
      .map(meal => `Hora de ${meal.label}`);
  }

  isScheduleMealInvalid(index: number): boolean {
    if (this.scheduleMissingFields.some(field => field === `Hora de ${scheduleMeals[index].label}`)) return true;
    if (!this.mealSchedule) return false;
    const currentTime = this.mealSchedule[scheduleMeals[index].field];
    const previousTime = index > 0 ? this.mealSchedule[scheduleMeals[index - 1].field] : '';
    const nextTime = index < scheduleMeals.length - 1 ? this.mealSchedule[scheduleMeals[index + 1].field] : '';
    return (!!previousTime && currentTime <= previousTime) || (!!nextTime && currentTime >= nextTime);
  }

  getScheduleMinTime(index: number): string | null {
    if (!this.mealSchedule || index === 0) return null;
    return this.mealSchedule[scheduleMeals[index - 1].field] || null;
  }

  getScheduleMaxTime(index: number): string | null {
    if (!this.mealSchedule || index >= scheduleMeals.length - 1) return null;
    return this.mealSchedule[scheduleMeals[index + 1].field] || null;
  }

  isR24hMealIncomplete(index: number): boolean {
    const meal = recallMeals[index];
    return this.r24hMissingFields.some(field => field.includes(['Desayuno', 'Colación matutina', 'Comida', 'Colación vespertina', 'Cena'][index]))
      || (!this.r24hData[meal.skipped] && (!this.r24hData[meal.time] || !this.r24hData[meal.place] || !this.r24hData[meal.details].trim()));
  }

  isClinicalSectionMissing(...fields: string[]): boolean {
    return this.clinicalValidationAttempted && fields.some(field => this.clinicalMissingFields.includes(field));
  }

  setScheduleTime(field: keyof MealSchedule, value: string): void {
    if (!this.mealSchedule) return;
    this.mealSchedule[field] = value;
    this.scheduleValidationError = '';
  }

  get activityLevelLabel(): string {
    return { sedentary: 'Sentado', standing: 'De pie', active: 'Trabajo físico' }[this.activityLevel];
  }

  readonly baseSettingsItems = [
    {
      id: 'general',
      icon: 'person-outline',
      title: 'Datos Generales y Antropométricos',
      subtitle: 'Edad, peso, estatura, IMC',
      route: '/tabs/datos-perfil',
    },
    {
      id: 'clinical',
      icon: 'document-text-outline',
      title: 'Historial Clínico y Nutricional',
      subtitle: 'Padecimientos, alergias, medicamentos',
      route: '/tabs/preferencias-alimentarias',
    },
    {
      id: 'record',
      icon: 'time-outline',
      title: 'Recordatorio 24 Horas',
      subtitle: 'Alimentación y actividad del día anterior',
      route: '/tabs/datos-perfil',
    },
    {
      id: 'lifestyle',
      icon: 'fitness-outline',
      title: 'Estilo de Vida y Metas',
      subtitle: 'Nivel de actividad física y metas',
      route: '/tabs/home',
    },
    {
      id: 'food',
      icon: 'restaurant-outline',
      title: 'Preferencias Alimentarias',
      subtitle: 'Comidas favoritas, aversiones, dietas',
      route: '/tabs/preferencias-alimentarias',
    },
    {
      id: 'privacy',
      icon: 'shield-checkmark-outline',
      title: 'Privacidad y Datos',
      subtitle: 'Configuración de cuenta y seguridad',
      route: '/tabs/datos-perfil',
    },
  ];

  get settingsItems() {
    const items: { id: string; icon: string; title: string; subtitle: string; route: string }[] = [];
    for (const item of this.baseSettingsItems) {
      if (item.id === 'privacy') continue;
      items.push(item);
      if (item.id === 'food' && this.r24hSaved) {
        items.push({ id: 'schedule', icon: 'time-outline', title: 'Horarios de alimentación', subtitle: 'Desayuno, colaciones, comida y cena', route: '/tabs/datos-perfil' });
      }
    }
    items.push(...this.baseSettingsItems.filter(item => item.id === 'privacy'));
    return items;
  }

  isCroppingModalOpen = false;
  selectedPhotoUrl: string | null = null;
  translateX = 0;
  translateY = 0;
  scale = 1.0;
  rotation = 0;
  dispWidth = 0;
  dispHeight = 0;

  private readonly cropSize = 280;
  private rawImage: HTMLImageElement | null = null;
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerId: number | null = null;

  private readonly eatWellService = inject(EatWellService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly alertController = inject(AlertController);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly platform = inject(Platform);

  openProfileModule(view: Exclude<DatosPerfilPage['view'], 'settings'>): void {
    if(view==='schedule') void this.loadMealSchedule();
    if (view === 'general') {
      this.syncGeneralFormFromProfile();
    } else if (view === 'lifestyle') {
      const activeUser = this.eatWellService.getActiveUser();
      if (activeUser) {
        void this.loadLifestyleForm(activeUser.id);
      }
    }

    this.view = view;
    if (view === 'clinical' && this.clinicalLoadError) {
      void this.showAlert('No se pudo cargar el historial', this.clinicalLoadError);
    }
    if (view === 'r24h' && this.r24hLoadError) void this.showAlert('No se pudo cargar el recordatorio', this.r24hLoadError);
    void this.content?.scrollToTop(0);
  }

  private async continueToNextProfileModule(view: 'clinical' | 'r24h' | 'lifestyle' | 'food'): Promise<void> {
    if (view === 'food') {
      await this.router.navigateByUrl('/tabs/preferencias-alimentarias');
      return;
    }

    this.openProfileModule(view);
  }

  returnToProfile(): void {
    this.view = 'settings';
    void this.content?.scrollToTop(0);
  }

  onModuleTouchStart(event: TouchEvent): void {
    this.moduleTouchStartX = event.touches[0]?.clientX ?? 0;
    this.moduleTouchStartY = event.touches[0]?.clientY ?? 0;
    const target = event.target;
    const startedOnControl = target instanceof Element
      && target.closest('button, input, select, textarea, ion-button, ion-datetime, ion-range, .crop-area');

    this.moduleSwipeEligible = this.view !== 'settings'
      && !this.isCroppingModalOpen
      && !this.isTimePickerOpen
      && !startedOnControl;
  }

  onModuleTouchEnd(event: TouchEvent): void {
    if (!this.moduleSwipeEligible) {
      return;
    }

    this.moduleSwipeEligible = false;
    const touch = event.changedTouches[0];
    const swipeDistanceX = (touch?.clientX ?? 0) - this.moduleTouchStartX;
    const swipeDistanceY = (touch?.clientY ?? 0) - this.moduleTouchStartY;

    if (Math.abs(swipeDistanceX) < 70 || Math.abs(swipeDistanceX) <= Math.abs(swipeDistanceY)) {
      return;
    }

    event.stopPropagation();
    this.returnToProfile();
  }

  ngOnInit() {
    this.loadProfileData();
  }

  ionViewWillEnter() {
    this.loadProfileData();
  }

  private loadProfileData(): void {
    const version = ++this.profileLoadVersion;
    this.profileProgressReady = false;
    this.isOnboarding = this.route.snapshot.queryParamMap.get('onboarding') === '1';
    const activeUser = this.eatWellService.getActiveUser();

    if (!activeUser) {
      ++this.clinicalLoadVersion;
      this.clinicalData = emptyClinicalHistory();
      this.clinicalHistorySaved = false;
      this.clinicalLoading = false;
      ++this.r24hLoadVersion;
      this.r24hData = emptyDietaryRecall();
      this.r24hSaved = false;
      this.r24hLoading = false;
      this.r24hOwnerId = null;
      this.closeTimePicker();
      ++this.scheduleLoadVersion;
      this.scheduleOwnerId = null;
      this.scheduleCustomized = false;
      this.mealSchedule = null;
      ++this.lifestyleLoadVersion;
      this.lifestyleOwnerId = null;
      this.lifestyleSaved = false;
      this.mealSchedule=null;
      void this.router.navigateByUrl('/login');
      return;
    }

    this.fullName = activeUser.name;
    this.username = activeUser.username || '';
    this.email = activeUser.email;
    this.weightKg = activeUser.weightKg;
    this.heightCm = activeUser.heightCm;
    this.gender = activeUser.gender;
    this.age = activeUser.age;
    this.imc = activeUser.imc;
    this.profileImage = activeUser.profileImage ?? null;
    this.foodPreferencesCompleted = false;
    const profileLoads = [
      this.loadFoodPreferencesCompletion(activeUser.id),
      this.loadLifestyleForm(activeUser.id),
      this.loadClinicalHistory(activeUser.id),
      this.loadR24h(activeUser.id),
      this.loadMealSchedule(),
    ];
    const markProgressReady = (): void => {
      if (version === this.profileLoadVersion && this.eatWellService.getActiveUser()?.id === activeUser.id) {
        this.profileProgressReady = true;
      }
    };
    void Promise.all(profileLoads).then(markProgressReady, error => {
      markProgressReady();
      if (version === this.profileLoadVersion && this.eatWellService.getActiveUser()?.id === activeUser.id) {
        void this.showAlert('No se pudo cargar el perfil', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
      }
    });
    this.r24hMaxDate = calendarDate();

    this.formName = this.fullName;
    this.birthDate = this.buildBirthDateFromAge(this.age);
    this.syncDisplayValues();
  }

  get profileModules(): { name: string; completed: boolean }[] {
    const activeUser = this.eatWellService.getActiveUser();
    return [
      {
        name: 'Datos generales y antropométricos',
        completed: !!activeUser && !!activeUser.name.trim() && activeUser.age > 0 && activeUser.weightKg > 0 && activeUser.heightCm > 0 && activeUser.gender !== 'other',
      },
      { name: 'Historial clínico', completed: this.isClinicalHistoryComplete },
      { name: 'Recordatorio de 24 horas', completed: this.isR24hComplete },
      { name: 'Estilo de vida y metas', completed: !!activeUser && this.lifestyleOwnerId === activeUser.id && this.lifestyleSaved },
      { name: 'Preferencias alimentarias', completed: this.foodPreferencesCompleted },
      { name: 'Horarios de alimentación', completed: this.scheduleOwnerId === activeUser?.id && this.scheduleCustomized },
    ];
  }

  get profileModulesTooltip(): string {
    return this.profileModules
      .map(module => `${module.completed ? 'Completo' : 'Pendiente'}: ${module.name}`)
      .join('\n');
  }

  get completedProfileModules(): number {
    return this.profileModules.filter(module => module.completed).length;
  }

  get profileCompletion(): number {
    return Math.round(this.completedProfileModules / this.profileModules.length * 100);
  }

  toggleProfileModuleDetails(): void {
    this.showProfileModuleDetails = !this.showProfileModuleDetails;
  }

  private get isClinicalHistoryComplete(): boolean {
    return this.clinicalHistorySaved && clinicalHistoryError(this.clinicalData, this.clinicalGender) === null;
  }

  get clinicalGender(): Gender {
    return this.eatWellService.getActiveUser()?.gender ?? 'other';
  }

  setClinicalField<K extends keyof ClinicalHistoryData>(field: K, value: ClinicalHistoryData[K]): void {
    if (this.clinicalLoading || this.clinicalSaving) return;
    this.clinicalData = clinicalHistoryForSex(changeClinicalField(this.clinicalData, field, value), this.clinicalGender);
  }

  private get isR24hComplete(): boolean {
    return this.r24hSaved;
  }

  private async loadR24h(userId: string, date = this.r24hDate): Promise<void> {
    const newOwner = this.r24hOwnerId !== userId;
    if (newOwner) { date = previousRecallDate(); this.mealSchedule=null; ++this.scheduleLoadVersion; this.view='settings'; }
    if (!newOwner && this.r24hLoading && this.r24hDate === date) return;
    this.r24hOwnerId = userId;
    const version = ++this.r24hLoadVersion;
    this.r24hDate = date;
    this.r24hLoadedDate = date;
    this.r24hData = emptyDietaryRecall();
    if(newOwner) this.r24hSaved = false;
    this.r24hLoadError = '';
    this.r24hLoading = true;
    this.closeTimePicker();
    try {
      const response = await this.eatWellService.getInitialDietaryRecall();
      if (version === this.r24hLoadVersion && this.eatWellService.getActiveUser()?.id === userId) {
        this.r24hData = response.recall ?? emptyDietaryRecall();
        this.r24hSaved = response.completed;
        if(response.completed) {
          this.r24hDate=response.recallDate;
          this.r24hLoadedDate=response.recallDate;
        }
      }
    } catch (error) {
      if (version === this.r24hLoadVersion && this.eatWellService.getActiveUser()?.id === userId) {
        this.r24hLoadError = error instanceof Error ? error.message : 'No se pudo cargar el recordatorio.';
        if (this.view === 'r24h') void this.showAlert('No se pudo cargar el recordatorio', this.r24hLoadError);
      }
    } finally {
      if (version === this.r24hLoadVersion) {
        this.r24hLoading = false;
        this.r24hSnapshot = JSON.stringify(this.r24hData);
        const requested=this.route.snapshot.queryParamMap.get('module');
        if(this.view==='settings' && requested==='schedule' && this.r24hSaved) this.openProfileModule('schedule');
        if(this.view==='settings' && requested==='r24h') this.openProfileModule('r24h');
      }
    }
  }

  async changeRecallDate(date: string): Promise<void> {
    if(this.r24hSaved) return;
    if (this.r24hLoading || this.r24hSaving) {
      this.r24hDate = this.r24hLoadedDate;
      return;
    }
    const userId = this.eatWellService.getActiveUser()?.id;
    if (!userId || date === this.r24hLoadedDate) return;
    const error = recallDateError(date);
    if (error) {
      this.r24hDate = this.r24hLoadedDate;
      await this.showAlert('Revisa la fecha', error);
      return;
    }
    if (JSON.stringify(this.r24hData) !== this.r24hSnapshot) {
      const alert = await this.alertController.create({
        header: 'Cambios sin guardar', message: 'Al cambiar de día se descartarán las respuestas que no guardaste.',
        buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Cambiar de día', role: 'change' }],
      });
      await alert.present();
      if ((await alert.onDidDismiss()).role !== 'change') {
        this.r24hDate = this.r24hLoadedDate;
        return;
      }
    }
    if (this.eatWellService.getActiveUser()?.id === userId) await this.loadR24h(userId, date);
  }

  setR24hSkipped(field: 'noBreakfast' | 'noSnack' | 'noLunch' | 'noAfternoonSnack' | 'noDinner' | 'noActivity', skipped: boolean): void {
    if (this.r24hLoading || this.r24hSaving) return;
    this.r24hData = setRecallSkipped(this.r24hData, field, skipped);
  }

  private isRecallTimeSkipped(field: R24hTimeField): boolean {
    if (field === 'activityTime') return this.r24hData.noActivity;
    const meal = recallMeals.find(item => item.time === field);
    return meal ? this.r24hData[meal.skipped] : false;
  }

  private async loadFoodPreferencesCompletion(userId: string): Promise<void> {
    try {
      const preferences = await this.eatWellService.getFoodPreferences();
      if (this.eatWellService.getActiveUser()?.id === userId) {
        this.foodPreferencesCompleted = preferences.completed;
      }
    } catch {
      if (this.eatWellService.getActiveUser()?.id === userId) {
        this.foodPreferencesCompleted = false;
      }
    }
  }

  private async loadClinicalHistory(userId: string): Promise<void> {
    const version = ++this.clinicalLoadVersion;
    this.clinicalData = emptyClinicalHistory();
    this.clinicalHistorySaved = false;
    this.clinicalLoadError = '';
    this.clinicalLoading = true;
    try {
      const response = await this.eatWellService.getClinicalHistory();
      if (version === this.clinicalLoadVersion && this.eatWellService.getActiveUser()?.id === userId) {
        this.clinicalData = clinicalHistoryForSex(response.history ?? emptyClinicalHistory(), this.clinicalGender);
        this.clinicalHistorySaved = response.completed;
      }
    } catch (error) {
      if (version === this.clinicalLoadVersion && this.eatWellService.getActiveUser()?.id === userId) {
        this.clinicalLoadError = error instanceof Error ? error.message : 'No se pudo cargar el historial.';
        if (this.view === 'clinical') void this.showAlert('No se pudo cargar el historial', this.clinicalLoadError);
      }
    } finally {
      if (version === this.clinicalLoadVersion) this.clinicalLoading = false;
    }
  }

  async handleSettingsItem(item: { route?: string; title: string; id?: string }): Promise<void> {
    if(item.id==='schedule') { this.openProfileModule('schedule'); return; }
    if (item.id === 'general') {
      this.openProfileModule('general');
      return;
    }

    if (item.id === 'clinical') {
      this.openProfileModule('clinical');
      return;
    }

    if (item.id === 'record') {
      this.openProfileModule('r24h');
      return;
    }

    if (item.id === 'lifestyle') {
      this.openProfileModule('lifestyle');
      return;
    }

    if (item.id === 'privacy') {
      this.openProfileModule('privacy');
      return;
    }

    if (!item.route || item.route === '/tabs/datos-perfil') {
      return;
    }

    if (item.route === '/tabs/home') {
      await this.router.navigateByUrl('/tabs/home');
      return;
    }

    if (item.route === '/tabs/preferencias-alimentarias') {
      await this.router.navigateByUrl('/tabs/preferencias-alimentarias');
      return;
    }

    await this.router.navigateByUrl(item.route);
  }

  toggleClinicalAllergy(allergy: string): void {
    const allergies = this.clinicalData.allergies;
    this.setClinicalField('allergies', allergies.includes(allergy)
      ? allergies.filter(item => item !== allergy)
      : [...allergies, allergy]);
  }

  toggleExerciseType(value: string): void {
    const selected = this.lifestyleSettings.exerciseTypes;
    if (value === 'none') {
      this.lifestyleSettings.exerciseTypes = selected.includes('none') ? [] : ['none'];
      if (this.lifestyleSettings.exerciseTypes.includes('none')) this.lifestyleSettings.activityBand = 'sedentary';
      return;
    }
    this.lifestyleSettings.exerciseTypes = selected.includes(value)
      ? selected.filter(item => item !== value)
      : [...selected.filter(item => item !== 'none'), value];
  }

  isExerciseSelected(value: string): boolean {
    return this.lifestyleSettings.exerciseTypes.includes(value);
  }

  private async loadLifestyleForm(userId: string): Promise<void> {
    const activeUser = this.eatWellService.getActiveUser();
    if (!activeUser || activeUser.id !== userId) return;
    const version = ++this.lifestyleLoadVersion;
    this.lifestyleOwnerId = null;
    this.lifestyleLoading = true;
    this.lifestyleSaved = false;
    this.lifestyleLoadError = '';
    this.lifestyleSettings = defaultLifestyleSettings(activeUser);
    try {
      const response = await this.eatWellService.getLifestyleGoals();
      if (version !== this.lifestyleLoadVersion || this.eatWellService.getActiveUser()?.id !== userId) return;
      const currentUser = this.eatWellService.getActiveUser()!;
      this.lifestyleSettings = response.settings ?? loadLifestyleSettings(userId) ?? defaultLifestyleSettings(currentUser);
      this.lifestyleSettings.goal = currentUser.goal;
      this.lifestyleSaved = response.completed;
      this.lifestyleOwnerId = userId;
    } catch (error) {
      if (version === this.lifestyleLoadVersion && this.eatWellService.getActiveUser()?.id === userId) this.lifestyleLoadError = error instanceof Error ? error.message : 'No se pudieron cargar tus metas.';
    } finally { if (version === this.lifestyleLoadVersion) this.lifestyleLoading = false; }
  }

  async reloadLifestyle(): Promise<void> {
    const user = this.eatWellService.getActiveUser();
    if (user) await this.loadLifestyleForm(user.id);
  }

  async saveLifestyleGoals(): Promise<void> {
    if (this.lifestyleLoading || this.lifestyleSaving || this.lifestyleLoadError) return;
    this.lifestyleValidationAttempted = true;
    if (this.lifestyleMissingFields.length) return;
    const activeUser = this.eatWellService.getActiveUser();
    if (!activeUser || this.lifestyleOwnerId !== activeUser.id) return;
    const error = lifestyleSettingsError(this.lifestyleSettings, true, activeUser.weightKg);
    if (error) {
      await this.showAlert('Revisa tus metas', error);
      return;
    }
    this.lifestyleSaving = true;
    try {
      const response = await this.eatWellService.saveLifestyleGoals({ ...this.lifestyleSettings, targetWeightKg: Number(this.lifestyleSettings.targetWeightKg) });
      if (this.eatWellService.getActiveUser()?.id !== activeUser.id) return;
      this.lifestyleSettings = response.settings!;
      this.lifestyleSaved = response.completed;
      this.returnToProfile();
    } catch (error) {
      if (this.eatWellService.getActiveUser()?.id === activeUser.id) await this.showAlert('Error', error instanceof Error ? error.message : 'No se pudieron guardar los objetivos.');
    } finally { this.lifestyleSaving = false; }
  }

  private async confirmModuleReset(moduleName: string): Promise<boolean> {
    const alert = await this.alertController.create({
      header: 'Borrar datos del módulo',
      message: `Se eliminarán los datos de ${moduleName}. Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Borrar datos', role: 'destructive' },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'destructive';
  }

  async saveClinicalHistory(): Promise<void> {
    if (this.clinicalLoading || this.clinicalSaving) return;
    if (this.clinicalLoadError) {
      await this.showAlert('No se pudo cargar el historial', this.clinicalLoadError);
      return;
    }
    this.clinicalData = clinicalHistoryForSex(this.clinicalData, this.clinicalGender);
    this.clinicalValidationAttempted = true;
    if (this.clinicalMissingFields.length) return;
    const validationError = clinicalHistoryError(this.clinicalData, this.clinicalGender);
    if (validationError) {
      await this.showAlert('Revisa el historial', validationError);
      return;
    }

    const userId = this.eatWellService.getActiveUser()?.id;
    this.clinicalSaving = true;
    try {
      const response = await this.eatWellService.saveClinicalHistory(this.clinicalData);
      if (this.eatWellService.getActiveUser()?.id !== userId) return;
      this.clinicalData = response.history ?? emptyClinicalHistory();
      this.clinicalHistorySaved = response.completed;
      await this.showAlert('Guardado', 'El historial clínico se guardó correctamente.');
      await this.continueToNextProfileModule('r24h');
    } catch (error) {
      await this.showAlert('No se pudo guardar', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
    } finally {
      this.clinicalSaving = false;
    }
  }

  async saveR24h(): Promise<void> {
    if (this.r24hLoading || this.r24hSaving) return;
    if (this.r24hLoadError) {
      await this.showAlert('No se pudo cargar el recordatorio', this.r24hLoadError);
      return;
    }
    this.r24hValidationAttempted = true;
    if (this.r24hMissingFields.length) return;
    const validationError = dietaryRecallError(this.r24hData, this.r24hDate);
    if (validationError) {
      await this.showAlert('Revisa el recordatorio', validationError);
      return;
    }
    const userId = this.eatWellService.getActiveUser()?.id;
    const wasSaved = this.r24hSaved;
    this.r24hSaving = true;
    try {
      const response = await this.eatWellService.saveDietaryRecall(this.r24hDate, this.r24hData);
      if (this.eatWellService.getActiveUser()?.id !== userId) return;
      this.r24hData = response.recall ?? emptyDietaryRecall();
      this.r24hSaved = response.completed;
      this.r24hSnapshot = JSON.stringify(this.r24hData);
      await this.showAlert('Guardado', wasSaved ? 'Los cambios del recordatorio se guardaron correctamente.' : 'El recordatorio inicial se guardó correctamente.');
      this.returnToProfile();
    } catch (error) {
      if(error instanceof Error && error.message.includes('El recordatorio inicial ya fue completado')) {
        const active=this.eatWellService.getActiveUser();
        if(active && active.id===userId) await this.loadR24h(active.id);
      }
      await this.showAlert('No se pudo guardar', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
    } finally {
      this.r24hSaving = false;
    }
  }

  private async loadMealSchedule(): Promise<void> {
    const userId=this.eatWellService.getActiveUser()?.id;
    if(!userId) return;
    const version=++this.scheduleLoadVersion;
    this.scheduleLoading=true;
    this.mealSchedule=null;
    try {
      const response=await this.eatWellService.getMealSchedule();
      if(version===this.scheduleLoadVersion && this.eatWellService.getActiveUser()?.id===userId) {
        this.mealSchedule=response.schedule;
        this.r24hSaved=response.initialCompleted;
        this.scheduleOwnerId=userId;
        this.scheduleCustomized=response.customized;
      }
    } catch(error) {
      if(version===this.scheduleLoadVersion && this.eatWellService.getActiveUser()?.id===userId) await this.showAlert('No se pudieron cargar los horarios',error instanceof Error?error.message:'Inténtalo nuevamente.');
    } finally { if(version===this.scheduleLoadVersion) this.scheduleLoading=false; }
  }

  async saveMealSchedule(): Promise<void> {
    if(this.scheduleLoading || this.scheduleSaving || !this.mealSchedule) return;
    this.scheduleValidationAttempted = true;
    this.scheduleValidationError = '';
    if (this.scheduleMissingFields.length) return;
    const error=mealScheduleError(this.mealSchedule);
    if(error) { this.scheduleValidationError = error; await this.showAlert('Revisa los horarios',error); return; }
    const userId=this.eatWellService.getActiveUser()?.id;
    this.scheduleSaving=true;
    try {
      const response=await this.eatWellService.saveMealSchedule(this.mealSchedule);
      if(this.eatWellService.getActiveUser()?.id!==userId) return;
      this.mealSchedule=response.schedule;
      this.scheduleOwnerId=userId ?? null;
      this.scheduleCustomized=response.customized;
      await this.showAlert('Guardado','Tus horarios de alimentación se actualizaron.');
      if(this.isOnboarding) await this.continueToNextProfileModule('lifestyle'); else this.returnToProfile();
    } catch(error) { await this.showAlert('No se pudieron guardar',error instanceof Error?error.message:'Inténtalo nuevamente.'); }
    finally { this.scheduleSaving=false; }
  }

  openTimePicker(field: R24hTimeField): void {
    if (this.r24hLoading || this.r24hSaving || this.isRecallTimeSkipped(field)) return;
    this.activeTimeField = field;
    const selectedTime = this.r24hData[field];
    this.timePickerValue = selectedTime
      ? `2000-01-01T${selectedTime}:00`
      : '2000-01-01T00:00:00';
    this.isTimePickerOpen = true;
  }

  onTimePickerChange(event: CustomEvent<{ value?: string | string[] | null }>): void {
    if (typeof event.detail.value === 'string') {
      this.timePickerValue = event.detail.value;
    }
  }

  confirmTimePicker(): void {
    if (this.activeTimeField && !this.r24hLoading && !this.r24hSaving && !this.isRecallTimeSkipped(this.activeTimeField)) {
      this.r24hData[this.activeTimeField] = this.timePickerValue.slice(11, 16);
    }
    this.closeTimePicker();
  }

  closeTimePicker(): void {
    this.isTimePickerOpen = false;
    this.activeTimeField = null;
  }

  formatTime(value: string): string {
    if (!value) {
      return 'Selecciona una hora';
    }

    const [hours, minutes] = value.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  }

  private syncGeneralFormFromProfile(): void {
    const activeUser = this.eatWellService.getActiveUser();
    if (!activeUser) {
      return;
    }

    this.formName = activeUser.name;
    this.birthDate = this.buildBirthDateFromAge(activeUser.age);
    this.gender = activeUser.gender;
    this.heightCm = activeUser.heightCm || 170;
    this.weightKg = activeUser.weightKg || 70.5;
    this.displayWeight = this.weightKg;
    this.displayHeight = this.heightCm;
    this.activityLevel = this.mapActivityToGeneral(activeUser.activityLevel ?? 'moderate');
  }

  private mapActivityToGeneral(level: string): 'sedentary' | 'standing' | 'active' {
    if (level === 'high') {
      return 'active';
    }
    if (level === 'low') {
      return 'sedentary';
    }
    return 'standing';
  }

  private buildBirthDateFromAge(age: number): string {
    const now = new Date();
    const year = now.getFullYear() - age;
    return `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  calculateAgeFromBirthDate(dateString: string): number {
    if (!dateString) {
      return this.age || 18;
    }

    const birthDate = new Date(dateString);
    if (Number.isNaN(birthDate.getTime())) {
      return this.age || 18;
    }

    const diffMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(diffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  async saveAndContinueToHistory(): Promise<void> {
    this.generalValidationAttempted = true;
    if (this.generalMissingFields.length) return;

    const nextAge = this.calculateAgeFromBirthDate(this.birthDate);
    const nextGender: Gender = this.gender === 'female' ? 'female' : this.gender === 'male' ? 'male' : 'other';
    const activityMap = {
      sedentary: 'low',
      standing: 'moderate',
      active: 'high',
    } as const;

    try {
      await this.eatWellService.updateProfile({
        name: this.formName.trim(),
        age: nextAge,
        gender: nextGender,
        heightCm: Number(this.heightCm),
        weightKg: Number(this.weightKg),
        activityLevel: activityMap[this.activityLevel],
      });

      this.fullName = this.formName.trim();
      this.age = nextAge;
      this.weightKg = Number(this.weightKg);
      this.heightCm = Number(this.heightCm);
      this.syncDisplayValues();

      await this.showAlert('Guardado', 'Datos generales guardados correctamente.');
      await this.continueToNextProfileModule('clinical');
    } catch (error) {
      await this.showAlert('Error', error instanceof Error ? error.message : 'No se pudo guardar la información.');
    }
  }

  async openPhotoPicker(): Promise<void> {
    if (this.photoSaving || this.photoLoading) return;
    const isMobile = this.platform.is('capacitor') || this.platform.is('cordova') || this.platform.is('mobile') || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) {
      this.photoInput?.nativeElement.click();
      return;
    }
    const sheet = await this.actionSheetController.create({
      header: 'Foto de perfil',
      buttons: [
        { text: 'Tomar foto', icon: 'camera-outline', handler: () => { this.profileCameraInput?.nativeElement.click(); } },
        { text: 'Seleccionar de la galería', icon: 'image-outline', handler: () => { this.photoInput?.nativeElement.click(); } },
        { text: 'Cancelar', icon: 'close-outline', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const userId = this.eatWellService.getActiveUser()?.id;

    if (!file || !userId || this.photoSaving || this.photoLoading) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      await this.showAlert('Archivo inválido', 'Selecciona una imagen.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      await this.showAlert('Imagen demasiado grande', 'Selecciona una foto de hasta 15 MB.');
      return;
    }
    this.photoLoading = true;
    try {
      const dataUrl = await this.readFileAsDataUrl(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('No se pudo cargar la imagen. Prueba con una foto JPG o PNG.'));
        img.src = dataUrl;
      });
      if (this.eatWellService.getActiveUser()?.id !== userId) return;
      this.photoOwnerId = userId;
      this.rawImage = img;
      const aspectRatio = img.width / img.height;
      if (aspectRatio > 1) {
        this.dispHeight = this.cropSize;
        this.dispWidth = this.cropSize * aspectRatio;
      } else {
        this.dispWidth = this.cropSize;
        this.dispHeight = this.cropSize / aspectRatio;
      }
      this.selectedPhotoUrl = dataUrl;
      this.translateX = 0;
      this.translateY = 0;
      this.scale = 1.0;
      this.rotation = 0;
      this.isCroppingModalOpen = true;
    } catch (error) {
      await this.showAlert('Error', error instanceof Error ? error.message : 'No se pudo leer la imagen.');
    } finally { this.photoLoading = false; }
  }

  rotateImage(): void {
    if (this.photoSaving) return;
    this.rotation = (this.rotation + 90) % 360;
    this.clampCropPosition();
  }

  clampCropPosition(): void {
    const rotated = this.rotation % 180 !== 0;
    const width = (rotated ? this.dispHeight : this.dispWidth) * this.scale;
    const height = (rotated ? this.dispWidth : this.dispHeight) * this.scale;
    const maxX = Math.max(0, (width - this.cropSize) / 2);
    const maxY = Math.max(0, (height - this.cropSize) / 2);
    this.translateX = Math.max(-maxX, Math.min(maxX, this.translateX));
    this.translateY = Math.max(-maxY, Math.min(maxY, this.translateY));
  }

  cancelCropping(): void {
    if (this.photoSaving) return;
    this.isCroppingModalOpen = false;
    this.selectedPhotoUrl = null;
    this.rawImage = null;
    this.photoOwnerId = null;
  }

  onPointerDown(event: PointerEvent): void {
    if (this.photoSaving) return;
    const container = event.currentTarget as HTMLElement;
    container.setPointerCapture(event.pointerId);
    this.isDragging = true;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.pointerId = event.pointerId;
  }

  onPointerMove(event: PointerEvent): void {
    if (this.photoSaving || !this.isDragging || event.pointerId !== this.pointerId) {
      return;
    }
    const dx = event.clientX - this.lastPointerX;
    const dy = event.clientY - this.lastPointerY;
    this.translateX += dx;
    this.translateY += dy;
    this.clampCropPosition();
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  }

  onPointerUp(event: PointerEvent): void {
    if (this.isDragging && event.pointerId === this.pointerId) {
      this.isDragging = false;
      this.pointerId = null;
      const container = event.currentTarget as HTMLElement;
      try {
        container.releasePointerCapture(event.pointerId);
      } catch (e) {
        // Ignore error if already released
      }
    }
  }

  async cropAndSave(): Promise<void> {
    if (this.photoSaving) return;
    const userId = this.eatWellService.getActiveUser()?.id;
    if (!userId || this.photoOwnerId !== userId) {
      this.cancelCropping();
      return;
    }
    if (!this.rawImage) {
      this.isCroppingModalOpen = false;
      return;
    }

    const outputSize = 400;
    this.clampCropPosition();
    const ratio = outputSize / this.cropSize;

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      await this.showAlert('Error', 'No se pudo procesar la imagen.');
      this.isCroppingModalOpen = false;
      return;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outputSize, outputSize);

    ctx.save();
    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.translate(this.translateX * ratio, this.translateY * ratio);
    ctx.rotate((this.rotation * Math.PI) / 180);

    const w = this.dispWidth * this.scale * ratio;
    const h = this.dispHeight * this.scale * ratio;
    ctx.drawImage(this.rawImage, -w / 2, -h / 2, w, h);
    ctx.restore();

    const nextImage = canvas.toDataURL('image/jpeg', 0.9);
    this.photoSaving = true;
    try {
      await this.eatWellService.updateProfile({ profileImage: nextImage });
      if (this.eatWellService.getActiveUser()?.id !== userId) return;
      this.profileImage = nextImage;
      this.isCroppingModalOpen = false;
      this.selectedPhotoUrl = null;
      this.rawImage = null;
      this.photoOwnerId = null;
    } catch (error) {
      await this.showAlert('No se guardó la foto', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
    } finally { this.photoSaving = false; }
  }

  setWeightUnit(unit: WeightUnit): void {
    if (this.weightUnit === unit) {
      return;
    }

    this.weightUnit = unit;
    this.displayWeight = this.round(unit === 'kg' ? this.weightKg : this.weightKg * 2.2046226218, 1);
  }

  setHeightUnit(unit: HeightUnit): void {
    if (this.heightUnit === unit) {
      return;
    }

    this.heightUnit = unit;
    this.displayHeight = this.round(unit === 'cm' ? this.heightCm : this.heightCm / 30.48, 2);
  }

  onWeightChange(value: string | number | null | undefined): void {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return;
    }

    this.displayWeight = numericValue;
    this.weightKg = this.weightUnit === 'kg' ? numericValue : numericValue / 2.2046226218;
    this.updateImcPreview();
  }

  onHeightChange(value: string | number | null | undefined): void {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return;
    }

    this.displayHeight = numericValue;
    this.heightCm = this.heightUnit === 'cm' ? numericValue : numericValue * 30.48;
    this.updateImcPreview();
  }

  updateImcPreview(): void {
    if (this.weightKg > 0 && this.heightCm > 0) {
      this.imc = this.eatWellService.calculateImc(this.weightKg, this.heightCm);
    }
  }

  async saveProfile(): Promise<void> {
    if (!this.fullName.trim() || this.weightKg <= 0 || this.heightCm <= 0 || this.age <= 0) {
      await this.showAlert('Datos incompletos', 'Completa la información de tu perfil.');
      return;
    }

    try {
      await this.eatWellService.updateProfile({
        name: this.fullName,
        weightKg: this.round(this.weightKg, 2),
        heightCm: this.round(this.heightCm, 2),
        gender: this.gender,
        age: Number(this.age),
        profileImage: this.profileImage,
      });

      let preferencesCompleted = false;
      try {
        const prefs = await this.eatWellService.getFoodPreferences();
        preferencesCompleted = !!prefs?.completed;
      } catch {
        preferencesCompleted = false;
      }

      const shouldGoToPreferences = this.isOnboarding && !preferencesCompleted;
      await this.router.navigateByUrl(shouldGoToPreferences ? '/preferencias-alimentarias' : '/tabs/home');
    } catch (error) {
      await this.showAlert('Error de perfil', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    }
  }

  private syncDisplayValues(): void {
    this.displayWeight = this.round(this.weightKg, 1);
    this.displayHeight = this.round(this.heightCm, 1);
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    });
  }

  private round(value: number, decimals: number): number {
    return Number(value.toFixed(decimals));
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['Aceptar'],
    });
    await alert.present();
  }
}
