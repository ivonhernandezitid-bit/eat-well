import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActionSheetController, AlertController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { EatWellService, FavoriteRecipe } from '../core';
import { PlanAlimenticioPage } from './plan-alimenticio.page';

describe('PlanAlimenticioPage favorite nutrition', () => {
  it('shows registered catalog values with their unconfirmed portion basis', async () => {
    await TestBed.configureTestingModule({
      declarations: [PlanAlimenticioPage],
      imports: [CommonModule],
      providers: [
        { provide: EatWellService, useValue: {} },
        { provide: ActivatedRoute, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: AlertController, useValue: {} },
        { provide: ActionSheetController, useValue: {} },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(PlanAlimenticioPage);
    const page = fixture.componentInstance;
    page.favoriteRecipes = [{
      id: '24',
      title: 'Avena del catálogo',
      description: 'Valores registrados',
      imageUrl: '',
      sourceUrl: '',
      detailsLoaded: true,
      ingredients: [],
      instructions: [],
      favoriteId: 'favorite-1',
      nutrition: {
        source: 'catalog',
        status: 'partial',
        values: { calories: 440, proteinGrams: 12, carbsGrams: 64, fatGrams: 15 },
        perServing: { calories: null, proteinGrams: null, carbsGrams: null, fatGrams: null, fiberGrams: null },
        sources: { calories: 'catalog', proteinGrams: 'catalog', carbsGrams: 'catalog', fatGrams: 'catalog' },
        portionBases: { calories: 'unknown', proteinGrams: 'unknown', carbsGrams: 'unknown', fatGrams: 'unknown' },
      },
      registeredNutrition: { calories: 440, proteinGrams: 12, carbsGrams: 64, fatGrams: 15 },
    } satisfies FavoriteRecipe];

    const favorite = page.favoriteMeals[0];
    expect(favorite.calories).toBe(440);
    expect(favorite.proteinGrams).toBe(12);
    expect(favorite.carbsGrams).toBe(64);
    expect(favorite.fatGrams).toBe(15);
    expect(favorite.nutritionPerServingConfirmed).toBeFalse();
    expect(favorite.nutritionSourceLabel).toContain('base de porción no está confirmada');
    fixture.destroy();
  });
});
