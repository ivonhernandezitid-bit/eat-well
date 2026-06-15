import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ActividadEspaldaPage } from './actividad-espalda.page';

const routes: Routes = [
  {
    path: '',
    component: ActividadEspaldaPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ActividadEspaldaPageRoutingModule {}
