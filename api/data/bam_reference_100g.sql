-- For databases that already have the original BAM workbook imported.
UPDATE foods
SET reference_amount = 100,
    reference_unit = 'g',
    source_notes = 'BAM 18.1.1: values per 100 g edible portion, inferred from published use and workbook checks. Missing cells are not zero.'
WHERE source_sha256 = 'd192e99450d8fcd67ee6dc29c0c3808feec172a04b57a17bc6269c1a5db38f60'
  AND reference_amount IS NULL
  AND reference_unit IS NULL;
