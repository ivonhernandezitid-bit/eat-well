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
export class HomePage implements OnInit {
  user: UserProfile | null = null;
  private userSubscription?: Subscription;

  constructor(
    private readonly eatWellService: EatWellService,
    private readonly router: Router,
  ) { }

  ngOnInit() {
    this.userSubscription = this.eatWellService.activeUser$.subscribe((user) => {
      this.user = user;
    });
  }

  ngOnDestroy() {
    this.userSubscription?.unsubscribe();
  }

  async logout(): Promise<void> {
    await this.eatWellService.logout();
    await this.router.navigateByUrl('/login');
  }
}
