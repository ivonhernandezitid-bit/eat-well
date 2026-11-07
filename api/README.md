# EatWell PHP API

Esta API es temporal para trabajar con XAMPP y MySQL. Mas adelante se puede cambiar por Node/Express, Laravel, Firebase o una API publicada sin cambiar las pantallas de Ionic.

## Instalacion local con XAMPP

1. Abre XAMPP y activa `Apache` y `MySQL`.
2. Entra a `http://localhost/phpmyadmin`.
3. Importa el archivo `schema.sql`.
4. Copia la carpeta `api` completa a:

```text
C:\xampp\htdocs\eatwell-api
```

5. Dentro de `C:\xampp\htdocs\eatwell-api`, copia `config.example.php` como
   `config.local.php` y coloca ahi tu clave de Google AI Studio y el modelo de Gemini. Este archivo no se
   debe subir a GitHub.

5. Prueba en el navegador:

```text
http://localhost/eatwell-api/index.php?action=exercises.byZone&bodyZone=abdomen
```

## Endpoints

```text
POST index.php?action=auth.register
POST index.php?action=auth.login
POST index.php?action=auth.logout
GET  index.php?action=clinical.get
POST index.php?action=clinical.save
POST index.php?action=clinical.delete
GET  index.php?action=recall.initial
POST index.php?action=recall.save
GET  index.php?action=schedule.get
POST index.php?action=schedule.save
GET  index.php?action=profile.get&userId=1
POST index.php?action=profile.update
GET  index.php?action=preferences.get&userId=1
POST index.php?action=preferences.save
POST index.php?action=preferences.delete
GET  index.php?action=recipes.recommendations&userId=1
GET  index.php?action=favorites.list&userId=1
POST index.php?action=favorites.add
POST index.php?action=favorites.remove
GET  index.php?action=exercises.byZone&bodyZone=abdomen
POST index.php?action=scanner.analyze
GET  index.php?action=scanner.recommendations&userId=1
GET  index.php?action=scanner.recipeDetail&userId=1&recipeId=716429
```

## Escaner de alimentos con Gemini

El endpoint `scanner.analyze` recibe una imagen reducida en formato data URL. El
backend envia la foto a Gemini mediante Google AI Studio; la clave nunca se
envia a Ionic ni se incluye en el APK.

Gemini identifica los ingredientes visibles y genera cuatro recetas completas en
espanol. No se solicitan ni muestran calorias, macros o porcentajes de confianza.
Cada analisis se registra en `food_scans`, pero las recetas se mantienen en la
sesion hasta que la persona las agrega a favoritos. Solo esos favoritos se
conservan en `favorite_recipes`.

## Personalizacion

Las preferencias de alimentacion, frutas, verduras, carnes y proteínas,
carbohidratos, legumbres, lácteos, grasas, alergias, alimentos no deseados y
tiempo para cocinar se guardan en `food_preferences`, junto con las categorías
confirmadas explícitamente como “sin preferencia”. Cada categoría requiere al
menos una selección o una confirmación antes de completar el módulo. Al actualizar una base
existente, vuelve a importar `schema.sql` para agregar las columnas nuevas. Las
recomendaciones de Meal Plan se almacenan por version de preferencias para no
generarlas de nuevo en cada visita.

Si Google responde que el proyecto no tiene acceso, crea una clave nueva desde Google AI Studio con un proyecto habilitado para Gemini API.
## Historial clinico

Las operaciones `clinical.get`, `clinical.save` y `clinical.delete` utilizan la
tabla `clinical_histories`. Requieren la identificacion `authToken` entregada por
registro o login en la cabecera `Authorization: Bearer <authToken>`.
La cuenta propietaria se obtiene de la sesion PHP; no se permite solicitar el
historial de otra cuenta. Al actualizar, cerrar sesion e iniciar sesion de nuevo.

Copiar `index.php`, `auth-session.php`, `clinical-history.php`, `dietary-recall.php`, `meal-schedule.php`, `eating-habits.php`, `anthropometric-measurements.php`, `recipe-generation.php`, `recipe-portions.php`, `recipe-nutrition.php`, `meal-plan.php`, `food-preferences.php` y `lifestyle-goals.php` en la carpeta
de la API de XAMPP, conservando `config.local.php`. El registro de sesiones PHP
debe poder escribir en su carpeta de sesiones. No se necesitan nuevas tablas si
ya existe `clinical_histories`. Usar HTTPS para un despliegue publico.

La prueba de backend puede ejecutarse con PHP desde `api/tests/clinical-history.test.php`;
crea y elimina una base temporal con pacientes ficticios.

## Recordatorio de 24 horas

