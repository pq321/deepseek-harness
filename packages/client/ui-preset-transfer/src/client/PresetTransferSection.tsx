import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PresetTransferState } from './controller.ts'
import type { PresetTransferKey } from './locales.ts'
import css from './PresetTransferSection.module.css'

export interface PresetTransferInjected {
  readonly hooks: { presetTransfer: { getSnapshot(): PresetTransferState; subscribe(listener: () => void): () => void } }
  readonly load: () => Promise<void>
  readonly setFile: (file: File | null) => void
  readonly setAgentPreset: (id: string) => void
  readonly importPreset: (confirm: (message: string) => boolean) => Promise<void>
  readonly exportPreset: (id: string) => Promise<void>
}

export type PresetTransferSectionProps =
  PropsRuntime<'settings.section'> & PropsLocale<'presetTransfer'> & InjectFace<PresetTransferInjected>

/** Settings page for portable preset packages. */
export function PresetTransferSection(props: PresetTransferSectionProps): ReactNode {
  const state = props.usePresetTransfer(snapshot => snapshot)
  useEffect(() => { void props.load() }, [props.load])
  const t = (key: PresetTransferKey): string => props.t(key)
  return (
    <section className={css.section}>
      <h2 className={css.title}>{t('nav')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      <p className={css.security}>{t('security')}</p>
      <div className={css.form}>
        <label className={`${css.field} ${css.file}`}>
          <span>{t('file')}</span>
          <input type="file" accept=".dshpreset,application/vnd.dsh.preset+zip,application/zip" onChange={(event) => { props.setFile(event.target.files?.[0] ?? null) }} />
        </label>
        <label className={css.field}>
          <span>{t('id')}</span>
          <input className={css.input} value={state.agentPreset} placeholder={t('idPlaceholder')} spellCheck={false} onChange={(event) => { props.setAgentPreset(event.target.value) }} />
        </label>
        <Button disabled={state.busy !== null} onClick={() => { void props.importPreset(message => window.confirm(message)) }}>
          {state.busy === 'import' ? t('importing') : t('import')}
        </Button>
      </div>
      {state.error === null ? null : <p className={css.error} role="alert">{`${t('error')} ${state.error}`}</p>}
      {state.message === null ? null : <p className={css.message} role="status">{state.message}</p>}
      {state.status === 'loading' ? <p className={css.empty}>{t('loading')}</p> : null}
      {state.status === 'error' ? <p className={css.empty}>{t('loadFailed')}</p> : null}
      {state.status === 'ready' && state.rows.filter(row => row.trust === 'user').length === 0
        ? <p className={css.empty}>{t('noUserPresets')}</p>
        : null}
      <ul className={css.cards}>
        {state.rows.filter(row => row.trust === 'user').map(row => (
          <li className={css.card} key={row.id}>
            <div className={css.cardMain}>
              <span className={css.name}>{row.name ?? row.id}</span>
              {row.description === undefined ? null : <span className={css.description}>{row.description}</span>}
              <code className={css.id}>{row.id}</code>
            </div>
            <Button variant="outline" disabled={row.broken !== undefined || state.busy !== null} onClick={() => { void props.exportPreset(row.id) }}>
              {state.busy === 'export' ? t('exporting') : t('export')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
