import { useMemo } from 'react'
import { getContributors } from '../lib/api'
import { useAsync } from '../hooks/useAsync'
import { bandOf } from '../lib/format'
import type { Contributor } from '../lib/types'
import type { CredibilityMove } from '../hooks/useAgentStream'
import { CredibilityChip, CredibilityChipPlaceholder } from './CredibilityChip'

interface StripProps {
  /** Live score changes from the stream, applied over the fetched roster. */
  moves: Record<string, CredibilityMove>
}

/**
 * The org, ranked by what the agent currently thinks of them. This is the one
 * place the whole roster appears; everywhere else people show up because the
 * agent brought them up.
 */
export function ContributorStrip({ moves }: StripProps) {
  const { data, error, loading } = useAsync((signal) => getContributors(signal), [])

  const roster = useMemo<(Contributor & { moved: boolean })[]>(() => {
    if (!data) return []
    return data
      .map((c) => {
        const move = moves[c.id]
        if (!move || move.to === c.credibility) return { ...c, moved: false }
        // Fold the live change into both the score and the tail of the trend so
        // the sparkline agrees with the number printed next to it.
        return {
          ...c,
          credibility: move.to,
          band: bandOf(move.to),
          trend: [...c.trend, move.to].slice(-14),
          moved: true,
        }
      })
      .sort((a, b) => b.credibility - a.credibility)
  }, [data, moves])

  if (error) return null

  return (
    <section
      aria-label="Contributor credibility"
      className="border-b"
      style={{ borderColor: 'var(--line)', background: 'var(--surface-sunk)' }}
    >
      <div
        className="mx-auto flex w-full items-center gap-3 overflow-x-auto px-4 py-2.5 sm:px-6"
        style={{ maxWidth: 'var(--content-max)' }}
      >
        <span className="label shrink-0 pr-1" style={{ color: 'var(--ink-3)' }}>
          On file
        </span>

        {loading &&
          Array.from({ length: 5 }, (_, i) => <CredibilityChipPlaceholder key={i} />)}

        {!loading &&
          roster.map(({ moved, ...c }) => (
            <CredibilityChip key={c.id} contributor={c} pulsing={moved} />
          ))}
      </div>
    </section>
  )
}
