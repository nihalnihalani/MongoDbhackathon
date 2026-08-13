import { useEffect, useReducer } from 'react'
import { connectStream } from '../lib/stream'
import type { LogEntry, ReviewStatus, Scrutiny, StreamEvent } from '../lib/types'
import { toStatus } from '../lib/format'

export interface LiveCase {
  reviewId: string
  prId: string
  title: string
  author: string
  scrutiny: Scrutiny
  status: ReviewStatus
  startedAt: number
}

export interface CredibilityMove {
  from: number
  to: number
  at: number
}

export interface StreamState {
  entries: LogEntry[]
  current: LiveCase | null
  /** Live score overrides keyed by contributor id, applied over fetched data. */
  moves: Record<string, CredibilityMove>
  /** Total events seen since mount — drives the "evidence logged" counter. */
  count: number
}

const INITIAL: StreamState = { entries: [], current: null, moves: {}, count: 0 }

/** Keep the log bounded; a looping fixture stream would otherwise grow forever. */
const MAX_ENTRIES = 120

/**
 * `set_scrutiny` arrives as a generic action, so the level is read off the
 * label the agent wrote. Anything unrecognized leaves scrutiny untouched.
 */
function scrutinyFromLabel(label: string): Scrutiny | null {
  const l = label.toLowerCase()
  if (l.includes('maximum')) return 'maximum'
  if (l.includes('elevated')) return 'elevated'
  if (l.includes('normal')) return 'normal'
  return null
}

function reduce(state: StreamState, event: StreamEvent): StreamState {
  const at = Date.now()
  const entry: LogEntry = { key: `${at}-${state.count}`, at, event }
  const entries = [...state.entries, entry].slice(-MAX_ENTRIES)
  const next: StreamState = { ...state, entries, count: state.count + 1 }

  switch (event.type) {
    case 'review_started':
      return {
        ...next,
        // A new case clears the bench: the log always shows one investigation.
        entries: [entry],
        current: {
          reviewId: event.reviewId,
          prId: event.prId,
          title: event.title,
          author: event.author,
          scrutiny: event.scrutiny,
          status: 'investigating',
          startedAt: at,
        },
      }

    case 'action': {
      if (event.kind !== 'set_scrutiny' || !next.current) return next
      const level = scrutinyFromLabel(event.label)
      if (!level) return next
      return { ...next, current: { ...next.current, scrutiny: level } }
    }

    case 'judgment':
      if (!next.current) return next
      return { ...next, current: { ...next.current, status: toStatus(event.decision) } }

    case 'credibility_change':
      return {
        ...next,
        moves: {
          ...next.moves,
          [event.contributorId]: { from: event.from, to: event.to, at },
        },
      }

    default:
      return next
  }
}

/**
 * Subscribes to the agent stream for the lifetime of the component and folds
 * events into the state the Courtroom renders.
 */
export function useAgentStream(): StreamState {
  const [state, dispatch] = useReducer(reduce, INITIAL)

  useEffect(() => {
    const handle = connectStream((event) => dispatch(event))
    return () => handle.stop()
  }, [])

  return state
}
