import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { EatWellService } from '../core';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.page.html',
  styleUrls: ['./registro.page.scss'],
  standalone: false
})
export class RegistroPage {
  email = '';
  password = '';
  fullName = '';
  username = '';

  hasMinLength = false;
  hasLetterAndNumber = false;
  private readonly eatWellService = inject(EatWellService);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);

  validatePasswordStrength(): void {
    const pw = this.password || '';
    this.hasMinLength = pw.length >= 8;
    this.hasLetterAndNumber = /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
  }

  async register(): Promise<void> {
    const name = this.fullName.trim();
    const email = this.email.trim();
    const username = this.username.trim();
    if (!name) {
      await this.showAlert('Falta el nombre', 'Escribe tu nombre completo para crear la cuenta.');
      return;
    }
    if (!email) {
      await this.showAlert('Falta el correo', 'Escribe el correo electrónico que usarás para iniciar sesión.');
      return;
    }
    if (!this.password) {
      await this.showAlert('Falta la contraseña', 'Escribe una contraseña para crear la cuenta.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await this.showAlert('Correo inválido', 'Por favor, ingresa un correo electrónico con formato correcto (ejemplo@dominio.com).');
      return;
    }

    if (name.length > 100) {
      await this.showAlert('Nombre demasiado largo', 'El nombre completo no puede superar 100 caracteres.');
      return;
    }
    if (email.length > 120) {
      await this.showAlert('Correo demasiado largo', 'El correo no puede superar 120 caracteres.');
      return;
    }
    if ((username || email.split('@')[0]).length > 50) {
      await this.showAlert('Usuario demasiado largo', 'El nombre de usuario no puede superar 50 caracteres.');
      return;
    }

    this.validatePasswordStrength();
    if (!this.hasMinLength || !this.hasLetterAndNumber) {
      await this.showAlert('Contraseña débil', 'La contraseña debe tener al menos 8 caracteres y contener al menos una letra y un número.');
      return;
    }

    try {
      await this.eatWellService.registerUser({
        name,
        email,
        password: this.password,
        username,
      });
      await this.router.navigateByUrl('/datos-perfil?onboarding=1');
    } catch (error) {
      await this.showAlert('No se pudo registrar', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    }
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
