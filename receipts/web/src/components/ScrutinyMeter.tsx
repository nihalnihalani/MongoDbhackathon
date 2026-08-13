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
      {/*
        The notches fill left to right rather than all at once. Scrutiny going
        from normal to maximum is the most consequential thing the agent does to
        a person on the strength of memory alone, and a value that simply
        changes reads as configuration — a value that visibly climbs reads as a
        decision being taken.
      */}
      <span className="flex items-center gap-1" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className="scrutiny-notch"
            data-on={n <= rank}
            style={{
              ['--notch-i' as string]: n - 1,
              width: 14,
              height: 4,
              background: n <= rank ? tone : 'var(--line-strong)',
              borderRadius: 1,
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
