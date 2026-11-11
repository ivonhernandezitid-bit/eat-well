import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActionSheetController, AlertController, IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { EatWellService, FavoriteRecipe } from '../core';
import { PlanAlimenticioPage } from './plan-alimenticio.page';

describe('PlanAlimenticioPage favorite nutrition', () => {
  it('shows registered catalog values with their unconfirmed portion basis', async () => {
    await TestBed.configureTestingModule({
      declarations: [PlanAlimenticioPage],
      imports: [CommonModule, FormsModule, IonicModule.forRoot({ animated: false })],
      providers: [
        { provide: EatWellService, useValue: {} },
        { provide: ActivatedRoute, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: AlertController, useValue: {} },
        { provide: ActionSheetController, useValue: {} },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    spyOn(PlanAlimenticioPage.prototype, 'ngOnInit').and.stub();
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

    // El cambio de pestaña solo altera la vista; conserva favoritos y la fecha del plan.
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const filters = root.querySelectorAll<HTMLButtonElement>('.filter-pill');
    const savedFavorites = page.favoriteRecipes;
    const savedDate = page.selectedDate;
    expect(root.querySelectorAll('.planned-meal-card').length).toBe(5);

    filters[1].click();
    fixture.detectChanges();
    expect(root.querySelector('.screen-title')).toBeNull();
    expect(root.querySelector('.plan-day-selector')).toBeNull();
    expect(root.querySelector('.planned-meals-section')).toBeNull();
    expect(root.querySelector('.plan-warning-stack')).toBeNull();
    expect(root.querySelector('.favorites-section')?.textContent).toContain(favorite.title);
    expect(root.querySelector('.topbar')).toBeTruthy();

    filters[2].click();
    fixture.detectChanges();
    expect(root.querySelector('.history-section')).toBeTruthy();
    expect(root.querySelector('.planned-meals-section')).toBeTruthy();

    filters[0].click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.planned-meal-card').length).toBe(5);
    expect(root.querySelector('.favorites-section')).toBeNull();
    expect(page.favoriteRecipes).toBe(savedFavorites);
    expect(page.selectedDate).toBe(savedDate);
    fixture.destroy();
  });
});
