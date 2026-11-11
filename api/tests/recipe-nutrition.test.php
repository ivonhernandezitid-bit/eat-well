<?php
declare(strict_types=1);
// Regresión nutricional: verifica fuentes y bases por nutriente para impedir que cálculos incompletos borren datos registrados.
require_once __DIR__ . '/../recipe-nutrition.php';
function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$foods = [
    ['id' => 1, 'name' => 'AVENA CRUDA', 'reference_amount' => 100, 'reference_unit' => 'g', 'energy_kcal' => 400, 'protein_g' => 10, 'carbohydrates_g' => 60, 'total_fat_g' => 8, 'dietary_fiber_g' => 8],
    ['id' => 2, 'name' => 'LECHE', 'reference_amount' => 100, 'reference_unit' => 'ml', 'energy_kcal' => 100, 'protein_g' => 6, 'carbohydrates_g' => 10, 'total_fat_g' => 2, 'dietary_fiber_g' => 0],
];
function catalog(array $foods): array {
    $result = ['byId' => [], 'byName' => []];
    foreach ($foods as $food) { $result['byId'][$food['id']] = $food; $result['byName'][normalizeFoodName($food['name'])][] = $food; }
    return $result;
}
$data = [['foodId' => 1, 'name' => 'AVENA CRUDA', 'quantity' => 100, 'unit' => 'g'], ['foodId' => 2, 'name' => 'LECHE', 'quantity' => 200, 'unit' => 'ml']];
$recipe = ['servings' => 2, 'ingredientData' => $data, 'ingredients' => recipeIngredientLines($data)];
check($recipe['ingredients'][0] === '100 g de avena cruda', 'Display name is not lowercase.');
check(recipeIngredientLines([['name'=>'BRÓCOLI, CRUDO','quantity'=>50,'unit'=>'g']])[0] === '50 g de brócoli, crudo', 'Accents lost during lowercase formatting.');
$calculate = static fn($recipe, $foods) => calculateRecipeNutrition($recipe, catalog($foods));
$result = $calculate($recipe, $foods);
check($result['status'] === 'complete', 'Complete recipe rejected.');
$upperDisplay = [...$recipe, 'ingredients' => ['100 g de AVENA CRUDA', '200 ml de LECHE']];
check($calculate($upperDisplay, $foods)['perServing'] === $result['perServing'], 'Case formatting changed nutrient calculation.');
check($result['perServing'] === ['calories' => 300.0, 'proteinGrams' => 11.0, 'carbsGrams' => 40.0, 'fatGrams' => 6.0, 'fiberGrams' => 4.0], 'Portion calculation incorrect.');
$missingReference = $foods; $missingReference[0]['reference_amount'] = null;
check($calculate($recipe, $missingReference)['perServing']['calories'] === null, 'Reference amount assumed.');
$missingNutrient = $foods; $missingNutrient[0]['dietary_fiber_g'] = null;
$partial = $calculate($recipe, $missingNutrient);
check($partial['status'] === 'partial' && $partial['perServing']['fiberGrams'] === null && $partial['perServing']['calories'] === 300.0, 'Missing nutrient treated as zero.');
$wrongUnit = $recipe; $wrongUnit['ingredientData'][1]['unit'] = 'g'; $wrongUnit['ingredients'] = recipeIngredientLines($wrongUnit['ingredientData']);
check($calculate($wrongUnit, $foods)['perServing']['calories'] === null, 'Density invented.');
$badId = $recipe; $badId['ingredientData'][0]['foodId'] = 2;
check($calculate($badId, $foods)['status'] === 'unavailable', 'Mismatched food ID accepted.');
$mismatch = $recipe; $mismatch['ingredients'][0] = '50 g de AVENA CRUDA';
check($calculate($mismatch, $foods)['status'] === 'unavailable', 'Hidden quantities differ from display.');
$noQuantity = ['servings' => 1, 'ingredients' => ['Una taza de avena']];
check($calculate($noQuantity, $foods)['perServing']['calories'] === null, 'Household units assumed.');
$legacy = ['servings' => 1, 'ingredients' => ['50 g de AVENA CRUDA']];
check($calculate($legacy, $foods)['perServing']['calories'] === 200.0, 'Explicit legacy grams not supported.');
check($calculate(['ingredients' => $legacy['ingredients']], $foods)['status'] === 'unavailable', 'Portions assumed.');
$duplicate = $foods; $duplicate[] = [...$foods[0], 'id' => 3];
check($calculate($legacy, $duplicate)['status'] === 'unavailable', 'Ambiguous food name accepted.');
$zero = $foods; foreach (RECIPE_NUTRIENT_COLUMNS as $column) $zero[0][$column] = 0;
check($calculate($legacy, $zero)['perServing']['calories'] === 0.0, 'True zero lost.');
check($calculate($recipe, [])['status'] === 'unavailable', 'Empty catalog accepted.');
$negative = $recipe; $negative['ingredientData'][0]['quantity'] = -1;
check($calculate($negative, $foods)['status'] === 'unavailable', 'Negative quantity accepted.');

