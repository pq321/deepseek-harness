/** Profile package inventory, updates, and live Cordis Loader entry management. */

import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context, FiberState } from '@deepseek-ai/cordis'
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import {
  readProfileManifest,
  writeProfileManifest,
  type ProfileManifest,
} from '@deepseek-ai/dsh-app-boot'
import type { SubprocessOutcome } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-subprocess'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  PluginEnablementResult,
  PluginEntryId,
  PluginFiberPhase,
  PluginInstalledPackage,
  PluginInventoryEntry,
  PluginInventorySnapshot,
  PluginPackageName,
  PluginPackageSource,
  PluginRuntimeOrigin,
  PluginToggleBlockedReason,
  PluginUpdateResult,
} from './types.ts'

export type * from './types.ts'

interface PackageManifest {
  name?: string
  version?: string
  repository?: string | { url?: string }
  homepage?: string
}

interface PnpmResult {
  outcome: SubprocessOutcome
  stdout: string
  stderr: string
}

const COMMAND_TIMEOUT_MS = 5 * 60 * 1000
const COMMAND_OUTPUT_MAX_BYTES = 128 * 1024
const TERMINATION_GRACE_MS = 5_000

const CONTROL_PLANE_MODULES = new Set([
  '@deepseek-ai/dsh-host-plugin-inventory',
  '@deepseek-ai/dsh-host-apiproxy',
  '@deepseek-ai/dsh-host-webserver',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-client-hmr',
  '@deepseek-ai/dsh-client-modules',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-api-remotes',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-cordis-client-runner',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-theme',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-settings-plugin-inventory',
])

/** Brand an existing Loader-tree entry id at the owning boundary. */
function pluginEntryId(value: string): PluginEntryId {
  return value as PluginEntryId
}

/** Brand a profile dependency name after reading it from package.json. */
function pluginPackageName(value: string): PluginPackageName {
  return value as PluginPackageName
}

/** Runtime mirror: FiberState is a cross-package const enum. */
const FIBER_STATE = {
  PENDING: 0 as FiberState.PENDING,
  LOADING: 1 as FiberState.LOADING,
  ACTIVE: 2 as FiberState.ACTIVE,
  FAILED: 3 as FiberState.FAILED,
  DISPOSED: 4 as FiberState.DISPOSED,
  UNLOADING: 5 as FiberState.UNLOADING,
} as const

/** Complete public projection of Cordis Fiber states. */
const FIBER_PHASE = {
  [FIBER_STATE.PENDING]: 'pending',
  [FIBER_STATE.LOADING]: 'loading',
  [FIBER_STATE.ACTIVE]: 'active',
  [FIBER_STATE.FAILED]: 'failed',
  [FIBER_STATE.DISPOSED]: null,
  [FIBER_STATE.UNLOADING]: 'unloading',
} as const satisfies Record<FiberState, PluginFiberPhase>

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') return undefined
    throw error
  }
}

