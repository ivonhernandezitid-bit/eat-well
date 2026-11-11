import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { EatWellService, Recipe } from '../core';
import { DailyMealPlan } from '../core/daily-meal-plan';
import { PlanRecipeSuggestionsPage } from './plan-recipe-suggestions.page';

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
      ['getDailyMealPlan', 'getFavoriteRecipes', 'getMealOptions'],
    );
    eatWellService.getDailyMealPlan.and.returnValue(Promise.resolve(emptyPlan));
    eatWellService.getFavoriteRecipes.and.returnValue(Promise.resolve([]));
    eatWellService.getMealOptions.and.returnValues(
      Promise.resolve([fallbackRecipe]),
      Promise.resolve([generatedRecipe]),
    );

    await TestBed.configureTestingModule({
      declarations: [PlanRecipeSuggestionsPage],
      imports: [CommonModule],
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

    const actionButton = fixture.nativeElement.querySelector('.recipe-suggestion-action') as HTMLElement;
    const referenceButton = fixture.nativeElement.querySelector('.recipe-suggestion-view') as HTMLElement;
    expect(actionButton).toBeTruthy();
    expect(referenceButton).toBeTruthy();
    for (const property of ['--background', '--color', '--border-color', '--border-radius', '--box-shadow']) {
      expect(getComputedStyle(actionButton).getPropertyValue(property))
        .withContext(`${property}: ${referenceButton.outerHTML}`)
        .toBe(getComputedStyle(referenceButton).getPropertyValue(property));
    }
    expect(getComputedStyle(actionButton).fontWeight).toBe(getComputedStyle(referenceButton).fontWeight);
    expect(getComputedStyle(actionButton).minHeight).toBe(getComputedStyle(referenceButton).minHeight);
    for (const width of [360, 1280]) {
      fixture.nativeElement.style.width = `${width}px`;
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll('.recipe-suggestion-action, .recipe-suggestion-view') as NodeListOf<HTMLElement>;
      for (const button of Array.from(buttons)) {
        expect(button.getBoundingClientRect().right).withContext(`${width}px viewport`).toBeLessThanOrEqual(width + 1);
      }
    }

    page.openRecipeDetail(fallbackRecipe);
    fixture.detectChanges();
    page.closeRecipeDetail();
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(page.detailRecipe).toBeNull();

    page.openRecipeDetail(fallbackRecipe);
    fixture.detectChanges();
    await page.retryGeneration();
    expect(page.detailRecipe).toBeNull();
    expect(page.recipes[0].id).toBe('personalized-1');
    expect(() => fixture.detectChanges()).not.toThrow();

    page.openRecipeDetail(generatedRecipe);
    fixture.detectChanges();
    page.closeRecipeDetail();
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(page.detailRecipe).toBeNull();
    fixture.destroy();
  });
});
