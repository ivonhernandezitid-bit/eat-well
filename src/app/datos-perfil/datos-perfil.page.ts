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

  constructor(
    private readonly eatWellService: EatWellService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly alertController: AlertController,
  ) { }

  ngOnInit() {
    this.isOnboarding = this.route.snapshot.queryParamMap.get('onboarding') === '1';
    const activeUser = this.eatWellService.getActiveUser();

    if (!activeUser) {
      void this.router.navigateByUrl('/login');
      return;
    }

    this.fullName = activeUser.name;
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
      await this.showAlert('Invalid file', 'Please select an image.');
      return;
    }

    this.profileImage = await this.readFileAsDataUrl(file);
    input.value = '';
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
      await this.showAlert('Missing data', 'Please complete your profile information.');
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
      await this.router.navigateByUrl(this.isOnboarding ? '/preferencias-alimentarias' : '/tabs/home');
    } catch (error) {
      await this.showAlert('Profile error', error instanceof Error ? error.message : 'Please try again.');
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
      reader.onerror = () => reject(new Error('Could not read image.'));
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
      buttons: ['OK'],
    });
    await alert.present();
  }
}
