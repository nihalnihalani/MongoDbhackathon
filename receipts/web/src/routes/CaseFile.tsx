import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getReview } from '../lib/api'
import { useAsync } from '../hooks/useAsync'
import { useState } from 'react'
import {
  absoluteDate,
  prNumber,
  relativeTime,
  scrutinyLabel,
  signed,
  similarityPct,
  toVerdict,
} from '../lib/format'
import type { AgentAction, Evidence, ReviewDetail } from '../lib/types'
import { EmptyState } from '../components/EmptyState'
import { ErrorPanel } from '../components/ErrorPanel'
import { Prose } from '../components/Prose'
import { ScrutinyMeter } from '../components/ScrutinyMeter'
import { Placeholder, PlaceholderList } from '../components/Placeholder'
import { Stamp, StatusText } from '../components/Stamp'
import { DiffHunk } from '../components/DiffHunk'
import { caseFileFor } from '../fixtures/data'
import { ControlComparison } from '../components/ControlComparison'
import { PostedReview } from '../components/PostedReview'

/** A titled slab with a stamped label — the case file's only structural unit. */
function Section({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section
      className="border-t px-4 py-6 sm:px-6"
      style={{ borderColor: 'var(--line)' }}
      aria-labelledby={id}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="label" style={{ color: 'var(--ink-2)' }}>
          {label}
        </h2>
        {hint && <span className="label">{hint}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ActionRow({ action, index }: { action: AgentAction; index: number }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 py-3">
      <span
        className="num pt-0.5"
        style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-3)' }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="mono" style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--ink)' }}>
            {action.label}
          </span>
          <span className="label">{action.kind}</span>
          <span className="label ml-auto">{relativeTime(action.at)}</span>
        </div>
        <p
          className="mono mt-1.5"
          style={{
            fontSize: 'var(--fs-mono-sm)',
            color: 'var(--ink-3)',
            lineHeight: 'var(--lh-prose)',
            maxWidth: '78ch',
          }}
        >
          {action.output}
        </p>
      </div>
    </li>
  )
}

