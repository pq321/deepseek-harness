import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import type {
  PluginEnablementResult,
  PluginInventorySnapshot,
  PluginPackageName,
  PluginUpdateResult,
} from '@deepseek-ai/dsh-api-remotes/client'
import {
  IconChevronDownOutline14,
  IconLinkOutline14,
  IconRefreshOutline14,
  IconSearchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PluginInventoryLocaleKey } from './locales.ts'
import css from './PluginInventorySettingsTab.module.css'

/** Registration-side Remote face used by the section. */
export interface PluginInventorySettingsTabInjected {
  /** Read a current Host inventory snapshot. */
  list: () => Promise<PluginInventorySnapshot>
  /** Persist and live-apply one runtime entry state. */
  setEnabled: (entryId: PluginInventorySnapshot['entries'][number]['entryId'], enabled: boolean) => Promise<PluginEnablementResult>
  /** Check and install one external profile package update. */
  checkAndUpdate: (packageName: PluginPackageName) => Promise<PluginUpdateResult>
}

type InstalledPackage = PluginInventorySnapshot['packages'][number]
type RuntimeEntry = PluginInventorySnapshot['entries'][number]
type PluginFiberPhase = RuntimeEntry['fiberPhase']

/** Full component props assembled by the Settings slot renderer. */
export type PluginInventorySettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.pluginInventory'>
  & InjectFace<PluginInventorySettingsTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly snapshot: PluginInventorySnapshot }

type ActionState = 'pending' | 'updated' | 'current' | 'failed' | 'parent-disabled'

const PHASE_KEYS = {
  pending: 'pending',
  loading: 'loadingPhase',
  active: 'active',
  failed: 'failed',
  unloading: 'unloading',
} satisfies Record<Exclude<PluginFiberPhase, null>, PluginInventoryLocaleKey>

const PACKAGE_SOURCE_KEYS = {
  registry: 'registrySource',
  github: 'githubSource',
  local: 'localSource',
} satisfies Record<InstalledPackage['source'], PluginInventoryLocaleKey>

const RUNTIME_ORIGIN_KEYS = {
  native: 'nativeOrigin',
  builtin: 'builtinOrigin',
  external: 'externalOrigin',
  local: 'localOrigin',
} satisfies Record<RuntimeEntry['origin'], PluginInventoryLocaleKey>

/** Localized accessible label for one root Fiber phase. */
function phaseLabel(phase: PluginFiberPhase, t: PluginInventorySettingsTabProps['t']): string {
  return phase === null ? t('unobserved') : t(PHASE_KEYS[phase])
}

/** Compact a module specifier without guessing whether its Loader id was generated. */
function moduleShortName(moduleName: string): string {
  const unscoped = moduleName.startsWith('@') ? moduleName.slice(moduleName.indexOf('/') + 1) : moduleName
  return unscoped
    .replace(/^cordis:/, '')
    .replace(/^cordis-plugin-/, '')
    .replace(/^dsh-(?:host-|client-)?/, '')
}

function normalizedValues(values: Array<string | undefined>): string[] {
  return values.flatMap(value => value === undefined ? [] : [value.toLocaleLowerCase()])
}

function packageMatches(item: InstalledPackage, query: string): boolean {
  if (query.length === 0) return true
  return normalizedValues([
    item.packageName,
    item.requestedSpec,
    item.githubUrl,
    item.localPath,
    item.installedVersion ?? undefined,
  ]).some(value => value.includes(query))
}

function entryMatches(item: RuntimeEntry, query: string): boolean {
  if (query.length === 0) return true
  return normalizedValues([
    item.moduleName,
    item.entryId,
    item.packageName,
    item.githubUrl,
    item.localPath,
    item.packageVersion,
  ]).some(value => value.includes(query))
}

function DetailLink({ href, label }: { href: string; label: string }): ReactNode {
  return (
    <a className={css.detailLink} href={href} target="_blank" rel="noreferrer">
      <IconLinkOutline14 aria-hidden="true" />
      <span>{label}</span>
    </a>
  )
}

function ActionMessage({ state, t }: {
  state: ActionState | undefined
  t: PluginInventorySettingsTabProps['t']
}): ReactNode {
  if (state === undefined || state === 'pending') return null
  const key = state === 'updated'
    ? 'updateInstalled'
    : state === 'current'
      ? 'upToDate'
      : state === 'parent-disabled'
        ? 'parentDisabled'
        : 'updateFailed'
  return <p className={css.actionMessage} data-state={state} role={state === 'failed' ? 'alert' : 'status'}>{t(key)}</p>
}

