import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PlanAlimenticioPageRoutingModule } from './plan-alimenticio-routing.module';
import { PlanAlimenticioPage } from './plan-alimenticio.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PlanAlimenticioPageRoutingModule,
  ],
  declarations: [PlanAlimenticioPage],
})
export class PlanAlimenticioPageModule {}
