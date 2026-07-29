import { test, expect } from '@playwright/test'
import { signIn } from './support/auth'

/**
 * Generate a unique cycle name with random jitter to avoid collisions on
 * repeat runs. Uses a date range that doesn't overlap with real quarters
 * by adding random week offsets far into the future.
 */
function generateCycleName(): { name: string; startDate: string; endDate: string } {
  const jitterWeeks = 52 + Math.floor(Math.random() * 100) // 1–3 years out
  const start = new Date()
  start.setDate(start.getDate() + jitterWeeks * 7)
  // Align to a Monday
  while (start.getDay() !== 1) start.setDate(start.getDate() + 1)

  const end = new Date(start)
  end.setDate(end.getDate() + 89) // ~3 months

  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  const name = `E2E Test Q${Math.floor(Math.random() * 9000) + 1000}`

  return { name, startDate: startStr, endDate: endStr }
}

test.describe('Performance review cycle', () => {
  test('owner creates cycle, opens it, manager submits review, owner publishes', async ({ page }) => {
    const cycle = generateCycleName()

    // Step 1: Owner creates and opens a new cycle
    await signIn(page, 'owner')
    await page.goto('/northstar-studios/performance')

    // Click "Start New Cycle" button
    await page.getByRole('button', { name: 'Start New Cycle' }).click()

    // Fill in the cycle form
    await page.getByLabel('Cycle Name').fill(cycle.name)
    await page.getByLabel('Start Date').fill(cycle.startDate)
    await page.getByLabel('End Date').fill(cycle.endDate)

    // Submit the form
    await page.getByRole('button', { name: 'Create Cycle' }).click()

    // Wait for the cycle to appear in the list with DRAFT badge
    await expect(page.getByText(cycle.name)).toBeVisible()

    // The cycle row is the closest ancestor with a border class — get a more
    // targeted locator: use the rounded-lg border div that wraps each cycle entry.
    const cycleRow = page.locator('div.rounded-lg').filter({ hasText: cycle.name })
    await expect(cycleRow.getByText('DRAFT')).toBeVisible()

    // Open the cycle
    await cycleRow.getByRole('button', { name: 'Open' }).click()

    // Verify it's now ACTIVE (the Badge text within the same row)
    await expect(cycleRow.getByText('ACTIVE')).toBeVisible()

    // Step 2: Manager submits a review for one of their reports
    await signIn(page, 'manager')
    await page.goto('/northstar-studios/performance')

    // The active cycle should show in the Review Queue
    await expect(page.getByText(`Active Cycle: ${cycle.name}`)).toBeVisible()

    // Should see pending reviews for direct reports (Marcus, Priya, Wei, Aiden)
    await expect(page.getByText('Pending Reviews')).toBeVisible()

    // Click "Write Review" for the first pending review
    const firstReviewRow = page.getByRole('button', { name: 'Write Review' }).first()
    await firstReviewRow.click()

    // Fill in the review form — the org uses 'advanced' complexity (6 competency scores)
    await page.getByLabel('Job Knowledge').selectOption('4')
    await page.getByLabel('Quality of Work').selectOption('4')
    await page.getByLabel('Communication').selectOption('3')
    await page.getByLabel('Teamwork').selectOption('5')
    await page.getByLabel('Initiative').selectOption('4')
    await page.getByLabel('Reliability').selectOption('4')
    await page.getByLabel('Strengths').fill('Consistently delivers high-quality work on time.')
    await page.getByLabel('Areas for Improvement').fill('Could take on more leadership responsibilities.')
    await page.getByLabel('Goals for Next Quarter').fill('Lead a cross-team project initiative.')

    // Submit the review
    await page.getByRole('button', { name: 'Submit Review' }).click()

    // After submission, the manager's view won't show "Submitted — Ready to Publish"
    // because canPublish is false for MANAGER role. Instead, verify that the pending
    // count dropped by 1 (Marcus is no longer pending).
    await expect(page.getByText('Pending Reviews (3)')).toBeVisible()

    // Step 3: Owner publishes the submitted review
    await signIn(page, 'owner')
    await page.goto('/northstar-studios/performance')

    // Owner can see the submitted review ready to publish
    await expect(page.getByText('Submitted — Ready to Publish')).toBeVisible()

    // Click Publish on the first submitted review
    await page.getByRole('button', { name: 'Publish' }).first().click()

    // Should show as Published (use heading variant to avoid ambiguity with badge)
    await expect(page.getByRole('heading', { name: /Published/ })).toBeVisible()

    // Clean up: close the cycle so it doesn't interfere with future runs
    const activeCycleRow = page.locator('div.rounded-lg').filter({ hasText: cycle.name })
    await activeCycleRow.getByRole('button', { name: 'Close' }).click()
    await expect(activeCycleRow.getByText('CLOSED')).toBeVisible()
  })
})
