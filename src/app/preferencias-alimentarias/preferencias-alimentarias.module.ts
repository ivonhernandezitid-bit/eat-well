import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ProfileHeaderComponent } from '../shared/profile-header/profile-header.component';
import { PreferenciasAlimentariasPageRoutingModule } from './preferencias-alimentarias-routing.module';
import { PreferenciasAlimentariasPage } from './preferencias-alimentarias.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProfileHeaderComponent,
    PreferenciasAlimentariasPageRoutingModule,
  ],
  declarations: [PreferenciasAlimentariasPage],
})
export class PreferenciasAlimentariasPageModule {}
