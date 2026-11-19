export interface BodyMeasurement {
  id: string;
  measuredAt: string;
  waistCm: number;
  hipCm: number;
  armCm: number;
  thighCm: number;
  neckCm: number;
  weightKg: number;
  heightCm?: number;
}

export const bodyMeasurementStorageKey = (userId: string) => `eat-well-body-measurements:${userId}`;

export function readBodyMeasurements(userId: string): BodyMeasurement[] {
  try {
    const stored = localStorage.getItem(bodyMeasurementStorageKey(userId));
    const records = stored ? JSON.parse(stored) : [];
    return Array.isArray(records) ? records.filter(isBodyMeasurement).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)) : [];
  } catch {
    return [];
  }
}

export function saveBodyMeasurements(userId: string, records: BodyMeasurement[]): void {
  localStorage.setItem(bodyMeasurementStorageKey(userId), JSON.stringify(records));
}

export function bodyFatPercentage(gender: 'female' | 'male' | 'other', heightCm: number, record: Pick<BodyMeasurement, 'waistCm' | 'hipCm' | 'neckCm'>): number | null {
  const { waistCm: waist, hipCm: hip, neckCm: neck } = record;
  if (!(heightCm > 0 && waist > 0 && neck > 0) || (gender === 'female' && !(hip > 0))) return null;
  const denominator = gender === 'female'
    ? 1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(heightCm)
    : gender === 'male'
      ? 1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(heightCm)
      : NaN;
  const value = 495 / denominator - 450;
  return Number.isFinite(value) && value > 0 && value < 100 ? Number(value.toFixed(1)) : null;
}

function isBodyMeasurement(value: unknown): value is BodyMeasurement {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record['id'] === 'string' && typeof record['measuredAt'] === 'string'
    && Number.isFinite(Date.parse(record['measuredAt'] as string))
    && ['waistCm', 'hipCm', 'armCm', 'thighCm', 'neckCm', 'weightKg'].every(key =>
      typeof record[key] === 'number' && Number.isFinite(record[key]) && (record[key] as number) > 0
      && (record[key] as number) <= (key === 'weightKg' ? 500 : 250));
}
