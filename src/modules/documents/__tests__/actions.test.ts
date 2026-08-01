import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetOrgContext = vi.fn()
const mockRequirePermission = vi.fn()
const mockDbAs = vi.fn()
const mockGetStorage = vi.fn()
const mockWriteAudit = vi.fn()
const mockStorage = {
  upload: vi.fn(),
  delete: vi.fn(),
  getSignedUrl: vi.fn(),
  exists: vi.fn(),
}

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/modules/register', () => ({}))

vi.mock('@/core/auth', () => ({
  getOrgContext: (...args: unknown[]) => mockGetOrgContext(...args),
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

vi.mock('@/core/db', () => ({
  dbAs: (...args: unknown[]) => mockDbAs(...args),
}))

vi.mock('@/core/storage', () => ({
  getStorage: (...args: unknown[]) => mockGetStorage(...args),
  buildStorageKey: () => 'storage-key',
}))

vi.mock('@/core/audit', () => ({
  writeAudit: (...args: unknown[]) => mockWriteAudit(...args),
}))

import { replaceDocument, uploadDocument } from '@/modules/documents/actions'

const employeeId = 'c123456789012345678901234'
const categoryId = 'c123456789012345678901235'
const documentId = 'c123456789012345678901236'
const pdf = Buffer.from('%PDF')

function uploadMetadata(overrides: Record<string, unknown> = {}) {
  return {
    employeeId,
    categoryId,
    fileName: 'test.pdf',
    mimeType: 'application/pdf',
    fileSize: pdf.length,
    expiresAt: '',
    ...overrides,
  }
}

function replaceMetadata(overrides: Record<string, unknown> = {}) {
  return {
    documentId,
    fileName: 'test.pdf',
    mimeType: 'application/pdf',
    fileSize: pdf.length,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetOrgContext.mockResolvedValue({ org: { id: 'org-1' } })
  mockRequirePermission.mockResolvedValue({ userId: 'user-1' })
  mockGetStorage.mockResolvedValue(mockStorage)
  mockStorage.upload.mockResolvedValue(undefined)
  mockStorage.delete.mockResolvedValue(undefined)
  mockWriteAudit.mockResolvedValue(undefined)

  const transaction = {
    employee: {
      findFirst: vi.fn().mockResolvedValue({ id: employeeId }),
      findUnique: vi.fn().mockResolvedValue({ id: employeeId }),
    },
    documentCategory: {
      findFirst: vi.fn().mockResolvedValue({ id: categoryId, isSensitive: false }),
    },
    employeeDocument: {
      create: vi.fn().mockResolvedValue({ id: 'document-1' }),
      findFirst: vi.fn().mockResolvedValue({
        id: documentId,
        fileKey: 'old-storage-key',
        fileName: 'old.pdf',
        employeeId,
        isArchived: false,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  }
  mockDbAs.mockImplementation(async (_userId: unknown, callback: (tx: unknown) => unknown) =>
    callback(transaction)
  )
})

describe('document file validation', () => {
  it('accepts valid PDF bytes and uploads them', async () => {
    const result = await uploadDocument('acme', uploadMetadata(), pdf)

    expect(result).toEqual({ success: true, data: { id: 'document-1' } })
    expect(mockStorage.upload).toHaveBeenCalledOnce()
  })

  it('rejects content whose declared MIME type does not match', async () => {
    const result = await uploadDocument(
      'acme',
      uploadMetadata({ mimeType: 'image/png' }),
      pdf
    )

    expect(result).toEqual({
      success: false,
      error: 'File content does not match its declared type',
    })
    expect(mockDbAs).not.toHaveBeenCalled()
    expect(mockGetStorage).not.toHaveBeenCalled()
  })

  it.each([
    ['shorter', pdf.length + 1],
    ['longer', pdf.length - 1],
  ])('rejects a buffer that is %s than declared', async (_description, fileSize) => {
    const result = await uploadDocument('acme', uploadMetadata({ fileSize }), pdf)

    expect(result).toEqual({
      success: false,
      error: 'File size does not match its declared size',
    })
    expect(mockDbAs).not.toHaveBeenCalled()
    expect(mockGetStorage).not.toHaveBeenCalled()
  })

  it('applies the same content validation before replacing a document', async () => {
    const result = await replaceDocument(
      'acme',
      replaceMetadata({ mimeType: 'image/png' }),
      pdf
    )

    expect(result).toEqual({
      success: false,
      error: 'File content does not match its declared type',
    })
    expect(mockDbAs).not.toHaveBeenCalled()
    expect(mockGetStorage).not.toHaveBeenCalled()
  })
})
