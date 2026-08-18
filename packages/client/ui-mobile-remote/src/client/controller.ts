import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client'
import type { MobileRemoteStatus } from '@deepseek-ai/dsh-host-mobile-remote/types'

/** Snapshot rendered by the optional mobile-remote settings section. */
export interface MobileRemoteState {
  readonly status: 'cold' | 'loading' | 'ready' | 'error'
  readonly bridge: MobileRemoteStatus | null
  readonly error: string | null
  readonly busy: 'start' | 'disconnect' | null
}

/** Narrow generated Remote face used by the settings controller. */
export interface MobileRemoteRemote {
  readonly status: ClientRemote['mobileRemote']['status']
  readonly start: ClientRemote['mobileRemote']['start']
  readonly disconnect: ClientRemote['mobileRemote']['disconnect']
}

const INITIAL: MobileRemoteState = { status: 'cold', bridge: null, error: null, busy: null }

/** Owns mobile bridge state and the three generated Remote calls. */
export class MobileRemoteController {
  private snapshot: MobileRemoteState = INITIAL
  /** Observable state source bound by the slot renderer. */
  readonly store: SnapshotStore<MobileRemoteState> = createSnapshotStore(INITIAL)

  constructor(private readonly remote: MobileRemoteRemote) {}

  /** Refresh pairing and connection status. */
  async load(): Promise<void> {
    if (this.snapshot.status === 'loading') return
    this.update({ status: 'loading', error: null })
    try {
      const result = await this.remote.status()
      if (!result.ok) throw new Error(result.error.message)
      this.update({ status: 'ready', bridge: result.value, error: null })
    } catch (error) {
      this.update({ status: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  }

  /** Rotate the pairing token and refresh the displayed link. */
  async start(): Promise<void> { await this.run('start', () => this.remote.start()) }
  /** Disconnect all paired phones and rotate the pairing token. */
  async disconnect(): Promise<void> { await this.run('disconnect', () => this.remote.disconnect()) }

  /** Open the loopback management page in a separate browser tab. */
  openPairing(): void {
    const url = this.snapshot.bridge?.desktopUrl
    if (url !== undefined) window.open(url, '_blank', 'noopener,noreferrer')
  }

  private async run(kind: 'start' | 'disconnect', operation: () => ReturnType<MobileRemoteRemote['start']>): Promise<void> {
    if (this.snapshot.busy !== null) return
    this.update({ busy: kind, error: null })
    try {
      const result = await operation()
      if (!result.ok) throw new Error(result.error.message)
      this.update({ status: 'ready', bridge: result.value, error: null })
    } catch (error) {
      this.update({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      this.update({ busy: null })
    }
  }

  private update(patch: Partial<MobileRemoteState>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.store.set(this.snapshot)
  }
}
