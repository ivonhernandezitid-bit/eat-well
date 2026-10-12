<?php
declare(strict_types=1);
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
echo "BAM nutrition passed: portions, reference quantity, missing nutrients, units, food identity, legacy quantities and true zero.\n";
