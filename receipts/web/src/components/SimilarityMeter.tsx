import { similarityPct } from '../lib/format'

const KIND_GLYPH: Record<string, string> = {
  pr: '⧉',
  incident: '!',
  self: '◈',
}

interface SimilarityMeterProps {
  value: number
  /** Optional kind badge rendered to the left, per DESIGN.md §8.4. */
  kind?: 'pr' | 'incident' | 'self'
  label?: string
}

/**
 * DESIGN.md §8.4 — the retrieval score, as a number plus a 48×6 track.
 * Fill ink encodes strength: ≥0.85 mimeo, 0.65–0.84 ink-2, below that ink-3.
 */
export function SimilarityMeter({ value, kind, label }: SimilarityMeterProps) {
  const clamped = Math.max(0, Math.min(1, value))
  const fill =
    clamped >= 0.85 ? 'var(--ink-mimeo)' : clamped >= 0.65 ? 'var(--ink-2)' : 'var(--ink-3)'

  return (
    <div className="flex items-center gap-2">
      {kind && (
        <span className="label" style={{ color: 'var(--ink-3)' }}>
          <span aria-hidden="true">{KIND_GLYPH[kind]} </span>
          {label ?? kind}
        </span>
      )}
      <span
        className="num ml-auto"
        style={{ fontSize: 'var(--fs-mono-sm)', color: fill }}
        aria-hidden="true"
      >
        {clamped.toFixed(2)}
      </span>
      <span
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-label={`Vector similarity ${similarityPct(clamped)}`}
        style={{
          display: 'block',
          width: 48,
          height: 6,
          background: 'var(--surface-sunk)',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <span
          style={{ display: 'block', height: '100%', width: `${clamped * 100}%`, background: fill }}
        />
      </span>
    </div>
  )
}
