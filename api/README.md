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
tiempo para cocinar se guardan en `food_preferences`. Al actualizar una base
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

Copiar `index.php`, `auth-session.php`, `clinical-history.php`, `dietary-recall.php`, `meal-schedule.php`, `recipe-generation.php`, `recipe-nutrition.php`, `meal-plan.php`, `food-preferences.php` y `lifestyle-goals.php` en la carpeta
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

## Conexion movil

La app movil no debe conectarse directamente a MySQL. Ionic llama a esta API, y esta API consulta la base de datos.
