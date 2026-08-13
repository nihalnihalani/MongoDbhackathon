import { useContext, useEffect, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { LogEntry, ReviewStatus, StreamEventType } from '../lib/types'
import { clockTime, prNumber, signed, toStatus } from '../lib/format'
import { useTypedText } from '../hooks/useTypedText'
import { useCountUp } from '../hooks/useCountUp'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { pulseCause, revealCause, setLinked } from '../lib/causality'
import { MemoryIndex } from '../lib/memoryIndex'
import { Stamp } from './Stamp'
import { SimilarityMeter } from './SimilarityMeter'
import { CredibilityChip } from './CredibilityChip'
import { reviewPathForSource } from '../lib/links'

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
  // The pause before the escalation. It needs a visible marker or the silence
  // reads as the app having hung.
  hesitation: { glyph: '⋯', ink: 'var(--ink-3)', label: '' },
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

/** The belief pull-quote: Instrument Serif, full column width, no card. */
const beliefStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(1.5rem, 3.4vw, var(--fs-belief))',
  lineHeight: 1.35,
  letterSpacing: '-0.01em',
  color: 'var(--ink)',
  maxWidth: 'var(--prose-max)',
  borderLeft: '3px solid var(--ink-2)',
  paddingLeft: 'var(--s-4)',
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

/** Trim a memory to something that fits on one line of a causal link. */
function excerpt(text: string, max = 64): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).replace(/[\s,.;:—-]+$/, '')}…`
}

/**
 * DESIGN.md §8.3 — the caused row names its cause, and lighting either end
 * lights the other. This is the component that turns a transcript into a chain.
 */
function CausedBy({ ids, live }: { ids: string[]; live: boolean }) {
  const index = useContext(MemoryIndex)

  // The pulse is the causal claim being made, so it fires as the row lands.
  useEffect(() => {
    if (!live || ids.length === 0) return
    const id = window.setTimeout(() => pulseCause(ids), 120)
    return () => window.clearTimeout(id)
  }, [live, ids])

  if (ids.length === 0) return null

  return (
    <p
      className="mono mb-2.5"
      data-caused-by={ids.join(' ')}
      style={{ fontSize: 'var(--fs-mono-sm)', lineHeight: 1.6, color: 'var(--ink-mimeo)' }}
      onMouseEnter={() => setLinked(ids, true)}
      onMouseLeave={() => setLinked(ids, false)}
    >
      <span aria-hidden="true">⤷ </span>
      <span className="label" style={{ color: 'var(--ink-mimeo)' }}>
        Because of
      </span>{' '}
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && <span style={{ color: 'var(--ink-3)' }}> · </span>}
          <button
            type="button"
            className="causal-link"
            onClick={() => revealCause(id)}
            onFocus={() => setLinked([id], true)}
            onBlur={() => setLinked([id], false)}
          >
            {index[id] ? `“${excerpt(index[id])}”` : id}
          </button>
        </span>
      ))}
    </p>
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
  const isJudgment = event.type === 'judgment'
  const isHesitation = event.type === 'hesitation'

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
      {/* The judgment is the only event that breaks the gutter (DESIGN.md §7.5),
          so it does not get one. Rendering the spine here and then sliding the
          content back underneath it would leave the glyph's opaque background
          painted over the first two letters of the label. */}
      {!isJudgment && (
        <div className="event-gutter pt-2.5" aria-hidden="true">
          <span className="event-glyph" style={{ color: ink }}>
            {tag.glyph}
          </span>
        </div>
      )}

      <div className={`min-w-0 flex-1 pt-2.5 pb-6 ${isJudgment ? 'judgment-full' : ''}`}>
        {isHesitation ? (
          <Hesitation live={live} />
        ) : (
          <>
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
          </>
        )}
      </div>
    </li>
  )
}

/**
 * The stillness beat made visible (DESIGN.md §7.1, step 5).
 *
 * Do not be tempted to delete the marker and keep only the pause. A 1.5-second
 * freeze with nothing on screen reads as the demo hanging; the same freeze with
 * three dots that breathe and then STOP reads as the agent deciding something.
 * The dots stopping is the part that matters — a spinner that never stops says
 * "waiting", and this beat is not waiting, it is thinking.
 */
function Hesitation({ live }: { live: boolean }) {
  const reduced = useReducedMotion()

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="hesitation-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {live && !reduced && (
        <span className="label" style={{ color: 'var(--ink-3)' }}>
          Considering
        </span>
      )}
    </div>
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
      return <Typed text={event.text} live={live} style={beliefStyle} />

    /* The burst: one cluster, 90ms apart. The chip appears HERE ONLY — a score
       is always something the agent just looked up, never ambient state. */
    case 'retrieval':
      return (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {event.memories.map((memory, i) => {
              // A card only becomes a link when there is a real record behind
              // it. Navigating a judge into a 404 costs more than the click is
              // worth (DESIGN.md §8.4).
              const href = reviewPathForSource(memory.sourceId)
              const body = (
                <>
                  <SimilarityMeter
                    value={memory.similarity}
                    kind={memory.kind}
                    label={memory.kind === 'self' ? 'Self — review failure' : memory.kind}
                  />
                  <p
                    className="mono mt-2"
                    style={{
                      fontSize: 'var(--fs-mono-sm)',
                      lineHeight: 1.5,
                      color: 'var(--ink-2)',
                    }}
                  >
                    {memory.text}
                  </p>
                </>
              )
              const style = {
                background: 'var(--surface-2)',
                borderColor: 'var(--line-strong)',
                borderLeft:
                  memory.kind === 'self' ? '3px solid var(--ink-mimeo)' : undefined,
                borderRadius: 'var(--r-1)',
                boxShadow: 'var(--elev-1)',
              }

              return (
                <li
                  key={memory.id}
                  data-mem={memory.id}
                  className="burst-item min-w-0 flex-1 sm:min-w-[15rem]"
                  style={{ ['--burst-i' as string]: i }}
                  onMouseEnter={() => setLinked([memory.id], true)}
                  onMouseLeave={() => setLinked([memory.id], false)}
                >
                  {href ? (
                    <Link to={href} className="lift block h-full border p-3" style={style}>
                      {body}
                    </Link>
                  ) : (
                    <div className="block h-full border p-3" style={style}>
                      {body}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {event.contributorId && (
            <div
              className="burst-item"
              style={{ ['--burst-i' as string]: event.memories.length }}
            >
              <CredibilityChip id={event.contributorId} />
            </div>
          )}
        </div>
      )

    case 'action':
      return (
        <>
          {event.causedBy && <CausedBy ids={event.causedBy} live={live} />}
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
        </>
      )

    case 'escalation':
      return (
        <>
          <CausedBy ids={event.causedBy} live={live} />
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
        </>
      )

    case 'judgment':
      return <Judgment event={event} live={live} />

    case 'credibility_change':
      return <CredibilityChange event={event} live={live} />

    case 'hesitation':
      return null

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

/**
 * The one stamped moment in the whole product (DESIGN.md §7.5).
 *
 * The press rides the stamp; the 2px shove rides this container. Separating them
 * is what sells the weight — the die hits, and the paper takes it.
 *
 * The verdict is announced to assistive tech through a live region rather than
 * through the animation, because an animation announces nothing.
 */
function Judgment({
  event,
  live,
}: {
  event: Extract<LogEntry['event'], { type: 'judgment' }>
  live: boolean
}) {
  const status = toStatus(event.decision)
  const stamped = status !== 'investigating' ? status : null

  return (
    <div className={`flex flex-col items-start gap-5 ${live ? 'press-impact' : ''}`}>
      {stamped && <Stamp status={stamped} press={live} />}
      <Typed
        text={event.reasoning}
        live={live}
        style={{
          fontSize: 'var(--fs-prose)',
          lineHeight: 'var(--lh-prose)',
          color: 'var(--ink)',
          maxWidth: 'var(--prose-max)',
        }}
      />
      <span aria-live="polite" className="sr-only">
        {stamped ? `Verdict: ${stamped}.` : ''}
      </span>
    </div>
  )
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
        {/* The figure never renders bare — the subsystem rides with it. */}
        <span className="num" style={{ fontSize: 'var(--fs-display-m)', color: ink }}>
          {value}
        </span>
        <span className="label" style={{ color: 'var(--ink-3)' }}>
          · {event.subsystem}
        </span>
        <span
          className={`num px-1.5 py-0.5 ${live ? 'delta-flash' : ''}`}
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
