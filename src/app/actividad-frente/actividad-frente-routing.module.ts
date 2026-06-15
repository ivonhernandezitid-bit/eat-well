import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ActividadFrentePage } from './actividad-frente.page';

const routes: Routes = [
  {
    path: '',
    component: ActividadFrentePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ActividadFrentePageRoutingModule {}
