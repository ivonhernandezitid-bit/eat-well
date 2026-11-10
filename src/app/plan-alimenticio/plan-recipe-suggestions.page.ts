import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { EatWellService, Recipe, SuggestedFoodRecipe } from '../core';
import { DailyMealPlan, mealPlanDate } from '../core/daily-meal-plan';
import { recipeMealLabels, recipeMealTypes, RecipeMealType } from '../core/recipe-meals';

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
  favoriteIds = new Map<string, string>();
  favoriteLoadingId: string | null = null;

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
    if (this.mealType === 'morning_snack') return 'Colación 1';
    if (this.mealType === 'afternoon_snack') return 'Colación 2';
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
      const favoritesPromise = this.eatWellService.getFavoriteRecipes().catch(error => {
        this.error = error instanceof Error ? error.message : 'No se pudieron cargar tus favoritos.';
        return [];
      });
      const [plan, recipes, favorites] = await Promise.all([
        planPromise,
        this.eatWellService.getMealOptions(this.mealType, this.selectedDate),
        favoritesPromise,
      ]);
      this.dailyPlan = plan;
      this.favoriteIds = new Map(favorites.map(favorite => [favorite.title, favorite.favoriteId]));
      const selected = plan?.choices[this.mealType];
      this.recipes = selected ? [selected] : recipes.slice(0, 1);
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

  isFavorite(recipe: Recipe): boolean {
    return this.favoriteIds.has(recipe.title);
  }

  async toggleFavorite(recipe: Recipe, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.favoriteLoadingId) return;

    this.favoriteLoadingId = recipe.id;
    try {
      const favoriteId = this.favoriteIds.get(recipe.title);
      if (favoriteId) {
        await this.eatWellService.removeFavoriteRecipe(favoriteId);
        this.favoriteIds.delete(recipe.title);
      } else {
        const favorite = await this.eatWellService.addFavoriteRecipe({
          ...recipe,
          id: recipe.id,
          imageUrl: '',
          sourceUrl: '',
          detailsLoaded: true,
          mealTypes: recipeMealTypes(recipe),
        } satisfies SuggestedFoodRecipe, 'plan');
        this.favoriteIds.set(recipe.title, favorite.favoriteId);
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo actualizar favoritos.';
    } finally {
      this.favoriteLoadingId = null;
    }
  }
}
