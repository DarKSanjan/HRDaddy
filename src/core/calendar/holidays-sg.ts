/**
 * Singapore public holidays — versioned fixture.
 * Source: Ministry of Manpower (MOM) / gov.sg
 * Same pattern as CPF rate tables: effectiveYear, source, editable per org.
 */
import type { PublicHoliday } from './index'

export interface HolidayFixture {
  effectiveYear: number
  source: string
  holidays: PublicHoliday[]
}

export const SG_HOLIDAYS_2026: HolidayFixture = {
  effectiveYear: 2026,
  source: 'https://www.mom.gov.sg/employment-practices/public-holidays',
  holidays: [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-01-29', name: 'Chinese New Year' },
    { date: '2026-01-30', name: 'Chinese New Year (Day 2)' },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-05-01', name: 'Labour Day' },
    { date: '2026-05-12', name: 'Vesak Day' },
    { date: '2026-06-17', name: 'Hari Raya Haji' },
    { date: '2026-08-09', name: 'National Day' },
    { date: '2026-10-20', name: 'Deepavali' },
    { date: '2026-12-25', name: 'Christmas Day' },
    // Hari Raya Puasa date depends on moon sighting — placeholder
    { date: '2026-03-20', name: 'Hari Raya Puasa' },
  ],
}

export const SG_HOLIDAYS_2027: HolidayFixture = {
  effectiveYear: 2027,
  source: 'https://www.mom.gov.sg/employment-practices/public-holidays',
  holidays: [
    { date: '2027-01-01', name: "New Year's Day" },
    { date: '2027-02-17', name: 'Chinese New Year' },
    { date: '2027-02-18', name: 'Chinese New Year (Day 2)' },
    { date: '2027-03-26', name: 'Good Friday' },
    { date: '2027-05-01', name: 'Labour Day' },
    { date: '2027-05-02', name: 'Vesak Day' },
    { date: '2027-06-07', name: 'Hari Raya Haji' },
    { date: '2027-08-09', name: 'National Day' },
    { date: '2027-11-08', name: 'Deepavali' },
    { date: '2027-12-25', name: 'Christmas Day' },
    { date: '2027-03-10', name: 'Hari Raya Puasa' },
  ],
}

/**
 * Get holidays for a given year. Falls back to empty if no fixture.
 */
export function getHolidaysForYear(year: number): PublicHoliday[] {
  switch (year) {
    case 2026:
      return SG_HOLIDAYS_2026.holidays
    case 2027:
      return SG_HOLIDAYS_2027.holidays
    default:
      return []
  }
}

/**
 * Get all holidays spanning a date range.
 */
export function getHolidaysForRange(
  startYear: number,
  endYear: number
): PublicHoliday[] {
  const holidays: PublicHoliday[] = []
  for (let y = startYear; y <= endYear; y++) {
    holidays.push(...getHolidaysForYear(y))
  }
  return holidays
}
