// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { PresetTransferController, type PresetTransferCopy, type PresetTransferRemote } from '../src/client/controller.ts'

const copy: PresetTransferCopy = {
  chooseFile: 'choose-file',
  idInvalid: 'invalid-id',
  noWarnings: 'no-warnings',
  warning: {
    'absolute-paths': 'absolute-warning',
    'possible-secrets': 'secret-warning',
    'version-mismatch': 'version-warning',
  },
  conflict: id => `conflict:${id}`,
  confirm: (fileCount, warnings, trustNotice) => `${fileCount}|${warnings}|${trustNotice}`,
  trustNotice: 'trust-notice',
  imported: 'imported',
}

function response<T>(value: T) { return Promise.resolve({ ok: true as const, value }) }

function bench(overrides: Partial<PresetTransferRemote> = {}) {
  const remote = {
    list: vi.fn(() => response({ rows: [{ id: 'mine', trust: 'user' as const }] })),
    exportPreset: vi.fn(() => response({
      fileName: 'mine.dshpreset', mediaType: 'application/vnd.dsh.preset+zip' as const,
      archiveBase64: 'UEsDBA==',
    })),
    previewImport: vi.fn(() => response({
      agentPreset: 'mine', sourceAgentPreset: 'source', fileCount: 2,
      warnings: ['possible-secrets' as const], conflict: false,
    })),
    importPreset: vi.fn(() => response({
      installed: true as const, agentPreset: 'mine', sourceAgentPreset: 'source',
      fileCount: 2, warnings: [], conflict: false,
    })),
    ...overrides,
  } as unknown as PresetTransferRemote
  return { controller: new PresetTransferController(remote), remote }
}

afterEach(() => { vi.restoreAllMocks() })

describe('PresetTransferController', () => {
  it('loads the export roster and reports Remote failures', async () => {
    const ok = bench()
    await ok.controller.load()
    expect(ok.controller.store.getSnapshot()).toMatchObject({ status: 'ready', rows: [{ id: 'mine' }] })

    const failed = bench({ list: vi.fn(async () => ({ ok: false as const, error: { message: 'offline' } })) as never })
    await failed.controller.load()
    expect(failed.controller.store.getSnapshot()).toMatchObject({ status: 'error', error: 'offline' })
  })

  it('validates the selected file and local identifier before calling Remote', async () => {
    const { controller, remote } = bench()
    await controller.importPreset(() => true, copy)
    expect(controller.store.getSnapshot().error).toBe('choose-file')
    controller.setFile({ arrayBuffer: async () => new ArrayBuffer(0) } as File)
    controller.setAgentPreset('Bad Id')
    await controller.importPreset(() => true, copy)
    expect(controller.store.getSnapshot().error).toBe('invalid-id')
    expect(remote.previewImport).not.toHaveBeenCalled()
  })

  it('previews, confirms, installs, clears the draft, and reloads the roster', async () => {
    const { controller, remote } = bench()
    controller.setFile({ arrayBuffer: async () => new TextEncoder().encode('zip').buffer } as File)
    controller.setAgentPreset('mine')
    const confirm = vi.fn(() => true)
    await controller.importPreset(confirm, copy)
    expect(confirm).toHaveBeenCalledWith('2|secret-warning|trust-notice')
    expect(remote.importPreset).toHaveBeenCalledOnce()
    expect(remote.list).toHaveBeenCalledOnce()
    expect(controller.store.getSnapshot()).toMatchObject({ file: null, agentPreset: '', message: 'imported', busy: null })
  })

  it('does not install a rejected preview and reports conflicts', async () => {
    const cancelled = bench()
    cancelled.controller.setFile({ arrayBuffer: async () => new ArrayBuffer(0) } as File)
    cancelled.controller.setAgentPreset('mine')
    await cancelled.controller.importPreset(() => false, copy)
    expect(cancelled.remote.importPreset).not.toHaveBeenCalled()

    const conflict = bench({ previewImport: vi.fn(() => response({
      agentPreset: 'mine', sourceAgentPreset: 'source', fileCount: 1, warnings: [], conflict: true,
    })) })
    conflict.controller.setFile({ arrayBuffer: async () => new ArrayBuffer(0) } as File)
    conflict.controller.setAgentPreset('mine')
    await conflict.controller.importPreset(() => true, copy)
    expect(conflict.controller.store.getSnapshot().error).toBe('conflict:mine')
  })

  it('downloads an exported package through a temporary object URL', async () => {
    const { controller, remote } = bench()
    const createObjectURL = vi.fn(() => 'blob:test')
    const revokeObjectURL = vi.fn()
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await controller.exportPreset('mine')
    expect(remote.exportPreset).toHaveBeenCalledWith('mine')
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
    expect(controller.store.getSnapshot().busy).toBeNull()
  })
})
