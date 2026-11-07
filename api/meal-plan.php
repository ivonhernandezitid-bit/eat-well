<?php
declare(strict_types=1);
require_once __DIR__ . '/recipe-generation.php';
require_once __DIR__ . '/lifestyle-goals.php';
require_once __DIR__ . '/clinical-history.php';

const MEAL_PLAN_OPTION_COUNT = 4;

function mealOptionHash(array $user, array $preferences, string $mealType): string
{
    return hash('sha256', recipePreferenceHash($user, $preferences) . ':' . MEAL_PLAN_OPTION_COUNT . '-options-v2:' . $mealType);
}

function compatibleMealOptionHashes(array $user, array $preferences, string $mealType): array
{
    return [mealOptionHash($user,$preferences,$mealType),
        hash('sha256', recipePreferenceHash($user,$preferences) . ':seven-options-v1:' . $mealType)];
}

function mealPlanClinicalConditions(PDO $pdo, int $userId): array
{
    ensureClinicalHistoryColumns($pdo);
    $history = readClinicalHistory($pdo, $userId)['history'] ?? [];
    $fields = [
        'diabetes' => 'diagnosisDiabetes',
        'insulinResistance' => 'diagnosisInsulinResistance',
        'hypothyroidism' => 'diagnosisHypothyroidism',
        'hyperthyroidism' => 'diagnosisHyperthyroidism',
        'hypertension' => 'diagnosisHypertension',
        'dyslipidemia' => 'diagnosisDyslipidemia',
        'fattyLiver' => 'diagnosisFattyLiver',
        'gout' => 'diagnosisGout',
        'chronicKidneyDisease' => 'diagnosisChronicKidneyDisease',
        'kidneyStones' => 'diagnosisKidneyStones',
    ];
    $conditions = [];
    foreach ($fields as $condition => $field) {
        $conditions[$condition] = (bool)($history[$field] ?? false);
    }
    return $conditions;
}

function filterRecipesByClinicalConditions(array $recipes, array $conditions): array
{
    $blockedTerms = [];
    if (!empty($conditions['diabetes']) || !empty($conditions['insulinResistance'])) {
        $blockedTerms = [...$blockedTerms, 'azucar', 'jarabe de maiz', 'jarabe de agave', 'leche condensada', 'refresco', 'pan blanco', 'harina blanca', 'harina refinada'];
    }
    if (!empty($conditions['hypertension'])) {
        $blockedTerms = [...$blockedTerms, 'jamon', 'salchicha', 'chorizo', 'tocino', 'salami', 'mortadela', 'embutido', 'sopa enlatada', 'consome en cubo', 'salsa de soya', 'alimento enlatado'];
    }
    if (!empty($conditions['dyslipidemia'])) {
        $blockedTerms = [...$blockedTerms, 'grasa trans', 'aceite parcialmente hidrogenado', 'manteca', 'mantequilla', 'tocino', 'fritura', 'ultraprocesado'];
    }
    if (!empty($conditions['fattyLiver'])) {
        $blockedTerms = [...$blockedTerms, 'jarabe de maiz de alta fructosa', 'jarabe de maiz', 'refresco', 'bebida azucarada', 'azucar', 'pan blanco', 'harina blanca', 'harina refinada'];
    }
    if (!empty($conditions['gout'])) {
        $blockedTerms = [...$blockedTerms, 'visceras', 'higado', 'riñon', 'mollejas', 'anchoas', 'sardinas', 'mejillones', 'mariscos', 'camarones', 'langostinos', 'cangrejo', 'almejas', 'pulpo', 'calamar'];
    }
    if (!$blockedTerms) return $recipes;

    $blockedTerms = array_values(array_unique($blockedTerms));
    $normalize = static fn(string $value): string => strtr(
        mb_strtolower($value, 'UTF-8'),
        ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n'],
    );
    $blockedTerms = array_map($normalize, $blockedTerms);
    return array_values(array_filter($recipes, static function (array $recipe) use ($blockedTerms): bool {
        $ingredients = array_merge(
            is_array($recipe['ingredients'] ?? null) ? $recipe['ingredients'] : [],
            array_map(static fn($item) => is_array($item) ? ($item['name'] ?? '') : '', is_array($recipe['ingredientData'] ?? null) ? $recipe['ingredientData'] : []),
        );
        foreach ($ingredients as $ingredient) {
            if (!is_string($ingredient)) continue;
            $normalized = strtr(mb_strtolower($ingredient, 'UTF-8'), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
            foreach ($blockedTerms as $term) {
                if (str_contains($normalized, $term)) return false;
            }
        }
        return true;
    }));
}

function validatePlanDate(mixed $date, ?string $today = null): string
{
    if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date)) throw new InvalidArgumentException('El dia del plan no es valido.');
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('America/Mexico_City'));
    if (!$parsed || $parsed->format('Y-m-d') !== $date) throw new InvalidArgumentException('El dia del plan no existe.');
    $current = new DateTimeImmutable($today ?? 'today', new DateTimeZone('America/Mexico_City'));
    if ($date < $current->modify('-1 day')->format('Y-m-d') || $date > $current->modify('+1 day')->format('Y-m-d')) throw new InvalidArgumentException('Selecciona las comidas del dia actual.');
    return $date;
}

