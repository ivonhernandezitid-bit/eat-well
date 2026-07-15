import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { EatWellService, UserProfile } from '../core';

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
  isFading = false;

  private userSubscription?: Subscription;
  private tipTimer?: ReturnType<typeof setInterval>;
  activeTips: { text: string; icon: string }[] = [];
  currentTipIndex = 0;

  constructor(
    private readonly eatWellService: EatWellService,
    private readonly router: Router,
  ) { }

  ngOnInit() {
    this.userSubscription = this.eatWellService.activeUser$.subscribe((user) => {
      this.user = user;
    });
    
    // Cycle tip automatically every 60 seconds
    this.tipTimer = setInterval(() => this.cycleTip(), 60 * 1000);
  }

  ionViewWillEnter() {
    void this.loadDailyTip();
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

  private touchStartX = 0;
  private touchStartY = 0;
  private dragStartX = 0;

  cycleTip(direction: 'next' | 'prev' = 'next'): void {
    if (this.isFading || this.activeTips.length <= 1) {
      return;
    }

    this.isFading = true;
    
    setTimeout(() => {
      if (direction === 'next') {
        this.currentTipIndex = (this.currentTipIndex + 1) % this.activeTips.length;
      } else {
        this.currentTipIndex = (this.currentTipIndex - 1 + this.activeTips.length) % this.activeTips.length;
      }
      const nextTip = this.activeTips[this.currentTipIndex];
      this.dailyTip = nextTip.text;
      this.dailyTipIcon = nextTip.icon;
      this.isFading = false;
    }, 150);
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent): void {
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    
    const dx = touchEndX - this.touchStartX;
    const dy = touchEndY - this.touchStartY;
    
    // Swipe left (next tip) or right (previous tip)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) {
        this.cycleTip('next');
      } else {
        this.cycleTip('prev');
      }
    }
  }

  onMouseDown(event: MouseEvent): void {
    this.dragStartX = event.clientX;
  }

  onMouseUp(event: MouseEvent): void {
    const dragEndX = event.clientX;
    const dx = dragEndX - this.dragStartX;
    
    // Drag left (next) or right (prev)
    if (Math.abs(dx) > 40) {
      if (dx < 0) {
        this.cycleTip('next');
      } else {
        this.cycleTip('prev');
      }
    }
  }

  private async loadDailyTip(): Promise<void> {
    try {
      this.activeTips = await this.eatWellService.getCustomTips();
    } catch {
      this.activeTips = [
        { text: 'Acompaña tus comidas con agua pura y mantente hidratado todo el día.', icon: 'water-outline' },
        { text: 'Combina distintos colores de vegetales en tu plato para asegurar una mayor variedad de vitaminas.', icon: 'color-palette-outline' },
        { text: 'Masticar despacio ayuda a mejorar tu digestión y permite al cerebro registrar la saciedad a tiempo.', icon: 'hourglass-outline' }
      ];
    }
    
    this.currentTipIndex = 0;
    
    // Set initial tip
    if (this.activeTips.length > 0) {
      this.dailyTip = this.activeTips[0].text;
      this.dailyTipIcon = this.activeTips[0].icon;
    }
  }
}
