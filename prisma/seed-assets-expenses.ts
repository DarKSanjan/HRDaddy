/**
 * Seed data for Assets and Expenses modules.
 *
 * Creates realistic demo data for Northstar Studios:
 * - Asset categories + assets with varied statuses
 * - Asset requests in various states
 * - Expense categories + expense claims with varied statuses
 *
 * Idempotent — uses upsert or skip-if-exists.
 */
import type { PrismaClient } from '@prisma/client'

// ─────────────────────────────────────────────
// Asset Seed Data
// ─────────────────────────────────────────────

const ASSET_CATEGORIES = [
  'Laptop',
  'Monitor',
  'Phone',
  'Peripherals',
  'Furniture',
] as const

interface SeedAsset {
  name: string
  assetTag: string
  category: string
  status: 'AVAILABLE' | 'ASSIGNED' | 'IN_MAINTENANCE' | 'RETIRED' | 'LOST'
  assignedTo?: string // email reference
  purchaseDateOffset: number // days ago
  purchaseValueCents: number
  notes?: string
}

const SEED_ASSETS: SeedAsset[] = [
  // Laptops
  { name: 'MacBook Pro 16" M3', assetTag: 'LAP-2024-001', category: 'Laptop', status: 'ASSIGNED', assignedTo: 'ava.lim@northstarstudios.sg', purchaseDateOffset: -400, purchaseValueCents: 499900, notes: 'M3 Pro, 36GB RAM, 1TB SSD' },
  { name: 'MacBook Pro 14" M3', assetTag: 'LAP-2024-002', category: 'Laptop', status: 'ASSIGNED', assignedTo: 'daniel.chen@northstarstudios.sg', purchaseDateOffset: -380, purchaseValueCents: 399900 },
  { name: 'MacBook Pro 14" M3', assetTag: 'LAP-2024-003', category: 'Laptop', status: 'ASSIGNED', assignedTo: 'marcus.lee@northstarstudios.sg', purchaseDateOffset: -350, purchaseValueCents: 399900 },
  { name: 'MacBook Air 15" M3', assetTag: 'LAP-2024-004', category: 'Laptop', status: 'ASSIGNED', assignedTo: 'rachel.tan@northstarstudios.sg', purchaseDateOffset: -320, purchaseValueCents: 279900 },
  { name: 'MacBook Air 13" M3', assetTag: 'LAP-2024-005', category: 'Laptop', status: 'AVAILABLE', purchaseDateOffset: -90, purchaseValueCents: 229900, notes: 'Spare unit for new hires' },
  { name: 'ThinkPad X1 Carbon Gen 11', assetTag: 'LAP-2023-006', category: 'Laptop', status: 'IN_MAINTENANCE', purchaseDateOffset: -600, purchaseValueCents: 289900, notes: 'Battery replacement in progress' },
  { name: 'MacBook Pro 13" M1', assetTag: 'LAP-2021-007', category: 'Laptop', status: 'RETIRED', purchaseDateOffset: -1100, purchaseValueCents: 269900, notes: 'Decommissioned — donated to charity' },
  // Monitors
  { name: 'Dell U2723QE 27" 4K', assetTag: 'MON-2024-001', category: 'Monitor', status: 'ASSIGNED', assignedTo: 'priya.sharma@northstarstudios.sg', purchaseDateOffset: -300, purchaseValueCents: 89900 },
  { name: 'Dell U2723QE 27" 4K', assetTag: 'MON-2024-002', category: 'Monitor', status: 'ASSIGNED', assignedTo: 'wei.zhang@northstarstudios.sg', purchaseDateOffset: -300, purchaseValueCents: 89900 },
  { name: 'LG UltraFine 5K', assetTag: 'MON-2023-003', category: 'Monitor', status: 'ASSIGNED', assignedTo: 'jun.nakamura@northstarstudios.sg', purchaseDateOffset: -500, purchaseValueCents: 179900, notes: 'Design team — color-critical display' },
  { name: 'Dell U2723QE 27" 4K', assetTag: 'MON-2024-004', category: 'Monitor', status: 'AVAILABLE', purchaseDateOffset: -60, purchaseValueCents: 89900 },
  // Phones
  { name: 'iPhone 15 Pro', assetTag: 'PHN-2024-001', category: 'Phone', status: 'ASSIGNED', assignedTo: 'sarah.wong@northstarstudios.sg', purchaseDateOffset: -200, purchaseValueCents: 189900, notes: 'Sales team — client-facing' },
  { name: 'iPhone 15', assetTag: 'PHN-2024-002', category: 'Phone', status: 'ASSIGNED', assignedTo: 'kevin.ng@northstarstudios.sg', purchaseDateOffset: -200, purchaseValueCents: 149900 },
  { name: 'iPhone 14', assetTag: 'PHN-2023-003', category: 'Phone', status: 'AVAILABLE', purchaseDateOffset: -450, purchaseValueCents: 129900 },
  // Peripherals
  { name: 'Apple Magic Keyboard', assetTag: 'PER-2024-001', category: 'Peripherals', status: 'ASSIGNED', assignedTo: 'mei.lin@northstarstudios.sg', purchaseDateOffset: -150, purchaseValueCents: 19900 },
  { name: 'Logitech MX Master 3S', assetTag: 'PER-2024-002', category: 'Peripherals', status: 'ASSIGNED', assignedTo: 'marcus.lee@northstarstudios.sg', purchaseDateOffset: -300, purchaseValueCents: 14900 },
  // Furniture
  { name: 'Herman Miller Aeron Chair', assetTag: 'FUR-2023-001', category: 'Furniture', status: 'ASSIGNED', assignedTo: 'ava.lim@northstarstudios.sg', purchaseDateOffset: -700, purchaseValueCents: 219900 },
  { name: 'Standing Desk — Electric', assetTag: 'FUR-2024-001', category: 'Furniture', status: 'AVAILABLE', purchaseDateOffset: -30, purchaseValueCents: 79900, notes: 'For next new hire' },
]

