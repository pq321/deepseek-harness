// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PresetTransferSection } from '../src/client/PresetTransferSection.tsx'
import type { PresetTransferState } from '../src/client/controller.ts'
import { en, type PresetTransferKey } from '../src/client/locales.ts'

const READY: PresetTransferState = {
  status: 'ready',
  rows: [{ id: 'mine', trust: 'user', name: 'Mine', description: 'Portable preset' }],
  error: null,
  file: null,
  agentPreset: 'imported',
  busy: null,
  message: null,
}

function props(state: PresetTransferState = READY) {
  return {
    close: vi.fn(),
    useSessions: vi.fn(),
    useWorkspaces: vi.fn(),
    usePresetTransfer: (select: (value: PresetTransferState) => unknown) => select(state),
    t: (key: PresetTransferKey) => en[key],
    load: vi.fn(async () => {}),
    setFile: vi.fn(),
    setAgentPreset: vi.fn(),
    importPreset: vi.fn(async () => {}),
    exportPreset: vi.fn(async () => {}),
  }
}

describe('PresetTransferSection', () => {
  it('loads on mount and routes file, id, import, and export gestures', async () => {
    const face = props()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const view = render(<PresetTransferSection {...face as never} />)
    await waitFor(() => { expect(face.load).toHaveBeenCalledOnce() })

    const file = new File(['zip'], 'mine.dshpreset', { type: 'application/zip' })
    fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [file] } })
    expect(face.setFile).toHaveBeenCalledWith(file)
    fireEvent.change(screen.getByPlaceholderText('my-preset'), { target: { value: 'renamed' } })
    expect(face.setAgentPreset).toHaveBeenCalledWith('renamed')
    fireEvent.click(screen.getByRole('button', { name: 'Import package' }))
    expect(face.importPreset).toHaveBeenCalledOnce()
    expect(face.importPreset.mock.calls[0]![0]('review')).toBe(true)
    expect(confirm).toHaveBeenCalledWith('review')
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(face.exportPreset).toHaveBeenCalledWith('mine')
  })

  it('renders loading, failure, empty, error, and success states', () => {
    const { rerender } = render(<PresetTransferSection {...props({ ...READY, status: 'loading', rows: [] }) as never} />)
    expect(screen.getByText('Loading presets...')).toBeTruthy()
    rerender(<PresetTransferSection {...props({ ...READY, status: 'error', rows: [], error: 'offline' }) as never} />)
    expect(screen.getByRole('alert').textContent).toContain('offline')
    expect(screen.getByText('Could not load presets.')).toBeTruthy()
    rerender(<PresetTransferSection {...props({ ...READY, rows: [], message: 'done' }) as never} />)
    expect(screen.getByText('No user-authored presets are available to export.')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('done')
  })
})
