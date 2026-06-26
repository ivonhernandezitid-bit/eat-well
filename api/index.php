<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$host = '127.0.0.1';
$database = 'eatwell_db';
$username = 'root';
$password = '';
$localConfigPath = __DIR__ . '/config.local.php';
$localConfig = file_exists($localConfigPath) ? require $localConfigPath : [];
$environmentApiKey = trim((string)(getenv('GEMINI_API_KEY') ?: ''));
$geminiApiKey = $environmentApiKey !== ''
    ? $environmentApiKey
    : trim((string)($localConfig['geminiApiKey'] ?? ''));
$geminiModel = trim((string)(getenv('GEMINI_MODEL') ?: ($localConfig['geminiModel'] ?? 'gemini-3.5-flash')));

try {
    $pdo = new PDO(
        "mysql:host={$host};dbname={$database};charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ],
    );
} catch (PDOException $exception) {
    sendError('No se pudo conectar a MySQL. Revisa XAMPP y la base eatwell_db.', 500);
}

$action = $_GET['action'] ?? '';
$decodedInput = json_decode(file_get_contents('php://input') ?: '{}', true);
$input = is_array($decodedInput) ? $decodedInput : [];

try {
    switch ($action) {
        case 'auth.register':
            registerUser($pdo, $input);
            break;
        case 'auth.login':
            loginUser($pdo, $input);
            break;
        case 'profile.get':
            getProfile($pdo, (int)($_GET['userId'] ?? 0));
            break;
        case 'profile.update':
            updateProfile($pdo, $input);
            break;
        case 'preferences.get':
            getFoodPreferences($pdo, (int)($_GET['userId'] ?? 0));
            break;
        case 'preferences.save':
            saveFoodPreferences($pdo, $input);
            break;
        case 'recipes.recommendations':
            getRecipeRecommendations(
                $pdo,
                (int)($_GET['userId'] ?? 0),
                $geminiApiKey,
                $geminiModel,
            );
            break;
        case 'favorites.list':
            getFavoriteRecipes($pdo, (int)($_GET['userId'] ?? 0));
            break;
        case 'favorites.add':
            addFavoriteRecipe($pdo, $input);
            break;
        case 'favorites.remove':
            removeFavoriteRecipe($pdo, $input);
            break;
        case 'exercises.byZone':
            getExercisesByZone($pdo, (string)($_GET['bodyZone'] ?? 'full_body'));
            break;
        case 'exercises.generate':
            generateExercises($pdo, $input, $geminiApiKey, $geminiModel);
            break;
        case 'routines.generate':
            generateRoutine($pdo, $input, $geminiApiKey, $geminiModel);
            break;
        case 'scanner.analyze':
            analyzeFood($pdo, $input, $geminiApiKey, $geminiModel);
            break;
        case 'scanner.recommendations':
            getScanRecommendations($pdo, (int)($_GET['userId'] ?? 0));
            break;
        case 'scanner.recipeDetail':
            getScanRecipeDetail(
                $pdo,
                (int)($_GET['userId'] ?? 0),
                (int)($_GET['recipeId'] ?? 0),
            );
            break;
        default:
            sendError('Accion no encontrada.', 404);
    }
} catch (Throwable $exception) {
    sendError($exception->getMessage(), 500);
}

function registerUser(PDO $pdo, array $input): void
{
    $name = trim((string)($input['name'] ?? ''));
    $email = strtolower(trim((string)($input['email'] ?? '')));
    $requestedUsername = strtolower(trim((string)($input['username'] ?? '')));
    $finalUsername = $requestedUsername !== '' ? $requestedUsername : explode('@', $email)[0];
    $plainPassword = trim((string)($input['password'] ?? ''));

    if ($name === '' || $email === '' || $plainPassword === '') {
        sendError('Nombre, correo y contrasena son obligatorios.', 422);
    }

    $statement = $pdo->prepare('SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1');
    $statement->execute([$email, $finalUsername]);

    if ($statement->fetch()) {
        sendError('Ya existe una cuenta registrada con ese correo o usuario.', 409);
    }

    $passwordHash = password_hash($plainPassword, PASSWORD_DEFAULT);
    $statement = $pdo->prepare(
        'INSERT INTO users (name, username, email, password_hash) VALUES (?, ?, ?, ?)',
    );
    $statement->execute([
        $name,
        $finalUsername,
        $email,
        $passwordHash,
    ]);

    sendJson(['user' => mapUser(getUserById($pdo, (int)$pdo->lastInsertId()))], 201);
}

function loginUser(PDO $pdo, array $input): void
{
    $identifier = strtolower(trim((string)($input['email'] ?? '')));
    $plainPassword = trim((string)($input['password'] ?? ''));

    $statement = $pdo->prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1');
    $statement->execute([$identifier, $identifier]);
    $user = $statement->fetch();

    if (!$user || !password_verify($plainPassword, $user['password_hash'])) {
        sendError('Correo o contrasena incorrectos.', 401);
    }

    sendJson(['user' => mapUser($user)]);
}

function getProfile(PDO $pdo, int $userId): void
{
    sendJson(['user' => mapUser(getUserById($pdo, $userId))]);
}

