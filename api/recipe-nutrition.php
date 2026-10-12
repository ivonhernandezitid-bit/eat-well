<?php
declare(strict_types=1);

const RECIPE_NUTRIENT_COLUMNS = [
    'calories' => 'energy_kcal', 'proteinGrams' => 'protein_g',
    'carbsGrams' => 'carbohydrates_g', 'fatGrams' => 'total_fat_g', 'fiberGrams' => 'dietary_fiber_g',
];

function normalizeFoodName(string $name): string
{
    return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $name) ?? ''), 'UTF-8');
}

function cleanRecipeIngredientData(mixed $data): array
{
    if (!is_array($data)) return [];
    $result = [];
    foreach (array_slice($data, 0, 30) as $item) {
        if (!is_array($item)) { $result[] = []; continue; }
        $id = $item['foodId'] ?? null;
        $quantity = $item['quantity'] ?? null;
        $result[] = [
            'foodId' => is_int($id) && $id > 0 ? $id : 0,
            'name' => is_string($item['name'] ?? null) ? mb_substr(trim($item['name']), 0, 255) : '',
            'quantity' => is_numeric($quantity) && is_finite((float)$quantity) && $quantity > 0 && $quantity <= 100000 ? (float)$quantity : null,
            'unit' => in_array($item['unit'] ?? null, ['g', 'ml'], true) ? $item['unit'] : null,
        ];
    }
    return $result;
}

function recipeIngredientLines(array $data): array
{
    return array_map(static fn($item) => rtrim(rtrim(number_format($item['quantity'], 3, '.', ''), '0'), '.') . ' ' . $item['unit'] . ' de ' . normalizeFoodName($item['name']), $data);
}

function nutritionFoodCatalog(PDO $pdo): array
{
    static $cache;
    $cache ??= new WeakMap();
    if (isset($cache[$pdo])) return $cache[$pdo];
    try {
        $foods = $pdo->query('SELECT id,name,reference_amount,reference_unit,energy_kcal,protein_g,carbohydrates_g,total_fat_g,dietary_fiber_g FROM foods')->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $error) {
        if ($error->getCode() !== '42S02') throw $error;
        $foods = [];
    }
    $byId = []; $byName = [];
    foreach ($foods as $food) {
        $byId[(int)$food['id']] = $food;
        $byName[normalizeFoodName($food['name'])][] = $food;
    }
    return $cache[$pdo] = ['byId' => $byId, 'byName' => $byName];
}

function calculateRecipeNutrition(array $recipe, array $catalog): array
{
    $totals = array_fill_keys(array_keys(RECIPE_NUTRIENT_COLUMNS), 0.0);
    $complete = array_fill_keys(array_keys($totals), true);
    $warnings = []; $matched = 0;
    $servings = $recipe['servings'] ?? null;
    $validServings = is_numeric($servings) && (int)$servings == $servings && $servings > 0 && $servings <= 12;
    $ingredients = is_array($recipe['ingredients'] ?? null) ? $recipe['ingredients'] : [];
    $data = cleanRecipeIngredientData($recipe['ingredientData'] ?? []);
    if (count($data) > count($ingredients)) {
        $warnings[] = 'La lista de cantidades no coincide con los ingredientes mostrados.';
        $complete = array_fill_keys(array_keys($complete), false);
    }
    if (!$validServings) $warnings[] = 'Falta confirmar el numero de porciones.';
    if (!$ingredients) $warnings[] = 'No hay ingredientes disponibles para calcular.';
    foreach ($ingredients as $index => $line) {
        $item = $data[$index] ?? null;
        $structured = $item !== null;
        // Legacy strings are accepted only when they explicitly state a mass or volume.
        if (!$item && is_string($line) && preg_match('/^(\d+(?:[.,]\d+)?)\s*(g|ml)\s+(?:de\s+)?(.+)$/ui', trim($line), $parts)) {
            $item = cleanRecipeIngredientData([['foodId' => 0, 'quantity' => str_replace(',', '.', $parts[1]), 'unit' => mb_strtolower($parts[2]), 'name' => $parts[3]]])[0];
        }
        $label = is_array($item) && ($item['name'] ?? '') !== '' ? $item['name'] : (is_string($line) ? $line : 'Ingrediente');
        $food = null;
        if ($item && ($item['name'] ?? '') !== '') {
            $name = normalizeFoodName($item['name']);
            if (($item['foodId'] ?? 0) > 0) {
                $candidate = $catalog['byId'][$item['foodId']] ?? null;
                if ($candidate && normalizeFoodName($candidate['name']) === $name) $food = $candidate;
            } else {
                $matches = $catalog['byName'][$name] ?? [];
                if (count($matches) === 1) $food = $matches[0];
            }
        }
        $reason = null;
        if (!$item || !($item['quantity'] ?? null) || !($item['unit'] ?? null)) $reason = 'Falta una cantidad en gramos o mililitros';
        elseif ($structured && (!is_string($line) || normalizeFoodName($line) !== normalizeFoodName(recipeIngredientLines([$item])[0]))) $reason = 'La cantidad o el alimento no coincide con el ingrediente mostrado';
        elseif (!$food) $reason = 'Falta una coincidencia unica en BAM';
        elseif (!is_numeric($food['reference_amount'] ?? null) || $food['reference_amount'] <= 0 || !in_array($food['reference_unit'] ?? null, ['g', 'ml'], true)) $reason = 'Falta confirmar la cantidad de referencia de BAM';
        elseif ($item['unit'] !== $food['reference_unit']) $reason = 'No hay una conversion confirmada entre gramos y mililitros';
        if ($reason) {
            $warnings[] = $reason . ': ' . $label . '.';
            $complete = array_fill_keys(array_keys($complete), false);
            continue;
        }
        ++$matched;
        $factor = $item['quantity'] / (float)$food['reference_amount'];
        foreach (RECIPE_NUTRIENT_COLUMNS as $key => $column) {
            $value = $food[$column] ?? null;
            if (!is_numeric($value) || !is_finite((float)$value) || $value < 0) {
                $complete[$key] = false;
                $warnings[] = 'BAM no tiene el dato ' . $column . ' para ' . $label . '.';
            } else $totals[$key] += (float)$value * $factor;
        }
    }
    $perServing = [];
    foreach ($totals as $key => $total) $perServing[$key] = $validServings && $ingredients && $complete[$key] ? round($total / (int)$servings, 2) : null;
    $available = count(array_filter($perServing, static fn($value) => $value !== null));
    return [
        'source' => 'BAM', 'status' => $available === count($perServing) ? 'complete' : ($available ? 'partial' : 'unavailable'),
        'perServing' => $perServing, 'matchedIngredients' => $matched, 'totalIngredients' => count($ingredients),
        'warnings' => array_values(array_unique($warnings)),
        'method' => 'Suma proporcional de ingredientes por porcion; no ajustada por perdidas de coccion.',
    ];
}

function withRecipeNutrition(PDO $pdo, array $recipe): array
{
    $nutrition = calculateRecipeNutrition($recipe, nutritionFoodCatalog($pdo));
    return [...$recipe, ...$nutrition['perServing'], 'nutrition' => $nutrition];
}