function readDailyMealChoices(PDO $pdo, array $user, array $preferences, string $date): array
{
    $stmt = $pdo->prepare('SELECT r.*, c.meal_type AS chosen_meal_type, c.preference_hash AS chosen_preference_hash FROM daily_meal_choices c LEFT JOIN personalized_recipes r ON r.id=c.recipe_id AND r.user_id=c.user_id WHERE c.user_id=? AND c.plan_date=?');
    $stmt->execute([$user['id'], $date]);
    $choices = []; $needsReview = [];
    $hash = recipePreferenceHash($user, $preferences);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $type = $row['chosen_meal_type'];
        if (!in_array($type, RECIPE_MEAL_TYPES, true)) continue;
        $valid = !empty($preferences['completed']) && $row['id'] !== null
            && $row['chosen_preference_hash'] === $hash
            && in_array($row['preference_hash'], compatibleMealOptionHashes($user,$preferences,$type), true)
            && in_array($type, recipeMetadata(readRecipeInstructions($row['instructions']))['mealTypes'], true);
        if ($valid) {
            $recipe = mapPersonalizedRecipe($row);
            $valid = (bool)filterRecipesByPreferences([$recipe], $preferences)
                && (bool)filterRecipesByClinicalConditions([$recipe], $preferences['clinicalConditions'] ?? []);
        }
        if ($valid) $choices[$type] = withRecipeNutrition($pdo, $recipe);
        else $needsReview[] = $type;
    }
    $schedule = $pdo->prepare('SELECT * FROM meal_schedules WHERE user_id=?');
    $schedule->execute([$user['id']]);
    $schedule = $schedule->fetch(PDO::FETCH_ASSOC) ?: null;
    return structureDailyMealPlan($date, $choices, $needsReview, $schedule);
}

function structureDailyMealPlan(string $date, array $choices, array $needsReview, ?array $schedule): array
{
    $slots = [
        'breakfast' => ['Desayuno', 'breakfast_time'],
        'morning_snack' => ['Colación matutina', 'morning_snack_time'],
        'lunch' => ['Comida', 'lunch_time'],
        'afternoon_snack' => ['Colación vespertina', 'afternoon_snack_time'],
        'dinner' => ['Cena', 'dinner_time'],
    ];
    $meals = []; $validChoices = []; $reviewCount = 0;
    foreach ($slots as $type => [$label, $field]) {
        $time = $schedule[$field] ?? null;
        $time = is_string($time) && preg_match('/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/D', $time) ? substr($time, 0, 5) : null;
        $review = in_array($type, $needsReview, true);
        $recipe = $review ? null : ($choices[$type] ?? null);
        if ($recipe) $validChoices[$type] = $recipe;
        if ($review) ++$reviewCount;
        $meals[] = ['mealType'=>$type, 'label'=>$label, 'scheduledTime'=>$time,
            'selectionStatus'=>$review ? 'needs_review' : ($recipe ? 'selected' : 'pending'),
            'recipe'=>$recipe];
    }
    $selected = count($validChoices);
    return ['date'=>$date, 'choices'=>(object)$validChoices, 'meals'=>$meals,
        'scheduleCustomized'=>(bool)($schedule['is_customized'] ?? false),
        'summary'=>['totalMeals'=>5, 'selectedMeals'=>$selected, 'pendingMeals'=>5-$selected,
            'needsReviewMeals'=>$reviewCount, 'complete'=>$selected===5]];
}

