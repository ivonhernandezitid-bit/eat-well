import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EatWellService } from '../../core';
import { NutritionistPatientDetail } from '../../core/models';
import { bodyFatPercentage } from '../../core/body-measurements';
import { PdfExportService, PdfModule } from '../../core/pdf-export.service';

@Component({
  selector: 'app-nutriologo-expediente',
  templateUrl: './nutriologo-expediente.page.html',
  styleUrls: ['./nutriologo-expediente.page.scss'],
  standalone: false,
})
export class NutriologoExpedientePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(EatWellService);
  private readonly pdf = inject(PdfExportService);
  detail: NutritionistPatientDetail | null = null;
  loading = true;

  ngOnInit(): void {
    const patientId = this.route.snapshot.paramMap.get('patientId');
    if (patientId) void this.load(patientId);
  }

  async load(patientId: string): Promise<void> {
    try { this.detail = await this.service.getNutritionistPatientDetail(patientId); }
    finally { this.loading = false; }
  }

  get latestBody(): NutritionistPatientDetail['bodyMeasurements'][number] | null {
    return this.detail && this.detail.bodyMeasurements.length
      ? this.detail.bodyMeasurements[this.detail.bodyMeasurements.length - 1]
      : null;
  }

  get firstBody(): NutritionistPatientDetail['bodyMeasurements'][number] | null {
    return this.detail?.bodyMeasurements[0] || null;
  }

  get bodyFat(): number | null {
    if (!this.detail || !this.latestBody) return null;
    return bodyFatPercentage(this.detail.patient.gender, this.detail.patient.heightCm, this.latestBody);
  }

  get leanMass(): number | null {
    if (!this.detail || this.bodyFat === null) return null;
    return Number((this.detail.patient.weightKg * (1 - this.bodyFat / 100)).toFixed(1));
  }

  get initials(): string {
    return (this.detail?.patient.name || '').split(/\s+/).slice(0, 2).map(v => v[0]).join('').toUpperCase();
  }

  download(module: PdfModule): void {
    if (this.detail) this.pdf.exportModule(this.detail, module);
  }

  downloadComplete(): void {
    if (this.detail) this.pdf.exportComplete(this.detail);
  }

  back(): void {
    void this.router.navigate(['/nutriologo/pacientes']);
  }
}
