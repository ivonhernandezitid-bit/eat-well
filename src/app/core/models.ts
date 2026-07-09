export type Gender = 'female' | 'male' | 'other';

export type ActivityLevel = 'low' | 'moderate' | 'high';

export type FitnessGoal = 'lose_weight' | 'maintain' | 'gain_muscle' | 'improve_health';

export type BodyZone =
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'arms'
  | 'abdomen'
  | 'back'
  | 'hips'
  | 'legs'
  | 'calves'
  | 'full_body';

export interface UserRegistrationData {
  name: string;
  email: string;
  password: string;
  username?: string;
  age?: number;
  gender?: Gender;
  heightCm?: number;
  weightKg?: number;
  imc?: number;
  activityLevel?: ActivityLevel;
  goal?: FitnessGoal;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface UserProfile {
  id: string;
  name: string;
  username?: string;
  email: string;
  profileImage?: string | null;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  imc: number;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
  createdAt: string;
  updatedAt: string;
}

export interface UserAccount {
  profile: UserProfile;
  password: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  ingredients: string[];
  instructions: string[];
  goals: FitnessGoal[];
  minImc?: number;
  maxImc?: number;
}

export interface Exercise {
  id: string;
  title: string;
  bodyZone: BodyZone;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationMinutes: number;
  repetitions: string;
  instructions: string[];
  recommendations: string;
}

export interface FoodScanInput {
  imageBase64?: string;
}

export interface SuggestedFoodRecipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  sourceUrl: string;
  ingredients: string[];
  instructions: string[];
  detailsLoaded: boolean;
}

export interface FoodScanResult {
  status: 'analyzed';
  foodName: string;
  detectedIngredients: string[];
  recommendation: string;
  suggestedRecipes: SuggestedFoodRecipe[];
}

export interface AppDatabase {
  users: UserAccount[];
  activeUserId: string | null;
}

export interface GeminiExercise {
  nombre: string;
  musculo: string;
  equipo: string;
  dificultad: 'Principiante' | 'Intermedio' | 'Avanzado';
  series: number;
  repeticiones: string;
  instrucciones: string[];
}

export interface RoutineExercise {
  nombre: string;
  musculo: string;
  equipo: string;
  series: number;
  repeticiones: string;
  descanso: string;
  instrucciones: string[];
}

export interface RoutineDay {
  dia: string;
  enfoque: string;
  ejercicios: RoutineExercise[];
}

export interface RoutineResult {
  planSemanal: RoutineDay[];
}

export type DietType = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian';

export interface FoodPreferences {
  dietType: DietType;
  preferredFruits: string[];
  preferredVegetables: string[];
  allergies: string[];
  dislikedFoods: string[];
  cookingTimeMinutes: number;
  completed: boolean;
}

export interface FavoriteRecipe extends SuggestedFoodRecipe {
  favoriteId: string;
}

export interface CustomRoutineForm {
  edad: number;
  peso: number;
  altura: number;
  imc: number;
  actividad: ActivityLevel;
  objetivo: 'Perder peso' | 'Ganar músculo' | 'Tonificar' | 'Mejorar resistencia';
  dias: number;
  nivel: 'Principiante' | 'Intermedio' | 'Avanzado';
  equipo: 'Sin equipo' | 'Mancuernas' | 'Gimnasio completo';
  musculos: string[];
}

export interface FoodScanHistoryItem {
  id: string;
  detectedFood: string;
  detectedIngredients: string[];
  estimatedCalories: number;
  aiRecommendation: string;
  createdAt: string;
}

