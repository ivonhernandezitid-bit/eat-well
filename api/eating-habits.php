<?php
declare(strict_types=1);

require_once __DIR__ . '/dietary-recall.php';

function eatingHabitMinutes(mixed $value): ?int
{
    if (!is_string($value) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D', $value)) return null;
    return (int)substr($value, 0, 2) * 60 + (int)substr($value, 3, 2);
}

function processEatingHabits(array $recall, string $date): array
{
    $wake = eatingHabitMinutes($recall['wakeTime'] ?? null);
    $sleep = eatingHabitMinutes($recall['sleepTime'] ?? null);
    $awake = $wake !== null && $sleep !== null ? ($sleep - $wake + 1440) % 1440 : null;
    $warnings = [];
    if ($awake === 0) $awake = null;
    if ($awake === null) $warnings[] = 'No se puede determinar la jornada con las horas de despertar y dormir registradas.';
    $types = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
    $labels = ['Desayuno', 'Colacion matutina', 'Comida', 'Colacion vespertina', 'Cena'];
    $meals = []; $observed = []; $locations = []; $previousOffset = null;
    foreach (recallMealFields() as $index => [$type, $time, $place, $details, $skip]) {
        $skipped = $recall[$skip] ?? null;
        $minute = eatingHabitMinutes($recall[$time] ?? null);
        $description = is_string($recall[$details] ?? null) ? trim($recall[$details]) : '';
        $location = is_string($recall[$place] ?? null) ? trim($recall[$place]) : '';
        $status = $skipped === true ? 'omitted' : ($skipped === false && $minute !== null && $description !== '' && $location !== '' ? 'reported' : 'incomplete');
        $offset = $minute !== null && $wake !== null ? ($minute - $wake + 1440) % 1440 : null;
        $within = $awake !== null && $offset !== null ? $offset <= $awake : null;
        if ($status === 'omitted' && (($recall[$time] ?? '') !== '' || $description !== '' || $location !== '')) {
            $warnings[] = $labels[$index] . ': hay respuestas junto a la marca de comida omitida; requiere revision.';
        }
        if ($status === 'incomplete') $warnings[] = $labels[$index] . ': faltan respuestas para analizar esta comida.';
        if ($status === 'reported') {
            $locations[$location] = ($locations[$location] ?? 0) + 1;
            if ($within === false) $warnings[] = $labels[$index] . ': la hora esta fuera de la jornada declarada.';
            if ($within === true) {
                if ($previousOffset !== null && $offset <= $previousOffset) {
                    $warnings[] = 'El orden de las comidas declaradas no coincide con sus horarios o hay horas repetidas.';
                }
                $previousOffset = $offset;
                $observed[] = ['mealType' => $types[$index], 'time' => $recall[$time], 'offset' => $offset];
            }
        }
        $meals[] = ['mealType' => $types[$index], 'status' => $status,
            'time' => $status === 'reported' ? $recall[$time] : null,
            'location' => $status === 'reported' ? $location : null,
            'withinAwakePeriod' => $status === 'reported' ? $within : null];
    }
    // Offsets are relative to waking, so a midnight crossing is not a reversed day.
    usort($observed, static fn($a, $b) => $a['offset'] <=> $b['offset']);
    $intervals = [];
    for ($index = 1; $index < count($observed); ++$index) {
        $before = $observed[$index - 1]; $after = $observed[$index];
        $intervals[] = ['fromMeal' => $before['mealType'], 'toMeal' => $after['mealType'],
            'minutes' => $after['offset'] - $before['offset']];
    }
    $first = $observed[0] ?? null;
    $last = $observed ? $observed[count($observed) - 1] : null;
    $counts = array_count_values(array_column($meals, 'status'));
    $placeCounts = [];
    foreach ($locations as $place => $count) $placeCounts[] = ['location' => $place, 'meals' => $count];
    return [
        'referenceDate' => $date, 'basis' => 'single_24_hour_recall',
        'wakeTime' => $wake !== null ? $recall['wakeTime'] : null,
        'sleepTime' => $sleep !== null ? $recall['sleepTime'] : null,
        'awakeMinutes' => $awake,
        'crossesMidnight' => $awake !== null ? $sleep < $wake : null,
        'reportedMeals' => $counts['reported'] ?? 0, 'omittedMeals' => $counts['omitted'] ?? 0,
        'incompleteMeals' => $counts['incomplete'] ?? 0, 'meals' => $meals,
        'locations' => $placeCounts, 'intervals' => $intervals,
        'longestIntervalMinutes' => $intervals ? max(array_column($intervals, 'minutes')) : null,
        'wakeToFirstMealMinutes' => $first['offset'] ?? null,
        'lastMealToSleepMinutes' => $last !== null ? $awake - $last['offset'] : null,
        'firstMealTime' => $first['time'] ?? null, 'lastMealTime' => $last['time'] ?? null,
        'qualityWarnings' => array_values(array_unique($warnings)),
        'limitations' => 'Describe un solo dia declarado; no demuestra habitos permanentes ni evalua la calidad nutricional o las porciones.',
    ];
}

function readEatingHabits(PDO $pdo, int $userId): array
{
    $source = initialRecallRecord($pdo, $userId);
    if (!$source) return ['initialCompleted' => false, 'analysis' => null];
    $record = readDietaryRecall($pdo, $userId, $source['recall_date']);
    return ['initialCompleted' => true,
        'analysis' => processEatingHabits($record['recall'], $record['recallDate'])];
}

function handleEatingHabits(PDO $pdo, array $input): void
{
    $user = requireSessionUser($pdo);
    $userId = (int)$user['id'];
    if ((string)($input['userId'] ?? $_GET['userId'] ?? $userId) !== (string)$userId) {
        sendError('No puedes acceder al analisis alimenticio de otra cuenta.', 403);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') sendError('Metodo no permitido.', 405);
    sendJson(readEatingHabits($pdo, $userId));
}
