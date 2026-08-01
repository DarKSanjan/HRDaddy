export type FileSignatureFamily =
  | 'pdf'
  | 'png'
  | 'jpeg'
  | 'webp'
  | 'ole'
  | 'ooxml-zip'

export interface DetectedFileSignature {
  family: FileSignatureFamily | null
  mimeType: string | null
}

const MIME_TYPE_FAMILIES: Record<string, FileSignatureFamily> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
  'application/msword': 'ole',
  'application/vnd.ms-excel': 'ole',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'ooxml-zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'ooxml-zip',
}

export function fileSignatureFamilyForMimeType(
  mimeType: string
): FileSignatureFamily | null {
  return MIME_TYPE_FAMILIES[mimeType] ?? null
}

export function detectFileSignature(
  buffer: Buffer | Uint8Array
): DetectedFileSignature {
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((byte, index) => buffer[offset + index] === byte)

  if (startsWith([0x25, 0x50, 0x44, 0x46])) {
    return { family: 'pdf', mimeType: 'application/pdf' }
  }

  if (startsWith([0x89, 0x50, 0x4e, 0x47])) {
    return { family: 'png', mimeType: 'image/png' }
  }

  if (startsWith([0xff, 0xd8, 0xff])) {
    return { family: 'jpeg', mimeType: 'image/jpeg' }
  }

  if (
    startsWith([0x52, 0x49, 0x46, 0x46]) &&
    startsWith([0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { family: 'webp', mimeType: 'image/webp' }
  }

  if (startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return { family: 'ole', mimeType: null }
  }

  if (startsWith([0x50, 0x4b, 0x03, 0x04])) {
    return { family: 'ooxml-zip', mimeType: null }
  }

  return { family: null, mimeType: null }
}
