import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { EatWellService } from '../../core';

@Component({
  selector: 'app-nutriologo-perfil',
  templateUrl: './nutriologo-perfil.page.html',
  styleUrls: ['./nutriologo-perfil.page.scss'],
  standalone: false,
})
export class NutriologoPerfilPage {
  private readonly service = inject(EatWellService);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  user = this.service.getActiveUser();
  copied = false;

  get initials(): string {
    return (this.user?.name || 'Nutriólogo').split(/\s+/).slice(0, 2).map(v => v[0]).join('').toUpperCase();
  }

  async copyRegistrationLink(): Promise<void> {
    const url = `${window.location.origin}/registro`;
    try {
      await navigator.clipboard.writeText(url);
      this.copied = true;
      window.setTimeout(() => this.copied = false, 1800);
    } catch {
      const alert = await this.alertController.create({
        header: 'Enlace de registro',
        message: url,
        buttons: ['Cerrar'],
      });
      await alert.present();
    }
  }

  async editProfile(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Editar perfil',
      message: 'Los datos profesionales se administran desde tu cuenta registrada.',
      buttons: ['Aceptar'],
    });
    await alert.present();
  }

  async logout(): Promise<void> {
    await this.service.logout();
    await this.router.navigateByUrl('/login');
  }
}
