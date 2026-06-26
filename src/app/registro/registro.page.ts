import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { EatWellService } from '../core';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.page.html',
  styleUrls: ['./registro.page.scss'],
  standalone: false
})
export class RegistroPage implements OnInit {
  email = '';
  password = '';
  fullName = '';
  username = '';

  constructor(
    private readonly eatWellService: EatWellService,
    private readonly router: Router,
    private readonly alertController: AlertController,
  ) { }

  ngOnInit() {
  }

  async register(): Promise<void> {
    if (!this.email.trim() || !this.password.trim() || !this.fullName.trim()) {
      await this.showAlert('Datos incompletos', 'Ingresa tu nombre, correo y contraseña.');
      return;
    }

    try {
      await this.eatWellService.registerUser({
        name: this.fullName,
        email: this.email,
        password: this.password,
        username: this.username,
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
