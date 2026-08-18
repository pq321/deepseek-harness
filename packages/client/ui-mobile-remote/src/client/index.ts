/** Optional settings contribution for the Host LAN mobile bridge. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import mobileRemote from '@deepseek-ai/dsh-host-mobile-remote/remote'
import type {} from '@deepseek-ai/dsh-host-mobile-remote/remote'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { MobileRemoteController } from './controller.ts'
import { MobileRemoteSection } from './MobileRemoteSection.tsx'
import type { MobileRemoteInjected } from './MobileRemoteSection.tsx'
import { en, zh, type MobileRemoteKey } from './locales.ts'

export type { MobileRemoteInjected, MobileRemoteSectionProps } from './MobileRemoteSection.tsx'
export type { MobileRemoteKey } from './locales.ts'

const NS = 'mobileRemote'

declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { mobileRemote: MobileRemoteKey } }

/** Required browser services: generated Remote, slot registry, and locale. */
export const inject = ['remote', 'slots', 'locale']

/** Mount the generated Host Remote, then consume it through an injected child context. */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const remoteDispose = await ctx.remote.$mount(mobileRemote)
  const feature = ctx.inject(
    ['remote', 'remote.mobileRemote', 'slots', 'locale'],
    (scope: ClientContext) => {
      const controller = new MobileRemoteController(scope.remote.mobileRemote)
      scope.effect(() => scope.locale.register(NS, { en, zh }), 'ui-mobile-remote: dictionaries')
      const injected = (): MobileRemoteInjected => ({
        hooks: { mobileRemote: controller.store },
        load: () => controller.load(),
        start: () => controller.start(),
        disconnect: () => controller.disconnect(),
        openPairing: () => { controller.openPairing() },
      })
      scope.slots.inject('settings.section', () => scope.slots.register({
        name: 'settings.section', id: 'mobile-remote', order: 40,
        label: () => scope.locale.bind(NS)('nav'), locale: NS, inject: injected,
      }, MobileRemoteSection))
    },
  )
  try {
    await feature
  } catch (error) {
    await remoteDispose()
    throw error
  }
  return async () => {
    await feature.dispose()
    await remoteDispose()
  }
}
