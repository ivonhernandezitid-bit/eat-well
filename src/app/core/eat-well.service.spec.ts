import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { EatWellService } from './eat-well.service';
import { Recipe } from './models';
import { DailyMealPlan, mealPlanDate } from './daily-meal-plan';

describe('EatWellService meal option requests', () => {
  let service: EatWellService;
  let http: HttpTestingController;

  const catalogRecipe: Recipe = {
    id: '24',
    title: 'Avena de respaldo',
    description: 'Receta del catálogo',
    calories: 440,
    proteinGrams: 12,
    carbsGrams: 64,
    fatGrams: 15,
    ingredients: [],
    instructions: [],
    goals: [],
    mealTypes: ['breakfast'],
  };

  const generatedRecipe: Recipe = {
    ...catalogRecipe,
    id: 'personalized-1',
    title: 'Avena personalizada',
    calories: 0,
    estimatedNutrition: { calories: 0, proteinGrams: 5, carbsGrams: 20, fatGrams: 4 },
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('eat-well-active-user', JSON.stringify({
      id: 'test-user',
      name: 'Test',
      email: 'test@example.invalid',
      age: 30,
      gender: 'other',
      heightCm: 170,
      weightKg: 70,
      imc: 24,
      activityLevel: 'moderate',
      goal: 'maintain',
      createdAt: '',
      updatedAt: '',
    }));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EatWellService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    localStorage.clear();
  });

  it('uses the bounded generation wait and identifies a timeout fallback', fakeAsync(() => {
    let result: Recipe[] | undefined;
    void service.getMealOptions('breakfast', '2026-11-10').then(recipes => { result = recipes; });
    const options = http.expectOne(request => request.urlWithParams.includes('action=plan.options'));

    tick(389_999);
    expect(http.match(request => request.urlWithParams.includes('action=recipes.general')).length).toBe(0);
    tick(1);
    flushMicrotasks();
    const fallback = http.expectOne(request => request.urlWithParams.includes('action=recipes.general'));
    fallback.flush({ recipes: [catalogRecipe] });
    flushMicrotasks();

    expect(options.cancelled).toBeTrue();
    expect(result?.[0].suggestionContext).toEqual({
      source: 'catalog-fallback',
      cache: 'server',
      failureCode: 'timeout',
    });
  }));

  it('identifies provider 502 fallback and allows a subsequent generation retry', fakeAsync(() => {
    let fallbackResult: Recipe[] | undefined;
    void service.getMealOptions('breakfast', '2026-11-10').then(recipes => { fallbackResult = recipes; });
    http.expectOne(request => request.urlWithParams.includes('action=plan.options'))
      .flush({ error: 'Proveedor no disponible', code: 'provider_error' }, { status: 502, statusText: 'Bad Gateway' });
    flushMicrotasks();
    http.expectOne(request => request.urlWithParams.includes('action=recipes.general'))
      .flush({ recipes: [catalogRecipe] });
    flushMicrotasks();

    expect(fallbackResult?.[0].suggestionContext?.failureCode).toBe('provider_error');
    expect(fallbackResult?.[0].suggestionContext?.source).toBe('catalog-fallback');

    let retryResult: Recipe[] | undefined;
    void service.getMealOptions('breakfast', '2026-11-10').then(recipes => { retryResult = recipes; });
    http.expectOne(request => request.urlWithParams.includes('action=plan.options'))
      .flush({ recipes: [generatedRecipe], source: 'generated' });
    flushMicrotasks();
    expect(retryResult?.[0].id).toBe('personalized-1');
    expect(retryResult?.[0].suggestionContext?.source).toBe('generated');
  }));

  it('recovers an incomplete cached set only through an explicit retry', fakeAsync(() => {
    let fallbackResult: Recipe[] | undefined;
    void service.getMealOptions('breakfast', '2026-11-10').then(recipes => { fallbackResult = recipes; });
    http.expectOne(request => request.urlWithParams.includes('action=plan.options'))
      .flush({ error: 'Requiere revisión', code: 'options_cache_review' }, { status: 409, statusText: 'Conflict' });
    flushMicrotasks();
    http.expectOne(request => request.urlWithParams.includes('action=recipes.general'))
      .flush({ recipes: [catalogRecipe] });
    flushMicrotasks();

    expect(fallbackResult?.[0].suggestionContext?.failureCode).toBe('options_cache_review');

    let recovered: Recipe[] | undefined;
    void service.getMealOptions('breakfast', '2026-11-10', true).then(recipes => { recovered = recipes; });
    const recovery = http.expectOne(request => request.urlWithParams.includes('action=plan.options'));
    expect(recovery.request.urlWithParams).toContain('recoverCache=1');
    recovery.flush({ recipes: [generatedRecipe], source: 'generated' });
    flushMicrotasks();

    expect(recovered?.[0].id).toBe('personalized-1');
    expect(recovered?.[0].suggestionContext?.source).toBe('generated');
  }));

  it('retains the local-cache context for an offline catalog fallback', fakeAsync(() => {
    localStorage.setItem('eat-well-general-recipes-v2:test-user', JSON.stringify([catalogRecipe]));
    let result: Recipe[] | undefined;
    void service.getMealOptions('breakfast', '2026-11-10').then(recipes => { result = recipes; });
    http.expectOne(request => request.urlWithParams.includes('action=plan.options'))
      .flush({ error: 'Proveedor no disponible', code: 'provider_error' }, { status: 502, statusText: 'Bad Gateway' });
    flushMicrotasks();
    http.expectOne(request => request.urlWithParams.includes('action=recipes.general'))
      .flush('offline', { status: 0, statusText: 'Network error' });
    flushMicrotasks();

    expect(result?.[0].suggestionContext?.source).toBe('catalog-fallback');
    expect(result?.[0].suggestionContext?.cache).toBe('local');
  }));

  it('does not reuse the previous unversioned local catalog cache', fakeAsync(() => {
    localStorage.setItem('eat-well-general-recipes:test-user', JSON.stringify([catalogRecipe]));
    let failure: unknown;
    void service.getMealOptions('breakfast', '2026-11-10').catch(error => { failure = error; });
    http.expectOne(request => request.urlWithParams.includes('action=plan.options'))
      .flush({ error: 'Proveedor no disponible', code: 'provider_error' }, { status: 502, statusText: 'Bad Gateway' });
    flushMicrotasks();
    http.expectOne(request => request.urlWithParams.includes('action=recipes.general'))
      .flush('offline', { status: 0, statusText: 'Network error' });
    flushMicrotasks();

    expect(failure).toEqual(jasmine.any(Error));
  }));

  it('marks successful server-cache responses without turning them into fallbacks', fakeAsync(() => {
    let result: Recipe[] | undefined;
    void service.getMealOptions('breakfast', '2026-11-10').then(recipes => { result = recipes; });
    http.expectOne(request => request.urlWithParams.includes('action=plan.options'))
      .flush({ recipes: [generatedRecipe], source: 'cache' });
    flushMicrotasks();

    expect(result?.[0].suggestionContext).toEqual({ source: 'cache', cache: 'server' });
  }));

  it('sends estimated nutrition when saving a favorite without claiming server verification', fakeAsync(() => {
    let result: unknown;
    void service.addFavoriteRecipe({
      ...generatedRecipe,
      imageUrl: '',
      sourceUrl: '',
      detailsLoaded: true,
    }, 'plan').then(recipe => { result = recipe; });
    const request = http.expectOne(candidate => candidate.urlWithParams.includes('action=favorites.add'));
    expect(request.request.body.estimatedNutrition).toEqual(generatedRecipe.estimatedNutrition);
    expect(request.request.body.recipeId).toBe('personalized-1');
    request.flush({ recipe: { ...generatedRecipe, favoriteId: '5' } });
    flushMicrotasks();
    expect(result).toBeTruthy();
  }));

  it('exposes all alternatives when requested while preserving the default single option', fakeAsync(() => {
    const options = Array.from({ length: 4 }, (_, index) => ({ ...generatedRecipe, id: `personalized-${index + 1}` }));
    let alternatives: Recipe[] = [];
    void service.getMealOptions('breakfast', '2026-11-10', false, true).then(recipes => { alternatives = recipes; });
    http.expectOne(request => request.urlWithParams.includes('action=plan.options')).flush({ recipes: options, source: 'cache' });
    flushMicrotasks();
    expect(new Set(alternatives.map(recipe => recipe.id)).size).toBe(4);
    expect(alternatives.every(recipe => recipe.suggestionContext?.source === 'cache')).toBeTrue();
    let defaultOptions: Recipe[] = [];
    void service.getMealOptions('breakfast', '2026-11-10').then(recipes => { defaultOptions = recipes; });
    http.expectOne(request => request.urlWithParams.includes('action=plan.options')).flush({ recipes: options });
    flushMicrotasks();
    expect(defaultOptions.length).toBe(1);
  }));

  it('saves a replacement using plan.choose and reads the selected recipe back through plan.get', fakeAsync(() => {
    const plan: DailyMealPlan = {
      date: mealPlanDate(), choices: { breakfast: generatedRecipe }, meals: [], scheduleCustomized: false,
      summary: { totalMeals: 5, selectedMeals: 1, pendingMeals: 4, needsReviewMeals: 0, complete: false },
    };
    let selected: string | undefined;
    void service.chooseDailyMeal('breakfast', generatedRecipe.id, plan.date).then(result => { selected = result.choices.breakfast?.id; });
    const choose = http.expectOne(request => request.urlWithParams.includes('action=plan.choose'));
    expect(choose.request.body).toEqual({ userId: 'test-user', date: plan.date, mealType: 'breakfast', recipeId: generatedRecipe.id });
    choose.flush(plan);
    flushMicrotasks();
    expect(selected).toBe(generatedRecipe.id);
    void service.getDailyMealPlan(plan.date).then(result => { selected = result.choices.breakfast?.id; });
    http.expectOne(request => request.urlWithParams.includes('action=plan.get')).flush(plan);
    flushMicrotasks();
    expect(selected).toBe(generatedRecipe.id);
  }));

  it('persists per-serving consumption without duplicates, isolated by account and date', () => {
    const recipe = { ...generatedRecipe, calories: null, proteinGrams: null, carbsGrams: null, fatGrams: null };
    const first = service.markDailyMealConsumed(recipe, 'breakfast');
    expect(first.consumedMeals[0]).toEqual(jasmine.objectContaining({
      id: recipe.id, mealType: 'breakfast', calories: 0, protein: 5, carbohydrates: 20, fat: 4,
    }));
    expect(service.markDailyMealConsumed(recipe, 'breakfast').consumedMeals.length).toBe(1);
    const restoredService = TestBed.runInInjectionContext(() => new EatWellService());
    expect(restoredService.getDailyMealLog().consumedMeals).toEqual(first.consumedMeals);
    expect(restoredService.getDailyMealLog('2020-01-01').consumedMeals).toEqual([]);
    localStorage.setItem('eat-well-active-user', JSON.stringify({ id: 'different-user' }));
    const otherService = TestBed.runInInjectionContext(() => new EatWellService());
    expect(otherService.getDailyMealLog().consumedMeals).toEqual([]);
  });

  it('records catalog values with their original provenance instead of inventing a serving basis', () => {
    const log = service.markDailyMealConsumed(catalogRecipe, 'breakfast');
    expect(log.consumedMeals[0]).toEqual(jasmine.objectContaining({
      id: '24', calories: 440, protein: 12, carbohydrates: 64, fat: 15, nutritionSource: 'catalog',
    }));
    expect(service.getDailyMealLog().consumedMeals).toEqual(log.consumedMeals);
    expect(catalogRecipe.estimatedNutrition).toBeUndefined();
  });
});
