<?php
declare(strict_types=1);
require_once __DIR__ . '/recipe-generation.php';
require_once __DIR__ . '/lifestyle-goals.php';
require_once __DIR__ . '/clinical-history.php';

function mealOptionHash(array $user, array $preferences, string $mealType): string
{
    return hash('sha256', recipePreferenceHash($user, $preferences) . ':seven-options-v1:' . $mealType);
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
    $stmt = $pdo->prepare('SELECT r.*, c.meal_type FROM daily_meal_choices c JOIN personalized_recipes r ON r.id=c.recipe_id AND r.user_id=c.user_id WHERE c.user_id=? AND c.plan_date=? AND c.preference_hash=?');
    $stmt->execute([$user['id'], $date, recipePreferenceHash($user, $preferences)]);
    $choices = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        if (in_array($row['meal_type'], recipeMetadata(readRecipeInstructions($row['instructions']))['mealTypes'], true)) {
            $choices[$row['meal_type']] = withRecipeNutrition($pdo, mapPersonalizedRecipe($row));
        }
    }
    return ['date' => $date, 'choices' => (object)$choices];
}

function readMealOptions(PDO $pdo, array $user, array $preferences, string $type, string $apiKey, string $model): array
{
    if (!$preferences['completed']) throw new InvalidArgumentException('Completa tus preferencias alimentarias antes de elegir tus recetas.');
    $hash = mealOptionHash($user, $preferences, $type);
    $stmt = $pdo->prepare('SELECT * FROM personalized_recipes WHERE user_id=? AND preference_hash=? ORDER BY id LIMIT 7');
    $stmt->execute([$user['id'], $hash]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($rows) === 7) return array_map(fn($row) => withRecipeNutrition($pdo, mapPersonalizedRecipe($row)), $rows);
    if ($apiKey === '') sendError('La generacion de recetas no esta configurada en el servidor.', 503);
    $labels = ['breakfast' => 'Desayuno', 'morning_snack' => 'Colacion matutina', 'lunch' => 'Comida', 'afternoon_snack' => 'Colacion vespertina', 'dinner' => 'Cena'];
    $prompt = recipeGenerationPrompt($user, $preferences, recipeBamContext($pdo, $preferences), recipeClinicalGuidance($preferences['clinicalConditions'] ?? []))
        . "\nGenera exactamente siete opciones diferentes para {$labels[$type]}. Cada una debe tener mealTypes=[\"{$type}\"]. Son alternativas para elegir UNA, no siete comidas que deban consumirse juntas. No repitas la misma receta cambiando solo el nombre. Devuelve un array JSON de siete recetas.";
    $recipes = validateGeneratedRecipeList(requestGeminiText($apiKey, $model, $prompt, ['type' => 'ARRAY', 'items' => recipeGenerationSchema()]), 7, $type);
    $recipes = filterRecipesByPreferences($recipes, $preferences);
    $recipes = filterRecipesByClinicalConditions($recipes, $preferences['clinicalConditions'] ?? []);
    if (count($recipes) !== 7) throw new RuntimeException('Una o más recetas no cumplieron con las restricciones registradas. Vuelve a generar las opciones.');
    $pdo->beginTransaction();
    try {
        // Lock this account so concurrent requests reuse a single completed option set.
        $lock = $pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE'); $lock->execute([$user['id']]);
        $stmt->execute([$user['id'], $hash]); $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (count($rows) !== 7) {
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
    $stmt = $pdo->prepare('SELECT * FROM personalized_recipes WHERE id=? AND user_id=? AND preference_hash=?');
    $stmt->execute([$matches[1], $user['id'], mealOptionHash($user, $preferences, $type)]);
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
