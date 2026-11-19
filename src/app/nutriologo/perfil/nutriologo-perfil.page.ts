import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
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
  user = this.service.getActiveUser();

  get initials(): string {
    return (this.user?.name || 'Nutriólogo').split(/\s+/).slice(0, 2).map(v => v[0]).join('').toUpperCase();
  }

  async logout(): Promise<void> {
    await this.service.logout();
    await this.router.navigateByUrl('/login');
  }
}