// Los valores registrados sobreviven al fallo de BAM, pero nunca se convierten en valores por porción.
$catalogNutrition = ['calories' => 440, 'proteinGrams' => 12, 'carbsGrams' => 64, 'fatGrams' => 15];
$catalogRecipe = ['registeredNutrition' => $catalogNutrition, 'ingredients' => ['Una taza de avena']];
$catalogResult = mergeRecipeNutrition($catalogRecipe, $calculate($catalogRecipe, []));
check($catalogResult['calories'] === 440.0 && $catalogResult['proteinGrams'] === 12.0, 'Catalog values were discarded.');
check($catalogResult['nutrition']['perServing']['calories'] === null, 'Unknown catalog portion basis was presented per serving.');
check($catalogResult['nutrition']['sources']['calories'] === 'catalog'
    && $catalogResult['nutrition']['portionBases']['calories'] === 'unknown', 'Catalog provenance or portion basis was lost.');

// BAM completo basta por sí mismo; la disponibilidad no depende de estimaciones de IA.
$bamOnly = mergeRecipeNutrition($recipe, $result);
check($bamOnly['nutrition']['status'] === 'complete'
    && $bamOnly['nutrition']['sources']['calories'] === 'BAM', 'Complete BAM nutrition requires an AI estimate.');

// Las estimaciones ya están expresadas por porción y no se dividen otra vez cuando hay varias porciones.
$multiServingEstimate = [
    'servings' => 2,
    'estimatedNutrition' => ['calories' => '150', 'proteinGrams' => 5, 'carbsGrams' => 20, 'fatGrams' => 4],
];
$estimatedResult = mergeRecipeNutrition($multiServingEstimate, $calculate(['ingredients' => []], []));
check($estimatedResult['nutrition']['perServing'] === ['calories' => 150.0, 'proteinGrams' => 5.0, 'carbsGrams' => 20.0, 'fatGrams' => 4.0, 'fiberGrams' => null], 'Per-serving estimates were altered for a multi-serving recipe.');
check($estimatedResult['nutrition']['sources']['calories'] === 'estimate', 'Estimate was mislabeled as BAM.');

// Cero es un dato válido; null, negativos, infinitos y campos parciales siguen siendo desconocidos.
$normalized = normalizeRecipeNutrientValues(['calories' => '0', 'proteinGrams' => null, 'carbsGrams' => -2, 'fatGrams' => INF]);
check($normalized === ['calories' => 0.0, 'proteinGrams' => null, 'carbsGrams' => null, 'fatGrams' => null], 'Nutrient values were not normalized safely.');
$partialSources = mergeRecipeNutrition(
    ['estimatedNutrition' => ['calories' => 0, 'proteinGrams' => -1]],
    $calculate(['ingredients' => []], []),
);
check($partialSources['nutrition']['values'] === ['calories' => 0.0, 'proteinGrams' => null, 'carbsGrams' => null, 'fatGrams' => null], 'Zero, invalid, and missing values were conflated.');

echo "BAM nutrition passed: portions, reference quantity, missing nutrients, units, food identity, legacy quantities and true zero.\n";
