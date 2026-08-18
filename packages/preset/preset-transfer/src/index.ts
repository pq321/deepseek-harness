/** Safe portable archive transfer for user-authored Agent Presets. */

import { Buffer } from 'node:buffer'
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { AgentPresets, COMPOSITION_FILE, scanRoot, writableRoot } from '@deepseek-ai/dsh-agent-presets'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  PresetArchiveRequest, PresetExportValue, PresetImportPreview, PresetImportValue,
  PresetTransferListValue, PresetTransferRow,
} from './types.ts'

export type * from './types.ts'

const FORMAT = 'dsh-preset'
const VERSION = 1
const MIME = 'application/vnd.dsh.preset+zip' as const
const MAX_COMPRESSED = 16 * 1024 * 1024
const MAX_UNCOMPRESSED = 32 * 1024 * 1024
const MAX_FILE = 12 * 1024 * 1024
const MAX_FILES = 512
const PRESET_ID = /^[a-z0-9][a-z0-9-]*$/
const IGNORED = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])
const TEXT_EXTENSIONS = new Set([
  '.json', '.jsonc', '.md', '.txt', '.yaml', '.yml', '.toml', '.js', '.jsx', '.ts', '.tsx',
  '.mjs', '.cjs', '.py', '.sh', '.ps1', '.html', '.css',
])

declare module '@deepseek-ai/cordis' {
  interface Context { presetTransfer: PresetTransferService }
}

function safePath(value: string): boolean {
  if (value === '' || value.includes('\0') || value.includes('\\') || value.startsWith('/') || /^[a-zA-Z]:/.test(value)) return false
  return value.split('/').every(part => part !== '' && part !== '.' && part !== '..')
}

function warningsOf(files: Readonly<Record<string, Uint8Array>>): PresetImportPreview['warnings'] {
  let absolute = false
  let secret = false
  for (const [name, data] of Object.entries(files)) {
    if (!TEXT_EXTENSIONS.has(extname(name).toLowerCase()) || data.length > 1024 * 1024 || data.includes(0)) continue
    const text = strFromU8(data)
    absolute ||= /(?:^|[\s"'(:=])(?:\/Users\/|\/home\/)/m.test(text)
      || /[A-Za-z]:[\\/]/.test(text)
      || /\\\\[^/\s]+[\\/]/.test(text)
    secret ||= /(?:api[_-]?key|secret|token)\s*[:=]\s*["']?[^\s"']{12,}|\bsk-[a-z0-9_-]{16,}/i.test(text)
  }
  return [
    ...(absolute ? ['absolute-paths' as const] : []),
    ...(secret ? ['possible-secrets' as const] : []),
  ]
}

async function collectFiles(root: string): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {}
  let count = 0
  let total = 0
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (IGNORED.has(entry.name)) continue
      const full = join(directory, entry.name)
      const name = relative(root, full).split(sep).join('/')
      if (!safePath(name)) throw new Error(`preset contains an unsafe path: ${name}`)
      const info = await lstat(full)
      if (info.isSymbolicLink()) throw new Error(`preset contains a symbolic link: ${name}`)
      if (info.isDirectory()) {
        await visit(full)
        continue
      }
      if (!info.isFile()) throw new Error(`preset contains an unsupported filesystem entry: ${name}`)
      if (++count > MAX_FILES) throw new Error(`preset contains more than ${MAX_FILES} files`)
      if (info.size > MAX_FILE) throw new Error(`preset file is too large: ${name}`)
      total += info.size
      if (total > MAX_UNCOMPRESSED) throw new Error('preset is larger than 32 MB when expanded')
      files[`preset/${name}`] = new Uint8Array(await readFile(full))
    }
  }
  await visit(root)
  return files
}

interface ParsedArchive {
  readonly manifest: { id: string; name?: string; description?: string; sourceDshVersion?: string }
  readonly files: Record<string, Uint8Array>
  readonly warnings: PresetImportPreview['warnings']
}

