import { Buffer } from 'node:buffer'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { strToU8, zipSync } from 'fflate'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentPreset, PresetRoot } from '@deepseek-ai/dsh-agent-presets'
import { PresetTransferService } from '../src/index.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function fixture(): Promise<{
  service: PresetTransferService
  root: string
  roster: { resolve(id: string): Promise<AgentPreset> }
}> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-transfer-'))
  roots.push(root)
  const source = join(root, 'source')
  await mkdir(source)
  await writeFile(join(source, 'agent.cordis.yml'), "- name: './feature.js'\n")
  await writeFile(join(source, 'feature.js'), 'export function apply() {}\n')
  const preset: AgentPreset = { id: 'source', trust: 'user', path: join(source, 'agent.cordis.yml'), name: 'Source' }
  const presetRoots: PresetRoot[] = [{ path: root, trust: 'user' }]
  const roster = {
    roots: presetRoots,
    list: async () => [preset],
    resolve: async (id: string) => {
      if (id !== preset.id) throw new Error(`unknown preset ${id}`)
      return preset
    },
  }
  const ctx = new Context()
  ctx.provide('agentPresets', roster as never)
  return { service: new PresetTransferService(ctx), root, roster }
}

describe('preset transfer archives', () => {
  it('exports a user preset and installs the validated archive under a new id', async () => {
    const { service, root } = await fixture()
    const exported = await service.exportPreset('source')
    const preview = await service.previewImport({ agentPreset: 'imported', archiveBase64: exported.archiveBase64 })
    expect(preview).toMatchObject({ sourceAgentPreset: 'source', agentPreset: 'imported', fileCount: 2, conflict: false })

    const imported = await service.importPreset({ agentPreset: 'imported', archiveBase64: exported.archiveBase64 })
    expect(imported.installed).toBe(true)
    await expect(readFile(join(root, 'imported', 'agent.cordis.yml'), 'utf8'))
      .resolves.toBe("- name: './feature.js'\n")
  })

  it('rejects traversal entries before writing anything', async () => {
    const { service } = await fixture()
    const archive = zipSync({
      'manifest.json': strToU8(JSON.stringify({ format: 'dsh-preset', version: 1, id: 'source' })),
      '../escape': strToU8('no'),
      'preset/agent.cordis.yml': strToU8("- name: './feature.js'\n"),
    })
    await expect(service.previewImport({ agentPreset: 'imported', archiveBase64: Buffer.from(archive).toString('base64') }))
      .rejects.toThrow(/unsafe path/)
  })

  it('refuses exporting shipped presets', async () => {
    const { service, roster } = await fixture()
    roster.resolve = async () => ({ id: 'standard', trust: 'system', path: 'unused' })
    await expect(service.exportPreset('standard')).rejects.toThrow(/built-in presets/)
  })

  it('rejects malformed base64 before attempting archive parsing', async () => {
    const { service } = await fixture()
    await expect(service.previewImport({ agentPreset: 'imported', archiveBase64: 'not base64' }))
      .rejects.toThrow(/valid base64/)
  })
})
