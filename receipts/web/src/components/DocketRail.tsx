import { Link } from 'react-router-dom'
import { getIncidents, getReviews } from '../lib/api'
import { useAsync } from '../hooks/useAsync'
import { prNumber, relativeTime, scrutinyLabel } from '../lib/format'
import type { Incident, ReviewStatus, ReviewSummary, Scrutiny } from '../lib/types'
import { EmptyState } from './EmptyState'
import { Placeholder } from './Placeholder'
import { StatusText } from './Stamp'

const INCIDENT_TONE: Record<string, string> = {
  attributed: 'var(--ink-red)',
  investigating: 'var(--ink-amber)',
  resolved: 'var(--ink-green)',
  prevented: 'var(--ink-steel)',
}

function DocketEntry({ review }: { review: ReviewSummary }) {
  return (
    <li>
      <Link
        to={`/review/${review.id}`}
        className="row-link border-b px-4 py-3"
        style={{ borderColor: 'var(--line)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="num shrink-0" style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-amber)' }}>
            {prNumber(review.prId)}
          </span>
          <StatusText status={review.status} className="shrink-0" />
        </div>
        <p
          className="mt-2"
          style={{
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--ink)',
            lineHeight: 'var(1.25)',
          }}
        >
          {review.title}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="label">{review.author}</span>
          <span
            className="label"
            style={{
              color:
                review.scrutiny === 'maximum'
                  ? 'var(--ink-red)'
                  : review.scrutiny === 'elevated'
                    ? 'var(--ink-amber)'
                    : 'var(--ink-3)',
            }}
          >
            {scrutinyLabel[review.scrutiny]} scrutiny
          </span>
          <span className="label ml-auto">{relativeTime(review.startedAt)}</span>
        </div>
      </Link>
    </li>
  )
}

function IncidentEntry({ incident }: { incident: Incident }) {
  const tone = INCIDENT_TONE[incident.status] ?? 'var(--ink-3)'
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="num" style={{ fontSize: 'var(--fs-mono-sm)', color: tone }}>
          {incident.id.toUpperCase()}
        </span>
        <span className="label" style={{ color: tone }}>
          {incident.status}
        </span>
      </div>
      <p
        className="mt-1.5"
        style={{
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--ink)',
          lineHeight: 'var(1.25)',
        }}
      >
        {incident.title}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3">
        {incident.attributedPrId && (
          <span className="label" style={{ color: 'var(--ink-2)' }}>
            → {prNumber(incident.attributedPrId)}
            {incident.attributedAuthorId ? ` · ${incident.attributedAuthorId}` : ''}
          </span>
        )}
        <span className="label ml-auto">{relativeTime(incident.at)}</span>
      </div>
    </>
  )

  return (
    <li>
      {incident.attributedAuthorId ? (
        <Link
          to={`/contributor/${incident.attributedAuthorId}`}
          className="row-link border-b px-4 py-3"
          style={{ borderColor: 'var(--line)' }}
        >
          {body}
        </Link>
      ) : (
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--line)' }}>
          {body}
        </div>
      )}
    </li>
  )
}

function RailPlaceholder() {
  return (
    <ul aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="flex flex-col gap-2 border-b px-4 py-3.5" style={{ borderColor: 'var(--line)' }}>
          <div className="flex justify-between">
            <Placeholder width={38} height={10} />
            <Placeholder width={72} height={18} />
          </div>
          <Placeholder width="88%" height={12} />
          <Placeholder width="54%" height={9} />
        </li>
      ))}
    </ul>
  )
}

/**
 * The rail is supporting evidence, never the headline: what else is on the
 * agent's plate, and what has already gone wrong in production.
 */
interface DocketRailProps {
  /**
   * The case currently on the stream. The docket is fetched once, so without
   * this the rail would still call the live review "investigating" minutes
   * after the reader watched it get blocked.
   */
  live?: { reviewId: string; status: ReviewStatus; scrutiny: Scrutiny } | null
}

export function DocketRail({ live }: DocketRailProps) {
  const reviewsState = useAsync((signal) => getReviews(undefined, signal), [])
  const incidentsState = useAsync((signal) => getIncidents(signal), [])

  const fetched = reviewsState.data ?? []
  const reviews = live
    ? fetched.map((r) =>
        r.id === live.reviewId ? { ...r, status: live.status, scrutiny: live.scrutiny } : r,
      )
    : fetched
  const active = reviews.filter((r) => r.status === 'investigating')
  const closed = reviews.filter((r) => r.status !== 'investigating').slice(0, 4)
  const incidents = incidentsState.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <section className="panel overflow-hidden" aria-labelledby="docket-open">
        <div className="panel-head">
          <h2 id="docket-open" className="label" style={{ color: 'var(--ink-2)' }}>
            Open docket
          </h2>
          <span className="num ml-auto" style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-amber)' }}>
            {reviewsState.loading ? '··' : String(active.length).padStart(2, '0')}
          </span>
        </div>

        {reviewsState.loading && <RailPlaceholder />}

        {!reviewsState.loading && reviewsState.error && (
          <div className="p-4">
            <EmptyState
              kicker="Docket unavailable"
              title="Could not load open reviews."
              action={
                <button type="button" className="btn" onClick={reviewsState.reload}>
                  Retry
                </button>
              }
            />
          </div>
        )}

        {!reviewsState.loading && !reviewsState.error && active.length === 0 && (
          <div className="p-4">
            <EmptyState kicker="Docket clear" title="Nothing under investigation." />
          </div>
        )}

        {active.length > 0 && (
          <ul>
            {active.map((r) => (
              <DocketEntry key={r.id} review={r} />
            ))}
          </ul>
        )}
      </section>

      <section className="panel overflow-hidden" aria-labelledby="docket-closed">
        <div className="panel-head">
          <h2 id="docket-closed" className="label" style={{ color: 'var(--ink-2)' }}>
            Adjudicated
          </h2>
        </div>
        {reviewsState.loading ? (
          <RailPlaceholder />
        ) : closed.length === 0 ? (
          <div className="p-4">
            <EmptyState kicker="No history" title="No reviews closed yet." />
          </div>
        ) : (
          <ul>
            {closed.map((r) => (
              <DocketEntry key={r.id} review={r} />
            ))}
          </ul>
        )}
      </section>

      <section className="panel overflow-hidden" aria-labelledby="docket-incidents">
        <div className="panel-head">
          <h2 id="docket-incidents" className="label" style={{ color: 'var(--ink-2)' }}>
            Production incidents
          </h2>
        </div>
        {incidentsState.loading ? (
          <RailPlaceholder />
        ) : incidents.length === 0 ? (
          <div className="p-4">
            <EmptyState kicker="Clean record" title="No incidents on file." />
          </div>
        ) : (
          <ul>
            {incidents.map((i) => (
              <IncidentEntry key={i.id} incident={i} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
