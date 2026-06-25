import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () => import('../home/home.module').then(m => m.HomePageModule)
      },
      {
        path: 'plan-alimenticio',
        loadChildren: () => import('../plan-alimenticio/plan-alimenticio.module').then(m => m.PlanAlimenticioPageModule)
      },
      {
        path: 'actividad-frente',
        loadChildren: () => import('../actividad-frente/actividad-frente.module').then(m => m.ActividadFrentePageModule)
      },
      {
        path: 'actividad-espalda',
        loadChildren: () => import('../actividad-espalda/actividad-espalda.module').then(m => m.ActividadEspaldaPageModule)
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
