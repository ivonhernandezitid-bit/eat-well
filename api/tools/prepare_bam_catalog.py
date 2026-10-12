"""Validate the supplied BAM workbook and generate a repeatable SQL data import."""

import argparse
import hashlib
import json
import math
from pathlib import Path

import openpyxl


VARIABLES = [
    ('energ_kcal', 'energy', 'Energy', 'kcal'),
    ('carbohydrt', 'carbohydrates', 'Carbohydrates', 'g'),
    ('lipid_tot', 'total_fat', 'Total fat', 'g'),
    ('protein', 'protein', 'Protein', 'g'),
    ('fiber_td', 'dietary_fiber', 'Dietary fiber', 'g'),
    ('calcium', 'calcium', 'Calcium', 'mg'),
    ('iron', 'iron', 'Iron', 'mg'),
    ('ironhem', 'heme_iron', 'Estimated heme iron', 'mg'),
    ('ironnohem', 'non_heme_iron', 'Estimated non-heme iron', 'mg'),
    ('zinc', 'zinc', 'Zinc', 'mg'),
    ('vit_c', 'vitamin_c', 'Vitamin C', 'mg'),
    ('thiamin', 'thiamin', 'Thiamin', 'mg'),
    ('riboflavin', 'riboflavin', 'Riboflavin', 'mg'),
    ('niacin', 'niacin', 'Niacin', 'mg'),
    ('panto_acid', 'pantothenic_acid', 'Pantothenic acid', 'mg'),
    ('vit_b6', 'vitamin_b6', 'Vitamin B6', 'mg'),
    ('folic_acid', 'folic_acid', 'Added folic acid', 'ug'),
    ('food_folate', 'food_folate', 'Naturally occurring food folate', 'ug'),
    ('folate_dfe', 'dietary_folate_equivalents', 'Dietary folate equivalents', 'ug'),
    ('vit_b12', 'vitamin_b12', 'Vitamin B12', 'ug'),
    ('vit_a_rae', 'vitamin_a_rae', 'Vitamin A retinol activity equivalents', 'ug'),
    ('vit_e', 'vitamin_e', 'Vitamin E', 'mg'),
    ('vit_d_iu', 'vitamin_d', 'Vitamin D', 'IU'),
    ('vit_k', 'vitamin_k', 'Vitamin K', 'ug'),
    ('fa_sat', 'saturated_fat', 'Saturated fat', 'g'),
    ('fa_mono', 'monounsaturated_fat', 'Monounsaturated fat', 'g'),
    ('fa_poly', 'polyunsaturated_fat', 'Polyunsaturated fat', 'g'),
    ('chole', 'cholesterol', 'Cholesterol', 'mg'),
]


def sql_text(value):
    if value is None:
        return 'NULL'
    # Hex literals preserve accents and avoid dependence on SQL quote modes.
    return "CONVERT(X'" + str(value).encode('utf-8').hex() + "' USING utf8mb4) COLLATE utf8mb4_unicode_ci"


def nutrient_field(code, unit):
    return code + '_' + unit.lower()


def foods_schema():
    numeric_columns = ',\n'.join('  ' + nutrient_field(code, unit) + ' DOUBLE NULL'
                                 for variable, code, name, unit in VARIABLES)
    checks = ' AND '.join('(' + nutrient_field(code, unit) + ' IS NULL OR '
                         + nutrient_field(code, unit) + ' >= 0)'
                         for variable, code, name, unit in VARIABLES)
    return '''CREATE TABLE IF NOT EXISTS foods (
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
''' + numeric_columns + ''',
  raw_values_json LONGTEXT NOT NULL,
  nutrient_definitions_json LONGTEXT NOT NULL,
  UNIQUE KEY uq_foods_source_code (source_sha256, source_code),
  KEY idx_foods_name (name),
  CONSTRAINT chk_foods_source_row CHECK (source_row > 0),
  CONSTRAINT chk_foods_reference_amount CHECK (reference_amount IS NULL OR reference_amount > 0),
  CONSTRAINT chk_foods_raw_values CHECK (JSON_VALID(raw_values_json)),
  CONSTRAINT chk_foods_definitions CHECK (JSON_VALID(nutrient_definitions_json)),
  CONSTRAINT chk_foods_nonnegative_values CHECK (''' + checks + ''')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'''


