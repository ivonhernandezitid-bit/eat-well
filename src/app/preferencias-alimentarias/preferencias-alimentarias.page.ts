import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { DietType, EatWellService, FoodPreferences } from '../core';

function emptyFoodPreferences(): FoodPreferences {
  return { dietType: 'omnivore', preferredFruits: [], preferredVegetables: [], preferredProteins: [], preferredCarbohydrates: [], preferredLegumes: [], preferredDairy: [], preferredFats: [], allergies: [], dislikedFoods: [], noPreferenceCategories: [], cookingTimeMinutes: 30, completed: false };
}

type FoodPreferenceList = 'preferredFruits' | 'preferredVegetables' | 'preferredProteins' | 'preferredCarbohydrates' | 'preferredLegumes' | 'preferredDairy' | 'preferredFats' | 'allergies' | 'dislikedFoods';
type FoodPreferenceCategory = 'fruits' | 'vegetables' | 'proteins' | 'carbohydrates' | 'legumes' | 'dairy' | 'fats' | 'allergies' | 'dislikedFoods';

const foodPreferenceCategories: Record<FoodPreferenceCategory, { label: string; list: FoodPreferenceList }> = {
  fruits: { label: 'Frutas preferidas', list: 'preferredFruits' },
  vegetables: { label: 'Verduras preferidas', list: 'preferredVegetables' },
  proteins: { label: 'Proteínas', list: 'preferredProteins' },
  carbohydrates: { label: 'Carbohidratos', list: 'preferredCarbohydrates' },
  legumes: { label: 'Legumbres', list: 'preferredLegumes' },
  dairy: { label: 'Lácteos y alternativas', list: 'preferredDairy' },
  fats: { label: 'Aceites, grasas, semillas y frutos secos', list: 'preferredFats' },
  allergies: { label: 'Alergias', list: 'allergies' },
  dislikedFoods: { label: 'Alimentos que no te gustan', list: 'dislikedFoods' },
};

const allergyFoodTerms: Record<string, string[]> = {
  lacteos: ['leche', 'yogur', 'queso', 'requeson', 'mantequilla', 'crema de leche'],
  lactosa: ['leche', 'yogur', 'queso', 'requeson', 'mantequilla', 'crema de leche'],
  huevo: ['huevo', 'mayonesa'],
  cacahuate: ['cacahuate', 'crema de cacahuate'],
  'nueces de arbol': ['nuez', 'almendra', 'avellana', 'pistacho', 'pistaches', 'anacardo', 'anacardos', 'macadamia'],
  gluten: ['trigo', 'harina', 'pan', 'pasta', 'centeno', 'cebada', 'seitan', 'avena'],
  trigo: ['trigo', 'harina', 'pan', 'pasta', 'seitan'],
  soya: ['soya', 'soja', 'tofu', 'tempeh', 'edamame'],
  pescado: ['pescado', 'salmon', 'atun', 'sardinas'],
  mariscos: ['marisco', 'camaron', 'molusco', 'almeja', 'mejillon', 'pulpo'],
  moluscos: ['molusco', 'almeja', 'mejillon', 'pulpo'],
  sesamo: ['sesamo', 'ajonjoli', 'tahini'],
  maiz: ['maiz', 'elote'],
  legumbres: ['frijol', 'lenteja', 'garbanzo', 'haba', 'chicharo', 'soya', 'tofu', 'tempeh', 'edamame'],
};

