/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-preset-transfer`.
 * @module @deepseek-ai/dsh-preset-transfer/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-preset-transfer'

/** Cordis companion plugin name. */
export const name = 'preset-transfer-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: each operation validates one bounded archive before
 * publishing it with one atomic rename, and the service retains no mutable
 * state or event relationship after the operation settles.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