function updateProfile(PDO $pdo, array $input): void
{
    $userId = (int)($input['id'] ?? 0);

    if ($userId <= 0) {
        sendError('Usuario invalido.', 422);
    }

    $heightCm = (float)($input['heightCm'] ?? 170);
    $weightKg = (float)($input['weightKg'] ?? 70);
    $imc = calculateImc($weightKg, $heightCm);

    $statement = $pdo->prepare(
        'UPDATE users
         SET name = ?, age = ?, gender = ?, height_cm = ?, weight_kg = ?, imc = ?, activity_level = ?, goal = ?
         WHERE id = ?',
    );
    $statement->execute([
        trim((string)($input['name'] ?? '')),
        (int)($input['age'] ?? 18),
        (string)($input['gender'] ?? 'other'),
        $heightCm,
        $weightKg,
        $imc,
        (string)($input['activityLevel'] ?? 'moderate'),
        (string)($input['goal'] ?? 'improve_health'),
        $userId,
    ]);

    if (array_key_exists('profileImage', $input)) {
        $statement = $pdo->prepare('UPDATE users SET profile_image = ? WHERE id = ?');
        $statement->execute([
            trim((string)($input['profileImage'] ?? '')) ?: null,
            $userId,
        ]);
    }

    sendJson(['user' => mapUser(getUserById($pdo, $userId))]);
}

function getFoodPreferences(PDO $pdo, int $userId): void
{
    getUserById($pdo, $userId);
    sendJson(['preferences' => mapFoodPreferences(getFoodPreferencesRecord($pdo, $userId))]);
}

