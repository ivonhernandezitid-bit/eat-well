import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { EatWellService, Gender } from '../core';

type WeightUnit = 'kg' | 'lbs';
type HeightUnit = 'cm' | 'ft';

@Component({
  selector: 'app-datos-perfil',
  templateUrl: './datos-perfil.page.html',
  styleUrls: ['./datos-perfil.page.scss'],
  standalone: false
})
export class DatosPerfilPage implements OnInit {
  @ViewChild('photoInput') photoInput?: ElementRef<HTMLInputElement>;

  fullName = '';
  username = '';
  email = '';
  weightKg = 70;
  heightCm = 170;
  displayWeight = 70;
  displayHeight = 170;
  weightUnit: WeightUnit = 'kg';
  heightUnit: HeightUnit = 'cm';
  gender: Gender = 'other';
  age = 18;
  imc = 24.22;
  profileImage: string | null = null;
  isOnboarding = false;

  isCroppingModalOpen = false;
  selectedPhotoUrl: string | null = null;
  translateX = 0;
  translateY = 0;
  scale = 1.0;
  rotation = 0;
  dispWidth = 0;
  dispHeight = 0;

  private readonly cropSize = 280;
  private rawImage: HTMLImageElement | null = null;
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerId: number | null = null;

  constructor(
    private readonly eatWellService: EatWellService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly alertController: AlertController,
  ) { }

  ngOnInit() {
    this.loadProfileData();
  }

  ionViewWillEnter() {
    this.loadProfileData();
  }

  private loadProfileData(): void {
    this.isOnboarding = this.route.snapshot.queryParamMap.get('onboarding') === '1';
    const activeUser = this.eatWellService.getActiveUser();

    if (!activeUser) {
      void this.router.navigateByUrl('/login');
      return;
    }

    this.fullName = activeUser.name;
    this.username = activeUser.username || '';
    this.email = activeUser.email;
    this.weightKg = activeUser.weightKg;
    this.heightCm = activeUser.heightCm;
    this.gender = activeUser.gender;
    this.age = activeUser.age;
    this.imc = activeUser.imc;
    this.profileImage = activeUser.profileImage ?? null;
    this.syncDisplayValues();
  }

  openPhotoPicker(): void {
    this.photoInput?.nativeElement.click();
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      await this.showAlert('Archivo inválido', 'Selecciona una imagen.');
      return;
    }