function githubUrl(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value === undefined) continue
    const shorthand = /^github:(?<owner>[^/]+)\/(?<repo>[^#]+)(?:#.*)?$/.exec(value)
    const shorthandOwner = shorthand?.groups?.owner
    const shorthandRepo = shorthand?.groups?.repo
    if (shorthandOwner !== undefined && shorthandRepo !== undefined) {
      return `https://github.com/${shorthandOwner}/${shorthandRepo.replace(/\.git$/, '')}`
    }
    const match = /github\.com(?::|\/)(?<owner>[^/\s]+)\/(?<repo>[^/#\s]+)/.exec(value)
    const owner = match?.groups?.owner
    const repo = match?.groups?.repo
    if (owner !== undefined && repo !== undefined) {
      return `https://github.com/${owner}/${repo.replace(/\.git$/, '')}`
    }
  }
  return undefined
}

function repositoryUrl(manifest: PackageManifest | undefined, requestedSpec?: string): string | undefined {
  const repository = typeof manifest?.repository === 'string'
    ? manifest.repository
    : manifest?.repository?.url
  return githubUrl(requestedSpec, repository, manifest?.homepage)
}

function packageRootName(moduleName: string): string | undefined {
  if (moduleName.startsWith('.') || isAbsolute(moduleName)) return undefined
  const parts = moduleName.split('/')
  if (moduleName.startsWith('@')) return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : undefined
  return parts[0]
}

function packageDirectory(profileDir: string, packageName: string): string {
  return join(profileDir, 'node_modules', ...packageName.split('/'))
}

function packageManifest(profileDir: string, packageName: string): PackageManifest | undefined {
  return readJson(join(packageDirectory(profileDir, packageName), 'package.json')) as PackageManifest | undefined
}

function packageSource(spec: string): PluginPackageSource {
  if (/^(?:link|file|workspace):/.test(spec)) return 'local'
  if (/^(?:github:|git\+)|github\.com/.test(spec)) return 'github'
  return 'registry'
}

function localDependencyPath(profileDir: string, packageName: string, spec: string): string | undefined {
  if (spec.startsWith('workspace:')) {
    const directory = packageDirectory(profileDir, packageName)
    return existsSync(directory) ? normalize(realpathSync(directory)) : undefined
  }
  const match = /^(?:link|file):(?<path>.+)$/.exec(spec)
  const value = match?.groups?.path
  if (value === undefined) return undefined
  return normalize(isAbsolute(value) ? value : resolve(profileDir, value))
}

function installedPackages(profileDir: string, manifest: ProfileManifest): PluginInstalledPackage[] {
  const bundles = new Set(manifest.dsh?.profile?.bundles ?? [])
  return Object.entries(manifest.dependencies ?? {}).map(([name, requestedSpec]) => {
    const installed = packageManifest(profileDir, name)
    const source = packageSource(requestedSpec)
    const localPath = source === 'local'
      ? localDependencyPath(profileDir, name, requestedSpec)
      : undefined
    const repository = repositoryUrl(installed, requestedSpec)
    return {
      packageName: pluginPackageName(name),
      requestedSpec,
      installedVersion: typeof installed?.version === 'string' ? installed.version : null,
      source,
      bundle: bundles.has(name),
      ...repository === undefined ? {} : { githubUrl: repository },
      ...localPath === undefined ? {} : { localPath },
      updateSupported: source !== 'local',
    }
  })
}

function runtimeOrigin(
  moduleName: string,
  packageName: string | undefined,
  direct: PluginInstalledPackage | undefined,
  manifest: PackageManifest | undefined,
  directory: string | undefined,
): PluginRuntimeOrigin {
  if (moduleName.startsWith('cordis:')) return 'builtin'
  if (direct?.source === 'local') return 'local'
  const repository = repositoryUrl(manifest)
  if (packageName?.startsWith('@deepseek-ai/') === true
    || repository === 'https://github.com/deepseek-ai/deepseek-harness') return 'native'
  if (directory !== undefined && !realpathSync(directory).split(/[\\/]/).includes('node_modules')) return 'local'
  return 'external'
}

function toggleBlock(entry: Entry): PluginToggleBlockedReason | undefined {
  if (entry.subtree !== undefined) return 'tree-carrier'
  if (CONTROL_PLANE_MODULES.has(entry.options.name)) return 'control-plane'
  return undefined
}

function projectEntry(
  entry: Entry,
  profileDir: string,
  packages: ReadonlyMap<string, PluginInstalledPackage>,
): PluginInventoryEntry {
  const packageName = packageRootName(entry.options.name)
  const directory = packageName === undefined ? undefined : packageDirectory(profileDir, packageName)
  const installedDirectory = directory !== undefined && existsSync(directory) ? directory : undefined
  const manifest = packageName === undefined ? undefined : packageManifest(profileDir, packageName)
  const direct = packageName === undefined ? undefined : packages.get(packageName)
  const origin = runtimeOrigin(entry.options.name, packageName, direct, manifest, installedDirectory)
  const blocked = toggleBlock(entry)
  const repository = direct?.githubUrl ?? repositoryUrl(manifest)
  const localPath = origin === 'local'
    ? direct?.localPath ?? (installedDirectory === undefined ? undefined : normalize(realpathSync(installedDirectory)))
    : undefined
  return {
    entryId: pluginEntryId(entry.id),
    moduleName: entry.options.name,
    enabled: !entry.disabled,
    fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state],
    origin,
    ...packageName === undefined ? {} : { packageName },
    ...typeof manifest?.version === 'string' ? { packageVersion: manifest.version } : {},
    ...repository === undefined ? {} : { githubUrl: repository },
    ...localPath === undefined ? {} : { localPath },
    canToggle: blocked === undefined,
    ...blocked === undefined ? {} : { toggleBlockedReason: blocked },
  }
}

/** Remote service exposing installed profile packages and the current Loader tree. */
export class PluginInventoryGateway extends TypertRemoteService {
  static inject = ['loader', 'subprocess']

  private mutationQueue: Promise<void> = Promise.resolve()

  constructor(ctx: Context) {
    super(ctx, 'pluginInventory')
  }

  private profileDir(): string {
    if (this.ctx.baseUrl === undefined) throw new Error('plugin inventory requires a file-backed profile')
    const url = new URL(this.ctx.baseUrl)
    if (url.protocol !== 'file:') throw new Error('plugin inventory requires a local profile directory')
    return fileURLToPath(url)
  }

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.mutationQueue.then(operation, operation)
    this.mutationQueue = run.then(() => {}, () => {})
    return run
  }

  private async pnpmArgv(args: readonly string[]): Promise<readonly string[]> {
    const executable = await this.ctx.subprocess.resolveExecutable('pnpm')
    const resolved = realpathSync(executable)
    if (['.js', '.cjs', '.mjs'].includes(extname(resolved).toLowerCase())) {
      return [await this.ctx.subprocess.resolveExecutable('node'), resolved, ...args]
    }
    if (process.platform !== 'win32') return [executable, ...args]
    const candidates = [
      join(dirname(executable), 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
      join(dirname(executable), '..', 'pnpm', 'bin', 'pnpm.cjs'),
    ]
    const cli = candidates.find(existsSync)
    if (cli === undefined) throw new Error(`cannot locate pnpm.cjs beside ${executable}`)
    return [await this.ctx.subprocess.resolveExecutable('node'), cli, ...args]
  }

  private async runPnpm(args: readonly string[], acceptedExitCodes: readonly number[]): Promise<PnpmResult> {
    const argv = await this.pnpmArgv(args)
    const controller = new AbortController()
    const timeout = setTimeout(() => { controller.abort() }, COMMAND_TIMEOUT_MS)
    try {
      const handle = this.ctx.subprocess.spawn({
        argv,
        cwd: this.profileDir(),
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: COMMAND_OUTPUT_MAX_BYTES },
          stderr: { maxBytes: COMMAND_OUTPUT_MAX_BYTES },
        },
        graceMs: TERMINATION_GRACE_MS,
        signal: controller.signal,
      })
      const outcome: SubprocessOutcome = await handle.done
      const stdout = handle.collected.stdout?.readFrom(0).text ?? ''
      const stderr = handle.collected.stderr?.readFrom(0).text ?? ''
      if (controller.signal.aborted) throw new Error(`pnpm ${args[0] ?? 'command'} timed out`)
      if (outcome.exitCode === null || !acceptedExitCodes.includes(outcome.exitCode)) {
        const detail = stderr.trim() || stdout.trim() || `exit ${outcome.exitCode ?? outcome.signal}`
        throw new Error(`pnpm ${args[0] ?? 'command'} failed: ${detail}`)
      }
      return { outcome, stdout, stderr }
    } finally {
      clearTimeout(timeout)
    }
  }

  private currentPackages(): PluginInstalledPackage[] {
    const dir = this.profileDir()
    return installedPackages(dir, readProfileManifest('dsh', dir))
  }

  /**
   * Read current profile dependencies and non-group Loader entries directly.
   * @returns Current package and runtime inventory.
   */
  @Remote('list')
  list(): PluginInventorySnapshot {
    const dir = this.profileDir()
    const packages = installedPackages(dir, readProfileManifest('dsh', dir))
    const byName = new Map(packages.map(item => [item.packageName as string, item]))
    const entries: PluginInventoryEntry[] = []
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.group) continue
      entries.push(projectEntry(entry, dir, byName))
    }
    return { packages, entries }
  }

  /**
   * Persist one entry's desired state and apply it through Loader immediately.
   * @param entryId - Stable Loader entry identity from {@link list}.
   * @param enabled - Desired configured enablement.
   * @returns The entry after the live transition settles.
   */
  @Remote('setEnabled')
  async setEnabled(entryId: PluginEntryId, enabled: boolean): Promise<PluginEnablementResult> {
    return this.enqueueMutation(async () => {
      const entry = this.ctx.loader.resolve(entryId)
      const blocked = toggleBlock(entry)
      if (blocked !== undefined) throw new Error(`plugin entry ${entryId} cannot be toggled: ${blocked}`)
      const previousDisabled = entry.options.disabled
      await this.ctx.loader.update(entryId, { disabled: !enabled })
      const dir = this.profileDir()
      try {
        const manifest = readProfileManifest('dsh', dir)
        const profile = manifest.dsh?.profile ?? {}
        manifest.dsh = {
          ...manifest.dsh,
          profile: {
            ...profile,
            entryStates: { ...profile.entryStates, [entryId]: enabled },
          },
        }
        writeProfileManifest(dir, manifest)
      } catch (error) {
        try {
          await this.ctx.loader.update(entryId, { disabled: previousDisabled ?? null })
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], `failed to persist and roll back plugin entry ${entryId}`)
        }
        throw error
      }
      const packages = new Map(this.currentPackages().map(item => [item.packageName as string, item]))
      return { entry: projectEntry(this.ctx.loader.resolve(entryId), dir, packages) }
    })
  }

  /**
   * Check one external profile dependency and install an available update.
   * Registry dependencies move to the latest release; GitHub dependencies
   * refresh their configured ref. Local links are rejected.
   * @param packageName - Direct profile dependency identity from {@link list}.
   * @returns Installed-version facts and whether a restart is required.
   */
  @Remote('checkAndUpdate')
  async checkAndUpdate(packageName: PluginPackageName): Promise<PluginUpdateResult> {
    return this.enqueueMutation(async () => {
      const before = this.currentPackages().find(item => item.packageName === packageName)
      if (before === undefined) throw new Error(`profile dependency ${packageName} does not exist`)
      if (!before.updateSupported) throw new Error(`local dependency ${packageName} must be updated from its source checkout`)
      const dir = this.profileDir()
      const lockPath = join(dir, 'pnpm-lock.yaml')
      const previousLock = existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : ''
      const outdated = await this.runPnpm(['outdated', packageName, '--format', 'json'], [0, 1])
      let report: unknown
      try {
        report = JSON.parse(outdated.stdout || '{}') as unknown
      } catch (error) {
        throw new Error(`pnpm outdated returned invalid JSON for ${packageName}`, { cause: error })
      }
      const row = typeof report === 'object' && report !== null && !Array.isArray(report)
        ? (report as Record<string, unknown>)[packageName]
        : undefined
      const latestVersion = typeof row === 'object' && row !== null && 'latest' in row
        && typeof row.latest === 'string'
        ? row.latest
        : undefined
      if (before.source === 'registry' && (latestVersion === undefined || latestVersion === before.installedVersion)) {
        return {
          packageName,
          previousVersion: before.installedVersion,
          installedVersion: before.installedVersion,
          updated: false,
          restartRequired: false,
        }
      }
      const command = before.source === 'registry'
        ? ['update', packageName, '--latest']
        : ['update', packageName, '--force']
      await this.runPnpm(command, [0])
      const after = this.currentPackages().find(item => item.packageName === packageName)
      if (after === undefined) throw new Error(`pnpm removed profile dependency ${packageName}`)
      const currentLock = existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : ''
      const updated = before.installedVersion !== after.installedVersion
        || before.requestedSpec !== after.requestedSpec
        || previousLock !== currentLock
      if (before.source === 'registry' && latestVersion !== undefined && !updated) {
        throw new Error(`pnpm completed without installing ${packageName}@${latestVersion}`)
      }
      return {
        packageName,
        previousVersion: before.installedVersion,
        installedVersion: after.installedVersion,
        ...latestVersion === undefined ? {} : { latestVersion },
        updated,
        restartRequired: updated,
      }
    })
  }
}

export default PluginInventoryGateway
