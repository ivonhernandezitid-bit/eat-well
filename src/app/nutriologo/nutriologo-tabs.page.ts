import { Component } from '@angular/core';

@Component({
  selector: 'app-nutriologo-tabs',
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="inicio"><ion-icon name="grid-outline"></ion-icon><ion-label>Inicio</ion-label></ion-tab-button>
        <ion-tab-button tab="pacientes"><ion-icon name="people-outline"></ion-icon><ion-label>Pacientes</ion-label></ion-tab-button>
        <ion-tab-button tab="perfil"><ion-icon name="person-circle-outline"></ion-icon><ion-label>Perfil</ion-label></ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [`
    ion-tab-bar { --background: #fff; border-top: 1px solid #e7eee9; height: 68px; }
    ion-tab-button { --color: #7a8a81; --color-selected: #1B4D3E; font-weight: 700; }
  `],
  standalone: false,
})
export class NutriologoTabsPage {}
