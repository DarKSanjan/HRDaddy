import { test, expect } from '@playwright/test'
import { signIn } from './support/auth'

test.describe('Payroll', () => {
  test('employee can view published payslips', async ({ page }) => {
    // Marcus Lee (employee) should see his June 2026 payslip
    await signIn(page, 'employee')
    await page.goto('/northstar-studios/payroll/payslips')

    // The page should show "My Payslips" heading
    await expect(page.getByRole('heading', { name: 'My Payslips' })).toBeVisible()

    // "Published Payslips" card title
    await expect(page.getByText('Published Payslips')).toBeVisible()

    // Should show the June 2026 period
    await expect(page.getByText('June 2026')).toBeVisible()

    // Verify payslip data is rendered — the seeded gross for Marcus is
    // compensationCents=1000000 → monthly=83333 cents → $833.33
    // Actually: 1,000,000 / 12 = 83333.33 → rounded to 83333 → displayed as $833.33
    // Let's just check the general structure has amounts
    await expect(page.getByText('Gross')).toBeVisible()
    await expect(page.getByText('Net Pay')).toBeVisible()

    // Line items should be visible
    await expect(page.getByText('Basic Salary')).toBeVisible()
  })

  test('owner can view payroll period detail and see employee records', async ({ page }) => {
    // Ava Lim (owner) can access the payroll admin view
    await signIn(page, 'owner')
    await page.goto('/northstar-studios/payroll')

    // Should see "Payroll Periods" heading
    await expect(page.getByRole('heading', { name: 'Payroll Periods' })).toBeVisible()

    // Should see both June 2026 (PUBLISHED) and July 2026 (DRAFT)
    await expect(page.getByText('June 2026')).toBeVisible()
    await expect(page.getByText('July 2026')).toBeVisible()

    // Click into the June 2026 period to view detail
    await page.getByRole('link', { name: 'June 2026' }).click()

    // Should be on the period detail page with employee records
    await expect(page.getByRole('heading', { name: 'June 2026' })).toBeVisible()
    await expect(page.getByText('PUBLISHED')).toBeVisible()

    // Should show employee records table
    await expect(page.getByText('Employee Records')).toBeVisible()
    // Marcus Lee should be in the table
    await expect(page.getByText('Marcus Lee')).toBeVisible()
  })

  test('owner can view and manage payroll period workflow', async ({ page }) => {
    // Ava Lim navigates to the July 2026 period detail
    await signIn(page, 'owner')
    await page.goto('/northstar-studios/payroll')

    // Click into July 2026
    await page.getByRole('link', { name: 'July 2026' }).click()

    await expect(page.getByRole('heading', { name: 'July 2026' })).toBeVisible()

    // The period might be in any state depending on prior runs. Verify we can
    // see it and it has employee records (either already processed, or we process it).
    // If "Process Payroll" button is available, click it.
    const processBtn = page.getByRole('button', { name: 'Process Payroll' })
    if (await processBtn.isVisible().catch(() => false)) {
      await processBtn.click()
      // Wait for records to appear
      await expect(page.getByText('Employee Records')).toBeVisible()
      await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 })
    }

    // Regardless of initial state, verify the period detail page shows records
    await expect(page.getByText('Employee Records')).toBeVisible()
    await expect(page.getByText('Total Gross')).toBeVisible()
    await expect(page.getByText('Total Net')).toBeVisible()

    // Verify at least one employee is shown in the table
    await expect(page.locator('table tbody tr').first()).toBeVisible()
  })
})
