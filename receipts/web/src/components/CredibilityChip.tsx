import { Link } from 'react-router-dom'
import { contributors } from '../fixtures/data'
import { bandClass, bandLabel } from '../lib/format'

interface ChipProps {
  /** Contributor id. The chip resolves its own record — callers have an id, not a roster. */
  id: string
  className?: string
}

/**
 * DESIGN.md §4 — a 3px band bar, the name, the scoped score, the band word.
 * No avatars, no circles, no pills.
 *
 * THIS COMPONENT IS DELIBERATELY HARD TO PLACE. It appears in exactly two
 * positions: inside the stream at the moment of a retrieval, and on the dossier
 * header. Never in a row with other people, never ambient, never at rest on `/`.
 * A row of people-with-scores is a leaderboard, and a leaderboard is the
 * dashboard form the rubric bans — the whole point is that a score is something
 * the agent just looked up, not state the page carries around.
 *
 * Colour is never the only signal; the band word rides alongside the number.
 */
export function CredibilityChip({ id, className = '' }: ChipProps) {
  const contributor = contributors.find((c) => c.id === id)
  if (!contributor) return null

  const { name, credibility, band, subsystem } = contributor
  const given = name.split(' ')[0] ?? name

  return (
    <Link
      to={`/contributor/${id}`}
      className={`lift inline-flex h-[34px] shrink-0 items-center gap-2.5 border pr-3 ${bandClass[band]} ${className}`}
      style={{
        borderRadius: 'var(--r-2)',
        borderColor: 'var(--line-control)',
        background: 'var(--surface)',
      }}
      aria-label={`${name}: credibility ${credibility} in ${subsystem}, ${bandLabel[band]} band. Open dossier.`}
    >
      <span
        aria-hidden="true"
        style={{ width: 3, alignSelf: 'stretch', background: 'var(--band)' }}
      />

      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink)',
        }}
      >
        {given}
      </span>

      {/* Never a bare number: the subsystem is part of the figure. */}
      <span className="num" style={{ fontSize: 'var(--fs-numeral-sm)', color: 'var(--band)', lineHeight: 1 }}>
        {credibility}
      </span>
      <span className="label" style={{ color: 'var(--ink-3)' }}>
        · {subsystem}
      </span>

      <span className="label" style={{ color: 'var(--band)' }}>
        {bandLabel[band]}
      </span>
    </Link>
  )
}
