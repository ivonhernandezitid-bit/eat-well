<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/clinical-history.php';
require dirname(__DIR__) . '/auth-session.php';

class ApiResponse extends RuntimeException {
    public function __construct(public array $body, public int $status) { parent::__construct('Captured API response'); }
}
function sendJson(array $body, int $status = 200): void { throw new ApiResponse($body, $status); }
function sendError(string $message, int $status = 400): void { throw new ApiResponse(['error' => $message], $status); }
function getUserById(PDO $pdo, int $userId): array {
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: throw new RuntimeException('Unknown test user');
}
function capture(callable $action, int $expected = 200): array {
    try { $action(); } catch (ApiResponse $response) {
        if ($response->status !== $expected) throw new RuntimeException('Unexpected status ' . $response->status);
        return $response->body;
    }
    throw new RuntimeException('No API response');
}
function expectInvalid(array $history): void {
    try { validateClinicalHistory($history, ['gender' => 'female']); }
    catch (InvalidArgumentException) { return; }
    throw new RuntimeException('Invalid history was accepted');
}

$history = [];
foreach (clinicalHistoryFields() as $field => [$column, $type]) {
    $history[$field] = $type === 'bool' ? false : ($type === 'text' ? '' : ($type === 'list' ? [] : (is_array($type) ? array_key_first($type) : 0)));
}
foreach (['familyNone','diagnosisNone','wellbeingNone','allergiesNone','surgeriesNone','hospitalizationsNone','medicationsNone','medicationAllergiesNone','supplementsNone'] as $field) $history[$field] = true;
$history['familyNone'] = false;
$history['familyDiabetes'] = true;
$history['allergiesNone'] = false;
$history['allergies'] = ['Gluten', 'Nuez/Maní'];
$history['wellbeingNotes'] = 'Nota de prueba con acentos: información.';
$history['waterLiters'] = 2;
validateClinicalHistory($history, ['gender' => 'female']);
$invalid = $history; $invalid['familyNone'] = true; expectInvalid($invalid);
$invalid = $history; $invalid['waterLiters'] = -1; expectInvalid($invalid);
$invalid = $history; $invalid['allergies'] = [['invalid']]; expectInvalid($invalid);
$invalid = $history; $invalid['sleepHours'] = ''; expectInvalid($invalid);
foreach (['pregnant','lactating','menstrualCycle'] as $field) {
    $invalid = $history; $invalid[$field] = ''; expectInvalid($invalid);
}
$withCycleNotApplicable = $history;
$withCycleNotApplicable['menstrualCycle'] = 'No aplica';
if (validateClinicalHistory($withCycleNotApplicable, ['gender' => 'female'])['menstrual_cycle'] !== 'not_applicable') throw new RuntimeException('Cycle option was rejected');
foreach (['male','other'] as $sex) {
    $irrelevant = $history;
    $irrelevant['pregnant'] = 'Sí'; $irrelevant['lactating'] = 'Sí';
    $irrelevant['diagnosisSop'] = true;
    $mapped = validateClinicalHistory($irrelevant, ['gender' => $sex]);
    if ($mapped['pregnant'] !== null || $mapped['lactating'] !== null || $mapped['menstrual_cycle'] !== null || $mapped['diagnosis_pcos'] !== null) throw new RuntimeException('Sex-specific fields were saved for another sex');
}
foreach ([0,-1,1.5,65536,null] as $amount) {
    $invalid = $history; $invalid['tobacco'] = 'Fumo'; $invalid['cigarettesPerDay'] = $amount; expectInvalid($invalid);
}
$invalid = $history; $invalid['cigarettesPerDay'] = 5; expectInvalid($invalid);
$smoker = $history; $smoker['tobacco'] = 'Fumo'; $smoker['cigarettesPerDay'] = 3;
validateClinicalHistory($smoker, ['gender' => 'female']);
$invalid = $history; $invalid['waterLiters'] = 4; expectInvalid($invalid);
$invalid = $history; $invalid['familyDiabetes'] = 1; expectInvalid($invalid);
$invalid = $history; $invalid['surgeries'] = 'Una cirugía'; expectInvalid($invalid);
$invalid = $history; $invalid['wellbeingNotes'] = str_repeat('x', 10001); expectInvalid($invalid);
$invalid = $history; unset($invalid['sleepQuality']); expectInvalid($invalid);
$groups = [
    'familyNone' => ['familyDiabetes','familyHypertension','familyObesity','familyCholesterol','familyCancer','familyRenal','familyThyroid'],
    'diagnosisNone' => ['diagnosisDiabetes','diagnosisHypertension','diagnosisFattyLiver','diagnosisSop','diagnosisGout','diagnosisHypothyroidism'],
    'wellbeingNone' => ['wellbeingAnemia','wellbeingBulimia','wellbeingDepression','wellbeingAnxiety','wellbeingOther'],
    'allergiesNone' => ['allergies','otherAllergies'],
    'surgeriesNone' => ['surgeries'], 'hospitalizationsNone' => ['hospitalizations'],
    'medicationsNone' => ['medications'], 'medicationAllergiesNone' => ['medicationAllergies'], 'supplementsNone' => ['supplements'],
];
$noneHistory = $history;
$noneHistory['familyNone'] = true; $noneHistory['familyDiabetes'] = false;
$noneHistory['allergiesNone'] = true; $noneHistory['allergies'] = [];
foreach ($groups as $none => $fields) {
    foreach ($fields as $field) {
        $conflict = $noneHistory;
        $conflict[$field] = is_array($conflict[$field]) ? ['Gluten'] : (is_string($conflict[$field]) ? 'Respuesta' : true);
        expectInvalid($conflict);
    }
}

