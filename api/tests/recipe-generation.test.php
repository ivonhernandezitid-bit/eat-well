<?php
declare(strict_types=1);
require_once __DIR__ . '/../recipe-generation.php';
function cleanStringList(mixed $value, int $limit): array {
    return is_array($value) ? array_values(array_filter(array_slice($value, 0, $limit), static fn($item) => is_string($item) && trim($item) !== '')) : [];
}
function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$recipe = ['instructions' => ['Cocina la avena.', 'Sirve.'], 'mealTypes' => ['breakfast', 'breakfast', 'invalid'], 'servings' => 2, 'preparationMinutes' => 15, 'validationNotes' => ['Ingrediente pendiente de validacion.']];
$saved = readRecipeInstructions(encodeRecipeInstructions($recipe));
check($saved['instructions'] === $recipe['instructions'], 'Steps changed.');
check($saved['mealTypes'] === ['breakfast'] && $saved['servings'] === 2 && $saved['preparationMinutes'] === 15, 'Metadata lost.');
check($saved['validationNotes'] === $recipe['validationNotes'], 'Validation notes lost.');
check(readRecipeInstructions('["Paso anterior"]')['instructions'] === ['Paso anterior'], 'Legacy steps broken.');
check(readRecipeInstructions('invalid')['instructions'] === [], 'Invalid JSON accepted.');
check(recipeMetadata(['mealTypes' => 'bad', 'servings' => -1, 'preparationMinutes' => 1.2])['mealTypes'] === [], 'Invalid categories accepted.');
check(recipeMetadata(['servings' => -1])['servings'] === null, 'Invalid portions accepted.');
$prompt = recipeGenerationPrompt(['name' => 'PRIVATE', 'goal' => 'maintain', 'age' => 25], ['allergies' => ['cacahuate']], []);
check(!str_contains($prompt, 'PRIVATE') && str_contains($prompt, 'cacahuate'), 'Prompt profile filtering failed.');
check(str_contains($prompt, 'no a la base completa') && str_contains($prompt, 'mealTypes'), 'Prompt constraints missing.');
check(recipeGenerationSchema()['properties']['mealTypes']['items']['enum'] === RECIPE_MEAL_TYPES, 'Schema categories mismatch.');
check(!isset(recipeGenerationSchema()['properties']['ingredientData']['maxItems']), 'Nested array constraints made provider schema too complex.');
check(!isset(recipeGenerationSchema()['properties']['servings']['maximum']), 'Numeric bounds should be validated in PHP.');
$profile = ['age' => 25, 'goal' => 'maintain', 'imc' => 22, 'weight_kg' => 60];
$preferences = ['allergies' => ['cacahuate'], 'completed' => true];
$hashes = compatibleRecipeHashes($profile, $preferences);
check($hashes[1] === recipePreferenceHash($profile, $preferences, 'eatwell-meals-bam-v1'), 'Previous format cache not retained.');
check($hashes[0] !== $hashes[1], 'Versions mixed.');
check(compatibleRecipeHashes([...$profile, 'weight_kg' => 80], $preferences)[1] !== $hashes[1], 'Changed profile used old recipes.');
check(compatibleRecipeHashes($profile, [...$preferences, 'allergies' => ['leche']])[1] !== $hashes[1], 'Changed allergy used old recipes.');
$complete = ['title' => 'Avena', 'description' => 'Con fruta', 'ingredients' => ['40 g de avena'], ...$recipe, 'ingredientData' => [['foodId' => 0, 'name' => 'avena', 'quantity' => 40, 'unit' => 'g']]];
check(count(validateGeneratedRecipeList(array_fill(0, 5, $complete))) === 5, 'Valid recipe rejected.');
try { validateGeneratedRecipeList(array_fill(0, 5, ['title' => 'Incomplete'])); throw new LogicException('Invalid recipe accepted.'); } catch (RuntimeException $error) { check(!$error instanceof LogicException, 'Invalid recipe accepted.'); }
try { validateGeneratedRecipeList(array_fill(0, 5, [...$complete, 'servings' => 0])); throw new LogicException('Zero portions accepted.'); } catch (RuntimeException $error) { check(!$error instanceof LogicException, 'Zero portions accepted.'); }
echo "Recipe generation rules passed: metadata, legacy JSON, schema and prompt.\n";
