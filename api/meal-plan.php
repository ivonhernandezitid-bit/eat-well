<?php
declare(strict_types=1);
// Plan nutricional: identifica cachés por contrato, permite recuperar las incompletas solo por reintento y marca elecciones archivadas para revisión sin borrarlas.
// CAMBIO: permite elegir recetas reales del catálogo tras validar comida, preferencias y condiciones.
// Usa una referencia privada en personalized_recipes para conservar la FK existente, sin migraciones ni mezclar la caché de IA.
// Conserva el ID público del catálogo y su nutrición registrada; no inventa porciones ni convierte esos valores en estimaciones BAM.
// Clasifica el catálogo en instalaciones antiguas de XAMPP que todavía no devuelven mealTypes, sin modificar index.php.
require_once __DIR__ . '/recipe-generation.php';
require_once __DIR__ . '/lifestyle-goals.php';
require_once __DIR__ . '/clinical-history.php';

const MEAL_PLAN_OPTION_COUNT = 4;

function mealOptionHash(array $user, array $preferences, string $mealType): string
{
    // La versión identifica el contrato nutricional y evita reutilizar filas antiguas sin estimaciones persistidas.
    return hash('sha256', recipePreferenceHash($user, $preferences) . ':' . MEAL_PLAN_OPTION_COUNT . '-nutrition-provenance-v1:' . $mealType);
}

