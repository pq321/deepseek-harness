import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context, type Plugin } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { readProfileManifest } from '@deepseek-ai/dsh-app-boot'
import { SubprocessRuntime, type SubprocessHandle, type SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import PluginInventoryGateway from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

const activePlugin: Plugin.Function = () => {}
const pendingPlugin: Plugin.Object = {
  inject: ['neverReady'],
  apply() {},
}

interface CommandResult {
  exitCode: number
  stdout?: string
  stderr?: string
  run?: () => void
}

class FakeSubprocess extends SubprocessRuntime {
  readonly calls: SubprocessSpawnSpec[] = []
  readonly results: CommandResult[] = []
  pnpmPath = ''

  async resolveExecutable(command: string): Promise<string> {
    return command === 'pnpm' ? this.pnpmPath : process.execPath
  }

  spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    this.calls.push(spec)
    const result = this.results.shift()
    if (result === undefined) throw new Error('unexpected subprocess call')
    result.run?.()
    const reader = (text: string) => ({
      readFrom: (_offset: number) => ({
        text,
        nextOffset: Buffer.byteLength(text),
        lossy: false,
      }),
    })
    return {
      pid: 1,
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      collected: {
        stdout: reader(result.stdout ?? ''),
        stderr: reader(result.stderr ?? ''),
      },
      done: Promise.resolve({ exitCode: result.exitCode, signal: null }),
      terminate() {},
      async waitForExit() { return true },
    }
  }

  async spawnTerminal(): Promise<never> {
    throw new Error('not implemented')
  }
}

function stagePackage(profileDir: string, name: string, manifest: Record<string, unknown>): void {
  const dir = join(profileDir, 'node_modules', ...name.split('/'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, ...manifest }))
}

