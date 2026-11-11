import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertController, IonicModule } from '@ionic/angular';
import { defineCustomElement as defineIonButton } from '@ionic/core/components/ion-button';
import { ActivatedRoute, Router } from '@angular/router';
import { EatWellService, Recipe } from '../core';
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

  it('closes on X, reopens, survives successful retry, then closes the detail again', async () => {
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
    let dismissed = modal.onDidDismiss();
    page.closeRecipeDetail();
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
    page.closeRecipeDetail();
    expect(() => fixture.detectChanges()).not.toThrow();
    await dismissed;
    expect(page.detailRecipe).toBeNull();
    fixture.destroy();
  });
});
