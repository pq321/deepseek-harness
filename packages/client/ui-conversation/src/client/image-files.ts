import type { ImageMediaType } from '@deepseek-ai/dsh-attachment'

/**
 * Resolve a supported raster type from browser metadata. Windows drag/drop
 * sometimes exposes an empty or generic MIME type, so only those two cases
 * fall back to the filename extension. A conflicting declared MIME remains a
 * file reference instead of trusting a potentially misleading suffix.
 */
export function resolveImageMediaType(file: Pick<File, 'name' | 'type'>): ImageMediaType | null {
  const declared = file.type.trim().toLowerCase()
  switch (declared) {
    case 'image/png':
    case 'image/jpeg':
    case 'image/webp':
    case 'image/gif':
      return declared
  }
  if (declared !== '' && declared !== 'application/octet-stream') return null
  const extension = /\.([^.]+)$/.exec(file.name)?.[1]?.toLowerCase()
  switch (extension) {
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'gif': return 'image/gif'
    default: return null
  }
}