function saveFoodPreferences(PDO $pdo, array $input): void
{
    $userId = (int)($input['userId'] ?? 0);
    getUserById($pdo, $userId);
    $dietType = (string)($input['dietType'] ?? 'omnivore');
    $allowedDietTypes = ['omnivore', 'vegetarian', 'vegan', 'pescatarian'];

    if (!in_array($dietType, $allowedDietTypes, true)) {
        $dietType = 'omnivore';
    }

    $statement = $pdo->prepare(
        'INSERT INTO food_preferences
         (user_id, diet_type, preferred_fruits, preferred_vegetables, allergies,
          disliked_foods, cooking_time_minutes, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
           diet_type = VALUES(diet_type),
           preferred_fruits = VALUES(preferred_fruits),
           preferred_vegetables = VALUES(preferred_vegetables),
           allergies = VALUES(allergies),
           disliked_foods = VALUES(disliked_foods),
           cooking_time_minutes = VALUES(cooking_time_minutes),
           completed_at = CURRENT_TIMESTAMP',
    );
    $statement->execute([
        $userId,
        $dietType,
        json_encode(cleanStringList($input['preferredFruits'] ?? [], 30), JSON_UNESCAPED_UNICODE),
        json_encode(cleanStringList($input['preferredVegetables'] ?? [], 30), JSON_UNESCAPED_UNICODE),
        json_encode(cleanStringList($input['allergies'] ?? [], 20), JSON_UNESCAPED_UNICODE),
        json_encode(cleanStringList($input['dislikedFoods'] ?? [], 30), JSON_UNESCAPED_UNICODE),
        max(10, min(120, (int)($input['cookingTimeMinutes'] ?? 30))),
    ]);

    sendJson(['preferences' => mapFoodPreferences(getFoodPreferencesRecord($pdo, $userId))]);
}

function getFoodPreferencesRecord(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare('SELECT * FROM food_preferences WHERE user_id = ? LIMIT 1');
    $statement->execute([$userId]);
    $preferences = $statement->fetch();

    return $preferences ?: [
        'user_id' => $userId,
        'diet_type' => 'omnivore',
        'preferred_fruits' => '[]',
        'preferred_vegetables' => '[]',
        'allergies' => '[]',
        'disliked_foods' => '[]',
        'cooking_time_minutes' => 30,
        'completed_at' => null,
    ];
}

function mapFoodPreferences(array $preferences): array
{
    return [
        'dietType' => $preferences['diet_type'],
        'preferredFruits' => decodeJsonList($preferences['preferred_fruits']),
        'preferredVegetables' => decodeJsonList($preferences['preferred_vegetables']),
        'allergies' => decodeJsonList($preferences['allergies']),
        'dislikedFoods' => decodeJsonList($preferences['disliked_foods']),
        'cookingTimeMinutes' => (int)$preferences['cooking_time_minutes'],
        'completed' => $preferences['completed_at'] !== null,
    ];
}

function getRecipeRecommendations(PDO $pdo, int $userId, string $apiKey, string $model): void
{
    $user = getUserById($pdo, $userId);
    $preferences = getFoodPreferencesRecord($pdo, $userId);
    $preferenceHash = hash('sha256', json_encode([
        $user['goal'],
        $user['imc'],
        mapFoodPreferences($preferences),
    ], JSON_UNESCAPED_UNICODE));
    $cachedStatement = $pdo->prepare(
        'SELECT * FROM personalized_recipes
         WHERE user_id = ? AND preference_hash = ? ORDER BY id ASC LIMIT 6',
    );
    $cachedStatement->execute([$userId, $preferenceHash]);
    $cachedRecipes = $cachedStatement->fetchAll();

    if (count($cachedRecipes) > 0) {
        sendJson(['recipes' => array_map('mapPersonalizedRecipe', $cachedRecipes)]);
    }

    $mappedPreferences = mapFoodPreferences($preferences);

    if ($mappedPreferences['completed'] && $apiKey !== '') {
        $prompt = "Genera 4 recetas practicas en espanol para este perfil. "
            . "Objetivo: {$user['goal']}. IMC: {$user['imc']}. "
            . "Tipo de alimentacion: {$mappedPreferences['dietType']}. "
            . "Frutas preferidas: " . implode(', ', $mappedPreferences['preferredFruits']) . ". "
            . "Verduras preferidas: " . implode(', ', $mappedPreferences['preferredVegetables']) . ". "
            . "Alergias: " . implode(', ', $mappedPreferences['allergies']) . ". "
            . "Alimentos no deseados: " . implode(', ', $mappedPreferences['dislikedFoods']) . ". "
            . "Tiempo maximo aproximado: {$mappedPreferences['cookingTimeMinutes']} minutos. "
            . "Nunca incluyas alergenos ni alimentos no deseados. "
            . "Devuelve unicamente un array JSON con 4 objetos. "
            . "Cada receta debe tener title, description, ingredients e instructions.";
        $schema = [
            'type' => 'ARRAY',
            'items' => [
                'type' => 'OBJECT',
                'required' => ['title', 'description', 'ingredients', 'instructions'],
                'properties' => [
                    'title' => ['type' => 'STRING'],
                    'description' => ['type' => 'STRING'],
                    'ingredients' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                    'instructions' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                ],
            ],
        ];
        $generatedRecipes = requestGeminiText($apiKey, $model, $prompt, $schema, true);

        if (count($generatedRecipes) > 0) {
            $insert = $pdo->prepare(
                'INSERT INTO personalized_recipes
                 (user_id, preference_hash, title, description, ingredients, instructions)
                 VALUES (?, ?, ?, ?, ?, ?)',
            );

            foreach (array_slice($generatedRecipes, 0, 4) as $recipe) {
                if (!is_array($recipe)) {
                    continue;
                }

                $insert->execute([
                    $userId,
                    $preferenceHash,
                    cleanText($recipe['title'] ?? 'Receta sugerida', 180),
                    cleanText($recipe['description'] ?? 'Recomendacion segun tus preferencias.', 255),
                    json_encode(cleanStringList($recipe['ingredients'] ?? [], 30), JSON_UNESCAPED_UNICODE),
                    json_encode(cleanStringList($recipe['instructions'] ?? [], 20), JSON_UNESCAPED_UNICODE),
                ]);
            }

            $cachedStatement->execute([$userId, $preferenceHash]);
            sendJson(['recipes' => array_map('mapPersonalizedRecipe', $cachedStatement->fetchAll())]);
        }
    }

    $statement = $pdo->prepare(
        'SELECT * FROM recipes
         WHERE goal = ?
         AND (min_imc IS NULL OR min_imc <= ?)
         AND (max_imc IS NULL OR max_imc >= ?)
         ORDER BY calories ASC',
    );
    $statement->execute([$user['goal'], $user['imc'], $user['imc']]);
    $recipes = array_map('mapRecipe', $statement->fetchAll());

    sendJson(['recipes' => $recipes]);
}

function mapPersonalizedRecipe(array $recipe): array
{
    return [
        'id' => 'personalized-' . $recipe['id'],
        'title' => $recipe['title'],
        'description' => $recipe['description'],
        'calories' => 0,
        'proteinGrams' => 0,
        'carbsGrams' => 0,
        'fatGrams' => 0,
        'ingredients' => decodeJsonList($recipe['ingredients']),
        'instructions' => decodeJsonList($recipe['instructions']),
        'goals' => [],
    ];
}

function getFavoriteRecipes(PDO $pdo, int $userId): void
{
    getUserById($pdo, $userId);
    $statement = $pdo->prepare(
        'SELECT * FROM favorite_recipes WHERE user_id = ? ORDER BY created_at DESC',
    );
    $statement->execute([$userId]);
    sendJson(['recipes' => array_map('mapFavoriteRecipe', $statement->fetchAll())]);
}

function addFavoriteRecipe(PDO $pdo, array $input): void
{
    $userId = (int)($input['userId'] ?? 0);
    getUserById($pdo, $userId);
    $title = cleanText($input['title'] ?? '', 180);

    if ($title === '') {
        sendError('La receta no es valida.', 422);
    }

    $statement = $pdo->prepare(
        'INSERT INTO favorite_recipes
         (user_id, title, description, image_url, ingredients, instructions, source_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           description = VALUES(description),
           image_url = VALUES(image_url),
           ingredients = VALUES(ingredients),
           instructions = VALUES(instructions),
           source_type = VALUES(source_type)',
    );
    $statement->execute([
        $userId,
        $title,
        cleanText($input['description'] ?? '', 255),
        cleanText($input['imageUrl'] ?? '', 2000) ?: null,
        json_encode(cleanStringList($input['ingredients'] ?? [], 30), JSON_UNESCAPED_UNICODE),
        json_encode(cleanStringList($input['instructions'] ?? [], 20), JSON_UNESCAPED_UNICODE),
        cleanText($input['sourceType'] ?? 'generated', 30),
    ]);
    $select = $pdo->prepare('SELECT * FROM favorite_recipes WHERE user_id = ? AND title = ? LIMIT 1');
    $select->execute([$userId, $title]);
    sendJson(['recipe' => mapFavoriteRecipe($select->fetch())], 201);
}

function removeFavoriteRecipe(PDO $pdo, array $input): void
{
    $userId = (int)($input['userId'] ?? 0);
    $favoriteId = (int)($input['favoriteId'] ?? 0);
    getUserById($pdo, $userId);
    $statement = $pdo->prepare('DELETE FROM favorite_recipes WHERE id = ? AND user_id = ?');
    $statement->execute([$favoriteId, $userId]);
    sendJson(['removed' => true]);
}

function mapFavoriteRecipe(array $recipe): array
{
    return [
        'id' => 'favorite-' . $recipe['id'],
        'favoriteId' => (string)$recipe['id'],
        'title' => $recipe['title'],
        'description' => $recipe['description'],
        'imageUrl' => $recipe['image_url'] ?? '',
        'sourceUrl' => '',
        'ingredients' => decodeJsonList($recipe['ingredients']),
        'instructions' => decodeJsonList($recipe['instructions']),
        'detailsLoaded' => true,
    ];
}

function getExercisesByZone(PDO $pdo, string $bodyZone): void
{
    $statement = $pdo->prepare(
        'SELECT * FROM exercises WHERE body_zone IN (?, "full_body") ORDER BY body_zone = "full_body", title',
    );
    $statement->execute([$bodyZone]);
    $exercises = array_map('mapExercise', $statement->fetchAll());

    sendJson(['exercises' => $exercises]);
}

function analyzeFood(PDO $pdo, array $input, string $apiKey, string $model): void
{
    $userId = (int)($input['userId'] ?? 0);

    if ($userId <= 0) {
        sendError('Inicia sesion para guardar las recetas generadas.', 401);
    }

    if ($apiKey === '') {
        sendError('Google AI Studio no esta configurado en el servidor.', 503);
    }

    $user = getUserById($pdo, $userId);
    $preferences = mapFoodPreferences(getFoodPreferencesRecord($pdo, $userId));
    $imageBase64 = trim((string)($input['imageBase64'] ?? ''));
    [$imageBytes, $mimeType] = decodeFoodImage($imageBase64);
    $geminiResult = requestGeminiFoodAnalysis(
        $apiKey,
        $model,
        $imageBytes,
        $mimeType,
        $user,
        $preferences,
    );
    $foodName = cleanText($geminiResult['foodName'] ?? 'Ingredientes detectados', 150);
    $detectedIngredients = cleanStringList($geminiResult['detectedIngredients'] ?? [], 20);
    $recommendation = cleanText(
        $geminiResult['recommendation'] ?? 'Generamos recetas con los ingredientes visibles en tu foto.',
        500,
    );
    $generatedRecipes = [];

    foreach (array_slice($geminiResult['recipes'] ?? [], 0, 4) as $recipe) {
        if (!is_array($recipe)) {
            continue;
        }

        $title = cleanText($recipe['title'] ?? '', 180);
        $ingredients = cleanStringList($recipe['ingredients'] ?? [], 30);
        $instructions = cleanStringList($recipe['instructions'] ?? [], 20);

        if ($title === '' || count($ingredients) === 0 || count($instructions) === 0) {
            continue;
        }

        $generatedRecipes[] = [
            'title' => $title,
            'description' => cleanText(
                $recipe['description'] ?? 'Receta creada con los ingredientes detectados.',
                255,
            ),
            'ingredients' => $ingredients,
            'instructions' => $instructions,
        ];
    }

    if (count($generatedRecipes) === 0) {
        sendError('No fue posible generar recetas completas con esta imagen. Prueba con una foto mas clara.', 422);
    }

    $statement = $pdo->prepare(
        'INSERT INTO food_scans
         (user_id, detected_food, detected_ingredients, ai_recommendation, ai_provider)
         VALUES (?, ?, ?, ?, ?)',
    );
    $statement->execute([
        $userId,
        $foodName,
        json_encode($detectedIngredients, JSON_UNESCAPED_UNICODE),
        $recommendation,
        'gemini',
    ]);
    $scanId = (int)$pdo->lastInsertId();
    $suggestedRecipes = [];

    foreach ($generatedRecipes as $index => $recipe) {
        $suggestedRecipes[] = [
            'id' => "scan-{$scanId}-{$index}",
            'title' => $recipe['title'],
            'description' => $recipe['description'],
            'imageUrl' => '',
            'sourceUrl' => '',
            'ingredients' => $recipe['ingredients'],
            'instructions' => $recipe['instructions'],
            'detailsLoaded' => true,
        ];
    }

    sendJson([
        'result' => [
            'status' => 'analyzed',
            'foodName' => $foodName,
            'detectedIngredients' => $detectedIngredients,
            'recommendation' => $recommendation,
            'suggestedRecipes' => $suggestedRecipes,
        ],
    ]);
}

function getScanRecommendations(PDO $pdo, int $userId): void
{
    if ($userId <= 0) {
        sendError('Usuario invalido.', 422);
    }

    getUserById($pdo, $userId);
    $statement = $pdo->prepare(
        'SELECT id, title, description, ingredients, instructions
         FROM ai_generated_recipes
         WHERE scan_id = (
             SELECT id FROM food_scans WHERE user_id = ? ORDER BY id DESC LIMIT 1
         )
         ORDER BY id ASC',
    );
    $statement->execute([$userId]);
    $recipes = array_map(
        'mapGeneratedRecipe',
        $statement->fetchAll(),
    );

    sendJson(['recipes' => $recipes]);
}

function getScanRecipeDetail(PDO $pdo, int $userId, int $recipeId): void
{
    if ($userId <= 0 || $recipeId <= 0) {
        sendError('Usuario o receta invalida.', 422);
    }

    getUserById($pdo, $userId);
    $statement = $pdo->prepare(
        'SELECT id, title, description, ingredients, instructions
         FROM ai_generated_recipes
         WHERE user_id = ? AND id = ? LIMIT 1',
    );
    $statement->execute([$userId, $recipeId]);
    $savedRecipe = $statement->fetch();

    if (!$savedRecipe) {
        sendError('La receta generada no pertenece al usuario.', 404);
    }

    sendJson(['recipe' => mapGeneratedRecipe($savedRecipe)]);
}

function mapGeneratedRecipe(array $recipe): array
{
    return [
        'id' => (string)$recipe['id'],
        'title' => $recipe['title'],
        'description' => $recipe['description'],
        'imageUrl' => '',
        'sourceUrl' => '',
        'ingredients' => is_array($recipe['ingredients']) ? $recipe['ingredients'] : decodeJsonList($recipe['ingredients']),
        'instructions' => is_array($recipe['instructions']) ? $recipe['instructions'] : decodeJsonList($recipe['instructions']),
        'detailsLoaded' => true,
    ];
}

function cleanText(mixed $value, int $maxLength): string
{
    $text = trim(preg_replace('/\s+/u', ' ', strip_tags((string)$value)) ?? '');
    return mb_substr($text, 0, $maxLength);
}

function cleanStringList(mixed $value, int $limit): array
{
    if (!is_array($value)) {
        return [];
    }

    $items = array_map(
        static fn(mixed $item): string => cleanText($item, 300),
        array_slice($value, 0, $limit),
    );
    return array_values(array_filter($items, static fn(string $item): bool => $item !== ''));
}

function decodeJsonList(mixed $value): array
{
    if (!is_string($value) || trim($value) === '') {
        return [];
    }

    $decoded = json_decode($value, true);

    return is_array($decoded)
        ? array_values(array_filter(
            $decoded,
            static fn(mixed $item): bool => is_string($item) && trim($item) !== '',
        ))
        : [];
}

function decodeFoodImage(string $dataUrl): array
{
    if (!preg_match('/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s', $dataUrl, $matches)) {
        sendError('Selecciona una imagen JPG, PNG o WEBP valida.', 422);
    }

    $imageBytes = base64_decode($matches[2], true);

    if ($imageBytes === false || $imageBytes === '') {
        sendError('No se pudo leer la imagen seleccionada.', 422);
    }

    if (strlen($imageBytes) > 6 * 1024 * 1024) {
        sendError('La imagen es demasiado grande. El limite es de 6 MB.', 413);
    }

    $mimeType = $matches[1];
    $extension = $mimeType === 'image/png' ? 'png' : ($mimeType === 'image/webp' ? 'webp' : 'jpg');

    return [$imageBytes, $mimeType, $extension];
}

function requestGeminiFoodAnalysis(
    string $apiKey,
    string $model,
    string $imageBytes,
    string $mimeType,
    array $user,
    array $preferences,
): array {
    if (!function_exists('curl_init')) {
        sendError('La extension cURL de PHP no esta activa en XAMPP.', 500);
    }

    $goalLabels = [
        'lose_weight' => 'bajar de peso',
        'maintain' => 'mantener su peso',
        'gain_muscle' => 'ganar masa muscular',
        'improve_health' => 'mejorar su salud',
    ];
    $goal = $goalLabels[$user['goal'] ?? ''] ?? 'comer de forma equilibrada';
    $preferenceContext = "Tipo de alimentacion: {$preferences['dietType']}. "
        . "Frutas preferidas: " . implode(', ', $preferences['preferredFruits']) . ". "
        . "Verduras preferidas: " . implode(', ', $preferences['preferredVegetables']) . ". "
        . "Alergias: " . implode(', ', $preferences['allergies']) . ". "
        . "Alimentos no deseados: " . implode(', ', $preferences['dislikedFoods']) . ". ";
    $prompt = "Analiza la fotografia de alimentos o ingredientes. Responde en espanol. "
        . "Identifica solamente ingredientes que sean razonablemente visibles. Despues crea exactamente cuatro "
        . "recetas practicas que aprovechen esos ingredientes para una persona cuyo objetivo es {$goal}. "
        . $preferenceContext
        . "Nunca incluyas alergenos ni alimentos no deseados; usa sustituciones seguras cuando sea necesario. "
        . "Puedes agregar agua, sal y una pequena cantidad de aceite como basicos de despensa. "
        . "No incluyas calorias, macronutrientes, porcentajes de confianza ni afirmaciones medicas. "
        . "Cada receta debe incluir una descripcion breve, ingredientes con cantidades y pasos completos.";
    $schema = [
        'type' => 'OBJECT',
        'required' => ['foodName', 'detectedIngredients', 'recommendation', 'recipes'],
        'properties' => [
            'foodName' => ['type' => 'STRING'],
            'detectedIngredients' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
            'recommendation' => ['type' => 'STRING'],
            'recipes' => [
                'type' => 'ARRAY',
                'minItems' => 4,
                'maxItems' => 4,
                'items' => [
                    'type' => 'OBJECT',
                    'required' => ['title', 'description', 'ingredients', 'instructions'],
                    'properties' => [
                        'title' => ['type' => 'STRING'],
                        'description' => ['type' => 'STRING'],
                        'ingredients' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                        'instructions' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                    ],
                ],
            ],
        ],
    ];
    $payload = [
        'contents' => [[
            'role' => 'user',
            'parts' => [
                ['text' => $prompt],
                ['inlineData' => [
                    'mimeType' => $mimeType,
                    'data' => base64_encode($imageBytes),
                ]],
            ],
        ]],
        'generationConfig' => [
            'temperature' => 0.35,
            'maxOutputTokens' => 5000,
            'responseMimeType' => 'application/json',
            'responseSchema' => $schema,
        ],
    ];
    $modelName = preg_replace('#^models/#', '', trim($model)) ?: 'gemini-3.5-flash';
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/'
        . rawurlencode($modelName) . ':generateContent';
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json',
            'x-goog-api-key: ' . $apiKey,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 60,
    ]);
    $responseBody = curl_exec($curl);
    $statusCode = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);

    if ($responseBody === false) {
        sendError('No se pudo conectar con Google AI Studio: ' . $curlError, 502);
    }

    $response = json_decode($responseBody, true);
    $response = is_array($response) ? $response : [];

    if ($statusCode === 429) {
        sendError('Google AI Studio alcanzo temporalmente su limite de solicitudes. Intenta mas tarde.', 429);
    }

    if ($statusCode === 400 || $statusCode === 401 || $statusCode === 403) {
        $apiMessage = cleanText($response['error']['message'] ?? 'Revisa la clave y el modelo configurado.', 300);

        if ($statusCode === 403 && str_contains(strtolower($apiMessage), 'denied access')) {
            sendError('El proyecto de Google asociado a la clave no tiene acceso a Gemini. Crea otra clave en Google AI Studio.', 503);
        }

        sendError('Google AI Studio: ' . $apiMessage, 502);
    }

    if ($statusCode < 200 || $statusCode >= 300) {
        $apiMessage = cleanText($response['error']['message'] ?? 'No se pudo analizar la imagen.', 300);
        sendError('Google AI Studio: ' . $apiMessage, 502);
    }

    $parts = $response['candidates'][0]['content']['parts'] ?? [];
    $jsonText = '';

    foreach ($parts as $part) {
        if (is_array($part)) {
            $jsonText .= (string)($part['text'] ?? '');
        }
    }

    $result = json_decode(trim($jsonText), true);

    if (!is_array($result)) {
        sendError('Google AI Studio devolvió una respuesta que no se pudo interpretar.', 502);
    }

    return $result;
}

