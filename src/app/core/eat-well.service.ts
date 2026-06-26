import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  BodyZone,
  Exercise,
  FavoriteRecipe,
  FoodPreferences,
  FoodScanInput,
  FoodScanResult,
  LoginCredentials,
  Recipe,
  SuggestedFoodRecipe,
  UserProfile,
  UserRegistrationData,
  GeminiExercise,
  RoutineResult,
  CustomRoutineForm,
} from './models';

const ACTIVE_USER_KEY = 'eat-well-active-user';
const EXERCISE_CACHE_KEY = 'eat-well-generated-exercises';
const EXERCISE_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

interface ExerciseCacheEntry {
  expiresAt: number;
  exercises: GeminiExercise[];
}

interface UserResponse {
  user: UserProfile;
}

interface RecipesResponse {
  recipes: Recipe[];
}

interface ExercisesResponse {
  exercises: Exercise[];
}

interface FoodScanResponse {
  result: FoodScanResult;
}

interface FoodRecommendationsResponse {
  recipes: SuggestedFoodRecipe[];
}

interface FoodRecipeDetailResponse {
  recipe: SuggestedFoodRecipe;
}

interface FoodPreferencesResponse {
  preferences: FoodPreferences;
}

interface FavoriteRecipesResponse {
  recipes: FavoriteRecipe[];
}

interface FavoriteRecipeResponse {
  recipe: FavoriteRecipe;
}

@Injectable({
  providedIn: 'root',
})
export class EatWellService {
  private readonly activeUserSubject = new BehaviorSubject<UserProfile | null>(this.loadActiveUser());

  readonly activeUser$: Observable<UserProfile | null> = this.activeUserSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  getActiveUser(): UserProfile | null {
    return this.activeUserSubject.value;
  }

  async registerUser(data: UserRegistrationData): Promise<UserProfile> {
    const response = await this.post<UserResponse>('auth.register', data);
    this.saveActiveUser(response.user);
    return response.user;
  }

  async login(credentials: LoginCredentials): Promise<UserProfile> {
    const response = await this.post<UserResponse>('auth.login', credentials);
    this.saveActiveUser(response.user);
    return response.user;
  }

  async logout(): Promise<void> {
    this.activeUserSubject.next(null);
    localStorage.removeItem(ACTIVE_USER_KEY);
  }

  async updateProfile(profileChanges: Partial<Omit<UserProfile, 'id' | 'email' | 'createdAt'>>): Promise<UserProfile> {
    const activeUser = this.getRequiredActiveUser();
    const response = await this.post<UserResponse>('profile.update', {
      ...activeUser,
      ...profileChanges,
    });
    this.saveActiveUser(response.user);
    return response.user;
  }

  async getPersonalizedRecipes(profile: UserProfile = this.getRequiredActiveUser()): Promise<Recipe[]> {
    const response = await this.get<RecipesResponse>('recipes.recommendations', {
      userId: profile.id,
    });
    return response.recipes;
  }

  async getExercisesByBodyZone(bodyZone: BodyZone): Promise<Exercise[]> {
    const response = await this.get<ExercisesResponse>('exercises.byZone', {
      bodyZone,
    });
    return response.exercises;
  }

  async scanFoodImage(input: FoodScanInput): Promise<FoodScanResult> {
    const activeUser = this.getActiveUser();
    const response = await this.post<FoodScanResponse>('scanner.analyze', {
      ...input,
      userId: activeUser?.id,
    });
    return response.result;
  }

  async getSavedFoodRecommendations(): Promise<SuggestedFoodRecipe[]> {
    const activeUser = this.getRequiredActiveUser();
    const response = await this.get<FoodRecommendationsResponse>('scanner.recommendations', {
      userId: activeUser.id,
    });
    return response.recipes;
  }

  async getSavedFoodRecipeDetail(recipeId: string): Promise<SuggestedFoodRecipe> {
    const activeUser = this.getRequiredActiveUser();
    const response = await this.get<FoodRecipeDetailResponse>('scanner.recipeDetail', {
      userId: activeUser.id,
      recipeId,
    });
    return response.recipe;
  }

  async generateExercisesByMuscle(muscle: string): Promise<GeminiExercise[]> {
    const cache = this.loadExerciseCache();
    const cachedEntry = cache[muscle];

    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      return cachedEntry.exercises;
    }

    let exercises: GeminiExercise[];

    try {
      const response = await this.post<{ exercises: GeminiExercise[] }>('exercises.generate', {
        muscle,
      });
      exercises = response.exercises;
    } catch (error) {
      const storedExercises = await this.getStoredExercisesForMuscle(muscle);

      if (storedExercises.length === 0) {
        throw error;
      }

      return storedExercises;
    }

