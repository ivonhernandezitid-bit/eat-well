import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DatosPerfilPage } from './datos-perfil.page';

const routes: Routes = [
  {
    path: '',
    component: DatosPerfilPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DatosPerfilPageRoutingModule {}
