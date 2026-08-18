/** Package-owned invariant companion for the optional LAN mobile bridge. */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-mobile-remote'
export const name = 'host-mobile-remote-invariant'
export const inject = ['invariants']

/** No runtime invariant: pairing sessions and the second HTTP server are owned by one service fiber. */
const install: InvariantInstaller = () => {}

/** @param ctx - Cordis context carrying the invariant service. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
