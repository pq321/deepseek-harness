/** Optional LAN pairing and mobile-control Host service. */

import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import type { AddressInfo } from 'node:net'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { MobileRemoteStatus } from './types.ts'
import { renderDesktopPage, renderMobilePage, renderPairingWaitPage } from './pages.ts'

export type * from './types.ts'

const MAX_BODY_BYTES = 64 * 1024
const MAX_PENDING_PAIRINGS = 32
const PAIRING_TTL_MS = 5 * 60 * 1000
const RPC_ALLOWLIST = new Set([
  'workspace.list', 'session.list', 'session.history', 'session.create', 'session.prompt', 'session.cancel',
])

declare module '@deepseek-ai/cordis' { interface Context { mobileRemote: MobileRemoteService } }

/** Listener port for the optional mobile bridge; zero selects an ephemeral port. */
export interface Config { readonly port: number }

interface PendingPairing { readonly id: string; readonly remoteAddress: string; readonly expiresAt: number; decision?: boolean }

function normalizeRemoteAddress(address: string): string {
  return address.startsWith('::ffff:') ? address.slice(7) : address
}

function isPrivateAddress(address: string): boolean {
  if (address === '127.0.0.1' || address === '::1') return true
  const octets = address.split('.').map(Number)
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false
  const first = octets[0]
  const second = octets[1]
  return first !== undefined && second !== undefined
    && (first === 10 || first === 192 && second === 168 || first === 172 && second >= 16 && second <= 31)
}

function isLoopback(address: string): boolean { return address === '127.0.0.1' || address === '::1' }

function preferredLanAddress(): string | undefined {
  for (const entries of Object.values(networkInterfaces())) for (const entry of entries ?? []) {
    if (entry.family === 'IPv4' && !entry.internal && isPrivateAddress(entry.address)) return entry.address
  }
  return undefined
}

async function readBody(request: IncomingMessage): Promise<string> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk as Uint8Array)
    size += bytes.length
    if (size > MAX_BODY_BYTES) throw new Error('request body is too large')
    chunks.push(bytes)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(JSON.stringify(value))
}

function text(response: ServerResponse, status: number, value: string): void {
  response.statusCode = status
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end(value)
}

