/** Client-safe vocabulary for portable Agent Preset packages. */

/** Path-free preset metadata returned to the browser. */
export interface PresetTransferRow {
  readonly id: string
  readonly trust: 'system' | 'user'
  readonly name?: string
  readonly description?: string
  readonly broken?: string
}

/** Metadata rows shown by the optional preset-transfer settings section. */
export interface PresetTransferListValue {
  readonly rows: readonly PresetTransferRow[]
}

/** Base64 archive returned by a user-preset export. */
export interface PresetExportValue {
  readonly fileName: string
  readonly mediaType: 'application/vnd.dsh.preset+zip'
  readonly archiveBase64: string
}

/** Archive bytes and the local identifier selected for an import. */
export interface PresetArchiveRequest {
  readonly agentPreset: string
  readonly archiveBase64: string
}

/** Validated archive metadata shown before installation. */
export interface PresetImportPreview {
  readonly agentPreset: string
  readonly sourceAgentPreset: string
  readonly name?: string
  readonly description?: string
  readonly fileCount: number
  readonly warnings: readonly ('absolute-paths' | 'possible-secrets' | 'version-mismatch')[]
  readonly conflict: boolean
}

/** Successful installation result, including the reviewed metadata. */
export interface PresetImportValue extends PresetImportPreview {
  readonly installed: true
}
