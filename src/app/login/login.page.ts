import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { EatWellService } from '../core';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage {
  email = '';
  password = '';
  private readonly eatWellService = inject(EatWellService);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);

  async login(): Promise<void> {
    const identifier = this.email.trim();
    if (!identifier) {
      await this.showAlert('Falta el correo o usuario', 'Escribe el correo electrónico o nombre de usuario de tu cuenta.');
      return;
    }
    if (identifier.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      await this.showAlert('Correo inválido', 'Revisa el formato del correo. Ejemplo: nombre@dominio.com.');
      return;
    }
    if (!this.password) {
      await this.showAlert('Falta la contraseña', 'Escribe la contraseña de tu cuenta.');
      return;
    }

    try {
      await this.eatWellService.login({
        email: identifier,
        password: this.password,
      });
      await this.router.navigateByUrl('/tabs/home');
    } catch (error) {
      await this.showAlert('No se pudo iniciar sesión', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
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
