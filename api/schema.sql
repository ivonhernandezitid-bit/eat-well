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
  imc DECIMAL(5,2) NOT NULL DEFAULT 24.22,
  activity_level ENUM('low', 'moderate', 'high') NOT NULL DEFAULT 'moderate',
  goal ENUM('lose_weight', 'maintain', 'gain_muscle', 'improve_health') NOT NULL DEFAULT 'improve_health',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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
  min_imc DECIMAL(5,2) NULL,
  max_imc DECIMAL(5,2) NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  body_zone VARCHAR(50) NOT NULL,
  difficulty ENUM('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'beginner',
  duration_minutes INT NOT NULL,
  repetitions VARCHAR(120) NOT NULL,
  instructions TEXT NOT NULL,
  recommendations TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS food_scans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  image_url TEXT NULL,
  detected_food VARCHAR(150) NULL,
  estimated_calories INT NULL,
  ai_recommendation TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO recipes (title, description, calories, protein_grams, carbs_grams, fat_grams, ingredients, instructions, goal, min_imc, max_imc)
SELECT 'Bowl balanceado de pollo', 'Comida alta en proteina para mantener energia durante el dia.', 520, 38, 48, 16, 'Pechuga de pollo|Arroz integral|Brocoli|Zanahoria|Aguacate', 'Cocina el arroz integral.|Asa el pollo.|Sirve con verduras y aguacate.', 'improve_health', 18.5, NULL
WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE title = 'Bowl balanceado de pollo');

INSERT INTO recipes (title, description, calories, protein_grams, carbs_grams, fat_grams, ingredients, instructions, goal, min_imc, max_imc)
SELECT 'Tostadas ligeras de atun', 'Cena rapida con buena proteina y bajo contenido calorico.', 360, 28, 34, 10, 'Atun|Tostadas horneadas|Jitomate|Lechuga|Aguacate', 'Mezcla el atun con verduras.|Sirve sobre tostadas.|Agrega aguacate al final.', 'lose_weight', NULL, 30
WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE title = 'Tostadas ligeras de atun');

INSERT INTO recipes (title, description, calories, protein_grams, carbs_grams, fat_grams, ingredients, instructions, goal, min_imc, max_imc)
SELECT 'Avena con fruta y nueces', 'Desayuno practico para iniciar el dia con fibra.', 410, 15, 56, 14, 'Avena|Leche|Platano|Nueces|Canela', 'Cocina la avena con leche.|Agrega platano y nueces.|Termina con canela.', 'maintain', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE title = 'Avena con fruta y nueces');

INSERT INTO recipes (title, description, calories, protein_grams, carbs_grams, fat_grams, ingredients, instructions, goal, min_imc, max_imc)
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