function readMealOptions(PDO $pdo, array $user, array $preferences, string $type, string $apiKey, string $model): array
{
    if (!$preferences['completed']) throw new InvalidArgumentException('Completa tus preferencias alimentarias antes de elegir tus recetas.');
    $hash = mealOptionHash($user, $preferences, $type);
    $stmt = $pdo->prepare('SELECT * FROM personalized_recipes WHERE user_id=? AND preference_hash=? ORDER BY id LIMIT ' . MEAL_PLAN_OPTION_COUNT);
    $stmt->execute([$user['id'], $hash]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($rows) === MEAL_PLAN_OPTION_COUNT) return array_map(fn($row) => withRecipeNutrition($pdo, mapPersonalizedRecipe($row)), $rows);
    // Reuse four compatible options from the old cache instead of generating again.
    $legacy = compatibleMealOptionHashes($user,$preferences,$type)[1];
    $stmt->execute([$user['id'],$legacy]); $olderRows=$stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($olderRows) === MEAL_PLAN_OPTION_COUNT) return array_map(fn($row) => withRecipeNutrition($pdo,mapPersonalizedRecipe($row)),$olderRows);
    if ($apiKey === '') sendError('La generacion de recetas no esta configurada en el servidor.', 503);
    $labels = ['breakfast' => 'Desayuno', 'morning_snack' => 'Colacion matutina', 'lunch' => 'Comida', 'afternoon_snack' => 'Colacion vespertina', 'dinner' => 'Cena'];
    $prompt = recipeGenerationPrompt($user, $preferences, recipeBamContext($pdo, $preferences), recipeClinicalGuidance($preferences['clinicalConditions'] ?? []))
        . "\nGenera exactamente cuatro opciones diferentes para {$labels[$type]}. Cada una debe tener mealTypes=[\"{$type}\"]. Son alternativas para elegir UNA, no cuatro comidas que deban consumirse juntas. No repitas la misma receta cambiando solo el nombre. Devuelve un array JSON de cuatro recetas.";
    $recipes = validateGeneratedRecipeList(requestGeminiText($apiKey, $model, $prompt, ['type' => 'ARRAY', 'items' => recipeGenerationSchema()]), MEAL_PLAN_OPTION_COUNT, $type);
    $recipes = filterRecipesByPreferences($recipes, $preferences);
    $recipes = filterRecipesByClinicalConditions($recipes, $preferences['clinicalConditions'] ?? []);
    if (count($recipes) !== MEAL_PLAN_OPTION_COUNT) throw new RuntimeException('Una o más recetas no cumplieron con las restricciones registradas. Vuelve a generar las opciones.');
    $pdo->beginTransaction();
    try {
        // Lock this account so concurrent requests reuse a single completed option set.
        $lock = $pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE'); $lock->execute([$user['id']]);
        $stmt->execute([$user['id'], $hash]); $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (count($rows) !== MEAL_PLAN_OPTION_COUNT) {
            if ($rows) throw new RuntimeException('El conjunto de recetas esta incompleto. Requiere revision.');
            $insert = $pdo->prepare('INSERT INTO personalized_recipes (user_id,preference_hash,title,description,ingredients,instructions) VALUES (?,?,?,?,?,?)');
            foreach ($recipes as $recipe) $insert->execute([$user['id'], $hash, cleanText($recipe['title'], 180), cleanText($recipe['description'], 255), json_encode($recipe['ingredients'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), encodeRecipeInstructions($recipe)]);
            $stmt->execute([$user['id'], $hash]); $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        $pdo->commit();
    } catch (Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
    return array_map(fn($row) => withRecipeNutrition($pdo, mapPersonalizedRecipe($row)), $rows);
}

function saveDailyMealChoice(PDO $pdo, array $user, array $preferences, string $date, string $type, mixed $recipeId): void
{
    if (!is_string($recipeId) || !preg_match('/^personalized-([1-9]\d*)$/D', $recipeId, $matches)) throw new InvalidArgumentException('Selecciona una receta de las sugerencias de esta comida.');
    $stmt = $pdo->prepare('SELECT * FROM personalized_recipes WHERE id=? AND user_id=? AND preference_hash IN (?,?)');
    $stmt->execute([$matches[1], $user['id'], ...compatibleMealOptionHashes($user,$preferences,$type)]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || !in_array($type, readRecipeInstructions($row['instructions'])['mealTypes'], true)) throw new InvalidArgumentException('La receta no corresponde a tu cuenta, comida o preferencias actuales.');
    $recipe = mapPersonalizedRecipe($row);
    if (!filterRecipesByPreferences([$recipe], $preferences)
        || !filterRecipesByClinicalConditions([$recipe], $preferences['clinicalConditions'] ?? [])) {
        throw new InvalidArgumentException('La receta no es compatible con tus preferencias o condiciones registradas.');
    }
    $save = $pdo->prepare('INSERT INTO daily_meal_choices (user_id,plan_date,meal_type,recipe_id,preference_hash) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE recipe_id=VALUES(recipe_id),preference_hash=VALUES(preference_hash)');
    $save->execute([$user['id'], $date, $type, $row['id'], recipePreferenceHash($user, $preferences)]);
}

function clearDailyMealChoice(PDO $pdo, int $userId, string $date, string $type): void
{
    $stmt = $pdo->prepare('DELETE FROM daily_meal_choices WHERE user_id=? AND plan_date=? AND meal_type=?');
    $stmt->execute([$userId, $date, $type]);
}

function handleMealPlan(PDO $pdo, string $action, array $input, string $apiKey, string $model): void
{
    $user = requireSessionUser($pdo);
    if ((string)($input['userId'] ?? $_GET['userId'] ?? $user['id']) !== (string)$user['id']) sendError('No puedes acceder al plan de otra cuenta.', 403);
    if ($_SERVER['REQUEST_METHOD'] !== ($action === 'plan.choose' ? 'POST' : 'GET')) sendError('Metodo no permitido.', 405);
    $preferences = withLifestylePreferences($pdo, $user, mapFoodPreferences(getFoodPreferencesRecord($pdo, (int)$user['id'])));
    $preferences['clinicalConditions'] = mealPlanClinicalConditions($pdo, (int)$user['id']);
    try {
        $type = $input['mealType'] ?? $_GET['mealType'] ?? null;
        if ($action !== 'plan.get' && !in_array($type, RECIPE_MEAL_TYPES, true)) throw new InvalidArgumentException('Selecciona un tipo de comida valido.');
        if ($action === 'plan.options') sendJson(['recipes' => readMealOptions($pdo, $user, $preferences, $type, $apiKey, $model)]);
        $date = validatePlanDate($input['date'] ?? $_GET['date'] ?? null);
        if ($action === 'plan.choose') {
            if (array_key_exists('recipeId', $input) && $input['recipeId'] === null) clearDailyMealChoice($pdo, (int)$user['id'], $date, $type);
            else saveDailyMealChoice($pdo, $user, $preferences, $date, $type, $input['recipeId'] ?? null);
        }
        sendJson(readDailyMealChoices($pdo, $user, $preferences, $date));
    } catch (InvalidArgumentException $error) { sendError($error->getMessage(), 422); }
}
