<?php
declare(strict_types=1);

function clinicalHistoryFields(): array
{
    return [
        'familyNone' => ['family_history_none', 'bool'],
        'familyDiabetes' => ['family_diabetes', 'bool'],
        'familyHypertension' => ['family_hypertension', 'bool'],
        'familyObesity' => ['family_obesity', 'bool'],
        'familyCholesterol' => ['family_high_cholesterol', 'bool'],
        'familyCancer' => ['family_cancer', 'bool'],
        'familyRenal' => ['family_kidney_disease', 'bool'],
        'familyThyroid' => ['family_thyroid_disease', 'bool'],
        'diagnosisNone' => ['diagnoses_none', 'bool'],
        'diagnosisDiabetes' => ['diagnosis_diabetes', 'bool'],
        'diagnosisHypertension' => ['diagnosis_hypertension', 'bool'],
        'diagnosisFattyLiver' => ['diagnosis_fatty_liver', 'bool'],
        'diagnosisSop' => ['diagnosis_pcos', 'bool'],
        'diagnosisGout' => ['diagnosis_gout', 'bool'],
        'diagnosisHypothyroidism' => ['diagnosis_hypothyroidism', 'bool'],
        'wellbeingNone' => ['wellbeing_none', 'bool'],
        'wellbeingAnemia' => ['wellbeing_anemia', 'bool'],
        'wellbeingBulimia' => ['wellbeing_bulimia', 'bool'],
        'wellbeingDepression' => ['wellbeing_depression', 'bool'],
        'wellbeingAnxiety' => ['wellbeing_anxiety', 'bool'],
        'wellbeingOther' => ['wellbeing_other', 'text'],
        'wellbeingTreatment' => ['wellbeing_treatment', ['No aplica' => 'not_applicable', 'No' => 'no', 'Sí, actualmente' => 'current', 'Anteriormente' => 'previous']],
        'wellbeingSupport' => ['professional_support', ['No aplica' => 'not_applicable', 'No' => 'no', 'Sí, actualmente' => 'current', 'Anteriormente' => 'previous']],
        'wellbeingNotes' => ['wellbeing_notes', 'text'],
        'surgeriesNone' => ['surgeries_none', 'bool'],
        'surgeries' => ['surgeries', 'text'],
        'hospitalizationsNone' => ['hospitalizations_none', 'bool'],
        'hospitalizations' => ['hospitalizations', 'text'],
        'pregnant' => ['pregnant', ['No' => 0, 'Sí' => 1]],
        'lactating' => ['lactating', ['No' => 0, 'Sí' => 1]],
        'menstrualCycle' => ['menstrual_cycle', ['Regular' => 'regular', 'Irregular' => 'irregular', 'No aplica' => 'not_applicable']],
        'allergiesNone' => ['food_allergies_none', 'bool'],
        'allergies' => ['food_allergies_json', 'list'],
        'otherAllergies' => ['other_food_allergies', 'text'],
        'medicationsNone' => ['medications_none', 'bool'],
        'medications' => ['medications', 'text'],
        'medicationAllergiesNone' => ['medication_allergies_none', 'bool'],
        'medicationAllergies' => ['medication_allergies', 'text'],
        'supplementsNone' => ['supplements_none', 'bool'],
        'supplements' => ['supplements', 'text'],
        'weightLossTreatment' => ['weight_loss_treatment', ['No' => 0, 'Sí' => 1]],
        'sleepHours' => ['sleep_hours', ['Menos de 6 hrs' => 'under_6', '7-8 hrs' => '7_to_8', 'Más de 8 hrs' => 'over_8']],
        'sleepQuality' => ['sleep_quality', ['Reparador' => 'restful', 'No reparador' => 'not_restful']],
        'bowelFrequency' => ['bowel_frequency', ['Menos de 1 vez al día' => 'less_than_once_daily', '1 a 2 veces al día' => 'once_or_twice_daily']],
        'alcohol' => ['alcohol_use', ['No consumo' => 'none', 'Ocasional' => 'occasional', 'Frecuente' => 'frequent']],
        'tobacco' => ['tobacco_use', ['No fumo' => 0, 'Fumo' => 1]],
        'cigarettesPerDay' => ['cigarettes_per_day', 'integer'],
        'otherSubstances' => ['other_substance_use', ['No' => 0, 'Sí' => 1]],
        'cooksAtHome' => ['cooking_responsibility', ['Yo mismo(a)' => 'patient', 'Otra persona' => 'other_person']],
        'weekdayPlace' => ['usual_eating_place', ['En casa' => 'home', 'En el trabajo' => 'work']],
        'appetite' => ['appetite', ['Normal' => 'normal', 'Bajo' => 'low', 'Alto' => 'high']],
        'anxiety' => ['eating_anxiety', ['No' => 0, 'Sí' => 1]],
        'waterLiters' => ['daily_water_liters', 'number'],
    ];
}

