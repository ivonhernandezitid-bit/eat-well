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
GET  index.php?action=profile.get&userId=1
POST index.php?action=profile.update
GET  index.php?action=recipes.recommendations&userId=1
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
Cada escaneo y sus recetas se guardan inmediatamente en `food_scans` y
`ai_generated_recipes`.

La aplicacion recupera las recetas del ultimo escaneo con
`scanner.recommendations`. `scanner.recipeDetail` lee ingredientes y preparacion
desde MySQL, por lo que abrir una receta guardada no consume otra llamada de IA.

Si Google responde que el proyecto no tiene acceso, crea una clave nueva desde Google AI Studio con un proyecto habilitado para Gemini API.
## Nota

La app movil no debe conectarse directamente a MySQL. Ionic llama a esta API, y esta API consulta la base de datos.
