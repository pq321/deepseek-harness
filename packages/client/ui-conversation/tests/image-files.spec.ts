import { describe, expect, it } from 'vitest'
import { resolveImageMediaType } from '../src/client/image-files.ts'

describe('resolveImageMediaType', () => {
  it('trusts a supported declared MIME type', () => {
    expect(resolveImageMediaType({ name: 'a.png', type: 'image/png' })).toBe('image/png')
    expect(resolveImageMediaType({ name: 'a.jpg', type: 'image/jpeg' })).toBe('image/jpeg')
    expect(resolveImageMediaType({ name: 'a.webp', type: 'image/webp' })).toBe('image/webp')
    expect(resolveImageMediaType({ name: 'a.gif', type: 'image/gif' })).toBe('image/gif')
  })

  it('falls back to the extension for an empty or generic declared type', () => {
    // Windows drag/drop and clipboard transfers expose no usable MIME.
    expect(resolveImageMediaType({ name: 'photo.png', type: '' })).toBe('image/png')
    expect(resolveImageMediaType({ name: 'photo.jpg', type: 'application/octet-stream' })).toBe('image/jpeg')
    expect(resolveImageMediaType({ name: 'clip.jpeg', type: ' ' })).toBe('image/jpeg')
  })

  it('keeps a conflicting declared MIME as a non-image', () => {
    // A declared image/svg+xml with a .png suffix must not upgrade to PNG.
    expect(resolveImageMediaType({ name: 'icon.png', type: 'image/svg+xml' })).toBeNull()
  })

  it('rejects unknown extensions and names without one', () => {
    expect(resolveImageMediaType({ name: 'doc.pdf', type: '' })).toBeNull()
    expect(resolveImageMediaType({ name: 'noext', type: 'application/octet-stream' })).toBeNull()
  })
})
