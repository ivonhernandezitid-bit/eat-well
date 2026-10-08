import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ActividadEspaldaPageRoutingModule } from './actividad-espalda-routing.module';
import { ActividadEspaldaPage } from './actividad-espalda.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ActividadEspaldaPageRoutingModule,
  ],
  declarations: [ActividadEspaldaPage],
})
export class ActividadEspaldaPageModule {}
