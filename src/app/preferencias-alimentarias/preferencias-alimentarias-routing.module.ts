import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PreferenciasAlimentariasPage } from './preferencias-alimentarias.page';

const routes: Routes = [{ path: '', component: PreferenciasAlimentariasPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PreferenciasAlimentariasPageRoutingModule {}
