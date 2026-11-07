<?php
declare(strict_types=1);

function validateMeasurementValues(mixed $weight, mixed $height): array
{
    foreach (['peso' => $weight, 'estatura' => $height] as $label => $value) {
        if (is_bool($value) || !is_numeric($value) || !is_finite((float)$value)) throw new InvalidArgumentException("Indica un valor numerico valido para $label.");
    }
    $weight = round((float)$weight, 2); $height = round((float)$height, 2);
    if ($weight <= 0 || $weight > 500) throw new InvalidArgumentException('El peso debe ser mayor que cero y no superar 500 kg.');
    if ($height <= 0 || $height > 300) throw new InvalidArgumentException('La estatura debe ser mayor que cero y no superar 300 cm.');
    $bmi = round($weight / (($height / 100) ** 2), 2);
    if ($bmi <= 0 || $bmi > 999.99) throw new InvalidArgumentException('Revisa las unidades y los valores del peso y la estatura.');
    return ['weightKg' => $weight, 'heightCm' => $height, 'imc' => $bmi];
}

function persistMeasuredProfile(PDO $pdo, int $userId, array $input): array
{
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id=? FOR UPDATE'); $stmt->execute([$userId]);
        $current = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$current) throw new InvalidArgumentException('La cuenta ya no existe.');
        $measures = validateMeasurementValues($input['weightKg'] ?? $current['weight_kg'], $input['heightCm'] ?? $current['height_cm']);
        foreach (['weightKg','heightCm'] as $field) {
            if (array_key_exists($field, $input) && $input[$field] === null) throw new InvalidArgumentException('Completa el peso y la estatura.');
        }
        $name = $input['name'] ?? $current['name'];
        if (!is_string($name) || trim($name) === '' || mb_strlen(trim($name)) > 100) throw new InvalidArgumentException('Indica un nombre de hasta 100 caracteres.');
        $age = $input['age'] ?? $current['age'];
        if (is_bool($age) || !is_numeric($age) || (int)$age != $age || $age < 1 || $age > 120) throw new InvalidArgumentException('Indica una edad valida entre 1 y 120 anos.');
        $enums = ['gender'=>['male','female','other'], 'activityLevel'=>['low','moderate','high'], 'goal'=>['lose_weight','maintain','gain_muscle','improve_health']];
        $values = [];
        foreach (['gender'=>'gender','activityLevel'=>'activity_level','goal'=>'goal'] as $key => $column) {
            $value = $input[$key] ?? $current[$column];
            if (!in_array($value, $enums[$key], true)) throw new InvalidArgumentException('Revisa las opciones de sexo, actividad y objetivo.');
            $values[$key] = $value;
        }
        if (array_key_exists('recordMeasurement',$input) && !is_bool($input['recordMeasurement'])) throw new InvalidArgumentException('La confirmacion de medicion no es valida.');
        $confirmed = ($input['recordMeasurement'] ?? false) === true;
        if ($confirmed && (!array_key_exists('weightKg', $input) || !array_key_exists('heightCm', $input))) throw new InvalidArgumentException('Confirma el peso y la estatura para registrar una medicion.');
        $changed = $measures['weightKg'] !== (float)$current['weight_kg'] || $measures['heightCm'] !== (float)$current['height_cm'];
        $bmiColumn = array_key_exists('bmi', $current) ? 'bmi' : 'imc';
        $stmt = $pdo->prepare('UPDATE users SET name=?,age=?,gender=?,weight_kg=?,height_cm=?,' . $bmiColumn . '=?,activity_level=?,goal=?,updated_at=CURRENT_TIMESTAMP WHERE id=?');
        $stmt->execute([trim($name),(int)$age,$values['gender'],$measures['weightKg'],$measures['heightCm'],$measures['imc'],$values['activityLevel'],$values['goal'],$userId]);
        if (array_key_exists('profileImage', $input)) {
            $image = $input['profileImage'];
            if ($image !== null && (!is_string($image) || strlen($image) > 2 * 1024 * 1024)) throw new InvalidArgumentException('La foto de perfil no es valida o es demasiado grande.');
            $pdo->prepare('UPDATE users SET profile_image=? WHERE id=?')->execute([$image === null ? null : (trim($image) ?: null),$userId]);
        }
        if (array_key_exists('goal',$input)) $pdo->prepare('UPDATE lifestyle_goals SET goal=? WHERE user_id=?')->execute([$values['goal'],$userId]);
        if (array_key_exists('activityLevel',$input)) {
            $band = ['low'=>'sedentary','moderate'=>'moderate','high'=>'intense'][$values['activityLevel']];
            $pdo->prepare("UPDATE lifestyle_goals SET activity_level=CASE WHEN ?='low' AND activity_level IN ('sedentary','light') THEN activity_level ELSE ? END WHERE user_id=?")->execute([$values['activityLevel'],$band,$userId]);
        }
        if ($confirmed || $changed) {
            $measuredAt = (new DateTimeImmutable('now', new DateTimeZone('America/Mexico_City')))->format('Y-m-d H:i:s');
            $stmt = $pdo->prepare('SELECT weight_kg,height_cm,measured_at FROM anthropometric_measurements WHERE user_id=? ORDER BY measured_at DESC,id DESC LIMIT 1');
            $stmt->execute([$userId]); $last = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$last || (float)$last['weight_kg'] !== $measures['weightKg'] || (float)$last['height_cm'] !== $measures['heightCm'] || substr($last['measured_at'],0,10) !== substr($measuredAt,0,10)) {
                $pdo->prepare('INSERT INTO anthropometric_measurements (user_id,measured_at,weight_kg,height_cm) VALUES (?,?,?,?)')->execute([$userId,$measuredAt,$measures['weightKg'],$measures['heightCm']]);
            }
        }
        $user = getUserById($pdo,$userId);
        $pdo->commit();
        return $user;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function handleMeasuredProfile(PDO $pdo, array $input): void
{
    $user = requireSessionUser($pdo); $userId = (int)$user['id'];
    foreach (['id','userId'] as $key) {
        if (array_key_exists($key,$input) && (string)$input[$key] !== (string)$userId) sendError('No puedes modificar las mediciones de otra cuenta.',403);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendError('Metodo no permitido.',405);
    try { $saved = persistMeasuredProfile($pdo,$userId,$input); }
    catch (InvalidArgumentException $error) { sendError($error->getMessage(),422); }
    sendJson(['user'=>mapUser($saved)]);
}

function handleMeasurementHistory(PDO $pdo, array $input): void
{
    $user = requireSessionUser($pdo); $userId = (int)$user['id'];
    if ((string)($input['userId'] ?? $_GET['userId'] ?? $userId) !== (string)$userId) sendError('No puedes consultar las mediciones de otra cuenta.',403);
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') sendError('Metodo no permitido.',405);
    $limit = $input['limit'] ?? $_GET['limit'] ?? 50;
    if (is_bool($limit) || !is_scalar($limit) || !preg_match('/^\d{1,3}$/D',(string)$limit) || (int)$limit < 1 || (int)$limit > 100) sendError('El limite debe estar entre 1 y 100.',422);
    $stmt = $pdo->prepare('SELECT id,measured_at,weight_kg,height_cm FROM anthropometric_measurements WHERE user_id=? ORDER BY measured_at DESC,id DESC LIMIT ' . (int)$limit);
    $stmt->execute([$userId]); $measurements = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $weight = (float)$row['weight_kg']; $height = (float)$row['height_cm'];
        $measurements[] = ['id'=>(string)$row['id'],'measuredAt'=>str_replace(' ','T',$row['measured_at']),
            'weightKg'=>$weight,'heightCm'=>$height,'imc'=>$weight > 0 && $height > 0 ? round($weight / (($height / 100) ** 2),2) : null];
    }
    sendJson(['measurements'=>$measurements,'timeZone'=>'America/Mexico_City']);
}
