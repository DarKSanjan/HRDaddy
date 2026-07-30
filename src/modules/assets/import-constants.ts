/**
 * Asset CSV Import constants — shared between server and client code.
 * No heavy dependencies here so it's safe to import from client components.
 */

export const CSV_HEADERS = [
  'name',
  'asset_tag',
  'category',
  'purchase_date',
  'purchase_value',
  'notes',
] as const

export type AssetCsvHeader = (typeof CSV_HEADERS)[number]

export const CSV_TEMPLATE_ROW = [
  'MacBook Pro 16"',
  'LAP-2024-001',
  'Laptop',
  '2024-03-15',
  '3200.00',
  'M3 Pro chip, 36GB RAM',
]

/** Maximum CSV file size (2 MB). */
export const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024

/** Maximum number of data rows (excluding header). */
export const MAX_CSV_ROWS = 500
