-- Selecciona eatwell_db en phpMyAdmin antes de importar.
-- Actualizacion aditiva: no borra ni reemplaza registros existentes.
SET NAMES utf8mb4;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'patient',
  ADD COLUMN IF NOT EXISTS cedula_profesional VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS universidad VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS especialidad VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS consultorio VARCHAR(150) NULL;

ALTER TABLE food_preferences ADD COLUMN IF NOT EXISTS no_preference_categories LONGTEXT NULL;

ALTER TABLE clinical_histories
  ADD COLUMN IF NOT EXISTS diagnosis_metabolism_none BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_thyroid_none BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_other_none BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_digestive_none BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_hyperthyroidism BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_dyslipidemia BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_insulin_resistance BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_chronic_kidney_disease BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_kidney_stones BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_celiac BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_irritable_bowel BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_gastritis BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_ulcerative_colitis BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS other_diagnoses TEXT NULL;

CREATE TABLE IF NOT EXISTS body_measurements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  measured_at DATETIME(3) NOT NULL COMMENT 'UTC',
  waist_cm DECIMAL(5,2) NOT NULL,
  hip_cm DECIMAL(5,2) NOT NULL,
  arm_cm DECIMAL(5,2) NOT NULL,
  thigh_cm DECIMAL(5,2) NOT NULL,
  neck_cm DECIMAL(5,2) NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  height_cm DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_body_measurement_client (user_id, client_id),
  KEY idx_body_measurement_history (user_id, measured_at, id),
  CONSTRAINT fk_body_measurement_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_body_circumferences CHECK (
    waist_cm > 0 AND waist_cm <= 250 AND hip_cm > 0 AND hip_cm <= 250
    AND arm_cm > 0 AND arm_cm <= 250 AND thigh_cm > 0 AND thigh_cm <= 250
    AND neck_cm > 0 AND neck_cm <= 250),
  CONSTRAINT chk_body_dimensions CHECK (weight_kg > 0 AND weight_kg <= 500 AND height_cm > 0 AND height_cm <= 300)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cuenta de prueba solicitada: solo se actualiza si el correo ya existe.
UPDATE users
SET role = 'nutritionist',
    cedula_profesional = '12849305',
    universidad = 'Universidad Juárez del Estado de Durango (UJED)',
    especialidad = 'Nutrición Clínica',
    consultorio = 'Consultorio Nutricional Vida Sana'
WHERE email = 'mariana.nutri@eatwell.mx';
