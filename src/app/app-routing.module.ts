import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'registro',
    loadChildren: () => import('./registro/registro.module').then(m => m.RegistroPageModule)
  },
  {
    path: 'datos-perfil',
    redirectTo: 'tabs/datos-perfil',
    pathMatch: 'full'
  },
  {
    path: 'preferencias-alimentarias',
    redirectTo: 'tabs/preferencias-alimentarias',
    pathMatch: 'full'
  },
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule)
  },
  {
    path: 'tabs/inicio',
    redirectTo: 'tabs/home',
    pathMatch: 'full'
  },
  {
    path: 'nutriologo',
    loadChildren: () => import('./nutriologo/nutriologo.module').then(m => m.NutriologoModule)
  }
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules,
      canceledNavigationResolution: 'computed',
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