def prepare(excel_path, output_path):
    workbook = openpyxl.load_workbook(excel_path, read_only=True, data_only=False)
    try:
        if len(workbook.worksheets) != 2 or workbook.worksheets[0].title != 'BAM 18.1.1':
            raise ValueError('Unexpected workbook layout; review the source before importing.')
        sheet = workbook.worksheets[0]
        rows = list(sheet.values)
        headers = ['codigomex2', 'nombre_del_alimento'] + [v[0] for v in VARIABLES]
        if list(rows[12]) != headers:
            raise ValueError('The BAM columns do not match the reviewed mapping.')
        descriptions = {r[1]: r[2] for r in workbook.worksheets[1].values if r[1] in headers[2:]}
        if set(descriptions) != set(headers[2:]):
            raise ValueError('Missing nutrient descriptions.')
        records = []
        codes = set()
        missing = 0
        markers = []
        for row_number, row in enumerate(rows[13:], 14):
            # The source has an isolated dot below the data, without a food code.
            if row[0] is None:
                if any(value not in (None, '.') for value in row):
                    raise ValueError(f'Unexpected content outside the food table: row {row_number}.')
                continue
            code, name = row[:2]
            if isinstance(code, bool) or not isinstance(code, (int, float)) or not math.isfinite(code) or int(code) != code:
                raise ValueError(f'Invalid food code at row {row_number}.')
            code = str(int(code))
            if code in codes or not isinstance(name, str) or not name.strip() or len(name) > 255:
                raise ValueError(f'Duplicate code or invalid food name at row {row_number}.')
            codes.add(code)
            values = []
            for column, value in enumerate(row[2:], 3):
                if value is None or value == '.':
                    missing += 1
                    if value == '.':
                        markers.append({'row': row_number, 'column': column})
                    values.append(value)
                elif isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0:
                    values.append(value)
                else:
                    raise ValueError(f'Unexpected nutrient value at row {row_number}, column {column}.')
            records.append((code, name, row_number, values))
        if not records:
            raise ValueError('The source contains no foods.')
        file_hash = hashlib.sha256(excel_path.read_bytes()).hexdigest()
        citation = ' '.join(str(rows[index][0]).strip() for index in (9, 10))
        notes = ('The workbook does not explicitly define a reference amount or food portions. '
                 'Reference amount and unit remain NULL pending source confirmation. '
                 'Blank cells and dot markers are missing, not zero. Food names are not unique identifiers.')
        definitions = {variable: {'field': nutrient_field(code, unit), 'name': name,
                                 'unit': unit, 'description': descriptions[variable]}
                       for variable, code, name, unit in VARIABLES}
        columns = ['source_code', 'name', 'source_name', 'source_version', 'source_file',
                   'source_sha256', 'source_sheet', 'source_row', 'source_citation', 'source_notes',
                   'reference_amount', 'reference_unit']
        columns += [nutrient_field(code, unit) for variable, code, name, unit in VARIABLES]
        columns += ['raw_values_json', 'nutrient_definitions_json']
        sql = ['-- BAM catalog: one food per row; no patient data.',
               '-- Select the destination database before importing.',
               'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;', foods_schema(),
               'SET @catalog_source_name = ' + sql_text('Base de Alimentos de Mexico (BAM)') + ';',
               'SET @catalog_source_version = ' + sql_text('18.1.1') + ';',
               'SET @catalog_source_file = ' + sql_text(excel_path.name) + ';',
               'SET @catalog_source_hash = ' + sql_text(file_hash) + ';',
               'SET @catalog_source_sheet = ' + sql_text(sheet.title) + ';',
               'SET @catalog_source_citation = ' + sql_text(citation) + ';',
               'SET @catalog_source_notes = ' + sql_text(notes) + ';',
               'SET @catalog_definitions = ' + sql_text(json.dumps(definitions, ensure_ascii=False)) + ';',
               'START TRANSACTION;']
        tuples = []
        for code, name, row, values in records:
            raw = {variable: None if value is None else str(value)
                   for (variable, code_name, nutrient_name, unit), value in zip(VARIABLES, values)}
            fields = [sql_text(code), sql_text(name), '@catalog_source_name', '@catalog_source_version',
                      '@catalog_source_file', '@catalog_source_hash', '@catalog_source_sheet', str(row),
                      '@catalog_source_citation', '@catalog_source_notes', 'NULL', 'NULL']
            fields += ['NULL' if value is None or value == '.' else repr(value) for value in values]
            fields += [sql_text(json.dumps(raw, ensure_ascii=False)), '@catalog_definitions']
            tuples.append('(' + ', '.join(fields) + ')')
        for start in range(0, len(tuples), 100):
            sql.append('INSERT INTO foods (' + ', '.join(columns) + ') VALUES\n'
                       + ',\n'.join(tuples[start:start + 100])
                       + '\nON DUPLICATE KEY UPDATE id = id;')
        sql.extend(['COMMIT;', ''])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text('\n'.join(sql), encoding='utf-8')
        print(json.dumps({'foods': len(records), 'nutrients': len(VARIABLES), 'values': len(records) * len(VARIABLES),
                          'missing_values': missing, 'dot_markers': markers, 'file_sha256': file_hash,
                          'output': str(output_path)}, ensure_ascii=True))
    finally:
        workbook.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--excel', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'data' / 'bam_18_1_1.sql')
    args = parser.parse_args()
    prepare(args.excel, args.output)