function parseArchive(data: Uint8Array): ParsedArchive {
  if (data.length > MAX_COMPRESSED) throw new Error('preset package is larger than 16 MB')
  let count = 0
  let total = 0
  const archive = unzipSync(data, { filter: (file) => {
    if (!safePath(file.name)) throw new Error(`preset package contains an unsafe path: ${file.name}`)
    if (++count > MAX_FILES + 1) throw new Error(`preset package contains more than ${MAX_FILES} files`)
    if (file.originalSize > MAX_FILE) throw new Error(`preset package contains an oversized file: ${file.name}`)
    total += file.originalSize
    if (total > MAX_UNCOMPRESSED) throw new Error('expanded preset package is larger than 32 MB')
    return true
  } })
  const manifestBytes = archive['manifest.json']
  if (manifestBytes === undefined) throw new Error('preset package has no manifest.json')
  let raw: unknown
  try { raw = JSON.parse(strFromU8(manifestBytes)) as unknown } catch { throw new Error('preset package manifest is not valid JSON') }
  if (typeof raw !== 'object' || raw === null) throw new Error('preset package manifest is invalid')
  const manifest = raw as Record<string, unknown>
  if (manifest.format !== FORMAT || manifest.version !== VERSION || typeof manifest.id !== 'string' || !PRESET_ID.test(manifest.id)) {
    throw new Error('preset package manifest is unsupported or invalid')
  }
  for (const [key, max] of [['name', 160], ['description', 4000], ['sourceDshVersion', 64] ] as const) {
    if (manifest[key] !== undefined && (typeof manifest[key] !== 'string' || manifest[key].length > max)) {
      throw new Error(`preset package manifest has an invalid ${key}`)
    }
  }
  const files: Record<string, Uint8Array> = {}
  for (const [name, bytes] of Object.entries(archive)) {
    if (name === 'manifest.json') continue
    if (!name.startsWith('preset/') || name === 'preset/') throw new Error(`unexpected file outside preset/: ${name}`)
    const relativeName = name.slice('preset/'.length)
    if (!safePath(relativeName)) throw new Error(`preset package contains an unsafe path: ${name}`)
    if (!IGNORED.has(relativeName.split('/').at(-1) ?? '')) files[relativeName] = bytes
  }
  if (files[COMPOSITION_FILE] === undefined) throw new Error(`preset package is missing ${COMPOSITION_FILE}`)
  return {
    manifest: {
      id: manifest.id,
      ...(typeof manifest.name === 'string' ? { name: manifest.name } : {}),
      ...(typeof manifest.description === 'string' ? { description: manifest.description } : {}),
      ...(typeof manifest.sourceDshVersion === 'string' ? { sourceDshVersion: manifest.sourceDshVersion } : {}),
    },
    files,
    warnings: warningsOf(files),
  }
}

function decodeArchiveBase64(value: string): Uint8Array {
  const maxEncodedLength = Math.ceil(MAX_COMPRESSED / 3) * 4
  if (value.length === 0 || value.length > maxEncodedLength
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('preset package payload is not valid base64')
  }
  const decoded = Buffer.from(value, 'base64')
  if (decoded.toString('base64') !== value) throw new Error('preset package payload is not valid base64')
  return decoded
}

function rowOf(row: Awaited<ReturnType<AgentPresets['list']>>[number]): PresetTransferRow {
  return {
    id: row.id,
    trust: row.trust,
    ...(row.name === undefined ? {} : { name: row.name }),
    ...(row.description === undefined ? {} : { description: row.description }),
    ...(row.broken === undefined ? {} : { broken: row.broken }),
  }
}

/** Host Remote for explicit, user-authored preset package transfer. */
export class PresetTransferService extends TypertRemoteService {
  static inject = ['agentPresets']

  constructor(ctx: Context) {
    super(ctx, 'presetTransfer')
  }

  /**
   * List path-free preset metadata for the settings surface.
   * @returns the current path-free user and system preset rows.
   */
  @Remote('list')
  async list(): Promise<PresetTransferListValue> {
    return { rows: (await this.ctx.agentPresets.list()).map(rowOf) }
  }

