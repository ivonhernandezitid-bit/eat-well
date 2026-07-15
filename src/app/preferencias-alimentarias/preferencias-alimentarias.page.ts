import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { ActivityLevel, DietType, EatWellService, FitnessGoal, FoodPreferences } from '../core';

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
  readonly allergyOptions = [
    'Lácteos', 'Huevo', 'Cacahuate', 'Nueces de árbol', 'Gluten', 'Soya', 'Pescado', 'Mariscos',
    'Sésamo', 'Mostaza', 'Sulfitos', 'Moluscos', 'Maíz', 'Trigo', 'Fresa', 'Apio',
    'Altramuces', 'Chocolate', 'Legumbres', 'Lactosa'
  ];
  readonly commonDislikedFoods = [
    'Cebolla', 'Aceitunas', 'Cilantro', 'Ajo', 'Champiñones', 'Pasas', 'Berenjena', 'Hígado',
    'Brócoli', 'Pescado'
  ];

  preferences: FoodPreferences = {
    dietType: 'omnivore',
    preferredFruits: [],
    preferredVegetables: [],
    allergies: [],
    dislikedFoods: [],
    cookingTimeMinutes: 30,
    completed: false,
  };
  dislikedFoodsInput = '';
  otherFruitsInput = '';
  otherVegetablesInput = '';
  otherAllergiesInput = '';
  fitnessGoal: FitnessGoal = 'improve_health';
  activityLevel: ActivityLevel = 'moderate';
  isLoading = true;
  isSaving = false;
  currentSection: string | null = null;

  constructor(
    private readonly eatWellService: EatWellService,
    private readonly router: Router,
    private readonly alertController: AlertController,
    private readonly route: ActivatedRoute,
  ) {}

  get title(): string {
    switch (this.currentSection) {
      case 'vegetables': return 'Verduras';
      case 'fruits': return 'Frutas';
      case 'allergies': return 'Alergias';
      case 'general': return 'Preferencias';
      default: return 'Preferencias';
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

  async ngOnInit(): Promise<void> {
    try {
      const activeUser = this.eatWellService.getActiveUser();
      this.fitnessGoal = activeUser?.goal ?? 'improve_health';
      this.activityLevel = activeUser?.activityLevel ?? 'moderate';
      
      this.preferences = await this.eatWellService.getFoodPreferences();
      
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

      this.currentSection = this.route.snapshot.queryParamMap.get('section');
    } catch (error) {
      await this.showError(error instanceof Error ? error.message : 'No se pudieron cargar tus preferencias.');
    } finally {
      this.isLoading = false;
    }
  }

  setDietType(dietType: DietType): void {
    this.preferences.dietType = dietType;
  }

  togglePreference(listName: 'preferredFruits' | 'preferredVegetables' | 'allergies' | 'dislikedFoods', value: string): void {
    const values = this.preferences[listName];
    this.preferences[listName] = values.includes(value)
      ? values.filter(item => item !== value)
      : [...values, value];
  }

  isSelected(listName: 'preferredFruits' | 'preferredVegetables' | 'allergies' | 'dislikedFoods', value: string): boolean {
    return this.preferences[listName].includes(value);
  }

  async save(): Promise<void> {
    if (this.isSaving) {
      return;
    }

    this.isSaving = true;

    // Merge static selected checkbox options with custom input values, capitalizing first letter, filtering nonsense, and validating commas
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
      [this.preferences] = await Promise.all([
        this.eatWellService.saveFoodPreferences({
          ...this.preferences,
          preferredFruits: finalFruits,
          preferredVegetables: finalVegetables,
          allergies: finalAllergies,
          dislikedFoods: finalDisliked,
          completed: true,
        }),
        this.eatWellService.updateProfile({
          goal: this.fitnessGoal,
          activityLevel: this.activityLevel,
        }),
      ]);
      await this.router.navigateByUrl('/tabs/home');
    } catch (error) {
      await this.showError(error instanceof Error ? error.message : 'No se pudieron guardar tus preferencias.');
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
