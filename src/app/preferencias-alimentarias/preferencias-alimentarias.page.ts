import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { ActivityLevel, DietType, EatWellService, FitnessGoal, FoodPreferences } from '../core';

@Component({
  selector: 'app-preferencias-alimentarias',
  templateUrl: './preferencias-alimentarias.page.html',
  styleUrls: ['./preferencias-alimentarias.page.scss'],
  standalone: false,
})
export class PreferenciasAlimentariasPage implements OnInit {
  readonly fruits = ['Manzana', 'Plátano', 'Naranja', 'Fresa', 'Mango', 'Piña', 'Uvas', 'Papaya'];
  readonly vegetables = ['Jitomate', 'Zanahoria', 'Brócoli', 'Espinaca', 'Calabaza', 'Pepino', 'Pimiento', 'Lechuga'];
  readonly allergyOptions = ['Lácteos', 'Huevo', 'Cacahuate', 'Nueces', 'Gluten', 'Soya', 'Pescado', 'Mariscos'];

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
  fitnessGoal: FitnessGoal = 'improve_health';
  activityLevel: ActivityLevel = 'moderate';
  isLoading = true;
  isSaving = false;

  constructor(
    private readonly eatWellService: EatWellService,
    private readonly router: Router,
    private readonly alertController: AlertController,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const activeUser = this.eatWellService.getActiveUser();
      this.fitnessGoal = activeUser?.goal ?? 'improve_health';
      this.activityLevel = activeUser?.activityLevel ?? 'moderate';
      this.preferences = await this.eatWellService.getFoodPreferences();
      this.dislikedFoodsInput = this.preferences.dislikedFoods.join(', ');
    } catch (error) {
      await this.showError(error instanceof Error ? error.message : 'No se pudieron cargar tus preferencias.');
    } finally {
      this.isLoading = false;
    }
  }

  setDietType(dietType: DietType): void {
    this.preferences.dietType = dietType;
  }

  togglePreference(listName: 'preferredFruits' | 'preferredVegetables' | 'allergies', value: string): void {
    const values = this.preferences[listName];
    this.preferences[listName] = values.includes(value)
      ? values.filter(item => item !== value)
      : [...values, value];
  }

  isSelected(listName: 'preferredFruits' | 'preferredVegetables' | 'allergies', value: string): boolean {
    return this.preferences[listName].includes(value);
  }

  async save(): Promise<void> {
    if (this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.preferences.dislikedFoods = this.dislikedFoodsInput
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    try {
      [this.preferences] = await Promise.all([
        this.eatWellService.saveFoodPreferences({
          ...this.preferences,
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

  private async showError(message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Preferencias',
      message,
      buttons: ['Aceptar'],
    });
    await alert.present();
  }
}
