<?php
declare(strict_types=1);

function mealEnergyTargets(array $user, array $preferences): array
{
    $age = (int)($user['age'] ?? 0);
    $height = (float)($user['height_cm'] ?? 0);
    $weight = (float)($user['weight_kg'] ?? 0);
    if ($age < 18 || $height <= 0 || $weight <= 0) return [];

    // Keep the same adult estimate as calculateMacroTargets in the app.
    $adjustment = match ($user['gender'] ?? null) { 'male' => 5, 'female' => -161, default => -78 };
    $lifestyle = $preferences['lifestyle'] ?? [];
    $activity = $lifestyle['activityBand'] ?? match ($user['activity_level'] ?? null) {
        'low' => 'sedentary', 'high' => 'intense', default => 'moderate',
    };
    $activityFactor = ['sedentary' => 1.2, 'light' => 1.375, 'moderate' => 1.55, 'intense' => 1.725][$activity] ?? 1.55;
    $goal = $lifestyle['goal'] ?? $user['goal'] ?? 'maintain';
    $targetWeight = (float)($lifestyle['targetWeightKg'] ?? $weight);
    $goalFactor = match (true) {
        $goal === 'lose_weight' && $targetWeight < $weight => 0.85,
        $goal === 'gain_muscle' && $targetWeight > $weight => 1.1,
        default => 1,
    };
    $daily = (int)round((10 * $weight + 6.25 * $height - 5 * $age + $adjustment) * $activityFactor * $goalFactor);
    if ($daily <= 0) return [];

    $targets = []; $allocated = 0;
    foreach (['breakfast' => 25, 'morning_snack' => 35, 'lunch' => 70, 'afternoon_snack' => 80, 'dinner' => 100] as $type => $cumulativePercent) {
        $cumulative = (int)round($daily * $cumulativePercent / 100);
        $target = $cumulative - $allocated;
        $targets[$type] = ['target' => $target, 'min' => (int)ceil($target * 0.9), 'max' => (int)floor($target * 1.1)];
        $allocated = $cumulative;
    }
    return $targets;
}

function mealRecipeMeetsEnergy(array $recipe, array $catalog, array $range): bool
{
    $kcal = calculateRecipeNutrition($recipe, $catalog)['perServing']['calories'];
    return $kcal !== null && $kcal >= $range['min'] && $kcal <= $range['max'];
}

function mealCookingFoods(PDO $pdo, array $preferences): array
{
    // Search for ordinary cooking ingredients as well as the user's preferred foods.
    $staples = [
        'preferredFruits' => ['platano', 'pera'],
        'preferredVegetables' => ['jitomate', 'calabacita'],
        'preferredProteins' => ['huevo entero', 'pechuga de pollo'],
        'preferredCarbohydrates' => ['tortilla de maiz', 'papa'],
        'preferredLegumes' => ['lenteja', 'garbanzo'],
        'preferredDairy' => ['yogur natural', 'leche'],
        'preferredFats' => ['aceite de oliva', 'aguacate', 'sal de mesa'],
    ];
    $lookup = $preferences;
    foreach ($staples as $key => $terms) {
        $lookup[$key] = array_values(array_unique([...($preferences[$key] ?? []), ...$terms]));
    }
    return array_values(array_filter(recipeBamContext($pdo, $lookup), static fn($food) =>
        $food['reference_unit'] === 'g' && (float)$food['reference_amount'] === 100.0 && is_numeric($food['energy_kcal'])));
}

function mealRecipeUsesListedFoods(array $recipe, array $listedIds): bool
{
    $ingredients = cleanRecipeIngredientData($recipe['ingredientData'] ?? []);
    if (!$ingredients) return false;
    foreach ($ingredients as $item) {
        if (!isset($listedIds[$item['foodId']]) || $item['unit'] !== 'g') return false;
    }
    return true;
}
