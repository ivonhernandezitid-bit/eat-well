import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { EatWellService, GeminiExercise, RoutineResult, CustomRoutineForm } from '../core';

@Component({
  selector: 'app-actividad-frente',
  templateUrl: './actividad-frente.page.html',
  styleUrls: ['./actividad-frente.page.scss'],
  standalone: false
})
export class ActividadFrentePage implements OnInit {
  selectedMuscle: string | null = null;
  exercises: GeminiExercise[] = [];
  isLoadingExercises = false;
  expandedExerciseIndex: number | null = null;

  // Form & Modals for Custom Routine
  isRoutineModalOpen = false;
  isResultModalOpen = false;
  isLoadingRoutine = false;
  
  formGoal: 'Perder peso' | 'Ganar músculo' | 'Tonificar' | 'Mejorar resistencia' = 'Mejorar resistencia';
  formDays = 3;
  formLevel: 'Principiante' | 'Intermedio' | 'Avanzado' = 'Principiante';
  formEquipment: 'Sin equipo' | 'Mancuernas' | 'Gimnasio completo' = 'Sin equipo';
  
  formMuscles: { [key: string]: boolean } = {
    'Pecho': false,
    'Espalda': false,
    'Hombros': false,
    'Bíceps': false,
    'Tríceps': false,
    'Antebrazos': false,
    'Abdomen': false,
    'Glúteos': false,
    'Cuádriceps': false,
    'Isquiotibiales': false,
    'Pantorrillas': false
  };

  muscleList = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Antebrazos', 'Abdomen', 'Glúteos', 'Cuádriceps', 'Isquiotibiales', 'Pantorrillas'];

  savedRoutine: RoutineResult | null = null;
  hasSavedRoutine = false;
  generatedRoutine: RoutineResult | null = null;

  constructor(
    private readonly eatWellService: EatWellService,
    private readonly toastController: ToastController
  ) { }

  ngOnInit() {
    this.loadSavedRoutine();
  }

  loadSavedRoutine() {
    const saved = localStorage.getItem('eatwell-saved-routine');
    if (saved) {
      try {
        this.savedRoutine = JSON.parse(saved);
        this.hasSavedRoutine = true;
      } catch {
        this.hasSavedRoutine = false;
      }
    } else {
      this.hasSavedRoutine = false;
    }
  }

  toggleMuscle(muscleName: string) {
    this.formMuscles[muscleName] = !this.formMuscles[muscleName];
  }

  async selectMuscle(muscleName: string): Promise<void> {
    if (this.isLoadingExercises) return;
    this.selectedMuscle = muscleName;
    this.isLoadingExercises = true;
    this.exercises = [];
    this.expandedExerciseIndex = null;

    try {
      this.exercises = await this.eatWellService.generateExercisesByMuscle(muscleName);
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : 'No se pudieron generar los ejercicios.');
      this.exercises = [];
    } finally {
      this.isLoadingExercises = false;
    }
  }

  toggleExercise(index: number) {
    if (this.expandedExerciseIndex === index) {
      this.expandedExerciseIndex = null;
    } else {
      this.expandedExerciseIndex = index;
    }
  }

  openRoutineModal() {
    // Reset muscles and pre-check the currently selected one if applicable
    Object.keys(this.formMuscles).forEach(k => this.formMuscles[k] = false);
    if (this.selectedMuscle && this.formMuscles[this.selectedMuscle] !== undefined) {
      this.formMuscles[this.selectedMuscle] = true;
    }
    
    this.isRoutineModalOpen = true;
  }

  async submitRoutineForm(): Promise<void> {
    const activeUser = this.eatWellService.getActiveUser();

    if (!activeUser) {
      this.showToast('No hay un usuario activo.');
      return;
    }

    const selectedMusclesList = Object.keys(this.formMuscles).filter(k => this.formMuscles[k]);
    if (selectedMusclesList.length === 0) {
      this.showToast('Por favor selecciona al menos un músculo a enfocar.');
      return;
    }

    this.isLoadingRoutine = true;

    const formData: CustomRoutineForm = {
      edad: activeUser.age,
      peso: activeUser.weightKg,
      altura: activeUser.heightCm,
      imc: activeUser.imc,
      actividad: activeUser.activityLevel,
      objetivo: this.formGoal,
      dias: this.formDays,
      nivel: this.formLevel,
      equipo: this.formEquipment,
      musculos: selectedMusclesList
    };

    try {
      this.generatedRoutine = await this.eatWellService.generateCustomRoutine(formData);
      this.isRoutineModalOpen = false;
      this.isResultModalOpen = true;
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : 'No se pudo generar la rutina.');
    } finally {
      this.isLoadingRoutine = false;
    }
  }

  saveRoutine() {
    if (this.generatedRoutine) {
      localStorage.setItem('eatwell-saved-routine', JSON.stringify(this.generatedRoutine));
      this.savedRoutine = this.generatedRoutine;
      this.hasSavedRoutine = true;
      this.showSuccessToast('¡Rutina guardada correctamente!');
    }
  }

  viewSavedRoutine() {
    this.loadSavedRoutine();
    if (this.savedRoutine) {
      this.generatedRoutine = this.savedRoutine;
      this.isResultModalOpen = true;
    } else {
      this.showToast('No tienes ninguna rutina guardada.');
    }
  }

  async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3500,
      position: 'bottom',
      color: 'danger',
      buttons: [{ text: 'Cerrar', role: 'cancel' }]
    });
    await toast.present();
  }

  async showSuccessToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
  }
}
