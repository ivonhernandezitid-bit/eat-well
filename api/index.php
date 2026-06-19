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
$input = json_decode(file_get_contents('php://input') ?: '{}', true);

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
            analyzeFood($pdo, $input);
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

function analyzeFood(PDO $pdo, array $input): void
{
    $userId = (int)($input['userId'] ?? 0);
    $foodName = trim((string)($input['manualDescription'] ?? 'Alimento pendiente de analizar'));
    $recommendation = 'Funcion preparada para conectar despues con camara, API o IA de reconocimiento de alimentos.';

    if ($userId > 0) {
        $statement = $pdo->prepare(
            'INSERT INTO food_scans (user_id, detected_food, estimated_calories, ai_recommendation) VALUES (?, ?, ?, ?)',
        );
        $statement->execute([$userId, $foodName, 0, $recommendation]);
    }

    sendJson([
        'result' => [
            'status' => 'pending_api',
            'foodName' => $foodName,
            'estimatedCalories' => 0,
            'recommendation' => $recommendation,
        ],
    ]);
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
