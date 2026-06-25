import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PreferenciasAlimentariasPageRoutingModule } from './preferencias-alimentarias-routing.module';
import { PreferenciasAlimentariasPage } from './preferencias-alimentarias.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PreferenciasAlimentariasPageRoutingModule,
  ],
  declarations: [PreferenciasAlimentariasPage],
})
export class PreferenciasAlimentariasPageModule {}