function getUserById(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $statement->execute([$userId]);
    $user = $statement->fetch();

    if (!$user) {
        sendError('Usuario no encontrado.', 404);
    }

    return $user;
}

function mapUser(array $user): array
{
    return [
        'id' => (string)$user['id'],
        'name' => $user['name'],
        'username' => $user['username'],
        'email' => $user['email'],
        'profileImage' => $user['profile_image'] ?? null,
        'age' => (int)$user['age'],
        'gender' => $user['gender'],
        'heightCm' => (float)$user['height_cm'],
        'weightKg' => (float)$user['weight_kg'],
        'imc' => (float)$user['imc'],
        'activityLevel' => $user['activity_level'],
        'goal' => $user['goal'],
        'createdAt' => $user['created_at'],
        'updatedAt' => $user['updated_at'],
    ];
}

function mapRecipe(array $recipe): array
{
    return [
        'id' => (string)$recipe['id'],
        'title' => $recipe['title'],
        'description' => $recipe['description'],
        'calories' => (int)$recipe['calories'],
        'proteinGrams' => (float)$recipe['protein_grams'],
        'carbsGrams' => (float)$recipe['carbs_grams'],
        'fatGrams' => (float)$recipe['fat_grams'],
        'ingredients' => explode('|', $recipe['ingredients']),
        'instructions' => explode('|', $recipe['instructions']),
        'goals' => [$recipe['goal']],
        'minImc' => $recipe['min_imc'] !== null ? (float)$recipe['min_imc'] : null,
        'maxImc' => $recipe['max_imc'] !== null ? (float)$recipe['max_imc'] : null,
    ];
}

