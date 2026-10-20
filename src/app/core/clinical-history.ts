export function emptyClinicalHistory() {
  return {
    familyNone: false,
    familyDiabetes: false,
    familyHypertension: false,
    familyObesity: false,
    familyCholesterol: false,
    familyCancer: false,
    familyRenal: false,
    familyThyroid: false,
    diagnosisNone: false,
    diagnosisDiabetes: false,
    diagnosisHypertension: false,
    diagnosisFattyLiver: false,
    diagnosisSop: false,
    diagnosisGout: false,
    diagnosisHypothyroidism: false,
    wellbeingNone: false,
    wellbeingAnemia: false,
    wellbeingBulimia: false,
    wellbeingDepression: false,
    wellbeingAnxiety: false,
    wellbeingOther: '',
    wellbeingTreatment: '',
    wellbeingSupport: '',
    wellbeingNotes: '',
    surgeriesNone: false,
    surgeries: '',
    hospitalizationsNone: false,
    hospitalizations: '',
    pregnant: '',
    lactating: '',
    menstrualCycle: '',
    allergies: [] as string[],
    allergiesNone: false,
    otherAllergies: '',
    medicationsNone: false,
    medications: '',
    medicationAllergiesNone: false,
    medicationAllergies: '',
    supplementsNone: false,
    supplements: '',
    weightLossTreatment: '',
    sleepHours: '',
    sleepQuality: '',
    bowelFrequency: '',
    alcohol: '',
    tobacco: '',
    cigarettesPerDay: null as number | null,
    otherSubstances: '',
    cooksAtHome: '',
    weekdayPlace: '',
    appetite: '',
    anxiety: '',
    waterLiters: null as number | null,
  };
}

export type ClinicalHistoryData = ReturnType<typeof emptyClinicalHistory>;

export interface ClinicalHistoryResponse {
  history: ClinicalHistoryData | null;
  completed: boolean;
}

export const clinicalGroups = {
  familyNone: ['familyDiabetes', 'familyHypertension', 'familyObesity', 'familyCholesterol', 'familyCancer', 'familyRenal', 'familyThyroid'],
  diagnosisNone: ['diagnosisDiabetes', 'diagnosisHypertension', 'diagnosisFattyLiver', 'diagnosisSop', 'diagnosisGout', 'diagnosisHypothyroidism'],
  wellbeingNone: ['wellbeingAnemia', 'wellbeingBulimia', 'wellbeingDepression', 'wellbeingAnxiety', 'wellbeingOther'],
  allergiesNone: ['allergies', 'otherAllergies'],
  surgeriesNone: ['surgeries'],
  hospitalizationsNone: ['hospitalizations'],
  medicationsNone: ['medications'],
  medicationAllergiesNone: ['medicationAllergies'],
  supplementsNone: ['supplements'],
} as const;

const selections = {
  wellbeingTreatment: ['No aplica', 'No', 'Sí, actualmente', 'Anteriormente'],
  wellbeingSupport: ['No aplica', 'No', 'Sí, actualmente', 'Anteriormente'],
  pregnant: ['No', 'Sí'],
  lactating: ['No', 'Sí'],
  menstrualCycle: ['Regular', 'Irregular', 'No aplica'],
  weightLossTreatment: ['No', 'Sí'],
  sleepHours: ['7-8 hrs', 'Menos de 6 hrs', 'Más de 8 hrs'],
  sleepQuality: ['Reparador', 'No reparador'],
  bowelFrequency: ['1 a 2 veces al día', 'Menos de 1 vez al día'],
  alcohol: ['Ocasional', 'Frecuente', 'No consumo'],
  tobacco: ['No fumo', 'Fumo'],
  otherSubstances: ['No', 'Sí'],
  cooksAtHome: ['Yo mismo(a)', 'Otra persona'],
  weekdayPlace: ['En casa', 'En el trabajo'],
  appetite: ['Normal', 'Bajo', 'Alto'],
  anxiety: ['Sí', 'No'],
};

function hasAnswer(value: unknown): boolean {
  return typeof value === 'string' ? value.trim() !== '' : Array.isArray(value) ? value.length > 0 : value === true;
}

export function clinicalHistoryForSex(data: ClinicalHistoryData, sex: string): ClinicalHistoryData {
  return sex === 'female' ? { ...data } : { ...data, pregnant: '', lactating: '', menstrualCycle: '', diagnosisSop: false };
}

