import { describe, expect, it } from 'vitest'
import {
  detectFileSignature,
  fileSignatureFamilyForMimeType,
} from '@/core/documents/file-signature'

describe('detectFileSignature', () => {
  it.each([
    ['pdf', Buffer.from('%PDF')],
    ['png', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
    ['jpeg', Buffer.from([0xff, 0xd8, 0xff])],
    ['webp', Buffer.from('RIFF....WEBP')],
    ['ole', Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
    ['ooxml-zip', Buffer.from([0x50, 0x4b, 0x03, 0x04])],
  ])('detects the %s family', (family, buffer) => {
    expect(detectFileSignature(buffer)).toMatchObject({ family })
  })

  it('returns no family for unknown content', () => {
    expect(detectFileSignature(Buffer.from('not a document'))).toEqual({
      family: null,
      mimeType: null,
    })
  })

  it('maps every allowed MIME type to its signature family', () => {
    expect(fileSignatureFamilyForMimeType('application/pdf')).toBe('pdf')
    expect(fileSignatureFamilyForMimeType('image/png')).toBe('png')
    expect(fileSignatureFamilyForMimeType('image/jpeg')).toBe('jpeg')
    expect(fileSignatureFamilyForMimeType('image/webp')).toBe('webp')
    expect(fileSignatureFamilyForMimeType('application/msword')).toBe('ole')
    expect(fileSignatureFamilyForMimeType('application/vnd.ms-excel')).toBe('ole')
    expect(
      fileSignatureFamilyForMimeType(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe('ooxml-zip')
    expect(
      fileSignatureFamilyForMimeType(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    ).toBe('ooxml-zip')
  })
})
