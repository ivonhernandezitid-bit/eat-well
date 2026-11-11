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

describe('PlanAlimenticioPage list and grid views', () => {
  let storedView: Map<string, string>;

  beforeEach(async () => {
    storedView = new Map<string, string>();
    spyOn(Storage.prototype, 'getItem').and.callFake(key => storedView.get(key) ?? null);
    spyOn(Storage.prototype, 'setItem').and.callFake((key, value) => { storedView.set(key, value); });
    spyOn(PlanAlimenticioPage.prototype, 'ngOnInit').and.stub();
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
    }).compileComponents();
  });

  it('toggles all plan collections, preserves actions and remembers the selected layout', async () => {
    const fixture = TestBed.createComponent(PlanAlimenticioPage);
    const page = fixture.componentInstance;
    page.favoriteRecipes = [{
      id: 'favorite-recipe', favoriteId: 'favorite-1', title: 'Avena favorita', description: 'Desayuno',
      imageUrl: '', sourceUrl: '', detailsLoaded: true, ingredients: ['Avena'], instructions: ['Cocinar'],
    }];
    page.scanHistory = [{
      id: 'scan-1', detectedFood: 'Avena', detectedIngredients: ['Avena'], estimatedCalories: 440,
      aiRecommendation: '', createdAt: '2026-11-10T12:00:00',
    }];
    const savedFavorites = page.favoriteRecipes;
    const savedHistory = page.scanHistory;
    const savedDate = page.selectedDate;
    const openMeal = spyOn(page, 'abrirSugerencias').and.resolveTo();
    const openRecipe = spyOn(page, 'openRecipe').and.resolveTo();
    const openHistory = spyOn(page, 'openScanHistoryItem').and.resolveTo();
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector('.icon-toggle-btn') as HTMLButtonElement;
    expect(page.viewMode).toBe('list');
    expect(toggle.getAttribute('aria-label')).toBe('Cambiar a vista de cuadrícula');
    toggle.click();
    fixture.detectChanges();
    expect(page.viewMode).toBe('grid');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect((toggle.querySelector('ion-icon') as HTMLElement & { name: string }).name).toBe('list-outline');
    const meals = root.querySelector('.planned-meal-list') as HTMLElement;
    for (const width of ['620px', '320px']) {
      meals.style.width = width;
      expect(getComputedStyle(meals).gridTemplateColumns.split(' ').length).toBe(2);
      const cards = meals.querySelectorAll<HTMLButtonElement>('.planned-meal-card');
      expect(cards.length).toBe(5);
      const first = cards[0].getBoundingClientRect();
      const second = cards[1].getBoundingClientRect();
      expect(first.top).toBe(second.top);
      expect(second.left).toBeGreaterThan(first.left);
      expect(cards[0].scrollWidth).toBeLessThanOrEqual(cards[0].clientWidth);
    }
    meals.querySelectorAll<HTMLButtonElement>('.planned-meal-card').forEach(card => card.click());
    expect(openMeal.calls.allArgs()).toEqual(page.planMealSlots.map(meal => [meal.type, meal.estimatedCalories]));
    meals.style.removeProperty('width');

    const filters = root.querySelectorAll<HTMLButtonElement>('.filter-pill');
    filters[1].click();
    fixture.detectChanges();
    expect(root.querySelector('.favorites-section .meal-list')?.classList.contains('grid-mode')).toBeTrue();
    (root.querySelector('.favorites-section .meal-open') as HTMLButtonElement).click();
    expect(openRecipe.calls.mostRecent().args[0].id).toBe('favorite-recipe');
    filters[2].click();
    fixture.detectChanges();
    expect(root.querySelector('.history-list')?.classList.contains('grid-mode')).toBeTrue();
    (root.querySelector('.history-card') as HTMLElement).click();
    expect(openHistory).toHaveBeenCalledWith(savedHistory[0]);

    const restoredGrid = TestBed.createComponent(PlanAlimenticioPage);
    expect(restoredGrid.componentInstance.viewMode).toBe('grid');
    restoredGrid.destroy();
    toggle.click();
    fixture.detectChanges();
    expect(page.viewMode).toBe('list');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect((toggle.querySelector('ion-icon') as HTMLElement & { name: string }).name).toBe('grid-outline');
    expect(root.querySelector('.history-list.grid-mode')).toBeNull();
    filters[0].click();
    fixture.detectChanges();
    expect(root.querySelector('.planned-meal-list.grid-mode')).toBeNull();
    expect(root.querySelectorAll('.planned-meal-card').length).toBe(5);
    const restoredList = TestBed.createComponent(PlanAlimenticioPage);
    expect(restoredList.componentInstance.viewMode).toBe('list');
    restoredList.destroy();
    expect(page.favoriteRecipes).toBe(savedFavorites);
    expect(page.scanHistory).toBe(savedHistory);
    expect(page.selectedDate).toBe(savedDate);
    fixture.destroy();
  });

  it('still changes layout if browser storage is unavailable', () => {
    (Storage.prototype.getItem as jasmine.Spy).and.throwError('Storage blocked');
    (Storage.prototype.setItem as jasmine.Spy).and.throwError('Storage blocked');
    const fixture = TestBed.createComponent(PlanAlimenticioPage);
    const page = fixture.componentInstance;
    expect(page.viewMode).toBe('list');
    expect(() => page.toggleViewMode()).not.toThrow();
    expect(page.viewMode).toBe('grid');
    expect(() => page.toggleViewMode()).not.toThrow();
    expect(page.viewMode).toBe('list');
    fixture.destroy();
  });
});
