import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import { EatWellService } from './eat-well.service';
import { NutritionistPatientDetail } from './models';

export type PdfModule = 'measures' | 'general' | 'clinical' | 'recall' | 'lifestyle';

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  private readonly service = inject(EatWellService);

  exportModule(detail: NutritionistPatientDetail, module: PdfModule): void {
    const pdf = this.createDocument(detail, this.moduleTitle(module));
    this.addModule(pdf, detail, module);
    pdf.save(`EatWell-${detail.patient.name.replace(/\s+/g, '-')}-${module}.pdf`);
  }

  exportComplete(detail: NutritionistPatientDetail): void {
    const pdf = new jsPDF();
    const modules: PdfModule[] = ['measures', 'general', 'clinical', 'recall', 'lifestyle'];
    modules.forEach((module, index) => {
      if (index > 0) pdf.addPage();
      this.addHeader(pdf, detail, this.moduleTitle(module));
      this.addModule(pdf, detail, module);
    });
    pdf.save(`EatWell-Expediente-${detail.patient.name.replace(/\s+/g, '-')}.pdf`);
  }

  private createDocument(detail: NutritionistPatientDetail, title: string): jsPDF {
    const pdf = new jsPDF();
    this.addHeader(pdf, detail, title);
    return pdf;
  }

  private addHeader(pdf: jsPDF, detail: NutritionistPatientDetail, title: string): void {
    pdf.setFillColor(27, 77, 62);
    pdf.rect(0, 0, 210, 28, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text('EAT WELL - EXPEDIENTE NUTRICIONAL', 14, 12);
    pdf.setFontSize(9);
    pdf.text(title, 14, 20);
    const nutritionist = this.service.getActiveUser();
    pdf.setTextColor(27, 77, 62);
    pdf.setFontSize(9);
    pdf.text(`Nutriólogo emisor: ${nutritionist?.name || 'No especificado'}`, 14, 36);
    pdf.text(`Cédula profesional: ${nutritionist?.cedula_profesional || 'No registrada'}`, 14, 42);
    pdf.text(`Fecha de emisión: ${new Intl.DateTimeFormat('es-MX').format(new Date())}`, 145, 36);
    pdf.setDrawColor(82, 183, 136);
    pdf.line(14, 46, 196, 46);
  }

  private addModule(pdf: jsPDF, detail: NutritionistPatientDetail, module: PdfModule): void {
    let y = 54;
    const patient = detail.patient;
    const addLine = (label: string, value: unknown): void => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text(label, 14, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(this.clean(value), 65, y, { maxWidth: 130 });
      y += 7;
    };

    addLine('Paciente', patient.name);
    addLine('Edad / Género', `${patient.age || '—'} / ${this.gender(patient.gender)}`);
    addLine('Estatura / Peso', `${patient.heightCm} cm / ${patient.weightKg} kg`);

    if (module === 'measures') {
      const latest = detail.bodyMeasurements.length ? detail.bodyMeasurements[detail.bodyMeasurements.length - 1] : undefined;
      const first = detail.bodyMeasurements[0];
      addLine('Composición corporal', latest ? `Cintura ${latest.waistCm} cm; Cadera ${latest.hipCm} cm; Brazo ${latest.armCm} cm; Muslo ${latest.thighCm} cm; Cuello ${latest.neckCm} cm` : 'Sin mediciones');
      addLine('Inicial vs actual', first && latest ? `Cintura ${first.waistCm} / ${latest.waistCm} cm; Cadera ${first.hipCm} / ${latest.hipCm} cm; Brazo ${first.armCm} / ${latest.armCm} cm; Muslo ${first.thighCm} / ${latest.thighCm} cm; Cuello ${first.neckCm} / ${latest.neckCm} cm` : 'Sin comparación');
    } else if (module === 'general') {
      addLine('IMC', patient.imc);
    } else if (module === 'clinical') {
      const clinical = detail.clinicalHistory as { history?: Record<string, unknown>; completed?: boolean };
      const history = clinical?.history || {};
      addLine('Padecimientos', this.selectedFields(history));
      addLine('Alergias', this.clean(history['allergies'] || 'Sin registros'));
      addLine('Medicamentos', this.clean(history['medications'] || 'Sin registros'));
    } else if (module === 'recall') {
      const recall = detail.dietaryRecall as { recall?: Record<string, unknown> };
      addLine('Desayuno', this.recallMeal(recall?.recall, 'breakfastTime', 'breakfastPlace', 'breakfastDetails'));
      addLine('Colaciones', `${this.recallMeal(recall?.recall, 'snackTime', 'snackPlace', 'snackDetails')} / ${this.recallMeal(recall?.recall, 'afternoonSnackTime', 'afternoonSnackPlace', 'afternoonSnackDetails')}`);
      addLine('Comida / Cena', `${this.recallMeal(recall?.recall, 'lunchTime', 'lunchPlace', 'lunchDetails')} / ${this.recallMeal(recall?.recall, 'dinnerTime', 'dinnerPlace', 'dinnerDetails')}`);
      const schedule = detail.mealSchedule as { schedule?: Record<string, unknown> };
      addLine('Horarios', JSON.stringify(schedule?.schedule || {}));
    } else {
      const lifestyle = detail.lifestyle as { settings?: Record<string, unknown> };
      const preferences = detail.preferences as Record<string, unknown>;
      addLine('Actividad', patient.activityLevel);
      addLine('Meta', lifestyle?.settings?.['goal'] || patient.goal);
      addLine('Alimentos favoritos', this.clean(preferences?.['preferredFruits'] || preferences?.['preferredVegetables'] || 'Sin registros'));
      addLine('Aversiones', this.clean(preferences?.['dislikedFoods'] || 'Sin registros'));
      addLine('Tipo de dieta', this.clean(preferences?.['dietType'] || 'No especificado'));
    }
  }

  private recallMeal(recall: Record<string, unknown> | undefined, time: string, place: string, details: string): string {
    if (!recall) return 'Sin registro';
    return `${this.clean(recall[time])} · ${this.clean(recall[place])} · ${this.clean(recall[details])}`;
  }

  private selectedFields(history: Record<string, unknown>): string {
    const fields = Object.entries(history).filter(([, value]) => value === true).map(([key]) => key);
    return fields.length ? fields.join(', ') : this.clean(history['otherDiagnoses'] || 'Sin padecimientos registrados');
  }

  private moduleTitle(module: PdfModule): string {
    return {
      measures: 'COMPOSICIÓN Y MEDIDAS CORPORALES',
      general: 'DATOS GENERALES Y ANTROPOMÉTRICOS',
      clinical: 'HISTORIAL CLÍNICO Y NUTRICIONAL',
      recall: 'RECORDATORIO 24 HORAS Y HORARIOS',
      lifestyle: 'ESTILO DE VIDA, METAS Y PREFERENCIAS',
    }[module];
  }

  private gender(value: string): string {
    return value === 'male' ? 'Masculino' : value === 'female' ? 'Femenino' : 'Otro';
  }

  private clean(value: unknown): string {
    if (value == null) return '—';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    if (typeof value === 'object') return JSON.stringify(value);
    const text = String(value).trim();
    return text || '—';
  }
}
