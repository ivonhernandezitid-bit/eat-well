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
function expectInvalid(array $history, ?string $expectedMessage = null): void {
    try { validateClinicalHistory($history, ['gender' => 'female']); }
    catch (InvalidArgumentException $error) {
        if ($expectedMessage !== null && !str_contains($error->getMessage(), $expectedMessage)) {
            throw new RuntimeException('Unexpected validation message: ' . $error->getMessage());
        }
        return;
    }
    throw new RuntimeException('Invalid history was accepted');
}

$history = [];
foreach (clinicalHistoryFields() as $field => [$column, $type]) {
    $history[$field] = $type === 'bool' ? false : ($type === 'text' ? '' : ($type === 'list' ? [] : (is_array($type) ? array_key_first($type) : 0)));
}
foreach (['familyNone','diagnosisMetabolismNone','diagnosisThyroidNone','diagnosisOtherNone','diagnosisDigestiveNone','allergiesNone','surgeriesNone','hospitalizationsNone','medicationsNone','medicationAllergiesNone','supplementsNone'] as $field) $history[$field] = true;
$history['familyNone'] = false;
$history['familyDiabetes'] = true;
$history['diagnosisMetabolismNone'] = false;
$history['diagnosisThyroidNone'] = false;
$history['diagnosisOtherNone'] = false;
$history['diagnosisDigestiveNone'] = false;
$history['diagnosisDiabetes'] = true;
$history['diagnosisHypothyroidism'] = true;
$history['diagnosisHyperthyroidism'] = true;
$history['diagnosisDyslipidemia'] = true;
$history['diagnosisInsulinResistance'] = true;
$history['diagnosisChronicKidneyDisease'] = true;
$history['diagnosisKidneyStones'] = true;
$history['diagnosisCeliac'] = true;
$history['diagnosisIrritableBowel'] = true;
$history['diagnosisGastritis'] = true;
$history['diagnosisUlcerativeColitis'] = true;
$history['otherDiagnoses'] = 'Diagnóstico adicional de prueba';
$history['allergiesNone'] = false;
$history['allergies'] = ['Gluten', 'Nuez/Maní', 'APLV (proteína de leche de vaca)'];
$history['waterLiters'] = 2;
validateClinicalHistory($history, ['gender' => 'female']);
foreach (['wellbeingNone', 'wellbeingAnemia', 'wellbeingBulimia', 'wellbeingDepression', 'wellbeingAnxiety', 'wellbeingOther', 'wellbeingTreatment', 'wellbeingSupport', 'wellbeingNotes', 'appetite', 'anxiety'] as $removedField) {
    if (array_key_exists($removedField, $history)) throw new RuntimeException('Removed clinical field is still collected: ' . $removedField);
}
$legacyEatingDisorderFields = ['diagnosisAnorexia', 'diagnosisBulimia', 'diagnosisBingeEating'];
$apiFields = clinicalHistoryFields();
foreach ($legacyEatingDisorderFields as $removedField) {
    if (array_key_exists($removedField, $history) || isset($apiFields[$removedField])) {
        throw new RuntimeException('Eating-disorder field is still collected: ' . $removedField);
    }
}
$invalid = $history; $invalid['familyNone'] = true; expectInvalid($invalid, 'Antecedentes heredofamiliares');
$invalid = $history; $invalid['waterLiters'] = -1; expectInvalid($invalid, 'Agua natural al día');
$invalid = $history; $invalid['allergies'] = [['invalid']]; expectInvalid($invalid);
$invalid = $history; $invalid['sleepHours'] = ''; expectInvalid($invalid, 'Horas de sueño');
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
$invalid = $history; unset($invalid['sleepQuality']); expectInvalid($invalid);
$groups = [
    'familyNone' => ['familyDiabetes','familyHypertension','familyObesity','familyCholesterol','familyCancer','familyRenal','familyThyroid'],
    'diagnosisMetabolismNone' => ['diagnosisDiabetes','diagnosisInsulinResistance','diagnosisSop'],
    'diagnosisThyroidNone' => ['diagnosisHypothyroidism','diagnosisHyperthyroidism'],
    'diagnosisOtherNone' => ['diagnosisHypertension','diagnosisDyslipidemia','diagnosisFattyLiver','diagnosisGout','diagnosisChronicKidneyDisease','diagnosisKidneyStones','otherDiagnoses'],
    'diagnosisDigestiveNone' => ['diagnosisCeliac','diagnosisIrritableBowel','diagnosisGastritis','diagnosisUlcerativeColitis'],
    'allergiesNone' => ['allergies','otherAllergies'],
    'surgeriesNone' => ['surgeries'], 'hospitalizationsNone' => ['hospitalizations'],
    'medicationsNone' => ['medications'], 'medicationAllergiesNone' => ['medicationAllergies'], 'supplementsNone' => ['supplements'],
];
$noneHistory = $history;
$noneHistory['familyNone'] = true; $noneHistory['familyDiabetes'] = false;
foreach (['diagnosisMetabolismNone','diagnosisThyroidNone','diagnosisOtherNone','diagnosisDigestiveNone'] as $field) $noneHistory[$field] = true;
foreach (array_merge(...array_values(array_slice($groups, 1, 4, true))) as $field) $noneHistory[$field] = is_string($noneHistory[$field]) ? '' : false;
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
    $token = issueAuthToken($pdo, 91001);
    $storedToken = $pdo->prepare('SELECT token_hash, expires_at FROM auth_sessions WHERE user_id = ?');
    $storedToken->execute([91001]);
    $tokenRecord = $storedToken->fetch();
    if (!$tokenRecord || $tokenRecord['token_hash'] !== hash('sha256', $token) || $tokenRecord['token_hash'] === $token) {
        throw new RuntimeException('Authentication token was not stored as a hash');
    }
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
    $empty = capture(fn() => handleClinicalHistory($pdo, 'clinical.get', []));
    if ($empty['history'] !== null) throw new RuntimeException('New patient has a history');
    $pdo->exec("UPDATE auth_sessions SET expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 DAY) WHERE user_id = 91001");
    capture(fn() => handleClinicalHistory($pdo, 'clinical.get', []));
    $daysRemaining = $pdo->query("SELECT DATEDIFF(expires_at, CURRENT_TIMESTAMP) FROM auth_sessions WHERE user_id = 91001")->fetchColumn();
    if ((int)$daysRemaining < AUTH_TOKEN_LIFETIME_DAYS - 1) throw new RuntimeException('Authentication token was not renewed');
    $legacyToken = bin2hex(random_bytes(13));
    session_id($legacyToken);
    session_start(['use_cookies' => 0, 'use_only_cookies' => 0, 'use_strict_mode' => 0, 'cache_limiter' => '']);
    $_SESSION = ['user_id' => 91001, 'expires_at' => time() + 3600];
    session_write_close();
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $legacyToken;
    if ((int)requireSessionUser($pdo)['id'] !== 91001) throw new RuntimeException('A valid legacy session was not migrated');
    if ((int)$pdo->query('SELECT COUNT(*) FROM auth_sessions WHERE user_id = 91001')->fetchColumn() !== 2) {
        throw new RuntimeException('Legacy session did not receive a persistent token');
    }
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
    $_SERVER['REQUEST_METHOD'] = 'POST';
    capture(fn() => handleClinicalHistory($pdo, 'clinical.save', ['userId' => 91002, 'history' => $history]), 403);
    $saved = capture(fn() => handleClinicalHistory($pdo, 'clinical.save', ['userId' => 91001, 'history' => $history]));
    if (!$saved['completed'] || $saved['history']['allergies'] !== $history['allergies']) throw new RuntimeException('History did not round-trip');
    foreach (['diagnosisMetabolismNone', 'diagnosisThyroidNone', 'diagnosisOtherNone', 'diagnosisDigestiveNone'] as $field) {
        if ($saved['history'][$field] !== $history[$field]) throw new RuntimeException('Diagnosis group answer did not round-trip: ' . $field);
    }
    foreach ([
        'diagnosisHyperthyroidism',
        'diagnosisDyslipidemia',
        'diagnosisInsulinResistance',
        'diagnosisChronicKidneyDisease',
        'diagnosisKidneyStones',
        'diagnosisCeliac',
        'diagnosisIrritableBowel',
        'diagnosisGastritis',
        'diagnosisUlcerativeColitis',
    ] as $field) {
        if (!$saved['history'][$field]) throw new RuntimeException('Diagnosis did not round-trip: ' . $field);
    }
    if ($saved['history']['otherDiagnoses'] !== $history['otherDiagnoses']) throw new RuntimeException('Other diagnoses did not round-trip');
    $pdo->exec("UPDATE clinical_histories SET diagnoses_none=1, diagnosis_metabolism_none=NULL, diagnosis_thyroid_none=NULL, diagnosis_other_none=NULL, diagnosis_digestive_none=NULL, diagnosis_diabetes=0, diagnosis_hypertension=0, diagnosis_fatty_liver=0, diagnosis_pcos=0, diagnosis_gout=0, diagnosis_hypothyroidism=0, diagnosis_hyperthyroidism=0, diagnosis_dyslipidemia=0, diagnosis_insulin_resistance=0, diagnosis_chronic_kidney_disease=0, diagnosis_kidney_stones=0, diagnosis_celiac=0, diagnosis_irritable_bowel=0, diagnosis_gastritis=0, diagnosis_ulcerative_colitis=0, other_diagnoses='' WHERE user_id=91001");
    $legacyHistory = readClinicalHistory($pdo, 91001)['history'];
    foreach (['diagnosisMetabolismNone', 'diagnosisThyroidNone', 'diagnosisOtherNone', 'diagnosisDigestiveNone'] as $field) {
        if (!$legacyHistory[$field]) throw new RuntimeException('Legacy diagnosis group was not migrated for display: ' . $field);
    }
    capture(fn() => handleClinicalHistory($pdo, 'clinical.save', ['history' => $history]));
    $invalid = $history; $invalid['allergiesNone'] = true;
    capture(fn() => handleClinicalHistory($pdo, 'clinical.save', ['history' => $invalid]), 422);
    $history['sleepQuality'] = 'No reparador';
    capture(fn() => handleClinicalHistory($pdo, 'clinical.save', ['history' => $history]));
    if ((int)$pdo->query('SELECT COUNT(*) FROM clinical_histories')->fetchColumn() !== 1) throw new RuntimeException('Edit created duplicates');
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $loaded = capture(fn() => handleClinicalHistory($pdo, 'clinical.get', []));
    if ($loaded['history']['sleepQuality'] !== 'No reparador') throw new RuntimeException('Edited history was not loaded');
    $pdo->exec("UPDATE users SET gender='male' WHERE id=91001");
    $masked = readClinicalHistory($pdo, 91001)['history'];
    if ($masked['pregnant'] !== '' || $masked['lactating'] !== '' || $masked['menstrualCycle'] !== '' || $masked['diagnosisSop'] !== false) throw new RuntimeException('Read exposed sex-specific fields');
    $pdo->exec("UPDATE users SET gender='female' WHERE id=91001");
    $otherToken = issueAuthToken($pdo, 91002);
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $otherToken;
    $empty = capture(fn() => handleClinicalHistory($pdo, 'clinical.get', []));
    if ($empty['history'] !== null) throw new RuntimeException('Patient histories leaked');
    $_SERVER['REQUEST_METHOD'] = 'POST';
    capture(fn() => handleClinicalHistory($pdo, 'clinical.delete', ['userId' => 91001]), 403);
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
    capture(fn() => handleClinicalHistory($pdo, 'clinical.delete', []));
    if (readClinicalHistory($pdo, 91001)['history'] !== null) throw new RuntimeException('History was not deleted');
    capture(fn() => logoutSession($pdo));
    $revoked = $pdo->prepare('SELECT COUNT(*) FROM auth_sessions WHERE token_hash = ?');
    $revoked->execute([hash('sha256', $token)]);
    if ((int)$revoked->fetchColumn() !== 0) throw new RuntimeException('Logout did not revoke the token');
    capture(fn() => handleClinicalHistory($pdo, 'clinical.get', []), 401);
} finally {
    $pdo->exec('USE eatwell_db');
    $pdo->exec("DROP DATABASE `$test`");
}
echo "Clinical history tests passed: validation, save, edit, read, isolation, deletion and session revocation.\n";