function validateClinicalHistory(array $input, array $user): array
{
    if ($user['gender'] !== 'female') $input['diagnosisSop'] = false;
    if (($input['tobacco'] ?? '') === 'No fumo') {
        if (isset($input['cigarettesPerDay']) && $input['cigarettesPerDay'] !== 0 && $input['cigarettesPerDay'] !== 0.0) {
            throw new InvalidArgumentException('No puedes indicar cigarrillos si seleccionaste No fumo.');
        }
        $input['cigarettesPerDay'] = 0;
    }
    $values = [];
    foreach (clinicalHistoryFields() as $field => [$column, $type]) {
        $value = $input[$field] ?? null;
        if ($field === 'diagnosisSop' && $user['gender'] !== 'female') {
            $values[$column] = null;
            continue;
        }
        if (in_array($field, ['pregnant', 'lactating', 'menstrualCycle'], true) && $user['gender'] !== 'female') {
            $values[$column] = null;
            continue;
        }
        if ($type === 'bool') {
            if (!is_bool($value)) throw new InvalidArgumentException('Revisa las respuestas del historial.');
            $value = (int)$value;
        } elseif (is_array($type)) {
            if (!is_string($value) || !array_key_exists($value, $type)) throw new InvalidArgumentException('Selecciona una respuesta en todos los campos del historial.');
            $value = $type[$value];
        } elseif ($type === 'text') {
            if (!is_string($value) || strlen($value) > 10000) throw new InvalidArgumentException('Revisa los textos del historial.');
            $value = trim($value);
        } elseif ($type === 'list') {
            if (!is_array($value) || !array_is_list($value) || count($value) > 50) throw new InvalidArgumentException('Revisa la lista de alergias.');
            foreach ($value as $allergy) {
                if (!is_string($allergy) || trim($allergy) === '' || strlen($allergy) > 200) throw new InvalidArgumentException('Revisa la lista de alergias.');
            }
            $value = json_encode(array_values(array_unique(array_map('trim', $value))), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        } else {
            if ((!is_int($value) && !is_float($value)) || !is_finite((float)$value) || $value < 0
                || ($type === 'integer' && ($value != (int)$value || $value > 65535))
                || ($type === 'number' && $value > 999.99)) throw new InvalidArgumentException('Revisa las cantidades de agua y cigarrillos.');
        }
        $values[$column] = $value;
    }
    $groups = [
        'familyNone' => ['familyDiabetes','familyHypertension','familyObesity','familyCholesterol','familyCancer','familyRenal','familyThyroid'],
        'diagnosisNone' => ['diagnosisDiabetes','diagnosisHypertension','diagnosisFattyLiver','diagnosisSop','diagnosisGout','diagnosisHypothyroidism'],
        'wellbeingNone' => ['wellbeingAnemia','wellbeingBulimia','wellbeingDepression','wellbeingAnxiety','wellbeingOther'],
        'allergiesNone' => ['allergies','otherAllergies'],
        'surgeriesNone' => ['surgeries'], 'hospitalizationsNone' => ['hospitalizations'],
        'medicationsNone' => ['medications'], 'medicationAllergiesNone' => ['medicationAllergies'], 'supplementsNone' => ['supplements'],
    ];
    foreach ($groups as $none => $fields) {
        $answered = false;
        foreach ($fields as $field) {
            $value = $input[$field];
            $answered = $answered || (is_string($value) ? trim($value) !== '' : (bool)$value);
        }
        if ((bool)$input[$none] === $answered) throw new InvalidArgumentException('Selecciona una respuesta o No aplica, pero no ambos, en cada grupo del historial.');
    }
    if ($values['tobacco_use'] === 1 && $values['cigarettes_per_day'] < 1) {
        throw new InvalidArgumentException('Indica una cantidad entera y positiva de cigarrillos al dia.');
    }
    if (!in_array((float)$values['daily_water_liters'], [1.0, 2.0, 3.0], true)) {
        throw new InvalidArgumentException('Selecciona una cantidad de agua de las opciones disponibles.');
    }
    return $values;
}

function readClinicalHistory(PDO $pdo, int $userId): array
{
    $user = getUserById($pdo, $userId);
    $statement = $pdo->prepare('SELECT * FROM clinical_histories WHERE user_id = ?');
    $statement->execute([$userId]);
    $record = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$record) return ['history' => null, 'completed' => false];
    $history = [];
    foreach (clinicalHistoryFields() as $field => [$column, $type]) {
        $value = $record[$column];
        if ($user['gender'] !== 'female' && in_array($field, ['pregnant', 'lactating', 'menstrualCycle'], true)) $value = null;
        if ($user['gender'] !== 'female' && $field === 'diagnosisSop') $value = 0;
        if ($type === 'bool') $value = (bool)$value;
        elseif (is_array($type)) {
            $key = $value === null ? false : array_search($value, $type, false);
            $value = $key === false ? '' : $key;
        } elseif ($type === 'list') {
            $value = $value === null ? [] : json_decode($value, true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($value) || !array_is_list($value)) throw new RuntimeException('La lista de alergias guardada no tiene un formato valido.');
            foreach ($value as $allergy) {
                if (!is_string($allergy)) throw new RuntimeException('La lista de alergias guardada no tiene un formato valido.');
            }
        }
        elseif ($type === 'integer' || $type === 'number') $value = $value === null ? null : (float)$value;
        else $value = $value ?? '';
        $history[$field] = $value;
    }
    return ['history' => $history, 'completed' => $record['completed_at'] !== null];
}

