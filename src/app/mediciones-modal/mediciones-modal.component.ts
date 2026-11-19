import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { EatWellService, UserProfile } from '../core';
import { BodyMeasurement, bodyFatPercentage, readBodyMeasurements, saveBodyMeasurements } from '../core/body-measurements';

type FormValues = Pick<BodyMeasurement, 'waistCm' | 'hipCm' | 'armCm' | 'thighCm' | 'neckCm'>;

@Component({
  selector: 'app-mediciones-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './mediciones-modal.component.html',
  styleUrls: ['./mediciones-modal.component.scss'],
})
export class MedicionesModalComponent implements OnInit {
  @Input({ required: true }) profile!: UserProfile;
  @Output() closed = new EventEmitter<void>();
  @Output() measurementsChanged = new EventEmitter<BodyMeasurement[]>();
  private readonly service = inject(EatWellService);
  records: BodyMeasurement[] = [];
  showForm = false;
  showLeanMassInfo = false;
  showIccInfo = false;
  showIcaInfo = false;
  saving = false;
  error = '';
  form: FormValues = { waistCm: 0, hipCm: 0, armCm: 0, thighCm: 0, neckCm: 0 };
  readonly zones: { key: keyof FormValues; label: string; guide: string }[] = [
    { key: 'waistCm', label: 'Cintura', guide: '2 dedos arriba del ombligo' },
    { key: 'hipCm', label: 'Cadera', guide: 'En la parte más ancha de la cadera' },
    { key: 'armCm', label: 'Brazo', guide: 'A mitad del brazo, relajado' },
    { key: 'thighCm', label: 'Muslo', guide: 'A mitad entre cadera y rodilla' },
    { key: 'neckCm', label: 'Cuello', guide: 'Debajo de la nuez, sin apretar' },
  ];

  ngOnInit(): void {
    this.records = readBodyMeasurements(this.profile.id);
    void this.loadMeasurements();
  }

  get current(): BodyMeasurement | null { return this.records[this.records.length - 1] ?? null; }
  get first(): BodyMeasurement | null { return this.records[0] ?? null; }
  get bodyFat(): number | null { return this.current ? bodyFatPercentage(this.profile.gender, this.current.heightCm ?? this.profile.heightCm, this.current) : null; }
  get leanMass(): number | null { return this.bodyFat === null ? null : Number((this.current!.weightKg * (1 - this.bodyFat / 100)).toFixed(1)); }
  get initialLeanMass(): number | null {
    if (!this.first) return null;
    const initialFat = bodyFatPercentage(this.profile.gender, this.first.heightCm ?? this.profile.heightCm, this.first);
    return initialFat === null ? null : Number((this.first.weightKg * (1 - initialFat / 100)).toFixed(1));
  }
  get leanMassChange(): number | null {
    return this.records.length >= 2 && this.leanMass !== null && this.initialLeanMass !== null
      ? Number((this.leanMass - this.initialLeanMass).toFixed(1)) : null;
  }
  get leanMassTrend(): string | null {
    if (this.leanMassChange === null) return null;
    if (this.leanMassChange > 0) return 'Subió la masa libre de grasa estimada';
    if (this.leanMassChange < 0) return 'Bajó la masa libre de grasa estimada';
    return 'La estimación se mantiene';
  }
  get bodyFatChange(): number | null {
    if (!this.first || this.bodyFat === null) return null;
    const initial = bodyFatPercentage(this.profile.gender, this.first.heightCm ?? this.profile.heightCm, this.first);
    return initial === null ? null : Number((this.bodyFat - initial).toFixed(1));
  }
  get icc(): number | null { return this.current && this.current.hipCm > 0 ? Number((this.current.waistCm / this.current.hipCm).toFixed(2)) : null; }
  get ica(): number | null { return this.current ? Number((this.current.waistCm / (this.current.heightCm ?? this.profile.heightCm)).toFixed(2)) : null; }
  get iccLabel(): string { return this.icc !== null && this.icc < (this.profile.gender === 'male' ? 0.9 : 0.85) ? 'Saludable' : 'En observación'; }
  get icaLabel(): string { return this.ica !== null && this.ica < 0.5 ? 'Saludable' : 'En observación'; }

  toggleForm(): void { this.showForm = !this.showForm; this.error = ''; }
  cancel(): void { this.showForm = false; this.error = ''; }
  delta(key: keyof FormValues): number | null { return this.first && this.current ? Number((this.current[key] - this.first[key]).toFixed(1)) : null; }
  improvement(key: keyof FormValues): boolean { return (this.delta(key) ?? 0) < 0; }

  async save(): Promise<void> {
    if (this.saving) return;
    const values = Object.values(this.form).map(Number);
    if (values.some(value => !Number.isFinite(value) || value <= 0 || value > 250)) {
      this.error = 'Completa las cinco medidas con valores válidos en centímetros.';
      return;
    }
    if (this.profile.gender === 'female' && this.form.hipCm <= this.form.neckCm) {
      this.error = 'Revisa las medidas de cadera y cuello para calcular la grasa corporal.';
      return;
    }
    this.saving = true; this.error = '';
    try {
      const userId = this.profile.id;
      const record: BodyMeasurement = {
        ...this.form, id: crypto.randomUUID?.() ?? `${Date.now()}`,
        measuredAt: new Date().toISOString(), weightKg: this.profile.weightKg, heightCm: this.profile.heightCm,
      };
      const saved = await this.service.saveBodyMeasurement(record);
      if (this.service.getActiveUser()?.id !== userId) return;
      this.records = this.mergeMeasurements(saved);
      try { saveBodyMeasurements(userId, this.records); } catch { /* The database already saved this record. */ }
      this.measurementsChanged.emit(this.records);
      this.form = { waistCm: 0, hipCm: 0, armCm: 0, thighCm: 0, neckCm: 0 };
      this.showForm = false;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo guardar el registro.';
    } finally { this.saving = false; }
  }

  private mergeMeasurements(saved: BodyMeasurement[]): BodyMeasurement[] {
    return [...this.records.filter(local => !saved.some(record => record.id === local.id)), ...saved]
      .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  }

  private async loadMeasurements(): Promise<void> {
    const userId = this.profile.id;
    try {
      const records = await this.service.getBodyMeasurements();
      if (this.service.getActiveUser()?.id !== userId) return;
      this.records = this.mergeMeasurements(records);
      this.measurementsChanged.emit(this.records);
      try { saveBodyMeasurements(userId, this.records); } catch { /* Keep the server response visible. */ }
    } catch { this.error = 'No se pudo cargar el historial del servidor. Se muestra el respaldo local.'; }
  }
}
