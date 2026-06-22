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
        case 'recipes.recommendations':
            getRecipeRecommendations($pdo, (int)($_GET['userId'] ?? 0));
            break;
        case 'exercises.byZone':
            getExercisesByZone($pdo, (string)($_GET['bodyZone'] ?? 'full_body'));
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

function getRecipeRecommendations(PDO $pdo, int $userId): void
{
    $user = getUserById($pdo, $userId);
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
    $imageBase64 = trim((string)($input['imageBase64'] ?? ''));
    [$imageBytes, $mimeType] = decodeFoodImage($imageBase64);
    $geminiResult = requestGeminiFoodAnalysis($apiKey, $model, $imageBytes, $mimeType, $user);
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

    $pdo->beginTransaction();

    try {
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
        $recipeStatement = $pdo->prepare(
            'INSERT INTO ai_generated_recipes
             (scan_id, user_id, title, description, ingredients, instructions, ai_provider, ai_model)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        );
        $suggestedRecipes = [];

        foreach ($generatedRecipes as $recipe) {
            $recipeStatement->execute([
                $scanId,
                $userId,
                $recipe['title'],
                $recipe['description'],
                json_encode($recipe['ingredients'], JSON_UNESCAPED_UNICODE),
                json_encode($recipe['instructions'], JSON_UNESCAPED_UNICODE),
                'gemini',
                $model,
            ]);
            $suggestedRecipes[] = mapGeneratedRecipe([
                'id' => (int)$pdo->lastInsertId(),
                ...$recipe,
            ]);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
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
    $prompt = "Analiza la fotografia de alimentos o ingredientes. Responde en espanol. "
        . "Identifica solamente ingredientes que sean razonablemente visibles. Despues crea exactamente cuatro "
        . "recetas practicas que aprovechen esos ingredientes para una persona cuyo objetivo es {$goal}. "
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
        sendError('Google AI Studio devolvio una respuesta que no se pudo interpretar.', 502);
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