`recall.initial` consulta si la cuenta ya completo su recordatorio inicial.
`recall.save` recibe `recallDate` y `recall` y solo permite una captura inicial
completada por usuario. Los registros anteriores no se borran; se utiliza el
primer recordatorio completado como referencia. Las cinco comidas son desayuno,
colacion matutina, comida, colacion vespertina y cena.

`schedule.get` consulta o prepara los horarios basados en esa referencia.
`schedule.save` permite ajustar los cinco horarios sin modificar lo consumido.
Las operaciones requieren `Authorization: Bearer <authToken>`. La nueva tabla
`meal_schedules` conserva los horarios por usuario y el recordatorio de origen.
La base local ya incluye esta tabla; el SQL completo y `schema.sql` tambien la
incluyen para otras instalaciones. No volver a importar el SQL completo sobre
una base que ya fue actualizada.

El guardado inicial utiliza una transaccion para confirmar o cancelar el dia,
sus cinco comidas y sus horarios juntos. Las sugerencias de horarios son una
propuesta editable, no una evaluacion nutricional ni una prescripcion medica.

La prueba de backend se ejecuta con PHP desde `api/tests/dietary-recall.test.php`.
Utiliza una base temporal y no necesita llamadas a Google.

## Procesamiento de habitos y horarios

`GET index.php?action=habits.get` consulta el primer recordatorio completado de
la cuenta autenticada. Requiere `Authorization: Bearer <authToken>`. Devuelve
`initialCompleted=false` y `analysis=null` si todavia no existe esa captura.

El analisis incluye las cinco comidas con su estado, conteos de comidas
declaradas y omitidas, lugares de consumo, intervalos entre comidas y tiempos
respecto a despertar y dormir. Los intervalos usan minutos desde el despertar
para contemplar jornadas que cruzan medianoche. Solo se calculan intervalos con
horas validas dentro de la jornada; los datos inconsistentes producen
`qualityWarnings`, no correcciones automaticas. Los datos desconocidos se
devuelven como `null`, no cero.

El resultado describe un dia declarado, no demuestra habitos permanentes ni
evalua nutrientes, cantidades o calidad de la dieta. No usa IA ni el catalogo
para interpretar texto libre. Se calcula al consultar los datos, por lo que una
correccion del recordatorio se refleja sin duplicar tablas de resultados.
No modifica el recordatorio, no genera horarios y no reemplaza los horarios
personalizados. Tampoco cambia las reglas del editor de horarios existente.

Ionic dispone de `EatWellService.getEatingHabits()`. No se agrego una pantalla ni
se envio este analisis automaticamente a la IA. Para probar los calculos:

```powershell
php api/tests/eating-habits.test.php
```

Con `--database`, tambien verifica autenticacion, cuentas separadas, lectura y
correcciones usando una base temporal con usuarios ficticios. Requiere MySQL
local activo y permisos para crear y eliminar esa base temporal. No necesita
importar otro SQL en la instalacion existente.

## Catalogo BAM

La base incluye tablas para almacenar el catalogo BAM. Para cargar sus datos en
otra instalacion, consulta la [guia del catalogo](data/README.md). La carga es
independiente de las recetas y no conecta funciones ni modifica las pantallas.

## Estilo de vida y metas

`lifestyle.get`, `lifestyle.save` y `lifestyle.delete` requieren una sesion
verificada. Guardan los campos del modulo en `lifestyle_goals`, separados por
usuario. El objetivo y nivel de actividad de `users` se actualizan en la misma
transaccion. No hace falta importar otro SQL si ya existe `lifestyle_goals`.

El perfil, inicio y plan consultan los datos guardados en la base. Los datos
anteriores del almacenamiento local solo sirven para recuperar el formulario
cuando no hay un registro completado; abrir el modulo y guardar los conserva
en la base. La prueba `api/tests/lifestyle-goals.test.php` utiliza pacientes
ficticios en una base temporal, sin llamadas a Google.

## Estructura del plan alimenticio

`plan.get` y `plan.choose` conservan `date` y `choices` y devuelven tambien
`meals` con cinco espacios ordenados, cada uno con `mealType`, `label`,
`scheduledTime`, `selectionStatus` y `recipe`. Los estados son `pending`,
`selected` y `needs_review`. Un horario o receta ausente se devuelve como `null`.
`summary` cuenta las cinco comidas y sus elecciones; las que requieren revision
forman parte del total pendiente. `scheduleCustomized` refleja los horarios
actuales. Consultar el plan no genera recetas ni escribe horarios.

`plan.options` entrega cuatro alternativas por comida. El servidor valida cuatro
recetas nuevas y puede reutilizar cuatro de un conjunto anterior compatible,
sin llamadas adicionales a Google. Las elecciones compatibles anteriores se
conservan aunque provinieran de un conjunto de siete. La vista incluye la
eleccion vigente dentro de sus cuatro opciones para permitir quitarla o cambiarla.

