// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PluginInventorySettingsTab } from '../src/client/PluginInventorySettingsTab.tsx'
import type {
  PluginInventorySettingsTabInjected,
  PluginInventorySettingsTabProps,
} from '../src/client/PluginInventorySettingsTab.tsx'
import { en, type PluginInventoryLocaleKey } from '../src/client/locales.ts'

afterEach(cleanup)

type Snapshot = Awaited<ReturnType<PluginInventorySettingsTabInjected['list']>>
const t = ((key: PluginInventoryLocaleKey): string => en[key]) as PluginInventorySettingsTabProps['t']

function props(
  list: PluginInventorySettingsTabInjected['list'],
  overrides: Partial<PluginInventorySettingsTabInjected> = {},
): PluginInventorySettingsTabProps {
  return {
    t,
    list,
    setEnabled: vi.fn(),
    checkAndUpdate: vi.fn(),
    ...overrides,
  } as PluginInventorySettingsTabProps
}

const runtimeEntry = (
  entryId: string,
  moduleName: string,
  enabled: boolean,
  fiberPhase: Snapshot['entries'][number]['fiberPhase'],
  origin: Snapshot['entries'][number]['origin'] = 'external',
  canToggle = true,
): Snapshot['entries'][number] => ({
  entryId,
  moduleName,
  enabled,
  fiberPhase,
  origin,
  canToggle,
}) as Snapshot['entries'][number]

const SNAPSHOT = {
  packages: [
    {
      packageName: '@fixture/external-plugin',
      requestedSpec: '^1.0.0',
      installedVersion: '1.0.0',
      source: 'registry',
      bundle: true,
      githubUrl: 'https://github.com/fixture/external-plugin',
      updateSupported: true,
    },
    {
      packageName: '@fixture/github-plugin',
      requestedSpec: 'github:fixture/github-plugin',
      installedVersion: '2.0.0',
      source: 'github',
      bundle: true,
      githubUrl: 'https://github.com/fixture/github-plugin',
      updateSupported: true,
    },
    {
      packageName: '@fixture/local-plugin',
      requestedSpec: 'link:E:/plugins/local-plugin',
      installedVersion: '0.1.0',
      source: 'local',
      bundle: false,
      localPath: 'E:/plugins/local-plugin',
      updateSupported: false,
    },
  ],
  entries: [
    runtimeEntry('8a1b2c3d', '@deepseek-ai/cordis-plugin-hmr', true, 'active', 'native'),
    runtimeEntry('pending', 'cordis:pending-name', true, 'pending', 'builtin'),
    runtimeEntry('loading', '@fixture/loading-name', true, 'loading'),
    runtimeEntry('failed', '@fixture/failed-name', true, 'failed'),
    runtimeEntry('unloading', '@fixture/unloading-name', true, 'unloading'),
    runtimeEntry('unobserved', '@fixture/unobserved-name', true, null),
    runtimeEntry('disabled-entry', '@deepseek-ai/dsh-host-directory-picker-native', false, null, 'native'),
    {
      ...runtimeEntry('include', 'cordis:include', true, 'active', 'builtin', false),
      toggleBlockedReason: 'tree-carrier',
    },
  ],
} as unknown as Snapshot

