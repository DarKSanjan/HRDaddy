import { test, expect } from '@playwright/test'
import { signIn } from './support/auth'

// Minimal valid PDFs, built in-memory with a unique name per test run —
// avoids the residue problem hit while building this spec: a fixed fixture
// filename meant every prior run's leftover (from a failed attempt) collided
// with the next run's assertions, since nothing here deletes on failure.
const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF'
)

function uniqueFileName(): string {
  return `e2e-doc-${Date.now()}-${Math.floor(Math.random() * 100000)}.pdf`
}

test.describe('Documents — upload, replace, archive, delete', () => {
  test('HR admin uploads a document, replaces it, archives it, then deletes it', async ({ page }) => {
    // Rachel Tan (HR Admin) has document.upload + document.view_all.
    await signIn(page, 'hrAdmin')
    await page.goto('/northstar-studios/documents')

    await page.getByRole('button', { name: 'Employee Documents' }).click()
    await page.getByRole('button', { name: 'Marcus Lee' }).click()
    await page.getByRole('button', { name: 'Certifications' }).click()

    const uploadName = uniqueFileName()
    const replaceName = uniqueFileName()

    // Upload a new document.
    await page.getByRole('button', { name: 'Upload' }).click()
    await page.locator('#upload-file').setInputFiles({
      name: uploadName,
      mimeType: 'application/pdf',
      buffer: PDF_BYTES,
    })
    await page.getByRole('button', { name: 'Upload', exact: true }).last().click()

    const fileTile = page.getByText(uploadName, { exact: true })
    await expect(fileTile).toBeVisible()

    // Replace it with a second file (different unique name).
    await fileTile.locator('xpath=ancestor::div[contains(@class, "group")]').getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Replace' }).click()
    await page.locator('#replace-file').setInputFiles({
      name: replaceName,
      mimeType: 'application/pdf',
      buffer: PDF_BYTES,
    })
    await page.getByRole('button', { name: 'Replace', exact: true }).last().click()
    const replacedTile = page.getByText(replaceName, { exact: true })
    await expect(replacedTile).toBeVisible()
    await expect(page.getByText(uploadName, { exact: true })).not.toBeVisible()

    // Archive it.
    await replacedTile.locator('xpath=ancestor::div[contains(@class, "group")]').getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Archive' }).click()
    await page.getByRole('button', { name: 'Archive', exact: true }).last().click()
    await expect(page.getByText('Archived')).toBeVisible()

    // Permanently delete it — the whole point of unique names per run is that
    // this step, and the test as a whole, never touches another run's data.
    await replacedTile.locator('xpath=ancestor::div[contains(@class, "group")]').getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete Permanently' }).click()
    await expect(page.getByText(replaceName, { exact: true })).not.toBeVisible()
  })

  test('HR admin creates and edits a document category', async ({ page }) => {
    await signIn(page, 'hrAdmin')
    await page.goto('/northstar-studios/settings/documents')

    await expect(page.getByRole('heading', { name: 'Document Categories' })).toBeVisible()

    const categoryName = `E2E Category ${Math.floor(Math.random() * 100000)}`
    await page.getByRole('button', { name: 'Create Category' }).click()
    await page.getByLabel('Name').fill(categoryName)
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText(categoryName)).toBeVisible()

    // Edit it — rename.
    await page.getByRole('button', { name: `Edit ${categoryName}` }).click()
    const renamedTo = `${categoryName} (edited)`
    await page.getByLabel('Name').fill(renamedTo)
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText(renamedTo)).toBeVisible()
  })
})
