import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NutriologoTabsPage } from './nutriologo-tabs.page';
import { NutriologoInicioPage } from './inicio/nutriologo-inicio.page';
import { NutriologoPacientesPage } from './pacientes/nutriologo-pacientes.page';
import { NutriologoPerfilPage } from './perfil/nutriologo-perfil.page';
import { NutriologoExpedientePage } from './expediente/nutriologo-expediente.page';

const routes: Routes = [
  {
    path: '',
    component: NutriologoTabsPage,
    children: [
      { path: 'inicio', component: NutriologoInicioPage },
      { path: 'pacientes', component: NutriologoPacientesPage },
      { path: 'perfil', component: NutriologoPerfilPage },
      { path: 'expediente/:patientId', component: NutriologoExpedientePage },
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NutriologoRoutingModule {}
