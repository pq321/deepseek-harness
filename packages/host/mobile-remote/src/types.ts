/** Client-safe status returned by the optional LAN mobile bridge. */
export interface MobileRemoteStatus {
  readonly running: boolean
  readonly connected: boolean
  readonly port?: number
  readonly pairingUrl?: string
  readonly desktopUrl?: string
  readonly expiresAt?: number
}