    cache[muscle] = {
      expiresAt: Date.now() + EXERCISE_CACHE_DURATION_MS,
      exercises,
    };
    localStorage.setItem(EXERCISE_CACHE_KEY, JSON.stringify(cache));
    return exercises;
  }

  async getFoodPreferences(): Promise<FoodPreferences> {
    const activeUser = this.getRequiredActiveUser();
    const response = await this.get<FoodPreferencesResponse>('preferences.get', {
      userId: activeUser.id,
    });
    return response.preferences;
  }

  async saveFoodPreferences(preferences: FoodPreferences): Promise<FoodPreferences> {
    const activeUser = this.getRequiredActiveUser();
    const response = await this.post<FoodPreferencesResponse>('preferences.save', {
      userId: activeUser.id,
      ...preferences,
    });
    return response.preferences;
  }

  async getFavoriteRecipes(): Promise<FavoriteRecipe[]> {
    const activeUser = this.getRequiredActiveUser();
    const response = await this.get<FavoriteRecipesResponse>('favorites.list', {
      userId: activeUser.id,
    });
    return response.recipes;
  }

  async addFavoriteRecipe(recipe: SuggestedFoodRecipe, sourceType: string): Promise<FavoriteRecipe> {
    const activeUser = this.getRequiredActiveUser();
    const response = await this.post<FavoriteRecipeResponse>('favorites.add', {
      userId: activeUser.id,
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      sourceType,
    });
    return response.recipe;
  }

  async removeFavoriteRecipe(favoriteId: string): Promise<void> {
    const activeUser = this.getRequiredActiveUser();
    await this.post<{ removed: boolean }>('favorites.remove', {
      userId: activeUser.id,
      favoriteId,
    });
  }

  async generateCustomRoutine(form: CustomRoutineForm): Promise<RoutineResult> {
    const response = await this.post<{ routine: RoutineResult }>('routines.generate', form);
    return response.routine;
  }

  calculateImc(weightKg: number, heightCm: number): number {
    const heightMeters = heightCm / 100;
    return Number((weightKg / (heightMeters * heightMeters)).toFixed(2));
  }

  getBodyZones(): BodyZone[] {
    return ['neck', 'shoulders', 'chest', 'arms', 'abdomen', 'back', 'hips', 'legs', 'calves', 'full_body'];
  }

  private async get<T>(action: string, params: Record<string, string | number>): Promise<T> {
    try {
      return await firstValueFrom(this.http.get<T>(this.buildUrl(action, params)));
    } catch (error) {
      throw new Error(this.getApiErrorMessage(error));
    }
  }

  private async post<T>(action: string, body: unknown): Promise<T> {
    try {
      return await firstValueFrom(this.http.post<T>(this.buildUrl(action), body));
    } catch (error) {
      throw new Error(this.getApiErrorMessage(error));
    }
  }

  private buildUrl(action: string, params: Record<string, string | number> = {}): string {
    const url = new URL(environment.apiUrl, window.location.origin);
    url.searchParams.set('action', action);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  private getRequiredActiveUser(): UserProfile {
    const activeUser = this.activeUserSubject.value;

    if (!activeUser) {
      throw new Error('No hay usuario activo.');
    }

    return activeUser;
  }

  private saveActiveUser(user: UserProfile): void {
    this.activeUserSubject.next(user);
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(user));
  }

  private loadActiveUser(): UserProfile | null {
    const savedUser = localStorage.getItem(ACTIVE_USER_KEY);
    return savedUser ? JSON.parse(savedUser) as UserProfile : null;
  }

  private loadExerciseCache(): Record<string, ExerciseCacheEntry> {
    const savedCache = localStorage.getItem(EXERCISE_CACHE_KEY);

    if (!savedCache) {
      return {};
    }

    try {
      return JSON.parse(savedCache) as Record<string, ExerciseCacheEntry>;
    } catch {
      localStorage.removeItem(EXERCISE_CACHE_KEY);
      return {};
    }
  }

  private async getStoredExercisesForMuscle(muscle: string): Promise<GeminiExercise[]> {
    const zoneByMuscle: Record<string, BodyZone> = {
      Pecho: 'chest',
      Espalda: 'back',
      Hombros: 'shoulders',
      'Bíceps': 'arms',
      'Tríceps': 'arms',
      Antebrazos: 'arms',
      Abdomen: 'abdomen',
      'Glúteos': 'hips',
      'Cuádriceps': 'legs',
      Isquiotibiales: 'legs',
      Pantorrillas: 'calves',
    };
    const zone = zoneByMuscle[muscle];

    if (!zone) {
      return [];
    }

    const difficultyLabels: Record<Exercise['difficulty'], GeminiExercise['dificultad']> = {
      beginner: 'Principiante',
      intermediate: 'Intermedio',
      advanced: 'Avanzado',
    };
    const exercises = await this.getExercisesByBodyZone(zone);

    return exercises.map(exercise => ({
      nombre: exercise.title,
      musculo: muscle,
      equipo: 'Sin equipo',
      dificultad: difficultyLabels[exercise.difficulty],
      series: 3,
      repeticiones: exercise.repetitions,
      instrucciones: exercise.instructions,
    }));
  }

  private getApiErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.error?.error) {
      return error.error.error;
    }

    return 'No se pudo conectar con la API. Revisa que XAMPP, Apache y MySQL esten activos.';
  }
}
