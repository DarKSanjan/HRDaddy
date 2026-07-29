import { test, expect } from '@playwright/test'
import { signIn } from './support/auth'

/**
 * Picks a future Tuesday, at least 7 days out plus a random 1-8 week jitter so
 * repeat local runs on the same day don't try to submit an overlapping leave
 * request for the same date twice. Returns both the <input type="date"> value
 * and the "DD Mon YYYY" display format the leave tables render dates in.
 */
// en-SG's short month for September really is "Sept" (4 letters), unlike every
// other month — confirmed against the app's own formatDate(), not guessed.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']

function futureWeekday(): { inputValue: string; display: string } {
  // Wide jitter window (up to a year out): this test's own submission
  // permanently consumes that date for Marcus Lee (an approved/pending
  // request blocks future overlapping requests on the same date), so repeat
  // local runs need a large pool of candidate dates to stay collision-free.
  const jitterWeeks = 1 + Math.floor(Math.random() * 50)
  const d = new Date()
  d.setDate(d.getDate() + 7 + jitterWeeks * 7)
  while (d.getDay() !== 2) {
    d.setDate(d.getDate() + 1)
  }
  // Build from local Y/M/D getters, not toISOString() — toISOString() converts
  // to UTC first, which shifts the date by one near local midnight (the exact
  // bug already fixed once in this codebase for performance-cycle dates).
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return {
    inputValue: `${year}-${month}-${day}`,
    display: `${day} ${MONTHS[d.getMonth()]} ${year}`,
  }
}

test.describe('Leave request and approval', () => {
  test('employee submits a leave request, manager approves it, employee sees it approved', async ({
    page,
  }) => {
    const date = futureWeekday()
    const reason = `E2E test — ${date.inputValue}`

    // Marcus Lee (EMPLOYEE, reports to Daniel Chen) submits a request.
    // Sick Leave rather than Annual Leave: this test's own submission
    // permanently consumes one day of balance once approved (no self-service
    // cancel/withdraw is wired up anywhere in the UI yet — see the follow-up
    // task on that), and Sick Leave starts with a much larger allocation.
    await signIn(page, 'employee')
    await page.goto('/northstar-studios/leave/request')
    await page.getByLabel('Leave Type').selectOption({ label: 'Sick Leave' })
    await page.getByLabel('Start Date').fill(date.inputValue)
    await page.getByLabel('End Date').fill(date.inputValue)
    await page.getByLabel('Reason (optional)').fill(reason)
    await page.getByRole('button', { name: 'Submit Request' }).click()

    await expect(page).toHaveURL(/\/leave$/)
    const myRequestRow = page.getByRole('row', { name: new RegExp(date.display) })
    await expect(myRequestRow).toBeVisible()
    await expect(myRequestRow.getByText('PENDING')).toBeVisible()

    // Daniel Chen (MANAGER, Marcus's manager) approves it.
    await signIn(page, 'manager')
    await page.goto('/northstar-studios/leave/approvals')
    // getByText resolves to the innermost element holding the reason (a leaf
    // <div> with no buttons in it). The revealed "Confirm Approval" form is a
    // sibling of the Approve/Reject button row, both children of the card
    // root — climb 3 real DOM ancestors to that root, not 2, or the confirm
    // form ends up out of scope once the initial click reveals it.
    const approvalRow = page.getByText(reason).locator('xpath=ancestor::div[3]')
    await approvalRow.getByRole('button', { name: 'Approve' }).click()
    await approvalRow.getByRole('button', { name: 'Confirm Approval' }).click()
    await expect(page.getByText(reason)).not.toBeVisible()

    // Marcus Lee sees the request reflect as approved.
    await signIn(page, 'employee')
    await page.goto('/northstar-studios/leave')
    const approvedRow = page.getByRole('row', { name: new RegExp(date.display) })
    await expect(approvedRow.getByText('APPROVED')).toBeVisible()
  })
})
