<?php
declare(strict_types=1);

function validateBodyMeasurement(array $input): array
{
    $values = [];
    foreach (['waistCm', 'hipCm', 'armCm', 'thighCm', 'neckCm'] as $key) {
        $value = $input[$key] ?? null;
        if (is_bool($value) || !is_numeric($value) || !is_finite((float)$value) || $value <= 0 || $value > 250) {
            throw new InvalidArgumentException('Completa las cinco medidas entre 0.01 y 250 cm.');
        }
        $values[$key] = round((float)$value, 2);
        if ($values[$key] <= 0) throw new InvalidArgumentException('La medida debe ser de al menos 0.01 cm.');
    }
    $clientId = $input['id'] ?? null;
    if (!is_string($clientId) || !preg_match('/^[a-zA-Z0-9_-]{1,64}$/D', $clientId)) throw new InvalidArgumentException('El identificador de la medicion no es valido.');
    $date = $input['measuredAt'] ?? null;
    if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/D', $date)) throw new InvalidArgumentException('La fecha de la medicion no es valida.');
    $format = str_contains($date, '.') ? '!Y-m-d\TH:i:s.v\Z' : '!Y-m-d\TH:i:s\Z';
    $parsed = DateTimeImmutable::createFromFormat($format, $date, new DateTimeZone('UTC'));
    $errors = DateTimeImmutable::getLastErrors();
    if (!$parsed || ($errors && ($errors['warning_count'] || $errors['error_count']))
        || $parsed > new DateTimeImmutable('+5 minutes')) throw new InvalidArgumentException('Revisa la fecha de la medicion.');
    return [...$values, 'id' => $clientId, 'measuredAt' => $parsed->format('Y-m-d H:i:s.v')];
}

function readBodyMeasurementHistory(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('SELECT * FROM body_measurements WHERE user_id=? ORDER BY measured_at DESC,id DESC LIMIT 500');
    $stmt->execute([$userId]);
    return array_reverse(array_map(static function ($row) {
        $record = ['id' => $row['client_id'], 'measuredAt' => str_replace(' ', 'T', $row['measured_at']) . 'Z'];
        foreach (['waistCm'=>'waist_cm', 'hipCm'=>'hip_cm', 'armCm'=>'arm_cm', 'thighCm'=>'thigh_cm', 'neckCm'=>'neck_cm', 'weightKg'=>'weight_kg', 'heightCm'=>'height_cm'] as $key=>$column) $record[$key] = (float)$row[$column];
        return $record;
    }, $stmt->fetchAll(PDO::FETCH_ASSOC)));
}

function handleBodyMeasurements(PDO $pdo, string $action, array $input): void
{
    $user = requireSessionUser($pdo);
    $userId = (int)$user['id'];
    if ((string)($input['userId'] ?? $_GET['userId'] ?? $userId) !== (string)$userId) sendError('No puedes acceder a mediciones de otra cuenta.', 403);
    if ($_SERVER['REQUEST_METHOD'] !== ($action === 'body-measurements.save' ? 'POST' : 'GET')) sendError('Metodo no permitido.', 405);
    if ($action === 'body-measurements.save') {
        try {
            if (!is_array($input['measurement'] ?? null)) throw new InvalidArgumentException('La medicion no es valida.');
            $record = validateBodyMeasurement($input['measurement']);
        } catch (InvalidArgumentException $error) { sendError($error->getMessage(), 422); }
        // Weight and height are snapshots of the authenticated profile, never client-supplied values.
        $stmt = $pdo->prepare('INSERT INTO body_measurements (user_id,client_id,measured_at,waist_cm,hip_cm,arm_cm,thigh_cm,neck_cm,weight_kg,height_cm) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE client_id=VALUES(client_id)');
        $stmt->execute([$userId,$record['id'],$record['measuredAt'],$record['waistCm'],$record['hipCm'],$record['armCm'],$record['thighCm'],$record['neckCm'],$user['weight_kg'],$user['height_cm']]);
    }
    sendJson(['measurements' => readBodyMeasurementHistory($pdo, $userId)]);
}
