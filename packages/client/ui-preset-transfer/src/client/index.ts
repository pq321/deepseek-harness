/** Settings contribution for safe, explicit .dshpreset transfer. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import presetTransferRemote from '@deepseek-ai/dsh-preset-transfer/remote'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { PresetTransferController, type PresetTransferCopy } from './controller.ts'
import { PresetTransferSection } from './PresetTransferSection.tsx'
import type { PresetTransferInjected } from './PresetTransferSection.tsx'
import { en, zh, type PresetTransferKey } from './locales.ts'

export type { PresetTransferInjected, PresetTransferSectionProps } from './PresetTransferSection.tsx'
export type { PresetTransferKey } from './locales.ts'

const NS = 'presetTransfer'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { presetTransfer: PresetTransferKey }
}

export const inject = ['remote', 'slots', 'locale']

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const remoteDispose = await ctx.remote.$mount(presetTransferRemote)
  const feature = ctx.inject(
    ['remote', 'remote.presetTransfer', 'slots', 'locale'],
    (scope: ClientContext) => {
      const controller = new PresetTransferController(scope.remote.presetTransfer)
      const copy = (): PresetTransferCopy => {
        const t = scope.locale.bind(NS)
        return {
          chooseFile: t('chooseFile'),
          idInvalid: t('idInvalid'),
          noWarnings: t('noWarnings'),
          warning: {
            'absolute-paths': t('warningAbsolutePaths'),
            'possible-secrets': t('warningPossibleSecrets'),
            'version-mismatch': t('warningVersionMismatch'),
          },
          conflict: id => t('conflict', { id }),
          confirm: (fileCount, warnings, trustNotice) => t('confirm', { fileCount, warnings, trustNotice }),
          trustNotice: t('security'),
          imported: t('imported'),
        }
      }
      const injected = (): PresetTransferInjected => ({
        hooks: { presetTransfer: controller.store },
        load: () => controller.load(),
        setFile: (file) => { controller.setFile(file) },
        setAgentPreset: (id) => { controller.setAgentPreset(id) },
        importPreset: confirm => controller.importPreset(confirm, copy()),
        exportPreset: id => controller.exportPreset(id),
      })
      scope.effect(() => scope.locale.register(NS, { en, zh }), 'ui-preset-transfer: dictionaries')
      scope.slots.inject('settings.section', () => scope.slots.register({
        name: 'settings.section',
        id: 'preset-transfer',
        order: 30,
        label: () => scope.locale.bind(NS)('nav'),
        locale: NS,
        inject: injected,
      }, PresetTransferSection))
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
