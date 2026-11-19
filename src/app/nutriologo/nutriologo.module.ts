import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { NutriologoRoutingModule } from './nutriologo-routing.module';
import { NutriologoTabsPage } from './nutriologo-tabs.page';
import { NutriologoInicioPage } from './inicio/nutriologo-inicio.page';
import { NutriologoPacientesPage } from './pacientes/nutriologo-pacientes.page';
import { NutriologoPerfilPage } from './perfil/nutriologo-perfil.page';
import { NutriologoExpedientePage } from './expediente/nutriologo-expediente.page';

@NgModule({
  declarations: [
    NutriologoTabsPage,
    NutriologoInicioPage,
    NutriologoPacientesPage,
    NutriologoPerfilPage,
    NutriologoExpedientePage,
  ],
  imports: [CommonModule, FormsModule, IonicModule, NutriologoRoutingModule],
})
export class NutriologoModule {}
