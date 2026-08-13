import { useSyncExternalStore } from 'react'
import { sourceStore } from '../lib/source'

/**
 * What the reader is looking at, stated plainly.
 *
 * v2 amendment 2 deletes the "fixture mode" badge outright, and the reason is
 * worth keeping in view: calling this a fixture undersells it. It is a replay of
 * a real case — the same events, in the same order, with the same timing — so it
 * is labelled the way a recording is labelled, not the way a mock is.
 *
 * No border, no chip. A recording label is metadata about the page, not a
 * control, and giving it a box makes it look like something to click.
 */
export function SourceBadge() {
  const { source, connection } = useSyncExternalStore(
    sourceStore.subscribe,
    sourceStore.getSnapshot,
    sourceStore.getSnapshot,
  )

  // A live backend is the only case that gets an indicator, because it is the
  // only case where the state can change under the reader.
  if (source === 'live' && connection === 'open') {
    return (
      <span className="label status-live" style={{ color: 'var(--ink-green)' }}>
        Live
      </span>
    )
  }

  if (connection === 'reconnecting') {
    return (
      <span className="label" style={{ color: 'var(--ink-amber)' }}>
        Reconnecting
      </span>
    )
  }

  if (connection === 'connecting') {
    return (
      <span className="label" style={{ color: 'var(--ink-3)' }}>
        Connecting
      </span>
    )
  }

  return (
    <span className="label" style={{ color: 'var(--ink-3)' }}>
      Replay · recorded 14:22
    </span>
  )
}