// ─────────────────────────────────────────────
// Expense Seed Data
// ─────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  'Travel',
  'Meals',
  'Office Supplies',
  'Software',
  'Client Entertainment',
] as const

interface SeedExpenseClaim {
  employeeEmail: string
  category: string
  amountCents: number
  description: string
  expenseDateOffset: number // days ago
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED'
  reviewNote?: string
  reviewedByEmail?: string
}

const SEED_EXPENSE_CLAIMS: SeedExpenseClaim[] = [
  // Submitted (pending)
  { employeeEmail: 'marcus.lee@northstarstudios.sg', category: 'Software', amountCents: 4900, description: 'JetBrains IntelliJ monthly subscription', expenseDateOffset: -3, status: 'SUBMITTED' },
  { employeeEmail: 'kevin.ng@northstarstudios.sg', category: 'Client Entertainment', amountCents: 18500, description: 'Client lunch at PS.Cafe — Acme Corp renewal', expenseDateOffset: -5, status: 'SUBMITTED' },
  { employeeEmail: 'hannah.goh@northstarstudios.sg', category: 'Travel', amountCents: 4500, description: 'Grab ride to client meeting at Mapletree', expenseDateOffset: -2, status: 'SUBMITTED' },
  // Approved
  { employeeEmail: 'daniel.chen@northstarstudios.sg', category: 'Software', amountCents: 9900, description: 'GitHub Copilot Business annual seat', expenseDateOffset: -15, status: 'APPROVED', reviewedByEmail: 'ava.lim@northstarstudios.sg' },
  { employeeEmail: 'sarah.wong@northstarstudios.sg', category: 'Travel', amountCents: 32000, description: 'Return flight SIN-KUL for Q3 regional meet', expenseDateOffset: -20, status: 'APPROVED', reviewedByEmail: 'ava.lim@northstarstudios.sg' },
  { employeeEmail: 'priya.sharma@northstarstudios.sg', category: 'Office Supplies', amountCents: 8900, description: 'USB-C hub + cables for hot-desking setup', expenseDateOffset: -12, status: 'APPROVED', reviewedByEmail: 'rachel.tan@northstarstudios.sg' },
  // Rejected
  { employeeEmail: 'wei.zhang@northstarstudios.sg', category: 'Software', amountCents: 29900, description: 'Personal Notion annual plan', expenseDateOffset: -25, status: 'REJECTED', reviewedByEmail: 'rachel.tan@northstarstudios.sg', reviewNote: 'Company already provides Notion team workspace — personal plan not reimbursable' },
  { employeeEmail: 'kevin.ng@northstarstudios.sg', category: 'Client Entertainment', amountCents: 45000, description: 'Wine dinner — prospect engagement', expenseDateOffset: -30, status: 'REJECTED', reviewedByEmail: 'sarah.wong@northstarstudios.sg', reviewNote: 'Exceeds per-event entertainment limit of $300. Please seek pre-approval for high-value entertainment.' },
  // Reimbursed
  { employeeEmail: 'rachel.tan@northstarstudios.sg', category: 'Office Supplies', amountCents: 15600, description: 'Printer toner + A4 paper bulk order', expenseDateOffset: -45, status: 'REIMBURSED', reviewedByEmail: 'ava.lim@northstarstudios.sg' },
  { employeeEmail: 'sarah.wong@northstarstudios.sg', category: 'Meals', amountCents: 5800, description: 'Team lunch — Sales Q2 kick-off', expenseDateOffset: -50, status: 'REIMBURSED', reviewedByEmail: 'ava.lim@northstarstudios.sg' },
  { employeeEmail: 'daniel.chen@northstarstudios.sg', category: 'Travel', amountCents: 2800, description: 'MRT top-up for office commute (no receipt)', expenseDateOffset: -55, status: 'REIMBURSED', reviewedByEmail: 'rachel.tan@northstarstudios.sg' },
  { employeeEmail: 'jun.nakamura@northstarstudios.sg', category: 'Software', amountCents: 5900, description: 'Figma individual plan (before team upgrade)', expenseDateOffset: -60, status: 'REIMBURSED', reviewedByEmail: 'rachel.tan@northstarstudios.sg' },
]