export function changeClinicalField<K extends keyof ClinicalHistoryData>(data: ClinicalHistoryData, field: K, value: ClinicalHistoryData[K]): ClinicalHistoryData {
  const next = { ...data, [field]: value };
  const defaults = emptyClinicalHistory();
  for (const [none, fields] of Object.entries(clinicalGroups)) {
    if (field === none && value === true) {
      for (const related of fields) Object.assign(next, { [related]: defaults[related] });
    } else if ((fields as readonly string[]).includes(field) && hasAnswer(value)) {
      Object.assign(next, { [none]: false });
    }
  }
  if (field === 'tobacco') {
    next.cigarettesPerDay = value === 'No fumo' ? 0 : null;
  }
  return next;
}

export function clinicalHistoryError(data: ClinicalHistoryData, sex: string): string | null {
  const current = clinicalHistoryForSex(data, sex);
  const groupLabels: Record<keyof typeof clinicalGroups, string> = {
    familyNone: 'Antecedentes heredofamiliares',
    diagnosisNone: 'Antecedentes patológicos personales',
    wellbeingNone: 'Salud integral y bienestar emocional',
    allergiesNone: 'Alergias e intolerancias alimentarias',
    surgeriesNone: 'Cirugías previas',
    hospitalizationsNone: 'Hospitalizaciones',
    medicationsNone: 'Medicamentos actuales',
    medicationAllergiesNone: 'Alergias a medicamentos',
    supplementsNone: 'Suplementos / proteínas',
  };
  for (const [none, fields] of Object.entries(clinicalGroups) as [keyof typeof clinicalGroups, readonly (keyof ClinicalHistoryData)[]][]) {
    const answered = fields.some(field => hasAnswer(current[field]));
    if (current[none as keyof typeof clinicalGroups] === answered) {
      return `${groupLabels[none]}: contesta al menos una opción o marca “No aplica”, pero no ambas.`;
    }
  }
  const selectionLabels: Record<string, string> = {
    wellbeingTreatment: 'Tratamiento o seguimiento',
    wellbeingSupport: 'Apoyo profesional',
    pregnant: 'Embarazo actual',
    lactating: 'Periodo de lactancia',
    menstrualCycle: 'Ciclo menstrual',
    weightLossTreatment: 'Uso de pastillas para bajar de peso',
    sleepHours: 'Horas de sueño',
    sleepQuality: 'Calidad del sueño',
    bowelFrequency: 'Frecuencia de evacuaciones',
    alcohol: 'Consumo de alcohol',
    tobacco: 'Consumo de tabaco',
    otherSubstances: 'Consumo de otras sustancias',
    cooksAtHome: 'Quién cocina en casa',
    weekdayPlace: 'Lugar donde comes entre semana',
    appetite: 'Apetito general',
    anxiety: 'Ansiedad / atracones',
  };
  for (const [field, options] of Object.entries(selections)) {
    if (sex !== 'female' && ['pregnant', 'lactating', 'menstrualCycle'].includes(field)) continue;
    const value = current[field as keyof typeof selections];
    if (!options.includes(value)) return `Selecciona una respuesta en “${selectionLabels[field]}”.`;
  }
  const textLabels: Partial<Record<keyof ClinicalHistoryData, string>> = {
    wellbeingOther: 'Otra condición o situación relevante',
    wellbeingNotes: 'Información adicional de bienestar',
    surgeries: 'Cirugías previas',
    hospitalizations: 'Hospitalizaciones',
    otherAllergies: 'Otras alergias',
    medications: 'Medicamentos actuales',
    medicationAllergies: 'Alergias a medicamentos',
    supplements: 'Suplementos / proteínas',
  };
  for (const [field, label] of Object.entries(textLabels) as [keyof ClinicalHistoryData, string][]) {
    const value = current[field];
    if (typeof value === 'string' && new TextEncoder().encode(value).length > 10000) return `El campo “${label}” supera el máximo de 10,000 bytes. Acórtalo para continuar.`;
  }
  if (current.allergies.length > 50 || current.allergies.some(value => typeof value !== 'string' || !value.trim() || new TextEncoder().encode(value).length > 200)) {
    return 'Alergias alimentarias: puedes seleccionar hasta 50; cada alergia debe tener texto y no superar 200 bytes.';
  }
  if (current.tobacco === 'Fumo' && (current.cigarettesPerDay === null || !Number.isInteger(current.cigarettesPerDay) || current.cigarettesPerDay < 1 || current.cigarettesPerDay > 65535)) {
    return 'Cigarrillos por día: indica un número entero entre 1 y 65,535.';
  }
  if (current.tobacco === 'No fumo' && current.cigarettesPerDay !== 0 && current.cigarettesPerDay !== null) {
    return 'Cigarrillos por día: seleccionaste “No fumo”; cambia la respuesta o deja la cantidad en cero.';
  }
  if (current.waterLiters === null || ![1, 2, 3].includes(current.waterLiters)) return 'Agua natural al día: selecciona 1, 2 o 3 litros.';
  return null;
}
