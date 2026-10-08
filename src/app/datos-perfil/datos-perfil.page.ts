import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, IonicModule, IonContent } from '@ionic/angular';
import { EatWellService, Gender } from '../core';
import { ActivityBand, LifestyleSettings, loadLifestyleSettings, lifestyleStorageKey } from '../core/lifestyle-goals';
import { FitnessGoal } from '../core/models';

type WeightUnit = 'kg' | 'lbs';
type HeightUnit = 'cm' | 'ft';
type R24hTimeField = 'wakeTime' | 'breakfastTime' | 'snackTime' | 'lunchTime' | 'activityTime' | 'dinnerTime' | 'sleepTime';

@Component({
  selector: 'app-datos-perfil',
  templateUrl: './datos-perfil.page.html',
  styleUrls: ['./datos-perfil.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class DatosPerfilPage implements OnInit {
  @ViewChild('photoInput') photoInput?: ElementRef<HTMLInputElement>;
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
  foodPreferencesCompleted = false;
  showProfileModuleDetails = false;
  view: 'settings' | 'general' | 'clinical' | 'r24h' | 'lifestyle' | 'privacy' = 'settings';

  private moduleTouchStartX = 0;
  private moduleTouchStartY = 0;
  private moduleSwipeEligible = false;

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

  r24hData = {
    wakeTime: '',
    wakeActivity: '',
    breakfastTime: '',
    breakfastPlace: '',
    breakfastDetails: '',
    snackTime: '',
    snackPlace: '',
    snackDetails: '',
    lunchTime: '',
    lunchPlace: '',
    lunchDetails: '',
    activityTime: '',
    activityType: '',
    activityDuration: '',
    dinnerTime: '',
    dinnerPlace: '',
    dinnerDetails: '',
    sleepTime: '',
  };

  isTimePickerOpen = false;
  activeTimeField: R24hTimeField | null = null;
  timePickerValue = '2000-01-01T00:00:00';

  clinicalData = {
    familyNone: false,
    familyDiabetes: false,
    familyHypertension: false,
    familyObesity: false,
    familyCholesterol: false,
    familyCancer: false,
    familyRenal: false,
    familyThyroid: false,
    diagnosisNone: false,
    diagnosisDiabetes: false,
    diagnosisHypertension: false,
    diagnosisFattyLiver: false,
    diagnosisSop: false,
    diagnosisGout: false,
    diagnosisHypothyroidism: false,
    wellbeingNone: false,
    wellbeingAnemia: false,
    wellbeingBulimia: false,
    wellbeingDepression: false,
    wellbeingAnxiety: false,
    wellbeingOther: '',
    wellbeingTreatment: '',
    wellbeingSupport: '',
    wellbeingNotes: '',
    surgeriesNone: false,
    surgeries: '',
    hospitalizationsNone: false,
    hospitalizations: '',
    pregnant: 'No',
    lactating: 'No',
    menstrualCycle: 'Regular',
    allergies: [] as string[],
    allergiesNone: false,
    otherAllergies: '',
    medicationsNone: false,
    medications: '',
    medicationAllergiesNone: false,
    medicationAllergies: '',
    supplementsNone: false,
    supplements: '',
    weightLossTreatment: 'No',
    sleepHours: '7-8 hrs',
    sleepQuality: 'Reparador',
    bowelFrequency: '1 a 2 veces al día',
    alcohol: 'Ocasional',
    tobacco: 'No fumo',
    cigarettesPerDay: 0,
    otherSubstances: 'No',
    cooksAtHome: 'Yo mismo(a)',
    weekdayPlace: 'En casa',
    appetite: 'Normal',
    anxiety: 'Sí',
    waterLiters: 2,
  };
  private readonly clinicalDataDefaults = structuredClone(this.clinicalData);

  readonly allergyOptions = ['Lactosa', 'Gluten', 'Marisco', 'Nuez/Maní'];

  formName = '';
  birthDate = '';
  activityLevel: 'sedentary' | 'standing' | 'active' = 'sedentary';
  phone = '';
  municipality = '';

  readonly settingsItems = [
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

  openProfileModule(view: Exclude<DatosPerfilPage['view'], 'settings'>): void {
    if (view === 'general') {
      this.syncGeneralFormFromProfile();
    } else if (view === 'lifestyle') {
      const activeUser = this.eatWellService.getActiveUser();
      if (activeUser) {
        this.loadLifestyleForm(activeUser.id, activeUser.goal);
      }
    }

    this.view = view;
    void this.content?.scrollToTop(0);
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
    this.isOnboarding = this.route.snapshot.queryParamMap.get('onboarding') === '1';
    const activeUser = this.eatWellService.getActiveUser();

    if (!activeUser) {
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
    void this.loadFoodPreferencesCompletion(activeUser.id);
    this.loadLifestyleForm(activeUser.id, activeUser.goal);

    this.formName = this.fullName;
    this.birthDate = this.buildBirthDateFromAge(this.age);
    this.phone = this.phone || '';
    this.municipality = this.municipality || '';
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
      { name: 'Estilo de vida y metas', completed: !!activeUser && !!loadLifestyleSettings(activeUser.id) },
      { name: 'Preferencias alimentarias', completed: this.foodPreferencesCompleted },
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
    return this.completedProfileModules * 20;
  }

  toggleProfileModuleDetails(): void {
    this.showProfileModuleDetails = !this.showProfileModuleDetails;
  }

  private get isClinicalHistoryComplete(): boolean {
    const data = this.clinicalData;
    const hasFamilyAnswer = data.familyNone || [
      data.familyDiabetes,
      data.familyHypertension,
      data.familyObesity,
      data.familyCholesterol,
      data.familyCancer,
      data.familyRenal,
      data.familyThyroid,
    ].some(Boolean);
    const hasDiagnosisAnswer = data.diagnosisNone || [
      data.diagnosisDiabetes,
      data.diagnosisHypertension,
      data.diagnosisFattyLiver,
      data.diagnosisSop,
      data.diagnosisGout,
      data.diagnosisHypothyroidism,
    ].some(Boolean);
    const hasWellbeingAnswer = data.wellbeingNone || [
      data.wellbeingAnemia,
      data.wellbeingBulimia,
      data.wellbeingDepression,
      data.wellbeingAnxiety,
    ].some(Boolean) || data.wellbeingOther.trim().length > 0;
    const hasAllergyAnswer = data.allergiesNone || data.allergies.length > 0 || data.otherAllergies.trim().length > 0;

    return hasFamilyAnswer
      && hasDiagnosisAnswer
      && hasWellbeingAnswer
      && hasAllergyAnswer
      && (data.surgeriesNone || data.surgeries.trim().length > 0)
      && (data.hospitalizationsNone || data.hospitalizations.trim().length > 0)
      && (data.medicationsNone || data.medications.trim().length > 0)
      && (data.medicationAllergiesNone || data.medicationAllergies.trim().length > 0)
      && (data.supplementsNone || data.supplements.trim().length > 0)
      && !!data.wellbeingTreatment
      && !!data.wellbeingSupport;
  }

  private get isR24hComplete(): boolean {
    return Object.values(this.r24hData).every(value => value.trim().length > 0);
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

  async handleSettingsItem(item: { route?: string; title: string; id?: string }): Promise<void> {
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
    this.clinicalData.allergies = allergies.includes(allergy)
      ? allergies.filter(item => item !== allergy)
      : [...allergies, allergy];
  }

  toggleExerciseType(value: string): void {
    const selected = this.lifestyleSettings.exerciseTypes;
    if (value === 'none') {
      this.lifestyleSettings.exerciseTypes = selected.includes('none') ? [] : ['none'];
      return;
    }
    this.lifestyleSettings.exerciseTypes = selected.includes(value)
      ? selected.filter(item => item !== value)
      : [...selected.filter(item => item !== 'none'), value];
  }

  isExerciseSelected(value: string): boolean {
    return this.lifestyleSettings.exerciseTypes.includes(value);
  }

  private loadLifestyleForm(userId: string, goal: FitnessGoal): void {
    const saved = loadLifestyleSettings(userId);
    this.lifestyleSettings = saved ?? {
      goal,
      targetWeightKg: this.weightKg,
      activityBand: 'moderate',
      exerciseTypes: [],
      sessionDuration: 45,
      trainingTime: 'afternoon',
      cookingTime: 'medium',
      stressLevel: 'moderate',
    };
    this.lifestyleSettings.goal = goal;
  }

  async saveLifestyleGoals(): Promise<void> {
    const activeUser = this.eatWellService.getActiveUser();
    const targetWeight = Number(this.lifestyleSettings.targetWeightKg);
    if (!activeUser || !Number.isFinite(targetWeight) || targetWeight < 25 || targetWeight > 350) {
      await this.showAlert('Revisa el peso objetivo', 'Ingresa un peso objetivo entre 25 y 350 kg.');
      return;
    }

    const activityMap: Record<ActivityBand, 'low' | 'moderate' | 'high'> = {
      sedentary: 'low',
      light: 'low',
      moderate: 'moderate',
      intense: 'high',
    };

    try {
      await this.eatWellService.updateProfile({
        goal: this.lifestyleSettings.goal,
        activityLevel: activityMap[this.lifestyleSettings.activityBand],
      });
      this.lifestyleSettings.targetWeightKg = targetWeight;
      localStorage.setItem(lifestyleStorageKey(activeUser.id), JSON.stringify(this.lifestyleSettings));
      await this.showAlert('Objetivos guardados', 'El plan alimenticio actualizará sus recomendaciones y distribución estimada de macronutrientes.');
      this.view = 'settings';
    } catch (error) {
      await this.showAlert('Error', error instanceof Error ? error.message : 'No se pudieron guardar los objetivos.');
    }
  }

  async clearGeneralModule(): Promise<void> {
    if (!await this.confirmModuleReset('datos generales y antropométricos')) {
      return;
    }

    try {
      const user = await this.eatWellService.updateProfile({
        age: 18,
        gender: 'other',
        heightCm: 170,
        weightKg: 70,
        activityLevel: 'moderate',
      });
      this.age = user.age;
      this.gender = user.gender;
      this.heightCm = user.heightCm;
      this.weightKg = user.weightKg;
      this.imc = user.imc;
      this.formName = user.name;
      this.birthDate = this.buildBirthDateFromAge(user.age);
      this.phone = '';
      this.municipality = '';
      this.syncDisplayValues();
      this.view = 'settings';
      await this.showAlert('Datos eliminados', 'Se restablecieron las medidas para que puedas volver a capturarlas.');
    } catch (error) {
      await this.showAlert('Error', error instanceof Error ? error.message : 'No se pudieron borrar los datos generales.');
    }
  }

  async clearClinicalModule(): Promise<void> {
    if (!await this.confirmModuleReset('historial clínico')) {
      return;
    }

    this.clinicalData = structuredClone(this.clinicalDataDefaults);
    this.view = 'settings';
    await this.showAlert('Datos eliminados', 'El historial clínico quedó listo para volver a capturarse.');
  }

  async clearR24hModule(): Promise<void> {
    if (!await this.confirmModuleReset('recordatorio de 24 horas')) {
      return;
    }

    for (const field of Object.keys(this.r24hData) as (keyof typeof this.r24hData)[]) {
      this.r24hData[field] = '';
    }
    this.view = 'settings';
    await this.showAlert('Datos eliminados', 'El recordatorio de 24 horas quedó vacío.');
  }

  async clearLifestyleModule(): Promise<void> {
    const activeUser = this.eatWellService.getActiveUser();
    if (!activeUser || !await this.confirmModuleReset('estilo de vida y metas')) {
      return;
    }

    try {
      await this.eatWellService.updateProfile({ goal: 'improve_health', activityLevel: 'moderate' });
      localStorage.removeItem(lifestyleStorageKey(activeUser.id));
      this.loadLifestyleForm(activeUser.id, 'improve_health');
      this.view = 'settings';
      await this.showAlert('Datos eliminados', 'Las metas se restablecieron y puedes volver a configurarlas.');
    } catch (error) {
      await this.showAlert('Error', error instanceof Error ? error.message : 'No se pudieron borrar las metas.');
    }
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
    const hasFamilyAnswer = this.clinicalData.familyNone || [
      this.clinicalData.familyDiabetes,
      this.clinicalData.familyHypertension,
      this.clinicalData.familyObesity,
      this.clinicalData.familyCholesterol,
      this.clinicalData.familyCancer,
      this.clinicalData.familyRenal,
      this.clinicalData.familyThyroid,
    ].some(Boolean);
    const hasDiagnosisAnswer = this.clinicalData.diagnosisNone || [
      this.clinicalData.diagnosisDiabetes,
      this.clinicalData.diagnosisHypertension,
      this.clinicalData.diagnosisFattyLiver,
      this.clinicalData.diagnosisSop,
      this.clinicalData.diagnosisGout,
      this.clinicalData.diagnosisHypothyroidism,
    ].some(Boolean);
    const hasWellbeingAnswer = this.clinicalData.wellbeingNone || [
      this.clinicalData.wellbeingAnemia,
      this.clinicalData.wellbeingBulimia,
      this.clinicalData.wellbeingDepression,
      this.clinicalData.wellbeingAnxiety,
    ].some(Boolean) || this.clinicalData.wellbeingOther.trim().length > 0;
    const hasAllergyAnswer = this.clinicalData.allergiesNone
      || this.clinicalData.allergies.length > 0
      || this.clinicalData.otherAllergies.trim().length > 0;
    const hasSurgeriesAnswer = this.clinicalData.surgeriesNone || this.clinicalData.surgeries.trim().length > 0;
    const hasHospitalizationAnswer = this.clinicalData.hospitalizationsNone || this.clinicalData.hospitalizations.trim().length > 0;
    const hasMedicationAnswer = this.clinicalData.medicationsNone || this.clinicalData.medications.trim().length > 0;
    const hasMedicationAllergyAnswer = this.clinicalData.medicationAllergiesNone || this.clinicalData.medicationAllergies.trim().length > 0;
    const hasSupplementAnswer = this.clinicalData.supplementsNone || this.clinicalData.supplements.trim().length > 0;

    if (!hasFamilyAnswer || !hasDiagnosisAnswer || !hasWellbeingAnswer || !hasAllergyAnswer || !hasSurgeriesAnswer || !hasHospitalizationAnswer || !hasMedicationAnswer || !hasMedicationAllergyAnswer || !hasSupplementAnswer || !this.clinicalData.wellbeingTreatment || !this.clinicalData.wellbeingSupport) {
      await this.showAlert('Historial incompleto', 'Responde todas las preguntas o selecciona Ninguno / No aplica cuando corresponda.');
      return;
    }

    await this.showAlert('Guardado', 'El historial clínico se guardó correctamente.');
    this.view = 'settings';
  }

  async saveR24h(): Promise<void> {
    const requiredValues = [
      this.r24hData.wakeTime,
      this.r24hData.wakeActivity,
      this.r24hData.breakfastTime,
      this.r24hData.breakfastPlace,
      this.r24hData.breakfastDetails,
      this.r24hData.snackTime,
      this.r24hData.snackPlace,
      this.r24hData.snackDetails,
      this.r24hData.lunchTime,
      this.r24hData.lunchPlace,
      this.r24hData.lunchDetails,
      this.r24hData.activityTime,
      this.r24hData.activityType,
      this.r24hData.activityDuration,
      this.r24hData.dinnerTime,
      this.r24hData.dinnerPlace,
      this.r24hData.dinnerDetails,
      this.r24hData.sleepTime,
    ];

    if (requiredValues.some(value => !value.trim())) {
      await this.showAlert('Recordatorio incompleto', 'Completa todos los horarios, lugares, alimentos y datos de actividad antes de guardar.');
      return;
    }

    await this.showAlert('Guardado', 'El recordatorio de 24 horas se guardó correctamente.');
    this.view = 'settings';
  }

  openTimePicker(field: R24hTimeField): void {
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
    if (this.activeTimeField) {
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
    if (!this.formName.trim() || !this.birthDate || !this.heightCm || !this.weightKg || !this.phone.trim() || !this.municipality.trim()) {
      await this.showAlert('Datos incompletos', 'Completa la información personal, medidas y contacto para continuar.');
      return;
    }

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
      this.view = 'settings';
    } catch (error) {
      await this.showAlert('Error', error instanceof Error ? error.message : 'No se pudo guardar la información.');
    }
  }

  openPhotoPicker(): void {
    this.photoInput?.nativeElement.click();
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      await this.showAlert('Archivo inválido', 'Selecciona una imagen.');
      return;
    }

    const dataUrl = await this.readFileAsDataUrl(file);
    input.value = '';

    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
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
    };
    img.onerror = async () => {
      await this.showAlert('Error', 'No se pudo cargar la imagen.');
    };
  }

  rotateImage(): void {
    this.rotation = (this.rotation + 90) % 360;
  }

  cancelCropping(): void {
    this.isCroppingModalOpen = false;
    this.selectedPhotoUrl = null;
    this.rawImage = null;
  }

  onPointerDown(event: PointerEvent): void {
    const container = event.currentTarget as HTMLElement;
    container.setPointerCapture(event.pointerId);
    this.isDragging = true;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.pointerId = event.pointerId;
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging || event.pointerId !== this.pointerId) {
      return;
    }
    const dx = event.clientX - this.lastPointerX;
    const dy = event.clientY - this.lastPointerY;
    this.translateX += dx;
    this.translateY += dy;
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
    if (!this.rawImage) {
      this.isCroppingModalOpen = false;
      return;
    }

    const outputSize = 400;
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
    this.profileImage = nextImage;

    try {
      await this.eatWellService.updateProfile({ profileImage: nextImage });
    } catch (error) {
      console.error('No se pudo actualizar la foto del perfil', error);
    }

    this.isCroppingModalOpen = false;
    this.selectedPhotoUrl = null;
    this.rawImage = null;
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