function normalizeFoodName(value: string): string {
  return value.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function foodContainsTerm(food: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(food);
}

@Component({
  selector: 'app-preferencias-alimentarias',
  templateUrl: './preferencias-alimentarias.page.html',
  styleUrls: ['./preferencias-alimentarias.page.scss'],
  standalone: false,
})
export class PreferenciasAlimentariasPage implements OnInit {
  readonly fruits = [
    'Manzana', 'Plátano', 'Naranja', 'Fresa', 'Mango', 'Piña', 'Uvas', 'Papaya',
    'Melón', 'Sandía', 'Limón', 'Guayaba', 'Kiwi', 'Durazno', 'Pera', 'Guanábana',
    'Mandarina', 'Zarzamora', 'Arándano', 'Frambuesa', 'Higo', 'Ciruela', 'Toronja',
    'Cereza', 'Granada', 'Coco', 'Maracuyá', 'Aguacate'
  ];
  readonly vegetables = [
    'Jitomate', 'Zanahoria', 'Brócoli', 'Espinaca', 'Calabaza', 'Pepino', 'Pimiento', 'Lechuga',
    'Cebolla', 'Ajo', 'Champiñones', 'Papa', 'Berenjena', 'Coliflor', 'Apio', 'Betabel',
    'Espárragos', 'Nopal', 'Elote', 'Chícharos', 'Cilantro', 'Acelga', 'Camote',
    'Col de Bruselas', 'Calabacita', 'Ejotes', 'Chayote', 'Rábano'
  ];
  readonly proteins = [
    'Pollo', 'Pavo', 'Res', 'Cerdo', 'Salmón', 'Atún', 'Sardinas', 'Pescado blanco',
    'Camarón', 'Huevo', 'Carne molida', 'Jamón de pavo'
  ];
  readonly plantProteins = ['Tofu', 'Tempeh', 'Seitán', 'Proteína de soya texturizada'];
  readonly carbohydrates = [
    'Arroz', 'Avena', 'Pasta', 'Tortilla de maíz', 'Tortilla de harina', 'Pan integral',
    'Pan de centeno', 'Papa', 'Camote', 'Quinoa', 'Elote', 'Amaranto'
  ];
  readonly legumes = [
    'Frijoles', 'Lentejas', 'Garbanzos', 'Habas', 'Chícharos', 'Soya', 'Tofu', 'Edamame',
    'Cacahuates', 'Crema de cacahuate'
  ];
  readonly dairy = [
    'Leche', 'Leche sin lactosa', 'Yogur natural', 'Yogur griego', 'Queso panela',
    'Queso cottage', 'Requesón', 'Bebida de soya', 'Bebida de avena', 'Bebida de almendra', 'Bebida de coco'
  ];
  readonly oilsAndFats = [
    'Aceite de oliva', 'Aceite de canola', 'Aceite de girasol', 'Aceite de maíz',
    'Aceite de soya', 'Aceite de aguacate', 'Aceite de ajonjolí', 'Aceite de cártamo',
    'Aceite de coco', 'Mantequilla', 'Margarina', 'Manteca de cerdo', 'Mayonesa',
  ];
  readonly seeds = [
    'Chía', 'Linaza', 'Pepitas de calabaza', 'Semillas de girasol', 'Ajonjolí',
    'Semillas de amapola', 'Semillas de cáñamo',
  ];
  readonly nuts = [
    'Almendras', 'Nueces', 'Nuez pecana', 'Avellanas', 'Pistaches',
    'Anacardos', 'Macadamias', 'Nuez de Brasil',
  ];
  readonly allergyOptions = [
    'Lácteos', 'Huevo', 'Cacahuate', 'Nueces de árbol', 'Gluten', 'Soya', 'Pescado', 'Mariscos',
    'Sésamo', 'Mostaza', 'Sulfitos', 'Moluscos', 'Maíz', 'Trigo', 'Fresa', 'Apio',
    'Altramuces', 'Chocolate', 'Legumbres', 'Lactosa'
  ];
  readonly commonDislikedFoods = [
    'Cebolla', 'Aceitunas', 'Cilantro', 'Ajo', 'Champiñones', 'Pasas', 'Berenjena', 'Hígado',
    'Brócoli', 'Pescado'
  ];

  preferences: FoodPreferences = emptyFoodPreferences();
  loadError = '';
  private loadedUserId: string | null = null;
  private loadRequest = 0;
  dislikedFoodsInput = '';
  otherFruitsInput = '';
  otherVegetablesInput = '';
  otherAllergiesInput = '';
  isLoading = true;
  isSaving = false;
  validationAttempted = false;
  currentSection: string | null = null;
  private dietToastTimeout: number | undefined;
  private dietToastSequence = 0;
  private activeDietToast: HTMLIonToastElement | null = null;
  private moduleTouchStartX = 0;
  private moduleTouchStartY = 0;
  private moduleSwipeEligible = false;
  private customConflictPromptActive = false;

  get proteinsForDiet(): string[] {
    if (this.preferences.dietType === 'vegan') {
      return this.plantProteins;
    }
    if (this.preferences.dietType === 'vegetarian') {
      return ['Huevo', ...this.plantProteins];
    }
    return [...this.proteins, ...this.plantProteins];
  }

  get dairyForDiet(): string[] {
    return this.preferences.dietType === 'vegan'
      ? this.dairy.filter(food => food.startsWith('Bebida de'))
      : this.dairy;
  }

  private readonly eatWellService = inject(EatWellService);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly route = inject(ActivatedRoute);

  get title(): string {
    switch (this.currentSection) {
      case 'vegetables': return 'Verduras';
      case 'fruits': return 'Frutas';
      case 'allergies': return 'Alergias';
      case 'general': return 'Preferencias Alimentarias';
      default: return 'Preferencias Alimentarias';
    }
  }

  get saveButtonLabel(): string {
    return 'Guardar y continuar';
  }

  get missingPreferenceCategories(): string[] {
    return (Object.entries(foodPreferenceCategories) as [FoodPreferenceCategory, typeof foodPreferenceCategories[FoodPreferenceCategory]][])
      .filter(([category]) => this.isPreferenceCategoryMissing(category))
      .map(([, config]) => config.label);
  }

  get isPreferencesComplete(): boolean {
    return this.missingPreferenceCategories.length === 0
      && ['omnivore', 'vegetarian', 'vegan'].includes(this.preferences.dietType);
  }

  showSection(section: string): boolean {
    return !this.currentSection || !this.isPreferencesComplete || this.currentSection === section;
  }

  isNoPreferenceCategory(category: FoodPreferenceCategory): boolean {
    return this.preferences.noPreferenceCategories.includes(category);
  }

  isPreferenceCategoryMissing(category: FoodPreferenceCategory): boolean {
    const hasSelection = this.hasPreferenceCategorySelection(category);
    return hasSelection === this.isNoPreferenceCategory(category);
  }

  private hasPreferenceCategorySelection(category: FoodPreferenceCategory): boolean {
    const list = foodPreferenceCategories[category].list;
    const hasSavedItems = this.preferences[list].length > 0;
    if (category === 'fruits') return hasSavedItems || this.otherFruitsInput.split(',').some(value => value.trim());
    if (category === 'vegetables') return hasSavedItems || this.otherVegetablesInput.split(',').some(value => value.trim());
    if (category === 'allergies') return hasSavedItems || this.otherAllergiesInput.split(',').some(value => value.trim());
    if (category === 'dislikedFoods') return hasSavedItems || this.dislikedFoodsInput.split(',').some(value => value.trim());
    return hasSavedItems;
  }

  toggleNoPreferenceCategory(category: FoodPreferenceCategory): void {
    const config = foodPreferenceCategories[category];
    const currentlyConfirmed = this.isNoPreferenceCategory(category);
    this.preferences.noPreferenceCategories = this.preferences.noPreferenceCategories.filter(item => item !== category);
    if (currentlyConfirmed) return;
    this.preferences[config.list] = [];
    if (category === 'fruits') this.otherFruitsInput = '';
    if (category === 'vegetables') this.otherVegetablesInput = '';
    if (category === 'allergies') this.otherAllergiesInput = '';
    if (category === 'dislikedFoods') this.dislikedFoodsInput = '';
    this.preferences.noPreferenceCategories = [...this.preferences.noPreferenceCategories, category];
  }

  clearNoPreferenceCategory(category: FoodPreferenceCategory): void {
    this.preferences.noPreferenceCategories = this.preferences.noPreferenceCategories.filter(item => item !== category);
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.currentSection = params.get('section');
    });
  }

  async ionViewWillEnter(): Promise<void> {
    this.currentSection = this.route.snapshot.queryParamMap.get('section');
    await this.loadPreferencesData();
  }

  async returnToProfile(): Promise<void> {
    await this.router.navigateByUrl('/tabs/datos-perfil');
  }

  onModuleTouchStart(event: TouchEvent): void {
    this.moduleTouchStartX = event.touches[0]?.clientX ?? 0;
    this.moduleTouchStartY = event.touches[0]?.clientY ?? 0;
    const target = event.target;
    const startedOnControl = target instanceof Element
      && target.closest('button, input, select, textarea, ion-button, ion-segment, ion-select, ion-range');

    this.moduleSwipeEligible = !startedOnControl;
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
    void this.router.navigateByUrl('/tabs/datos-perfil');
  }

  ionViewWillLeave(): void {
    this.dietToastSequence++;
    if (this.dietToastTimeout !== undefined) {
      window.clearTimeout(this.dietToastTimeout);
      this.dietToastTimeout = undefined;
    }
    void this.dismissActiveDietToast();
  }

  private async loadPreferencesData(): Promise<void> {
    const version = ++this.loadRequest;
    const userId = this.eatWellService.getActiveUser()?.id;
    this.isLoading = true;
    this.loadError = '';
    this.loadedUserId = null;
    this.preferences = emptyFoodPreferences();
    this.validationAttempted = false;
    this.otherFruitsInput = this.otherVegetablesInput = this.otherAllergiesInput = this.dislikedFoodsInput = '';
    try {
      if (!userId) throw new Error('Vuelve a iniciar sesión para cargar tus preferencias.');
      const saved = await this.eatWellService.getFoodPreferences();
      if (version !== this.loadRequest) return;
      if (this.eatWellService.getActiveUser()?.id !== userId) throw new Error('La cuenta cambió. Vuelve a abrir tus preferencias.');
      this.preferences = {
        ...emptyFoodPreferences(),
        ...saved,
      };
      const legacyPeanutFoods = this.preferences.preferredFats.filter(food =>
        ['cacahuates', 'crema de cacahuate'].includes(normalizeFoodName(food)),
      );
      this.preferences.preferredFats = this.preferences.preferredFats.filter(food =>
        !['cacahuates', 'crema de cacahuate'].includes(normalizeFoodName(food)),
      );
      this.preferences.preferredLegumes = Array.from(new Set([
        ...this.preferences.preferredLegumes,
        ...legacyPeanutFoods,
      ]));
      this.setDietType(this.preferences.dietType);
      
      // Extract custom items not present in static lists
      const customFruits = this.preferences.preferredFruits.filter(f => !this.fruits.includes(f));
      this.otherFruitsInput = customFruits.join(', ');
      this.preferences.preferredFruits = this.preferences.preferredFruits.filter(f => this.fruits.includes(f));
      
      const customVegetables = this.preferences.preferredVegetables.filter(v => !this.vegetables.includes(v));
      this.otherVegetablesInput = customVegetables.join(', ');
      this.preferences.preferredVegetables = this.preferences.preferredVegetables.filter(v => this.vegetables.includes(v));
      
      const customAllergies = this.preferences.allergies.filter(a => !this.allergyOptions.includes(a));
      this.otherAllergiesInput = customAllergies.join(', ');
      this.preferences.allergies = this.preferences.allergies.filter(a => this.allergyOptions.includes(a));

      const customDisliked = this.preferences.dislikedFoods.filter(d => !this.commonDislikedFoods.includes(d));
      this.dislikedFoodsInput = customDisliked.join(', ');
      this.preferences.dislikedFoods = this.preferences.dislikedFoods.filter(d => this.commonDislikedFoods.includes(d));
      this.loadedUserId = userId;
    } catch (error) {
      if (version === this.loadRequest) this.loadError = error instanceof Error ? error.message : 'No se pudieron cargar tus preferencias.';
    } finally {
      if (version === this.loadRequest) this.isLoading = false;
    }
  }

  async retryLoad(): Promise<void> {
    await this.loadPreferencesData();
  }

  setDietType(dietType: DietType): void {
    const previousDiet = this.preferences.dietType;
    if (previousDiet === dietType) {
      return;
    }

    this.preferences.dietType = dietType;
    this.preferences.preferredProteins = this.preferences.preferredProteins
      .filter(food => this.proteinsForDiet.includes(food));
    this.preferences.preferredDairy = this.preferences.preferredDairy
      .filter(food => this.dairyForDiet.includes(food));

    const dietMessages: Record<DietType, string> = {
      omnivore: 'Alimentación omnívora seleccionada. Cambios pendientes de guardar.',
      vegetarian: 'Alimentación vegetariana seleccionada. Cambios pendientes de guardar.',
      vegan: 'Alimentación vegana seleccionada. Cambios pendientes de guardar.',
    };

    void this.showDietChangeToast(dietMessages[dietType]);
  }

  private showDietChangeToast(message: string): void {
    const sequence = ++this.dietToastSequence;
    if (this.dietToastTimeout !== undefined) {
      window.clearTimeout(this.dietToastTimeout);
    }
    void this.dismissActiveDietToast();
    this.dietToastTimeout = window.setTimeout(() => {
      this.dietToastTimeout = undefined;
      void this.presentDietChangeToast(message, sequence);
    }, 300);
  }

  private async presentDietChangeToast(message: string, sequence: number): Promise<void> {
    await this.dismissActiveDietToast();
    if (sequence !== this.dietToastSequence) {
      return;
    }

    const toast = await this.toastController.create({
      message,
      duration: 4000,
      position: 'bottom',
      color: 'success',
      buttons: [{ text: 'Entendido', role: 'cancel' }],
    });

    if (sequence !== this.dietToastSequence) {
      await toast.dismiss();
      return;
    }

    this.activeDietToast = toast;
    toast.addEventListener('ionToastDidDismiss', () => {
      if (this.activeDietToast === toast) {
        this.activeDietToast = null;
      }
    }, { once: true });
    await toast.present();
  }

  private async dismissActiveDietToast(): Promise<void> {
    const toast = this.activeDietToast;
    this.activeDietToast = null;
    if (toast) {
      await toast.dismiss();
    }
  }

  async togglePreference(listName: FoodPreferenceList, value: string): Promise<void> {
    const values = this.preferences[listName];
    const category = (Object.entries(foodPreferenceCategories) as [FoodPreferenceCategory, typeof foodPreferenceCategories[FoodPreferenceCategory]][])
      .find(([, config]) => config.list === listName)?.[0];
    if (category) this.clearNoPreferenceCategory(category);
    if (values.includes(value)) {
      this.preferences[listName] = values.filter(item => item !== value);
      return;
    }

    if (listName === 'dislikedFoods') {
      const conflicts = this.findPreferredNameConflicts(value);
      for (const conflict of conflicts) {
        if (!await this.confirmPreferredToDisliked(conflict.food)) return;
        this.removePreferredFoods([conflict.food]);
      }
      this.preferences.dislikedFoods = [...this.preferences.dislikedFoods, value];
      return;
    }

    if (listName === 'allergies') {
      const conflicts = this.findAllergyConflicts([value], this.getPreferredFoods());
      if (conflicts.length > 0) {
        const confirmed = await this.confirmAllergyConflicts(value, conflicts);
        if (!confirmed) return;
        this.removePreferredFoods(conflicts.map(conflict => conflict.food));
      }
      this.preferences.allergies = [...this.preferences.allergies, value];
      return;
    }

    if (listName.startsWith('preferred')) {
      const conflicts = this.findAllergyConflicts(this.preferences.allergies, [{ listName, food: value }]);
      if (conflicts.length > 0) {
        await this.showError(`“${value}” está marcado como alergia o intolerancia. Retíralo primero de Alergias para agregarlo a tus preferencias.`);
        return;
      }
    }

    this.preferences[listName] = values.includes(value)
      ? values.filter(item => item !== value)
      : [...values, value];
  }

  isSelected(listName: FoodPreferenceList, value: string): boolean {
    return this.preferences[listName].includes(value);
  }

  private getPreferredFoods(): Array<{ listName: FoodPreferenceList; food: string }> {
    const listNames: FoodPreferenceList[] = [
      'preferredFruits',
      'preferredVegetables',
      'preferredProteins',
      'preferredCarbohydrates',
      'preferredLegumes',
      'preferredDairy',
      'preferredFats',
    ];
    const foods: Array<{ listName: FoodPreferenceList; food: string }> = [];
    for (const listName of listNames) {
      for (const food of this.preferences[listName]) {
        foods.push({ listName, food });
      }
    }
    for (const food of this.otherFruitsInput.split(',').map(value => value.trim()).filter(Boolean)) {
      foods.push({ listName: 'preferredFruits', food });
    }
    for (const food of this.otherVegetablesInput.split(',').map(value => value.trim()).filter(Boolean)) {
      foods.push({ listName: 'preferredVegetables', food });
    }
    return foods;
  }

  private findAllergyConflicts(
    allergies: string[],
    preferredFoods: Array<{ listName: FoodPreferenceList; food: string }>,
  ): Array<{ listName: FoodPreferenceList; food: string }> {
    return preferredFoods.filter(({ food }) => allergies.some(allergy => this.foodMatchesAllergy(food, allergy)));
  }

  private findPreferredNameConflicts(value: string): Array<{ listName: FoodPreferenceList; food: string }> {
    const normalizedValue = normalizeFoodName(value);
    if (normalizedValue.length < 2) return [];
    return this.getPreferredFoods().filter(({ food }) => {
      const normalizedFood = normalizeFoodName(food);
      return normalizedFood.length >= 2
        && (normalizedFood.includes(normalizedValue) || normalizedValue.includes(normalizedFood));
    });
  }

  private async confirmPreferredToDisliked(food: string): Promise<boolean> {
    const alert = await this.alertController.create({
      header: 'Alimento preferido',
      message: `Has seleccionado “${food}” como uno de tus alimentos preferidos. ¿Deseas quitarlo de tus gustos para agregarlo a la lista de alimentos que no te gustan?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Quitar y agregar', role: 'confirm' },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'confirm';
  }

  async handleAllergyInput(event: Event): Promise<void> {
    const detail = (event as CustomEvent<{ value?: string }>).detail;
    if (typeof detail?.value === 'string') this.otherAllergiesInput = detail.value;
    if (this.otherAllergiesInput.includes(',')) await this.processCustomConflictInput('allergies', false);
  }

  async handleDislikedInput(event: Event): Promise<void> {
    const detail = (event as CustomEvent<{ value?: string }>).detail;
    if (typeof detail?.value === 'string') this.dislikedFoodsInput = detail.value;
    if (this.dislikedFoodsInput.includes(',')) await this.processCustomConflictInput('disliked', false);
  }

  async checkAllergyInputOnBlur(): Promise<void> {
    await this.processCustomConflictInput('allergies', true);
  }

  async checkDislikedInputOnBlur(): Promise<void> {
    await this.processCustomConflictInput('disliked', true);
  }

  private async processCustomConflictInput(
    field: 'allergies' | 'disliked',
    includeLastEntry: boolean,
  ): Promise<void> {
    if (this.customConflictPromptActive) return;
    this.customConflictPromptActive = true;
    try {
      const entries = (field === 'allergies' ? this.otherAllergiesInput : this.dislikedFoodsInput).split(',');
      const lastEntryIndex = entries.length - 1;
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index].trim();
        if (!entry || (index === lastEntryIndex && !includeLastEntry)) continue;
        const conflict = this.findPreferredNameConflicts(entry)[0];
        if (!conflict) continue;

        const confirmed = field === 'allergies'
          ? await this.confirmCustomAllergyConflict(entry, conflict.food)
          : await this.confirmPreferredToDisliked(conflict.food);
        if (confirmed) {
          this.removePreferredFoods([conflict.food]);
        } else {
          entries[index] = '';
        }
      }
      const updatedInput = entries.map(entry => entry.trim()).filter(Boolean).join(', ');
      if (field === 'allergies') this.otherAllergiesInput = updatedInput;
      else this.dislikedFoodsInput = updatedInput;
    } finally {
      this.customConflictPromptActive = false;
    }
  }

  private async confirmCustomAllergyConflict(enteredFood: string, preferredFood: string): Promise<boolean> {
    const alert = await this.alertController.create({
      header: 'Alimento preferido',
      message: `Escribiste “${enteredFood}”, el cual coincide con “${preferredFood}” que marcaste anteriormente como un alimento que te gusta. ¿Deseas removerlo de tus alimentos preferidos para conservarlo únicamente como alergia?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover y conservar', role: 'confirm' },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'confirm';
  }

  private foodMatchesAllergy(food: string, allergy: string): boolean {
    const normalizedFood = normalizeFoodName(food);
    const normalizedAllergy = normalizeFoodName(allergy);
    if (!normalizedFood || !normalizedAllergy) return false;

    const plantDrink = /^(bebida|leche) (de )?(soya|soja|avena|almendra|coco|arroz)$/.test(normalizedFood);
    if (plantDrink && ['lacteos', 'lactosa'].includes(normalizedAllergy)) return false;
    if (normalizedAllergy === 'lactosa' && foodContainsTerm(normalizedFood, 'sin lactosa')) return false;
    if (normalizedAllergy === 'gluten' && foodContainsTerm(normalizedFood, 'sin gluten')) return false;

    const terms = allergyFoodTerms[normalizedAllergy] ?? [normalizedAllergy];
    return terms.some(term => foodContainsTerm(normalizedFood, normalizeFoodName(term)));
  }

  private async confirmAllergyConflicts(
    allergy: string,
    conflicts: Array<{ listName: FoodPreferenceList; food: string }>,
  ): Promise<boolean> {
    const foodNames = [...new Set(conflicts.map(conflict => conflict.food))];
    const foodLabel = foodNames.length === 1 ? `“${foodNames[0]}”` : foodNames.map(food => `“${food}”`).join(', ');
    const alert = await this.alertController.create({
      header: 'Confirmar alergia o intolerancia',
      message: `Has seleccionado ${foodLabel} en tus alimentos preferidos. ¿Deseas removerlo de tus preferencias para marcar ${foodNames.length === 1 ? 'este alimento' : 'estos alimentos'} como alergia (${allergy})?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover y marcar', role: 'confirm' },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'confirm';
  }

  private removePreferredFoods(foodNames: string[]): void {
    const removed = new Set(foodNames.map(normalizeFoodName));
    const listNames: FoodPreferenceList[] = [
      'preferredFruits',
      'preferredVegetables',
      'preferredProteins',
      'preferredCarbohydrates',
      'preferredLegumes',
      'preferredDairy',
      'preferredFats',
    ];
    for (const listName of listNames) {
      this.preferences[listName] = this.preferences[listName].filter(food => !removed.has(normalizeFoodName(food)));
    }
    this.otherFruitsInput = this.otherFruitsInput.split(',').map(food => food.trim()).filter(food => !removed.has(normalizeFoodName(food))).join(', ');
    this.otherVegetablesInput = this.otherVegetablesInput.split(',').map(food => food.trim()).filter(food => !removed.has(normalizeFoodName(food))).join(', ');
  }

  async save(): Promise<void> {
    if (this.isSaving || this.isLoading || this.loadError) {
      return;
    }
    const userId = this.eatWellService.getActiveUser()?.id;
    if (!userId || this.loadedUserId !== userId) {
      await this.showError('Vuelve a cargar tus preferencias antes de guardar.');
      return;
    }

    for (const input of [this.otherFruitsInput, this.otherVegetablesInput, this.otherAllergiesInput, this.dislikedFoodsInput]) {
      if (input.split(',').map(item => item.trim()).filter(Boolean).some(item => !this.isValidFoodName(item))) {
        await this.showError('Revisa los nombres escritos: deben tener entre 2 y 30 caracteres y estar separados por comas. No se guardaron cambios.');
        return;
      }
    }
    this.validationAttempted = true;
    if (this.missingPreferenceCategories.length) return;
    // Keep selected options and custom values in the same saved lists.
    const selectedFruits = this.preferences.preferredFruits.filter(f => this.fruits.includes(f));
    const customFruits = this.otherFruitsInput.split(',')
      .map(item => this.capitalize(item.trim()))
      .filter(item => this.isValidFoodName(item));
    let finalFruits = Array.from(new Set([...selectedFruits, ...customFruits]));

    const selectedVegetables = this.preferences.preferredVegetables.filter(v => this.vegetables.includes(v));
    const customVegetables = this.otherVegetablesInput.split(',')
      .map(item => this.capitalize(item.trim()))
      .filter(item => this.isValidFoodName(item));
    let finalVegetables = Array.from(new Set([...selectedVegetables, ...customVegetables]));

    const selectedAllergies = this.preferences.allergies.filter(a => this.allergyOptions.includes(a));
    const customAllergies = this.otherAllergiesInput.split(',')
      .map(item => this.capitalize(item.trim()))
      .filter(item => this.isValidFoodName(item));
    const finalAllergies = Array.from(new Set([...selectedAllergies, ...customAllergies]));

    const selectedDisliked = this.preferences.dislikedFoods.filter(d => this.commonDislikedFoods.includes(d));
    const customDisliked = this.dislikedFoodsInput.split(',')
      .map(item => this.capitalize(item.trim()))
      .filter(item => this.isValidFoodName(item));
    const finalDisliked = Array.from(new Set([...selectedDisliked, ...customDisliked]));
    const allergyConflicts = this.findAllergyConflicts(finalAllergies, [
      ...finalFruits.map(food => ({ listName: 'preferredFruits' as const, food })),
      ...finalVegetables.map(food => ({ listName: 'preferredVegetables' as const, food })),
      ...this.getPreferredFoods().filter(({ listName }) => !['preferredFruits', 'preferredVegetables'].includes(listName)),
    ]);
    if (allergyConflicts.length > 0) {
      const confirmed = await this.confirmAllergyConflicts(finalAllergies.join(', '), allergyConflicts);
      if (!confirmed) return;
      const removedFoods = allergyConflicts.map(conflict => normalizeFoodName(conflict.food));
      finalFruits = finalFruits.filter(food => !removedFoods.includes(normalizeFoodName(food)));
      finalVegetables = finalVegetables.filter(food => !removedFoods.includes(normalizeFoodName(food)));
      this.removePreferredFoods(allergyConflicts.map(conflict => conflict.food));
    }

    this.isSaving = true;
    try {
      const saved = await this.eatWellService.saveFoodPreferences({
          ...this.preferences,
          preferredFruits: finalFruits,
          preferredVegetables: finalVegetables,
          preferredProteins: this.preferences.preferredProteins,
          preferredCarbohydrates: this.preferences.preferredCarbohydrates,
          preferredLegumes: this.preferences.preferredLegumes,
          preferredDairy: this.preferences.preferredDairy,
          preferredFats: this.preferences.preferredFats,
          allergies: finalAllergies,
          dislikedFoods: finalDisliked,
          noPreferenceCategories: this.preferences.noPreferenceCategories,
          completed: true,
        });
      if (this.eatWellService.getActiveUser()?.id !== userId) return;
      this.preferences = saved;
      const alert = await this.alertController.create({
        header: 'Guardado',
        message: 'Preferencias alimentarias guardadas correctamente.',
        buttons: ['Aceptar'],
      });
      await alert.present();
      await alert.onDidDismiss();
      await this.router.navigateByUrl('/tabs/datos-perfil?module=schedule');
    } catch (error) {
      await this.showError(error instanceof Error ? error.message : 'No se pudieron guardar tus preferencias.');
    } finally {
      this.isSaving = false;
    }
  }

  async clearPreferences(): Promise<void> {
    if (this.isSaving || this.isLoading || this.loadError || this.loadedUserId !== this.eatWellService.getActiveUser()?.id) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Borrar preferencias alimentarias',
      message: 'Se eliminarán las preferencias guardadas para que puedas volver a capturarlas.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Borrar datos', role: 'destructive' },
      ],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'destructive') {
      return;
    }

    this.isSaving = true;
    try {
      this.preferences = await this.eatWellService.deleteFoodPreferences();
      this.otherFruitsInput = '';
      this.otherVegetablesInput = '';
      this.otherAllergiesInput = '';
      this.dislikedFoodsInput = '';
      await this.router.navigateByUrl('/tabs/datos-perfil');
    } catch (error) {
      await this.showError(error instanceof Error ? error.message : 'No se pudieron borrar las preferencias.');
    } finally {
      this.isSaving = false;
    }
  }

  private capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private isValidFoodName(name: string): boolean {
    const cleaned = name.trim();
    
    // Debe tener entre 2 y 30 caracteres
    if (cleaned.length < 2 || cleaned.length > 30) {
      return false;
    }
    
    // Debe contener al menos una letra del alfabeto español
    const hasLetter = /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/.test(cleaned);
    if (!hasLetter) {
      return false;
    }
    
    // Evitar palabras individuales que sean excesivamente largas (posible tecleo aleatorio, ej: "asdfasdfasdfasdfasdf")
    const words = cleaned.split(/[\s-]+/);
    for (const word of words) {
      if (word.length > 18) {
        return false;
      }
    }
    
    // Evitar caracteres repetitivos (ej: "aaaaa", "zzzzzz")
    if (/^(.)\1{4,}$/.test(cleaned.toLowerCase())) {
      return false;
    }
    
    return true;
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Preferencias',
      message,
      buttons: ['Aceptar'],
    });
    await alert.present();
  }
}
