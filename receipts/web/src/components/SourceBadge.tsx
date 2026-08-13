import { useSyncExternalStore } from 'react'
import { sourceStore } from '../lib/source'

const CONNECTION_TEXT: Record<string, string> = {
  connecting: 'Connecting',
  open: 'Live',
  reconnecting: 'Reconnecting',
  fixture: 'Replay',
}

const CONNECTION_COLOR: Record<string, string> = {
  connecting: 'var(--ink-3)',
  open: 'var(--ink-green)',
  reconnecting: 'var(--ink-amber)',
  fixture: 'var(--ink-amber)',
}

/**
 * Discloses whether the app is talking to a backend or replaying the bundled
 * case file. Small on purpose — it should be honest, not loud.
 */
export function SourceBadge() {
  const { source, connection } = useSyncExternalStore(
    sourceStore.subscribe,
    sourceStore.getSnapshot,
    sourceStore.getSnapshot,
  )

  const color = CONNECTION_COLOR[connection] ?? 'var(--ink-3)'
  const text = CONNECTION_TEXT[connection] ?? connection

  return (
    <span
      className="flex items-center gap-2 border px-2 py-1"
      style={{
        borderRadius: 'var(--r-2)',
        borderColor: 'var(--line)',
        background: 'var(--surface)',
      }}
      title={
        source === 'fixture'
          ? 'No backend reachable — replaying the bundled case file.'
          : `Connected to the agent stream.`
      }
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 'var(--r-3)',
          background: color,
          boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 22%, transparent)`,
        }}
      />
      <span className="label" style={{ color }}>
        {source === 'fixture' ? `Fixture · ${text}` : text}
      </span>
    </span>
  )
}
