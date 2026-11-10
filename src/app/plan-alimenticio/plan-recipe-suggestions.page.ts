import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { EatWellService, Recipe } from '../core';
import { DailyMealPlan, dailyMealOptions, mealPlanDate } from '../core/daily-meal-plan';
import { recipeMealLabels, RecipeMealType } from '../core/recipe-meals';

@Component({
  selector: 'app-plan-recipe-suggestions',
  templateUrl: './plan-recipe-suggestions.page.html',
  styleUrls: ['./plan-recipe-suggestions.page.scss'],
  standalone: false,
})
export class PlanRecipeSuggestionsPage implements OnInit {
  readonly recipeMealLabels = recipeMealLabels;
  mealType: RecipeMealType = 'breakfast';
  targetCalories = 0;
  selectedDate = mealPlanDate();
  recipes: Recipe[] = [];
  dailyPlan: DailyMealPlan | null = null;
  isLoading = true;
  isSaving = false;
  error = '';

  private readonly route = inject(ActivatedRoute);
  private readonly eatWellService = inject(EatWellService);
  private readonly alertController = inject(AlertController);

  ngOnInit(): void {
    const mealType = this.route.snapshot.paramMap.get('mealType');
    const targetCalories = Number(this.route.snapshot.paramMap.get('kcal'));
    const date = this.route.snapshot.queryParamMap.get('date');

    if (!mealType || !Object.prototype.hasOwnProperty.call(recipeMealLabels, mealType)
      || !Number.isFinite(targetCalories) || targetCalories < 0) {
      this.error = 'No se pudo identificar la comida seleccionada.';
      this.isLoading = false;
      return;
    }

    this.mealType = mealType as RecipeMealType;
    this.targetCalories = targetCalories;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) this.selectedDate = date;
    void this.loadSuggestions();
  }

  get mealLabel(): string {
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

  isSelected(recipe: Recipe): boolean {
    return this.selectedRecipeId === recipe.id;
  }

  isFixture(recipe: Recipe): boolean {
    return recipe.id.startsWith('fixture-');
  }

  hasAiNutrition(recipe: Recipe): boolean {
    const nutrition = recipe.estimatedNutrition;
    return !!nutrition && [
      nutrition.calories,
      nutrition.proteinGrams,
      nutrition.carbsGrams,
      nutrition.fatGrams,
    ].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  }

  async loadSuggestions(): Promise<void> {
    this.isLoading = true;
    this.error = '';
    try {
      console.log('[Frontend] Enviando solicitud a backend...');
      const planPromise = this.eatWellService.getDailyMealPlan(this.selectedDate).catch(error => {
        this.error = error instanceof Error
          ? error.message
          : 'No se pudo consultar la elección guardada para este día.';
        return null;
      });
      const [plan, recipes] = await Promise.all([
        planPromise,
        this.eatWellService.getMealOptions(this.mealType),
      ]);
      this.dailyPlan = plan;
      const selected = plan?.choices[this.mealType];
      this.recipes = dailyMealOptions(recipes, selected);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudieron cargar las sugerencias de recetas.';
    } finally {
      this.isLoading = false;
    }
  }

  async selectRecipe(recipe: Recipe): Promise<void> {
    if (this.isFixture(recipe) || !this.hasAiNutrition(recipe) || this.isSaving || this.isSelected(recipe)) return;

    this.isSaving = true;
    this.error = '';
    try {
      this.dailyPlan = await this.eatWellService.chooseDailyMeal(
        this.mealType,
        recipe.id,
        this.selectedDate,
      );
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
}
