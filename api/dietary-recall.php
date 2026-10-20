<?php
declare(strict_types=1);
require_once __DIR__ . '/meal-schedule.php';

function recallMealFields(): array
{
    return [
        ['breakfast','breakfastTime','breakfastPlace','breakfastDetails','noBreakfast',1],
        ['snack','snackTime','snackPlace','snackDetails','noSnack',2],
        ['lunch','lunchTime','lunchPlace','lunchDetails','noLunch',3],
        ['snack','afternoonSnackTime','afternoonSnackPlace','afternoonSnackDetails','noAfternoonSnack',5],
        ['dinner','dinnerTime','dinnerPlace','dinnerDetails','noDinner',4],
    ];
}

function validateRecallDate(mixed $value): string
{
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) throw new InvalidArgumentException('Selecciona el dia que estas recordando.');
    [$year, $month, $day] = array_map('intval', explode('-', $value));
    $today = (new DateTimeImmutable('today', new DateTimeZone('America/Mexico_City')))->format('Y-m-d');
    if ($year < 1900 || !checkdate($month, $day, $year) || $value > $today) throw new InvalidArgumentException('Selecciona una fecha valida que no sea futura.');
    return $value;
}

function validateDietaryRecall(array $input): array
{
    $timeFields = ['wakeTime','sleepTime','activityTime','breakfastTime','snackTime','lunchTime','afternoonSnackTime','dinnerTime'];
    $timeLabels = [
        'wakeTime' => 'Hora de despertar',
        'sleepTime' => 'Hora de dormir',
        'activityTime' => 'Hora de actividad física',
        'breakfastTime' => 'Hora del desayuno',
        'snackTime' => 'Hora de la colación matutina',
        'lunchTime' => 'Hora de la comida',
        'afternoonSnackTime' => 'Hora de la colación vespertina',
        'dinnerTime' => 'Hora de la cena',
    ];
    $textFields = ['wakeActivity'=>10000,'activityType'=>150,'activityDuration'=>120];
    foreach (recallMealFields() as [$type, $time, $place, $details, $skipped]) {
        $textFields[$place] = 150;
        $textFields[$details] = 10000;
        if (!isset($input[$skipped]) || !is_bool($input[$skipped])) throw new InvalidArgumentException('Indica si omitiste cada comida.');
    }
    if (!isset($input['noActivity']) || !is_bool($input['noActivity'])) throw new InvalidArgumentException('Actividad física: indica si realizaste actividad o movimiento.');
    $values = ['noActivity' => $input['noActivity']];
    foreach ($timeFields as $field) {
        $value = $input[$field] ?? null;
        if (!is_string($value) || ($value !== '' && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D', $value))) {
            throw new InvalidArgumentException(($timeLabels[$field] ?? $field) . ': selecciona una hora válida.');
        }
        $values[$field] = $value;
    }
    foreach ($textFields as $field => $max) {
        $value = $input[$field] ?? null;
        if (!is_string($value) || ($max === 10000 ? strlen($value) : mb_strlen($value, 'UTF-8')) > $max) {
            $label = ['wakeActivity' => 'Actividad al despertar', 'activityType' => 'Tipo de actividad', 'activityDuration' => 'Duración de actividad'][$field] ?? $field;
            throw new InvalidArgumentException("El campo “$label” debe contener texto y no superar $max caracteres.");
        }
        $values[$field] = trim($value);
    }
    if ($values['wakeTime'] === '') throw new InvalidArgumentException('Hora de despertar: selecciona una hora.');
    if ($values['wakeActivity'] === '') throw new InvalidArgumentException('Actividad al despertar: describe qué hiciste al levantarte.');
    if ($values['sleepTime'] === '') throw new InvalidArgumentException('Hora de dormir: selecciona una hora.');
    $mealLabels = ['breakfast' => 'Desayuno', 'snack' => 'Colación', 'lunch' => 'Comida', 'dinner' => 'Cena'];
    foreach (recallMealFields() as [$type, $time, $place, $details, $skipped]) {
        $label = $time === 'afternoonSnackTime' ? 'Colación vespertina' : ($time === 'snackTime' ? 'Colación matutina' : $mealLabels[$type]);
        $values[$skipped] = $input[$skipped];
        if ($values[$skipped]) {
            if ($values[$time] !== '' || $values[$place] !== '' || $values[$details] !== '') throw new InvalidArgumentException("$label: está marcada como omitida; limpia su hora, lugar y alimentos.");
        } else {
            $places = ['En casa','En la oficina','En otro lugar', $type === 'lunch' ? 'Fonda / Restaurante' : 'En restaurante'];
            if ($values[$time] === '') throw new InvalidArgumentException("$label: selecciona una hora o marca que no realizaste esta comida.");
            if (!in_array($values[$place], $places, true)) throw new InvalidArgumentException("$label: selecciona dónde comiste o marca que no realizaste esta comida.");
            if ($values[$details] === '') throw new InvalidArgumentException("$label: describe los alimentos y bebidas o marca que no realizaste esta comida.");
        }
    }
    $activity = [$values['activityTime'], $values['activityType'], $values['activityDuration']];
    if ($values['noActivity']) {
        if (count(array_filter($activity, fn($value) => $value !== '')) > 0) throw new InvalidArgumentException('Actividad física: está marcada como no realizada; limpia hora, tipo y duración.');
    } else {
        if ($values['activityTime'] === '') throw new InvalidArgumentException('Actividad física: selecciona una hora o marca que no realizaste actividad.');
        if ($values['activityType'] === '') throw new InvalidArgumentException('Tipo de actividad o movimiento: describe la actividad o marca que no realizaste actividad.');
        if ($values['activityDuration'] === '') throw new InvalidArgumentException('Duración de la actividad: indica cuánto tiempo o marca que no realizaste actividad.');
    }
    return $values;
}

function readDietaryRecall(PDO $pdo, int $userId, string $date): array
{
    $statement = $pdo->prepare('SELECT * FROM dietary_recalls WHERE user_id = ? AND recall_date = ?');
    $statement->execute([$userId, $date]);
    $record = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$record) return ['recall' => null, 'recallDate' => $date, 'completed' => false];
    $time = fn($value) => $value === null ? '' : substr($value, 0, 5);
    $data = ['wakeTime'=>$time($record['wake_time']), 'wakeActivity'=>$record['wake_activity'] ?? '',
        'sleepTime'=>$time($record['sleep_time']), 'activityTime'=>$time($record['exercise_time']),
        'activityType'=>$record['exercise_type'] ?? '', 'activityDuration'=>$record['exercise_duration'] ?? '',
        'noActivity'=>$record['completed_at'] !== null && $record['exercise_time'] === null && $record['exercise_type'] === null && $record['exercise_duration'] === null];
    $statement = $pdo->prepare('SELECT * FROM dietary_recall_meals WHERE recall_id = ? ORDER BY position');
    $statement->execute([$record['id']]);
    $meals = [];
    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $meal) $meals[(int)$meal['position']] = $meal;
    foreach (recallMealFields() as [$type, $timeField, $place, $details, $skipped, $position]) {
        $meal = $meals[$position] ?? null;
        if ($meal && $meal['meal_type'] !== $type) throw new RuntimeException('El recordatorio tiene una estructura de comidas distinta. Revisar antes de editar.');
        $data[$timeField] = $time($meal['meal_time'] ?? null);
        $data[$place] = $meal['location'] ?? '';
        $data[$details] = $meal['food_drink_quantities'] ?? '';
        $data[$skipped] = (bool)($meal['skipped'] ?? false);
    }
    return ['recall'=>$data, 'recallDate'=>$date, 'completed'=>$record['completed_at'] !== null];
}

