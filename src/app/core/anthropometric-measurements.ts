export interface AnthropometricMeasurement {
  id: string;
  measuredAt: string;
  weightKg: number;
  heightCm: number;
  imc: number | null;
}

export interface MeasurementHistoryResponse {
  measurements: AnthropometricMeasurement[];
  timeZone: 'America/Mexico_City';
}

export function measurementValuesError(weight: unknown, height: unknown): string | null {
  const numeric = (value: unknown) => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value));
  if (!numeric(weight) || !numeric(height)) return 'Indica un peso y una estatura numéricos.';
  const kg = Math.round((Number(weight) + Number.EPSILON) * 100) / 100;
  const cm = Math.round((Number(height) + Number.EPSILON) * 100) / 100;
  if (kg <= 0 || kg > 500) return 'El peso debe ser mayor que cero y no superar 500 kg.';
  if (cm <= 0 || cm > 300) return 'La estatura debe ser mayor que cero y no superar 300 cm.';
  const bmi = Number((kg / ((cm / 100) ** 2)).toFixed(2));
  if (bmi <= 0 || bmi > 999.99) return 'Revisa las unidades y los valores del peso y la estatura.';
  return null;
}

export function measurementImc(weight: unknown, height: unknown): number | null {
  if (measurementValuesError(weight, height)) return null;
  const kg = Math.round((Number(weight) + Number.EPSILON) * 100) / 100;
  const cm = Math.round((Number(height) + Number.EPSILON) * 100) / 100;
  return Number((kg / ((cm / 100) ** 2)).toFixed(2));
}
