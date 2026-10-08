import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ActividadFrentePageRoutingModule } from './actividad-frente-routing.module';
import { ActividadFrentePage } from './actividad-frente.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ActividadFrentePageRoutingModule,
  ],
  declarations: [ActividadFrentePage],
})
export class ActividadFrentePageModule {}
