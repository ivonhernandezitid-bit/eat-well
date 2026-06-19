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
  imageUri?: string;
  manualDescription?: string;
}

export interface FoodScanResult {
  status: 'pending_api' | 'analyzed';
  foodName: string;
  estimatedCalories: number;
  recommendation: string;
}

export interface AppDatabase {
  users: UserAccount[];
  activeUserId: string | null;
}
