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
```

## Nota

La app movil no debe conectarse directamente a MySQL. Ionic llama a esta API, y esta API consulta la base de datos.
