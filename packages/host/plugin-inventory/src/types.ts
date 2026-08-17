import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable Loader-tree identity of one configured plugin entry. */
export type PluginEntryId = Branded<'PluginEntryId'>

/** Direct dependency name from the active profile manifest. */
export type PluginPackageName = Branded<'PluginPackageName'>

/** Lifecycle state of an entry's root Fiber, or null when it has no live root Fiber. */
export type PluginFiberPhase =
  | 'pending'
  | 'loading'
  | 'active'
  | 'failed'
  | 'unloading'
  | null

/** Provenance of one installed profile dependency. */
export type PluginPackageSource = 'registry' | 'github' | 'local'

/** Provenance of one configured runtime entry. */
export type PluginRuntimeOrigin = 'native' | 'builtin' | 'external' | 'local'

/** Why a runtime entry cannot be toggled from the current management surface. */
export type PluginToggleBlockedReason = 'control-plane' | 'tree-carrier'

/** One dependency declared directly by the active profile. */
export interface PluginInstalledPackage {
  readonly packageName: PluginPackageName
  readonly requestedSpec: string
  readonly installedVersion: string | null
  readonly source: PluginPackageSource
  readonly bundle: boolean
  readonly githubUrl?: string
  readonly localPath?: string
  readonly updateSupported: boolean
}

/** One non-group Loader entry exposed to trusted clients. */
export interface PluginInventoryEntry {
  readonly entryId: PluginEntryId
  /** Exact module specifier imported by the Loader entry. */
  readonly moduleName: string
  /** Effective Loader enablement, including disabled ancestor groups. */
  readonly enabled: boolean
  readonly fiberPhase: PluginFiberPhase
  readonly origin: PluginRuntimeOrigin
  readonly packageName?: string
  readonly packageVersion?: string
  readonly githubUrl?: string
  readonly localPath?: string
  readonly canToggle: boolean
  readonly toggleBlockedReason?: PluginToggleBlockedReason
}

/** Point-in-time inventory returned by the plugin inventory Remote. */
export interface PluginInventorySnapshot {
  readonly packages: readonly PluginInstalledPackage[]
  readonly entries: readonly PluginInventoryEntry[]
}

/** Result of one persisted live enablement transition. */
export interface PluginEnablementResult {
  readonly entry: PluginInventoryEntry
}

/** Result of checking and, when available, installing one package update. */
export interface PluginUpdateResult {
  readonly packageName: PluginPackageName
  readonly previousVersion: string | null
  readonly installedVersion: string | null
  readonly latestVersion?: string
  readonly updated: boolean
  readonly restartRequired: boolean
}
