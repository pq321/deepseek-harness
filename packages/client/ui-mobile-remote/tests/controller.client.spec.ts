// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileRemoteController, type MobileRemoteRemote } from '../src/client/controller.ts'

const STATUS = {
  running: true,
  connected: false,
  port: 4080,
  pairingUrl: 'http://192.168.1.2:4080/pair?token=test',
  desktopUrl: 'http://127.0.0.1:4080/desktop',
  expiresAt: 1_900_000_000_000,
}

function response(value = STATUS) { return Promise.resolve({ ok: true as const, value }) }

function bench(overrides: Partial<MobileRemoteRemote> = {}) {
  const remote = {
    status: vi.fn(() => response()),
    start: vi.fn(() => response()),
    disconnect: vi.fn(() => response({ ...STATUS, connected: false })),
    ...overrides,
  } as unknown as MobileRemoteRemote
  return { controller: new MobileRemoteController(remote), remote }
}

afterEach(() => { vi.restoreAllMocks() })

describe('MobileRemoteController', () => {
  it('loads status and reports Remote failures', async () => {
    const ok = bench()
    await ok.controller.load()
    expect(ok.controller.store.getSnapshot()).toMatchObject({ status: 'ready', bridge: STATUS })

    const failed = bench({ status: vi.fn(async () => ({ ok: false as const, error: { message: 'offline' } })) as never })
    await failed.controller.load()
    expect(failed.controller.store.getSnapshot()).toMatchObject({ status: 'error', error: 'offline' })
  })

  it('rotates pairing and disconnects through the narrow Remote face', async () => {
    const { controller, remote } = bench()
    await controller.start()
    expect(remote.start).toHaveBeenCalledOnce()
    expect(controller.store.getSnapshot()).toMatchObject({ status: 'ready', busy: null })

    await controller.disconnect()
    expect(remote.disconnect).toHaveBeenCalledOnce()
    expect(controller.store.getSnapshot()).toMatchObject({ bridge: { connected: false }, busy: null })
  })

  it('opens only the Host-provided loopback management URL', async () => {
    const { controller } = bench()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    controller.openPairing()
    expect(open).not.toHaveBeenCalled()

    await controller.load()
    controller.openPairing()
    expect(open).toHaveBeenCalledWith(STATUS.desktopUrl, '_blank', 'noopener,noreferrer')
  })
})
