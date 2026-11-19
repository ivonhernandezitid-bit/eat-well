# Catálogo de alimentos BAM

La información del archivo `220615_bam_1811.xlsx` se guarda en una sola tabla: **`foods`**. Cada fila corresponde a uno de los 2,045 alimentos del catálogo BAM 18.1.1.

## Información de cada fila

- Código original y nombre del alimento.
- Los 28 componentes en columnas independientes, como `energy_kcal`, `protein_g`, `carbohydrates_g`, `total_fat_g` y `calcium_mg`.
- Archivo, versión, hoja, fila y referencia bibliográfica de origen.
- `raw_values_json`, que conserva los valores originales de las celdas.
- `nutrient_definitions_json`, que conserva las descripciones y unidades de la segunda hoja del Excel.

No se utilizan tablas separadas para fuentes, componentes o valores. Los nombres repetidos con códigos distintos se mantienen como alimentos diferentes.

Las 5,575 cantidades no disponibles permanecen como `NULL`, no como cero. El punto de la celda U930 se conserva en los valores originales, con su columna numérica en `NULL`. Los ceros presentes en el archivo se conservan.

El Excel no indica expresamente la cantidad de referencia. Para este archivo de BAM 18.1.1 se usa **100 g de parte comestible**, con base en los valores revisados del Excel y el [manual de intervención nutricional que usa BAM](https://www.scribd.com/document/1002011800/L-Web-Intervencion-Nutricional). El resultado es una estimación por porción. No se convierte de ml a g sin una densidad conocida.

## Actualizar una copia de la base original

Utilizar únicamente [eatwell_actualizacion_completa.sql](../eatwell_actualizacion_completa.sql). Incluye los cambios de los módulos del paciente y el catálogo en una sola tabla.

1. Conservar un respaldo de la base que se va a actualizar.
2. En phpMyAdmin, seleccionar la base que contiene la copia original.
3. En **Importar**, elegir `eatwell_actualizacion_completa.sql` y ejecutar la importación.
4. Confirmar que `foods` contiene 2,045 alimentos.

Este archivo se aplica una sola vez sobre la estructura original. No usarlo sobre una base ya actualizada. La base local del proyecto ya tiene el catálogo consolidado y no necesita otra importación.

## Instalaciones nuevas y herramienta de preparación

[schema.sql](../schema.sql) crea la estructura de `foods` para una instalación nueva. [bam_18_1_1.sql](bam_18_1_1.sql) permite cargar solo el catálogo en una base con esta estructura de tabla única. Repetir la carga del mismo catálogo conserva las filas existentes sin duplicarlas ni sobrescribir sus valores.

La herramienta [prepare_bam_catalog.py](../tools/prepare_bam_catalog.py) requiere Python y `openpyxl`. Lee y valida el Excel sin modificarlo y genera el SQL del catálogo. No se conecta a la base.

```powershell
python api/tools/prepare_bam_catalog.py --excel "C:\ruta\220615_bam_1811.xlsx"
```

Si cambian las columnas del archivo o aparecen valores inesperados, la herramienta detiene la preparación para que se revisen antes de importarlos.

Si la base ya contiene el catálogo, importar únicamente [bam_reference_100g.sql](bam_reference_100g.sql). Solo actualiza las filas sin referencia del archivo revisado; no cambia los valores originales ni los datos de pacientes.

El cálculo exige cantidades de ingredientes, porciones y una referencia en `foods`. Los datos faltantes se devuelven como `NULL`, no como cero.