function saveDietaryRecall(PDO $pdo, int $userId, string $date, array $data): array
{
    $pdo->beginTransaction();
    try {
        $lock=$pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE'); $lock->execute([$userId]);
        if(initialRecallRecord($pdo,$userId)) throw new InitialRecallCompleted('El recordatorio inicial ya fue completado. Ajusta tus horarios desde el perfil.');
        $statement = $pdo->prepare('INSERT INTO dietary_recalls (user_id,recall_date,wake_time,wake_activity,exercise_time,exercise_type,exercise_duration,sleep_time,completed_at) VALUES (?,?,?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),wake_time=VALUES(wake_time),wake_activity=VALUES(wake_activity),exercise_time=VALUES(exercise_time),exercise_type=VALUES(exercise_type),exercise_duration=VALUES(exercise_duration),sleep_time=VALUES(sleep_time),completed_at=NOW()');
        $statement->execute([$userId,$date,$data['wakeTime'],$data['wakeActivity'],
            $data['noActivity'] ? null : $data['activityTime'], $data['noActivity'] ? null : $data['activityType'],
            $data['noActivity'] ? null : $data['activityDuration'], $data['sleepTime']]);
        $recallId = (int)$pdo->lastInsertId();
        $existing = $pdo->prepare('SELECT position,meal_type FROM dietary_recall_meals WHERE recall_id = ? AND position BETWEEN 1 AND 5 FOR UPDATE');
        $existing->execute([$recallId]);
        $fields=[]; foreach(recallMealFields() as $field) $fields[$field[5]]=$field[0];
        foreach ($existing->fetchAll(PDO::FETCH_ASSOC) as $meal) {
            if ($fields[(int)$meal['position']] !== $meal['meal_type']) throw new RuntimeException('El recordatorio tiene una estructura de comidas distinta. Revisar antes de editar.');
        }
        $statement = $pdo->prepare('INSERT INTO dietary_recall_meals (recall_id,position,meal_type,meal_time,location,food_drink_quantities,skipped) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE meal_type=VALUES(meal_type),meal_time=VALUES(meal_time),location=VALUES(location),food_drink_quantities=VALUES(food_drink_quantities),skipped=VALUES(skipped)');
        foreach (recallMealFields() as [$type,$time,$place,$details,$skipped,$position]) {
            $statement->execute([$recallId,$position,$type,$data[$skipped] ? null : $data[$time],
                $data[$skipped] ? null : $data[$place],$data[$skipped] ? null : $data[$details],(int)$data[$skipped]]);
        }
        ensureMealSchedule($pdo,$userId,initialRecallRecord($pdo,$userId));
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    return readDietaryRecall($pdo, $userId, $date);
}

function handleDietaryRecall(PDO $pdo, string $action, array $input): void
{
    $user = requireSessionUser($pdo);
    $userId = (int)$user['id'];
    if ((string)($input['userId'] ?? $_GET['userId'] ?? $userId) !== (string)$userId) sendError('No puedes acceder al recordatorio de otra cuenta.', 403);
    if ($_SERVER['REQUEST_METHOD'] !== ($action === 'recall.save' ? 'POST' : 'GET')) sendError('Metodo no permitido.', 405);
    if($action==='recall.initial') {
        $record=initialRecallRecord($pdo,$userId);
        if($record) sendJson(readDietaryRecall($pdo,$userId,$record['recall_date']));
        $yesterday=(new DateTimeImmutable('yesterday',new DateTimeZone('America/Mexico_City')))->format('Y-m-d');
        sendJson(['recall'=>null,'recallDate'=>$yesterday,'completed'=>false]);
    }
    try {
        $date = validateRecallDate($input['recallDate'] ?? $_GET['recallDate'] ?? null);
        if ($action === 'recall.get') sendJson(readDietaryRecall($pdo, $userId, $date));
        if (!isset($input['recall']) || !is_array($input['recall'])) throw new InvalidArgumentException('El recordatorio no tiene un formato valido.');
        $data = validateDietaryRecall($input['recall']);
    } catch (InvalidArgumentException $error) {
        sendError($error->getMessage(), 422);
    }
    try { $saved=saveDietaryRecall($pdo,$userId,$date,$data); }
    catch(InitialRecallCompleted $error) { sendError($error->getMessage(),409); }
    sendJson($saved);
}
