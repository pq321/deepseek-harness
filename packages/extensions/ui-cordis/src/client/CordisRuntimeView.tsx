/** Full-screen Runtime tab view — a conversation.view showing active plugins. */

import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { CordisRunActivity } from '@deepseek-ai/dsh-cordis-client-runner/client'
import type { CordisRuntimeViewFace } from './slots.ts'
import type { CordisDynamicPluginId } from './events.ts'
import css from './CordisRuntimeView.module.css'

export type CordisRuntimeViewProps = ConvViewProps
  & InjectFace<CordisRuntimeViewFace>
  & PropsLocale<'cordis'>

interface PluginRowData {
  pluginId: CordisDynamicPluginId
  purpose: string | undefined
  activity: CordisRunActivity | undefined
}

/** Minimal full-screen Runtime tab showing loaded plugins for the current session. */
export function CordisRuntimeView({
  sessionId, useInventory, useActiveRuns, t,
}: CordisRuntimeViewProps) {
  const inventory = useInventory(snapshot => snapshot)
  const activeRuns = useActiveRuns(snapshot => snapshot)

  // Build combined plugin list
  const pluginIds = new Set<CordisDynamicPluginId>()
  for (const row of inventory.rows) {
    if (row.agentId === sessionId) {
      pluginIds.add(row.pluginId)
    }
  }
  for (const [pluginId, activity] of activeRuns) {
    if (activity.agentId === sessionId) {
      pluginIds.add(pluginId)
    }
  }

  const plugins: PluginRowData[] = Array.from(pluginIds, (pluginId) => {
    const listed = inventory.rows.find(row => row.pluginId === pluginId)
    return {
      pluginId,
      purpose: listed?.packages.at(-1)?.purpose,
      activity: activeRuns.get(pluginId),
    }
  })

  return (
    <div className={css.root}>
      <div className={css.header}>
        <h2 className={css.title}>{t('view.runtime')}</h2>
        <p className={css.subtitle}>
          {plugins.length === 0
            ? 'No dynamic plugins loaded'
            : `${plugins.length} plugin${plugins.length === 1 ? '' : 's'} loaded`}
        </p>
      </div>
      <div className={css.content}>
        {plugins.length === 0 ? (
          <div className={css.empty}>
            <p>No runtime plugins in this session</p>
          </div>
        ) : (
          <ul className={css.list}>
            {plugins.map(({ pluginId, purpose, activity }) => (
              <li key={pluginId} className={css.item}>
                <div className={css.itemHeader}>
                  <span className={css.pluginId}>{pluginId}</span>
                  {activity && (
                    <span className={css.status} data-phase={activity.phase}>
                      {activity.phase}
                    </span>
                  )}
                </div>
                {purpose !== undefined && (
                  <p className={css.purpose}>{purpose}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
