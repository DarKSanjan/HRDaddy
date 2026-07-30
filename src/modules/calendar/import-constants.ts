export const CSV_HEADERS = ['date', 'name'] as const

export type HolidayCsvHeader = (typeof CSV_HEADERS)[number]

export const CSV_TEMPLATE_ROW = ['2026-01-01', "New Year's Day"]

export const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024

export const MAX_CSV_ROWS = 500
