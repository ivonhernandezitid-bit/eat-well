import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertController, IonicModule } from '@ionic/angular';
import { defineCustomElement as defineIonButton } from '@ionic/core/components/ion-button';
import { ActivatedRoute, Router } from '@angular/router';
import { EatWellService, Recipe, UserProfile } from '../core';
import { DailyMealPlan } from '../core/daily-meal-plan';
import { PlanRecipeSuggestionsPage } from './plan-recipe-suggestions.page';

// Inicializa el botón real antes de que Angular actualice sus atributos ARIA en la prueba.
defineIonButton();

describe('PlanRecipeSuggestionsPage recipe detail', () => {
  const fallbackRecipe: Recipe = {
    id: '24',
    title: 'Avena del catálogo',
    description: 'Respaldo',
    calories: 440,
    proteinGrams: 12,
    carbsGrams: 64,
    fatGrams: 15,
    ingredients: ['Avena'],
    instructions: ['Cocinar'],
    goals: [],
    mealTypes: ['breakfast'],
    suggestionContext: { source: 'catalog-fallback', cache: 'server', failureCode: 'options_cache_review' },
  };
  const generatedRecipe: Recipe = {
    ...fallbackRecipe,
    id: 'personalized-1',
    title: 'Avena personalizada',
    estimatedNutrition: { calories: 320, proteinGrams: 12, carbsGrams: 44, fatGrams: 8 },
    suggestionContext: { source: 'generated', cache: 'none' },
  };
  const emptyPlan: DailyMealPlan = {
    date: '2026-11-10',
    choices: {},
    meals: [],
    scheduleCustomized: false,
    summary: { totalMeals: 5, selectedMeals: 0, pendingMeals: 5, needsReviewMeals: 0, complete: false },
  };

  it('centers the title, returns to recipes, reopens and survives successful retry', async () => {
    const eatWellService = jasmine.createSpyObj<EatWellService>(
      'EatWellService',
      ['getDailyMealPlan', 'getFavoriteRecipes', 'getMealOptions', 'getActiveUser'],
    );
    eatWellService.getActiveUser.and.returnValue(null);
    eatWellService.getDailyMealPlan.and.returnValue(Promise.resolve(emptyPlan));
    eatWellService.getFavoriteRecipes.and.returnValue(Promise.resolve([]));
    eatWellService.getMealOptions.and.returnValues(
      Promise.resolve([fallbackRecipe]),
      Promise.resolve([generatedRecipe]),
    );

    await TestBed.configureTestingModule({
      declarations: [PlanRecipeSuggestionsPage],
      imports: [CommonModule, IonicModule.forRoot({ animated: false })],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (name: string) => name === 'mealType' ? 'breakfast' : '320' },
              queryParamMap: { get: () => '2026-11-10' },
            },
          },
        },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigateByUrl']) },
        { provide: EatWellService, useValue: eatWellService },
        { provide: AlertController, useValue: jasmine.createSpyObj<AlertController>('AlertController', ['create']) },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(PlanRecipeSuggestionsPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector('ion-modal') as HTMLIonModalElement;
    const whenPresented = () => new Promise<Event>(resolve => modal.addEventListener('ionModalDidPresent', resolve, { once: true }));
    await modal.componentOnReady();
    await Promise.all(Array.from(fixture.nativeElement.querySelectorAll('ion-button') as NodeListOf<HTMLIonButtonElement>)
      .map(button => button.componentOnReady?.()));

    const cardButton = fixture.nativeElement.querySelector('.recipe-card-open') as HTMLButtonElement;
    expect(cardButton).toBeTruthy();
    expect(cardButton.getAttribute('aria-label')).toContain(fallbackRecipe.title);
    expect(fixture.nativeElement.querySelector('.recipe-suggestion-view')).toBeNull();
    expect(fixture.nativeElement.querySelector('.recipe-suggestions-retry')).toBeNull();
    let presented = whenPresented();
    cardButton.click();
    expect(page.detailRecipe?.id).toBe(fallbackRecipe.id);
    fixture.detectChanges();
    await presented;
    expect(modal.querySelector('.recipe-detail-heading h1')?.textContent).toBe(fallbackRecipe.title);
    const heading = modal.querySelector('.recipe-detail-heading') as HTMLElement;
    const title = heading.querySelector('h1') as HTMLElement;
    const back = heading.querySelector('.recipe-detail-back') as HTMLButtonElement;
    expect(back.textContent?.trim()).toBe('Recetas');
    expect(back.querySelector('ion-icon')?.getAttribute('name')).toBe('chevron-back-outline');
    expect(getComputedStyle(title).textAlign).toBe('center');
    for (const width of ['620px', '320px']) {
      heading.style.width = width;
      const titleBox = title.getBoundingClientRect();
      const headingBox = heading.getBoundingClientRect();
      expect(Math.abs((titleBox.left + titleBox.right) / 2 - (headingBox.left + headingBox.right) / 2)).toBeLessThan(1);
      expect(back.getBoundingClientRect().right).toBeLessThanOrEqual(titleBox.left);
    }
    heading.style.removeProperty('width');
    expect(modal.querySelectorAll('.recipe-detail-actions ion-button').length).toBe(1);
    expect(modal.textContent).not.toContain('Obtener opciones seleccionables');
    let dismissed = modal.onDidDismiss();
    back.click();
    expect(() => fixture.detectChanges()).not.toThrow();
    await dismissed;
    expect(page.detailRecipe).toBeNull();

    presented = whenPresented();
    page.openRecipeDetail(fallbackRecipe);
    fixture.detectChanges();
    await presented;
    dismissed = modal.onDidDismiss();
    await page.retryGeneration();
    expect(page.detailRecipe).toBeNull();
    expect(page.recipes[0].id).toBe('personalized-1');
    expect(() => fixture.detectChanges()).not.toThrow();
    await dismissed;

    presented = whenPresented();
    page.openRecipeDetail(generatedRecipe);
    fixture.detectChanges();
    await presented;
    dismissed = modal.onDidDismiss();
    (modal.querySelector('.recipe-detail-back') as HTMLButtonElement).click();
    expect(() => fixture.detectChanges()).not.toThrow();
    await dismissed;
    expect(page.detailRecipe).toBeNull();
    fixture.destroy();
  });

  it('searches substitute cards and restores the selected ingredient after recreating the page', async () => {
    const savedProgress = new Map<string, string>();
    spyOn(Storage.prototype, 'getItem').and.callFake(key => savedProgress.get(key) ?? null);
    spyOn(Storage.prototype, 'setItem').and.callFake((key, value) => savedProgress.set(key, value));
    const eatWellService = jasmine.createSpyObj<EatWellService>('EatWellService', ['getActiveUser']);
    eatWellService.getActiveUser.and.returnValue({ id: 'substitution-test-user' } as UserProfile);
    spyOn(PlanRecipeSuggestionsPage.prototype, 'ngOnInit').and.stub();
    await TestBed.configureTestingModule({
      declarations: [PlanRecipeSuggestionsPage],
      imports: [CommonModule, IonicModule.forRoot({ animated: false })],
      providers: [
        { provide: ActivatedRoute, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: EatWellService, useValue: eatWellService },
        { provide: AlertController, useValue: {} },
      ],
    }).compileComponents();

    const recipe: Recipe = {
      ...fallbackRecipe,
      ingredients: ['1/2 taza de hojuelas de avena entera', '1 taza de leche', 'Sal'],
    };
    const fixture = TestBed.createComponent(PlanRecipeSuggestionsPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    const detail = fixture.nativeElement.querySelector('.suggested-recipe-detail-modal') as HTMLIonModalElement;
    const sheet = fixture.nativeElement.querySelector('.ingredient-substitution-sheet') as HTMLIonModalElement;
    await Promise.all([detail.componentOnReady(), sheet.componentOnReady()]);
    const whenPresented = (modal: HTMLIonModalElement) => new Promise<Event>(resolve =>
      modal.addEventListener('ionModalDidPresent', resolve, { once: true }));

    let presented = whenPresented(detail);
    page.openRecipeDetail(recipe);
    fixture.detectChanges();
    await presented;
    page.toggleIngredient(0);
    page.toggleIngredient(1);
    presented = whenPresented(sheet);
    (detail.querySelector('.substitute-ingredient-button') as HTMLIonButtonElement).click();
    fixture.detectChanges();
    await presented;
    expect(sheet.querySelector('h2')?.textContent).toContain(recipe.ingredients[0]);
    const search = sheet.querySelector('input[type="search"]') as HTMLInputElement;
    expect(search.placeholder).toBe('Buscar sustituto de ingrediente…');
    expect(sheet.querySelectorAll('.ingredient-substitution-card').length).toBe(2);
    const grid = sheet.querySelector('.ingredient-substitution-options') as HTMLElement;
    expect(getComputedStyle(grid).gridTemplateColumns.split(' ').length).toBe(2);

    search.value = '  QUÍNOA  ';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(sheet.querySelectorAll('.ingredient-substitution-card').length).toBe(1);
    expect(sheet.querySelector('h3')?.textContent).toBe('Quinoa');
    search.value = 'sin coincidencias';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(sheet.querySelector('[role="status"]')?.textContent).toContain('No hay sustitutos');
    search.value = 'quinoa';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const sheetDismissed = sheet.onDidDismiss();
    (sheet.querySelector('.select-substitute-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await sheetDismissed;
    expect(page.activeIngredients).toEqual(['1/2 taza de Quinoa', '1 taza de leche', 'Sal']);
    expect(page.checkedIngredients.has(0)).toBeFalse();
    expect(page.checkedIngredients.has(1)).toBeTrue();
    expect(recipe.ingredients[0]).toBe('1/2 taza de hojuelas de avena entera');
    const detailDismissed = detail.onDidDismiss();
    (detail.querySelector('.recipe-detail-back') as HTMLButtonElement).click();
    fixture.detectChanges();
    await detailDismissed;
    fixture.destroy();

    const reopenedFixture = TestBed.createComponent(PlanRecipeSuggestionsPage);
    const reopened = reopenedFixture.componentInstance;
    reopened.openRecipeDetail(recipe);
    expect(reopened.activeIngredients[0]).toBe('1/2 taza de Quinoa');
    expect(reopened.checkedIngredients.has(1)).toBeTrue();
    reopened.openSubstitution(1);
    expect(reopened.substituteSearchTerm).toBe('');
    expect(reopened.substituteGroupLabel).toBe('Lácteos y alternativas');
    reopened.openSubstitution(2);
    expect(reopened.substituteOptions).toEqual([]);
    reopened.replaceIngredient('No disponible');
    expect(reopened.activeIngredients[2]).toBe('Sal');
    reopenedFixture.destroy();
  });

  it('pins the saved selection, replaces it persistently and keeps it when alternatives fail', async () => {
    const alternative: Recipe = { ...generatedRecipe, id: 'personalized-2', title: 'Otra receta' };
    let savedPlan: DailyMealPlan = { ...emptyPlan, choices: { breakfast: generatedRecipe } };
    const service = jasmine.createSpyObj<EatWellService>('EatWellService', [
      'getDailyMealPlan', 'getFavoriteRecipes', 'getMealOptions', 'getActiveUser', 'getDailyMealLog', 'chooseDailyMeal',
    ]);
    service.getActiveUser.and.returnValue({ id: 'selection-test-user' } as UserProfile);
    service.getDailyMealLog.and.returnValue({
      date: emptyPlan.date, consumedMeals: [{ id: generatedRecipe.id, mealType: 'breakfast', calories: 320, protein: 12, carbohydrates: 44, fat: 8 }],
      waterGlasses: 0, exerciseMinutes: 0, steps: 0,
    });
    service.getDailyMealPlan.and.callFake(async () => savedPlan);
    service.getFavoriteRecipes.and.resolveTo([]);
    service.getMealOptions.and.resolveTo([alternative, generatedRecipe, alternative]);
    service.chooseDailyMeal.and.callFake(async (type, id) => {
      savedPlan = { ...savedPlan, choices: { [type]: [generatedRecipe, alternative].find(recipe => recipe.id === id)! } };
      return savedPlan;
    });
    const alert = jasmine.createSpyObj('alert', ['present']);
    alert.present.and.resolveTo();
    const alertController = jasmine.createSpyObj<AlertController>('AlertController', ['create']);
    alertController.create.and.resolveTo(alert);
    await TestBed.configureTestingModule({
      declarations: [PlanRecipeSuggestionsPage], imports: [CommonModule, IonicModule.forRoot({ animated: false })],
      providers: [
        { provide: EatWellService, useValue: service }, { provide: AlertController, useValue: alertController },
        { provide: Router, useValue: {} },
        { provide: ActivatedRoute, useValue: { snapshot: {
          paramMap: { get: (name: string) => name === 'mealType' ? 'breakfast' : '450' },
          queryParamMap: { get: () => emptyPlan.date },
        } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PlanRecipeSuggestionsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    expect(page.recipes.map(recipe => recipe.id)).toEqual([generatedRecipe.id, alternative.id]);
    const selectedCard = root.querySelector('.recipe-suggestion-card') as HTMLElement;
    expect(selectedCard.classList.contains('recipe-current-selection')).toBeTrue();
    expect(selectedCard.querySelector('.recipe-current-badge')?.textContent).toContain('RECETA ACTUALMENTE SELECCIONADA');
    expect(selectedCard.querySelector('.recipe-current-status')?.textContent).toBe('Consumido');
    expect(root.querySelector('.recipe-change-button')).toBeNull();
    const modal = root.querySelector('.suggested-recipe-detail-modal') as HTMLIonModalElement;
    await modal.componentOnReady();
    const presented = new Promise<Event>(resolve => modal.addEventListener('ionModalDidPresent', resolve, { once: true }));
    (root.querySelectorAll('.recipe-card-open')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    await presented;
    const change = modal.querySelector('.recipe-detail-actions .recipe-suggestion-select') as HTMLIonButtonElement;
    expect(change.textContent).toContain('CAMBIAR A ESTA RECETA');
    expect(change.disabled).toBeFalse();
    change.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(service.chooseDailyMeal).toHaveBeenCalledWith('breakfast', alternative.id, emptyPlan.date);
    expect(page.recipes[0].id).toBe(alternative.id);
    expect(root.querySelector('.recipe-current-status')?.textContent).toBe('Pendiente');
    expect(change.textContent).toContain('RECETA ACTUALMENTE SELECCIONADA');
    const dismissed = modal.onDidDismiss();
    page.closeRecipeDetail();
    fixture.detectChanges();
    await dismissed;

    const restored = TestBed.createComponent(PlanRecipeSuggestionsPage);
    restored.detectChanges();
    await restored.whenStable();
    restored.detectChanges();
    expect(restored.componentInstance.recipes.map(recipe => recipe.id)).toEqual([alternative.id, generatedRecipe.id]);
    restored.destroy();

    service.chooseDailyMeal.and.rejectWith(new Error('No se pudo guardar'));
    await page.selectRecipe(generatedRecipe);
    expect(page.selectedRecipeId).toBe(alternative.id);
    expect(page.recipes[0].id).toBe(alternative.id);
    expect(page.error).toBe('No se pudo guardar');
    service.getMealOptions.and.rejectWith(new Error('No hay conexión'));
    await page.loadSuggestions();
    expect(page.recipes.map(recipe => recipe.id)).toEqual([alternative.id]);
    expect(page.error).toBe('No hay conexión');
    fixture.destroy();
  });

  it('selects a catalog recipe only from its detail, independently of the ingredient checklist', async () => {
    let savedPlan = { ...emptyPlan };
    const service = jasmine.createSpyObj<EatWellService>('EatWellService', [
      'getDailyMealPlan', 'getFavoriteRecipes', 'getMealOptions', 'getActiveUser', 'chooseDailyMeal',
    ]);
    service.getActiveUser.and.returnValue(null);
    service.getDailyMealPlan.and.callFake(async () => savedPlan);
    service.getFavoriteRecipes.and.resolveTo([]);
    service.getMealOptions.and.resolveTo([fallbackRecipe]);
    service.chooseDailyMeal.and.callFake(async () => {
      savedPlan = { ...savedPlan, choices: { breakfast: { ...fallbackRecipe, suggestionContext: undefined } } };
      return savedPlan;
    });
    await TestBed.configureTestingModule({
      declarations: [PlanRecipeSuggestionsPage], imports: [CommonModule, IonicModule.forRoot({ animated: false })],
      providers: [
        { provide: EatWellService, useValue: service }, { provide: AlertController, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: ActivatedRoute, useValue: { snapshot: {
          paramMap: { get: (name: string) => name === 'mealType' ? 'breakfast' : '450' },
          queryParamMap: { get: () => emptyPlan.date },
        } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PlanRecipeSuggestionsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.recipe-suggestion-card .recipe-suggestion-select')).toBeNull();
    const modal = root.querySelector('.suggested-recipe-detail-modal') as HTMLIonModalElement;
    await modal.componentOnReady();
    const presented = new Promise<Event>(resolve => modal.addEventListener('ionModalDidPresent', resolve, { once: true }));
    (root.querySelector('.recipe-card-open') as HTMLButtonElement).click();
    fixture.detectChanges();
    await presented;
    const select = modal.querySelector('.recipe-detail-actions .recipe-suggestion-select') as HTMLIonButtonElement;
    expect(select.disabled).toBeFalse();
    expect(page.checkedIngredients.size).toBe(0);
    (modal.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(page.checkedIngredients.size).toBe(1);
    expect(select.disabled).toBeFalse();
    select.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(service.chooseDailyMeal).toHaveBeenCalledWith('breakfast', '24', emptyPlan.date);
    expect(select.textContent).toContain('RECETA ACTUALMENTE SELECCIONADA');
    expect(page.selectedRecipeId).toBe('24');
    const dismissed = modal.onDidDismiss();
    page.closeRecipeDetail();
    fixture.detectChanges();
    await dismissed;
    fixture.destroy();
    const restored = TestBed.createComponent(PlanRecipeSuggestionsPage);
    restored.detectChanges();
    await restored.whenStable();
    restored.detectChanges();
    expect(restored.componentInstance.selectedRecipeId).toBe('24');
    expect((restored.nativeElement as HTMLElement).querySelector('.recipe-current-badge')).toBeTruthy();
    restored.destroy();
  });
});
