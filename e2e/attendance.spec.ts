import { test, expect } from '@playwright/test'
import { signIn } from './support/auth'

test.describe('Attendance clock in/out', () => {
  test('employee clocks in, then clocks out, record appears in history', async ({ page }) => {
    // Sign in as Marcus Lee (employee)
    await signIn(page, 'employee')
    await page.goto('/northstar-studios/attendance')

    // The ClockWidget should show "Not Clocked In" initially (unless already clocked in from
    // a prior run — handle both cases).
    const clockInBtn = page.getByRole('button', { name: 'Clock In' })
    const clockOutBtn = page.getByRole('button', { name: 'Clock Out' })

    // If already clocked in from a prior test run, clock out first to reset state.
    if (await clockOutBtn.isVisible().catch(() => false)) {
      await clockOutBtn.click()
      // Wait for page to reflect the clock-out
      await expect(page.getByText('Not Clocked In')).toBeVisible()
    }

    // Verify the "Not Clocked In" state
    await expect(page.getByText('Not Clocked In')).toBeVisible()
    await expect(clockInBtn).toBeVisible()

    // Select "Remote" type to differentiate from any prior office entries
    await page.getByRole('button', { name: 'Remote' }).click()

    // Clock in
    await clockInBtn.click()

    // Should now show "Currently Clocked In" and the Clock Out button
    await expect(page.getByText('Currently Clocked In')).toBeVisible()
    await expect(clockOutBtn).toBeVisible()

    // Clock out
    await clockOutBtn.click()

    // Should return to "Not Clocked In"
    await expect(page.getByText('Not Clocked In')).toBeVisible()

    // Verify the record appears in the history table with status CLOSED
    const historyTable = page.locator('table')
    await expect(historyTable).toBeVisible()
    // The most recent record should be a CLOSED row with REMOTE type
    const firstRow = historyTable.locator('tbody tr').first()
    await expect(firstRow.getByText('REMOTE')).toBeVisible()
    await expect(firstRow.getByText('CLOSED')).toBeVisible()
  })
})
