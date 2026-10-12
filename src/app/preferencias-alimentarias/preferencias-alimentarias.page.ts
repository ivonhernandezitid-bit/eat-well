import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { ActivityLevel, DietType, EatWellService, FitnessGoal, FoodPreferences } from '../core';

function emptyFoodPreferences(): FoodPreferences {
  return { dietType: 'omnivore', preferredFruits: [], preferredVegetables: [], preferredProteins: [], preferredCarbohydrates: [], preferredLegumes: [], preferredDairy: [], preferredFats: [], allergies: [], dislikedFoods: [], cookingTimeMinutes: 30, completed: false };
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
    'Frijoles', 'Lentejas', 'Garbanzos', 'Habas', 'Chícharos', 'Soya', 'Tofu', 'Edamame'
  ];
  readonly dairy = [
    'Leche', 'Leche sin lactosa', 'Yogur natural', 'Yogur griego', 'Queso panela',
    'Queso cottage', 'Requesón', 'Bebida de soya', 'Bebida de avena', 'Bebida de almendra', 'Bebida de coco'
  ];
  readonly fats = [
    'Aceite de oliva', 'Aceite de canola', 'Almendras', 'Nueces', 'Cacahuates',
    'Chía', 'Linaza', 'Pepitas', 'Crema de cacahuate'
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
  fitnessGoal: FitnessGoal = 'improve_health';
  activityLevel: ActivityLevel = 'moderate';
  isLoading = true;
  isSaving = false;
  currentSection: string | null = null;
  private dietToastTimeout: number | undefined;
  private dietToastSequence = 0;
  private activeDietToast: HTMLIonToastElement | null = null;
  private moduleTouchStartX = 0;
  private moduleTouchStartY = 0;
  private moduleSwipeEligible = false;

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
    switch (this.currentSection) {
      case 'vegetables': return 'Guardar verduras';
      case 'fruits': return 'Guardar frutas';
      case 'allergies': return 'Guardar alergias';
      case 'general': return 'Guardar preferencias';
      default: return 'Guardar preferencias';
    }
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
    this.otherFruitsInput = this.otherVegetablesInput = this.otherAllergiesInput = this.dislikedFoodsInput = '';
    try {
      if (!userId) throw new Error('Vuelve a iniciar sesión para cargar tus preferencias.');
      const saved = await this.eatWellService.getFoodPreferences();
      if (version !== this.loadRequest) return;
      if (this.eatWellService.getActiveUser()?.id !== userId) throw new Error('La cuenta cambió. Vuelve a abrir tus preferencias.');
      const activeUser = this.eatWellService.getActiveUser();
      this.fitnessGoal = activeUser?.goal ?? 'improve_health';
      this.activityLevel = activeUser?.activityLevel ?? 'moderate';
      
      this.preferences = {
        ...emptyFoodPreferences(),
        ...saved,
      };
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

  togglePreference(listName: 'preferredFruits' | 'preferredVegetables' | 'preferredProteins' | 'preferredCarbohydrates' | 'preferredLegumes' | 'preferredDairy' | 'preferredFats' | 'allergies' | 'dislikedFoods', value: string): void {
    const values = this.preferences[listName];
    this.preferences[listName] = values.includes(value)
      ? values.filter(item => item !== value)
      : [...values, value];
  }

  isSelected(listName: 'preferredFruits' | 'preferredVegetables' | 'preferredProteins' | 'preferredCarbohydrates' | 'preferredLegumes' | 'preferredDairy' | 'preferredFats' | 'allergies' | 'dislikedFoods', value: string): boolean {
    return this.preferences[listName].includes(value);
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
    this.isSaving = true;

    // Keep selected options and custom values in the same saved lists.
    const selectedFruits = this.preferences.preferredFruits.filter(f => this.fruits.includes(f));
    const customFruits = this.otherFruitsInput.split(',')
      .map(item => this.capitalize(item.trim()))
      .filter(item => this.isValidFoodName(item));
    const finalFruits = Array.from(new Set([...selectedFruits, ...customFruits]));

    const selectedVegetables = this.preferences.preferredVegetables.filter(v => this.vegetables.includes(v));
    const customVegetables = this.otherVegetablesInput.split(',')
      .map(item => this.capitalize(item.trim()))
      .filter(item => this.isValidFoodName(item));
    const finalVegetables = Array.from(new Set([...selectedVegetables, ...customVegetables]));

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
          completed: true,
        }, {
          goal: this.fitnessGoal,
          activityLevel: this.activityLevel,
        });
      if (this.eatWellService.getActiveUser()?.id !== userId) return;
      this.preferences = saved;
      await this.returnToProfile();
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
