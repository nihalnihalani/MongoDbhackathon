import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { LogEntry, ReviewStatus, StreamEventType } from '../lib/types'
import { clockTime, prNumber, signed, toStatus } from '../lib/format'
import { useTypedText } from '../hooks/useTypedText'
import { useCountUp } from '../hooks/useCountUp'
import { Stamp } from './Stamp'
import { SimilarityMeter } from './SimilarityMeter'

/* ---------------------------------------------------------------------------
   DESIGN.md §8.1 — the event taxonomy. Glyph, ink, and label per event type.
   ------------------------------------------------------------------------ */

const TAG: Record<StreamEventType, { glyph: string; ink: string; label: string }> = {
  review_started: { glyph: '○', ink: 'var(--ink-2)', label: 'Case opened' },
  belief: { glyph: '◆', ink: 'var(--ink)', label: 'Belief' },
  retrieval: { glyph: '⧉', ink: 'var(--ink-2)', label: 'Memory retrieved' },
  action: { glyph: '▸', ink: 'var(--ink-steel)', label: 'Action' },
  escalation: { glyph: '▲', ink: 'var(--ink-mimeo)', label: 'Escalated — OpenRouter critic' },
  judgment: { glyph: '■', ink: 'var(--ink)', label: 'Judgment' },
  credibility_change: { glyph: '±', ink: 'var(--ink)', label: 'Credibility revised' },
  incident_attributed: { glyph: '!', ink: 'var(--ink-red)', label: 'Incident attributed' },
}

function verdictInk(status: ReviewStatus): string {
  switch (status) {
    case 'blocked':
      return 'var(--ink-red)'
    case 'approved':
      return 'var(--ink-green)'
    case 'commented':
      return 'var(--ink-amber)'
    default:
      return 'var(--ink-steel)'
  }
}

/** The one typed element in the stream, set at display size. */
const proseStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(1.3rem, 3.4vw, var(--fs-display-m))',
  lineHeight: 1.3,
  letterSpacing: '-0.01em',
  color: 'var(--ink)',
  maxWidth: 'var(--prose-max)',
}

/**
 * Prose that types itself. The animated node is hidden from assistive tech and
 * the complete string is exposed once on completion, so a screen reader hears
 * the sentence rather than every intermediate prefix.
 */
function Typed({ text, live, style }: { text: string; live: boolean; style?: CSSProperties }) {
  const { shown, done } = useTypedText(text, live)
  return (
    <>
      <p aria-hidden="true" className={done ? undefined : 'caret'} style={style}>
        {shown}
      </p>
      {done && <span className="sr-only">{text}</span>}
    </>
  )
}

interface LogEventProps {
  entry: LogEntry
  /** The newest entry animates its reveal; older ones render complete. */
  live: boolean
}

export function LogEvent({ entry, live }: LogEventProps) {
  const { event, at } = entry
  const tag = TAG[event.type]

  // Verdict and score rows take their ink from the outcome, not the event type.
  const ink =
    event.type === 'judgment'
      ? verdictInk(toStatus(event.decision))
      : event.type === 'credibility_change'
        ? event.to < event.from
          ? 'var(--ink-red)'
          : 'var(--ink-green)'
        : tag.ink

  return (
    <li className={`event flex gap-3 ${event.type === 'escalation' ? 'escalation pl-3' : ''}`}>
      <div className="event-gutter pt-2.5" aria-hidden="true">
        <span className="event-glyph" style={{ color: ink }}>
          {tag.glyph}
        </span>
      </div>

      <div className="min-w-0 flex-1 pt-2.5 pb-6">
        <div className="flex items-baseline gap-3">
          <h3 className="label" style={{ color: ink }}>
            {tag.label}
          </h3>
          <time
            className="mono ml-auto shrink-0"
            style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-3)' }}
          >
            {clockTime(at)}
          </time>
        </div>

        <div className="mt-2.5">
          <EventBody entry={entry} live={live} />
        </div>
      </div>
    </li>
  )
}

