<?php
declare(strict_types=1);

function validateLifestyleSettings(mixed $input, bool $requireExercise = false, ?float $currentWeightKg = null): array
{
    if (!is_array($input)) throw new InvalidArgumentException('Revisa los datos de estilo de vida y metas.');
    $enums = ['goal'=>['lose_weight','maintain','gain_muscle','improve_health'],'activityBand'=>['sedentary','light','moderate','intense'],'trainingTime'=>['morning','afternoon','evening','variable'],'cookingTime'=>['short','medium','flexible'],'stressLevel'=>['low','moderate','high']];
    $result = [];
    foreach ($enums as $field => $allowed) {
        if (!in_array($input[$field] ?? null, $allowed, true)) throw new InvalidArgumentException('Revisa la meta, actividad y opciones de tus habitos.');
        $result[$field] = $input[$field];
    }
    $weight = $input['targetWeightKg'] ?? null;
    if (!is_numeric($weight) || !is_finite((float)$weight) || $weight < 25 || $weight > 350) throw new InvalidArgumentException('Indica un peso objetivo entre 25 y 350 kg.');
    $result['targetWeightKg'] = round((float)$weight, 2);
    $duration = $input['sessionDuration'] ?? null;
    if (!is_numeric($duration) || (int)$duration != $duration || !in_array((int)$duration, [30,45,60,90], true)) throw new InvalidArgumentException('Selecciona una duracion de sesion valida.');
    $result['sessionDuration'] = (int)$duration;
    $types = $input['exerciseTypes'] ?? null;
    if (!is_array($types) || count($types) > 6) throw new InvalidArgumentException('Revisa los tipos de ejercicio.');
    foreach ($types as $type) if (!in_array($type, ['walking','strength','cycling','sports','home','none'], true)) throw new InvalidArgumentException('Selecciona tipos de ejercicio validos.');
    $result['exerciseTypes'] = array_values(array_unique($types));
    if (in_array('none', $result['exerciseTypes'], true) && count($result['exerciseTypes']) > 1) throw new InvalidArgumentException('Ninguno por ahora no puede combinarse con otros ejercicios.');
    if ($requireExercise && !$result['exerciseTypes']) throw new InvalidArgumentException('Selecciona tu ejercicio habitual o Ninguno por ahora.');
    if ($requireExercise && in_array('none', $result['exerciseTypes'], true) && $result['activityBand'] !== 'sedentary') throw new InvalidArgumentException('Si no realizas ejercicio, selecciona Sin ejercicio planificado; si realizas actividad, indica su tipo.');
    if ($currentWeightKg && $result['goal'] === 'lose_weight' && $result['targetWeightKg'] >= $currentWeightKg) throw new InvalidArgumentException('Para bajar de peso, el peso meta debe ser menor que tu peso actual.');
    return $result;
}

function readLifestyleGoals(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('SELECT * FROM lifestyle_goals WHERE user_id=?'); $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || $row['completed_at'] === null) return ['settings'=>null,'completed'=>false];
    $settings = [
        'goal'=>$row['goal'], 'targetWeightKg'=>(float)$row['target_weight_kg'], 'activityBand'=>$row['activity_level'],
        'exerciseTypes'=>decodeJsonList($row['exercise_types_json']), 'sessionDuration'=>(int)$row['session_duration_minutes'],
        'trainingTime'=>$row['training_time'], 'cookingTime'=>$row['cooking_availability'], 'stressLevel'=>$row['stress_level'],
    ];
    try { $settings = validateLifestyleSettings($settings); }
    catch (InvalidArgumentException $error) { return ['settings'=>null,'completed'=>false]; }
    return ['completed'=>true,'settings'=>$settings];
}

function persistLifestyleGoals(PDO $pdo, int $userId, array $data): void
{
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO lifestyle_goals (user_id,goal,target_weight_kg,activity_level,exercise_types_json,session_duration_minutes,training_time,cooking_availability,stress_level,completed_at) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE goal=VALUES(goal),target_weight_kg=VALUES(target_weight_kg),activity_level=VALUES(activity_level),exercise_types_json=VALUES(exercise_types_json),session_duration_minutes=VALUES(session_duration_minutes),training_time=VALUES(training_time),cooking_availability=VALUES(cooking_availability),stress_level=VALUES(stress_level),completed_at=CURRENT_TIMESTAMP');
        $stmt->execute([$userId,$data['goal'],$data['targetWeightKg'],$data['activityBand'],json_encode($data['exerciseTypes'],JSON_THROW_ON_ERROR),$data['sessionDuration'],$data['trainingTime'],$data['cookingTime'],$data['stressLevel']]);
        $levels = ['sedentary'=>'low','light'=>'low','moderate'=>'moderate','intense'=>'high'];
        $pdo->prepare('UPDATE users SET goal=?,activity_level=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')->execute([$data['goal'],$levels[$data['activityBand']],$userId]);
        $minutes = ['short'=>20,'medium'=>45,'flexible'=>90][$data['cookingTime']];
        $pdo->prepare('UPDATE food_preferences SET cooking_time_minutes=CASE WHEN (?=\'short\' AND cooking_time_minutes<30) OR (?=\'medium\' AND cooking_time_minutes BETWEEN 30 AND 60) OR (?=\'flexible\' AND cooking_time_minutes>60) THEN cooking_time_minutes ELSE ? END WHERE user_id=?')->execute([$data['cookingTime'],$data['cookingTime'],$data['cookingTime'],$minutes,$userId]);
        $pdo->commit();
    } catch (Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
}

function withLifestylePreferences(PDO $pdo, array $user, array $preferences): array
{
    $lifestyle = readLifestyleGoals($pdo, (int)$user['id']);
    if ($lifestyle['completed'] && $lifestyle['settings']) $preferences['lifestyle'] = $lifestyle['settings'];
    return $preferences;
}

function handleLifestyleGoals(PDO $pdo, string $action, array $input): void
{
    $user = requireSessionUser($pdo); $userId = (int)$user['id'];
    if ((string)($input['userId'] ?? $_GET['userId'] ?? $userId) !== (string)$userId) sendError('No puedes acceder a las metas de otra cuenta.',403);
    if ($_SERVER['REQUEST_METHOD'] !== ($action === 'lifestyle.get' ? 'GET' : 'POST')) sendError('Metodo no permitido.',405);
    if ($action === 'lifestyle.save') {
        try { $data = validateLifestyleSettings($input['settings'] ?? null, true, (float)$user['weight_kg']); }
        catch (InvalidArgumentException $error) { sendError($error->getMessage(),422); }
        persistLifestyleGoals($pdo,$userId,$data);
    } elseif ($action === 'lifestyle.delete') {
        $pdo->beginTransaction();
        try {
            $pdo->prepare('DELETE FROM lifestyle_goals WHERE user_id=?')->execute([$userId]);
            $pdo->prepare("UPDATE users SET goal='improve_health',activity_level='moderate',updated_at=CURRENT_TIMESTAMP WHERE id=?")->execute([$userId]);
            $pdo->commit();
        } catch (Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
    }
    sendJson([...readLifestyleGoals($pdo,$userId),'user'=>mapUser(getUserById($pdo,$userId))]);
}
