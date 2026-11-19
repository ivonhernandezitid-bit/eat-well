import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { EatWellService } from '../../core';
import { NutritionistPatientSummary } from '../../core/models';

@Component({
  selector: 'app-nutriologo-pacientes',
  templateUrl: './nutriologo-pacientes.page.html',
  styleUrls: ['./nutriologo-pacientes.page.scss'],
  standalone: false,
})
export class NutriologoPacientesPage implements OnInit {
  private readonly service = inject(EatWellService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly alertController = inject(AlertController);
  patients: NutritionistPatientSummary[] = [];
  search = '';
  filter: 'all' | 'new' | 'condition' = 'all';
  loading = true;
  showCreateModal = false;
  showMeasureModal = false;
  saving = false;
  actionError = '';

  newPatient = {
    name: '',
    email: '',
    username: '',
    password: '',
    age: 18,
    gender: 'other' as 'female' | 'male' | 'other',
    heightCm: 170,
    weightKg: 70,
    activityLevel: 'moderate' as 'low' | 'moderate' | 'high',
    goal: 'improve_health' as 'lose_weight' | 'maintain' | 'gain_muscle' | 'improve_health',
  };

  measure = {
    patientId: '',
    weightKg: 70,
    heightCm: 170,
    waistCm: 0,
    hipCm: 0,
    armCm: 0,
    thighCm: 0,
    neckCm: 0,
  };

  ngOnInit(): void {
    this.filter = this.route.snapshot.queryParamMap.get('filter') === 'new' ? 'new' : 'all';
    void this.load().then(() => {
      const action = this.route.snapshot.queryParamMap.get('action');
      if (action === 'new') this.showCreateModal = true;
      if (action === 'measure') this.showMeasureModal = true;
    });
  }

  async load(): Promise<void> {
    try { this.patients = await this.service.getNutritionistPatients(); }
    finally { this.loading = false; }
  }

  get filtered(): NutritionistPatientSummary[] {
    const term = this.search.trim().toLowerCase();
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.patients.filter(patient => {
      const matchesSearch = !term || [patient.profile.name, patient.profile.email, patient.condition].some(value => (value || '').toLowerCase().includes(term));
      const matchesFilter = this.filter === 'all'
        || (this.filter === 'new' && !!patient.latestMeasurement && new Date(patient.updatedAt).getTime() >= cutoff)
        || (this.filter === 'condition' && !!patient.condition);
      return matchesSearch && matchesFilter;
    });
  }

  patientInitials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map(v => v[0]).join('').toUpperCase();
  }

  formatImc(value: number | string | null | undefined): string {
    return value == null || value === '' ? '—' : Number(value).toFixed(1);
  }

  isAllergy(condition: string): boolean {
    return /alergia/i.test(condition);
  }

  openRegistration(): void {
    this.actionError = '';
    this.showCreateModal = true;
  }

  async createPatient(): Promise<void> {
    if (!this.newPatient.name.trim() || !this.newPatient.email.trim()) {
      this.actionError = 'Completa el nombre y el correo del paciente.';
      return;
    }
    this.saving = true;
    this.actionError = '';
    try {
      const result = await this.service.createNutritionistPatient({
        ...this.newPatient,
        name: this.newPatient.name.trim(),
        email: this.newPatient.email.trim(),
        username: this.newPatient.username.trim(),
      });
      this.showCreateModal = false;
      await this.load();
      const alert = await this.alertController.create({
        header: 'Paciente registrado',
        message: `Cuenta creada. Contraseña temporal: ${result.temporaryPassword}`,
        buttons: ['Aceptar'],
      });
      await alert.present();
      this.resetCreateForm();
    } catch (error) {
      this.actionError = error instanceof Error ? error.message : 'No se pudo crear el paciente.';
    } finally {
      this.saving = false;
    }
  }

  resetCreateForm(): void {
    this.newPatient = {
      name: '', email: '', username: '', password: '', age: 18,
      gender: 'other', heightCm: 170, weightKg: 70,
      activityLevel: 'moderate', goal: 'improve_health',
    };
  }

  openMeasureModal(patient?: NutritionistPatientSummary): void {
    this.actionError = '';
    if (patient) {
      this.measure.patientId = patient.profile.id;
      this.measure.heightCm = patient.profile.heightCm || 170;
      this.measure.weightKg = patient.profile.weightKg || 70;
    }
    this.showMeasureModal = true;
  }

  async saveMeasurements(): Promise<void> {
    if (!this.measure.patientId) {
      this.actionError = 'Selecciona el paciente.';
      return;
    }
    const values = [this.measure.weightKg, this.measure.heightCm, this.measure.waistCm, this.measure.hipCm, this.measure.armCm, this.measure.thighCm, this.measure.neckCm];
    if (values.some(value => !Number.isFinite(value) || value <= 0)) {
      this.actionError = 'Completa peso, estatura y las cinco medidas corporales.';
      return;
    }
    this.saving = true;
    this.actionError = '';
    try {
      await this.service.saveNutritionistPatientMeasurements({ ...this.measure });
      this.showMeasureModal = false;
      await this.load();
    } catch (error) {
      this.actionError = error instanceof Error ? error.message : 'No se pudieron guardar las medidas.';
    } finally {
      this.saving = false;
    }
  }

  openPatient(patient: NutritionistPatientSummary): void {
    void this.router.navigate(['/nutriologo/expediente', patient.profile.id]);
  }
}