function EvidenceRow({ item }: { item: Evidence }) {
  const reviewId = item.sourceId.startsWith('pr-') ? caseFileFor(item.sourceId) : null
  const strong = item.similarity >= 0.9

  const inner = (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="label" style={{ color: strong ? 'var(--ink-amber)' : 'var(--ink-steel)' }}>
          {item.memoryId}
        </span>
        <span className="num" style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-3)' }}>
          {item.sourceId.startsWith('pr-')
            ? prNumber(item.sourceId)
            : item.sourceId.toUpperCase()}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span
            aria-hidden="true"
            className="hidden h-1 w-16 sm:block"
            style={{ background: 'var(--line-strong)', borderRadius: 'var(--r-3)' }}
          >
            <span
              className="block h-full"
              style={{
                width: `${item.similarity * 100}%`,
                background: strong ? 'var(--ink-amber)' : 'var(--ink-steel)',
                borderRadius: 'var(--r-3)',
              }}
            />
          </span>
          <span
            className="num"
            style={{
              fontSize: 'var(--fs-mono-sm)',
              color: strong ? 'var(--ink-amber)' : 'var(--ink-steel)',
            }}
          >
            {similarityPct(item.similarity)}
          </span>
        </span>
      </div>
      <p
        className="mt-2.5"
        style={{
          fontSize: 'var(--fs-body-sm)',
          lineHeight: 'var(--lh-prose)',
          color: 'var(--ink-2)',
          maxWidth: '76ch',
        }}
      >
        {item.text}
      </p>
    </>
  )

  const style = {
    borderColor: 'var(--line)',
    borderLeft: `2px solid ${strong ? 'var(--ink-amber)' : 'var(--ink-steel)'}`,
    borderRadius: 'var(--r-2)',
    background: 'var(--surface-2)',
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

function CaseHeader({
  review,
  comparing,
  onCompare,
}: {
  review: ReviewDetail
  comparing?: boolean
  onCompare?: () => void
}) {
  const stamped = review.status !== 'investigating' ? review.status : null

  return (
    <header
      className="rise relative flex flex-col gap-5 border-b px-4 pt-8 pb-6 sm:px-6"
      style={{ borderColor: 'var(--line)' }}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="label">Case file</span>
        <span className="num" style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-3)' }}>
          {review.id.toUpperCase()}
        </span>
        <span className="label">opened {absoluteDate(review.startedAt)}</span>
      </div>

      {/*
        DESIGN.md §3 placement: the stamp is applied to the PR TITLE BLOCK and
        overlaps the header's bottom rule, so it reads as struck onto the page
        rather than laid out in a box. It is never placed over or beside the
        author's name — the agent judges code, not people, and the visual
        grammar has to say so. Author identity lives on its own line below, in
        plain text.
      */}
      <div className="case-title-row">
        <h1
          className="display flex flex-wrap items-baseline gap-x-3"
          style={{ fontSize: 'clamp(1.75rem, 5vw, var(--fs-display-l))' }}
        >
          <span className="num" style={{ color: 'var(--ink-amber)', fontSize: '0.7em' }}>
            {prNumber(review.prId)}
          </span>
          <span style={{ color: 'var(--ink)' }}>{review.title}</span>
        </h1>

        {stamped ? (
          <div className="case-stamp">
            <Stamp status={stamped} press />
          </div>
        ) : (
          <StatusText status={review.status} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--ink-2)' }}>
          opened by{' '}
          <Link
            to={`/contributor/${review.authorId}`}
            className="underline decoration-dotted underline-offset-4"
            style={{ color: 'var(--ink)', fontWeight: 500 }}
          >
            {review.author}
          </Link>
        </span>
        <ScrutinyMeter level={review.scrutiny} />
      </div>

      {review.controlOf && onCompare && (
        <div>
          <button type="button" className="btn" onClick={onCompare} aria-expanded={comparing}>
            <span aria-hidden="true">⇄</span>{' '}
            {comparing ? 'Hide comparison' : 'Compare — the same diff, another author'}
          </button>
        </div>
      )}
    </header>
  )
}

function Outcome({ review }: { review: ReviewDetail }) {
  const { verdict, credibilityDelta, memoryWritten } = review

  if (!verdict) {
    return (
      <EmptyState
        kicker="Open"
        title="No verdict yet."
        body="The agent is still working this case. Watch it reason in the courtroom."
        action={
          <Link to="/" className="btn btn-primary">
            Go to the courtroom
          </Link>
        }
      />
    )
  }

  const tone =
    credibilityDelta === null || credibilityDelta === 0
      ? 'var(--ink-3)'
      : credibilityDelta > 0
        ? 'var(--ink-green)'
        : 'var(--ink-red)'

  return (
    <div className="flex flex-col gap-6">
      {/* No stamp here. The page's one stamp is struck on the PR title above —
          a second one would halve the force of both (DESIGN.md §3). */}
      <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
        <div className="flex flex-col">
          <span className="label">Verdict</span>
          <StatusText status={toVerdict(verdict.decision)} className="mt-1" />
        </div>
        {credibilityDelta !== null && (
          <div className="flex flex-col">
            <span className="label">Credibility applied</span>
            <span
              className="num"
              style={{ fontSize: 'var(--fs-display-l)', fontWeight: 600, color: tone, lineHeight: 1.1 }}
            >
              {signed(credibilityDelta)}
            </span>
          </div>
        )}
        <div className="flex flex-col">
          <span className="label">Decided</span>
          <span
            className="num"
            style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--ink-2)', paddingTop: 4 }}
          >
            {absoluteDate(verdict.at)}
          </span>
        </div>
      </div>

      <Prose text={verdict.reasoning} />

      {review.postedReview && <PostedReview review={review.postedReview} />}

      {memoryWritten && (
        <div
          className="border px-4 py-3.5"
          style={{
            borderColor: 'var(--ink-amber)',
            borderLeft: '2px solid var(--ink-amber)',
            background: 'var(--tint-amber)',
            borderRadius: 'var(--r-2)',
          }}
        >
          <span className="label label-accent">Written back to memory</span>
          <p
            className="mt-2"
            style={{
              fontSize: 'var(--fs-body-sm)',
              lineHeight: 'var(--lh-prose)',
              color: 'var(--ink-2)',
              maxWidth: '76ch',
            }}
          >
            {memoryWritten}
          </p>
        </div>
      )}
    </div>
  )
}

