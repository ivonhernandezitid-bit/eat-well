import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ClinicalHistoryData, ClinicalHistoryResponse } from './clinical-history';
import { DietaryRecallData, DietaryRecallResponse } from './dietary-recall';
import { MealSchedule, MealScheduleResponse } from './meal-schedule';
import { DailyMealPlan, mealPlanDate } from './daily-meal-plan';
import { RecipeMealType } from './recipe-meals';
import { LifestyleSettings, LifestyleGoalsResponse, lifestyleStorageKey } from './lifestyle-goals';
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
  FoodScanHistoryItem,
} from './models';

const ACTIVE_USER_KEY = 'eat-well-active-user';
const AUTH_TOKEN_KEY = 'eat-well-auth-token';
const EXERCISE_CACHE_KEY = 'eat-well-generated-exercises';
const EXERCISE_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

interface ExerciseCacheEntry {
  expiresAt: number;
  exercises: GeminiExercise[];
}

interface UserResponse {
  user: UserProfile;
  authToken?: string;
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
  user?: UserProfile;
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
  private readonly http = inject(HttpClient);

  readonly activeUser$: Observable<UserProfile | null> = this.activeUserSubject.asObservable();

  getActiveUser(): UserProfile | null {
    return this.activeUserSubject.value;
  }

  async registerUser(data: UserRegistrationData): Promise<UserProfile> {
    const response = await this.post<UserResponse>('auth.register', data);
    this.saveAuthToken(response.authToken);
    this.saveActiveUser(response.user);
    return response.user;
  }

  async login(credentials: LoginCredentials): Promise<UserProfile> {
    const response = await this.post<UserResponse>('auth.login', credentials);
    this.saveAuthToken(response.authToken);
    this.saveActiveUser(response.user);
    return response.user;
  }

