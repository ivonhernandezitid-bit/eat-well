import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  patients: NutritionistPatientSummary[] = [];
  search = '';
  filter: 'all' | 'new' | 'condition' = 'all';
  loading = true;

  ngOnInit(): void {
    this.filter = this.route.snapshot.queryParamMap.get('filter') === 'new' ? 'new' : 'all';
    void this.load();
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

  openPatient(patient: NutritionistPatientSummary): void {
    void this.router.navigate(['/nutriologo/expediente', patient.profile.id]);
  }
}
