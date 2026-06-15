import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PlanAlimenticioPage } from './plan-alimenticio.page';

const routes: Routes = [
  {
    path: '',
    component: PlanAlimenticioPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PlanAlimenticioPageRoutingModule {}
