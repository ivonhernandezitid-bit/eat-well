import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { EatWellService, FoodPreferences, UserProfile } from '../core';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit, OnDestroy {
  user: UserProfile | null = null;
  dailyTip = 'Mantén una alimentación variada durante el día.';
  dailyTipIcon = 'sparkles-outline';
  private userSubscription?: Subscription;
  private tipTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly eatWellService: EatWellService,
    private readonly router: Router,
  ) { }

  ngOnInit() {
    this.userSubscription = this.eatWellService.activeUser$.subscribe((user) => {
      this.user = user;
    });
    void this.loadDailyTip();
    this.tipTimer = setInterval(() => this.refreshDailyTip(), 60 * 60 * 1000);
  }

  ngOnDestroy() {
    this.userSubscription?.unsubscribe();
    if (this.tipTimer) {
      clearInterval(this.tipTimer);
    }
  }

  async logout(): Promise<void> {
    await this.eatWellService.logout();
    await this.router.navigateByUrl('/login');
  }

  private async loadDailyTip(): Promise<void> {
    try {
      const preferences = await this.eatWellService.getFoodPreferences();
      this.refreshDailyTip(preferences);
    } catch {
      this.refreshDailyTip();
    }
  }

  private refreshDailyTip(preferences?: FoodPreferences): void {
    const tips = [
      { text: 'Acompaña tus comidas con agua y toma pausas durante el día.', icon: 'water-outline' },
      { text: 'Combina distintos colores de alimentos para variar tus comidas.', icon: 'color-palette-outline' },
      { text: 'Planea una opción sencilla antes de tener demasiada hambre.', icon: 'time-outline' },
    ];

    if (preferences?.preferredFruits.length) {
      tips.push({
        text: `Prueba ${preferences.preferredFruits[0]} como parte de una colación sencilla.`,
        icon: 'nutrition-outline',
      });
    }

    if (preferences?.preferredVegetables.length) {
      tips.push({
        text: `Incluye ${preferences.preferredVegetables[0]} en una comida de hoy.`,
        icon: 'leaf-outline',
      });
    }

    if (preferences?.allergies.length) {
      tips.push({
        text: 'Revisa las etiquetas y evita contaminación cruzada con tus alérgenos.',
        icon: 'shield-checkmark-outline',
      });
    }

    const sixHourSlot = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
    const tip = tips[sixHourSlot % tips.length];
    this.dailyTip = tip.text;
    this.dailyTipIcon = tip.icon;
  }
}
