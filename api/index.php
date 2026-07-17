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
    // Auto-create user_tips table if not exists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_tips (
            user_id INT PRIMARY KEY,
            preference_hash CHAR(64) NOT NULL,
            tips_json TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    ");

    // Add additional backup recipes
    $additionalRecipes = [
        [
            'title' => 'Tostadas ligeras de atún al chipotle',
            'description' => 'Una cena rápida, deliciosa y crujiente, alta en proteínas y baja en grasa.',
            'calories' => 320,
            'protein_grams' => 28,
            'carbs_grams' => 22,
            'fat_grams' => 8,
            'ingredients' => '2 latas de atún en agua escurrido|3 tostadas horneadas de maíz|1 jitomate picado|1/2 taza de cilantro fresco picado|1/4 taza de yogur griego natural sin azúcar|1 cucharadita de chile chipotle molido|1/2 aguacate en rebanadas',
            'instructions' => 'En un tazón, mezcla el atún escurrido con el yogur griego y el chipotle picado.|Agrega el jitomate y el cilantro picado, y sazona con una pizca de sal.|Reparte la mezcla equitativamente sobre las 3 tostadas de maíz.|Decora cada tostada con rebanadas de aguacate fresco antes de servir.',
            'goal' => 'lose_weight'
        ],
        [
            'title' => 'Tacos de lechuga con pavo al cilantro',
            'description' => 'Tacos súper frescos, crujientes y bajos en carbohidratos, ideales para cenar ligero.',
            'calories' => 260,
            'protein_grams' => 26,
            'carbs_grams' => 10,
            'fat_grams' => 6,
            'ingredients' => '6 hojas grandes de lechuga orejona lavadas|250g de pechuga de pavo molida magra|1/2 cebolla blanca finamente picada|1 diente de ajo picado|1 cucharada de salsa de soya baja en sodio|1/2 taza de cilantro picado|1 cucharadita de aceite de oliva',
            'instructions' => 'Calienta el aceite de oliva en un sartén a fuego medio por 2 minutos.|Sofríe la cebolla y el ajo durante 3 minutos hasta que estén traslúcidos.|Agrega la carne molida de pavo y cocina por 10 minutos moviendo constantemente.|Añade la salsa de soya y la mitad del cilantro; cocina por 3 minutos más.|Sirve porciones de la carne sobre las hojas de lechuga y decora con el cilantro restante.',
            'goal' => 'lose_weight'
        ],
        [
            'title' => 'Pechuga de pollo al limón con ejotes',
            'description' => 'Una comida limpia, saciante y nutritiva para quemar grasa manteniendo masa muscular.',
            'calories' => 340,
            'protein_grams' => 32,
            'carbs_grams' => 14,
            'fat_grams' => 9,
            'ingredients' => '1 pechuga de pollo de 150g deshuesada y sin piel|1 taza de ejotes verdes limpios|Jugo de 1 limón grande|1 diente de ajo machacado|1 cucharadita de orégano seco|1 cucharadita de aceite de oliva|Sal y pimienta negra al gusto',
            'instructions' => 'Marina la pechuga de pollo con el jugo de limón, el ajo, el orégano, sal y pimienta por 15 minutos.|Calienta el aceite de oliva en una plancha o sartén a fuego medio.|Cocina el pollo durante 6-8 minutos por cada lado hasta que esté bien cocido.|Mientras tanto, hierve los ejotes en agua con sal durante 5 minutos para que queden crujientes.|Sirve la pechuga caliente acompañada de los ejotes al vapor.',
            'goal' => 'lose_weight'
        ],
        [
            'title' => 'Avena cremosa con plátano y nueces',
            'description' => 'Un desayuno completo y energético rico en fibra soluble y grasas saludables.',
            'calories' => 440,
            'protein_grams' => 12,
            'carbs_grams' => 64,
            'fat_grams' => 15,
            'ingredients' => '1/2 taza de hojuelas de avena entera|1 taza de leche de almendras sin azúcar|1/2 plátano cortado en rodajas|6 nueces de pecana picadas|1 cucharadita de semillas de chía|1/2 cucharadita de canela en polvo|1 cucharadita de miel de abeja pura',
            'instructions' => 'En una olla pequeña, combina la avena y la leche de almendras a fuego medio.|Cocina a fuego lento durante 8 minutos moviendo continuamente hasta que espese.|Vierte la avena en un plato hondo y decora con las rodajas de plátano y las nueces.|Espolvorea la chía, la canela y vierte un hilo de miel por encima antes de disfrutar.',
            'goal' => 'maintain'
        ],
        [
            'title' => 'Crema de calabaza asada y zanahoria',
            'description' => 'Una sopa reconfortante y aterciopelada repleta de antioxidantes y vitaminas.',
            'calories' => 220,
            'protein_grams' => 5,
            'carbs_grams' => 34,
            'fat_grams' => 7,
            'ingredients' => '300g de calabaza picada en cubos|2 zanahorias medianas cortadas en rodajas|1/2 cebolla picada|2 tazas de caldo de verduras bajo en sodio|1 cucharadita de aceite de oliva|1/4 taza de leche de coco ligera|Sal y nuez moscada al gusto',
            'instructions' => 'Precalienta el horno a 200°C y hornea la calabaza y zanahoria con aceite por 20 minutos.|En una olla sofríe la cebolla por 5 minutos hasta que caramelice.|Agrega las verduras asadas y el caldo de verduras a la olla; hierve por 5 minutos.|Licúa todo hasta obtener una crema tersa sin grumos.|Regresa al fuego, añade la leche de coco, sal, una pizca de nuez moscada y calienta 5 minutos más.',
            'goal' => 'maintain'
        ],
        [
            'title' => 'Wrap integral de humus y vegetales',
            'description' => 'Un almuerzo fresco, vegetariano y rápido de armar, ideal para llevar al trabajo.',
            'calories' => 390,
            'protein_grams' => 11,
            'carbs_grams' => 48,
            'fat_grams' => 16,
            'ingredients' => '1 tortilla de trigo integral grande|3 cucharadas de humus clásico|1/2 taza de hojas de espinaca baby|1/2 pepino cortado en rodajas delgadas|1/2 zanahoria rallada|4 rodajas de jitomate maduro|1 cucharada de pepitas de calabaza',
            'instructions' => 'Extiende la tortilla de trigo integral sobre una superficie plana.|Unta el humus de manera uniforme sobre la superficie del wrap.|Coloca una capa de espinacas y acomoda encima el pepino, jitomate y zanahoria rallada.|Espolvorea las pepitas de calabaza para añadir un toque crujiente.|Dobla los extremos de la tortilla hacia adentro y enrolla firmemente.',
            'goal' => 'maintain'
        ],
        [
            'title' => 'Licuado de proteína y crema de cacahuate',
            'description' => 'Un batido calórico de alta calidad para reparar fibras musculares post-entrenamiento.',
            'calories' => 650,
            'protein_grams' => 38,
            'carbs_grams' => 78,
            'fat_grams' => 24,
            'ingredients' => '1 taza de leche entera o deslactosada|1 scoop de proteína de suero (whey) de vainilla|1 plátano entero maduro|2 cucharadas de crema de cacahuate natural|1/3 taza de avena licuada|4 cubos de hielo',
            'instructions' => 'Coloca la avena sola en la licuadora y procésala por 30 segundos para molerla.|Agrega la leche, el plátano, la proteína y la crema de cacahuate.|Licúa todos los ingredientes a velocidad alta durante 1 minuto hasta que esté homogéneo.|Agrega los cubos de hielo y licúa 15 segundos adicionales para lograr una textura fría.',
            'goal' => 'gain_muscle'
        ],
        [
            'title' => 'Filete de salmón al limón con papas asadas',
            'description' => 'Cena rica en ácidos grasos omega-3 y carbohidratos complejos para favorecer el anabolismo.',
            'calories' => 510,
            'protein_grams' => 34,
            'carbs_grams' => 38,
            'fat_grams' => 24,
            'ingredients' => '150g de filete de salmón fresco con piel|1 papa mediana cortada en cubos|1/2 cucharada de aceite de oliva|1 diente de ajo picado finamente|Rodajas de 1 limón fresco|Sal de mar y eneldo seco al gusto',
            'instructions' => 'Precalienta el horno a 200°C.|Coloca los cubos de papa en una bandeja con aceite, sal de mar y hornea por 15 minutos.|Sazona el salmón con ajo, eneldo, sal y coloca las rodajas de limón sobre el filete.|Coloca el salmón al lado de las papas y hornea todo junto durante 12-15 minutos más.|Sirve el filete de salmón acompañado de las papas doradas calientes.',
            'goal' => 'gain_muscle'
        ],
        [
            'title' => 'Pasta integral con carne de res molida y tomate',
            'description' => 'Una comida clásica de volumen muscular con excelente aporte de hierro y zinc.',
            'calories' => 580,
            'protein_grams' => 40,
            'carbs_grams' => 68,
            'fat_grams' => 16,
            'ingredients' => '80g de pasta integral (en seco)|180g de carne molida de res extra magra (95/5)|1 taza de puré de tomate natural|1/2 cebolla picada|1 diente de ajo picado|1 cucharada de queso parmesano rallado|1 cucharadita de orégano',
            'instructions' => 'Cocina la pasta integral en agua hirviendo con sal durante 9-11 minutos.|Mientras se cuece la pasta, sofríe la cebolla y el ajo en un sartén por 3 minutos.|Agrega la carne molida de res y cocínala por 8 minutos deshaciendo los grumos.|Vierte el puré de tomate y el orégano; deja hervir a fuego bajo durante 5 minutos.|Escurra la pasta, mézclala con la salsa boloñesa y espolvorea con queso parmesano.',
            'goal' => 'gain_muscle'
        ],
        [
            'title' => 'Bowl balanceado de pollo y arroz integral',
            'description' => 'Un tazón nutritivo y equilibrado rico en fibra, micronutrientes y grasas buenas.',
            'calories' => 480,
            'protein_grams' => 34,
            'carbs_grams' => 52,
            'fat_grams' => 14,
            'ingredients' => '120g de pechuga de pollo a la plancha|1/2 taza de arroz integral cocido al vapor|1 taza de ramilletes de brócoli cocidos|1/2 taza de zanahoria rallada|1/4 de aguacate en cubos|1 cucharada de semillas de sésamo',
            'instructions' => 'Sella la pechuga de pollo a la plancha por 6 minutos por lado; corta en cubos.|Cocina el brócoli al vapor durante 5 minutos para que conserve sus nutrientes.|En un tazón amplio coloca el arroz integral como base en una mitad.|Acomoda encima el pollo, el brócoli, la zanahoria rallada y el aguacate.|Espolvorea las semillas de sésamo por encima antes de disfrutar.',
            'goal' => 'improve_health'
        ],
        [
            'title' => 'Ensalada mediterránea de quinoa',
            'description' => 'Un plato vegetariano alcalino y lleno de antioxidantes protectores de la salud celular.',
            'calories' => 390,
            'protein_grams' => 10,
            'carbs_grams' => 54,
            'fat_grams' => 15,
            'ingredients' => '1/2 taza de quinoa cocida|1/2 taza de pepino cortado en cubos|1/2 taza de jitomates cherry partidos por la mitad|6 aceitunas negras picadas|30g de queso feta desmoronado|1 cucharadita de aceite de oliva extra virgen|Jugo de medio limón',
            'instructions' => 'Enjuaga y cocina la quinoa según las instrucciones de tu empaque (aprox. 15 minutos).|Deja enfriar la quinoa cocida por 10 minutos.|En un tazón grande, mezcla la quinoa fría con el pepino, jitomate cherry y aceitunas.|Agrega el queso feta desmoronado por encima.|Adereza con el aceite de oliva, el jugo de limón y mezcla suavemente.',
            'goal' => 'improve_health'
        ],
        [
            'title' => 'Tazón de yogur griego con frutos rojos',
            'description' => 'Un postre o snack saludable para regular la flora intestinal y fortalecer el sistema inmune.',
            'calories' => 260,
            'protein_grams' => 18,
            'carbs_grams' => 28,
            'fat_grams' => 8,
            'ingredients' => '200g de yogur griego natural sin azúcar|1/2 taza de frutos rojos (fresas, arándanos, frambuesas)|2 cucharadas de almendras fileteadas|1 cucharadita de semillas de linaza molidas|1 cucharadita de semillas de chía',
            'instructions' => 'Sirve el yogur griego en un plato hondo o copa de tu elección.|Lava muy bien los frutos rojos y colócalos sobre el yogur.|Añade las almendras fileteadas para dar una textura crujiente.|Espolvorea la linaza molida y la chía para incrementar el aporte de fibra y Omega-3.',
            'goal' => 'improve_health'
        ]
    ];

    foreach ($additionalRecipes as $r) {
        $stmt = $pdo->prepare('
            INSERT INTO recipes (title, description, calories, protein_grams, carbs_grams, fat_grams, ingredients, instructions, goal)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE title = ?)
        ');
        $stmt->execute([
            $r['title'],
            $r['description'],
            $r['calories'],
            $r['protein_grams'],
            $r['carbs_grams'],
            $r['fat_grams'],
            $r['ingredients'],
            $r['instructions'],
            $r['goal'],
            $r['title']
        ]);
    }
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
        case 'recipes.general':
            getGeneralRecipes($pdo, (int)($_GET['userId'] ?? 0));
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
        case 'scanner.history':
            getScanHistory($pdo, (int)($_GET['userId'] ?? 0));
            break;
        case 'tips.get':
            getUserTips($pdo, (int)($_GET['userId'] ?? 0), $geminiApiKey, $geminiModel);
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

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendError('El correo ingresado no tiene un formato válido.', 422);
    }

    if (strlen($plainPassword) < 8 || !preg_match('/[a-zA-Z]/', $plainPassword) || !preg_match('/[0-9]/', $plainPassword)) {
        sendError('La contraseña debe tener al menos 8 caracteres y contener al menos una letra y un número.', 422);
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
    $mappedPreferences = mapFoodPreferences($preferences);
    $preferenceHash = hash('sha256', json_encode([
        $user['goal'],
        $user['imc'],
        $mappedPreferences,
    ], JSON_UNESCAPED_UNICODE));

    // Check cache — only use it if we have at least 5 recipes for this exact hash
    $cachedStatement = $pdo->prepare(
        'SELECT * FROM personalized_recipes
         WHERE user_id = ? AND preference_hash = ? ORDER BY id ASC LIMIT 5',
    );
    $cachedStatement->execute([$userId, $preferenceHash]);
    $cachedRecipes = $cachedStatement->fetchAll();

    if (count($cachedRecipes) >= 5) {
        sendJson(['recipes' => array_map('mapPersonalizedRecipe', $cachedRecipes)]);
        return;
    }

    if ($mappedPreferences['completed'] && $apiKey !== '') {
        $dislikedList = implode(', ', array_merge($mappedPreferences['dislikedFoods'], $mappedPreferences['allergies']));
        $timePref = (int)$mappedPreferences['cookingTimeMinutes'];
        $prompt = "Genera exactamente 5 recetas practicas y saludables en espanol para este perfil. "
            . "Objetivo: {$user['goal']}. IMC: {$user['imc']}. "
            . "Tipo de alimentacion: {$mappedPreferences['dietType']}. "
            . "Frutas preferidas: " . implode(', ', $mappedPreferences['preferredFruits']) . ". "
            . "Verduras preferidas: " . implode(', ', $mappedPreferences['preferredVegetables']) . ". "
            . "PROHIBIDO usar o mencionar en cualquier receta estos ingredientes (alergias o alimentos no deseados): {$dislikedList}. "
            . "El usuario prefiere un tiempo de coccion maximo de {$timePref} minutos. Intenta de preferencia apegarte a ese tiempo, pero si una receta requiere mas tiempo de coccion para estar lista y deliciosa, tienes permitido excederlo. "
            . "Asegurate de que las recetas tengan una preparacion paso a paso muy detallada, e ingredientes precisos con sus porciones/cantidades correctas. "
            . "Ninguna receta puede contener ni mencionar los ingredientes prohibidos bajo ninguna circunstancia. "
            . "Devuelve unicamente un array JSON con exactamente 5 objetos. "
            . "Cada receta debe tener title, description, ingredients e instructions.";
        $schema = [
            'type' => 'ARRAY',
            'minItems' => 5,
            'maxItems' => 5,
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

        if (is_array($generatedRecipes) && count($generatedRecipes) >= 5) {
            // Delete ALL stale cached recipes for this user before inserting fresh ones
            $pdo->prepare('DELETE FROM personalized_recipes WHERE user_id = ?')->execute([$userId]);

            $insert = $pdo->prepare(
                'INSERT INTO personalized_recipes
                 (user_id, preference_hash, title, description, ingredients, instructions)
                 VALUES (?, ?, ?, ?, ?, ?)',
            );

            foreach (array_slice($generatedRecipes, 0, 5) as $recipe) {
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
            return;
        }
    }

    // No fallback: return empty list for personalized recipes section if Gemini is offline
    sendJson(['recipes' => []]);
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

    foreach (array_slice($geminiResult['recipes'] ?? [], 0, 5) as $recipe) {
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
         (user_id, image_url, detected_food, detected_ingredients, ai_recommendation, ai_provider)
         VALUES (?, ?, ?, ?, ?, ?)',
    );
    $statement->execute([
        $userId,
        $imageBase64,
        $foodName,
        json_encode($detectedIngredients, JSON_UNESCAPED_UNICODE),
        $recommendation,
        'gemini',
    ]);
    $scanId = (int)$pdo->lastInsertId();
    
    // Save generated recipes to database
    $insertRecipe = $pdo->prepare(
        'INSERT INTO ai_generated_recipes
         (scan_id, user_id, title, description, ingredients, instructions, ai_provider, ai_model)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    $suggestedRecipes = [];

    foreach ($generatedRecipes as $recipe) {
        $insertRecipe->execute([
            $scanId,
            $userId,
            $recipe['title'],
            $recipe['description'],
            json_encode($recipe['ingredients'], JSON_UNESCAPED_UNICODE),
            json_encode($recipe['instructions'], JSON_UNESCAPED_UNICODE),
            'gemini',
            $model
        ]);
        $recipeDbId = (int)$pdo->lastInsertId();

        $suggestedRecipes[] = [
            'id' => "scan-{$scanId}-{$recipeDbId}",
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
    
    $scanId = (int)($_GET['scanId'] ?? 0);
    
    if ($scanId > 0) {
        $statement = $pdo->prepare(
            'SELECT id, title, description, ingredients, instructions
             FROM ai_generated_recipes
             WHERE scan_id = ? AND user_id = ?
             ORDER BY id ASC',
        );
        $statement->execute([$scanId, $userId]);
    } else {
        $statement = $pdo->prepare(
            'SELECT id, title, description, ingredients, instructions
             FROM ai_generated_recipes
             WHERE scan_id = (
                 SELECT id FROM food_scans WHERE user_id = ? ORDER BY id DESC LIMIT 1
             )
             ORDER BY id ASC',
        );
        $statement->execute([$userId]);
    }
    
    $recipes = array_map(
        'mapGeneratedRecipe',
        $statement->fetchAll(),
    );

    sendJson(['recipes' => $recipes]);
}

function getScanHistory(PDO $pdo, int $userId): void
{
    if ($userId <= 0) {
        sendError('Usuario invalido.', 422);
    }

    getUserById($pdo, $userId);
    $statement = $pdo->prepare(
        'SELECT id, image_url, detected_food, detected_ingredients, estimated_calories, ai_recommendation, created_at
         FROM food_scans
         WHERE user_id = ?
         ORDER BY id DESC'
    );
    $statement->execute([$userId]);
    $scans = $statement->fetchAll();

    $results = [];
    foreach ($scans as $scan) {
        $results[] = [
            'id' => (string)$scan['id'],
            'imageUrl' => $scan['image_url'] ?? '',
            'detectedFood' => $scan['detected_food'],
            'detectedIngredients' => is_string($scan['detected_ingredients']) ? decodeJsonList($scan['detected_ingredients']) : [],
            'estimatedCalories' => (int)$scan['estimated_calories'],
            'aiRecommendation' => $scan['ai_recommendation'],
            'createdAt' => $scan['created_at']
        ];
    }

    sendJson(['scans' => $results]);
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
        . "Identifica solamente ingredientes que sean razonablemente visibles. Despues crea exactamente cinco "
        . "recetas practicas que aprovechen esos ingredientes para una persona cuyo objetivo es {$goal}. "
        . $preferenceContext
        . "Nunca incluyas alergenos ni alimentos no deseados; usa sustituciones seguras cuando sea necesario. "
        . "Si los alimentos o ingredientes detectados en la imagen son pocos o insuficientes para elaborar recetas completas, tienes total libertad de añadir otros ingredientes complementarios y saludables recomendados para el platillo. "
        . "El usuario prefiere un tiempo de coccion maximo de {$preferences['cookingTimeMinutes']} minutos. Intenta de preferencia apegarte a ese tiempo, pero si una receta requiere mas tiempo de coccion para estar lista, tienes permitido excederlo. "
        . "Asegurate de que las recetas tengan una preparacion paso a paso muy detallada, e ingredientes precisos con sus porciones/cantidades correctas. "
        . "Puedes agregar agua, sal y una pequena cantidad de aceite como basicos de despensa. "
        . "No incluyas frases de transicion hacia las recetas (como 'Aqui tienes 5 recetas...' o 'A continuacion se sugieren...'). "
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
                'minItems' => 5,
                'maxItems' => 5,
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
            'maxOutputTokens' => 8192,
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
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
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

    $routine = requestGeminiText($apiKey, $model, $prompt, $schema, true);

    if (!isset($routine['planSemanal']) || !is_array($routine['planSemanal']) || count($routine['planSemanal']) === 0) {
        $routine = buildFallbackRoutine($musculosList, $dias, $nivel, $equipo);
    }

    sendJson(['routine' => $routine]);
}

function buildFallbackRoutine(array $musculosList, int $dias, string $nivel, string $equipo): array
{
    $days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    $selectedMuscles = array_values(array_filter(
        array_map(static fn($muscle) => trim((string)$muscle), $musculosList),
        static fn($muscle) => $muscle !== ''
    ));

    if (count($selectedMuscles) === 0) {
        $selectedMuscles = ['Piernas', 'Abdomen', 'Espalda'];
    }

    $series = strtolower($nivel) === 'avanzado' ? 4 : 3;
    $repetitions = strtolower($nivel) === 'principiante' ? '10 a 12 repeticiones' : '12 a 15 repeticiones';
    $availableDays = max(1, min(6, $dias));
    $plan = [];

    for ($index = 0; $index < $availableDays; $index++) {
        $muscle = $selectedMuscles[$index % count($selectedMuscles)];
        $plan[] = [
            'dia' => $days[$index],
            'enfoque' => $muscle,
            'ejercicios' => [
                [
                    'nombre' => 'Activación de ' . $muscle,
                    'musculo' => $muscle,
                    'equipo' => $equipo,
                    'series' => $series,
                    'repeticiones' => $repetitions,
                    'descanso' => '60 segundos',
                    'instrucciones' => [
                        'Calienta de 5 a 8 minutos antes de iniciar.',
                        'Realiza el movimiento de forma controlada.',
                        'Mantén una respiración constante durante cada serie.',
                    ],
                ],
                [
                    'nombre' => 'Trabajo principal de ' . $muscle,
                    'musculo' => $muscle,
                    'equipo' => $equipo,
                    'series' => $series,
                    'repeticiones' => $repetitions,
                    'descanso' => '75 segundos',
                    'instrucciones' => [
                        'Ajusta la intensidad a tu nivel actual.',
                        'Evita forzar articulaciones o zona lumbar.',
                        'Termina con estiramientos suaves.',
                    ],
                ],
            ],
        ];
    }

    return ['planSemanal' => $plan];
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
            'maxOutputTokens' => 8192,
            'responseMimeType' => 'application/json',
            'responseSchema' => $schema,
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
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
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

    $result = decodeGeminiJson($jsonText);
    if (!is_array($result)) {
        if ($allowFailure) {
            return [];
        }
        sendError('Google AI Studio devolvió una respuesta que no se pudo interpretar como JSON: ' . json_last_error_msg() . ' | Respuesta: ' . substr($jsonText, 0, 100), 502);
    }

    return $result;
}

function decodeGeminiJson(string $jsonText): ?array
{
    $cleanJsonText = preg_replace('/```json|```/i', '', $jsonText) ?? $jsonText;
    $cleanJsonText = trim(extractJsonCandidate($cleanJsonText));

    $result = json_decode($cleanJsonText, true, 512, JSON_INVALID_UTF8_SUBSTITUTE);
    if (is_array($result)) {
        return $result;
    }

    $safeJsonText = escapeControlCharactersInsideJsonStrings($cleanJsonText);
    $result = json_decode($safeJsonText, true, 512, JSON_INVALID_UTF8_SUBSTITUTE);

    return is_array($result) ? $result : null;
}

function extractJsonCandidate(string $text): string
{
    $startObject = strpos($text, '{');
    $startArray = strpos($text, '[');
    $starts = array_filter([$startObject, $startArray], static fn($value) => $value !== false);

    if (count($starts) === 0) {
        return $text;
    }

    $start = min($starts);
    $endObject = strrpos($text, '}');
    $endArray = strrpos($text, ']');
    $end = max($endObject === false ? -1 : $endObject, $endArray === false ? -1 : $endArray);

    return $end >= $start ? substr($text, $start, $end - $start + 1) : substr($text, $start);
}

function escapeControlCharactersInsideJsonStrings(string $text): string
{
    $result = '';
    $inString = false;
    $isEscaped = false;
    $length = strlen($text);

    for ($index = 0; $index < $length; $index++) {
        $char = $text[$index];
        $code = ord($char);

        if ($char === '"' && !$isEscaped) {
            $inString = !$inString;
            $result .= $char;
            continue;
        }

        if ($inString && $code < 32) {
            $result .= $char === "\n" || $char === "\r" ? '\\n' : ' ';
            $isEscaped = false;
            continue;
        }

        $result .= $char;
        $isEscaped = $char === '\\' && !$isEscaped;
        if ($char !== '\\') {
            $isEscaped = false;
        }
    }

    return $result;
}

function getUserTips(PDO $pdo, int $userId, string $apiKey, string $model): void
{
    if ($userId <= 0) {
        sendError('Usuario invalido.', 422);
    }
    
    $user = getUserById($pdo, $userId);
    $preferences = getFoodPreferencesRecord($pdo, $userId);
    $mappedPreferences = mapFoodPreferences($preferences);
    
    $preferenceHash = hash('sha256', json_encode([
        $user['goal'],
        $user['imc'],
        $mappedPreferences,
    ], JSON_UNESCAPED_UNICODE));
    
    $statement = $pdo->prepare('SELECT * FROM user_tips WHERE user_id = ? LIMIT 1');
    $statement->execute([$userId]);
    $cached = $statement->fetch();
    
    if ($cached && $cached['preference_hash'] === $preferenceHash) {
        sendJson(['tips' => json_decode($cached['tips_json'], true)]);
        return;
    }
    
    if ($apiKey === '') {
        sendJson(['tips' => getFallbackTips($user['goal'], $mappedPreferences['dietType'])]);
        return;
    }
    
    $goalLabels = [
        'lose_weight' => 'bajar de peso',
        'maintain' => 'mantener su peso',
        'gain_muscle' => 'ganar masa muscular',
        'improve_health' => 'mejorar su salud',
    ];
    $goal = $goalLabels[$user['goal'] ?? ''] ?? 'comer saludable';
    $dietType = $mappedPreferences['dietType'];
    
    $prompt = "Genera exactamente 10 consejos de salud y nutricion cortos y practicos en espanol adaptados a este perfil:\n"
        . "- Objetivo: {$goal}\n"
        . "- Tipo de alimentacion: {$dietType}\n"
        . "- Frutas preferidas: " . implode(', ', $mappedPreferences['preferredFruits']) . "\n"
        . "- Verduras preferidas: " . implode(', ', $mappedPreferences['preferredVegetables']) . "\n"
        . "- Alergias: " . implode(', ', $mappedPreferences['allergies']) . "\n"
        . "- Alimentos que no le gustan: " . implode(', ', $mappedPreferences['dislikedFoods']) . "\n"
        . "- Tiempo maximo para cocinar: {$mappedPreferences['cookingTimeMinutes']} minutos.\n\n"
        . "Condiciones importantes:\n"
        . "1. NUNCA sugieras alimentos prohibidos por alérgenos o alimentos que no le gusten.\n"
        . "2. Los consejos deben ser cortos, motivacionales y aplicables.\n"
        . "3. Para cada consejo proporciona un icono de Ionic (ionicons) que sea apropiado (ej: water-outline, leaf-outline, flash-outline, moon-outline, etc.).\n"
        . "4. Devuelve unicamente un array JSON con 10 objetos, cada uno con las propiedades 'text' (string) e 'icon' (string). Sin explicaciones adicionales.";
        
    $schema = [
        'type' => 'ARRAY',
        'items' => [
            'type' => 'OBJECT',
            'required' => ['text', 'icon'],
            'properties' => [
                'text' => ['type' => 'STRING'],
                'icon' => ['type' => 'STRING'],
            ],
        ],
    ];
    
    try {
        $generatedTips = requestGeminiText($apiKey, $model, $prompt, $schema, true);
        
        if (!is_array($generatedTips) || count($generatedTips) === 0) {
            throw new Exception("Error al decodificar respuesta de Gemini.");
        }
        
        $save = $pdo->prepare('
            INSERT INTO user_tips (user_id, preference_hash, tips_json)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                preference_hash = VALUES(preference_hash),
                tips_json = VALUES(tips_json)
        ');
        $save->execute([
            $userId,
            $preferenceHash,
            json_encode($generatedTips, JSON_UNESCAPED_UNICODE),
        ]);
        
        sendJson(['tips' => $generatedTips]);
    } catch (Throwable $e) {
        sendJson(['tips' => getFallbackTips($user['goal'], $dietType)]);
    }
}

function getFallbackTips(string $goal, string $dietType): array
{
    return [
        ['text' => 'Acompaña tus comidas con agua pura y mantente hidratado todo el día.', 'icon' => 'water-outline'],
        ['text' => 'Combina distintos colores de vegetales en tu plato para asegurar una mayor variedad de vitaminas.', 'icon' => 'color-palette-outline'],
        ['text' => 'Masticar despacio ayuda a mejorar tu digestión y permite al cerebro registrar la saciedad a tiempo.', 'icon' => 'hourglass-outline'],
        ['text' => 'Intenta dormir entre 7 y 8 horas diarias; el descanso óptimo regula las hormonas del hambre.', 'icon' => 'moon-outline'],
        ['text' => 'Las ensaladas con legumbres son opciones saludables listas en pocos minutos.', 'icon' => 'flash-outline'],
        ['text' => 'Una infusión caliente sin cafeína (como manzanilla) ayuda a relajar tu cuerpo al final del día.', 'icon' => 'cafe-outline'],
        ['text' => 'El descanso es tan importante como el entrenamiento para ver progreso en tus metas.', 'icon' => 'bed-outline'],
        ['text' => 'Prioriza alimentos con alta fibra y agua para mantenerte saciado por más tiempo.', 'icon' => 'scale-outline'],
        ['text' => 'Las grasas saludables de aguacates, nueces y aceite de oliva protegen tu sistema nervioso.', 'icon' => 'shield-outline'],
        ['text' => 'Cocinar en casa te da el control total de los ingredientes y las porciones.', 'icon' => 'home-outline']
    ];
}

function getGeneralRecipes(PDO $pdo, int $userId): void
{
    $statement = $pdo->query('SELECT * FROM recipes ORDER BY title ASC');
    $recipes = array_map('mapRecipe', $statement->fetchAll());
    
    if ($userId > 0) {
        $preferences = getFoodPreferencesRecord($pdo, $userId);
        $mappedPreferences = mapFoodPreferences($preferences);
        $recipes = filterRecipesByPreferences($recipes, $mappedPreferences);
    }
    
    sendJson(['recipes' => $recipes]);
}

function filterRecipesByPreferences(array $recipes, array $mappedPreferences): array
{
    $dislikesAndAllergies = array_merge(
        array_map('trim', array_map('strtolower', $mappedPreferences['allergies'])),
        array_map('trim', array_map('strtolower', $mappedPreferences['dislikedFoods']))
    );
    
    $dislikesAndAllergies = array_filter($dislikesAndAllergies, static fn($item) => $item !== '');

    if (count($dislikesAndAllergies) === 0) {
        return $recipes;
    }

    $filtered = [];
    foreach ($recipes as $r) {
        $hasDisliked = false;
        $titleLower = strtolower($r['title']);
        $descLower = strtolower($r['description']);
        
        $ingredientsLower = array_map('strtolower', $r['ingredients']);
        
        foreach ($dislikesAndAllergies as $disliked) {
            if (str_contains($titleLower, $disliked) || str_contains($descLower, $disliked)) {
                $hasDisliked = true;
                break;
            }
            foreach ($ingredientsLower as $ing) {
                if (str_contains($ing, $disliked)) {
                    $hasDisliked = true;
                    break 2;
                }
            }
        }
        
        if (!$hasDisliked) {
            $filtered[] = $r;
        }
    }
    return $filtered;
}
