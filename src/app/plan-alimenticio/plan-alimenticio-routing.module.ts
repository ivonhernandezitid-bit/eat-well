import { inject, NgModule } from '@angular/core';
import { CanDeactivateFn, Router, RouterModule, Routes } from '@angular/router';
import { PlanAlimenticioPage } from './plan-alimenticio.page';
import { PlanRecipeSuggestionsPage } from './plan-recipe-suggestions.page';

const closeRecipeOverlays: CanDeactivateFn<PlanRecipeSuggestionsPage> =
  page => page.dismissOverlaysBeforeLeaving(inject(Router).getCurrentNavigation()?.trigger === 'popstate');

const routes: Routes = [
  {
    path: 'receta/:mealType/:recipeId',
    component: PlanRecipeSuggestionsPage,
    canDeactivate: [closeRecipeOverlays],
  },
  {
    path: 'sugerencias/:mealType/:kcal',
    component: PlanRecipeSuggestionsPage,
    canDeactivate: [closeRecipeOverlays],
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