// ─────────────────────────────────────────────
// Asset Request Seed Data
// ─────────────────────────────────────────────

interface SeedAssetRequest {
  employeeEmail: string
  category: string
  requestedAssetTag?: string // optional specific asset
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED'
  reviewedByEmail?: string
  reviewNote?: string
  fulfilledAssetTag?: string
  daysAgo: number
}

const SEED_ASSET_REQUESTS: SeedAssetRequest[] = [
  {
    employeeEmail: 'aiden.teo@northstarstudios.sg',
    category: 'Monitor',
    reason: 'Just joined the team — need an external monitor for my workstation. A 27" 4K would be ideal for development work.',
    status: 'PENDING',
    daysAgo: 2,
  },
  {
    employeeEmail: 'mei.lin@northstarstudios.sg',
    category: 'Monitor',
    requestedAssetTag: 'MON-2024-004',
    reason: 'My current 24" monitor is too small for design work — would like to upgrade to the available 27" 4K unit.',
    status: 'FULFILLED',
    reviewedByEmail: 'rachel.tan@northstarstudios.sg',
    fulfilledAssetTag: 'MON-2024-004',
    daysAgo: 10,
  },
  {
    employeeEmail: 'ryan.chua@northstarstudios.sg',
    category: 'Laptop',
    reason: 'Current laptop (personal) is not meeting performance needs for financial modelling. Requesting a company MacBook.',
    status: 'REJECTED',
    reviewedByEmail: 'rachel.tan@northstarstudios.sg',
    reviewNote: 'Finance team laptops are budgeted for Q1 2027 refresh cycle. Please use the shared workstation in the meantime.',
    daysAgo: 15,
  },
]

