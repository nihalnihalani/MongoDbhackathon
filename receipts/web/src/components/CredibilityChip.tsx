import { Link } from 'react-router-dom'
import type { Contributor } from '../lib/types'
import { bandClass, bandLabel } from '../lib/format'
import { Placeholder } from './Placeholder'

interface ChipProps {
  contributor: Contributor
  /** The live stream has moved this person's score in this session. */
  pulsing?: boolean
}

/**
 * DESIGN.md §4 — a 3px band bar, the name, the score. No avatars, no circles,
 * no sparkline: the chip is an index-card tab, and the story lives in the
 * dossier it opens.
 *
 * Color is never the only signal; the band word rides alongside the number.
 */
export function CredibilityChip({ contributor, pulsing = false }: ChipProps) {
  const { id, name, credibility, band } = contributor
  const given = name.split(' ')[0] ?? name

  return (
    <Link
      to={`/contributor/${id}`}
      className={`row-link flex h-[34px] shrink-0 items-center gap-2.5 border pr-2.5 ${bandClass[band]}`}
      style={{
        borderRadius: 'var(--r-2)',
        borderColor: pulsing ? 'var(--band)' : 'var(--line-control)',
        background: pulsing ? 'var(--band-tint)' : 'var(--surface)',
      }}
      aria-label={`${name}: credibility ${credibility}, ${bandLabel[band]} band. Open dossier.`}
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

      <span className="label" style={{ color: 'var(--band)' }}>
        {bandLabel[band]}
      </span>

      <span className="num" style={{ fontSize: '15px', color: 'var(--band)', lineHeight: 1 }}>
        {credibility}
      </span>
    </Link>
  )
}

export function CredibilityChipPlaceholder() {
  return <Placeholder height={34} width={168} className="shrink-0" />
}
