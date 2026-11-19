import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EatWellService } from './core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly eatWellService = inject(EatWellService);

  ngOnInit(): void {
    const activeUser = this.eatWellService.getActiveUser();
    if (activeUser?.role === 'nutritionist') {
      void this.router.navigateByUrl('/nutriologo/inicio');
    }
  }
}
