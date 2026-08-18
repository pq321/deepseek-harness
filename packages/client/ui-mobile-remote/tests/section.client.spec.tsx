// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MobileRemoteSection } from '../src/client/MobileRemoteSection.tsx'
import type { MobileRemoteState } from '../src/client/controller.ts'
import { en, type MobileRemoteKey } from '../src/client/locales.ts'

const READY: MobileRemoteState = {
  status: 'ready',
  bridge: {
    running: true,
    connected: false,
    pairingUrl: 'http://192.168.1.2:4080/pair?token=test',
    desktopUrl: 'http://127.0.0.1:4080/desktop',
  },
  error: null,
  busy: null,
}

function props(state: MobileRemoteState = READY) {
  return {
    close: vi.fn(),
    useSessions: vi.fn(),
    useWorkspaces: vi.fn(),
    useMobileRemote: (select: (value: MobileRemoteState) => unknown) => select(state),
    t: (key: MobileRemoteKey) => en[key],
    load: vi.fn(async () => {}),
    start: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    openPairing: vi.fn(),
  }
}

describe('MobileRemoteSection', () => {
  it('loads on mount and routes pairing controls', async () => {
    const face = props()
    render(<MobileRemoteSection {...face as never} />)
    await waitFor(() => { expect(face.load).toHaveBeenCalledOnce() })
    expect(screen.getByText(READY.bridge!.pairingUrl!)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open pairing page' }))
    expect(face.openPairing).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh link' }))
    expect(face.start).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Disconnect phone' }).hasAttribute('disabled')).toBe(true)
  })

  it('renders connected, busy, loading, and failure states', () => {
    const connected = props({ ...READY, bridge: { ...READY.bridge!, connected: true }, busy: 'disconnect' })
    const { rerender } = render(<MobileRemoteSection {...connected as never} />)
    expect(screen.getByText('A phone is connected.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Disconnecting…' }).hasAttribute('disabled')).toBe(true)

    rerender(<MobileRemoteSection {...props({ ...READY, status: 'loading', bridge: null }) as never} />)
    expect(screen.getByText('Loading phone bridge…')).toBeTruthy()
    rerender(<MobileRemoteSection {...props({ ...READY, status: 'error', bridge: null, error: 'offline' }) as never} />)
    expect(screen.getByRole('alert').textContent).toContain('offline')
  })
})