function handleClinicalHistory(PDO $pdo, string $action, array $input): void
{
    $user = requireSessionUser($pdo);
    $userId = (int)$user['id'];
    $requestedId = $input['userId'] ?? $_GET['userId'] ?? $userId;
    if ((string)$requestedId !== (string)$userId) sendError('No puedes acceder al historial de otra cuenta.', 403);
    if ($action === 'clinical.get') {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') sendError('Metodo no permitido.', 405);
        sendJson(readClinicalHistory($pdo, $userId));
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendError('Metodo no permitido.', 405);
    if ($action === 'clinical.delete') {
        $pdo->prepare('DELETE FROM clinical_histories WHERE user_id = ?')->execute([$userId]);
        sendJson(['history' => null, 'completed' => false]);
    }
    if (!isset($input['history']) || !is_array($input['history'])) sendError('El historial no tiene un formato valido.', 422);
    try {
        $values = validateClinicalHistory($input['history'], $user);
    } catch (InvalidArgumentException $error) {
        sendError($error->getMessage(), 422);
    }
    $columns = array_keys($values);
    $updates = array_map(fn($column) => "`$column` = VALUES(`$column`)", $columns);
    $statement = $pdo->prepare('INSERT INTO clinical_histories (user_id, `' . implode('`, `', $columns)
        . '`, completed_at) VALUES (?, ' . implode(', ', array_fill(0, count($values), '?')) . ', NOW())'
        . ' ON DUPLICATE KEY UPDATE ' . implode(', ', $updates) . ', completed_at = NOW()');
    $statement->execute([$userId, ...array_values($values)]);
    sendJson(readClinicalHistory($pdo, $userId));
}