describe('PluginInventorySettingsTab', () => {
  it('separates installed packages from runtime entries and discloses details', async () => {
    const deferred = Promise.withResolvers<Snapshot>()
    const list = vi.fn(() => deferred.promise)
    const view = render(<PluginInventorySettingsTab {...props(list)} />)
    expect(screen.getByText(en.loading)).toBeTruthy()

    await act(async () => { deferred.resolve(SNAPSHOT) })
    expect(list).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: en.installedPackages })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.runtimePlugins })).toBeTruthy()
    expect(view.container.querySelector('[data-plugin-count]')?.textContent).toBe('11')
    expect(screen.getAllByRole('listitem')).toHaveLength(11)
    expect(screen.getAllByText(en.enabledTag)).toHaveLength(7)
    expect(screen.getByText(en.disabledTag)).toBeTruthy()
    for (const value of ['Mounted', 'Waiting for dependencies', 'Loading', 'Mount failed', 'Unloading', 'Not mounted']) {
      expect(screen.getAllByRole('img', { name: value }).length).toBeGreaterThan(0)
    }

    const active = screen.getByRole('button', { name: 'hmr, Mounted, Enabled' })
    fireEvent.click(active)
    expect(view.container.querySelector('[data-loader-entry]')?.textContent).toBe('@deepseek-ai/cordis-plugin-hmr')
    expect(screen.getByText(en.entryId)).toBeTruthy()
    expect(screen.getByText('8a1b2c3d')).toBeTruthy()
    expect(screen.getByRole('switch', { name: en.disablePlugin })).toBeTruthy()

    fireEvent.change(screen.getByRole('searchbox', { name: en.search }), { target: { value: 'local-plugin' } })
    expect(view.container.querySelector('[data-loader-entry]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /@fixture\/local-plugin/ }))
    expect(screen.getByText('E:/plugins/local-plugin')).toBeTruthy()
    expect(screen.getByText(en.localUpdateHint)).toBeTruthy()
    expect(screen.queryByRole('button', { name: en.checkUpdate })).toBeNull()
  })

  it('filters packages and entries across identifiers and source details', async () => {
    render(<PluginInventorySettingsTab {...props(async () => SNAPSHOT)} />)
    const search = await screen.findByRole('searchbox', { name: en.search })

    fireEvent.change(search, { target: { value: 'disabled-entry' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('directory-picker-native')).toBeTruthy()

    fireEvent.change(search, { target: { value: 'github.com/fixture/external' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('@fixture/external-plugin')).toBeTruthy()

    fireEvent.change(search, { target: { value: 'not-a-plugin' } })
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText(en.emptySearch)).toBeTruthy()
  })

  it('checks and installs external updates while keeping local packages read-only', async () => {
    const list = vi.fn<PluginInventorySettingsTabInjected['list']>().mockResolvedValue(SNAPSHOT)
    const checkAndUpdate = vi.fn<PluginInventorySettingsTabInjected['checkAndUpdate']>().mockResolvedValue({
      packageName: '@fixture/external-plugin' as never,
      previousVersion: '1.0.0',
      installedVersion: '1.1.0',
      latestVersion: '1.1.0',
      updated: true,
      restartRequired: true,
    })
    render(<PluginInventorySettingsTab {...props(list, { checkAndUpdate })} />)

    await screen.findByRole('heading', { name: en.installedPackages })
    fireEvent.click(screen.getByRole('button', { name: /@fixture\/external-plugin/ }))
    expect(screen.getByRole('link', { name: en.github }).getAttribute('href'))
      .toBe('https://github.com/fixture/external-plugin')
    fireEvent.click(screen.getByRole('button', { name: en.checkUpdate }))
    expect(await screen.findByText(en.updateInstalled)).toBeTruthy()
    expect(checkAndUpdate).toHaveBeenCalledWith('@fixture/external-plugin')
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('live-toggles eligible entries and locks tree carriers', async () => {
    const enabled = { ...SNAPSHOT.entries.find(entry => entry.entryId === 'disabled-entry')!, enabled: true, fiberPhase: 'active' as const }
    const setEnabled = vi.fn<PluginInventorySettingsTabInjected['setEnabled']>().mockResolvedValue({ entry: enabled })
    render(<PluginInventorySettingsTab {...props(async () => SNAPSHOT, { setEnabled })} />)

    await screen.findByRole('heading', { name: en.runtimePlugins })
    fireEvent.click(screen.getByRole('button', { name: 'directory-picker-native, Disabled' }))
    fireEvent.click(screen.getByRole('switch', { name: en.enablePlugin }))
    await waitFor(() => { expect(screen.getByRole('switch', { name: en.disablePlugin }).getAttribute('aria-checked')).toBe('true') })
    expect(setEnabled).toHaveBeenCalledWith('disabled-entry', true)

    fireEvent.click(screen.getByRole('button', { name: 'include, Mounted, Enabled' }))
    expect(screen.getByRole('switch', { name: en.disablePlugin }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(en.treeCarrierLocked)).toBeTruthy()
  })

  it('contains action failures and preserves the current state', async () => {
    const setEnabled = vi.fn<PluginInventorySettingsTabInjected['setEnabled']>().mockRejectedValue(new Error('private failure'))
    const checkAndUpdate = vi.fn<PluginInventorySettingsTabInjected['checkAndUpdate']>().mockRejectedValue(new Error('private failure'))
    render(<PluginInventorySettingsTab {...props(async () => SNAPSHOT, { setEnabled, checkAndUpdate })} />)
    await screen.findByRole('heading', { name: en.runtimePlugins })

    fireEvent.click(screen.getByRole('button', { name: /@fixture\/external-plugin/ }))
    fireEvent.click(screen.getByRole('button', { name: en.checkUpdate }))
    expect(await screen.findByText(en.updateFailed)).toBeTruthy()
    expect(screen.queryByText('private failure')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'directory-picker-native, Disabled' }))
    fireEvent.click(screen.getByRole('switch', { name: en.enablePlugin }))
    expect(await screen.findByText(en.stateChangeFailed)).toBeTruthy()
    expect(screen.getByRole('switch', { name: en.enablePlugin }).getAttribute('aria-checked')).toBe('false')
  })

  it('shows a generic load failure and retries into the empty state', async () => {
    const list = vi.fn<PluginInventorySettingsTabInjected['list']>()
      .mockRejectedValueOnce(new Error('private transport detail'))
      .mockResolvedValueOnce({ packages: [], entries: [] })
    render(<PluginInventorySettingsTab {...props(list)} />)

    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
    expect(await screen.findByText(en.empty)).toBeTruthy()
  })

  it('contains a synchronous Remote failure and ignores results after unmount', async () => {
    const syncFailure = vi.fn(() => { throw new Error('namespace unavailable') }) as PluginInventorySettingsTabInjected['list']
    const failed = render(<PluginInventorySettingsTab {...props(syncFailure)} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    failed.unmount()

    const deferred = Promise.withResolvers<Snapshot>()
    const pending = render(<PluginInventorySettingsTab {...props(() => deferred.promise)} />)
    pending.unmount()
    await act(async () => { deferred.resolve(SNAPSHOT) })

    const deferredFailure = Promise.withResolvers<Snapshot>()
    const pendingFailure = render(<PluginInventorySettingsTab {...props(() => deferredFailure.promise)} />)
    pendingFailure.unmount()
    await act(async () => { deferredFailure.reject(new Error('late failure')) })
  })
})
