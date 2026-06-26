import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { EatWellService, FavoriteRecipe, FoodScanResult, Recipe, SuggestedFoodRecipe, UserProfile } from '../core';

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

const BACKUP_RECIPES: Recipe[] = [
  {
    id: 'backup-wrap-pollo',
    title: 'Wrap integral de pollo',
    description: 'Pollo con verduras frescas en tortilla integral, ideal para una comida rapida.',
    calories: 0,
    proteinGrams: 0,
    carbsGrams: 0,
    fatGrams: 0,
    ingredients: ['Tortilla integral', 'Pollo cocido', 'Lechuga', 'Tomate', 'Aguacate', 'Yogurt natural'],
    instructions: [
      'Calienta la tortilla unos segundos.',
      'Agrega pollo, verduras y aguacate.',
      'Anade un poco de yogurt natural.',
      'Enrolla y sirve.',
    ],
    goals: ['maintain', 'improve_health', 'gain_muscle'],
  },
  {
    id: 'backup-ensalada-garbanzos',
    title: 'Ensalada de garbanzos',
    description: 'Garbanzos con pepino, tomate y limon para una opcion fresca y practica.',
    calories: 0,
    proteinGrams: 0,
    carbsGrams: 0,
    fatGrams: 0,
    ingredients: ['Garbanzos cocidos', 'Pepino', 'Tomate', 'Cebolla morada', 'Limon', 'Aceite de oliva'],
    instructions: [
      'Pica las verduras en cubos pequenos.',
      'Mezcla con los garbanzos.',
      'Sazona con limon, aceite de oliva y sal al gusto.',
    ],
    goals: ['maintain', 'improve_health', 'lose_weight'],
  },
  {
    id: 'backup-yogurt-fruta',
    title: 'Yogurt con fruta y semillas',
    description: 'Yogurt natural con fruta, avena y semillas para desayuno o snack.',
    calories: 0,
    proteinGrams: 0,
    carbsGrams: 0,
    fatGrams: 0,
    ingredients: ['Yogurt natural', 'Fruta de temporada', 'Avena', 'Semillas de chia', 'Canela'],
    instructions: [
      'Sirve el yogurt en un bowl.',
      'Agrega fruta picada, avena y semillas.',
      'Termina con canela al gusto.',
    ],
    goals: ['maintain', 'improve_health', 'lose_weight'],
  },
  {
    id: 'backup-omelette-verduras',
    title: 'Omelette con verduras',
    description: 'Huevo con espinaca, champinones y pimiento para una comida sencilla.',
    calories: 0,
    proteinGrams: 0,
    carbsGrams: 0,
    fatGrams: 0,
    ingredients: ['2 huevos', 'Espinaca', 'Champinones', 'Pimiento', 'Queso fresco'],
    instructions: [
      'Bate los huevos.',
      'Saltea las verduras por unos minutos.',
      'Agrega el huevo y cocina a fuego medio.',
      'Dobla el omelette y sirve.',
    ],
    goals: ['maintain', 'improve_health', 'gain_muscle'],
  },
];

@Component({
  selector: 'app-plan-alimenticio',
  templateUrl: './plan-alimenticio.page.html',
  styleUrls: ['./plan-alimenticio.page.scss'],
  standalone: false
})
export class PlanAlimenticioPage implements OnInit, OnDestroy {
  @ViewChild('foodImageInput') foodImageInput?: ElementRef<HTMLInputElement>;

  recipes: Recipe[] = BACKUP_RECIPES;
  scanRecipes: SuggestedFoodRecipe[] = [];
  favoriteRecipes: FavoriteRecipe[] = [];
  searchTerm = '';
  isScanning = false;
  scanPreview: string | null = null;
  scanResult: FoodScanResult | null = null;
  selectedRecipe: MealCardView | null = null;
  loadingRecipeId: string | null = null;
  isRecipeModalOpen = false;

  private activeUserId: string | null = null;
  private activeUserSubscription?: Subscription;

  constructor(
    private readonly eatWellService: EatWellService,
    private readonly alertController: AlertController,
  ) { }

  ngOnInit(): void {
    this.activeUserSubscription = this.eatWellService.activeUser$.subscribe(user => {
      const nextUserId = user?.id ?? null;

      if (nextUserId === this.activeUserId) {
        return;
      }

      this.activeUserId = nextUserId;
      this.resetMealState();

      if (user) {
        void this.loadMealsForUser(user);
      }
    });
  }

  ngOnDestroy(): void {
    this.activeUserSubscription?.unsubscribe();
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

  private resetMealState(): void {
    this.recipes = BACKUP_RECIPES;
    this.scanRecipes = [];
    this.favoriteRecipes = [];
    this.scanPreview = null;
    this.scanResult = null;
    this.selectedRecipe = null;
    this.loadingRecipeId = null;
    this.isRecipeModalOpen = false;
  }

  private async loadMealsForUser(user: UserProfile): Promise<void> {
    try {
      const [recipes, favorites] = await Promise.all([
        this.eatWellService.getPersonalizedRecipes(user),
        this.eatWellService.getFavoriteRecipes(),
      ]);

      if (this.activeUserId !== user.id) {
        return;
      }

      this.recipes = recipes.length > 0 ? recipes : BACKUP_RECIPES;
      this.favoriteRecipes = favorites;
    } catch (error) {
      if (this.activeUserId === user.id) {
        this.recipes = BACKUP_RECIPES;
        await this.showError(error instanceof Error ? error.message : 'No se pudieron cargar las recetas.');
      }
    }
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
      header: 'Escaner de alimentos',
      message,
      buttons: ['Aceptar'],
    });
    await alert.present();
  }
}
