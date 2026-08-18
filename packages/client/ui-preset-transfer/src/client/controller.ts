import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client'
import type { PresetImportPreview, PresetTransferRow } from '@deepseek-ai/dsh-preset-transfer/types'

/** Snapshot consumed by the preset-transfer settings section. */
export interface PresetTransferState {
  readonly status: 'cold' | 'loading' | 'ready' | 'error'
  readonly rows: readonly PresetTransferRow[]
  readonly error: string | null
  readonly file: File | null
  readonly agentPreset: string
  readonly busy: 'import' | 'export' | null
  readonly message: string | null
}

/** Narrow generated Remote face used by the controller. */
export interface PresetTransferRemote {
  readonly list: ClientRemote['presetTransfer']['list']
  readonly exportPreset: ClientRemote['presetTransfer']['exportPreset']
  readonly previewImport: ClientRemote['presetTransfer']['previewImport']
  readonly importPreset: ClientRemote['presetTransfer']['importPreset']
}

/** Localized client messages used for validation and import confirmation. */
export interface PresetTransferCopy {
  readonly chooseFile: string
  readonly idInvalid: string
  readonly noWarnings: string
  readonly warning: Readonly<Record<PresetImportPreview['warnings'][number], string>>
  readonly conflict: (id: string) => string
  readonly confirm: (fileCount: number, warnings: string, trustNotice: string) => string
  readonly trustNotice: string
  readonly imported: string
}

const INITIAL: PresetTransferState = {
  status: 'cold', rows: [], error: null, file: null, agentPreset: '', busy: null, message: null,
}

function encode(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < view.length; offset += chunk) {
    binary += String.fromCharCode(...view.subarray(offset, offset + chunk))
  }
  return btoa(binary)
}

function download(base64: string, fileName: string, mediaType: string): void {
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: mediaType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** State owner for the settings contribution; no component talks to Remote directly. */
export class PresetTransferController {
  private snapshot: PresetTransferState = INITIAL

  constructor(private readonly remote: PresetTransferRemote) {}

  /** Observable state source bound by the slot renderer. */
  readonly store: SnapshotStore<PresetTransferState> = createSnapshotStore(INITIAL)

  /**
   * Set or clear the selected archive file.
   * @param file - selected archive or null when the selection is cleared.
   */
  setFile(file: File | null): void { this.update({ file, message: null, error: null }) }
  /**
   * Set the destination identifier for an import.
   * @param agentPreset - local identifier entered by the user.
   */
  setAgentPreset(agentPreset: string): void { this.update({ agentPreset, message: null, error: null }) }

  /** Refresh the path-free roster shown in the settings section. */
  async load(): Promise<void> {
    if (this.snapshot.status === 'loading') return
    this.update({ status: 'loading', error: null })
    try {
      const response = await this.remote.list()
      if (!response.ok) throw new Error(response.error.message)
      this.update({ status: 'ready', rows: response.value.rows, error: null })
    } catch (error) {
      this.update({ status: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * Export one user preset and trigger a browser download.
   * @param id - user preset identifier.
   */
  async exportPreset(id: string): Promise<void> {
    if (this.snapshot.busy !== null) return
    this.update({ busy: 'export', error: null, message: null })
    try {
      const response = await this.remote.exportPreset(id)
      if (!response.ok) throw new Error(response.error.message)
      download(response.value.archiveBase64, response.value.fileName, response.value.mediaType)
    } catch (error) {
      this.update({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      this.update({ busy: null })
    }
  }

  /**
   * Preview, confirm, and install the selected archive.
   * @param confirm - callback that accepts or rejects the localized review text.
   * @param copy - localized validation, warning, and success messages.
   */
  async importPreset(confirm: (preview: string) => boolean, copy: PresetTransferCopy): Promise<void> {
    const { file, agentPreset } = this.snapshot
    if (this.snapshot.busy !== null) return
    if (file === null) {
      this.update({ error: copy.chooseFile })
      return
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(agentPreset)) {
      this.update({ error: copy.idInvalid })
      return
    }
    this.update({ busy: 'import', error: null, message: null })
    try {
      const archiveBase64 = encode(await file.arrayBuffer())
      const request = { agentPreset, archiveBase64 }
      const preview = await this.remote.previewImport(request)
      if (!preview.ok) throw new Error(preview.error.message)
      const warnings = preview.value.warnings.length === 0
        ? copy.noWarnings
        : preview.value.warnings.map(warning => copy.warning[warning]).join('\n')
      if (preview.value.conflict) throw new Error(copy.conflict(agentPreset))
      if (!confirm(copy.confirm(preview.value.fileCount, warnings, copy.trustNotice))) return
      const response = await this.remote.importPreset(request)
      if (!response.ok) throw new Error(response.error.message)
      this.update({ message: copy.imported, file: null, agentPreset: '' })
      await this.load()
    } catch (error) {
      this.update({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      this.update({ busy: null })
    }
  }

  private update(patch: Partial<PresetTransferState>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.store.set(this.snapshot)
  }
}
