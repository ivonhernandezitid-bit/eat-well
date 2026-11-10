import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PlanAlimenticioPage } from './plan-alimenticio.page';
import { PlanRecipeSuggestionsPage } from './plan-recipe-suggestions.page';

const routes: Routes = [
  {
    path: 'sugerencias/:mealType/:kcal',
    component: PlanRecipeSuggestionsPage,
  },
  {
    path: '',
    component: PlanAlimenticioPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PlanAlimenticioPageRoutingModule {}
