import { Component, HostListener, inject, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { EatWellService, GeminiExercise, RoutineResult, CustomRoutineForm } from '../core';

@Component({
  selector: 'app-actividad-espalda',
  templateUrl: './actividad-espalda.page.html',
  styleUrls: ['./actividad-espalda.page.scss'],
  standalone: false
})
export class ActividadEspaldaPage implements OnInit {
  selectedFilter: 'recommended' | 'favorites' = 'recommended';
  searchTerm = '';
  viewMode: 'list' | 'grid' = 'list';
  isMapFullscreen = false;
  isFemaleUser = false;
  canAccessMuscleMap = false;
  selectedMuscle: string | null = null;
  exercises: GeminiExercise[] = [];
  favoriteExercises: GeminiExercise[] = [];
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
    'Pantorrillas': false,
    'Trapecios': false
  };

  muscleList = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Antebrazos', 'Abdomen', 'Glúteos', 'Cuádriceps', 'Isquiotibiales', 'Pantorrillas', 'Trapecios'];

  get filteredMuscles(): string[] {
    const term = this.normalizeSearchTerm(this.searchTerm);
    return this.muscleList.filter(muscle => this.normalizeSearchTerm(muscle).includes(term));
  }

  get filteredExercises(): GeminiExercise[] {
    const sourceExercises = this.selectedFilter === 'favorites' ? this.favoriteExercises : this.exercises;
    const term = this.normalizeSearchTerm(this.searchTerm);
    if (!term || (this.selectedFilter !== 'favorites' && this.selectedMuscle && this.normalizeSearchTerm(this.selectedMuscle).includes(term))) {
      return sourceExercises;
    }

    return sourceExercises.filter(exercise =>
      this.normalizeSearchTerm([
        exercise.nombre,
        exercise.musculo,
        exercise.equipo,
        exercise.dificultad,
        exercise.repeticiones,
        ...exercise.instrucciones
      ].join(' ')).includes(term)
    );
  }

  savedRoutine: RoutineResult | null = null;
  hasSavedRoutine = false;
  generatedRoutine: RoutineResult | null = null;

  private readonly eatWellService = inject(EatWellService);
  private readonly toastController = inject(ToastController);

  ngOnInit() {
    this.loadSavedRoutine();
  }

  ionViewWillEnter() {
    this.loadSavedRoutine();
    this.loadFavoriteExercises();
    const activeUser = this.eatWellService.getActiveUser();
    this.isFemaleUser = activeUser?.gender === 'female';
    this.canAccessMuscleMap = !!activeUser
      && !!activeUser.name.trim()
      && activeUser.age > 0
      && activeUser.weightKg > 0
      && activeUser.heightCm > 0
      && activeUser.gender !== 'other';
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isMapFullscreen = document.fullscreenElement !== null;
  }

  loadSavedRoutine() {
    const saved = localStorage.getItem(this.getSavedRoutineKey());
    if (saved) {
      try {
        this.savedRoutine = JSON.parse(saved);
        this.hasSavedRoutine = true;
      } catch {
        this.savedRoutine = null;
        this.generatedRoutine = null;
        this.hasSavedRoutine = false;
      }
    } else {
      this.savedRoutine = null;
      this.generatedRoutine = null;
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

  isFavoriteExercise(exercise: GeminiExercise): boolean {
    return this.favoriteExercises.some(favorite => this.exerciseIdentity(favorite) === this.exerciseIdentity(exercise));
  }

  async toggleFavoriteExercise(exercise: GeminiExercise): Promise<void> {
    const isFavorite = this.isFavoriteExercise(exercise);
    const updatedFavorites = isFavorite
      ? this.favoriteExercises.filter(favorite => this.exerciseIdentity(favorite) !== this.exerciseIdentity(exercise))
      : [exercise, ...this.favoriteExercises];

    try {
      this.eatWellService.saveFavoriteExercises(updatedFavorites);
      this.favoriteExercises = updatedFavorites;
      await this.showSuccessToast(isFavorite ? 'Ejercicio eliminado de favoritos.' : 'Ejercicio agregado a favoritos.');
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : 'No se pudo actualizar el ejercicio favorito.');
    }
  }

  private loadFavoriteExercises(): void {
    try {
      this.favoriteExercises = this.eatWellService.getFavoriteExercises();
    } catch (error) {
      this.favoriteExercises = [];
      this.showToast(error instanceof Error ? error.message : 'No se pudieron cargar los ejercicios favoritos.');
    }
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'list' ? 'grid' : 'list';
  }

  async toggleMapFullscreen(mapCard: HTMLElement): Promise<void> {
    try {
      if (document.fullscreenElement === mapCard) {
        await document.exitFullscreen();
      } else if (document.fullscreenEnabled && mapCard.requestFullscreen) {
        await mapCard.requestFullscreen();
      } else {
        await this.showToast('La pantalla completa no está disponible en este dispositivo.');
      }
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : 'No se pudo cambiar a pantalla completa.');
    }
  }

  async selectMuscleFromSearch(muscleName: string): Promise<void> {
    this.searchTerm = '';
    await this.selectMuscle(muscleName);
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
      localStorage.setItem(this.getSavedRoutineKey(), JSON.stringify(this.generatedRoutine));
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

  private getSavedRoutineKey(): string {
    const activeUser = this.eatWellService.getActiveUser();
    return activeUser ? `eatwell-saved-routine-${activeUser.id}` : 'eatwell-saved-routine-guest';
  }

  private normalizeSearchTerm(value: string): string {
    return value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private exerciseIdentity(exercise: GeminiExercise): string {
    return this.normalizeSearchTerm(`${exercise.nombre}|${exercise.musculo}`);
  }
}