/** Render installed profile packages and the live Loader inventory. */
export function PluginInventorySettingsTab({
  list,
  setEnabled,
  checkAndUpdate,
  t,
}: PluginInventorySettingsTabProps): ReactNode {
  const catalogId = useId()
  const [request, setRequest] = useState(0)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [actions, setActions] = useState<Record<string, ActionState>>({})
  const [state, setState] = useState<ViewState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => list()).then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [list, request])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredPackages = useMemo(
    () => state.status === 'ready'
      ? state.snapshot.packages.filter(item => packageMatches(item, normalizedQuery))
      : [],
    [normalizedQuery, state],
  )
  const filteredEntries = useMemo(
    () => state.status === 'ready'
      ? state.snapshot.entries.filter(item => entryMatches(item, normalizedQuery))
      : [],
    [normalizedQuery, state],
  )

  useEffect(() => {
    if (expanded !== null
      && !filteredPackages.some(item => `package:${item.packageName}` === expanded)
      && !filteredEntries.some(item => `entry:${item.entryId}` === expanded)) {
      setExpanded(null)
    }
  }, [expanded, filteredEntries, filteredPackages])

  const retry = (): void => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
  }

  const updatePackage = async (item: InstalledPackage): Promise<void> => {
    const key = `package:${item.packageName}`
    setActions(current => ({ ...current, [key]: 'pending' }))
    try {
      const result = await checkAndUpdate(item.packageName)
      setActions(current => ({ ...current, [key]: result.updated ? 'updated' : 'current' }))
      const snapshot = await list()
      setState({ status: 'ready', snapshot })
    } catch {
      setActions(current => ({ ...current, [key]: 'failed' }))
    }
  }

  const toggleEntry = async (item: RuntimeEntry): Promise<void> => {
    const key = `entry:${item.entryId}`
    const desired = !item.enabled
    setActions(current => ({ ...current, [key]: 'pending' }))
    try {
      const result = await setEnabled(item.entryId, desired)
      setState(current => current.status !== 'ready' ? current : {
        status: 'ready',
        snapshot: {
          ...current.snapshot,
          entries: current.snapshot.entries.map(entry => entry.entryId === item.entryId ? result.entry : entry),
        },
      })
      setActions((current) => {
        if (result.entry.enabled === desired) {
          const { [key]: _removed, ...rest } = current
          return rest
        }
        return { ...current, [key]: 'parent-disabled' }
      })
    } catch {
      setActions(current => ({ ...current, [key]: 'failed' }))
    }
  }

  const total = filteredPackages.length + filteredEntries.length

  return (
    <div className={css.section} aria-busy={state.status === 'loading'}>
      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{t('error')}</p>
          <button type="button" onClick={retry}>{t('retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <div className={css.catalog}>
          <label className={css.search}>
            <IconSearchOutline16 aria-hidden="true" />
            <span className={css.visuallyHidden}>{t('search')}</span>
            <input
              type="search"
              value={query}
              placeholder={t('search')}
              aria-label={t('search')}
              onChange={(event) => { setQuery(event.currentTarget.value) }}
            />
          </label>
          <div className={css.catalogHeading}>
            <h3>{t('catalog')}</h3>
            <span data-plugin-count={total}>{total}</span>
          </div>
          {state.snapshot.packages.length + state.snapshot.entries.length === 0
            ? <p className={css.status}>{t('empty')}</p>
            : null}
          {state.snapshot.packages.length + state.snapshot.entries.length > 0 && total === 0
            ? <p className={css.status}>{t('emptySearch')}</p>
            : null}

          {filteredPackages.length > 0 ? (
            <section className={css.group} aria-labelledby={`${catalogId}-packages`}>
              <div className={css.groupHeading}>
                <h4 id={`${catalogId}-packages`}>{t('installedPackages')}</h4>
                <span>{filteredPackages.length}</span>
              </div>
              <ul className={css.cards}>
                {filteredPackages.map((item) => {
                  const key = `package:${item.packageName}`
                  const open = expanded === key
                  const detailId = `${catalogId}-package-${encodeURIComponent(item.packageName)}`
                  const action = actions[key]
                  return (
                    <li className={css.card} key={key} data-open={open ? 'true' : undefined} data-plugin-package={item.packageName}>
                      <button
                        className={css.cardContent}
                        type="button"
                        aria-expanded={open}
                        aria-controls={detailId}
                        onClick={() => { setExpanded(current => current === key ? null : key) }}
                      >
                        <strong className={css.cardTitle} title={item.packageName}>{item.packageName}</strong>
                        <span className={css.cardTrailing}>
                          <span className={css.sourceTag} data-source={item.source}>{t(PACKAGE_SOURCE_KEYS[item.source])}</span>
                          <IconChevronDownOutline14 className={css.chevron} size={12} aria-hidden="true" />
                        </span>
                      </button>
                      {open ? (
                        <div className={css.cardDetails} id={detailId}>
                          <dl className={css.details}>
                            <div><dt>{t('installedVersion')}</dt><dd>{item.installedVersion ?? t('versionUnknown')}</dd></div>
                            <div><dt>{t('requestedSpec')}</dt><dd><code>{item.requestedSpec}</code></dd></div>
                            <div><dt>{t('source')}</dt><dd>{t(PACKAGE_SOURCE_KEYS[item.source])}</dd></div>
                          </dl>
                          <div className={css.detailResources}>
                            {item.githubUrl !== undefined ? <DetailLink href={item.githubUrl} label={t('github')} /> : null}
                            {item.source !== 'local' && item.githubUrl === undefined
                              ? <span className={css.muted}>{t('githubMissing')}</span>
                              : null}
                            {item.localPath !== undefined ? <code className={css.pathValue}>{item.localPath}</code> : null}
                          </div>
                          <div className={css.actions}>
                            {item.updateSupported ? (
                              <button
                                className={css.actionButton}
                                type="button"
                                disabled={action === 'pending'}
                                onClick={() => { void updatePackage(item) }}
                              >
                                <IconRefreshOutline14 aria-hidden="true" />
                                {action === 'pending' ? t('checkingUpdate') : t('checkUpdate')}
                              </button>
                            ) : <span className={css.muted}>{t('localUpdateHint')}</span>}
                          </div>
                          <ActionMessage state={action} t={t} />
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          {filteredEntries.length > 0 ? (
            <section className={css.group} aria-labelledby={`${catalogId}-runtime`}>
              <div className={css.groupHeading}>
                <h4 id={`${catalogId}-runtime`}>{t('runtimePlugins')}</h4>
                <span>{filteredEntries.length}</span>
              </div>
              <ul className={css.cards}>
                {filteredEntries.map((entry) => {
                  const key = `entry:${entry.entryId}`
                  const status = phaseLabel(entry.fiberPhase, t)
                  const title = moduleShortName(entry.moduleName)
                  const configuration = t(entry.enabled ? 'enabledTag' : 'disabledTag')
                  const open = expanded === key
                  const detailId = `${catalogId}-entry-${encodeURIComponent(entry.entryId)}`
                  const action = actions[key]
                  const blockedMessage = entry.toggleBlockedReason === 'tree-carrier'
                    ? t('treeCarrierLocked')
                    : t('controlPlaneLocked')
                  return (
                    <li className={css.card} key={key} data-open={open ? 'true' : undefined} data-plugin-entry={entry.entryId}>
                      <button
                        className={css.cardContent}
                        type="button"
                        aria-expanded={open}
                        aria-controls={detailId}
                        aria-label={entry.enabled ? `${title}, ${status}, ${configuration}` : `${title}, ${configuration}`}
                        onClick={() => { setExpanded(current => current === key ? null : key) }}
                      >
                        <strong className={css.cardTitle} title={entry.moduleName}>{title}</strong>
                        <span className={css.cardTrailing}>
                          <span className={css.sourceTag} data-source={entry.origin}>{t(RUNTIME_ORIGIN_KEYS[entry.origin])}</span>
                          {entry.enabled ? (
                            <span className={css.statusDot} data-phase={entry.fiberPhase ?? 'unobserved'} role="img" aria-label={status} title={status} />
                          ) : null}
                          <span className={css.configTag} data-enabled={entry.enabled ? 'true' : 'false'}>{configuration}</span>
                          <IconChevronDownOutline14 className={css.chevron} size={12} aria-hidden="true" />
                        </span>
                      </button>
                      {open ? (
                        <div className={css.cardDetails} id={detailId}>
                          <code className={css.entryValue} data-loader-entry>{entry.moduleName}</code>
                          <dl className={css.details}>
                            <div><dt>{t('entryId')}</dt><dd><code>{entry.entryId}</code></dd></div>
                            <div><dt>{t('source')}</dt><dd>{t(RUNTIME_ORIGIN_KEYS[entry.origin])}</dd></div>
                            {entry.packageVersion !== undefined
                              ? <div><dt>{t('installedVersion')}</dt><dd>{entry.packageVersion}</dd></div>
                              : null}
                            <div><dt>{t('configuration')}</dt><dd>{configuration}</dd></div>
                            {entry.enabled ? <div><dt>{t('cordis')}</dt><dd>{status}</dd></div> : null}
                          </dl>
                          <div className={css.detailResources}>
                            {entry.githubUrl !== undefined ? <DetailLink href={entry.githubUrl} label={t('github')} /> : null}
                            {entry.localPath !== undefined ? <code className={css.pathValue}>{entry.localPath}</code> : null}
                          </div>
                          <div className={css.toggleRow}>
                            <span>{entry.enabled ? t('disablePlugin') : t('enablePlugin')}</span>
                            <button
                              className={css.switch}
                              type="button"
                              role="switch"
                              aria-checked={entry.enabled}
                              aria-label={entry.enabled ? t('disablePlugin') : t('enablePlugin')}
                              disabled={!entry.canToggle || action === 'pending'}
                              onClick={() => { void toggleEntry(entry) }}
                            ><span /></button>
                          </div>
                          {!entry.canToggle ? <p className={css.locked}>{blockedMessage}</p> : null}
                          {action === 'pending' ? <p className={css.actionMessage} role="status">{t('changingState')}</p> : null}
                          {action === 'failed' ? <p className={css.actionMessage} data-state="failed" role="alert">{t('stateChangeFailed')}</p> : null}
                          {action === 'parent-disabled' ? <p className={css.actionMessage} role="status">{t('parentDisabled')}</p> : null}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
