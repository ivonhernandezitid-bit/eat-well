import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  private readonly router = inject(Router);

  async openProfileMenu(): Promise<void> {
    await this.router.navigateByUrl('/tabs/datos-perfil', { onSameUrlNavigation: 'reload' });
  }
}
