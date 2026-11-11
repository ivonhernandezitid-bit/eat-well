import { CommonModule } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { EatWellService, Recipe, UserProfile } from '../core';
import { mealPlanDate } from '../core/daily-meal-plan';
import { HomePage } from './home.page';

describe('HomePage meal consumption', () => {
  const user: UserProfile = {
    id: 'home-consumption-user', name: 'Test', email: 'test@example.invalid', age: 30,
    gender: 'other', heightCm: 170, weightKg: 70, imc: 24, activityLevel: 'moderate',
    goal: 'maintain', createdAt: '', updatedAt: '',
  };
  const recipe: Recipe = {
    id: 'personalized-1', title: 'Avena elegida', description: 'Desayuno',
    calories: 320, proteinGrams: 12, carbsGrams: 44, fatGrams: 8,
    estimatedNutrition: { calories: 320, proteinGrams: 12, carbsGrams: 44, fatGrams: 8 },
    ingredients: ['Avena'], instructions: ['Cocinar'], goals: [], mealTypes: ['breakfast', 'dinner'],
  };
  let service: EatWellService;

  beforeEach(async () => {
    const storage = new Map<string, string>([['eat-well-active-user', JSON.stringify(user)]]);
    spyOn(Storage.prototype, 'getItem').and.callFake(key => storage.get(key) ?? null);
    spyOn(Storage.prototype, 'setItem').and.callFake((key, value) => { storage.set(key, value); });
    await TestBed.configureTestingModule({
      declarations: [HomePage], imports: [CommonModule], schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: {} }],
    }).compileComponents();
    service = TestBed.inject(EatWellService);
    spyOn(service, 'getLifestyleGoals').and.rejectWith(new Error('No settings in this test'));
  });

  it('updates all four progress values on click and restores them in a new page', () => {
    const fixture = TestBed.createComponent(HomePage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.recipes = [recipe];
    page['mealChoices'] = { breakfast: recipe.id };
    page.dailyLog.waterGlasses = 3;
    page['saveDailyLog']();
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button.meal-confirm-button') as HTMLButtonElement;
    expect(button.textContent).toContain('Marcar como consumido');
    button.click();
    fixture.detectChanges();
    expect([page.caloriesConsumed, page.proteinConsumed, page.carbohydratesConsumed, page.fatConsumed]).toEqual([320, 12, 44, 8]);
    expect(fixture.nativeElement.querySelector('.calorie-ring').getAttribute('aria-valuenow')).toBe('320');
    expect(fixture.nativeElement.querySelector('.protein .macro-track span').style.width).toBe(`${page.proteinProgress}%`);
    expect(fixture.nativeElement.querySelector('.carbohydrate .macro-track span').style.width).toBe(`${page.carbohydrateProgress}%`);
    expect(fixture.nativeElement.querySelector('.fat .macro-track span').style.width).toBe(`${page.fatProgress}%`);
    expect(page.dailyLog.consumedMeals[0].mealType).toBe('breakfast');
    page.markMealConsumed(recipe, 'breakfast');
    expect(page.dailyLog.consumedMeals.length).toBe(1);
    expect(page.dailyLog.waterGlasses).toBe(3);
    fixture.destroy();

    const restored = TestBed.createComponent(HomePage);
    restored.detectChanges();
    expect(restored.componentInstance.dailyLog.date).toBe(mealPlanDate());
    expect(restored.componentInstance.caloriesConsumed).toBe(320);
    expect(restored.componentInstance.proteinConsumed).toBe(12);
    expect(restored.componentInstance.carbohydratesConsumed).toBe(44);
    expect(restored.componentInstance.fatConsumed).toBe(8);
    expect(restored.componentInstance.dailyLog.waterGlasses).toBe(3);
    restored.destroy();
  });

  it('keeps an assigned breakfast pending after its time instead of jumping to tomorrow', () => {
    const fixture = TestBed.createComponent(HomePage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.recipes = [recipe];
    page['mealChoices'] = { breakfast: recipe.id, dinner: recipe.id };
    page.mealSchedule = { breakfastTime: '08:00', morningSnackTime: '11:00', lunchTime: '14:00', afternoonSnackTime: '17:00', dinnerTime: '20:00' };
    page['mealClock'] = new Date(2026, 10, 10, 21, 0);
    spyOn<any>(page, 'refreshMealClock').and.stub();
    expect(page.nextMealCard?.mealType).toBe('breakfast');
    expect(page.mealIsTomorrow).toBeFalse();
    page.markMealConsumed(recipe, 'breakfast');
    expect(page.nextMealCard?.mealType).toBe('dinner');
    page.markMealConsumed(recipe, 'breakfast');
    expect(page.dailyLog.consumedMeals.length).toBe(1);
    page.markMealConsumed(recipe, 'dinner');
    expect(page.dailyLog.consumedMeals.length).toBe(2);
    expect(page.caloriesConsumed).toBe(640);
    expect(page.mealIsTomorrow).toBeTrue();
    fixture.destroy();
  });

  it('keeps the graph unchanged and reports a failure if consumption cannot be saved', () => {
    const fixture = TestBed.createComponent(HomePage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.recipes = [recipe];
    page['mealChoices'] = { breakfast: recipe.id };
    (Storage.prototype.setItem as jasmine.Spy).and.throwError('No se pudo guardar el consumo');
    page.markMealConsumed(recipe, 'breakfast');
    fixture.detectChanges();
    expect(page.caloriesConsumed).toBe(0);
    expect(page.nextMeal?.id).toBe(recipe.id);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('No se pudo guardar');
    fixture.destroy();
  });

  it('includes a selected catalog recipe in the graph and identifies its unconfirmed serving basis', () => {
    const fixture = TestBed.createComponent(HomePage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    const catalog: Recipe = { ...recipe, id: '24', estimatedNutrition: undefined, registeredNutrition: {
      calories: 320, proteinGrams: 12, carbsGrams: 44, fatGrams: 8,
    } };
    page.recipes = [catalog];
    page['mealChoices'] = { dinner: catalog.id };
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button.meal-confirm-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect([page.caloriesConsumed, page.proteinConsumed, page.carbohydratesConsumed, page.fatConsumed]).toEqual([320, 12, 44, 8]);
    expect(fixture.nativeElement.querySelector('[role="note"]').textContent).toContain('base por porción no está confirmada');
    fixture.destroy();
  });
});
