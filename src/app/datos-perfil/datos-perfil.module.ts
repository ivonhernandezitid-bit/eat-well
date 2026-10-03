import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ProfileHeaderComponent } from '../shared/profile-header/profile-header.component';
import { DatosPerfilPageRoutingModule } from './datos-perfil-routing.module';
import { DatosPerfilPage } from './datos-perfil.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProfileHeaderComponent,
    DatosPerfilPageRoutingModule,
  ],
  declarations: [DatosPerfilPage],
})
export class DatosPerfilPageModule {}
