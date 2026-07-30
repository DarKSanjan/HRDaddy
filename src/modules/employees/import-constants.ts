/**
 * CSV Import constants — shared between server and client code.
 * No heavy dependencies here so it's safe to import from client components.
 */

/**
 * The exact CSV header contract. Column order does not matter, but names
 * must match exactly (case-insensitive comparison is applied during parsing).
 */
export const CSV_HEADERS = [
  'first_name',
  'last_name',
  'work_email',
  'personal_email',
  'phone',
  'date_of_birth',
  'gender',
  'national_id',
  'address',
  'start_date',
  'department',
  'job_title',
  'location',
  'employment_type',
  'manager_email',
  'compensation_amount',
  'compensation_currency',
  'pay_type',
  'is_workman',
  'shift_template',
  'bank_name',
  'bank_account_number',
] as const

export type CsvHeader = (typeof CSV_HEADERS)[number]

export const CSV_TEMPLATE_ROW = [
  'Jane',
  'Doe',
  'jane.doe@company.com',
  'jane.personal@email.com',
  '+65 9123 4567',
  '1990-05-15',
  'Female',
  'S1234567A',
  '123 Main St Singapore 123456',
  '2024-01-15',
  'Engineering',
  'Software Engineer',
  'Singapore HQ',
  'Full-time',
  'manager@company.com',
  '5000',
  'SGD',
  'SALARIED',
  'false',
  'Standard 9-6',
  'DBS',
  '1234567890',
]

/** Maximum CSV file size (2 MB). Keeps server action response time reasonable. */
export const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024

/** Maximum number of data rows (excluding header). */
export const MAX_CSV_ROWS = 500
