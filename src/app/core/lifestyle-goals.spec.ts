import { LifestyleSettings, normalizeLifestyleSettings } from './lifestyle-goals';

describe('normalizeLifestyleSettings', () => {
  const settings: LifestyleSettings = {
    goal: 'improve_health',
    targetWeightKg: 70,
    activityBand: 'sedentary',
    exerciseTypes: [],
    sessionDuration: 45,
    trainingTime: 'afternoon',
    cookingTime: 'medium',
    stressLevel: 'moderate',
  };

  it('treats sedentary activity with no exercise type as no planned exercise', () => {
    expect(normalizeLifestyleSettings(settings).exerciseTypes).toEqual(['none']);
  });

  it('preserves exercise selections and non-sedentary settings', () => {
    const activeSettings = { ...settings, activityBand: 'light' as const };
    expect(normalizeLifestyleSettings(activeSettings)).toBe(activeSettings);
    expect(normalizeLifestyleSettings({ ...activeSettings, exerciseTypes: ['walking'] }).exerciseTypes).toEqual(['walking']);
  });
});