function EventBody({ entry, live }: LogEventProps) {
  const { event } = entry

  switch (event.type) {
    case 'review_started':
      return (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="num" style={{ fontSize: 'var(--fs-numeral)', color: 'var(--ink-amber)' }}>
            {prNumber(event.prId)}
          </span>
          <span
            style={{
              fontSize: 'var(--fs-title)',
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: '-0.005em',
            }}
          >
            {event.title}
          </span>
          <span className="label">opened by {event.author}</span>
        </div>
      )

    case 'belief':
      return <Typed text={event.text} live={live} style={proseStyle} />

    case 'retrieval':
      return (
        <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {event.memories.map((memory, i) => (
            <li
              key={i}
              className="evidence-card min-w-0 flex-1 border p-3 sm:min-w-[17rem]"
              style={{
                // Deals out of a stack: -1.2° / 0° / +1.2° by index.
                ['--fan' as string]: `${[-1.2, 0, 1.2][i % 3]}deg`,
                animationDelay: `${i * 70}ms`,
                background: 'var(--surface-2)',
                borderColor: 'var(--line-strong)',
                borderRadius: 'var(--r-1)',
                boxShadow: 'var(--elev-1)',
              }}
            >
              <SimilarityMeter value={memory.similarity} />
              <p
                className="mono mt-2"
                style={{ fontSize: 'var(--fs-mono-sm)', lineHeight: 1.5, color: 'var(--ink-2)' }}
              >
                {memory.text}
              </p>
            </li>
          ))}
        </ul>
      )

    case 'action':
      return (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="mono" style={{ fontSize: 'var(--fs-mono)', color: 'var(--ink)' }}>
            {event.label}
          </span>
          {event.output && (
            <span
              className="mono"
              style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-3)', lineHeight: 1.5 }}
            >
              {event.output}
            </span>
          )}
        </div>
      )

    case 'escalation':
      return (
        <p
          style={{
            fontSize: 'var(--fs-prose)',
            lineHeight: 'var(--lh-prose)',
            color: 'var(--ink-2)',
            maxWidth: 'var(--prose-max)',
          }}
        >
          {event.reason}
        </p>
      )

    case 'judgment':
      return (
        <div className={`flex flex-col items-start gap-4 ${live ? 'slam-impact' : ''}`}>
          <Stamp status={toStatus(event.decision)} size="lg" slam={live} />
          <Typed text={event.reasoning} live={live} style={proseStyle} />
        </div>
      )

    case 'credibility_change':
      return <CredibilityChange event={event} live={live} />

    case 'incident_attributed':
      return (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="mono" style={{ fontSize: 'var(--fs-mono)', color: 'var(--ink)' }}>
            {event.incidentId.toUpperCase()} → {prNumber(event.prId)}
          </span>
          <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--ink-2)' }}>
            attributed to{' '}
            <Link
              to={`/contributor/${event.contributorId}`}
              className="capitalize underline decoration-dotted underline-offset-4"
              style={{ color: 'var(--ink)' }}
            >
              {event.contributorId}
            </Link>
          </span>
          <span className="num" style={{ fontSize: 'var(--fs-mono-sm)', color: 'var(--ink-red)' }}>
            confidence {event.confidence.toFixed(2)}
          </span>
        </div>
      )
  }
}

function CredibilityChange({
  event,
  live,
}: {
  event: Extract<LogEntry['event'], { type: 'credibility_change' }>
  live: boolean
}) {
  const value = useCountUp(event.from, event.to, live)
  const delta = event.to - event.from
  const ink = delta < 0 ? 'var(--ink-red)' : 'var(--ink-green)'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          to={`/contributor/${event.contributorId}`}
          className="label capitalize underline decoration-dotted underline-offset-4"
          style={{ color: 'var(--ink-2)' }}
        >
          {event.contributorId}
        </Link>
        <span className="num" style={{ fontSize: 'var(--fs-mono)', color: 'var(--ink-3)' }}>
          {event.from}
        </span>
        <span aria-hidden="true" style={{ color: 'var(--ink-3)' }}>
          →
        </span>
        <span className="num" style={{ fontSize: 'var(--fs-display-m)', color: ink }}>
          {value}
        </span>
        <span
          className="num px-1.5 py-0.5"
          style={{
            fontSize: 'var(--fs-mono-sm)',
            color: ink,
            border: `1px solid ${ink}`,
            borderRadius: 'var(--r-1)',
          }}
        >
          {signed(delta)}
        </span>
      </div>
      <p style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--ink-2)' }}>{event.reason}</p>
    </div>
  )
}
