<?php
declare(strict_types=1);
class InitialRecallCompleted extends RuntimeException {}

function mealScheduleFields(): array
{
    return ['breakfastTime'=>'breakfast_time','morningSnackTime'=>'morning_snack_time','lunchTime'=>'lunch_time','afternoonSnackTime'=>'afternoon_snack_time','dinnerTime'=>'dinner_time'];
}
function initialRecallRecord(PDO $pdo, int $userId): ?array
{
    $stmt=$pdo->prepare('SELECT * FROM dietary_recalls WHERE user_id=? AND completed_at IS NOT NULL ORDER BY created_at,id LIMIT 1');
    $stmt->execute([$userId]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}
function suggestedMealSchedule(array $data): array
{
    $minutes=fn($value)=>preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D',(string)$value) ? (int)substr($value,0,2)*60+(int)substr($value,3,2) : null;
    $wake=$minutes($data['wakeTime'] ?? '') ?? 420;
    $sleep=$minutes($data['sleepTime'] ?? '') ?? (($wake+960)%1440);
    $span=($sleep-$wake+1440)%1440;
    if ($span<60) $span=960;
    $relative=function($value) use($minutes,$wake,$span) { $time=$minutes($value); if ($time===null) return null; $offset=($time-$wake+1440)%1440; return $offset>0 && $offset<$span ? $offset : null; };
    $breakfast=$relative($data['breakfastTime'] ?? '') ?? (int)round($span/6);
    $lunch=$relative($data['lunchTime'] ?? '') ?? (int)round($span/2);
    $dinner=$relative($data['dinnerTime'] ?? '') ?? (int)round($span*5/6);
    if (!($breakfast+2<$lunch && $lunch+2<$dinner)) { $breakfast=(int)round($span/6); $lunch=(int)round($span/2); $dinner=(int)round($span*5/6); }
    $morning=$relative($data['snackTime'] ?? '');
    if ($morning===null || $morning<=$breakfast || $morning>=$lunch) $morning=(int)floor(($breakfast+$lunch)/2);
    $afternoon=$relative($data['afternoonSnackTime'] ?? '');
    if ($afternoon===null || $afternoon<=$lunch || $afternoon>=$dinner) $afternoon=(int)floor(($lunch+$dinner)/2);
    $format=fn($offset)=>sprintf('%02d:%02d',intdiv(($wake+$offset)%1440,60),($wake+$offset)%60);
    return array_combine(array_keys(mealScheduleFields()),array_map($format,[$breakfast,$morning,$lunch,$afternoon,$dinner]));
}
function ensureMealSchedule(PDO $pdo, int $userId, array $source): void
{
    if ((int)$source['user_id']!==$userId) throw new RuntimeException('El recordatorio no pertenece a esta cuenta.');
    $data=readDietaryRecall($pdo,$userId,$source['recall_date'])['recall'];
    $times=suggestedMealSchedule($data);
    $stmt=$pdo->prepare('INSERT INTO meal_schedules (user_id,source_recall_id,breakfast_time,morning_snack_time,lunch_time,afternoon_snack_time,dinner_time) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE user_id=user_id');
    $stmt->execute([$userId,$source['id'],...array_values($times)]);
}
function readMealSchedule(PDO $pdo, int $userId): array
{
    $source=initialRecallRecord($pdo,$userId);
    if (!$source) return ['schedule'=>null,'initialCompleted'=>false,'customized'=>false];
    $stmt=$pdo->prepare('SELECT * FROM meal_schedules WHERE user_id=?'); $stmt->execute([$userId]); $record=$stmt->fetch(PDO::FETCH_ASSOC);
    if (!$record) { ensureMealSchedule($pdo,$userId,$source); $stmt->execute([$userId]); $record=$stmt->fetch(PDO::FETCH_ASSOC); }
    $schedule=[]; foreach(mealScheduleFields() as $field=>$column) $schedule[$field]=substr($record[$column],0,5);
    return ['schedule'=>$schedule,'initialCompleted'=>true,'customized'=>(bool)$record['is_customized']];
}
function validateMealSchedule(mixed $input): array
{
    if (!is_array($input)) throw new InvalidArgumentException('Revisa los horarios.');
    $times=[]; foreach(mealScheduleFields() as $field=>$column) {
        $value=$input[$field]??null;
        if (!is_string($value) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D',$value)) throw new InvalidArgumentException('Indica una hora valida para cada comida.');
        $times[$field]=$value;
    }
    if(count(array_unique($times))!==5) throw new InvalidArgumentException('Asigna un horario diferente a cada comida.');
    return $times;
}
function handleMealSchedule(PDO $pdo,string $action,array $input): void
{
    $user=requireSessionUser($pdo); $userId=(int)$user['id'];
    if ((string)($input['userId']??$_GET['userId']??$userId)!==(string)$userId) sendError('No puedes acceder a los horarios de otra cuenta.',403);
    if($_SERVER['REQUEST_METHOD']!==($action==='schedule.get'?'GET':'POST')) sendError('Metodo no permitido.',405);
    $response=readMealSchedule($pdo,$userId);
    if($action==='schedule.get') sendJson($response);
    if(!$response['initialCompleted']) sendError('Completa primero tu recordatorio inicial.',409);
    try { $times=validateMealSchedule($input['schedule']??null); } catch(InvalidArgumentException $error) { sendError($error->getMessage(),422); }
    $stmt=$pdo->prepare('UPDATE meal_schedules SET breakfast_time=?,morning_snack_time=?,lunch_time=?,afternoon_snack_time=?,dinner_time=?,is_customized=1 WHERE user_id=?');
    $stmt->execute([...array_values($times),$userId]);
    sendJson(readMealSchedule($pdo,$userId));
}
