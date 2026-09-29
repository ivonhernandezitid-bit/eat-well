import { FitnessGoal, UserProfile } from './models';

export type ActivityBand = 'sedentary' | 'light' | 'moderate' | 'intense';

export interface LifestyleSettings {
  goal: FitnessGoal;
  targetWeightKg: number;
  activityBand: ActivityBand;
  exerciseTypes: string[];
  sessionDuration: number;
  trainingTime: 'morning' | 'afternoon' | 'evening' | 'variable';
  cookingTime: 'short' | 'medium' | 'flexible';
  stressLevel: 'low' | 'moderate' | 'high';
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
}

export function lifestyleStorageKey(userId: string): string {
  return `eat-well-lifestyle-${userId}`;
}

export function loadLifestyleSettings(userId: string): LifestyleSettings | null {
  try {
    const stored = localStorage.getItem(lifestyleStorageKey(userId));
    return stored ? JSON.parse(stored) as LifestyleSettings : null;
  } catch {
    return null;
  }
}

export function calculateMacroTargets(
  user: Pick<UserProfile, 'age' | 'gender' | 'heightCm' | 'weightKg'>,
  settings: LifestyleSettings,
): MacroTargets {
  const genderAdjustment = user.gender === 'male' ? 5 : user.gender === 'female' ? -161 : -78;
  const basalCalories = 10 * user.weightKg + 6.25 * user.heightCm - 5 * user.age + genderAdjustment;
  const activityFactors: Record<ActivityBand, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    intense: 1.725,
  };
  const goalFactors: Record<FitnessGoal, number> = {
    lose_weight: settings.targetWeightKg < user.weightKg ? 0.85 : 1,
    maintain: 1,
    gain_muscle: settings.targetWeightKg > user.weightKg ? 1.1 : 1,
    improve_health: 1,
  };
  const macroRatios: Record<FitnessGoal, [number, number, number]> = {
    lose_weight: [0.3, 0.4, 0.3],
    maintain: [0.25, 0.45, 0.3],
    gain_muscle: [0.3, 0.45, 0.25],
    improve_health: [0.25, 0.45, 0.3],
  };
  const calories = Math.round(basalCalories * activityFactors[settings.activityBand] * goalFactors[settings.goal]);
  const [proteinRatio, carbohydrateRatio, fatRatio] = macroRatios[settings.goal];

  return {
    calories,
    protein: Math.round(calories * proteinRatio / 4),
    carbohydrates: Math.round(calories * carbohydrateRatio / 4),
    fat: Math.round(calories * fatRatio / 9),
  };
}