async function harness(): Promise<{
  ctx: Context
  dir: string
  inventory: PluginInventoryGateway
  subprocess: FakeSubprocess
}> {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-plugin-inventory-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'dsh-profile-test',
    dependencies: {
      '@fixture/registry': '^1.0.0',
      '@fixture/github': 'github:fixture/github',
      '@fixture/local': 'link:../local',
    },
    dsh: { profile: { bundles: ['@fixture/registry', '@fixture/github'] } },
  }, null, 2))
  writeFileSync(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  stagePackage(dir, '@fixture/registry', {
    version: '1.0.0',
    repository: 'git+https://github.com/fixture/registry.git',
  })
  stagePackage(dir, '@fixture/github', { version: '2.0.0', homepage: 'https://github.com/fixture/github' })
  stagePackage(dir, '@fixture/local', { version: '0.1.0' })

  const binDir = join(dir, 'bin')
  mkdirSync(join(binDir, 'node_modules', 'pnpm', 'bin'), { recursive: true })
  writeFileSync(join(binDir, 'pnpm.cmd'), '')
  writeFileSync(join(binDir, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'), '')

  const ctx = new Context()
  contexts.push(ctx)
  ctx.baseUrl = pathToFileURL(dir).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.active = activePlugin
  ctx.loader.builtins.pending = pendingPlugin
  await ctx.plugin(FakeSubprocess)
  const subprocess = ctx.get('subprocess') as FakeSubprocess
  subprocess.pnpmPath = join(binDir, 'pnpm.cmd')
  await ctx.plugin(PluginInventoryGateway)
  const inventory = ctx.get('pluginInventory') as PluginInventoryGateway
  return { ctx, dir, inventory, subprocess }
}

describe('PluginInventoryGateway', () => {
  it('publishes package, list, update, and enablement methods', async () => {
    const { inventory } = await harness()
    expect(inventory.typertRemote).toMatchObject({ serviceKey: 'pluginInventory', namespace: 'pluginInventory' })
    expect(remoteMethods(inventory)).toEqual([
      { method: 'list', invocation: { kind: 'direct' } },
      { method: 'setEnabled', invocation: { kind: 'direct' } },
      { method: 'checkAndUpdate', invocation: { kind: 'direct' } },
    ])
  })

  it('projects profile package provenance and current non-group Loader entries', async () => {
    const { ctx, inventory } = await harness()
    const activeId = await ctx.loader.create({ name: 'cordis:active' })
    const pendingId = await ctx.loader.create({ name: 'cordis:pending' })
    const disabledId = await ctx.loader.create({ name: 'cordis:active', disabled: true })
    await ctx.loader.create({ name: 'cordis:active', group: true })

    const snapshot = inventory.list()
    expect(snapshot.packages).toEqual([
      expect.objectContaining({
        packageName: '@fixture/registry',
        source: 'registry',
        installedVersion: '1.0.0',
        bundle: true,
        githubUrl: 'https://github.com/fixture/registry',
        updateSupported: true,
      }),
      expect.objectContaining({ packageName: '@fixture/github', source: 'github', bundle: true }),
      expect.objectContaining({
        packageName: '@fixture/local',
        source: 'local',
        updateSupported: false,
      }),
    ])
    expect(snapshot.packages.find(item => item.packageName === '@fixture/local')?.localPath).toContain('local')
    expect(snapshot.entries).toHaveLength(3)
    expect(snapshot.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entryId: activeId,
        moduleName: 'cordis:active',
        enabled: true,
        fiberPhase: 'active',
        origin: 'builtin',
        canToggle: true,
      }),
      expect.objectContaining({ entryId: pendingId, fiberPhase: 'pending' }),
      expect.objectContaining({ entryId: disabledId, enabled: false, fiberPhase: null }),
    ]))
  })

  it('live-applies and persists entry enablement', async () => {
    const { ctx, dir, inventory } = await harness()
    const entryId = await ctx.loader.create({ name: 'cordis:active' })

    const disabled = await inventory.setEnabled(entryId as never, false)
    expect(disabled.entry).toMatchObject({ entryId, enabled: false, fiberPhase: null })
    expect(readProfileManifest('dsh', dir).dsh?.profile?.entryStates).toEqual({ [entryId]: false })

    const enabled = await inventory.setEnabled(entryId as never, true)
    expect(enabled.entry).toMatchObject({ entryId, enabled: true, fiberPhase: 'active' })
    expect(readProfileManifest('dsh', dir).dsh?.profile?.entryStates).toEqual({ [entryId]: true })
    await expect(inventory.setEnabled('missing' as never, true)).rejects.toThrow('cannot resolve entry missing')
  })

  it('checks and installs registry updates through the managed subprocess service', async () => {
    const { dir, inventory, subprocess } = await harness()
    subprocess.results.push({
      exitCode: 1,
      stdout: JSON.stringify({
        '@fixture/registry': { current: '1.0.0', wanted: '1.0.0', latest: '1.1.0' },
      }),
    }, {
      exitCode: 0,
      run: () => {
        stagePackage(dir, '@fixture/registry', {
          version: '1.1.0',
          repository: 'git+https://github.com/fixture/registry.git',
        })
        writeFileSync(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\nupdated: true\n')
      },
    })

    await expect(inventory.checkAndUpdate('@fixture/registry' as never)).resolves.toEqual({
      packageName: '@fixture/registry',
      previousVersion: '1.0.0',
      installedVersion: '1.1.0',
      latestVersion: '1.1.0',
      updated: true,
      restartRequired: true,
    })
    expect(subprocess.calls.map(call => call.argv.slice(-4))).toEqual(expect.arrayContaining([
      expect.arrayContaining(['outdated', '@fixture/registry', '--format', 'json']),
      expect.arrayContaining(['update', '@fixture/registry', '--latest']),
    ]))
    expect(subprocess.calls.every(call => resolve(call.cwd) === resolve(dir))).toBe(true)
    expect(subprocess.calls.every(call => call.signal !== undefined)).toBe(true)
  })

  it('reports current registry packages and rejects local updates before spawning', async () => {
    const { inventory, subprocess } = await harness()
    subprocess.results.push({ exitCode: 0, stdout: '{}' })
    await expect(inventory.checkAndUpdate('@fixture/registry' as never)).resolves.toMatchObject({
      updated: false,
      restartRequired: false,
    })
    await expect(inventory.checkAndUpdate('@fixture/local' as never)).rejects.toThrow('must be updated from its source checkout')
    expect(subprocess.calls).toHaveLength(1)
  })
})
