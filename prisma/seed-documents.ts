/**
 * HR Daddy Demo Seed - Documents data.
 * Creates categories and documents across employees, with some expiring soon.
 */
import { PrismaClient } from '@prisma/client'

export async function seedDocuments(
  db: PrismaClient,
  orgId: string,
  employeeIdMap: Map<string, string>
) {
  // Check if already seeded
  const existingCats = await db.documentCategory.count({ where: { orgId } })
  if (existingCats > 0) return

  // Create categories
  const categories = [
    { name: 'Identity Documents', isSensitive: true },
    { name: 'Work Permits', isSensitive: true },
    { name: 'Certifications', isSensitive: false },
    { name: 'Employment Contracts', isSensitive: true },
    { name: 'Training Records', isSensitive: false },
  ]

  const catMap = new Map<string, string>()
  for (const cat of categories) {
    const c = await db.documentCategory.create({
      data: { orgId, name: cat.name, isSensitive: cat.isSensitive },
    })
    catMap.set(cat.name, c.id)
  }

  const avaId = employeeIdMap.get('ava.lim@northstarstudios.sg')!
  const junId = employeeIdMap.get('jun.nakamura@northstarstudios.sg')!
  const priyaId = employeeIdMap.get('priya.sharma@northstarstudios.sg')!
  const marcusId = employeeIdMap.get('marcus.lee@northstarstudios.sg')!
  const weiId = employeeIdMap.get('wei.zhang@northstarstudios.sg')!

  const now = new Date()
  const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
  const in25Days = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000)
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const in365Days = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

  const docs = [
    // Jun's work permit expiring in 10 days (URGENT)
    {
      employeeId: junId,
      categoryId: catMap.get('Work Permits')!,
      fileName: 'EP_Jun_Nakamura.pdf',
      expiresAt: in10Days,
    },
    // Priya's S-Pass expiring in 25 days
    {
      employeeId: priyaId,
      categoryId: catMap.get('Work Permits')!,
      fileName: 'SP_Priya_Sharma.pdf',
      expiresAt: in25Days,
    },
    // Marcus certification (not expiring soon)
    {
      employeeId: marcusId,
      categoryId: catMap.get('Certifications')!,
      fileName: 'AWS_SA_Certificate.pdf',
      expiresAt: in365Days,
    },
    // Wei employment contract (no expiry)
    {
      employeeId: weiId,
      categoryId: catMap.get('Employment Contracts')!,
      fileName: 'Employment_Contract_Wei_Zhang.pdf',
      expiresAt: null,
    },
    // Ava identity doc (no expiry)
    {
      employeeId: avaId,
      categoryId: catMap.get('Identity Documents')!,
      fileName: 'NRIC_Ava_Lim.pdf',
      expiresAt: in90Days,
    },
    // Jun training record
    {
      employeeId: junId,
      categoryId: catMap.get('Training Records')!,
      fileName: 'Design_Masterclass_Cert.pdf',
      expiresAt: null,
    },
  ]

  for (const doc of docs) {
    await db.employeeDocument.create({
      data: {
        orgId,
        employeeId: doc.employeeId,
        categoryId: doc.categoryId,
        fileName: doc.fileName,
        fileKey: `org/${orgId}/employee/${doc.employeeId}/${crypto.randomUUID()}`,
        fileSize: 50000 + Math.floor(Math.random() * 200000),
        mimeType: 'application/pdf',
        expiresAt: doc.expiresAt,
        uploadedById: avaId, // HR uploaded all
      },
    })
  }
}