Se reutilizan `daily_meal_choices`, `personalized_recipes` y `meal_schedules`.
No se necesita una tabla nueva ni importar SQL por este cambio. BAM sigue como
fuente actual; el cambio de fuente alimenticia y una adaptacion mas amplia del
prompt quedan pendientes. Ahora solo se ajusto la cantidad solicitada a cuatro.

Pruebas: `api/tests/daily-plan-structure.test.php`,
`api/tests/meal-plan.test.php` y `tests/daily-meal-plan.test.cjs`.
La prueba con MySQL crea una base temporal y simula la generacion, sin llamar
a Google. Adapta el esquema de esa base temporal al campo de categorias sin
preferencia del codigo actual, sin modificar la base real.

## Mediciones antropometricas

`profile.update` requiere sesion verificada y conserva los campos que no se
envian. PHP valida peso en kg y estatura en cm, redondea a dos decimales y
recalcula el IMC sin confiar en un valor enviado por el cliente. Los limites
tecnicos son peso mayor que cero hasta 500 kg, estatura mayor que cero hasta
300 cm e IMC positivo representable en la columna existente. No son rangos
recomendados ni criterios de salud.

El formulario envia `recordMeasurement=true` junto con peso y estatura para
confirmar una captura. Un cambio efectivo en las medidas tambien se registra.
Se usa `anthropometric_measurements`, que ya existe: no se requiere importar SQL.
La actualizacion del usuario y la insercion del historial se confirman juntas.
El bloqueo por usuario evita que dos guardados simultaneos inserten el mismo
ultimo valor. Se omite un registro identico al ultimo del mismo dia; la misma
medicion confirmada en otro dia si queda guardada.

Actualizar solo la foto o el nombre no confirma una medicion ni guarda los
valores predeterminados del registro inicial como una medicion real. Ionic
envia unicamente los campos editados, no todo el perfil cacheado.

`GET index.php?action=measurements.get` requiere sesion y devuelve las ultimas
50 mediciones de la cuenta, ordenadas de mas reciente a mas antigua. Acepta
`limit` entre 1 y 100. Cada medicion incluye el IMC calculado con sus propios
valores y `measuredAt` en la zona `America/Mexico_City`. No se agrego una grafica
ni una pantalla de historial; Ionic dispone de `getMeasurementHistory()`.

```powershell
php api/tests/anthropometric-measurements.test.php
php api/tests/anthropometric-measurements.test.php --database
node tests/anthropometric-measurements.test.cjs
```

La opcion `--database` utiliza y elimina una base temporal con cuentas ficticias.
No usa IA ni modifica pacientes reales.

## Ajuste de porciones

`GET index.php?action=recipes.portions` requiere sesion verificada y recibe
`recipeId`, `source` y `servings` (entero entre 1 y 12). Los origenes son
`personalized`, `favorite`, `scan` y `local`. Para los dos primeros se usa el
prefijo `personalized-` o `favorite-`; los otros usan su identificador numerico.
El servidor recupera las cantidades almacenadas. Las recetas privadas deben
pertenecer a la cuenta autenticada; no acepta cantidades del cliente como origen.

Solo ajusta recetas con porciones originales y cantidades completas en g o ml,
coincidentes con la lista de ingredientes. En otro caso devuelve
`available=false` con el motivo, sin inventar equivalencias. Las cantidades
visibles se redondean a tres decimales; no se admiten resultados positivos que
queden mostrados como cero ni mas de 100000 g/ml por ingrediente.

La respuesta distingue `baseServings`, `requestedServings`, `ingredients`,
`ingredientData`, `nutrition.perServing` y `totalNutrition`. Los totales se
calculan antes del redondeo visible. Los datos nutrimentales sin referencia BAM
siguen como `null`. No se asumen referencias de 100 g.

El detalle muestra controles de porciones solo con datos suficientes. No guarda
el ajuste ni reemplaza recetas, favoritos o elecciones diarias. Los pasos y
tiempos no se multiplican; se advierte si hay cantidades en el texto original.
No implica una recomendacion de consumo individual.

Copiar tambien `recipe-portions.php` al actualizar la API. No necesita tablas
nuevas ni importacion SQL. Pruebas:

```powershell
php api/tests/recipe-portions.test.php
php api/tests/recipe-portions.test.php --database
node tests/recipe-portions.test.cjs
```

La opcion de base utiliza recetas ficticias y elimina la base temporal.
No se hacen llamadas a Google.

## Conexion movil

La app movil no debe conectarse directamente a MySQL. Ionic llama a esta API, y esta API consulta la base de datos.
