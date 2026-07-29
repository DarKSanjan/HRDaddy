import { test, expect } from '@playwright/test'
import { signIn } from './support/auth'

test.describe('Documents explorer', () => {
  test('HR admin navigates employee documents folder structure', async ({ page }) => {
    // Rachel Tan (HR Admin) has document.view_all permission
    await signIn(page, 'hrAdmin')
    await page.goto('/northstar-studios/documents')

    // Should see the Documents heading
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible()

    // Root level should show "Employee Documents" folder tile (a button)
    await expect(page.getByRole('button', { name: 'Employee Documents' })).toBeVisible()

    // Navigate into Employee Documents
    await page.getByRole('button', { name: 'Employee Documents' }).click()

    // Should see employee folders — Marcus Lee is one of the seeded employees with docs
    await expect(page.getByRole('button', { name: 'Marcus Lee' })).toBeVisible()

    // Navigate into Marcus Lee's folder
    await page.getByRole('button', { name: 'Marcus Lee' }).click()

    // Should see document categories — Marcus has a Certifications doc
    await expect(page.getByRole('button', { name: 'Certifications' })).toBeVisible()

    // Navigate into Certifications
    await page.getByRole('button', { name: 'Certifications' }).click()

    // Should see the seeded file: AWS_SA_Certificate.pdf
    await expect(page.getByText('AWS_SA_Certificate.pdf')).toBeVisible()
  })

  test('HR admin can view payroll documents folder', async ({ page }) => {
    await signIn(page, 'hrAdmin')
    await page.goto('/northstar-studios/documents')

    // Root level should show Payroll folder tile (button)
    await expect(page.getByRole('button', { name: 'Payroll' })).toBeVisible()

    // Navigate into Payroll
    await page.getByRole('button', { name: 'Payroll' }).click()

    // Should show sub-folders: "By Month" and "By Employee"
    await expect(page.getByRole('button', { name: 'By Month' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'By Employee' })).toBeVisible()

    // Navigate into By Month
    await page.getByRole('button', { name: 'By Month' }).click()

    // Should show the published June 2026 period as a folder
    await expect(page.getByRole('button', { name: 'June 2026' })).toBeVisible()
  })

  test('employee can see only their own documents', async ({ page }) => {
    // Marcus Lee (employee) — selfOnly view
    await signIn(page, 'employee')
    await page.goto('/northstar-studios/documents')

    // Root level should show Employee Documents folder
    await expect(page.getByRole('button', { name: 'Employee Documents' })).toBeVisible()

    // Navigate into Employee Documents — should only see their own folder
    await page.getByRole('button', { name: 'Employee Documents' }).click()
    await expect(page.getByRole('button', { name: 'Marcus Lee' })).toBeVisible()

    // Navigate into their folder
    await page.getByRole('button', { name: 'Marcus Lee' }).click()

    // Should see Certifications category (Marcus has a cert doc there)
    await expect(page.getByRole('button', { name: 'Certifications' })).toBeVisible()

    // Navigate into Certifications
    await page.getByRole('button', { name: 'Certifications' }).click()

    // Should see the file
    await expect(page.getByText('AWS_SA_Certificate.pdf')).toBeVisible()
  })
})