// ─────────────────────────────────────────────
// Main seed function
// ─────────────────────────────────────────────

export async function seedAssets(
  db: PrismaClient,
  orgId: string,
  employeeIdMap: Map<string, string>
) {
  const now = new Date()

  // 1. Create asset categories
  const categoryIdMap = new Map<string, string>()
  for (const catName of ASSET_CATEGORIES) {
    const existing = await db.assetCategory.findFirst({
      where: { orgId, name: catName },
    })
    if (existing) {
      categoryIdMap.set(catName, existing.id)
    } else {
      const created = await db.assetCategory.create({
        data: { orgId, name: catName },
      })
      categoryIdMap.set(catName, created.id)
    }
  }

  // 2. Create assets
  const assetIdMap = new Map<string, string>() // tag -> id
  for (const seedAsset of SEED_ASSETS) {
    const existing = await db.asset.findFirst({
      where: { orgId, assetTag: seedAsset.assetTag },
    })
    if (existing) {
      assetIdMap.set(seedAsset.assetTag, existing.id)
      continue
    }

    const categoryId = categoryIdMap.get(seedAsset.category)!
    const purchaseDate = new Date(now.getTime() + seedAsset.purchaseDateOffset * 24 * 60 * 60 * 1000)

    const asset = await db.asset.create({
      data: {
        orgId,
        categoryId,
        name: seedAsset.name,
        assetTag: seedAsset.assetTag,
        status: seedAsset.status === 'ASSIGNED' ? 'AVAILABLE' : seedAsset.status, // will update after assignment
        purchaseDate,
        purchaseValueCents: seedAsset.purchaseValueCents,
        notes: seedAsset.notes || null,
        updatedAt: now,
      },
    })
    assetIdMap.set(seedAsset.assetTag, asset.id)
  }

  // 3. Create assignments for ASSIGNED assets
  const rachelId = employeeIdMap.get('rachel.tan@northstarstudios.sg')!
  for (const seedAsset of SEED_ASSETS) {
    if (seedAsset.status !== 'ASSIGNED' || !seedAsset.assignedTo) continue

    const assetId = assetIdMap.get(seedAsset.assetTag)!
    const employeeId = employeeIdMap.get(seedAsset.assignedTo)
    if (!employeeId) continue

    // Check if already assigned
    const existing = await db.assetAssignment.findFirst({
      where: { assetId, orgId, returnedAt: null },
    })
    if (existing) continue

    const assignment = await db.assetAssignment.create({
      data: {
        orgId,
        assetId,
        employeeId,
        assignedById: rachelId,
        conditionAtAssignment: 'New',
        assignedAt: new Date(now.getTime() + seedAsset.purchaseDateOffset * 24 * 60 * 60 * 1000 + 86400000),
      },
    })

    await db.asset.update({
      where: { id: assetId },
      data: { status: 'ASSIGNED', currentAssignmentId: assignment.id },
    })
  }

  // 4. Create asset requests
  for (const seedReq of SEED_ASSET_REQUESTS) {
    const employeeId = employeeIdMap.get(seedReq.employeeEmail)
    if (!employeeId) continue

    const categoryId = categoryIdMap.get(seedReq.category)
    if (!categoryId) continue

    // Skip if already exists (idempotent check by employee + category + reason start)
    const existing = await db.assetRequest.findFirst({
      where: { orgId, employeeId, categoryId, reason: { startsWith: seedReq.reason.slice(0, 30) } },
    })
    if (existing) continue

    const requestedAssetId = seedReq.requestedAssetTag ? assetIdMap.get(seedReq.requestedAssetTag) ?? null : null
    const fulfilledAssetId = seedReq.fulfilledAssetTag ? assetIdMap.get(seedReq.fulfilledAssetTag) ?? null : null
    const reviewedById = seedReq.reviewedByEmail ? employeeIdMap.get(seedReq.reviewedByEmail) ?? null : null

    const requestedAt = new Date(now.getTime() - seedReq.daysAgo * 24 * 60 * 60 * 1000)
    const reviewedAt = reviewedById ? new Date(requestedAt.getTime() + 24 * 60 * 60 * 1000) : null

    await db.assetRequest.create({
      data: {
        orgId,
        employeeId,
        categoryId,
        requestedAssetId: requestedAssetId,
        reason: seedReq.reason,
        status: seedReq.status,
        requestedAt,
        reviewedById,
        reviewedAt,
        reviewNote: seedReq.reviewNote || null,
        fulfilledAssetId,
      },
    })

    // A FULFILLED request implies a real assignment happened — mirror what
    // fulfillAssetRequest() does at runtime so the asset's status/history
    // stays consistent with the request record (not a dangling "fulfilled"
    // pointer to an asset that's still sitting AVAILABLE).
    if (seedReq.status === 'FULFILLED' && fulfilledAssetId && reviewedById) {
      const alreadyAssigned = await db.assetAssignment.findFirst({
        where: { assetId: fulfilledAssetId, orgId, returnedAt: null },
      })
      if (!alreadyAssigned) {
        const assignedAt = reviewedAt ?? requestedAt
        const assignment = await db.assetAssignment.create({
          data: {
            orgId,
            assetId: fulfilledAssetId,
            employeeId,
            assignedById: reviewedById,
            conditionAtAssignment: 'New',
            notes: 'Fulfilled from asset request',
            assignedAt,
          },
        })
        await db.asset.update({
          where: { id: fulfilledAssetId },
          data: { status: 'ASSIGNED', currentAssignmentId: assignment.id },
        })
      }
    }
  }
}

