/** Package-owned invariant companion for the optional mobile settings surface. */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-mobile-remote'
export const name = 'client-ui-mobile-remote-invariant'
export const inject = ['invariants']
/** No runtime invariant: this package owns one slot and one generated Remote mount. */
const install: InvariantInstaller = () => {}
/** @param ctx - Cordis context carrying the invariant service. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
