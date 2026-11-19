import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EatWellService } from '../../core';
import { NutritionistPatientSummary, UserProfile } from '../../core/models';

@Component({
  selector: 'app-nutriologo-inicio',
  templateUrl: './nutriologo-inicio.page.html',
  styleUrls: ['./nutriologo-inicio.page.scss'],
  standalone: false,
})
export class NutriologoInicioPage implements OnInit {
  private readonly service = inject(EatWellService);
  private readonly router = inject(Router);
  user: UserProfile | null = this.service.getActiveUser();
  patients: NutritionistPatientSummary[] = [];
  loading = true;
  today = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  get initials(): string {
    return (this.user?.name || 'Nutriólogo').split(/\s+/).slice(0, 2).map(v => v[0]).join('').toUpperCase();
  }

  patientInitials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map(v => v[0]).join('').toUpperCase();
  }

  get recentPatients(): NutritionistPatientSummary[] {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.patients.filter(p => p.latestMeasurement && new Date(p.updatedAt).getTime() >= cutoff);
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.patients = await this.service.getNutritionistPatients();
    } finally {
      this.loading = false;
    }
  }

  openPatient(patient: NutritionistPatientSummary): void {
    void this.router.navigate(['/nutriologo/expediente', patient.profile.id]);
  }

  openUpdated(): void {
    void this.router.navigate(['/nutriologo/pacientes'], { queryParams: { filter: 'new' } });
  }

  async logout(): Promise<void> {
    await this.service.logout();
    await this.router.navigateByUrl('/login');
  }
}
