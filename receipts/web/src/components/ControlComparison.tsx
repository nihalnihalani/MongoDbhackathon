import { Link } from 'react-router-dom'
import type { ReviewDetail } from '../lib/types'
import { getReview } from '../lib/api'
import { useAsync } from '../hooks/useAsync'
import { contributors } from '../fixtures/data'
import { bandClass, bandLabel, prNumber, scrutinyLabel } from '../lib/format'
import { DiffHunk } from './DiffHunk'
import { Placeholder } from './Placeholder'

/**
 * THE CONTROL CONDITION (DESIGN.md §8.7) — the highest-value screen in the
 * product, and the only one that proves the thesis rather than asserting it.
 *
 * The identical auth diff, from Liam (118) and from Kevin (31). Same input,
 * different behaviour, memory the only variable. Everything else in the app
 * shows the agent being suspicious; this shows that the suspicion is *earned*
 * and *specific*, because here is the same code being read calmly.
 *
 * Two rules make it work as evidence rather than as a layout:
 *
 *  - ONE shared diff, rendered once, full width. Two copies would invite the
 *    reader to diff the diffs instead of trusting they are the same.
 *  - Only DIFFERING values are inked. If every cell is coloured, nothing is;
 *    difference has to be the only thing that catches the eye.
 *
 * No stamps here. Two stamps side by side would halve the force of both.
 */

interface Row {
  label: string
  of: (r: ReviewDetail) => string
}

const ROWS: Row[] = [
  { label: 'Scrutiny', of: (r) => scrutinyLabel[r.scrutiny].toLowerCase() },
  { label: 'Retrievals', of: (r) => String(r.evidence.length) },
  {
    label: 'Escalated',
    of: (r) => (r.actions.some((a) => a.kind === 'escalate') ? 'yes — critic' : 'no'),
  },
  { label: 'Actions', of: (r) => String(r.actions.length) },
]

const VERDICT_INK: Record<string, string> = {
  approved: 'var(--ink-green)',
  commented: 'var(--ink-amber)',
  blocked: 'var(--ink-red)',
  investigating: 'var(--ink-steel)',
}

function AuthorHead({ review }: { review: ReviewDetail }) {
  const contributor = contributors.find((c) => c.id === review.authorId)
  const band = contributor?.band ?? 'watch'

  return (
    <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${bandClass[band]}`}>
      <span
        aria-hidden="true"
        style={{ width: 3, height: '1.1em', background: 'var(--band)', alignSelf: 'center' }}
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
        {review.author.split(' ')[0]}
      </span>
      <span className="num" style={{ fontSize: 'var(--fs-numeral-sm)', color: 'var(--band)' }}>
        {contributor?.credibility ?? '—'}
      </span>
      <span className="label" style={{ color: 'var(--ink-3)' }}>
        · {contributor?.subsystem ?? 'auth'}
      </span>
      <span className="label" style={{ color: 'var(--band)' }}>
        {bandLabel[band]}
      </span>
    </div>
  )
}

/**
 * One side of the comparison.
 *
 * The cells are placed into the PARENT grid by explicit row and column (the
 * wrapper is `display: contents` at wide widths), rather than being two
 * independent lists sitting side by side. That is not a refactor for its own
 * sake: the columns have different amounts of text, so two independent lists
 * drift — the verdicts end up on different lines and the eye can no longer scan
 * across. The comparison only works if "escalated" on the left sits on exactly
 * the same line as "escalated" on the right.
 *
 * Below 860px the parent stops being a grid, these placements are ignored, and
 * the columns stack.
 */
function Column({
  review,
  other,
  col,
}: {
  review: ReviewDetail
  other: ReviewDetail
  col: number
}) {
  const decision = review.verdict?.decision ?? review.status
  const firstRow = 3

  return (
    <div className="control-col min-w-0">
      <div style={{ gridColumn: col, gridRow: 1 }}>
        <AuthorHead review={review} />
      </div>

      <div style={{ gridColumn: col, gridRow: 2, paddingBottom: 'var(--s-3)' }}>
        <Link
          to={`/review/${review.id}`}
          className="mono underline decoration-dotted underline-offset-4"
          style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-steel)' }}
        >
          {prNumber(review.prId)} — open case file
        </Link>
      </div>

      {ROWS.map((row, i) => {
        const value = row.of(review)
        const differs = value !== row.of(other)
        return (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3 border-b py-2"
            style={{ gridColumn: col, gridRow: firstRow + i, borderColor: 'var(--line)' }}
          >
            <span className="label">{row.label}</span>
            <span
              className="mono text-right"
              style={{
                fontSize: 'var(--fs-mono-sm)',
                // Identical values stay quiet. Only difference is inked — if
                // every cell is coloured then nothing is.
                color: differs ? 'var(--ink)' : 'var(--ink-2)',
                fontWeight: differs ? 700 : 400,
              }}
            >
              {value}
            </span>
          </div>
        )
      })}

      <div style={{ gridColumn: col, gridRow: firstRow + ROWS.length, paddingTop: 'var(--s-4)' }}>
        <span className="label">Belief</span>
        <p
          className="mt-1.5"
          style={{
            fontSize: 'var(--fs-body-sm)',
            lineHeight: 'var(--lh-prose)',
            color: 'var(--ink-2)',
          }}
        >
          {review.belief}
        </p>
      </div>

      {/* Plain text, per §3 — the stamp is scarce and lives on the case file.
          Two stamps side by side would halve the force of both. */}
      <div
        style={{ gridColumn: col, gridRow: firstRow + ROWS.length + 1, paddingTop: 'var(--s-4)' }}
      >
        <span
          className="label"
          style={{ color: VERDICT_INK[decision] ?? 'var(--ink-2)', fontSize: '15px' }}
        >
          {decision}
        </span>
      </div>
    </div>
  )
}

export function ControlComparison({ leftId, rightId }: { leftId: string; rightId: string }) {
  const left = useAsync((signal) => getReview(leftId, signal), [leftId])
  const right = useAsync((signal) => getReview(rightId, signal), [rightId])

  if (left.loading || right.loading) {
    return <Placeholder label="Retrieving both cases…" height={280} />
  }
  if (!left.data || !right.data) return null

  // The trusted author reads first: the calm case establishes the baseline that
  // makes the suspicious one legible as a deviation rather than as the default.
  const diff = left.data.diff ?? right.data.diff

  return (
    <section className="flex flex-col gap-5" aria-labelledby="control-comparison">
      <div>
        <h2
          id="control-comparison"
          className="display"
          style={{ fontSize: 'var(--fs-display-m)', color: 'var(--ink)', lineHeight: 1.1 }}
        >
          The same diff, two authors
        </h2>
        <p
          className="mt-2"
          style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--ink-2)', maxWidth: '68ch' }}
        >
          Both pull requests contain the change below, line for line. Everything that
          differs between the two columns is a consequence of what the agent remembers
          about the person who sent it.
        </p>
      </div>

      {diff && <DiffHunk hunk={diff} />}

      <div className="control-grid">
        <Column review={left.data} other={right.data} col={1} />
        <div className="control-rule" aria-hidden="true" />
        <Column review={right.data} other={left.data} col={3} />
      </div>

      <p
        className="mx-auto text-center"
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 'var(--fs-title)',
          lineHeight: 1.4,
          color: 'var(--ink)',
          maxWidth: '60ch',
          marginTop: 'var(--s-5)',
        }}
      >
        The diff is identical. The only variable is what the agent remembers.
      </p>
    </section>
  )
}