  async logout(): Promise<void> {
    if (localStorage.getItem(AUTH_TOKEN_KEY)) {
      try {
        await this.post('auth.logout', {});
      } catch {
        // Local sign-out must still work when the server is unavailable.
      }
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    this.activeUserSubject.next(null);
    localStorage.removeItem(ACTIVE_USER_KEY);
  }

  async updateProfile(profileChanges: Partial<Omit<UserProfile, 'id' | 'email' | 'createdAt'>>): Promise<UserProfile> {
    const activeUser = this.getRequiredActiveUser();
    const response = await this.post<UserResponse>('profile.update', {
      ...activeUser,
      ...profileChanges,
    });
    if (this.getActiveUser()?.id === activeUser.id) this.saveActiveUser(response.user);
    return response.user;
  }

  async getClinicalHistory(): Promise<ClinicalHistoryResponse> {
    const user = this.getRequiredActiveUser();
    return this.get('clinical.get', { userId: user.id });
  }

  async getDietaryRecall(recallDate: string): Promise<DietaryRecallResponse> {
    const user = this.getRequiredActiveUser();
    return this.get('recall.get', { userId: user.id, recallDate });
  }

  async getInitialDietaryRecall(): Promise<DietaryRecallResponse> {
    const user=this.getRequiredActiveUser();
    return this.get('recall.initial', { userId:user.id });
  }

  async getMealSchedule(): Promise<MealScheduleResponse> {
    const user=this.getRequiredActiveUser();
    return this.get('schedule.get',{userId:user.id});
  }

  async saveMealSchedule(schedule: MealSchedule): Promise<MealScheduleResponse> {
    const user=this.getRequiredActiveUser();
    return this.post('schedule.save',{userId:user.id,schedule});
  }

  async saveDietaryRecall(recallDate: string, recall: DietaryRecallData): Promise<DietaryRecallResponse> {
    const user = this.getRequiredActiveUser();
    return this.post('recall.save', { userId: user.id, recallDate, recall });
  }

  async saveClinicalHistory(history: ClinicalHistoryData): Promise<ClinicalHistoryResponse> {
    const user = this.getRequiredActiveUser();
    return this.post('clinical.save', { userId: user.id, history });
  }

  async deleteClinicalHistory(): Promise<ClinicalHistoryResponse> {
    const user = this.getRequiredActiveUser();
    return this.post('clinical.delete', { userId: user.id });
  }

  async getPersonalizedRecipes(profile: UserProfile = this.getRequiredActiveUser()): Promise<Recipe[]> {
    const response = await this.get<RecipesResponse>('recipes.recommendations', {
      userId: profile.id,
    });
    return response.recipes;
  }

  async getMealOptions(mealType: RecipeMealType): Promise<Recipe[]> {
    const user = this.getRequiredActiveUser();
    const response = await this.get<RecipesResponse>('plan.options', { userId: user.id, mealType });
    return response.recipes;
  }

  async getDailyMealPlan(date = mealPlanDate()): Promise<DailyMealPlan> {
    const user = this.getRequiredActiveUser();
    return this.get('plan.get', { userId: user.id, date });
  }

  async chooseDailyMeal(mealType: RecipeMealType, recipeId: string, date = mealPlanDate()): Promise<DailyMealPlan> {
    const user = this.getRequiredActiveUser();
    return this.post('plan.choose', { userId: user.id, date, mealType, recipeId });
  }

  async clearDailyMeal(mealType: RecipeMealType, date = mealPlanDate()): Promise<DailyMealPlan> {
    const user = this.getRequiredActiveUser();
    return this.post('plan.choose', { userId: user.id, date, mealType, recipeId: null });
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

  async getSavedFoodRecommendations(scanId?: string): Promise<SuggestedFoodRecipe[]> {
    const activeUser = this.getRequiredActiveUser();
    const params: Record<string, string | number> = {
      userId: activeUser.id,
    };
    if (scanId) {
      params['scanId'] = scanId;
    }
    const response = await this.get<FoodRecommendationsResponse>('scanner.recommendations', params);
    return response.recipes;
  }

  async getScanHistory(): Promise<FoodScanHistoryItem[]> {
    const activeUser = this.getRequiredActiveUser();
    const response = await this.get<{ scans: FoodScanHistoryItem[] }>('scanner.history', {
      userId: activeUser.id,
    });
    return response.scans;
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
    if (response.user && this.getActiveUser()?.id === activeUser.id) this.saveActiveUser(response.user);
    return response.preferences;
  }

  async getLifestyleGoals(): Promise<LifestyleGoalsResponse> {
    const user = this.getRequiredActiveUser();
    const response = await this.get<LifestyleGoalsResponse>('lifestyle.get', { userId: user.id });
    if (this.getActiveUser()?.id === user.id && response.user) this.saveActiveUser(response.user);
    return response;
  }

  async saveLifestyleGoals(settings: LifestyleSettings): Promise<LifestyleGoalsResponse> {
    const user = this.getRequiredActiveUser();
    const response = await this.post<LifestyleGoalsResponse>('lifestyle.save', { userId: user.id, settings });
    if (this.getActiveUser()?.id === user.id) {
      if (response.user) this.saveActiveUser(response.user);
      if (response.settings) localStorage.setItem(lifestyleStorageKey(user.id), JSON.stringify(response.settings));
    }
    return response;
  }

  async deleteLifestyleGoals(): Promise<LifestyleGoalsResponse> {
    const user = this.getRequiredActiveUser();
    const response = await this.post<LifestyleGoalsResponse>('lifestyle.delete', { userId: user.id });
    if (this.getActiveUser()?.id === user.id) {
      if (response.user) this.saveActiveUser(response.user);
      localStorage.removeItem(lifestyleStorageKey(user.id));
    }
    return response;
  }

  async getCustomTips(): Promise<{ text: string; icon: string }[]> {
    const activeUser = this.getRequiredActiveUser();
    const response = await this.get<{ tips: { text: string; icon: string }[] }>('tips.get', {
      userId: activeUser.id,
    });
    return response.tips;
  }

  async getGeneralRecipes(): Promise<Recipe[]> {
    const activeUser = this.getRequiredActiveUser();
    const response = await this.get<{ recipes: Recipe[] }>('recipes.general', {
      userId: activeUser.id,
    });
    return response.recipes;
  }

  async saveFoodPreferences(preferences: FoodPreferences, profileChanges?: Pick<UserProfile, 'goal' | 'activityLevel'>): Promise<FoodPreferences> {
    const activeUser = this.getRequiredActiveUser();
    const response = await this.post<FoodPreferencesResponse>('preferences.save', {
      userId: activeUser.id,
      ...preferences,
      ...profileChanges,
    });
    if (response.user && this.getActiveUser()?.id === activeUser.id) this.saveActiveUser(response.user);
    return response.preferences;
  }

  async deleteFoodPreferences(): Promise<FoodPreferences> {
    const activeUser = this.getRequiredActiveUser();
    const response = await this.post<FoodPreferencesResponse>('preferences.delete', {
      userId: activeUser.id,
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
      mealTypes: recipe.mealTypes,
      servings: recipe.servings,
      preparationMinutes: recipe.preparationMinutes,
      validationNotes: recipe.validationNotes,
      ingredientData: recipe.ingredientData,
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
      const response = await firstValueFrom(
        this.http.get<T>(this.buildUrl(action, params), { headers: this.authHeaders(), observe: 'response' }),
      );
      this.saveMigratedAuthToken(response.headers);
      if (response.body === null) throw new Error('La respuesta del servidor está vacía.');
      return response.body;
    } catch (error) {
      this.saveMigratedAuthTokenFromError(error);
      throw new Error(this.getApiErrorMessage(error));
    }
  }

  private async post<T>(action: string, body: unknown): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.post<T>(this.buildUrl(action), body, { headers: this.authHeaders(), observe: 'response' }),
      );
      this.saveMigratedAuthToken(response.headers);
      if (response.body === null) throw new Error('La respuesta del servidor está vacía.');
      return response.body;
    } catch (error) {
      this.saveMigratedAuthTokenFromError(error);
      throw new Error(this.getApiErrorMessage(error));
    }
  }