export async function seedExpenses(
  db: PrismaClient,
  orgId: string,
  employeeIdMap: Map<string, string>
) {
  const now = new Date()

  // 1. Create expense categories
  const categoryIdMap = new Map<string, string>()
  for (const catName of EXPENSE_CATEGORIES) {
    const existing = await db.expenseCategory.findFirst({
      where: { orgId, name: catName },
    })
    if (existing) {
      categoryIdMap.set(catName, existing.id)
    } else {
      const created = await db.expenseCategory.create({
        data: { orgId, name: catName },
      })
      categoryIdMap.set(catName, created.id)
    }
  }

  // 2. Create expense claims
  for (const seedClaim of SEED_EXPENSE_CLAIMS) {
    const employeeId = employeeIdMap.get(seedClaim.employeeEmail)
    if (!employeeId) continue

    const categoryId = categoryIdMap.get(seedClaim.category)
    if (!categoryId) continue

    // Idempotent: skip if description + employee combo exists
    const existing = await db.expenseClaim.findFirst({
      where: { orgId, employeeId, description: seedClaim.description },
    })
    if (existing) continue

    const expenseDate = new Date(now.getTime() + seedClaim.expenseDateOffset * 24 * 60 * 60 * 1000)
    const submittedAt = new Date(expenseDate.getTime() + 24 * 60 * 60 * 1000)
    const reviewedById = seedClaim.reviewedByEmail ? employeeIdMap.get(seedClaim.reviewedByEmail) ?? null : null
    const reviewedAt = reviewedById ? new Date(submittedAt.getTime() + 2 * 24 * 60 * 60 * 1000) : null
    const reimbursedAt = seedClaim.status === 'REIMBURSED' && reviewedAt
      ? new Date(reviewedAt.getTime() + 5 * 24 * 60 * 60 * 1000)
      : null

    await db.expenseClaim.create({
      data: {
        orgId,
        employeeId,
        categoryId,
        amountCents: seedClaim.amountCents,
        currency: 'SGD',
        description: seedClaim.description,
        expenseDate,
        status: seedClaim.status,
        receiptDocumentId: null,
        submittedAt,
        reviewedById,
        reviewedAt,
        reviewNotes: seedClaim.reviewNote || null,
        reimbursedAt,
        updatedAt: now,
      },
    })
  }
}
