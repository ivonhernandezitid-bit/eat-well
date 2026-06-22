import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  BodyZone,
  Exercise,
  FoodScanInput,
  FoodScanResult,
  LoginCredentials,
  Recipe,
  SuggestedFoodRecipe,
  UserProfile,
  UserRegistrationData,
} from './models';

const ACTIVE_USER_KEY = 'eat-well-active-user';

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
    const url = new URL(environment.apiUrl);
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

  private getApiErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.error?.error) {
      return error.error.error;
    }

    return 'No se pudo conectar con la API. Revisa que XAMPP, Apache y MySQL esten activos.';
  }
}
