CREATE DATABASE IF NOT EXISTS eatwell_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eatwell_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  profile_image LONGTEXT NULL,
  age INT NOT NULL DEFAULT 18,
  gender ENUM('female', 'male', 'other') NOT NULL DEFAULT 'other',
  height_cm DECIMAL(5,2) NOT NULL DEFAULT 170,
  weight_kg DECIMAL(5,2) NOT NULL DEFAULT 70,
  bmi DECIMAL(5,2) NOT NULL DEFAULT 24.22,
  activity_level ENUM('low', 'moderate', 'high') NOT NULL DEFAULT 'moderate',
  goal ENUM('lose_weight', 'maintain', 'gain_muscle', 'improve_health') NOT NULL DEFAULT 'improve_health',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image LONGTEXT NULL AFTER password_hash;

CREATE TABLE IF NOT EXISTS recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  calories INT NOT NULL,
  protein_grams DECIMAL(6,2) NOT NULL,
  carbs_grams DECIMAL(6,2) NOT NULL,
  fat_grams DECIMAL(6,2) NOT NULL,
  ingredients TEXT NOT NULL,
  instructions TEXT NOT NULL,
  goal ENUM('lose_weight', 'maintain', 'gain_muscle', 'improve_health') NOT NULL,
  min_bmi DECIMAL(5,2) NULL,
  max_bmi DECIMAL(5,2) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exercises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  body_zone VARCHAR(50) NOT NULL,
  difficulty ENUM('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'beginner',
  duration_minutes INT NOT NULL,
  repetitions VARCHAR(120) NOT NULL,
  instructions TEXT NOT NULL,
  recommendations TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS food_scans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  image_url LONGTEXT NULL,
  detected_food VARCHAR(150) NULL,
  detected_ingredients LONGTEXT NULL,
  estimated_calories INT NULL,
  ai_recommendation TEXT NULL,
  ai_provider VARCHAR(40) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_food_scans_id_user (id, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE food_scans ADD COLUMN IF NOT EXISTS detected_ingredients LONGTEXT NULL AFTER detected_food;
ALTER TABLE food_scans ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(40) NULL AFTER ai_recommendation;

CREATE TABLE IF NOT EXISTS ai_generated_recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  scan_id INT NOT NULL,
  user_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  description VARCHAR(255) NOT NULL,
  ingredients LONGTEXT NOT NULL,
  instructions LONGTEXT NOT NULL,
  ai_provider VARCHAR(40) NOT NULL DEFAULT 'gemini',
  ai_model VARCHAR(80) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_generated_recipes_scan (scan_id, id),
  INDEX idx_ai_generated_recipes_user (user_id, created_at),
  CONSTRAINT fk_generated_recipes_scan_owner FOREIGN KEY (scan_id, user_id) REFERENCES food_scans(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS food_preferences (
  user_id INT PRIMARY KEY,
  diet_type VARCHAR(30) NOT NULL DEFAULT 'omnivore',
  preferred_fruits LONGTEXT NOT NULL,
  preferred_vegetables LONGTEXT NOT NULL,
  preferred_proteins LONGTEXT NULL,
  preferred_carbohydrates LONGTEXT NULL,
  preferred_legumes LONGTEXT NULL,
  preferred_dairy LONGTEXT NULL,
  preferred_fats LONGTEXT NULL,
  allergies LONGTEXT NOT NULL,
  disliked_foods LONGTEXT NOT NULL,
  cooking_time_minutes INT NOT NULL DEFAULT 30,
  completed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE food_preferences ADD COLUMN IF NOT EXISTS preferred_proteins LONGTEXT NULL;
ALTER TABLE food_preferences ADD COLUMN IF NOT EXISTS preferred_carbohydrates LONGTEXT NULL;
ALTER TABLE food_preferences ADD COLUMN IF NOT EXISTS preferred_legumes LONGTEXT NULL;
ALTER TABLE food_preferences ADD COLUMN IF NOT EXISTS preferred_dairy LONGTEXT NULL;
ALTER TABLE food_preferences ADD COLUMN IF NOT EXISTS preferred_fats LONGTEXT NULL;

CREATE TABLE IF NOT EXISTS favorite_recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  description VARCHAR(255) NOT NULL,
  image_url TEXT NULL,
  ingredients LONGTEXT NOT NULL,
  instructions LONGTEXT NOT NULL,
  source_type VARCHAR(30) NOT NULL DEFAULT 'generated',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_favorite_title (user_id, title),
  INDEX idx_favorite_recipes_user (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS personalized_recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  preference_hash CHAR(64) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description VARCHAR(255) NOT NULL,
  ingredients LONGTEXT NOT NULL,
  instructions LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_personalized_recipes_user_hash (user_id, preference_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Modulos del paciente: nombres de tablas y columnas en ingles.
CREATE TABLE IF NOT EXISTS patient_profiles (
    user_id INT NOT NULL,
    birth_date DATE NULL,
    phone VARCHAR(30) NULL,
    municipality VARCHAR(120) NULL,
    completed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_patient_profiles_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anthropometric_measurements (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    measured_at DATETIME NOT NULL,
    weight_kg DECIMAL(6,2) NOT NULL,
    height_cm DECIMAL(6,2) NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_measurements_user_date (user_id, measured_at, id),
    CONSTRAINT fk_measurements_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_measurements_weight CHECK (weight_kg > 0),
    CONSTRAINT chk_measurements_height CHECK (height_cm > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clinical_histories (
    user_id INT NOT NULL,
    family_history_none BOOLEAN NULL,
    family_diabetes BOOLEAN NULL,
    family_hypertension BOOLEAN NULL,
    family_obesity BOOLEAN NULL,
    family_high_cholesterol BOOLEAN NULL,
    family_cancer BOOLEAN NULL,
    family_kidney_disease BOOLEAN NULL,
    family_thyroid_disease BOOLEAN NULL,
    diagnoses_none BOOLEAN NULL,
    diagnosis_diabetes BOOLEAN NULL,
    diagnosis_hypertension BOOLEAN NULL,
    diagnosis_fatty_liver BOOLEAN NULL,
    diagnosis_pcos BOOLEAN NULL,
    diagnosis_gout BOOLEAN NULL,
    diagnosis_hypothyroidism BOOLEAN NULL,
    wellbeing_none BOOLEAN NULL,
    wellbeing_anemia BOOLEAN NULL,
    wellbeing_bulimia BOOLEAN NULL,
    wellbeing_depression BOOLEAN NULL,
    wellbeing_anxiety BOOLEAN NULL,
    wellbeing_other TEXT NULL,
    wellbeing_treatment ENUM('not_applicable', 'no', 'current', 'previous') NULL,
    professional_support ENUM('not_applicable', 'no', 'current', 'previous') NULL,
    wellbeing_notes TEXT NULL,
    surgeries_none BOOLEAN NULL,
    surgeries TEXT NULL,
    hospitalizations_none BOOLEAN NULL,
    hospitalizations TEXT NULL,
    pregnant BOOLEAN NULL,
    lactating BOOLEAN NULL,
    menstrual_cycle ENUM('regular', 'irregular', 'not_applicable') NULL,
    food_allergies_none BOOLEAN NULL,
    food_allergies_json LONGTEXT NULL,
    other_food_allergies TEXT NULL,
    medications_none BOOLEAN NULL,
    medications TEXT NULL,
    medication_allergies_none BOOLEAN NULL,
    medication_allergies TEXT NULL,
    supplements_none BOOLEAN NULL,
    supplements TEXT NULL,
    weight_loss_treatment BOOLEAN NULL,
    sleep_hours ENUM('under_6', '7_to_8', 'over_8') NULL,
    sleep_quality ENUM('restful', 'not_restful') NULL,
    bowel_frequency ENUM('less_than_once_daily', 'once_or_twice_daily') NULL,
    alcohol_use ENUM('none', 'occasional', 'frequent') NULL,
    tobacco_use BOOLEAN NULL,
    cigarettes_per_day SMALLINT UNSIGNED NULL,
    other_substance_use BOOLEAN NULL,
    cooking_responsibility ENUM('patient', 'other_person') NULL,
    usual_eating_place ENUM('home', 'work') NULL,
    appetite ENUM('normal', 'low', 'high') NULL,
    eating_anxiety BOOLEAN NULL,
    daily_water_liters DECIMAL(5,2) NULL,
    completed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_clinical_histories_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_clinical_food_allergies_json
        CHECK (food_allergies_json IS NULL OR JSON_VALID(food_allergies_json)),
    CONSTRAINT chk_clinical_water CHECK (daily_water_liters IS NULL OR daily_water_liters >= 0),
    CONSTRAINT chk_clinical_boolean_answers CHECK ((family_history_none IS NULL OR family_history_none IN (0, 1)) AND (family_diabetes IS NULL OR family_diabetes IN (0, 1)) AND (family_hypertension IS NULL OR family_hypertension IN (0, 1)) AND (family_obesity IS NULL OR family_obesity IN (0, 1)) AND (family_high_cholesterol IS NULL OR family_high_cholesterol IN (0, 1)) AND (family_cancer IS NULL OR family_cancer IN (0, 1)) AND (family_kidney_disease IS NULL OR family_kidney_disease IN (0, 1)) AND (family_thyroid_disease IS NULL OR family_thyroid_disease IN (0, 1)) AND (diagnoses_none IS NULL OR diagnoses_none IN (0, 1)) AND (diagnosis_diabetes IS NULL OR diagnosis_diabetes IN (0, 1)) AND (diagnosis_hypertension IS NULL OR diagnosis_hypertension IN (0, 1)) AND (diagnosis_fatty_liver IS NULL OR diagnosis_fatty_liver IN (0, 1)) AND (diagnosis_pcos IS NULL OR diagnosis_pcos IN (0, 1)) AND (diagnosis_gout IS NULL OR diagnosis_gout IN (0, 1)) AND (diagnosis_hypothyroidism IS NULL OR diagnosis_hypothyroidism IN (0, 1)) AND (wellbeing_none IS NULL OR wellbeing_none IN (0, 1)) AND (wellbeing_anemia IS NULL OR wellbeing_anemia IN (0, 1)) AND (wellbeing_bulimia IS NULL OR wellbeing_bulimia IN (0, 1)) AND (wellbeing_depression IS NULL OR wellbeing_depression IN (0, 1)) AND (wellbeing_anxiety IS NULL OR wellbeing_anxiety IN (0, 1)) AND (surgeries_none IS NULL OR surgeries_none IN (0, 1)) AND (hospitalizations_none IS NULL OR hospitalizations_none IN (0, 1)) AND (pregnant IS NULL OR pregnant IN (0, 1)) AND (lactating IS NULL OR lactating IN (0, 1)) AND (food_allergies_none IS NULL OR food_allergies_none IN (0, 1)) AND (medications_none IS NULL OR medications_none IN (0, 1)) AND (medication_allergies_none IS NULL OR medication_allergies_none IN (0, 1)) AND (supplements_none IS NULL OR supplements_none IN (0, 1)) AND (weight_loss_treatment IS NULL OR weight_loss_treatment IN (0, 1)) AND (tobacco_use IS NULL OR tobacco_use IN (0, 1)) AND (other_substance_use IS NULL OR other_substance_use IN (0, 1)) AND (eating_anxiety IS NULL OR eating_anxiety IN (0, 1)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lifestyle_goals (
    user_id INT NOT NULL,
    goal ENUM('lose_weight', 'maintain', 'gain_muscle', 'improve_health') NULL,
    target_weight_kg DECIMAL(6,2) NULL,
    activity_level ENUM('sedentary', 'light', 'moderate', 'intense') NULL,
    exercise_types_json LONGTEXT NULL,
    session_duration_minutes SMALLINT UNSIGNED NULL,
    training_time ENUM('morning', 'afternoon', 'evening', 'variable') NULL,
    cooking_availability ENUM('short', 'medium', 'flexible') NULL,
    stress_level ENUM('low', 'moderate', 'high') NULL,
    completed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_lifestyle_goals_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_lifestyle_target_weight CHECK (target_weight_kg IS NULL OR target_weight_kg > 0),
    CONSTRAINT chk_lifestyle_session_duration CHECK (session_duration_minutes IS NULL OR session_duration_minutes > 0),
    CONSTRAINT chk_lifestyle_exercise_json
        CHECK (exercise_types_json IS NULL OR JSON_VALID(exercise_types_json))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dietary_recalls (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    recall_date DATE NOT NULL,
    wake_time TIME NULL,
    wake_activity TEXT NULL,
    exercise_time TIME NULL,
    exercise_type VARCHAR(150) NULL,
    exercise_duration VARCHAR(120) NULL,
    sleep_time TIME NULL,
    notes TEXT NULL,
    completed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_dietary_recalls_user_date (user_id, recall_date),
    CONSTRAINT fk_dietary_recalls_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dietary_recall_meals (
    id INT NOT NULL AUTO_INCREMENT,
    recall_id INT NOT NULL,
    position SMALLINT UNSIGNED NOT NULL,
    meal_type ENUM('breakfast', 'snack', 'lunch', 'dinner', 'other') NOT NULL,
    meal_time TIME NULL,
    location VARCHAR(150) NULL,
    food_drink_quantities TEXT NULL,
    skipped BOOLEAN NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_recall_meals_position (recall_id, position),
    CONSTRAINT fk_recall_meals_recall FOREIGN KEY (recall_id)
        REFERENCES dietary_recalls(id) ON DELETE CASCADE,
    CONSTRAINT chk_recall_meals_position CHECK (position > 0),
    CONSTRAINT chk_recall_meals_skipped CHECK ((skipped IS NULL OR skipped IN (0, 1)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_tips (
  user_id INT PRIMARY KEY,
  preference_hash CHAR(64) NOT NULL,
  tips_json TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meal_schedules (
  user_id INT PRIMARY KEY,
  source_recall_id INT NOT NULL,
  breakfast_time TIME NOT NULL,
  morning_snack_time TIME NOT NULL,
  lunch_time TIME NOT NULL,
  afternoon_snack_time TIME NOT NULL,
  dinner_time TIME NOT NULL,
  is_customized BOOLEAN NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_meal_schedules_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_meal_schedules_recall FOREIGN KEY (source_recall_id) REFERENCES dietary_recalls(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS daily_meal_choices (
  user_id INT NOT NULL,
  plan_date DATE NOT NULL,
  meal_type ENUM('breakfast','morning_snack','lunch','afternoon_snack','dinner') NOT NULL,
  recipe_id INT NOT NULL,
  preference_hash CHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id,plan_date,meal_type),
  CONSTRAINT fk_daily_meal_choices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_daily_meal_choices_recipe FOREIGN KEY (recipe_id) REFERENCES personalized_recipes(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS foods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_code VARCHAR(40) NOT NULL,
  name VARCHAR(255) NOT NULL,
  source_name VARCHAR(200) NOT NULL,
  source_version VARCHAR(40) NOT NULL,
  source_file VARCHAR(255) NOT NULL,
  source_sha256 CHAR(64) NOT NULL,
  source_sheet VARCHAR(100) NOT NULL,
  source_row INT NOT NULL,
  source_citation TEXT NOT NULL,
  source_notes TEXT NULL,
  reference_amount DECIMAL(10,3) NULL,
  reference_unit VARCHAR(30) NULL,
  energy_kcal DOUBLE NULL,
  carbohydrates_g DOUBLE NULL,
  total_fat_g DOUBLE NULL,
  protein_g DOUBLE NULL,
  dietary_fiber_g DOUBLE NULL,
  calcium_mg DOUBLE NULL,
  iron_mg DOUBLE NULL,
  heme_iron_mg DOUBLE NULL,
  non_heme_iron_mg DOUBLE NULL,
  zinc_mg DOUBLE NULL,
  vitamin_c_mg DOUBLE NULL,
  thiamin_mg DOUBLE NULL,
  riboflavin_mg DOUBLE NULL,
  niacin_mg DOUBLE NULL,
  pantothenic_acid_mg DOUBLE NULL,
  vitamin_b6_mg DOUBLE NULL,
  folic_acid_ug DOUBLE NULL,
  food_folate_ug DOUBLE NULL,
  dietary_folate_equivalents_ug DOUBLE NULL,
  vitamin_b12_ug DOUBLE NULL,
  vitamin_a_rae_ug DOUBLE NULL,
  vitamin_e_mg DOUBLE NULL,
  vitamin_d_iu DOUBLE NULL,
  vitamin_k_ug DOUBLE NULL,
  saturated_fat_g DOUBLE NULL,
  monounsaturated_fat_g DOUBLE NULL,
  polyunsaturated_fat_g DOUBLE NULL,
  cholesterol_mg DOUBLE NULL,
  raw_values_json LONGTEXT NOT NULL,
  nutrient_definitions_json LONGTEXT NOT NULL,
  UNIQUE KEY uq_foods_source_code (source_sha256, source_code),
  KEY idx_foods_name (name),
  CONSTRAINT chk_foods_source_row CHECK (source_row > 0),
  CONSTRAINT chk_foods_reference_amount CHECK (reference_amount IS NULL OR reference_amount > 0),
  CONSTRAINT chk_foods_raw_values CHECK (JSON_VALID(raw_values_json)),
  CONSTRAINT chk_foods_definitions CHECK (JSON_VALID(nutrient_definitions_json)),
  CONSTRAINT chk_foods_nonnegative_values CHECK ((energy_kcal IS NULL OR energy_kcal >= 0) AND (carbohydrates_g IS NULL OR carbohydrates_g >= 0) AND (total_fat_g IS NULL OR total_fat_g >= 0) AND (protein_g IS NULL OR protein_g >= 0) AND (dietary_fiber_g IS NULL OR dietary_fiber_g >= 0) AND (calcium_mg IS NULL OR calcium_mg >= 0) AND (iron_mg IS NULL OR iron_mg >= 0) AND (heme_iron_mg IS NULL OR heme_iron_mg >= 0) AND (non_heme_iron_mg IS NULL OR non_heme_iron_mg >= 0) AND (zinc_mg IS NULL OR zinc_mg >= 0) AND (vitamin_c_mg IS NULL OR vitamin_c_mg >= 0) AND (thiamin_mg IS NULL OR thiamin_mg >= 0) AND (riboflavin_mg IS NULL OR riboflavin_mg >= 0) AND (niacin_mg IS NULL OR niacin_mg >= 0) AND (pantothenic_acid_mg IS NULL OR pantothenic_acid_mg >= 0) AND (vitamin_b6_mg IS NULL OR vitamin_b6_mg >= 0) AND (folic_acid_ug IS NULL OR folic_acid_ug >= 0) AND (food_folate_ug IS NULL OR food_folate_ug >= 0) AND (dietary_folate_equivalents_ug IS NULL OR dietary_folate_equivalents_ug >= 0) AND (vitamin_b12_ug IS NULL OR vitamin_b12_ug >= 0) AND (vitamin_a_rae_ug IS NULL OR vitamin_a_rae_ug >= 0) AND (vitamin_e_mg IS NULL OR vitamin_e_mg >= 0) AND (vitamin_d_iu IS NULL OR vitamin_d_iu >= 0) AND (vitamin_k_ug IS NULL OR vitamin_k_ug >= 0) AND (saturated_fat_g IS NULL OR saturated_fat_g >= 0) AND (monounsaturated_fat_g IS NULL OR monounsaturated_fat_g >= 0) AND (polyunsaturated_fat_g IS NULL OR polyunsaturated_fat_g >= 0) AND (cholesterol_mg IS NULL OR cholesterol_mg >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO recipes (title, description, calories, protein_grams, carbs_grams, fat_grams, ingredients, instructions, goal, min_bmi, max_bmi)
SELECT 'Bowl balanceado de pollo', 'Comida alta en proteina para mantener energia durante el dia.', 520, 38, 48, 16, 'Pechuga de pollo|Arroz integral|Brocoli|Zanahoria|Aguacate', 'Cocina el arroz integral.|Asa el pollo.|Sirve con verduras y aguacate.', 'improve_health', 18.5, NULL
WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE title = 'Bowl balanceado de pollo');

INSERT INTO recipes (title, description, calories, protein_grams, carbs_grams, fat_grams, ingredients, instructions, goal, min_bmi, max_bmi)
SELECT 'Tostadas ligeras de atun', 'Cena rapida con buena proteina y bajo contenido calorico.', 360, 28, 34, 10, 'Atun|Tostadas horneadas|Jitomate|Lechuga|Aguacate', 'Mezcla el atun con verduras.|Sirve sobre tostadas.|Agrega aguacate al final.', 'lose_weight', NULL, 30
WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE title = 'Tostadas ligeras de atun');

INSERT INTO recipes (title, description, calories, protein_grams, carbs_grams, fat_grams, ingredients, instructions, goal, min_bmi, max_bmi)
SELECT 'Avena con fruta y nueces', 'Desayuno practico para iniciar el dia con fibra.', 410, 15, 56, 14, 'Avena|Leche|Platano|Nueces|Canela', 'Cocina la avena con leche.|Agrega platano y nueces.|Termina con canela.', 'maintain', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE title = 'Avena con fruta y nueces');

INSERT INTO recipes (title, description, calories, protein_grams, carbs_grams, fat_grams, ingredients, instructions, goal, min_bmi, max_bmi)
SELECT 'Licuado de proteina natural', 'Opcion para aumentar calorias y proteina de forma sencilla.', 620, 34, 72, 22, 'Leche|Avena|Crema de cacahuate|Platano|Yogurt griego', 'Licua todos los ingredientes.|Sirve frio.|Toma despues de entrenar.', 'gain_muscle', NULL, 24.9
WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE title = 'Licuado de proteina natural');

INSERT INTO exercises (title, body_zone, difficulty, duration_minutes, repetitions, instructions, recommendations)
SELECT 'Movilidad cervical', 'neck', 'beginner', 6, '2 rondas de 8 movimientos por lado', 'Sientate con espalda recta.|Inclina la cabeza suavemente hacia cada lado.|Haz giros lentos sin forzar.', 'Debe sentirse como estiramiento suave, no como dolor.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE title = 'Movilidad cervical');

INSERT INTO exercises (title, body_zone, difficulty, duration_minutes, repetitions, instructions, recommendations)
SELECT 'Press de hombros con mancuernas', 'shoulders', 'beginner', 12, '3 series de 12 repeticiones', 'Sientate con espalda recta.|Empuja las mancuernas hacia arriba.|Baja lento y controlado.', 'Usa poco peso al inicio y evita arquear la espalda.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE title = 'Press de hombros con mancuernas');

INSERT INTO exercises (title, body_zone, difficulty, duration_minutes, repetitions, instructions, recommendations)
SELECT 'Flexiones', 'chest', 'beginner', 10, '3 series de 8 a 12 repeticiones', 'Coloca manos al ancho de hombros.|Baja el pecho con control.|Empuja hasta extender brazos.', 'Apoya rodillas si necesitas una variante mas facil.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE title = 'Flexiones');

INSERT INTO exercises (title, body_zone, difficulty, duration_minutes, repetitions, instructions, recommendations)
SELECT 'Curl de biceps', 'arms', 'beginner', 10, '3 series de 12 repeticiones', 'Sujeta mancuernas o botellas.|Flexiona codos sin mover hombros.|Baja lento hasta extender brazos.', 'Evita balancear el cuerpo para levantar mas peso.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE title = 'Curl de biceps');

INSERT INTO exercises (title, body_zone, difficulty, duration_minutes, repetitions, instructions, recommendations)
SELECT 'Plancha abdominal', 'abdomen', 'beginner', 8, '4 rondas de 30 segundos', 'Apoya antebrazos.|Mantiene el cuerpo alineado.|Respira sin subir la cadera.', 'Deten el ejercicio si aparece dolor lumbar.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE title = 'Plancha abdominal');

INSERT INTO exercises (title, body_zone, difficulty, duration_minutes, repetitions, instructions, recommendations)
SELECT 'Sentadillas', 'legs', 'beginner', 14, '4 series de 12 repeticiones', 'Abre pies al ancho de cadera.|Baja como si fueras a sentarte.|Sube empujando el piso.', 'Mantiene rodillas alineadas con los pies.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE title = 'Sentadillas');

INSERT INTO exercises (title, body_zone, difficulty, duration_minutes, repetitions, instructions, recommendations)
SELECT 'Remo con banda elastica', 'back', 'beginner', 12, '3 series de 15 repeticiones', 'Sujeta la banda al frente.|Jala codos hacia atras.|Aprieta espalda y regresa lento.', 'No subas los hombros durante el jalon.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE title = 'Remo con banda elastica');

INSERT INTO exercises (title, body_zone, difficulty, duration_minutes, repetitions, instructions, recommendations)
SELECT 'Puente de cadera', 'hips', 'beginner', 10, '3 series de 15 repeticiones', 'Acuestate boca arriba.|Flexiona rodillas y apoya pies.|Eleva cadera apretando gluteos.', 'Mantiene abdomen activo para proteger la espalda baja.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE title = 'Puente de cadera');

INSERT INTO exercises (title, body_zone, difficulty, duration_minutes, repetitions, instructions, recommendations)
SELECT 'Elevacion de pantorrillas', 'calves', 'beginner', 8, '4 series de 15 repeticiones', 'Ponte de pie con apoyo cerca.|Eleva talones lentamente.|Baja controlando el movimiento.', 'Hazlo despacio para trabajar mejor la zona.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE title = 'Elevacion de pantorrillas');

INSERT INTO exercises (title, body_zone, difficulty, duration_minutes, repetitions, instructions, recommendations)
SELECT 'Circuito cuerpo completo', 'full_body', 'intermediate', 20, '3 rondas de 45 segundos por ejercicio', 'Alterna sentadillas, flexiones y plancha.|Descansa 30 segundos entre ejercicios.|Mantiene ritmo constante.', 'Ideal para dias con poco tiempo.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE title = 'Circuito cuerpo completo');
