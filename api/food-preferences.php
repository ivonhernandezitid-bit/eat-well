<?php
declare(strict_types=1);

function preferenceNameKey(string $name): string
{
    return trim(preg_replace('/\s+/u', ' ', strtr(mb_strtolower($name), ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u'])) ?? '');
}

function preferenceContains(string $food, string $term): bool
{
    return (bool)preg_match('/(?<![\p{L}\p{N}])' . preg_quote($term, '/') . '(?![\p{L}\p{N}])/u', $food);
}

function validateFoodPreferenceConflicts(array $data): void
{
    $groups = ['preferredFruits','preferredVegetables','preferredProteins','preferredCarbohydrates','preferredLegumes','preferredDairy','preferredFats'];
    $animalMeats = ['pollo','pavo','res','cerdo','salmon','atun','sardinas','pescado','camaron','carne','jamon','higado','mariscos','moluscos'];
    $milkFoods = ['leche','yogur','queso','requeson','mantequilla','crema de leche'];
    $rules = [
        'lacteos'=>$milkFoods, 'lactosa'=>$milkFoods, 'huevo'=>['huevo'],
        'cacahuate'=>['cacahuate','cacahuates'], 'nueces de arbol'=>['nuez','nueces','almendra','almendras','avellana','avellanas','pistacho','pistachos'],
        'gluten'=>['trigo','harina','pan','pasta','centeno','cebada','seitan','avena'], 'trigo'=>['trigo','harina','pan','pasta','seitan'],
        'soya'=>['soya','soja','tofu','tempeh','edamame'], 'pescado'=>['pescado','salmon','atun','sardinas'],
        'mariscos'=>['mariscos','camaron','camarones','moluscos','almejas','mejillones','pulpo'], 'moluscos'=>['moluscos','almejas','mejillones','pulpo'],
        'sesamo'=>['sesamo','ajonjoli','tahini'], 'maiz'=>['maiz','elote'], 'legumbres'=>['frijoles','lentejas','garbanzos','habas','chicharos','soya','tofu','tempeh','edamame'],
    ];
    foreach ($groups as $group) foreach ($data[$group] as $name) {
        $food = preferenceNameKey($name);
        $plantDrink = (bool)preg_match('/\b(?:bebida|leche) (?:de )?(?:soya|avena|almendra|coco|arroz)\b/u', $food);
        foreach ($data['dislikedFoods'] as $disliked) {
            $key = preferenceNameKey($disliked);
            $terms = $rules[$key] ?? [$key];
            foreach ($terms as $term) if (preferenceContains($food,$term)) throw new InvalidArgumentException("Revisa $name: tambien esta marcado como alimento que no te gusta ($disliked).");
        }
        foreach ($data['allergies'] as $allergy) {
            $key = preferenceNameKey($allergy);
            if ($plantDrink && in_array($key,['lacteos','lactosa'],true)) continue;
            if ($key === 'lactosa' && preferenceContains($food,'sin lactosa')) continue;
            if ($key === 'gluten' && preferenceContains($food,'sin gluten')) continue;
            foreach ($rules[$key] ?? [$key] as $term) if (preferenceContains($food,$term)) throw new InvalidArgumentException("Revisa $name: es incompatible con la restriccion $allergy.");
        }
        if ($data['dietType'] !== 'omnivore') {
            foreach ($animalMeats as $term) if (preferenceContains($food,$term)) throw new InvalidArgumentException("Revisa $name: no corresponde a tu tipo de alimentacion.");
        }
        if ($data['dietType'] === 'vegan') {
            foreach (['huevo','miel',...($plantDrink ? [] : $milkFoods)] as $term) if (preferenceContains($food,$term)) throw new InvalidArgumentException("Revisa $name: no corresponde a una alimentacion vegana.");
        }
    }
}

function validateFoodPreferences(array $input, array $existing): array
{
    $data = array_merge($existing, $input);
    if (!in_array($data['dietType'] ?? null, ['omnivore', 'vegetarian', 'vegan'], true)) throw new InvalidArgumentException('Selecciona un tipo de alimentacion valido.');
    $limits = ['preferredFruits'=>30,'preferredVegetables'=>30,'preferredProteins'=>40,'preferredCarbohydrates'=>40,'preferredLegumes'=>40,'preferredDairy'=>40,'preferredFats'=>40,'allergies'=>20,'dislikedFoods'=>30];
    $result = ['dietType' => $data['dietType']];
    foreach ($limits as $field => $limit) {
        $items = $data[$field] ?? [];
        if (!is_array($items) || count($items) > $limit) throw new InvalidArgumentException('Revisa la lista de alimentos, alergias o preferencias.');
        $unique = [];
        foreach ($items as $item) {
            if (!is_string($item)) throw new InvalidArgumentException('Cada preferencia debe ser un nombre de alimento o alergia.');
            $text = trim(preg_replace('/\s+/u', ' ', $item) ?? '');
            if ($text === '' || mb_strlen($text) > 80 || strip_tags($text) !== $text) throw new InvalidArgumentException('Indica nombres validos de alimentos o alergias, de hasta 80 caracteres.');
            $unique[preferenceNameKey($text)] ??= $text;
        }
        $result[$field] = array_values($unique);
    }
    $time = $data['cookingTimeMinutes'] ?? 30;
    if (!is_numeric($time) || (int)$time != $time || $time < 10 || $time > 120) throw new InvalidArgumentException('El tiempo para cocinar debe ser de 10 a 120 minutos.');
    $result['cookingTimeMinutes'] = (int)$time;
    foreach (['goal'=>['lose_weight','maintain','gain_muscle','improve_health'], 'activityLevel'=>['low','moderate','high']] as $field => $allowed) {
        if (array_key_exists($field, $input)) {
            if (!in_array($input[$field], $allowed, true)) throw new InvalidArgumentException('Revisa tu objetivo y nivel de actividad.');
            $result[$field] = $input[$field];
        }
    }
    validateFoodPreferenceConflicts($result);
    return $result;
}

function persistFoodPreferences(PDO $pdo, int $userId, array $data): void
{
    $columns = ['preferredFruits'=>'preferred_fruits','preferredVegetables'=>'preferred_vegetables','preferredProteins'=>'preferred_proteins','preferredCarbohydrates'=>'preferred_carbohydrates','preferredLegumes'=>'preferred_legumes','preferredDairy'=>'preferred_dairy','preferredFats'=>'preferred_fats','allergies'=>'allergies','dislikedFoods'=>'disliked_foods'];
    $values = [$userId, $data['dietType']];
    foreach ($columns as $field => $column) $values[] = json_encode($data[$field], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $values[] = $data['cookingTimeMinutes'];
    $fields = 'user_id,diet_type,' . implode(',', array_values($columns)) . ',cooking_time_minutes,completed_at';
    $updates = ['diet_type=VALUES(diet_type)', 'cooking_time_minutes=VALUES(cooking_time_minutes)', 'completed_at=CURRENT_TIMESTAMP'];
    foreach ($columns as $column) $updates[] = $column . '=VALUES(' . $column . ')';
    $pdo->beginTransaction();
    try {
        $current = $pdo->prepare('SELECT goal,target_weight_kg,exercise_types_json,completed_at FROM lifestyle_goals WHERE user_id=? FOR UPDATE');
        $current->execute([$userId]);
        $lifestyle = $current->fetch(PDO::FETCH_ASSOC);
        if ($lifestyle && $lifestyle['completed_at'] !== null) {
            $types = json_decode($lifestyle['exercise_types_json'] ?? '[]',true) ?? [];
            if (isset($data['activityLevel']) && $data['activityLevel'] !== 'low' && in_array('none',$types,true)) throw new InvalidArgumentException('En Estilo de vida indicaste que no realizas ejercicio. Revisa esa seleccion antes de aumentar tu nivel de actividad.');
            if (($data['goal'] ?? $lifestyle['goal']) === 'lose_weight') {
                $weight = $pdo->prepare('SELECT weight_kg FROM users WHERE id=?'); $weight->execute([$userId]);
                if ((float)$lifestyle['target_weight_kg'] >= (float)$weight->fetchColumn()) throw new InvalidArgumentException('Revisa tu peso meta en Estilo de vida: para bajar de peso debe ser menor que tu peso actual.');
            }
        }
        $stmt = $pdo->prepare('INSERT INTO food_preferences (' . $fields . ') VALUES (' . implode(',', array_fill(0, count($values), '?')) . ',CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE ' . implode(',', $updates));
        $stmt->execute($values);
        $changes = []; $profileValues = [];
        foreach (['goal'=>'goal','activityLevel'=>'activity_level'] as $field => $column) {
            if (array_key_exists($field, $data)) { $changes[] = $column . '=?'; $profileValues[] = $data[$field]; }
        }
        if ($changes) {
            $profileValues[] = $userId;
            $pdo->prepare('UPDATE users SET ' . implode(',', $changes) . ',updated_at=CURRENT_TIMESTAMP WHERE id=?')->execute($profileValues);
            if (isset($data['goal'])) $pdo->prepare('UPDATE lifestyle_goals SET goal=? WHERE user_id=?')->execute([$data['goal'],$userId]);
            if (isset($data['activityLevel'])) {
                $band = ['low'=>'sedentary','moderate'=>'moderate','high'=>'intense'][$data['activityLevel']];
                $pdo->prepare("UPDATE lifestyle_goals SET activity_level=CASE WHEN ?='low' AND activity_level IN ('sedentary','light') THEN activity_level ELSE ? END WHERE user_id=?")->execute([$data['activityLevel'],$band,$userId]);
            }
        }
        $cookingBand = $data['cookingTimeMinutes'] < 30 ? 'short' : ($data['cookingTimeMinutes'] <= 60 ? 'medium' : 'flexible');
        $pdo->prepare('UPDATE lifestyle_goals SET cooking_availability=? WHERE user_id=?')->execute([$cookingBand,$userId]);
        $pdo->commit();
    } catch (Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
}

function handleFoodPreferences(PDO $pdo, string $action, array $input): void
{
    $user = requireSessionUser($pdo); $userId = (int)$user['id'];
    if ((string)($input['userId'] ?? $_GET['userId'] ?? $userId) !== (string)$userId) sendError('No puedes acceder a las preferencias de otra cuenta.', 403);
    if ($_SERVER['REQUEST_METHOD'] !== ($action === 'preferences.get' ? 'GET' : 'POST')) sendError('Metodo no permitido.', 405);
    if ($action === 'preferences.save') {
        try { $data = validateFoodPreferences($input, mapFoodPreferences(getFoodPreferencesRecord($pdo, $userId))); }
        catch (InvalidArgumentException $error) { sendError($error->getMessage(), 422); }
        try { persistFoodPreferences($pdo, $userId, $data); }
        catch (InvalidArgumentException $error) { sendError($error->getMessage(),422); }
    } elseif ($action === 'preferences.delete') {
        $pdo->prepare('DELETE FROM food_preferences WHERE user_id=?')->execute([$userId]);
    }
    sendJson(['preferences'=>mapFoodPreferences(getFoodPreferencesRecord($pdo, $userId)), 'user'=>mapUser(getUserById($pdo, $userId))]);
}