function CaseFilePlaceholder() {
  return (
    <div className="mx-auto w-full px-4 py-8 sm:px-6" style={{ maxWidth: 'var(--content-max)' }}>
      <div className="panel overflow-hidden">
        <div
          className="flex flex-col gap-4 border-b px-6 pt-8 pb-6"
          style={{ borderColor: 'var(--line)' }}
        >
          <Placeholder width={120} height={10} />
          <Placeholder width="56%" height={38} />
          <Placeholder width="34%" height={14} />
        </div>
        <div className="flex flex-col gap-8 px-6 py-8">
          <PlaceholderList count={3} />
          <PlaceholderList count={4} />
        </div>
      </div>
    </div>
  )
}

export function CaseFile() {
  const { id = '' } = useParams<{ id: string }>()
  const { data, error, loading, reload } = useAsync((signal) => getReview(id, signal), [id])
  const [comparing, setComparing] = useState(false)

  if (loading) return <CaseFilePlaceholder />

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <ErrorPanel error={error} onRetry={reload} what="case file" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="route-enter mx-auto w-full px-4 py-5 sm:px-6" style={{ maxWidth: 'var(--content-max)' }}>
      <article className="panel overflow-hidden">
        <CaseHeader
          review={data}
          comparing={comparing}
          onCompare={() => setComparing((v) => !v)}
        />

        {data.controlOf && comparing && (
          <Section id="control-condition" label="Control condition" hint="memory is the only variable">
            <ControlComparison leftId={data.controlOf} rightId={data.id} />
          </Section>
        )}

        <Section id="belief" label="Belief formed" hint="before reading a single line of the diff">
          <Prose text={data.belief} />
        </Section>

        {/* The comparison above renders this same hunk as its shared diff, and
            showing it twice invites the reader to check whether the two copies
            match — which is precisely the doubt the single shared diff exists to
            remove. */}
        {data.diff && !(data.controlOf && comparing) && (
          <Section id="hunk" label="The code in question" hint={data.diff.claim}>
            <DiffHunk hunk={data.diff} />
          </Section>
        )}

        <Section
          id="evidence"
          label="Evidence retrieved"
          hint={`${data.evidence.length} memories · vector search over prior reviews and incidents`}
        >
          {data.evidence.length === 0 ? (
            <EmptyState
              kicker="No recall"
              title="Nothing relevant in memory."
              body="The agent had no prior record bearing on this change, so it reviewed the diff cold."
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.evidence.map((e) => (
                <EvidenceRow key={e.memoryId} item={e} />
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="actions"
          label="Actions taken"
          hint={`${data.actions.length} · ${scrutinyLabel[data.scrutiny].toLowerCase()} scrutiny`}
        >
          {data.actions.length === 0 ? (
            <EmptyState kicker="No actions" title="The agent took no action on this case." />
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--line)' }}>
              {data.actions.map((a, i) => (
                <ActionRow key={`${a.kind}-${i}`} action={a} index={i} />
              ))}
            </ul>
          )}
        </Section>

        <Section id="verdict" label="Verdict and consequence">
          <Outcome review={data} />
        </Section>
      </article>
    </div>
  )
}
