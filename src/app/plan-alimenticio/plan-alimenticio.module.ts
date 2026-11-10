import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PlanAlimenticioPageRoutingModule } from './plan-alimenticio-routing.module';
import { PlanAlimenticioPage } from './plan-alimenticio.page';
import { PlanRecipeSuggestionsPage } from './plan-recipe-suggestions.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PlanAlimenticioPageRoutingModule,
  ],
  declarations: [PlanAlimenticioPage, PlanRecipeSuggestionsPage],
})
export class PlanAlimenticioPageModule {}
