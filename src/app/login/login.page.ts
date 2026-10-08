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
    if (!this.email.trim() || !this.password.trim()) {
      await this.showAlert('Datos incompletos', 'Ingresa tu correo o usuario y contraseña.');
      return;
    }

    try {
      await this.eatWellService.login({
        email: this.email,
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