function compatibleMealOptionHashes(array $user, array $preferences, string $mealType): array
{
    return [mealOptionHash($user, $preferences, $mealType)];
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
    $startDate = $current->format('Y-m-d');
    $endDate = $current->modify('+6 days')->format('Y-m-d');
    if ($date < $startDate || $date > $endDate) throw new InvalidArgumentException('Selecciona un dia entre hoy y los proximos seis dias.');
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
        // Las referencias del catálogo se releen y validan en servidor; no se confían datos enviados por el cliente.
        $storedInstructions = json_decode((string)($row['instructions'] ?? ''), true);
        $catalogId = $storedInstructions['catalogRecipeId'] ?? null;
        if (is_int($catalogId) && $catalogId > 0) {
            $valid = $row['id'] !== null && $row['chosen_preference_hash'] === $hash
                && $row['preference_hash'] === catalogMealChoiceHash($user, $preferences, $type, $catalogId);
            if ($valid) {
                try { $recipe = catalogMealChoiceRecipe($pdo, $preferences, $type, $catalogId); }
                catch (InvalidArgumentException) { $valid = false; }
            }
            if ($valid) $choices[$type] = $recipe;
            else $needsReview[] = $type;
            continue;
        }
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

function mealOptionSetHasCompleteNutrition(PDO $pdo, array $rows, string $type): bool
{
    if (count($rows) !== MEAL_PLAN_OPTION_COUNT) return false;
    foreach ($rows as $row) {
        $recipe = mapPersonalizedRecipe($row);
        $metadata = recipeMetadata($recipe);
        if (!in_array($type, $metadata['mealTypes'], true) || !$metadata['servings']) return false;
        $recipe = withRecipeNutrition($pdo, $recipe);
        foreach (['calories', 'proteinGrams', 'carbsGrams', 'fatGrams'] as $nutrient) {
            if ($recipe['nutrition']['values'][$nutrient] === null
                || $recipe['nutrition']['portionBases'][$nutrient] !== 'per_serving') return false;
        }
    }
    return true;
}

function archiveIncompleteMealOptions(PDO $pdo, int $userId, string $hash, string $type): bool
{
    // Archivar sin borrar filas conserva las referencias de elecciones y permite marcarlas para revisión.
    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');
        $lock->execute([$userId]);
        $query = $pdo->prepare('SELECT * FROM personalized_recipes WHERE user_id=? AND preference_hash=? ORDER BY id LIMIT ' . MEAL_PLAN_OPTION_COUNT);
        $query->execute([$userId, $hash]);
        $rows = $query->fetchAll(PDO::FETCH_ASSOC);
        if (!$rows || mealOptionSetHasCompleteNutrition($pdo, $rows, $type)) {
            $pdo->commit();
            return false;
        }
        $archivedHash = hash('sha256', $hash . ':review:' . bin2hex(random_bytes(12)));
        $archive = $pdo->prepare('UPDATE personalized_recipes SET preference_hash=? WHERE user_id=? AND preference_hash=?');
        $archive->execute([$archivedHash, $userId, $hash]);
        $pdo->commit();
        return true;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function readMealOptions(PDO $pdo, array $user, array $preferences, string $type, string $apiKey, string $model, ?string &$source = null, bool $recoverCache = false): array
{
    if (!$preferences['completed']) throw new InvalidArgumentException('Completa tus preferencias alimentarias antes de elegir tus recetas.');
    $hash = mealOptionHash($user, $preferences, $type);
    $stmt = $pdo->prepare('SELECT * FROM personalized_recipes WHERE user_id=? AND preference_hash=? ORDER BY id LIMIT ' . MEAL_PLAN_OPTION_COUNT);
    $stmt->execute([$user['id'], $hash]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    // Cualquier conjunto guardado incompleto requiere una acción explícita; solo esa acción lo archiva y genera su reemplazo.
    if ($rows && !mealOptionSetHasCompleteNutrition($pdo, $rows, $type)) {
        if (!$recoverCache) sendError('El conjunto guardado de recetas requiere revisión antes de reutilizarse.', 409, 'options_cache_review');
        if ($apiKey === '') sendError('La generacion de recetas no esta configurada en el servidor.', 503, 'generation_not_configured');
        archiveIncompleteMealOptions($pdo, (int)$user['id'], $hash, $type);
        $stmt->execute([$user['id'], $hash]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if ($rows && mealOptionSetHasCompleteNutrition($pdo, $rows, $type)) {
            $source = 'cache';
            return array_map(fn($row) => withRecipeNutrition($pdo, mapPersonalizedRecipe($row)), $rows);
        }
        if ($rows) sendError('El conjunto guardado de recetas requiere revisión antes de reutilizarse.', 409, 'options_cache_review');
    }
    // No se considera válida una caché solo porque tenga el número esperado de filas.
    if (count($rows) === MEAL_PLAN_OPTION_COUNT && mealOptionSetHasCompleteNutrition($pdo, $rows, $type)) {
        $source = 'cache';
        return array_map(fn($row) => withRecipeNutrition($pdo, mapPersonalizedRecipe($row)), $rows);
    }
    if ($apiKey === '') sendError('La generacion de recetas no esta configurada en el servidor.', 503, 'generation_not_configured');
    $labels = ['breakfast' => 'Desayuno', 'morning_snack' => 'Colacion matutina', 'lunch' => 'Comida', 'afternoon_snack' => 'Colacion vespertina', 'dinner' => 'Cena'];
    $prompt = recipeGenerationPrompt($user, $preferences, recipeBamContext($pdo, $preferences), recipeClinicalGuidance($preferences['clinicalConditions'] ?? []))
        . "\nGenera exactamente cuatro opciones diferentes para {$labels[$type]}. Cada una debe tener mealTypes=[\"{$type}\"]. Son alternativas para elegir UNA, no cuatro comidas que deban consumirse juntas. No repitas la misma receta cambiando solo el nombre. Devuelve un array JSON de cuatro recetas.";
    error_log('[Paso 2] Solicitando receta a Gemini');
    try {
        $recipes = validateGeneratedRecipeList(requestGeminiText($apiKey, $model, $prompt, ['type' => 'ARRAY', 'items' => recipeGenerationSchema()]), MEAL_PLAN_OPTION_COUNT, $type);
    } catch (RuntimeException $error) {
        // Las respuestas inválidas del proveedor tienen un código estable; no se atribuyen a una clave o modelo sin evidencia.
        sendError($error->getMessage(), 502, 'provider_response_error');
    }
    $recipes = filterRecipesByPreferences($recipes, $preferences);
    $recipes = filterRecipesByClinicalConditions($recipes, $preferences['clinicalConditions'] ?? []);
    if (count($recipes) !== MEAL_PLAN_OPTION_COUNT) throw new RuntimeException('Una o más recetas no cumplieron con las restricciones registradas. Vuelve a generar las opciones.');
    $reused = false;
    $pdo->beginTransaction();
    try {
        // Lock this account so concurrent requests reuse a single completed option set.
        $lock = $pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE'); $lock->execute([$user['id']]);
        $stmt->execute([$user['id'], $hash]); $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (count($rows) === MEAL_PLAN_OPTION_COUNT && mealOptionSetHasCompleteNutrition($pdo, $rows, $type)) {
            $reused = true;
        } else {
            if ($rows) {
                $pdo->rollBack();
                sendError('El conjunto guardado de recetas requiere revisión antes de reutilizarse.', 409, 'options_cache_review');
            }
            $insert = $pdo->prepare('INSERT INTO personalized_recipes (user_id,preference_hash,title,description,ingredients,instructions) VALUES (?,?,?,?,?,?)');
            foreach ($recipes as $recipe) $insert->execute([$user['id'], $hash, cleanText($recipe['title'], 180), cleanText($recipe['description'], 255), json_encode($recipe['ingredients'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), encodeRecipeInstructions($recipe)]);
            $stmt->execute([$user['id'], $hash]); $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        $pdo->commit();
    } catch (Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
    $source = $reused ? 'cache' : 'generated';
    return array_map(fn($row) => withRecipeNutrition($pdo, mapPersonalizedRecipe($row)), $rows);
}

// La referencia del catálogo se identifica aparte de los conjuntos generados para no invalidar ni regenerar la caché de IA.
function catalogMealChoiceHash(array $user, array $preferences, string $type, int $catalogId): string
{
    return hash('sha256', recipePreferenceHash($user, $preferences) . ':catalog-choice-v1:' . $type . ':' . $catalogId);
}

// Solo admite recetas existentes y compatibles; recupera ingredientes y nutrición del catálogo, nunca del cuerpo de la petición.
function catalogMealChoiceRecipe(PDO $pdo, array $preferences, string $type, int $catalogId): array
{
    if (empty($preferences['completed'])) throw new InvalidArgumentException('Completa tus preferencias antes de elegir una receta.');
    $stmt = $pdo->prepare('SELECT * FROM recipes WHERE id=? LIMIT 1');
    $stmt->execute([$catalogId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) throw new InvalidArgumentException('La receta del catalogo ya no esta disponible.');
    $recipe = withRecipeNutrition($pdo, mapRecipe($row));
    // Compatibilidad localizada: la copia antigua de mapRecipe no entrega clasificación; se usan las mismas reglas del catálogo actual.
    if (!is_array($recipe['mealTypes'] ?? null)) {
        $text = strtr(mb_strtolower($recipe['title'] . ' ' . $recipe['description'], 'UTF-8'),
            ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n']);
        $types = [];
        if (preg_match('/\b(avena|hotcakes|huevo|omelette|licuado)\b/u', $text)) $types[] = 'breakfast';
        if (preg_match('/\b(licuado|yogur|yogurt|frutos rojos|snack|colacion)\b/u', $text)) {
            $types[] = 'morning_snack'; $types[] = 'afternoon_snack';
        }
        if (preg_match('/\b(tostadas|tacos|pollo|pavo|wrap|salmon|pasta|bowl|ensalada|crema|sopa)\b/u', $text)) {
            $types[] = 'lunch'; $types[] = 'dinner';
        }
        $recipe['mealTypes'] = $types ?: ['lunch', 'dinner'];
    }
    if (!in_array($type, $recipe['mealTypes'], true)) throw new InvalidArgumentException('La receta no corresponde a este tiempo de comida.');
    if (!filterRecipesByPreferences([$recipe], $preferences)
        || !filterRecipesByClinicalConditions([$recipe], $preferences['clinicalConditions'] ?? [])) {
        throw new InvalidArgumentException('La receta no es compatible con tus preferencias o condiciones registradas.');
    }
    if (!$recipe['ingredients'] || !$recipe['instructions']
        || in_array(null, $recipe['nutrition']['values'], true)) {
        throw new InvalidArgumentException('La receta del catalogo no tiene todos los datos necesarios.');
    }
    return $recipe;
}

// Guarda referencia y elección de forma atómica, reutiliza la referencia de la cuenta y conserva el ID original al leer el plan.
function saveCatalogMealChoice(PDO $pdo, array $user, array $preferences, string $date, string $type, int $catalogId): void
{
    $recipe = catalogMealChoiceRecipe($pdo, $preferences, $type, $catalogId);
    $hash = catalogMealChoiceHash($user, $preferences, $type, $catalogId);
    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');
        $lock->execute([$user['id']]);
        $existing = $pdo->prepare('SELECT id FROM personalized_recipes WHERE user_id=? AND preference_hash=? ORDER BY id LIMIT 1');
        $existing->execute([$user['id'], $hash]);
        $referenceId = $existing->fetchColumn();
        if ($referenceId === false) {
            // No promover calorías registradas a estimación por porción: se conservan como registeredNutrition.
            $recipe['estimatedNutrition'] = normalizeRecipeNutrientValues(null);
            $instructions = json_decode(encodeRecipeInstructions($recipe), true, 512, JSON_THROW_ON_ERROR);
            $instructions['catalogRecipeId'] = $catalogId;
            $insert = $pdo->prepare('INSERT INTO personalized_recipes (user_id,preference_hash,title,description,ingredients,instructions) VALUES (?,?,?,?,?,?)');
            $insert->execute([$user['id'], $hash, cleanText($recipe['title'], 180), cleanText($recipe['description'], 255),
                json_encode($recipe['ingredients'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                json_encode($instructions, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
            $referenceId = $pdo->lastInsertId();
        }
        $save = $pdo->prepare('INSERT INTO daily_meal_choices (user_id,plan_date,meal_type,recipe_id,preference_hash) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE recipe_id=VALUES(recipe_id),preference_hash=VALUES(preference_hash)');
        $save->execute([$user['id'], $date, $type, $referenceId, recipePreferenceHash($user, $preferences)]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function saveDailyMealChoice(PDO $pdo, array $user, array $preferences, string $date, string $type, mixed $recipeId): void
{
    // La ruta numérica habilita únicamente el catálogo validado; la validación existente de recetas personalizadas permanece intacta.
    if (is_string($recipeId) && preg_match('/^[1-9]\d*$/D', $recipeId)) {
        saveCatalogMealChoice($pdo, $user, $preferences, $date, $type, (int)$recipeId);
        return;
    }
    if (!is_string($recipeId) || !preg_match('/^personalized-([1-9]\d*)$/D', $recipeId, $matches)) throw new InvalidArgumentException('Selecciona una receta de las sugerencias de esta comida.');
    $compatibleHashes = compatibleMealOptionHashes($user,$preferences,$type);
    $placeholders = implode(',', array_fill(0, count($compatibleHashes), '?'));
    $stmt = $pdo->prepare("SELECT * FROM personalized_recipes WHERE id=? AND user_id=? AND preference_hash IN ($placeholders)");
    $stmt->execute([$matches[1], $user['id'], ...$compatibleHashes]);
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
    $requestDetails = [
        'action' => $action,
        'mealType' => $input['mealType'] ?? $_GET['mealType'] ?? null,
        'date' => $input['date'] ?? $_GET['date'] ?? null,
    ];
    error_log('[Paso 1] Petición recibida: ' . json_encode($requestDetails, JSON_UNESCAPED_UNICODE));
    try {
        $user = requireSessionUser($pdo);
        if ((string)($input['userId'] ?? $_GET['userId'] ?? $user['id']) !== (string)$user['id']) sendError('No puedes acceder al plan de otra cuenta.', 403);
        if ($_SERVER['REQUEST_METHOD'] !== ($action === 'plan.choose' ? 'POST' : 'GET')) sendError('Metodo no permitido.', 405);
        $preferences = withLifestylePreferences($pdo, $user, mapFoodPreferences(getFoodPreferencesRecord($pdo, (int)$user['id'])));
        $preferences['clinicalConditions'] = mealPlanClinicalConditions($pdo, (int)$user['id']);
        $type = $input['mealType'] ?? $_GET['mealType'] ?? null;
        if ($action !== 'plan.get' && !in_array($type, RECIPE_MEAL_TYPES, true)) throw new InvalidArgumentException('Selecciona un tipo de comida valido.');
        if ($action === 'plan.options') {
            $source = null;
            // Solo la solicitud explícita de reintento puede archivar un conjunto antiguo para regenerarlo.
            $recoverCache = in_array($input['recoverCache'] ?? $_GET['recoverCache'] ?? null, [true, 1, '1'], true);
            $recipes = readMealOptions($pdo, $user, $preferences, $type, $apiKey, $model, $source, $recoverCache);
            error_log('[Paso 3] Respuesta procesada');
            // El frontend necesita distinguir las opciones generadas de las reutilizadas para explicar el respaldo correctamente.
            sendJson(['recipes' => $recipes, 'source' => $source]);
        }
        $date = validatePlanDate($input['date'] ?? $_GET['date'] ?? null);
        if ($action === 'plan.choose') {
            if (array_key_exists('recipeId', $input) && $input['recipeId'] === null) clearDailyMealChoice($pdo, (int)$user['id'], $date, $type);
            else saveDailyMealChoice($pdo, $user, $preferences, $date, $type, $input['recipeId'] ?? null);
        }
        sendJson(readDailyMealChoices($pdo, $user, $preferences, $date));
    } catch (PDOException $error) {
        error_log('[Plan alimenticio] Error de base de datos: ' . $error->getMessage());
        sendJson(['error' => 'Error al consultar la base de datos de recetas.', 'code' => 'database_error'], 500);
    } catch (InvalidArgumentException $error) {
        sendError($error->getMessage(), 422);
    }
}
