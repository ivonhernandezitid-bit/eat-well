import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { EatWellService, Recipe } from '../core';

@Component({
  selector: 'app-plan-alimenticio',
  templateUrl: './plan-alimenticio.page.html',
  styleUrls: ['./plan-alimenticio.page.scss'],
  standalone: false
})
export class PlanAlimenticioPage implements OnInit {
  recipes: Recipe[] = [];
  searchTerm = '';

  constructor(
    private readonly eatWellService: EatWellService,
    private readonly alertController: AlertController,
  ) { }

  async ngOnInit(): Promise<void> {
    this.recipes = await this.eatWellService.getPersonalizedRecipes();
  }

  get filteredRecipes(): Recipe[] {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      return this.recipes;
    }

    return this.recipes.filter(recipe =>
      recipe.title.toLowerCase().includes(term) ||
      recipe.description.toLowerCase().includes(term) ||
      recipe.ingredients.some(ingredient => ingredient.toLowerCase().includes(term)),
    );
  }

  async scanFood(): Promise<void> {
    const result = await this.eatWellService.scanFoodImage({
      manualDescription: 'Food scanner',
    });
    const alert = await this.alertController.create({
      header: result.foodName,
      message: result.recommendation,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
