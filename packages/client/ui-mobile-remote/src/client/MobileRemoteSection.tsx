import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MobileRemoteState } from './controller.ts'
import type { MobileRemoteKey } from './locales.ts'
import css from './MobileRemoteSection.module.css'

/** Business face injected by the mobile bridge settings plugin. */
export interface MobileRemoteInjected {
  readonly hooks: { mobileRemote: { getSnapshot(): MobileRemoteState; subscribe(listener: () => void): () => void } }
  readonly load: () => Promise<void>
  readonly start: () => Promise<void>
  readonly disconnect: () => Promise<void>
  readonly openPairing: () => void
}

/** Settings section props derived from the settings slot and injected face. */
export type MobileRemoteSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'mobileRemote'> & InjectFace<MobileRemoteInjected>

/** Phone pairing and connection controls. */
export function MobileRemoteSection(props: MobileRemoteSectionProps): ReactNode {
  const state = props.useMobileRemote(snapshot => snapshot)
  const t = (key: MobileRemoteKey): string => props.t(key)
  useEffect(() => { void props.load() }, [props.load])
  const bridge = state.bridge
  return (
    <section className={css.section}>
      <h2 className={css.title}>{t('nav')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      <p className={css.security}>{t('security')}</p>
      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? <p className={css.error} role="alert">{`${t('error')} ${state.error ?? t('unavailable')}`}</p> : null}
      {state.status === 'ready' && bridge !== null ? (
        <>
          <p className={css.status}>{bridge.connected ? t('connected') : t('disconnected')}</p>
          {bridge.pairingUrl === undefined ? null : <label className={css.field}><span>{t('pairingUrl')}</span><code className={css.url}>{bridge.pairingUrl}</code></label>}
          <div className={css.actions}>
            <Button disabled={state.busy !== null || bridge.desktopUrl === undefined} onClick={props.openPairing}>{t('openPairing')}</Button>
            <Button variant="outline" disabled={state.busy !== null} onClick={() => { void props.start() }}>{state.busy === 'start' ? t('starting') : t('refresh')}</Button>
            <Button variant="outline" disabled={state.busy !== null || !bridge.connected} onClick={() => { void props.disconnect() }}>{state.busy === 'disconnect' ? t('disconnecting') : t('disconnect')}</Button>
          </div>
        </>
      ) : null}
    </section>
  )
}