$pdo = new PDO('mysql:host=127.0.0.1;dbname=eatwell_db;charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$userSchema = $pdo->query('SHOW CREATE TABLE users')->fetch(PDO::FETCH_NUM)[1];
$clinicalSchema = $pdo->query('SHOW CREATE TABLE clinical_histories')->fetch(PDO::FETCH_NUM)[1];
$test = 'eatwell_clinical_check_' . bin2hex(random_bytes(6));
$pdo->exec("CREATE DATABASE `$test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
try {
    $pdo->exec("USE `$test`");
    $pdo->exec($userSchema);
    $pdo->exec($clinicalSchema);
    $pdo->exec("INSERT INTO users (id,name,username,email,password_hash,gender) VALUES (91001,'Test','clinical_1','clinical1@example.invalid','synthetic','female'), (91002,'Test','clinical_2','clinical2@example.invalid','synthetic','male')");
    $_GET = [];
    $_SERVER['REQUEST_METHOD'] = 'GET';
    capture(fn() => handleClinicalHistory($pdo, 'clinical.get', []), 401);
    $token = issueAuthToken(91001);
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
    $empty = capture(fn() => handleClinicalHistory($pdo, 'clinical.get', []));
    if ($empty['history'] !== null) throw new RuntimeException('New patient has a history');
    $_SERVER['REQUEST_METHOD'] = 'POST';
    capture(fn() => handleClinicalHistory($pdo, 'clinical.save', ['userId' => 91002, 'history' => $history]), 403);
    $saved = capture(fn() => handleClinicalHistory($pdo, 'clinical.save', ['userId' => 91001, 'history' => $history]));
    if (!$saved['completed'] || $saved['history']['allergies'] !== $history['allergies']) throw new RuntimeException('History did not round-trip');
    $invalid = $history; $invalid['allergiesNone'] = true;
    capture(fn() => handleClinicalHistory($pdo, 'clinical.save', ['history' => $invalid]), 422);
    $history['wellbeingNotes'] = 'Edited test';
    capture(fn() => handleClinicalHistory($pdo, 'clinical.save', ['history' => $history]));
    if ((int)$pdo->query('SELECT COUNT(*) FROM clinical_histories')->fetchColumn() !== 1) throw new RuntimeException('Edit created duplicates');
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $loaded = capture(fn() => handleClinicalHistory($pdo, 'clinical.get', []));
    if ($loaded['history']['wellbeingNotes'] !== 'Edited test') throw new RuntimeException('Edited history was not loaded');
    $pdo->exec("UPDATE users SET gender='male' WHERE id=91001");
    $masked = readClinicalHistory($pdo, 91001)['history'];
    if ($masked['pregnant'] !== '' || $masked['lactating'] !== '' || $masked['menstrualCycle'] !== '' || $masked['diagnosisSop'] !== false) throw new RuntimeException('Read exposed sex-specific fields');
    $pdo->exec("UPDATE users SET gender='female' WHERE id=91001");
    $otherToken = issueAuthToken(91002);
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $otherToken;
    $empty = capture(fn() => handleClinicalHistory($pdo, 'clinical.get', []));
    if ($empty['history'] !== null) throw new RuntimeException('Patient histories leaked');
    $_SERVER['REQUEST_METHOD'] = 'POST';
    capture(fn() => handleClinicalHistory($pdo, 'clinical.delete', ['userId' => 91001]), 403);
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
    capture(fn() => handleClinicalHistory($pdo, 'clinical.delete', []));
    if (readClinicalHistory($pdo, 91001)['history'] !== null) throw new RuntimeException('History was not deleted');
    capture(fn() => logoutSession($pdo));
    capture(fn() => handleClinicalHistory($pdo, 'clinical.get', []), 401);
} finally {
    foreach ([$token ?? null, $otherToken ?? null] as $testToken) {
        if ($testToken) {
            startApiSession($testToken);
            $_SESSION = [];
            session_destroy();
        }
    }
    $pdo->exec('USE eatwell_db');
    $pdo->exec("DROP DATABASE `$test`");
}
echo "Clinical history tests passed: validation, save, edit, read, isolation, deletion and session revocation.\n";
