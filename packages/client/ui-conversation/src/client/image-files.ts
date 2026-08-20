import type { ImageMediaType } from '@deepseek-ai/dsh-attachment'

/**
 * Resolve a supported raster type from browser metadata. Windows drag/drop
 * and clipboard transfers often expose an empty or generic MIME type, so only
 * those two cases fall back to the filename extension. A conflicting declared
 * MIME yields null (the file becomes a metadata-only reference) instead of
 * trusting a potentially misleading suffix.
 * @param file - browser file metadata (name and declared MIME type).
 * @returns the resolved image media type, or null when the file is not a
 * supported raster image.
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