function html(response: ServerResponse, value: string): void {
  response.statusCode = 200
  response.setHeader('content-type', 'text/html; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(value)
}

/** LAN mobile bridge service with explicit pairing and a narrow RPC allowlist. */
export class MobileRemoteService extends TypertRemoteService {
  static Config: z<Config> = z.object({
    port: z.natural().max(65535).default(0),
  })
  static inject = ['webServer']

  private server: Server | undefined
  private port: number | undefined
  private pairingToken: string | undefined
  private pairingExpiresAt: number | undefined
  private readonly sessions = new Map<string, string>()
  private readonly pending = new Map<string, PendingPairing>()

  constructor(ctx: Context, private readonly config: Config) { super(ctx, 'mobileRemote') }

  async [Service.init](): Promise<void> {
    await this.startServer()
    this.ctx.effect(() => async () => { await this.stopServer() }, 'mobile-remote: server')
  }

  /**
   * Read the bridge without changing its pairing token.
   * @returns current server, pairing, and phone connection status.
   */
  @Remote('status')
  status(): MobileRemoteStatus { return this.snapshot() }

  /**
   * Rotate the short-lived pairing token.
   * @returns a fresh pairing link and current server status.
   */
  @Remote('start')
  start(): MobileRemoteStatus { this.rotatePairing(); return this.snapshot() }

  /**
   * Revoke the phone session and all pending approvals.
   * @returns the disconnected server status.
   */
  @Remote('disconnect')
  disconnect(): MobileRemoteStatus { this.sessions.clear(); this.pending.clear(); this.rotatePairing(); return this.snapshot() }

  private snapshot(): MobileRemoteStatus {
    const address = preferredLanAddress() ?? '127.0.0.1'
    if (this.server === undefined || this.port === undefined
      || this.pairingToken === undefined || this.pairingExpiresAt === undefined) {
      return { running: this.server !== undefined, connected: this.sessions.size > 0 }
    }
    return {
      running: true,
      connected: this.sessions.size > 0,
      port: this.port,
      pairingUrl: `http://${address}:${this.port}/pair?token=${this.pairingToken}`,
      desktopUrl: `http://127.0.0.1:${this.port}/desktop`,
      expiresAt: this.pairingExpiresAt,
    }
  }

  private rotatePairing(): void {
    this.pairingToken = randomBytes(32).toString('base64url')
    this.pairingExpiresAt = Date.now() + PAIRING_TTL_MS
  }

  private async startServer(): Promise<void> {
    this.rotatePairing()
    const server = createServer((request, response) => {
      void this.handle(request, response).catch((error: unknown) => {
        json(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      })
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(this.config.port, '0.0.0.0', () => {
        server.off('error', reject)
        resolve()
      })
    })
    this.server = server
    this.port = (server.address() as AddressInfo).port
  }

  private async stopServer(): Promise<void> {
    const server = this.server
    this.server = undefined
    this.port = undefined
    this.sessions.clear()
    this.pending.clear()
    this.pairingToken = undefined
    this.pairingExpiresAt = undefined
    if (server === undefined) return
    await new Promise<void>((resolve) => {
      server.close(() => { resolve() })
    })
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader('x-content-type-options', 'nosniff')
    response.setHeader('x-frame-options', 'DENY')
    response.setHeader('referrer-policy', 'no-referrer')
    response.setHeader('cache-control', 'no-store')
    response.setHeader(
      'content-security-policy',
      "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
    )
    const address = normalizeRemoteAddress(request.socket.remoteAddress ?? '')
    if (!isPrivateAddress(address)) {
      text(response, 403, 'Private network only.')
      return
    }
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    if (request.method === 'GET' && url.pathname === '/desktop') {
      if (!isLoopback(address)) {
        text(response, 403, 'Desktop only.')
        return
      }
      const state = this.snapshot()
      if (!state.pairingUrl || state.expiresAt === undefined) {
        text(response, 503, 'Bridge unavailable.')
        return
      }
      html(response, renderDesktopPage({
        pairingUrl: state.pairingUrl, expiresAt: state.expiresAt, connected: state.connected,
      }))
      return
    }
    if (request.method === 'GET' && url.pathname === '/desktop/status') {
      if (!isLoopback(address)) {
        text(response, 403, 'Desktop only.')
        return
      }
      this.prunePending()
      json(response, 200, {
        connected: this.sessions.size > 0,
        pending: [...this.pending.values()].map(({ id, remoteAddress, expiresAt }) => ({
          id, remoteAddress, expiresAt,
        })),
      })
      return
    }
    if (request.method === 'POST' && url.pathname === '/desktop/disconnect') {
      if (!isLoopback(address)) {
        text(response, 403, 'Desktop only.')
        return
      }
      if (!this.sameOrigin(request)) {
        text(response, 403, 'Cross-origin request rejected.')
        return
      }
      this.disconnect()
      json(response, 200, { ok: true })
      return
    }
    if (request.method === 'POST' && url.pathname === '/desktop/decide') {
      if (!isLoopback(address)) {
        text(response, 403, 'Desktop only.')
        return
      }
      if (!this.sameOrigin(request)) {
        text(response, 403, 'Cross-origin request rejected.')
        return
      }
      const input = JSON.parse(await readBody(request)) as { id?: unknown; approved?: unknown }
      const item = typeof input.id === 'string' ? this.pending.get(input.id) : undefined
      if (item === undefined || typeof input.approved !== 'boolean') {
        text(response, 404, 'Pairing request not found.')
        return
      }
      item.decision = input.approved
      json(response, 200, { ok: true })
      return
    }
    if (request.method === 'GET' && url.pathname === '/pair') {
      if (this.authorized(request)) {
        response.statusCode = 302
        response.setHeader('location', '/')
        response.end()
        return
      }
      if (!this.validToken(url.searchParams.get('token')) || this.pairingExpiresAt === undefined) {
        text(response, 401, 'This pairing link is invalid or expired.')
        return
      }
      this.prunePending()
      if (this.pending.size >= MAX_PENDING_PAIRINGS) {
        text(response, 429, 'Too many pending pairing requests.')
        return
      }
      const id = randomUUID()
      this.pending.set(id, { id, remoteAddress: address, expiresAt: this.pairingExpiresAt })
      html(response, renderPairingWaitPage(id))
      return
    }
    if (request.method === 'GET' && url.pathname === '/pair/status') {
      const id = url.searchParams.get('id')
      const item = id === null ? undefined : this.pending.get(id)
      if (item === undefined || item.remoteAddress !== address || item.expiresAt < Date.now()) {
        json(response, 200, { expired: true })
        return
      }
      if (item.decision === false) {
        this.pending.delete(item.id)
        json(response, 200, { denied: true })
        return
      }
      if (item.decision !== true) {
        json(response, 200, { pending: true })
        return
      }
      const token = randomBytes(32).toString('base64url')
      this.sessions.clear()
      this.sessions.set(token, item.remoteAddress)
      this.pending.delete(item.id)
      this.pairingToken = undefined
      this.pairingExpiresAt = undefined
      response.setHeader('set-cookie', `dsh_mobile=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`)
      json(response, 200, { approved: true })
      return
    }
    if (!this.authorized(request)) {
      text(response, 401, 'Pair your phone again.')
      return
    }
    if (request.method === 'GET' && url.pathname === '/') {
      html(response, renderMobilePage())
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/rpc') {
      if (!this.sameOrigin(request)) {
        text(response, 403, 'Cross-origin request rejected.')
        return
      }
      const input = JSON.parse(await readBody(request)) as { method?: unknown; payload?: unknown }
      if (typeof input.method !== 'string' || !RPC_ALLOWLIST.has(input.method)) {
        json(response, 403, { ok: false, error: 'RPC method is not available on mobile.' })
        return
      }
      const result = await this.forwardRpc(input.method, input.payload ?? {})
      json(response, result.ok ? 200 : 400, result)
      return
    }
    text(response, 404, 'Not found.')
  }

  private validToken(candidate: string | null): boolean {
    if (candidate === null || this.pairingToken === undefined
      || this.pairingExpiresAt === undefined || Date.now() > this.pairingExpiresAt) return false
    const left = Buffer.from(candidate)
    const right = Buffer.from(this.pairingToken)
    return left.length === right.length && timingSafeEqual(left, right)
  }

  private authorized(request: IncomingMessage): boolean {
    const match = /(?:^|;\s*)dsh_mobile=([^;]+)/.exec(request.headers.cookie ?? '')
    const token = match?.[1]
    return token !== undefined
      && this.sessions.get(token) === normalizeRemoteAddress(request.socket.remoteAddress ?? '')
  }

  private prunePending(): void {
    const now = Date.now()
    for (const [id, item] of this.pending) if (item.expiresAt < now) this.pending.delete(id)
  }

  private async forwardRpc(method: string, payload: unknown): Promise<{ ok: boolean; value?: unknown; error?: string }> {
    if (this.port === undefined) return { ok: false, error: 'Harness is not ready.' }
    const rpcId = randomUUID()
    const response = await fetch(`http://127.0.0.1:${this.ctx.webServer.port}/api/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) return { ok: false, error: `Harness transport returned HTTP ${response.status}.` }
    const envelope = await response.json() as { rpcId?: unknown; result?: { ok?: unknown; value?: unknown; error?: { message?: unknown } } }
    if (envelope.rpcId !== rpcId) return { ok: false, error: 'Harness RPC response did not match the request.' }
    if (envelope.result?.ok !== true) return { ok: false, error: typeof envelope.result?.error?.message === 'string' ? envelope.result.error.message : 'Harness rejected the request.' }
    return { ok: true, value: envelope.result.value }
  }

  private sameOrigin(request: IncomingMessage): boolean {
    const origin = request.headers.origin
    const host = request.headers.host
    if (origin === undefined || host === undefined) return true
    try { return new URL(origin).host === host } catch { return false }
  }
}

export default MobileRemoteService
