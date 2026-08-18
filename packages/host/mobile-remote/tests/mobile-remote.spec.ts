import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { MobileRemoteService } from '../src/index.ts'
import { renderMobilePage } from '../src/pages.ts'

const fibers: Array<{ dispose(): Promise<unknown> }> = []
const servers: Server[] = []

afterEach(async () => {
  await Promise.all(fibers.splice(0).map(fiber => fiber.dispose()))
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve) => {
    server.close(() => { resolve() })
  })))
})

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  return (server.address() as { port: number }).port
}

async function handleHarnessRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array))
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { rpcId: string }
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify({
    rpcId: input.rpcId,
    result: { ok: true, value: { items: [], archivedSessionIds: [] } },
  }))
}

describe('optional LAN mobile bridge', () => {
  it('pairs a private client and forwards only the mobile RPC allowlist', async () => {
    const harness = createServer((request, response) => {
      void handleHarnessRequest(request, response)
    })
    servers.push(harness)
    const harnessPort = await listen(harness)

    const ctx = new Context()
    ctx.provide('webServer', { port: harnessPort } as never)
    const fiber = ctx.plugin(MobileRemoteService, { port: 0 })
    fibers.push(fiber)
    await fiber.await()
    const service = ctx.get('mobileRemote') as MobileRemoteService
    const state = service.status()
    expect(state.running).toBe(true)
    expect(state.pairingUrl).toMatch(/^http:\/\//)

    if (state.pairingUrl === undefined || state.desktopUrl === undefined) throw new Error('bridge URLs unavailable')
    const pairing = await fetch(state.pairingUrl)
    const pairingHtml = await pairing.text()
    const bridgeOrigin = new URL(state.pairingUrl).origin
    const desktopOrigin = new URL(state.desktopUrl).origin
    const desktopStatus = await fetch(`${desktopOrigin}/desktop/status`)
    const desktopValue = await desktopStatus.json() as {
      pending?: Array<{ id?: unknown; remoteAddress?: unknown }>
    }
    const pairingId = desktopValue.pending?.[0]?.id
    if (typeof pairingId !== 'string') throw new Error('pairing id unavailable')
    expect(pairingHtml).toContain(JSON.stringify(pairingId))
    const desktopPage = await fetch(state.desktopUrl)
    expect(await desktopPage.text()).toContain('Approve')
    await fetch(new URL(state.desktopUrl).origin + '/desktop/decide', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: pairingId, approved: true }),
    })
    const paired = await fetch(`${bridgeOrigin}/pair/status?id=${encodeURIComponent(pairingId)}`)
    expect(paired.status).toBe(200)
    const cookie = paired.headers.get('set-cookie')?.split(';', 1)[0]
    if (cookie === undefined) throw new Error('pairing cookie unavailable')
    const crossOrigin = await fetch(new URL(state.desktopUrl).origin + '/desktop/disconnect', {
      method: 'POST', headers: { origin: 'https://example.invalid' },
    })
    expect(crossOrigin.status).toBe(403)
    const mobile = await fetch(`${bridgeOrigin}/`, { headers: { cookie } })
    expect(mobile.status).toBe(200)
    expect(await mobile.text()).toContain('DSH Mobile')

    const forwarded = await fetch(`${bridgeOrigin}/api/rpc`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ method: 'workspace.list', payload: {} }),
    })
    expect(await forwarded.json()).toEqual({ ok: true, value: { items: [], archivedSessionIds: [] } })
    const blocked = await fetch(`${bridgeOrigin}/api/rpc`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ method: 'host.openPath', payload: {} }),
    })
    expect(blocked.status).toBe(403)
  })

  it('renders remote content through DOM text nodes and wires session creation', () => {
    const page = renderMobilePage()
    expect(page).not.toContain('.innerHTML')
    expect(page).toContain('replaceChildren')
    expect(page).toContain('map(entry=>entry.event)')
    expect(page).toContain("rpc('session.create',{workspaceId})")
  })

  it('withdraws the bridge and rejects requests after the plugin unloads', async () => {
    const ctx = new Context()
    ctx.provide('webServer', { port: 1 } as never)
    const fiber = ctx.plugin(MobileRemoteService, { port: 0 })
    fibers.push(fiber)
    await fiber.await()
    const state = (ctx.get('mobileRemote') as MobileRemoteService).status()
    await fiber.dispose()
    expect(state.port).toBeTypeOf('number')
    await expect(fetch(`http://127.0.0.1:${state.port}/`)).rejects.toThrow()
  })
})
