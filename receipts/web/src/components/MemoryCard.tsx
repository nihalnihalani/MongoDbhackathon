import { Link } from 'react-router-dom'
import type { Memory } from '../lib/types'
import { prNumber, relativeTime } from '../lib/format'

const KIND: Record<Memory['kind'], { label: string; color: string }> = {
  incident: { label: 'Incident', color: 'var(--ink-red)' },
  pr: { label: 'Pull request', color: 'var(--ink-steel)' },
  self: { label: 'Self — review failure', color: 'var(--ink-mimeo)' },
}

/** PRs and reviews are 1:1 in this system, so the ids mirror each other. */
export function reviewIdForSource(sourceId: string): string | null {
  return sourceId.startsWith('pr-') ? sourceId.replace('pr-', 'rev-') : null
}

/**
 * One retrievable memory. Self-memories — the agent's record of its own
 * mistakes — are the most interesting thing in the product, so they are marked
 * in the accent color rather than being filed alongside everything else.
 */
export function MemoryCard({ memory }: { memory: Memory }) {
  const kind = KIND[memory.kind]
  const reviewId = reviewIdForSource(memory.sourceId)

  const inner = (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="label" style={{ color: kind.color }}>
          {kind.label}
        </span>
        <span className="num" style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-3)' }}>
          {memory.sourceId.startsWith('pr-')
            ? prNumber(memory.sourceId)
            : memory.sourceId.toUpperCase()}
        </span>
        <span className="label ml-auto">{relativeTime(memory.at)}</span>
      </div>
      <p
        className="mt-2.5"
        style={{
          fontSize: 'var(--fs-body-sm)',
          lineHeight: 'var(--lh-prose)',
          color: 'var(--ink-2)',
        }}
      >
        {memory.text}
      </p>
    </>
  )

  const style = {
    borderColor: 'var(--line)',
    borderLeft: `3px solid ${kind.color}`,
    borderRadius: 'var(--r-2)',
    background: memory.kind === 'self' ? 'var(--tint-mimeo)' : 'var(--surface-2)',
  }

  return (
    <li>
      {reviewId ? (
        <Link to={`/review/${reviewId}`} className="row-link border px-4 py-3" style={style}>
          {inner}
        </Link>
      ) : (
        <div className="border px-4 py-3" style={style}>
          {inner}
        </div>
      )}
    </li>
  )
}
