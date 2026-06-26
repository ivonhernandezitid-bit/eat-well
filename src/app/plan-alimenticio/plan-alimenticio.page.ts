import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { EatWellService, FavoriteRecipe, FoodScanResult, Recipe, SuggestedFoodRecipe } from '../core';

interface MealCardView {
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
export class PlanAlimenticioPage implements OnInit {
  @ViewChild('foodImageInput') foodImageInput?: ElementRef<HTMLInputElement>;

  recipes: Recipe[] = [];
  scanRecipes: SuggestedFoodRecipe[] = [];
  favoriteRecipes: FavoriteRecipe[] = [];
  searchTerm = '';
  isScanning = false;
  scanPreview: string | null = null;
  scanResult: FoodScanResult | null = null;
  selectedRecipe: MealCardView | null = null;
  loadingRecipeId: string | null = null;
  isRecipeModalOpen = false;

  constructor(
    private readonly eatWellService: EatWellService,
    private readonly alertController: AlertController,
  ) { }

  async ngOnInit(): Promise<void> {
    [this.recipes, this.favoriteRecipes] = await Promise.all([
      this.eatWellService.getPersonalizedRecipes(),
      this.eatWellService.getFavoriteRecipes(),
    ]);
  }

  get filteredMeals(): MealCardView[] {
    const term = this.searchTerm.trim().toLowerCase();
    const meals: MealCardView[] = this.scanRecipes.length > 0
      ? this.scanRecipes.map(recipe => ({
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        imageUrl: recipe.imageUrl || null,
        source: 'ai',
        favoriteId: this.findFavoriteId(recipe.title),
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
      }))
      : [
        ...this.favoriteRecipes.map(recipe => ({
          id: recipe.id,
          title: recipe.title,
          description: recipe.description,
          imageUrl: recipe.imageUrl || null,
          source: 'favorite' as const,
          favoriteId: recipe.favoriteId,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
        })),
        ...this.recipes
          .filter(recipe => !this.favoriteRecipes.some(favorite => favorite.title === recipe.title))
          .map(recipe => ({
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        imageUrl: null,
        source: 'local' as const,
        favoriteId: this.findFavoriteId(recipe.title),
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
          })),
      ];

    if (!term) {
      return meals;
    }

    return meals.filter(recipe =>
      recipe.title.toLowerCase().includes(term) ||
      recipe.description.toLowerCase().includes(term),
    );
  }

  scanFood(): void {
    if (!this.isScanning) {
      this.foodImageInput?.nativeElement.click();
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
    } catch (error) {
      this.scanPreview = null;
      await this.showError(error instanceof Error ? error.message : 'No se pudo analizar la imagen.');
    } finally {
      this.isScanning = false;
      input.value = '';
    }
  }

  clearScan(): void {
    this.scanPreview = null;
    this.scanResult = null;
    this.scanRecipes = [];
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
  }

  private findFavoriteId(title: string): string | null {
    return this.favoriteRecipes.find(recipe => recipe.title === title)?.favoriteId ?? null;
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
      header: 'Escáner de alimentos',
      message,
      buttons: ['Aceptar'],
    });
    await alert.present();
  }
}

