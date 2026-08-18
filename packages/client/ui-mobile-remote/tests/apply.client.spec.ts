import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-mobile-remote/client'
import { MobileRemoteSection } from '../src/client/MobileRemoteSection.tsx'
import type { MobileRemoteInjected } from '../src/client/MobileRemoteSection.tsx'

function remoteDouble() {
  const api = {
    status: vi.fn(async () => ({ ok: true as const, value: { running: true, connected: false } })),
    start: vi.fn(),
    disconnect: vi.fn(),
  }
  const record: Record<string, unknown> = {}
  record.$mount = vi.fn(async () => {
    record.mobileRemote = api
    return async () => { delete record.mobileRemote }
  })
  return { api, record }
}

class EnforcedRemote extends Service {
  readonly api = {
    status: vi.fn(async () => ({ ok: true as const, value: { running: true, connected: false } })),
    start: vi.fn(),
    disconnect: vi.fn(),
  }

  constructor(ctx: Context) { super(ctx, 'remote') }

  async $mount(): Promise<() => Promise<void>> {
    const namespace = this.ctx.plugin({
      name: 'remote.mobileRemote',
      apply: (ctx) => { ctx.provide('remote.mobileRemote', this.api) },
    })
    await namespace
    return namespace.dispose
  }
}

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('locale', new LocaleRuntime(ctx))
  const remote = remoteDouble()
  ctx.provide('remote', remote.record as never)
  ctx.provide('remote.mobileRemote', remote.api)
  return { ctx, slots: ctx.get('slots') as SlotRegistry, remote }
}

function declareSettings(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-mobile-remote apply', () => {
  it('declares only the browser services used by the contribution', () => {
    expect(inject).toEqual(['remote', 'slots', 'locale'])
  })

  it('mounts its Remote contribution and waits for the settings declaration', async () => {
    const { ctx, slots, remote } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(slots.entries('settings.section')).toHaveLength(0)

    declareSettings(slots)
    await vi.waitFor(() => { expect(slots.entries('settings.section')).toHaveLength(1) })
    const entry = slots.entries('settings.section')[0]!
    expect(entry.component).toBe(MobileRemoteSection)
    expect(entry.options).toMatchObject({ id: 'mobile-remote', order: 40 })
    const face = (entry.inject as unknown as () => MobileRemoteInjected)()
    expect(face).not.toHaveProperty('controller')
    await face.load()
    expect(remote.api.status).toHaveBeenCalledOnce()
    expect(face.hooks.mobileRemote.getSnapshot().status).toBe('ready')
  })

  it('consumes the dynamically mounted namespace through an injected context', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    ctx.provide('locale', new LocaleRuntime(ctx))
    new EnforcedRemote(ctx)
    const fiber = ctx.plugin({ inject: [...inject], apply })

    await fiber.await()
    await fiber.dispose()
  })

  it('withdraws the settings contribution and generated namespace on unload', async () => {
    const { ctx, slots, remote } = await bench()
    declareSettings(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(slots.entries('settings.section')).toHaveLength(1)
    expect(remote.record.mobileRemote).toBe(remote.api)

    await fiber.dispose()

    expect(slots.entries('settings.section')).toHaveLength(0)
    expect(remote.record).not.toHaveProperty('mobileRemote')
  })
})
