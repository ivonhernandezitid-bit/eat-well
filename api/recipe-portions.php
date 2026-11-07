<?php
declare(strict_types=1);
require_once __DIR__ . '/recipe-generation.php';

function validateRecipeServings(mixed $value): int
{
    if (is_bool($value) || !is_numeric($value) || !is_finite((float)$value) || (int)$value != $value || $value < 1 || $value > 12) {
        throw new InvalidArgumentException('Selecciona entre 1 y 12 porciones completas.');
    }
    return (int)$value;
}

function recipePortionData(array $recipe): ?array
{
    try { validateRecipeServings($recipe['servings'] ?? null); }
    catch (InvalidArgumentException) { return null; }
    $lines = $recipe['ingredients'] ?? null;
    $raw = $recipe['ingredientData'] ?? null;
    if (!is_array($lines) || !$lines || !is_array($raw) || count($lines) !== count($raw) || count($raw) > 30) return null;
    $data = cleanRecipeIngredientData($raw);
    foreach ($data as $index => $item) {
        if (!$item || !$item['quantity'] || !$item['unit'] || $item['name'] === '' || round($item['quantity'],3) <= 0) return null;
        if (!is_string($lines[$index]) || normalizeFoodName($lines[$index]) !== normalizeFoodName(recipeIngredientLines([$item])[0])) return null;
    }
    return $data;
}

function scaleRecipePortions(array $recipe, mixed $servings, array $catalog): array
{
    $target = validateRecipeServings($servings);
    $data = recipePortionData($recipe);
    if ($data === null) return ['available'=>false, 'reason'=>'Faltan porciones o cantidades verificables en gramos o mililitros para ajustar esta receta.'];
    $base = (int)$recipe['servings'];
    $factor = $target / $base;
    $scaled = []; $calculationData = [];
    foreach ($data as $item) {
        $exact = $item['quantity'] * $factor;
        $quantity = round($exact,3);
        if ($quantity <= 0 || $exact > 100000) throw new InvalidArgumentException('El ajuste produce una cantidad demasiado pequena o grande para mostrarla correctamente.');
        $scaled[] = [...$item,'quantity'=>$quantity];
        $calculationData[] = [...$item,'quantity'=>$exact];
    }
    // Nutrition remains per serving; scale only the total, not the serving twice.
    $nutrition = calculateRecipeNutrition($recipe,$catalog);
    $totals = calculateRecipeNutrition([...$recipe,'servings'=>1,'ingredientData'=>$calculationData,
        'ingredients'=>recipeIngredientLines($calculationData)],$catalog)['perServing'];
    $hasQuantities = false;
    foreach ($recipe['instructions'] ?? [] as $step) {
        if (is_string($step) && preg_match('/\d\s*(?:\/\s*\d\s*)?(?:g|gr|gramos?|ml|mililitros?|kg|litros?|tazas?|piezas?|cucharadas?|cucharaditas?)\b/ui',$step)) $hasQuantities = true;
    }
    return ['available'=>true,'baseServings'=>$base,'requestedServings'=>$target,'factor'=>$factor,
        'ingredients'=>recipeIngredientLines($scaled),'ingredientData'=>$scaled,
        'nutrition'=>$nutrition,'totalNutrition'=>$totals,
        'instructionQuantitiesUnchanged'=>$hasQuantities && $base!==$target];
}

function readPortionRecipe(PDO $pdo, int $userId, mixed $recipeId, mixed $source): ?array
{
    if (!is_string($recipeId)) throw new InvalidArgumentException('Selecciona una receta valida.');
    $tables = ['personalized'=>'personalized_recipes','favorite'=>'favorite_recipes','scan'=>'ai_generated_recipes','local'=>'recipes'];
    if (!is_string($source) || !isset($tables[$source])) throw new InvalidArgumentException('El origen de la receta no es valido.');
    $pattern = in_array($source,['personalized','favorite'],true) ? '/^'.$source.'-([1-9]\d*)$/D' : '/^([1-9]\d*)$/D';
    if (!preg_match($pattern,$recipeId,$match)) throw new InvalidArgumentException('La receta no corresponde a su origen.');
    $sql = 'SELECT id,ingredients,instructions FROM '.$tables[$source].' WHERE id=?';
    $params = [$match[1]];
    if ($source !== 'local') { $sql.=' AND user_id=?'; $params[]=$userId; }
    $stmt = $pdo->prepare($sql); $stmt->execute($params); $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return null;
    if ($source === 'local') return ['ingredients'=>explode('|',$row['ingredients']),'instructions'=>explode('|',$row['instructions'])];
    return ['ingredients'=>decodeJsonList($row['ingredients']),...readRecipeInstructions($row['instructions'])];
}

function handleRecipePortions(PDO $pdo, array $input): void
{
    $user = requireSessionUser($pdo); $userId = (int)$user['id'];
    if ((string)($input['userId'] ?? $_GET['userId'] ?? $userId) !== (string)$userId) sendError('No puedes ajustar recetas de otra cuenta.',403);
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') sendError('Metodo no permitido.',405);
    try {
        $target = validateRecipeServings($input['servings'] ?? $_GET['servings'] ?? null);
        $id = $input['recipeId'] ?? $_GET['recipeId'] ?? null;
        $recipe = readPortionRecipe($pdo,$userId,$id,$input['source'] ?? $_GET['source'] ?? null);
        if ($recipe === null) sendError('La receta no existe o no pertenece a tu cuenta.',404);
        sendJson(['recipeId'=>$id,...scaleRecipePortions($recipe,$target,nutritionFoodCatalog($pdo))]);
    } catch (InvalidArgumentException $error) { sendError($error->getMessage(),422); }
}
