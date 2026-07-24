import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should show sign-in page', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('should show sign-up page', async ({ page }) => {
    await page.goto('/sign-up')
    await expect(
      page.getByRole('heading', { name: 'Create an account' })
    ).toBeVisible()
  })

  test('should redirect unauthenticated users to sign-in', async ({
    page,
  }) => {
    await page.goto('/some-org/dashboard')
    await expect(page).toHaveURL(/\/sign-in/)
  })
})