function mapExercise(array $exercise): array
{
    return [
        'id' => (string)$exercise['id'],
        'title' => $exercise['title'],
        'bodyZone' => $exercise['body_zone'],
        'difficulty' => $exercise['difficulty'],
        'durationMinutes' => (int)$exercise['duration_minutes'],
        'repetitions' => $exercise['repetitions'],
        'instructions' => explode('|', $exercise['instructions']),
        'recommendations' => $exercise['recommendations'],
    ];
}

function calculateImc(float $weightKg, float $heightCm): float
{
    $heightMeters = $heightCm / 100;
    return round($weightKg / ($heightMeters * $heightMeters), 2);
}

function sendJson(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

function sendError(string $message, int $statusCode = 400): void
{
    sendJson(['error' => $message], $statusCode);
}

function generateExercises(PDO $pdo, array $input, string $apiKey, string $model): void
{
    $muscle = trim((string)($input['muscle'] ?? ''));

    if ($muscle === '') {
        sendError('El musculo a consultar es obligatorio.', 422);
    }

    if ($apiKey === '') {
        sendError('Google AI Studio no esta configurado en el servidor.', 503);
    }

    $prompt = "Genera 6 ejercicios para {$muscle}. "
        . "Devuelve ÚNICAMENTE un array JSON válido sin markdown, sin explicaciones, solo el array. "
        . "Cada objeto debe tener:\n"
        . "- nombre: nombre del ejercicio en español\n"
        . "- musculo: músculo objetivo en español\n"
        . "- equipo: equipo necesario en español (usar 'Sin equipo' si no se necesita nada)\n"
        . "- dificultad: 'Principiante', 'Intermedio' o 'Avanzado'\n"
        . "- series: número (ej. 3)\n"
        . "- repeticiones: string (ej. '10-12' o '30 segundos')\n"
        . "- instrucciones: array de 3-4 strings en español explicando cómo realizarlo";

    $schema = [
        'type' => 'ARRAY',
        'minItems' => 6,
        'maxItems' => 6,
        'items' => [
            'type' => 'OBJECT',
            'required' => ['nombre', 'musculo', 'equipo', 'dificultad', 'series', 'repeticiones', 'instrucciones'],
            'properties' => [
                'nombre' => ['type' => 'STRING'],
                'musculo' => ['type' => 'STRING'],
                'equipo' => ['type' => 'STRING'],
                'dificultad' => [
                    'type' => 'STRING',
                    'enum' => ['Principiante', 'Intermedio', 'Avanzado']
                ],
                'series' => ['type' => 'INTEGER'],
                'repeticiones' => ['type' => 'STRING'],
                'instrucciones' => [
                    'type' => 'ARRAY',
                    'items' => ['type' => 'STRING']
                ]
            ]
        ]
    ];

    $exercises = requestGeminiText($apiKey, $model, $prompt, $schema);

    sendJson(['exercises' => $exercises]);
}

function generateRoutine(PDO $pdo, array $input, string $apiKey, string $model): void
{
    $edad = max(13, min(100, (int)($input['edad'] ?? 18)));
    $peso = max(30, min(300, (float)($input['peso'] ?? 70)));
    $altura = max(120, min(230, (float)($input['altura'] ?? 170)));
    $imc = max(10, min(70, (float)($input['imc'] ?? 24)));
    $actividad = trim((string)($input['actividad'] ?? 'moderate'));
    $objetivo = trim((string)($input['objetivo'] ?? 'Mejorar resistencia'));
    $dias = (int)($input['dias'] ?? 3);
    $nivel = trim((string)($input['nivel'] ?? 'Principiante'));
    $equipo = trim((string)($input['equipo'] ?? 'Sin equipo'));
    $musculosList = is_array($input['musculos'] ?? null) ? $input['musculos'] : [];
    $musculos = implode(', ', $musculosList);

    if ($apiKey === '') {
        sendError('Google AI Studio no esta configurado en el servidor.', 503);
    }

    $prompt = "Crea una rutina de entrenamiento semanal en español con estas preferencias:\n"
        . "- Edad: {$edad} años\n"
        . "- Peso: {$peso} kg\n"
        . "- Altura: {$altura} cm\n"
        . "- IMC: {$imc}\n"
        . "- Actividad habitual: {$actividad}\n"
        . "- Objetivo: {$objetivo}\n"
        . "- Días disponibles por semana: {$dias}\n"
        . "- Nivel: {$nivel}\n"
        . "- Equipo disponible: {$equipo}\n"
        . "- Músculos a enfocar: {$musculos}\n\n"
        . "Devuelve ÚNICAMENTE un objeto JSON válido sin markdown, sin explicaciones, solo el objeto.\n"
        . "Estructura:\n"
        . "{\n"
        . "  'planSemanal': [\n"
        . "    {\n"
        . "      'dia': 'Lunes',\n"
        . "      'enfoque': 'nombre del grupo muscular',\n"
        . "      'ejercicios': [\n"
        . "        {\n"
        . "          'nombre': string,\n"
        . "          'musculo': string,\n"
        . "          'equipo': string,\n"
        . "          'series': number,\n"
        . "          'repeticiones': string,\n"
        . "          'descanso': '60 segundos',\n"
        . "          'instrucciones': string[]\n"
        . "        }\n"
        . "      ]\n"
        . "    }\n"
        . "  ]\n"
        . "}";

    $schema = [
        'type' => 'OBJECT',
        'required' => ['planSemanal'],
        'properties' => [
            'planSemanal' => [
                'type' => 'ARRAY',
                'items' => [
                    'type' => 'OBJECT',
                    'required' => ['dia', 'enfoque', 'ejercicios'],
                    'properties' => [
                        'dia' => ['type' => 'STRING'],
                        'enfoque' => ['type' => 'STRING'],
                        'ejercicios' => [
                            'type' => 'ARRAY',
                            'items' => [
                                'type' => 'OBJECT',
                                'required' => ['nombre', 'musculo', 'equipo', 'series', 'repeticiones', 'descanso', 'instrucciones'],
                                'properties' => [
                                    'nombre' => ['type' => 'STRING'],
                                    'musculo' => ['type' => 'STRING'],
                                    'equipo' => ['type' => 'STRING'],
                                    'series' => ['type' => 'INTEGER'],
                                    'repeticiones' => ['type' => 'STRING'],
                                    'descanso' => ['type' => 'STRING'],
                                    'instrucciones' => [
                                        'type' => 'ARRAY',
                                        'items' => ['type' => 'STRING']
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]
            ]
        ]
    ];

    $routine = requestGeminiText($apiKey, $model, $prompt, $schema);

    sendJson(['routine' => $routine]);
}

function requestGeminiText(
    string $apiKey,
    string $model,
    string $prompt,
    array $schema,
    bool $allowFailure = false,
): array {
    if (!function_exists('curl_init')) {
        sendError('La extension cURL de PHP no esta activa en XAMPP.', 500);
    }

    $payload = [
        'contents' => [[
            'role' => 'user',
            'parts' => [
                ['text' => $prompt]
            ],
        ]],
        'generationConfig' => [
            'temperature' => 0.4,
            'maxOutputTokens' => ($schema['type'] ?? '') === 'ARRAY' ? 2500 : 5000,
            'responseMimeType' => 'application/json',
        ],
    ];

    $preferredModel = preg_replace('#^models/#', '', trim($model)) ?: 'gemini-3.5-flash';
    $modelCandidates = [
        'gemini-2.5-flash',
        $preferredModel,
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
    ];
    $responseBody = false;
    $response = [];
    $statusCode = 0;
    $curlError = '';

    foreach ($modelCandidates as $index => $modelName) {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/'
            . rawurlencode($modelName) . ':generateContent';
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'x-goog-api-key: ' . $apiKey,
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 75,
        ]);

        $responseBody = curl_exec($curl);
        $statusCode = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $curlError = curl_error($curl);
        curl_close($curl);
        $response = is_string($responseBody) ? json_decode($responseBody, true) : [];
        $response = is_array($response) ? $response : [];

        if ($responseBody !== false && $statusCode >= 200 && $statusCode < 300) {
            break;
        }

        $apiMessage = strtolower((string)($response['error']['message'] ?? ''));
        $isTemporaryFailure = $responseBody === false
            || in_array($statusCode, [429, 500, 502, 503, 504], true)
            || str_contains($apiMessage, 'high demand');
        $hasFallback = $index < count($modelCandidates) - 1;

        if (!$isTemporaryFailure || !$hasFallback) {
            break;
        }

        usleep(750000);
    }

    if ($responseBody === false) {
        if ($allowFailure) {
            return [];
        }
        sendError('No se pudo conectar con el servicio de generacion: ' . $curlError, 502);
    }

    if ($statusCode === 429) {
        if ($allowFailure) {
            return [];
        }
        sendError('El servicio de generacion esta ocupado. Intenta de nuevo en un momento.', 429);
    }

    if ($statusCode === 400 || $statusCode === 401 || $statusCode === 403) {
        if ($allowFailure) {
            return [];
        }
        $apiMessage = cleanText($response['error']['message'] ?? 'Revisa la clave y el modelo configurado.', 300);
        sendError('No se pudo usar el servicio de generacion: ' . $apiMessage, 502);
    }

    if ($statusCode < 200 || $statusCode >= 300) {
        if ($allowFailure) {
            return [];
        }
        $apiMessage = cleanText($response['error']['message'] ?? 'No se pudo generar el contenido.', 300);
        sendError('No se pudo generar el contenido: ' . $apiMessage, 502);
    }

    $parts = $response['candidates'][0]['content']['parts'] ?? [];
    $jsonText = '';
    foreach ($parts as $part) {
        if (is_array($part)) {
            $jsonText .= (string)($part['text'] ?? '');
        }
    }

    $cleanJsonText = preg_replace('/```json|```/i', '', $jsonText);
    $cleanJsonText = trim($cleanJsonText);

    $result = json_decode($cleanJsonText, true);
    if (!is_array($result)) {
        if ($allowFailure) {
            return [];
        }
        sendError('Google AI Studio devolvió una respuesta que no se pudo interpretar como JSON: ' . json_last_error_msg() . ' | Respuesta: ' . substr($jsonText, 0, 100), 502);
    }

    return $result;
}