  private saveMigratedAuthToken(headers: HttpHeaders): void {
    const token = headers.get('X-Auth-Token');
    if (token) this.saveAuthToken(token);
  }

  private saveMigratedAuthTokenFromError(error: unknown): void {
    if (error instanceof HttpErrorResponse) this.saveMigratedAuthToken(error.headers);
  }

  private buildUrl(action: string, params: Record<string, string | number> = {}): string {
    const url = new URL(environment.apiUrl, window.location.origin);
    url.searchParams.set('action', action);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  private authHeaders(): Record<string, string> {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private saveAuthToken(token?: string): void {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
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
      Trapecios: 'shoulders',
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
    if (error instanceof HttpErrorResponse) {
      const apiMessage = error.error && typeof error.error === 'object' && 'error' in error.error
        ? error.error.error
        : null;
      if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
      const responseText = typeof error.error === 'string' ? error.error.trim() : '';
      if (responseText && !responseText.startsWith('<')) {
        return responseText;
      }
      if (error.status === 0) return 'No se pudo conectar con la API. Revisa que XAMPP, Apache y MySQL estén activos.';
      if (responseText.startsWith('<')) {
        return `La API respondió con HTML en lugar de JSON (HTTP ${error.status}). Revisa los avisos y errores de PHP en Apache.`;
      }
      if (error.status === 401) return 'La sesión venció o no es válida. Cierra sesión e inicia sesión nuevamente.';
      if (error.status === 403) return 'La cuenta no tiene permiso para realizar esta acción.';
      if (error.status === 404) return 'No se encontró la cuenta o el recurso solicitado.';
      if (error.status === 409) return 'La información entra en conflicto con un registro existente.';
      if (error.status === 422) return 'Uno o más datos no son válidos. Revisa los campos indicados y vuelve a intentarlo.';
      if (error.status >= 500) return `La API encontró un error interno (HTTP ${error.status}). Revisa el registro de errores de PHP.`;
    }

    return 'Ocurrió un error inesperado. Inténtalo nuevamente.';
  }
}
