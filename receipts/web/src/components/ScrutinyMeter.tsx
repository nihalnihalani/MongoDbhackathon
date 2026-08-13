import type { Scrutiny } from '../lib/types'
import { scrutinyLabel, scrutinyRank } from '../lib/format'

const TONE: Record<Scrutiny, string> = {
  normal: 'var(--ink-3)',
  elevated: 'var(--ink-amber)',
  maximum: 'var(--ink-red)',
}

/**
 * Three notches. How hard the agent has decided to look at this one — the most
 * visible consequence of a contributor's history, so it gets its own readout.
 */
export function ScrutinyMeter({ level }: { level: Scrutiny }) {
  const rank = scrutinyRank[level]
  const tone = TONE[level]

  return (
    <span className="flex items-center gap-2">
      <span className="label">Scrutiny</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            style={{
              width: 14,
              height: 4,
              background: n <= rank ? tone : 'var(--line-strong)',
              borderRadius: 1,
              transition: 'background-color var(--dur-rail) var(--ease-out)',
            }}
          />
        ))}
      </span>
      <span className="label" style={{ color: tone }}>
        {scrutinyLabel[level]}
      </span>
    </span>
  )
}
