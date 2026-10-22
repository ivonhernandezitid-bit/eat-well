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

export interface LifestyleGoalsResponse {
  settings: LifestyleSettings | null;
  completed: boolean;
  user?: UserProfile;
}

export function defaultLifestyleSettings(user: Pick<UserProfile, 'goal' | 'weightKg' | 'activityLevel'>): LifestyleSettings {
  return { goal: user.goal, targetWeightKg: user.weightKg, activityBand: user.activityLevel === 'low' ? 'sedentary' : user.activityLevel === 'high' ? 'intense' : 'moderate', exerciseTypes: [], sessionDuration: 45, trainingTime: 'afternoon', cookingTime: 'medium', stressLevel: 'moderate' };
}

export function normalizeLifestyleSettings(settings: LifestyleSettings): LifestyleSettings {
  if (settings.activityBand === 'sedentary' && settings.exerciseTypes.length === 0) {
    return { ...settings, exerciseTypes: ['none'] };
  }
  return settings;
}

export function lifestyleSettingsError(settings: LifestyleSettings, requireExercise = false, currentWeightKg?: number): string | null {
  if (!settings || !['lose_weight','maintain','gain_muscle','improve_health'].includes(settings.goal)) return 'Selecciona una meta válida.';
  if (!Number.isFinite(Number(settings.targetWeightKg)) || Number(settings.targetWeightKg) < 25 || Number(settings.targetWeightKg) > 350) return 'Indica un peso objetivo entre 25 y 350 kg.';
  if (!['sedentary','light','moderate','intense'].includes(settings.activityBand) || !['morning','afternoon','evening','variable'].includes(settings.trainingTime) || !['short','medium','flexible'].includes(settings.cookingTime) || !['low','moderate','high'].includes(settings.stressLevel)) return 'Revisa tus opciones de actividad y hábitos.';
  if (![30,45,60,90].includes(Number(settings.sessionDuration))) return 'Selecciona una duración de sesión válida.';
  if (!Array.isArray(settings.exerciseTypes) || settings.exerciseTypes.length > 6 || settings.exerciseTypes.some(type => !['walking','strength','cycling','sports','home','none'].includes(type))) return 'Revisa los tipos de ejercicio.';
  if (settings.exerciseTypes.includes('none') && settings.exerciseTypes.some(type => type !== 'none')) return 'Ninguno por ahora no puede combinarse con otros ejercicios.';
  if (requireExercise && !settings.exerciseTypes.length) return 'Selecciona tu ejercicio habitual o Ninguno por ahora.';
  if (requireExercise && settings.exerciseTypes.includes('none') && settings.activityBand !== 'sedentary') return 'Si no realizas ejercicio, selecciona Sin ejercicio planificado; si realizas actividad, indica su tipo.';
  if (currentWeightKg && settings.goal === 'lose_weight' && Number(settings.targetWeightKg) >= currentWeightKg) return 'Para bajar de peso, el peso meta debe ser menor que tu peso actual.';
  return null;
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
    const settings = stored ? JSON.parse(stored) as LifestyleSettings : null;
    return settings && !lifestyleSettingsError(settings) ? settings : null;
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
