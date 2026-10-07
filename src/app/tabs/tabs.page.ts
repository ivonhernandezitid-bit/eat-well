import { Component, ViewChild } from '@angular/core';
import { IonTabs } from '@ionic/angular';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  @ViewChild('tabs') tabs?: IonTabs;

  private readonly tabOrder = ['home', 'plan-alimenticio', 'datos-perfil', 'actividad-frente'];
  private touchStartX = 0;

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0]?.clientX ?? 0;
  }

  onTouchEnd(event: TouchEvent): void {
    const touchEndX = event.changedTouches[0]?.clientX ?? 0;
    const swipeDistance = touchEndX - this.touchStartX;

    if (Math.abs(swipeDistance) < 70) {
      return;
    }

    const currentTab = this.tabs?.getSelected?.() ?? 'home';
    const currentIndex = this.tabOrder.indexOf(currentTab);
    const nextIndex = swipeDistance < 0
      ? Math.min(currentIndex + 1, this.tabOrder.length - 1)
      : Math.max(currentIndex - 1, 0);

    const targetTab = this.tabOrder[nextIndex];
    if (targetTab !== currentTab) {
      void this.tabs?.select(targetTab);
    }
  }
}