    const dataUrl = await this.readFileAsDataUrl(file);
    input.value = '';

    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      this.rawImage = img;
      const aspectRatio = img.width / img.height;
      if (aspectRatio > 1) {
        this.dispHeight = this.cropSize;
        this.dispWidth = this.cropSize * aspectRatio;
      } else {
        this.dispWidth = this.cropSize;
        this.dispHeight = this.cropSize / aspectRatio;
      }
      this.selectedPhotoUrl = dataUrl;
      this.translateX = 0;
      this.translateY = 0;
      this.scale = 1.0;
      this.rotation = 0;
      this.isCroppingModalOpen = true;
    };
    img.onerror = async () => {
      await this.showAlert('Error', 'No se pudo cargar la imagen.');
    };
  }

  rotateImage(): void {
    this.rotation = (this.rotation + 90) % 360;
  }

  cancelCropping(): void {
    this.isCroppingModalOpen = false;
    this.selectedPhotoUrl = null;
    this.rawImage = null;
  }

  onPointerDown(event: PointerEvent): void {
    const container = event.currentTarget as HTMLElement;
    container.setPointerCapture(event.pointerId);
    this.isDragging = true;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.pointerId = event.pointerId;
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging || event.pointerId !== this.pointerId) {
      return;
    }
    const dx = event.clientX - this.lastPointerX;
    const dy = event.clientY - this.lastPointerY;
    this.translateX += dx;
    this.translateY += dy;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  }

  onPointerUp(event: PointerEvent): void {
    if (this.isDragging && event.pointerId === this.pointerId) {
      this.isDragging = false;
      this.pointerId = null;
      const container = event.currentTarget as HTMLElement;
      try {
        container.releasePointerCapture(event.pointerId);
      } catch (e) {
        // Ignore error if already released
      }
    }
  }

  async cropAndSave(): Promise<void> {
    if (!this.rawImage) {
      this.isCroppingModalOpen = false;
      return;
    }

    const outputSize = 400;
    const ratio = outputSize / this.cropSize;

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      await this.showAlert('Error', 'No se pudo procesar la imagen.');
      this.isCroppingModalOpen = false;
      return;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outputSize, outputSize);

    ctx.save();
    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.translate(this.translateX * ratio, this.translateY * ratio);
    ctx.rotate((this.rotation * Math.PI) / 180);

    const w = this.dispWidth * this.scale * ratio;
    const h = this.dispHeight * this.scale * ratio;
    ctx.drawImage(this.rawImage, -w / 2, -h / 2, w, h);
    ctx.restore();

    this.profileImage = canvas.toDataURL('image/jpeg', 0.9);
    this.isCroppingModalOpen = false;
    this.selectedPhotoUrl = null;
    this.rawImage = null;
  }

  setWeightUnit(unit: WeightUnit): void {
    if (this.weightUnit === unit) {
      return;
    }

    this.weightUnit = unit;
    this.displayWeight = this.round(unit === 'kg' ? this.weightKg : this.weightKg * 2.2046226218, 1);
  }

  setHeightUnit(unit: HeightUnit): void {
    if (this.heightUnit === unit) {
      return;
    }

    this.heightUnit = unit;
    this.displayHeight = this.round(unit === 'cm' ? this.heightCm : this.heightCm / 30.48, 2);
  }

  onWeightChange(value: string | number | null | undefined): void {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return;
    }

    this.displayWeight = numericValue;
    this.weightKg = this.weightUnit === 'kg' ? numericValue : numericValue / 2.2046226218;
    this.updateImcPreview();
  }

  onHeightChange(value: string | number | null | undefined): void {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return;
    }

    this.displayHeight = numericValue;
    this.heightCm = this.heightUnit === 'cm' ? numericValue : numericValue * 30.48;
    this.updateImcPreview();
  }

  updateImcPreview(): void {
    if (this.weightKg > 0 && this.heightCm > 0) {
      this.imc = this.eatWellService.calculateImc(this.weightKg, this.heightCm);
    }
  }

  async saveProfile(): Promise<void> {
    if (!this.fullName.trim() || this.weightKg <= 0 || this.heightCm <= 0 || this.age <= 0) {
      await this.showAlert('Datos incompletos', 'Completa la información de tu perfil.');
      return;
    }

    try {
      await this.eatWellService.updateProfile({
        name: this.fullName,
        weightKg: this.round(this.weightKg, 2),
        heightCm: this.round(this.heightCm, 2),
        gender: this.gender,
        age: Number(this.age),
        profileImage: this.profileImage,
      });

      let preferencesCompleted = false;
      try {
        const prefs = await this.eatWellService.getFoodPreferences();
        preferencesCompleted = !!prefs?.completed;
      } catch {
        preferencesCompleted = false;
      }

      const shouldGoToPreferences = this.isOnboarding && !preferencesCompleted;
      await this.router.navigateByUrl(shouldGoToPreferences ? '/preferencias-alimentarias' : '/tabs/home');
    } catch (error) {
      await this.showAlert('Error de perfil', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    }
  }

  private syncDisplayValues(): void {
    this.displayWeight = this.round(this.weightKg, 1);
    this.displayHeight = this.round(this.heightCm, 1);
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    });
  }

  private round(value: number, decimals: number): number {
    return Number(value.toFixed(decimals));
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['Aceptar'],
    });
    await alert.present();
  }
}
