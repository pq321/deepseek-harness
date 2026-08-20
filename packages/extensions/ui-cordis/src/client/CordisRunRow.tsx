/** `cordis_run` card and the host seat for Package-owned interactive UI. */

import { useEffect } from 'react'
import type { InjectFace, PropsLocale, PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { cordisRunCard } from './card-model.ts'
import { cordisToolViewKey } from './run-card-index.ts'
import type { CordisRunCardFace } from './slots.ts'

/** Full Run-card props including its declared Package business-view child slot. */
export type CordisRunRowProps = ToolCallViewProps
  & InjectFace<CordisRunCardFace>
  & PropsRenderSlots<'tool.view.cordis'>
  & PropsLocale<'cordis'>

/**
 * Observe one activation result without rendering a message-flow row: the
 * cordis_run call reports its run card to the registry, while the
 * conversation Runtime tab (`CordisRuntimeView`) and the sidebar panel show
 * the complete runtime state — the message flow stays free of chrome rows.
 */
export function CordisRunRow({
  callId, block, useRunCards, onObserveRunCard,
}: CordisRunRowProps) {
  const card = cordisRunCard(block)
  const latest = useRunCards(snapshot => snapshot)
  const key = card.state === 'ok'
    && card.pluginId !== null
    && card.packageId !== null
    && card.pluginRunId !== null
    && card.seq !== null
    ? cordisToolViewKey(card.pluginId, card.packageId)
    : null
  useEffect(() => {
    if (key === null || card.seq === null || card.pluginRunId === null) return
    onObserveRunCard({ key, callId, seq: card.seq, pluginRunId: card.pluginRunId })
  }, [callId, card.pluginRunId, card.seq, key, onObserveRunCard])

  void latest
  return null
}