  /**
   * Export one user-authored preset as a bounded .dshpreset archive.
   * @param agentPreset - identifier of the user-authored preset to export.
   * @returns the archive filename, media type, and base64 payload.
   */
  @Remote('exportPreset')
  async exportPreset(agentPreset: string): Promise<PresetExportValue> {
    const preset = await this.ctx.agentPresets.resolve(agentPreset)
    if (preset.trust !== 'user') throw new Error('built-in presets cannot be exported; duplicate one first')
    if (preset.broken !== undefined) throw new Error(`preset cannot be exported: ${preset.broken}`)
    const files = await collectFiles(dirname(preset.path))
    const manifest = {
      format: FORMAT,
      version: VERSION,
      id: preset.id,
      ...(preset.name === undefined ? {} : { name: preset.name }),
      ...(preset.description === undefined ? {} : { description: preset.description }),
      sourceDshVersion: '0.1.0-rc.5',
      exportedAt: new Date().toISOString(),
    }
    const archive = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest, null, 2)), ...files }, { level: 6 })
    if (archive.length > MAX_COMPRESSED) throw new Error('compressed preset package is larger than 16 MB')
    return { fileName: `${preset.id}.dshpreset`, mediaType: MIME, archiveBase64: Buffer.from(archive).toString('base64') }
  }

  /**
   * Validate an archive and return the user-facing review data.
   * @param request - local destination identifier and base64 archive payload.
   * @returns validated metadata and warnings without installing the archive.
   */
  @Remote('previewImport')
  async previewImport(request: PresetArchiveRequest): Promise<PresetImportPreview> {
    return await this.preview(request)
  }

  /**
   * Install a reviewed archive into the first writable preset root.
   * @param request - local destination identifier and base64 archive payload.
   * @returns the validated metadata after the atomic installation succeeds.
   */
  @Remote('importPreset')
  async importPreset(request: PresetArchiveRequest): Promise<PresetImportValue> {
    const parsed = parseArchive(decodeArchiveBase64(request.archiveBase64))
    const preview = await this.previewParsed(request.agentPreset, parsed)
    if (preview.conflict) throw new Error(`a preset named "${request.agentPreset}" already exists`)
    const root = writableRoot(this.ctx.agentPresets.roots)
    const target = join(root, request.agentPreset)
    let container: string | undefined
    try {
      await mkdir(root, { recursive: true })
      try { await stat(target); throw new Error(`a preset named "${request.agentPreset}" already exists`) } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      container = await mkdtemp(join(root, '.dshpreset-import-'))
      const imported = join(container, request.agentPreset)
      await mkdir(imported, { recursive: true })
      for (const [name, bytes] of Object.entries(parsed.files)) {
        const destination = resolve(imported, name)
        if (!destination.startsWith(`${resolve(imported)}${sep}`)) throw new Error(`unsafe imported path: ${name}`)
        await mkdir(dirname(destination), { recursive: true })
        await writeFile(destination, bytes, { mode: 0o600 })
      }
      const scanned = await scanRoot({ path: container, trust: 'user' })
      const candidate = scanned.find(row => row.id === request.agentPreset)
      if (candidate === undefined || candidate.broken !== undefined) throw new Error(candidate?.broken ?? 'imported package did not produce a preset')
      await rename(imported, target)
      return { ...preview, conflict: false, installed: true }
    } finally {
      if (container !== undefined) await rm(container, { recursive: true, force: true }).catch(() => {})
    }
  }

  private async preview(request: PresetArchiveRequest): Promise<PresetImportPreview> {
    const parsed = parseArchive(decodeArchiveBase64(request.archiveBase64))
    return await this.previewParsed(request.agentPreset, parsed)
  }

  private async previewParsed(agentPreset: string, parsed: ParsedArchive): Promise<PresetImportPreview> {
    if (!PRESET_ID.test(agentPreset)) throw new Error('preset id must use lowercase letters, digits, and hyphens')
    const rows = await this.ctx.agentPresets.list()
    return {
      agentPreset,
      sourceAgentPreset: parsed.manifest.id,
      ...(parsed.manifest.name === undefined ? {} : { name: parsed.manifest.name }),
      ...(parsed.manifest.description === undefined ? {} : { description: parsed.manifest.description }),
      fileCount: Object.keys(parsed.files).length,
      warnings: [
        ...parsed.warnings,
        ...(parsed.manifest.sourceDshVersion !== undefined && parsed.manifest.sourceDshVersion !== '0.1.0-rc.5'
          ? ['version-mismatch' as const]
          : []),
      ],
      conflict: rows.some(row => row.id === agentPreset),
    }
  }
}

export default PresetTransferService
