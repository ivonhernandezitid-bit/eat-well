import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { EatWellService } from '../core';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage implements OnInit {
  email = '';
  password = '';

  constructor(
    private readonly eatWellService: EatWellService,
    private readonly router: Router,
    private readonly alertController: AlertController,
  ) { }

  ngOnInit() { }

  async login(): Promise<void> {
    if (!this.email.trim() || !this.password.trim()) {
      await this.showAlert('Missing data', 'Please enter your email and password.');
      return;
    }

    try {
      await this.eatWellService.login({
        email: this.email,
        password: this.password,
      });
      await this.router.navigateByUrl('/tabs/home');
    } catch (error) {
      await this.showAlert('Login failed', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
